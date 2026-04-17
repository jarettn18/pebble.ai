resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "random_password" "encryption" {
  length  = 32
  special = false
}

locals {
  # All app secrets in one place. Cloud Run mounts each as an env var.
  # The DATABASE_URL host path uses the Cloud SQL socket the service mounts
  # at /cloudsql/<connection_name>. asyncpg honors the ?host= query param.
  secrets = {
    database-url = format(
      "postgresql+asyncpg://%s:%s@/pebble?host=/cloudsql/%s",
      google_sql_user.pebble.name,
      urlencode(random_password.db.result),
      google_sql_database_instance.pg.connection_name,
    )
    db-password               = random_password.db.result
    redis-url                 = var.upstash_redis_url
    jwt-secret-key            = random_password.jwt.result
    plaid-client-id           = var.plaid_client_id
    plaid-secret              = var.plaid_secret
    anthropic-api-key         = var.anthropic_api_key
    encryption-key            = var.encryption_key != "" ? var.encryption_key : random_password.encryption.result
    twilio-account-sid        = var.twilio_account_sid
    twilio-auth-token         = var.twilio_auth_token
    twilio-verify-service-sid = var.twilio_verify_service_sid
  }

  # Map the secret ID (as stored in Secret Manager) to the env var name the app expects.
  secret_env_map = {
    database-url              = "DATABASE_URL"
    db-password               = "DB_PASSWORD"
    redis-url                 = "REDIS_URL"
    jwt-secret-key            = "JWT_SECRET_KEY"
    plaid-client-id           = "PLAID_CLIENT_ID"
    plaid-secret              = "PLAID_SECRET"
    anthropic-api-key         = "ANTHROPIC_API_KEY"
    encryption-key            = "ENCRYPTION_KEY"
    twilio-account-sid        = "TWILIO_ACCOUNT_SID"
    twilio-auth-token         = "TWILIO_AUTH_TOKEN"
    twilio-verify-service-sid = "TWILIO_VERIFY_SERVICE_SID"
  }
}

resource "google_secret_manager_secret" "app" {
  for_each  = local.secrets
  secret_id = "pebble-staging-${each.key}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

resource "google_secret_manager_secret_version" "app" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.app[each.key].id
  secret_data = each.value
}
