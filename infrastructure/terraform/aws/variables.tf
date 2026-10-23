variable "environment" {
  type        = string
  default     = "production"
  description = "Environment identifier"
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
  description = "App Private Subnets across AZ-a and AZ-b"
}

variable "db_subnet_cidrs" {
  type        = list(string)
  default     = ["10.100.30.0/24", "10.100.40.0/24"]
  description = "Isolated Database Subnets across AZ-a and AZ-b"
}

variable "azure_vnet_cidr" {
  type        = string
  default     = "10.200.0.0/16"
  description = "Target Azure VNet CIDR for cross-cloud routing rules"
}

variable "django_secret_key" {
  type        = string
  sensitive   = true
  default     = "django-insecure-ragnarock-aws-primary-secret-key-2026"
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
  default     = "RagnarockSecureDBPass2026!"
  description = "PostgreSQL password"
}

variable "db_name" {
  type        = string
  default     = "ragnarock_db"
  description = "Database name"
}
