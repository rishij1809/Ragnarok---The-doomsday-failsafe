# Production Multi-Cloud Infrastructure & Site-to-Site VPN Orchestration

# 1. AWS Primary Infrastructure & Site-to-Site VPN Module (us-east-1)
module "aws" {
  source = "../../modules/aws"

  environment                   = var.environment
  aws_region                    = var.aws_region
  vpc_cidr                      = var.aws_vpc_cidr
  public_subnet_cidrs           = var.aws_public_subnet_cidrs
  app_subnet_cidrs              = var.aws_app_subnet_cidrs
  db_subnet_cidrs               = var.aws_db_subnet_cidrs
  azure_vnet_cidr               = var.azure_vnet_cidr
  azure_app_subnet_cidr         = var.azure_app_subnet_cidr
  azure_db_subnet_cidr          = var.azure_db_subnet_cidr
  azure_vpn_gateway_public_ip_1 = module.azure.vpn_gateway_public_ip_1
  azure_vpn_gateway_public_ip_2 = module.azure.vpn_gateway_public_ip_2
  django_secret_key             = var.django_secret_key_aws
  postgres_user                 = var.postgres_user
  postgres_password             = var.postgres_password
  db_name                       = var.db_name
}

# 2. Azure Secondary Infrastructure & Virtual Network Gateway Module (eastus)
module "azure" {
  source = "../../modules/azure"

  environment              = var.environment
  azure_location           = var.azure_location
  vnet_cidr                = var.azure_vnet_cidr
  gateway_subnet_cidr      = var.azure_gateway_subnet_cidr
  public_subnet_cidr       = var.azure_public_subnet_cidr
  app_subnet_cidr          = var.azure_app_subnet_cidr
  db_subnet_cidr           = var.azure_db_subnet_cidr
  aws_vpc_cidr             = var.aws_vpc_cidr
  aws_app_subnet_cidrs     = var.aws_app_subnet_cidrs
  aws_db_subnet_cidrs      = var.aws_db_subnet_cidrs
  aws_vpn_tunnel1_address  = module.aws.vpn_tunnel1_address
  aws_vpn_tunnel2_address  = module.aws.vpn_tunnel2_address
  tunnel1_psk              = module.aws.vpn_tunnel1_preshared_key
  tunnel2_psk              = module.aws.vpn_tunnel2_preshared_key
  django_secret_key        = var.django_secret_key_azure
  postgres_user            = var.postgres_user
  postgres_password        = var.postgres_password
  db_name                  = var.db_name
}
