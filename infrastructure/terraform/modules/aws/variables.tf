variable "environment" {
  type        = string
  default     = "production"
  description = "Environment identifier (e.g. production, staging)"
}

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS Primary Region for Project Ragnarock"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.100.0.0/16"
  description = "Non-overlapping CIDR block for AWS Primary VPC"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  default     = ["10.100.1.0/24", "10.100.2.0/24"]
  description = "Public Subnets across AZ-a and AZ-b"
}

variable "app_subnet_cidrs" {
  type        = list(string)
  default     = ["10.100.10.0/24", "10.100.20.0/24"]
  description = "Django Application Private Subnets across AZ-a and AZ-b"
}

variable "db_subnet_cidrs" {
  type        = list(string)
  default     = ["10.100.30.0/24", "10.100.40.0/24"]
  description = "Isolated Database Private Subnets across AZ-a and AZ-b"
}

variable "azure_vnet_cidr" {
  type        = string
  default     = "10.200.0.0/16"
  description = "Azure VNet CIDR block for cross-cloud zero-trust security rule definitions"
}

variable "azure_app_subnet_cidr" {
  type        = string
  default     = "10.200.10.0/24"
  description = "Azure Private App Subnet CIDR for zero-trust rule narrowing"
}

variable "azure_db_subnet_cidr" {
  type        = string
  default     = "10.200.20.0/24"
  description = "Azure Private DB Subnet CIDR for zero-trust rule narrowing"
}

variable "azure_vpn_gateway_public_ip_1" {
  type        = string
  default     = "20.1.2.3" # Placeholder for standalone validation; wired dynamically in environments/production
  description = "Public IP address 1 of Azure Virtual Network Gateway"
}

variable "azure_vpn_gateway_public_ip_2" {
  type        = string
  default     = "20.1.2.4" # Placeholder for standalone validation; wired dynamically in environments/production
  description = "Public IP address 2 of Azure Virtual Network Gateway"
}

variable "django_secret_key" {
  type        = string
  sensitive   = true
  default     = "django-insecure-ragnarock-aws-primary-secret-key-2026-prod"
  description = "Secret key for Django REST framework backend"
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
  description = "Database name for Django DR framework workload"
}
