resource "google_artifact_registry_repository" "backend" {
  location      = var.region
  repository_id = "pebble"
  description   = "Pebble backend container images"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-last-10-tagged"
    action = "KEEP"
    most_recent_versions {
      package_name_prefixes = ["backend"]
      keep_count            = 10
    }
  }

  cleanup_policies {
    id     = "delete-untagged-after-7d"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s"
    }
  }

  depends_on = [google_project_service.enabled]
}
