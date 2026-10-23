# AWS Topology & Security Outputs
output "aws_vpc_id" {
  description = "AWS Primary VPC ID"
  value       = module.aws.vpc_id
}

output "aws_app_subnet_ids" {
  description = "AWS Private App Subnet IDs"
  value       = module.aws.app_subnet_ids
}

output "aws_db_subnet_ids" {
  description = "AWS Isolated DB Subnet IDs"
  value       = module.aws.db_subnet_ids
}

output "aws_ecr_repository_url" {
  description = "AWS ECR Docker Repository URL"
  value       = module.aws.ecr_repository_url
}

output "aws_ecs_cluster_name" {
  description = "AWS ECS Primary Cluster Name"
  value       = module.aws.ecs_cluster_name
}

output "aws_vpn_connection_id" {
  description = "AWS Site-to-Site VPN Connection ID"
  value       = module.aws.vpn_connection_id
}

output "aws_vpn_tunnel1_ip" {
  description = "AWS VPN Tunnel 1 Public IP Address"
  value       = module.aws.vpn_tunnel1_address
}

output "aws_vpn_tunnel2_ip" {
  description = "AWS VPN Tunnel 2 Public IP Address"
  value       = module.aws.vpn_tunnel2_address
}

output "aws_django_runtime_env_vars" {
  description = "Structured Environment Variables for AWS Primary Django Containers"
  value       = module.aws.django_env_vars
}

# Azure Topology & Security Outputs
output "azure_resource_group_name" {
  description = "Azure Resource Group Name"
  value       = module.azure.resource_group_name
}

output "azure_vnet_id" {
  description = "Azure Secondary VNet ID"
  value       = module.azure.vnet_id
}

output "azure_gateway_subnet_id" {
  description = "Azure GatewaySubnet ID"
  value       = module.azure.gateway_subnet_id
}

output "azure_app_subnet_id" {
  description = "Azure Container Apps Private Subnet ID"
  value       = module.azure.app_subnet_id
}

output "azure_db_subnet_id" {
  description = "Azure PostgreSQL Delegated Subnet ID"
  value       = module.azure.db_subnet_id
}

output "azure_vpn_gateway_public_ip_1" {
  description = "Azure VPN Gateway Public IP 1"
  value       = module.azure.vpn_gateway_public_ip_1
}

output "azure_vpn_gateway_public_ip_2" {
  description = "Azure VPN Gateway Public IP 2"
  value       = module.azure.vpn_gateway_public_ip_2
}

output "azure_vpn_connection1_id" {
  description = "Azure Virtual Network Gateway Connection 1 ID"
  value       = module.azure.vpn_connection1_id
}

output "azure_vpn_connection2_id" {
  description = "Azure Virtual Network Gateway Connection 2 ID"
  value       = module.azure.vpn_connection2_id
}

output "azure_django_runtime_env_vars" {
  description = "Structured Environment Variables for Azure Secondary Django Containers"
  value       = module.azure.django_env_vars
}

# Cross-Cloud DR Integration & Tunnel Topology Summary
output "cross_cloud_dr_vpn_summary" {
  description = "Summary of cross-cloud IPsec VPN tunnel topology and parameters"
  value = {
    aws_primary_vpc_cidr     = var.aws_vpc_cidr
    aws_primary_region       = var.aws_region
    aws_vpn_connection_id    = module.aws.vpn_connection_id
    aws_tunnel1_public_ip    = module.aws.vpn_tunnel1_address
    aws_tunnel2_public_ip    = module.aws.vpn_tunnel2_address
    azure_secondary_vnet_cidr= var.azure_vnet_cidr
    azure_secondary_region   = var.azure_location
    azure_vpn_gateway_pip_1  = module.azure.vpn_gateway_public_ip_1
    azure_vpn_gateway_pip_2  = module.azure.vpn_gateway_public_ip_2
    encryption_algorithm     = "AES256 / AES256-GCM-16"
    integrity_algorithm      = "SHA2-256"
    dh_pfs_groups            = "DH Group 14 / PFS 14"
    ike_version              = "IKEv2"
  }
}
