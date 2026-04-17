output "service_url" {
  description = "Public HTTPS URL of the Cloud Run service"
  value       = google_cloud_run_v2_service.backend.uri
}

output "artifact_registry_repo" {
  description = "Full Artifact Registry path for docker push/pull"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.backend.repository_id}"
}

output "wif_provider_resource_name" {
  description = "Set as GitHub secret GCP_WIF_PROVIDER"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_sa_email" {
  description = "Set as GitHub secret GCP_DEPLOYER_SA"
  value       = google_service_account.deployer.email
}

output "sql_connection_name" {
  description = "Cloud SQL connection name (used in the socket path)"
  value       = google_sql_database_instance.pg.connection_name
}

output "migrate_job_name" {
  description = "Cloud Run Job name for alembic migrations"
  value       = google_cloud_run_v2_job.migrate.name
}

output "project_id" {
  description = "GCP project the stack is deployed into"
  value       = var.project_id
}
