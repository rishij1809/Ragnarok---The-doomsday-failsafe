variable "environment" {
  type        = string
  default     = "production"
  description = "Environment identifier (e.g. production, staging)"
}

variable "azure_location" {
  type        = string
  default     = "eastus"
  description = "Azure Secondary Region for Project Ragnarock DR Standby"
}

variable "vnet_cidr" {
  type        = string
  default     = "10.200.0.0/16"
  description = "Non-overlapping CIDR block for Azure Standby VNet"
}

variable "gateway_subnet_cidr" {
  type        = string
  default     = "10.200.255.0/27"
  description = "Dedicated GatewaySubnet CIDR for Azure Virtual Network Gateway (Phase 3 Site-to-Site VPN)"
}

variable "public_subnet_cidr" {
  type        = string
  default     = "10.200.1.0/24"
  description = "Public / Ingress Subnet CIDR for Azure App Gateway / ALB"
}

variable "app_subnet_cidr" {
  type        = string
  default     = "10.200.10.0/24"
  description = "Private Subnet CIDR for Azure Container Apps / Django App Tier"
}

variable "db_subnet_cidr" {
  type        = string
  default     = "10.200.20.0/24"
  description = "Private Delegated Subnet CIDR for Azure PostgreSQL Flexible Server"
}

variable "aws_vpc_cidr" {
  type        = string
  default     = "10.100.0.0/16"
  description = "AWS Primary VPC CIDR block for cross-cloud zero-trust security rule definitions"
}

variable "aws_app_subnet_cidrs" {
  type        = list(string)
  default     = ["10.100.10.0/24", "10.100.20.0/24"]
  description = "AWS Primary App Subnet CIDRs"
}

variable "aws_db_subnet_cidrs" {
  type        = list(string)
  default     = ["10.100.30.0/24", "10.100.40.0/24"]
  description = "AWS Primary DB Subnet CIDRs"
}

variable "aws_vpn_tunnel1_address" {
  type        = string
  default     = "54.1.2.3" # Placeholder for standalone validation; wired dynamically in environments/production
  description = "Public IP address of AWS VPN Tunnel 1"
}

variable "aws_vpn_tunnel2_address" {
  type        = string
  default     = "54.1.2.4" # Placeholder for standalone validation; wired dynamically in environments/production
  description = "Public IP address of AWS VPN Tunnel 2"
}

variable "tunnel1_psk" {
  type        = string
  sensitive   = true
  default     = "RagnarockSecurePSK2026Tunnel1SecretKey!"
  description = "Pre-Shared Key for Tunnel 1"
}

variable "tunnel2_psk" {
  type        = string
  sensitive   = true
  default     = "RagnarockSecurePSK2026Tunnel2SecretKey!"
  description = "Pre-Shared Key for Tunnel 2"
}

variable "django_secret_key" {
  type        = string
  sensitive   = true
  default     = "django-insecure-ragnarock-azure-secondary-secret-key-2026-standby"
  description = "Secret key for Django REST framework backend on Azure"
}

variable "postgres_user" {
  type        = string
  default     = "ragnarock_admin"
  description = "Master username for Azure PostgreSQL Flexible Server"
}

variable "postgres_password" {
  type        = string
  sensitive   = true
  default     = "RagnarockSecureAzureDBPass2026!"
  description = "Master password for Azure PostgreSQL Flexible Server"
}

variable "db_name" {
  type        = string
  default     = "ragnarock_db"
  description = "Database name for Azure PostgreSQL Flexible Server"
}
