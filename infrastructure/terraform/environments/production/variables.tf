variable "environment" {
  type        = string
  default     = "production"
  description = "Environment name identifier"
}

# AWS Variables
variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS Primary Region"
}

variable "aws_vpc_cidr" {
  type        = string
  default     = "10.100.0.0/16"
  description = "Non-overlapping CIDR block for AWS Primary VPC"
}

variable "aws_public_subnet_cidrs" {
  type        = list(string)
  default     = ["10.100.1.0/24", "10.100.2.0/24"]
  description = "AWS Public Subnet CIDRs"
}

variable "aws_app_subnet_cidrs" {
  type        = list(string)
  default     = ["10.100.10.0/24", "10.100.20.0/24"]
  description = "AWS Django Application Private Subnet CIDRs"
}

variable "aws_db_subnet_cidrs" {
  type        = list(string)
  default     = ["10.100.30.0/24", "10.100.40.0/24"]
  description = "AWS Isolated Database Private Subnet CIDRs"
}

# Azure Variables
variable "azure_location" {
  type        = string
  default     = "eastus"
  description = "Azure Secondary Region"
}

variable "azure_vnet_cidr" {
  type        = string
  default     = "10.200.0.0/16"
  description = "Non-overlapping CIDR block for Azure Standby VNet"
}

variable "azure_gateway_subnet_cidr" {
  type        = string
  default     = "10.200.255.0/27"
  description = "Azure GatewaySubnet CIDR for Phase 3 Site-to-Site VPN"
}

variable "azure_public_subnet_cidr" {
  type        = string
  default     = "10.200.1.0/24"
  description = "Azure Ingress/Public Subnet CIDR"
}

variable "azure_app_subnet_cidr" {
  type        = string
  default     = "10.200.10.0/24"
  description = "Azure Container Apps Subnet CIDR"
}

variable "azure_db_subnet_cidr" {
  type        = string
  default     = "10.200.20.0/24"
  description = "Azure PostgreSQL Delegated Subnet CIDR"
}

# Database & Application Credentials
variable "django_secret_key_aws" {
  type        = string
  sensitive   = true
  default     = "django-insecure-ragnarock-aws-primary-secret-key-2026-prod"
  description = "Django Secret Key for AWS Primary Workload"
}

variable "django_secret_key_azure" {
  type        = string
  sensitive   = true
  default     = "django-insecure-ragnarock-azure-secondary-secret-key-2026-standby"
  description = "Django Secret Key for Azure Secondary Workload"
}

variable "postgres_user" {
  type        = string
  default     = "ragnarock_admin"
  description = "Master username for PostgreSQL database"
}

variable "postgres_password" {
  type        = string
  sensitive   = true
  default     = "RagnarockSecureDBPass2026!"
  description = "Master password for PostgreSQL database"
}

variable "db_name" {
  type        = string
  default     = "ragnarock_db"
  description = "PostgreSQL Database name"
}
