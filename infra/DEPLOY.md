# Pebble — Staging Deployment Guide

## Architecture Overview

The staging environment runs on AWS with the following components:

- **Compute**: ECS Fargate (1 task, 0.5 vCPU / 1 GB RAM)
- **Database**: RDS PostgreSQL 16 (db.t4g.micro)
- **Cache**: ElastiCache Redis 7.1 (cache.t4g.micro)
- **Load Balancer**: ALB (public-facing, HTTP on port 80)
- **Container Registry**: ECR (auto-cleanup keeps last 10 images)
- **CI/CD**: GitHub Actions → ECR → ECS rolling deploy

Estimated monthly cost: ~$50–70/mo for staging-tier instances.

---

## Prerequisites

1. **AWS account** with an IAM user (or role) that has permissions for ECS, ECR, RDS, ElastiCache, VPC, ALB, CloudWatch, and IAM.
2. **Terraform >= 1.5** installed locally.
3. **Docker** installed locally (for initial image push).
4. **AWS CLI v2** configured (`aws configure`).

---

## Step 1: Provision Infrastructure with Terraform

```bash
cd infra/terraform

# Create your variables file from the example
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set a strong db_password

# Initialize and plan
terraform init
terraform plan

# Apply (this takes ~10 minutes for RDS + VPC)
terraform apply
```

After apply, note the outputs:

- `ecr_repository_url` — you'll need this for the first image push
- `api_url` — the ALB endpoint for your staging API
- `rds_endpoint` — for reference/debugging

---

## Step 2: Push the First Docker Image

The ECS service needs an image to exist in ECR before it can start. Do an initial push:

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ECR_REGISTRY>

# Build and push
docker build -f backend/Dockerfile.staging -t <ECR_REPO_URL>:latest backend/
docker push <ECR_REPO_URL>:latest
```

Then update `terraform.tfvars` with the full image URI and run `terraform apply` again to create the task definition with the real image.

---

## Step 3: Configure GitHub Actions Secrets

In your GitHub repo, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM access key (or use OIDC — see workflow comments) |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |

For production, switch to **OIDC-based auth** (uncomment the role-to-assume lines in the workflow and remove the access key secrets).

---

## Step 4: Create the Staging Branch and Deploy

```bash
git checkout -b staging
git push -u origin staging
```

The GitHub Actions workflow triggers on every push to the `staging` branch. It will:

1. Run the test suite against PostgreSQL + Redis service containers
2. Build the Docker image from `Dockerfile.staging`
3. Push to ECR (tagged with the commit SHA + `latest`)
4. Update the ECS task definition with the new image
5. Deploy and wait for service stability

You can also trigger it manually from the Actions tab (workflow_dispatch).

---

## Day-to-Day Workflow

```bash
# Merge feature work into staging to deploy
git checkout staging
git merge feature/my-feature
git push
# → GitHub Actions auto-deploys

# Check deploy status
gh run list --workflow=deploy-staging.yml

# View logs
aws logs tail /ecs/pebble-staging/backend --follow

# Force a new deployment (same image)
aws ecs update-service --cluster pebble-staging --service backend --force-new-deployment
```

---

## Useful Commands

```bash
# SSH-like access to running container (ECS Exec)
aws ecs execute-command \
  --cluster pebble-staging \
  --task <TASK_ID> \
  --container backend \
  --interactive \
  --command "/bin/sh"

# Run migrations manually
aws ecs execute-command \
  --cluster pebble-staging \
  --task <TASK_ID> \
  --container backend \
  --interactive \
  --command "alembic upgrade head"

# Destroy staging (when no longer needed)
cd infra/terraform && terraform destroy
```

---

## Notes

- **pgvector**: RDS PostgreSQL 16 supports pgvector natively — no extra setup needed. Run `CREATE EXTENSION IF NOT EXISTS vector;` via a migration if not already present.
- **Secrets management**: For a more robust setup, move sensitive env vars (API keys, JWT secret) to AWS Secrets Manager and reference them in the ECS task definition.
- **HTTPS**: To add TLS, create an ACM certificate and add an HTTPS listener to the ALB. The Terraform config currently serves HTTP only for simplicity.
- **Cost control**: The single NAT gateway, single-AZ RDS, and t4g.micro instances are chosen to keep staging costs low. Do not use these settings for production.
