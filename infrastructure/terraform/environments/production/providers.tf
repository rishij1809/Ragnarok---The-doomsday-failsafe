terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# AWS Provider Configuration (Primary Region)
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Ragnarock"
      Environment = "Production"
      ManagedBy   = "Terraform"
      Cloud       = "AWS-Primary"
    }
  }
}

# AzureRM Provider Configuration (Secondary Region)
provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
      recover_soft_deleted_key_vaults = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}
