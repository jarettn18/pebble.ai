# ---------- Service accounts ----------

resource "google_service_account" "runtime" {
  account_id   = "pebble-runtime"
  display_name = "Pebble backend runtime (Cloud Run Service + Job)"
}

resource "google_service_account" "deployer" {
  account_id   = "pebble-deployer"
  display_name = "Pebble CI deployer (impersonated by GitHub Actions)"
}

# ---------- Workload Identity Federation (GitHub → GCP, keyless) ----------

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions"
  depends_on                = [google_project_service.enabled]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub OIDC"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # Only the staging branch of the configured repo may mint tokens.
  attribute_condition = "assertion.repository == \"${var.github_repo}\" && assertion.ref == \"refs/heads/${var.github_branch}\""
}

# principalSet:// (not principal://) — this binds the whole repo, not a single sub.
resource "google_service_account_iam_member" "deployer_wif" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

# ---------- Deployer roles (CI) ----------

locals {
  deployer_roles = [
    "roles/run.admin",               # update services + jobs
    "roles/artifactregistry.writer", # push images
    "roles/iam.serviceAccountUser",  # actAs runtime SA when deploying
  ]
}

resource "google_project_iam_member" "deployer" {
  for_each = toset(local.deployer_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

# ---------- Runtime roles (Cloud Run Service + Job) ----------

locals {
  runtime_project_roles = [
    "roles/cloudsql.client",
    "roles/logging.logWriter",
  ]
}

resource "google_project_iam_member" "runtime" {
  for_each = toset(local.runtime_project_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.runtime.email}"
}

# Per-secret accessor. Project-wide grant would be too broad; per-secret keeps
# the blast radius minimal and is the supported pattern for Cloud Run.
resource "google_secret_manager_secret_iam_member" "runtime_access" {
  for_each  = google_secret_manager_secret.app
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}
