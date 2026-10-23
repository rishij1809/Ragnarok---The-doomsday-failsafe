# Standalone AWS Primary Infrastructure Root Module
# Leverages the modular infrastructure/terraform/modules/aws module

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "aws_infrastructure" {
  source = "../modules/aws"

  environment         = var.environment
  aws_region          = var.aws_region
  vpc_cidr            = var.vpc_cidr
  public_subnet_cidrs = var.public_subnet_cidrs
  app_subnet_cidrs    = var.app_subnet_cidrs
  db_subnet_cidrs     = var.db_subnet_cidrs
  azure_vnet_cidr     = var.azure_vnet_cidr
  django_secret_key   = var.django_secret_key
  postgres_user       = var.postgres_user
  postgres_password   = var.postgres_password
  db_name             = var.db_name
}
