output "vpc_id" {
  description = "The ID of the primary AWS VPC"
  value       = aws_vpc.primary_vpc.id
}

output "public_subnet_ids" {
  description = "IDs of the AWS public subnets"
  value       = aws_subnet.public_subnets[*].id
}

output "app_subnet_ids" {
  description = "IDs of the AWS private application subnets"
  value       = aws_subnet.app_subnets[*].id
}

output "db_subnet_ids" {
  description = "IDs of the AWS isolated database subnets"
  value       = aws_subnet.db_subnets[*].id
}

output "s3_bucket_name" {
  description = "Name of primary AWS S3 Media Bucket"
  value       = aws_s3_bucket.media_bucket.id
}

output "s3_bucket_arn" {
  description = "ARN of primary AWS S3 Media Bucket"
  value       = aws_s3_bucket.media_bucket.arn
}

output "rds_subnet_group_name" {
  description = "Name of the RDS DB Subnet Group"
  value       = aws_db_subnet_group.rds_subnet_group.name
}

output "nat_gateway_ip" {
  description = "Public IP address of the AWS NAT Gateway"
  value       = aws_eip.nat_eip.public_ip
}

output "alb_security_group_id" {
  description = "Security Group ID for Public Application Load Balancer"
  value       = aws_security_group.alb_sg.id
}

output "app_security_group_id" {
  description = "Security Group ID for Django REST Application Tier"
  value       = aws_security_group.app_sg.id
}

output "rds_security_group_id" {
  description = "Security Group ID for RDS PostgreSQL Database Tier"
  value       = aws_security_group.rds_sg.id
}

output "ecr_repository_url" {
  description = "URL of the ECR Repository for Django Container Images"
  value       = aws_ecr_repository.django_app.repository_url
}

output "ecs_cluster_name" {
  description = "Name of the primary ECS Cluster"
  value       = aws_ecs_cluster.primary_cluster.name
}

output "ecs_cluster_arn" {
  description = "ARN of the primary ECS Cluster"
  value       = aws_ecs_cluster.primary_cluster.arn
}

output "ecs_execution_role_arn" {
  description = "IAM Role ARN for ECS Task Execution"
  value       = aws_iam_role.ecs_execution_role.arn
}

output "ecs_task_role_arn" {
  description = "IAM Role ARN for ECS Task Runtime"
  value       = aws_iam_role.ecs_task_role.arn
}

output "secrets_manager_secret_arn" {
  description = "ARN of the AWS Secrets Manager Secret"
  value       = aws_secretsmanager_secret.django_db_credentials.arn
}

output "secrets_manager_secret_name" {
  description = "Name of the AWS Secrets Manager Secret"
  value       = aws_secretsmanager_secret.django_db_credentials.name
}

# RDS Endpoint Outputs
output "rds_endpoint" {
  description = "Connection endpoint address for AWS RDS PostgreSQL"
  value       = aws_db_instance.primary_rds.endpoint
}

output "rds_address" {
  description = "Hostname IP/DNS address for AWS RDS PostgreSQL"
  value       = aws_db_instance.primary_rds.address
}

output "rds_port" {
  description = "Port for AWS RDS PostgreSQL"
  value       = aws_db_instance.primary_rds.port
}

# VPN Telemetry & Connection Outputs
output "vpn_gateway_id" {
  description = "AWS Virtual Private Gateway ID"
  value       = aws_vpn_gateway.vgw.id
}

output "vpn_connection_id" {
  description = "AWS Site-to-Site VPN Connection ID"
  value       = aws_vpn_connection.s2s_vpn.id
}

output "vpn_tunnel1_address" {
  description = "Public IP address of AWS VPN Tunnel 1"
  value       = aws_vpn_connection.s2s_vpn.tunnel1_address
}

output "vpn_tunnel2_address" {
  description = "Public IP address of AWS VPN Tunnel 2"
  value       = aws_vpn_connection.s2s_vpn.tunnel2_address
}

output "vpn_tunnel1_preshared_key" {
  description = "Pre-shared Key for AWS VPN Tunnel 1"
  value       = aws_vpn_connection.s2s_vpn.tunnel1_preshared_key
  sensitive   = true
}

output "vpn_tunnel2_preshared_key" {
  description = "Pre-shared Key for AWS VPN Tunnel 2"
  value       = aws_vpn_connection.s2s_vpn.tunnel2_preshared_key
  sensitive   = true
}

output "django_env_vars" {
  description = "Structured map of environment variables ready for injection into Django runtime container"
  value = {
    CURRENT_CLOUD              = "AWS"
    AWS_REGION                 = var.aws_region
    VPC_ID                     = aws_vpc.primary_vpc.id
    APP_SUBNETS                = join(",", aws_subnet.app_subnets[*].id)
    DB_SUBNETS                 = join(",", aws_subnet.db_subnets[*].id)
    AWS_STORAGE_BUCKET_NAME    = aws_s3_bucket.media_bucket.id
    POSTGRES_HOST              = aws_db_instance.primary_rds.address
    POSTGRES_PORT              = tostring(aws_db_instance.primary_rds.port)
    SECRETS_MANAGER_SECRET_ARN = aws_secretsmanager_secret.django_db_credentials.arn
    ECR_REPOSITORY_URL         = aws_ecr_repository.django_app.repository_url
    ECS_CLUSTER_NAME           = aws_ecs_cluster.primary_cluster.name
    AWS_VPN_TUNNEL1_IP         = aws_vpn_connection.s2s_vpn.tunnel1_address
    AWS_VPN_TUNNEL2_IP         = aws_vpn_connection.s2s_vpn.tunnel2_address
    DR_FAILOVER_ACTIVE         = "false"
  }
}
