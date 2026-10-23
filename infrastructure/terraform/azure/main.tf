# Standalone Azure Secondary Infrastructure Root Module
# Leverages the modular infrastructure/terraform/modules/azure module

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

module "azure_infrastructure" {
  source = "../modules/azure"

  environment         = var.environment
  azure_location      = var.azure_location
  vnet_cidr           = var.vnet_cidr
  gateway_subnet_cidr = var.gateway_subnet_cidr
  public_subnet_cidr  = var.public_subnet_cidr
  app_subnet_cidr     = var.app_subnet_cidr
  db_subnet_cidr      = var.db_subnet_cidr
  aws_vpc_cidr        = var.aws_vpc_cidr
  django_secret_key   = var.django_secret_key
  postgres_user       = var.postgres_user
  postgres_password   = var.postgres_password
  db_name             = var.db_name
}
