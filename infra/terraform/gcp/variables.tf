variable "project_id" {
  description = "GCP project ID (e.g. pebble-staging-12345)"
  type        = string
}

variable "region" {
  description = "GCP region for all regional resources"
  type        = string
  default     = "us-central1"
}

variable "billing_account" {
  description = "Billing account ID the budget is attached to (format: XXXXXX-XXXXXX-XXXXXX)"
  type        = string
}

variable "github_repo" {
  description = "GitHub repo in OWNER/REPO format, used for Workload Identity Federation"
  type        = string
}

variable "github_branch" {
  description = "Branch allowed to deploy via WIF"
  type        = string
  default     = "staging"
}

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro"
}

variable "budget_amount_usd" {
  description = "Monthly budget cap for the staging project, in USD"
  type        = number
  default     = 50
}

variable "alert_email" {
  description = "Email to receive budget + failure alerts"
  type        = string
}

variable "backend_image" {
  description = "Initial backend image URI. CI rotates this on every deploy; TF ignores drift."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

# ---- Secrets (set via TF_VAR_* env vars or terraform.tfvars; never commit) ----

variable "upstash_redis_url" {
  description = "Full rediss://default:TOKEN@HOST:PORT URL from Upstash"
  type        = string
  sensitive   = true
}

variable "plaid_client_id" {
  type      = string
  sensitive = true
  default   = ""
}

variable "plaid_secret" {
  type      = string
  sensitive = true
  default   = ""
}

variable "plaid_env" {
  type    = string
  default = "sandbox"
}

variable "anthropic_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "encryption_key" {
  description = "App-level encryption key. Leave blank to auto-generate a 32-byte random key."
  type        = string
  sensitive   = true
  default     = ""
}

variable "twilio_account_sid" {
  type      = string
  sensitive = true
  default   = ""
}

variable "twilio_auth_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "twilio_verify_service_sid" {
  type      = string
  sensitive = true
  default   = ""
}
