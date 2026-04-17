# AWS legacy reference

These files document the AWS staging deployment that ran from initial Phase 9
setup through its decommission on **2026-04-16**. They are kept for
architectural reference only — the AWS account is closed and no state exists.

- `main.tf.reference` — monolithic Terraform that provisioned ECS Fargate,
  RDS Postgres 16, ElastiCache Redis 7, ALB, ECR, Secrets Manager, VPC, NAT
  Gateway, and the GitHub Actions OIDC role.
- `terraform.tfvars.example.reference` — template for the variables the
  monolith consumed.

The live staging infra has moved to GCP under `../gcp/`. See the root README
for the incident writeup that motivated the migration.
