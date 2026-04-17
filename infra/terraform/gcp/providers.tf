terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State lives in a GCS bucket created by BOOTSTRAP.md step 2.
  # Bucket name is project-scoped — update the `bucket` line after project creation.
  backend "gcs" {
    bucket = "pebble-tf-state-pebble-493618"
    prefix = "staging"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region

  # Force Terraform's Google API calls to bill quota to THIS project instead
  # of the default ADC-inferred one (fixes billingbudgets / serviceusage /
  # cloudresourcemanager "SERVICE_DISABLED" errors under user creds).
  user_project_override = true
  billing_project       = var.project_id

  default_labels = {
    project     = "pebble"
    environment = "staging"
    managed_by  = "terraform"
  }
}

provider "google-beta" {
  project = var.project_id
  region  = var.region

  user_project_override = true
  billing_project       = var.project_id
}
