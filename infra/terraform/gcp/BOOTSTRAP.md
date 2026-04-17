# GCP bootstrap (one-time, pre-Terraform)

These steps must be run **before** the first `terraform init`. They create
the resources Terraform can't create for itself (the project, the state
bucket, the bootstrap APIs).

## Prerequisites

- `gcloud` CLI logged in: `gcloud auth login && gcloud auth application-default login`
- A GCP billing account you can attach. List with `gcloud billing accounts list`.

## 1. Create the project

```bash
PROJECT_ID="pebble-staging-$(date +%s | tail -c 6)"   # or pick any globally unique id
BILLING_ACCOUNT="XXXXXX-XXXXXX-XXXXXX"

gcloud projects create "$PROJECT_ID" --name="Pebble Staging"
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
gcloud config set project "$PROJECT_ID"
```

## 2. Create the Terraform state bucket

```bash
gcloud storage buckets create "gs://pebble-tf-state-${PROJECT_ID}" \
  --location=us-central1 \
  --uniform-bucket-level-access
gcloud storage buckets update "gs://pebble-tf-state-${PROJECT_ID}" \
  --versioning
```

Then update `providers.tf` backend block to match the bucket name:

```hcl
backend "gcs" {
  bucket = "pebble-tf-state-<your-project-id>"
  prefix = "staging"
}
```

## 3. Enable bootstrap APIs

Terraform enables the rest via `apis.tf`, but these two must exist before TF
can even start:

```bash
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com
```

## 4. Write `terraform.tfvars` (gitignored)

```hcl
project_id       = "pebble-staging-12345"
billing_account  = "XXXXXX-XXXXXX-XXXXXX"
github_repo      = "jarettn18/pebble.ai"
alert_email      = "you@example.com"

upstash_redis_url = "rediss://default:TOKEN@HOST:PORT"

plaid_client_id   = "..."
plaid_secret      = "..."
anthropic_api_key = "..."

twilio_account_sid        = "..."
twilio_auth_token         = "..."
twilio_verify_service_sid = "..."
```

Or export them as `TF_VAR_*` env vars for CI / direnv.

## 5. Upstash Redis

Free tier. Sign up at https://upstash.com/, create a Redis database in a
region close to `us-central1` (Iowa or Oregon), copy the `rediss://` URL.
No TF resource — it's external.

## 6. First apply

```bash
cd infra/terraform/gcp
terraform init
terraform plan
terraform apply
```

Expected: ~30 resources created. No destroys.

## 7. Seed CI secrets

Use the Terraform outputs:

```bash
gh secret set GCP_PROJECT_ID     --body "$(terraform output -raw project_id)"
gh secret set GCP_WIF_PROVIDER   --body "$(terraform output -raw wif_provider_resource_name)"
gh secret set GCP_DEPLOYER_SA    --body "$(terraform output -raw deployer_sa_email)"
```

Remove the old AWS secret:

```bash
gh secret delete AWS_ROLE_ARN
```

## 8. First migration + deploy

The initial `backend_image` var defaults to a placeholder (Google's hello
container). After the first CI run — or manually via `gcloud run deploy ...`
— Cloud Run will pick up the real image. Terraform's `lifecycle.ignore_changes`
on the image means future `apply`s won't revert it.

## 9. Mobile app

Copy `terraform output -raw service_url` into `mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://pebble-backend-HASH-uc.a.run.app
```
