variable "environment" {
  type        = string
  default     = "production"
  description = "Environment identifier"
}

variable "azure_location" {
  type        = string
  default     = "eastus"
  description = "Azure Secondary Region for Project Ragnarock"
}

variable "vnet_cidr" {
  type        = string
  default     = "10.200.0.0/16"
  description = "Non-overlapping CIDR block for Azure Standby VNet"
}

variable "gateway_subnet_cidr" {
  type        = string
  default     = "10.200.255.0/27"
  description = "Dedicated GatewaySubnet for Azure Virtual Network Gateway"
}

variable "public_subnet_cidr" {
  type        = string
  default     = "10.200.1.0/24"
  description = "Public / Ingress Subnet CIDR"
}

variable "app_subnet_cidr" {
  type        = string
  default     = "10.200.10.0/24"
  description = "App Private Subnet CIDR"
}

variable "db_subnet_cidr" {
  type        = string
  default     = "10.200.20.0/24"
  description = "Database Delegated Subnet CIDR"
}

variable "aws_vpc_cidr" {
  type        = string
  default     = "10.100.0.0/16"
  description = "AWS Primary VPC CIDR for cross-cloud ingress routing"
}

variable "django_secret_key" {
  type        = string
  sensitive   = true
  default     = "django-insecure-ragnarock-azure-secondary-secret-key-2026"
  description = "Django secret key"
}

variable "postgres_user" {
  type        = string
  default     = "ragnarock_admin"
  description = "PostgreSQL user"
}

variable "postgres_password" {
  type        = string
  sensitive   = true
  default     = "RagnarockSecureAzureDBPass2026!"
  description = "PostgreSQL password"
}

variable "db_name" {
  type        = string
  default     = "ragnarock_db"
  description = "Database name"
}
