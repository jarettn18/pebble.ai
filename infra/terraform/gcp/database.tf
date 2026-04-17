resource "random_password" "db" {
  length  = 32
  special = true
  # Avoid characters that complicate URL-encoding the password in DATABASE_URL.
  override_special = "!-_.~"
}

resource "google_sql_database_instance" "pg" {
  name             = "pebble-staging"
  database_version = "POSTGRES_16"
  region           = var.region

  deletion_protection = false # staging

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = false
      start_time                     = "07:00"
    }

    # Public IP is enabled so Cloud Run's built-in socket proxy can reach the
    # instance (it routes via Google's network, not the open internet).
    # No `authorized_networks` blocks → nothing outside Google can connect.
    # `ssl_mode = ENCRYPTED_ONLY` blocks plaintext even from inside Google.
    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = false
      record_client_address   = false
    }
  }

  depends_on = [google_project_service.enabled]
}

resource "google_sql_database" "pebble" {
  name     = "pebble"
  instance = google_sql_database_instance.pg.name
}

resource "google_sql_user" "pebble" {
  name     = "pebble"
  instance = google_sql_database_instance.pg.name
  password = random_password.db.result
}
