# Ragnarok - AWS Primary Region Infrastructure (Phase 1 Foundation)
# Primary Region: us-east-1

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
  region = var.aws_primary_region
}

variable "aws_primary_region" {
  default     = "us-east-1"
  description = "Primary AWS region for production workloads"
}

variable "environment" {
  default     = "production"
  description = "Deployment environment name"
}

# VPC & Networking
resource "aws_vpc" "primary_vpc" {
  cidr_block           = "10.100.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "ragnarok-primary-vpc"
    Environment = var.environment
    Role        = "PrimaryRegion"
  }
}

resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.primary_vpc.id
  cidr_block              = "10.100.1.0/24"
  availability_zone       = "${var.aws_primary_region}a"
  map_public_ip_on_launch = true

  tags = { Name = "ragnarok-pub-subnet-1" }
}

resource "aws_subnet" "private_1" {
  vpc_id            = aws_vpc.primary_vpc.id
  cidr_block        = "10.100.10.0/24"
  availability_zone = "${var.aws_primary_region}a"

  tags = { Name = "ragnarok-priv-subnet-1" }
}

# Security Groups
resource "aws_security_group" "alb_sg" {
  name        = "ragnarok-primary-alb-sg"
  description = "Security Group for Primary ALB"
  vpc_id      = aws_vpc.primary_vpc.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Application Load Balancer
resource "aws_lb" "primary_alb" {
  name               = "ragnarok-primary-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = [aws_subnet.public_1.id]

  tags = {
    Name        = "ragnarok-primary-alb"
    Environment = var.environment
  }
}

# Amazon Aurora Global Database Cluster (Primary Writer)
resource "aws_rds_global_cluster" "ragnarok_global_db" {
  global_cluster_identifier = "ragnarok-global-db-cluster"
  engine                    = "aurora-postgresql"
  engine_version            = "15.3"
  database_name             = "ragnarok_db"
}

resource "aws_rds_cluster" "primary_aurora" {
  cluster_identifier        = "ragnarok-primary-cluster"
  global_cluster_identifier = aws_rds_global_cluster.ragnarok_global_db.id
  engine                    = aws_rds_global_cluster.ragnarok_global_db.engine
  engine_version            = aws_rds_global_cluster.ragnarok_global_db.engine_version
  master_username           = "ragnarok_admin"
  master_password           = "RagnarokSecurePass2026!"
  database_name             = "ragnarok_db"
  backup_retention_period   = 30
  preferred_backup_window   = "02:00-03:00"
  storage_encrypted         = true

  tags = {
    Name = "ragnarok-primary-aurora-writer"
  }
}

# Primary S3 Storage Bucket with Cross-Region Replication (CRR)
resource "aws_s3_bucket" "primary_storage" {
  bucket        = "ragnarok-primary-storage-us-east-1"
  force_destroy = true
}

resource "aws_s3_bucket_versioning" "primary_versioning" {
  bucket = aws_s3_bucket.primary_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Route 53 Health Check for Primary Region
resource "aws_route53_health_check" "primary_health" {
  fqdn              = "primary.ragnarok-dr.internal"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/api/v1/regions/health"
  failure_threshold = "3"
  request_interval  = "10"

  tags = {
    Name = "ragnarok-primary-health-check"
  }
}

# Backup Vault and Selection
resource "aws_backup_vault" "primary_vault" {
  name        = "ragnarok_primary_backup_vault"
  kms_key_arn = "arn:aws:kms:us-east-1:123456789012:key/ragnarok-kms-key"
}

resource "aws_backup_plan" "primary_backup_plan" {
  name = "ragnarok_daily_backup_plan"

  rule {
    rule_name         = "daily_backup_rule"
    target_vault_name = aws_backup_vault.primary_vault.name
    schedule          = "cron(0 12 * * ? *)"

    lifecycle {
      delete_after = 30
    }
  }
}

output "primary_alb_dns_name" {
  value       = aws_lb.primary_alb.dns_name
  description = "DNS endpoint of the primary region load balancer"
}

output "global_db_id" {
  value       = aws_rds_global_cluster.ragnarok_global_db.id
  description = "Global Cluster Identifier for multi-region Aurora DB"
}
