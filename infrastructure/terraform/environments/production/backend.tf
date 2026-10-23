# Project "Ragnarock" Remote State Management Architecture
# -----------------------------------------------------------------------------
# Production state configuration for multi-cloud IaC synchronization.
# Uncomment the desired remote backend strategy below when deploying to cloud state storage.

terraform {
  # Strategy Option A: AWS S3 + DynamoDB State Locking (Recommended Primary)
  # backend "s3" {
  #   bucket         = "ragnarock-terraform-state-prod-us-east-1"
  #   key            = "multi-cloud-dr/production/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "ragnarock-terraform-locks"
  #   encrypt        = true
  # }

  # Strategy Option B: Azure Blob Storage Remote State + Blob Lease Lock
  # backend "azurerm" {
  #   resource_group_name  = "rg-ragnarock-tfstate-eastus"
  #   storage_account_name = "stragnarocktfstate2026"
  #   container_name       = "tfstate-production"
  #   key                  = "multi-cloud-dr.production.tfstate"
  # }

  # Strategy Option C: Terraform Cloud / OpenTofu Cloud Managed Workspace
  # cloud {
  #   organization = "ragnarock-dr-org"
  #   workspaces {
  #     name = "production-multi-cloud-dr"
  #   }
  # }
}
