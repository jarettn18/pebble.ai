locals {
  # Non-secret env vars. 11 secrets are injected separately via value_source.
  plain_env = {
    DATABASE_NAME   = google_sql_database.pebble.name
    DATABASE_USER   = google_sql_user.pebble.name
    PLAID_ENV       = var.plaid_env
    ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
    JWT_ALGORITHM   = "HS256"
    ENVIRONMENT     = "staging"
  }
}

# ---------- Migration Job (Alembic) ----------
# CI `gcloud run jobs update --image=$IMAGE` then `execute --wait` before
# deploying the service. Never ships in the service startup path — that was
# the ordering hazard behind the AWS incident.

resource "google_cloud_run_v2_job" "migrate" {
  name     = "pebble-migrate"
  location = var.region

  template {
    template {
      service_account = google_service_account.runtime.email
      max_retries     = 1
      timeout         = "300s"

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.pg.connection_name]
        }
      }

      containers {
        image   = var.backend_image
        command = ["alembic"]
        args    = ["upgrade", "head"]

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }

        dynamic "env" {
          for_each = local.plain_env
          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = local.secret_env_map
          content {
            name = env.value
            value_source {
              secret_key_ref {
                secret  = google_secret_manager_secret.app[env.key].secret_id
                version = "latest"
              }
            }
          }
        }
      }
    }
  }

  # CI rotates the image on every deploy — TF must not clobber it.
  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image]
  }

  depends_on = [
    google_project_iam_member.runtime,
    google_secret_manager_secret_iam_member.runtime_access,
  ]
}

# ---------- Backend Service (Cloud Run) ----------

resource "google_cloud_run_v2_service" "backend" {
  name     = "pebble-backend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.runtime.email
    timeout         = "60s"

    scaling {
      min_instance_count = 0 # non-negotiable: scales to zero
      max_instance_count = 3
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.pg.connection_name]
      }
    }

    containers {
      image = var.backend_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 12
        timeout_seconds       = 3
      }

      dynamic "env" {
        for_each = local.plain_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.secret_env_map
        content {
          name = env.value
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.app[env.key].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }

  depends_on = [
    google_project_iam_member.runtime,
    google_secret_manager_secret_iam_member.runtime_access,
  ]
}

# Public API — matches the old ALB's posture. The app handles auth.
resource "google_cloud_run_v2_service_iam_member" "public" {
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
