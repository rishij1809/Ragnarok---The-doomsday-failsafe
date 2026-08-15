# Ragnarok - Azure Secondary Region Infrastructure (Phase 1 Foundation)
# Secondary Region: East US (Warm Standby Replica)

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

variable "azure_secondary_region" {
  default     = "East US"
  description = "Secondary Azure region for warm standby DR"
}

variable "environment" {
  default     = "production"
  description = "Deployment environment name"
}

resource "azurerm_resource_group" "secondary_rg" {
  name     = "rg-ragnarok-secondary-dr"
  location = var.azure_secondary_region

  tags = {
    Environment = var.environment
    Role        = "StandbyRegion"
  }
}

# Virtual Network & Subnets
resource "azurerm_virtual_network" "secondary_vnet" {
  name                = "vnet-ragnarok-secondary"
  address_space       = ["10.200.0.0/16"]
  location            = azurerm_resource_group.secondary_rg.location
  resource_group_name = azurerm_resource_group.secondary_rg.name
}

resource "azurerm_subnet" "app_gateway_subnet" {
  name                 = "subnet-app-gateway"
  resource_group_name  = azurerm_resource_group.secondary_rg.name
  virtual_network_name = azurerm_virtual_network.secondary_vnet.name
  address_prefixes     = ["10.200.1.0/24"]
}

resource "azurerm_subnet" "backend_subnet" {
  name                 = "subnet-backend-compute"
  resource_group_name  = azurerm_resource_group.secondary_rg.name
  virtual_network_name = azurerm_virtual_network.secondary_vnet.name
  address_prefixes     = ["10.200.10.0/24"]
}

# Network Security Group
resource "azurerm_network_security_group" "standby_nsg" {
  name                = "nsg-ragnarok-standby"
  location            = azurerm_resource_group.secondary_rg.location
  resource_group_name = azurerm_resource_group.secondary_rg.name

  security_rule {
    name                       = "AllowHTTPS"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

# Azure Storage Account (Geo-Redundant Storage - GRS)
resource "azurerm_storage_account" "secondary_storage" {
  name                     = "stragnarokdrsecondary"
  resource_group_name      = azurerm_resource_group.secondary_rg.name
  location                 = azurerm_resource_group.secondary_rg.location
  account_tier             = "Standard"
  account_replication_type = "GRS"

  tags = {
    Environment = var.environment
    Role        = "StandbyStorage"
  }
}

# Azure Traffic Manager Profile (DNS Global Routing)
resource "azurerm_traffic_manager_profile" "global_traffic_manager" {
  name                   = "ragnarok-global-tm"
  resource_group_name    = azurerm_resource_group.secondary_rg.name
  traffic_routing_method = "Priority"

  dns_config {
    relative_name = "ragnarok-global-dns"
    ttl           = 30
  }

  monitor_config {
    protocol                  = "HTTPS"
    port                      = 443
    path                      = "/api/v1/regions/health"
    interval_in_seconds       = 10
    timeout_in_seconds        = 5
    tolerated_number_of_failures = 3
  }
}

# Primary Endpoint for Traffic Manager
resource "azurerm_traffic_manager_external_endpoint" "primary_endpoint" {
  name               = "primary-aws-us-east-1"
  profile_id         = azurerm_traffic_manager_profile.global_traffic_manager.id
  target             = "primary.ragnarok-dr.internal"
  weight             = 100
  priority           = 1
  endpoint_status    = "Enabled"
}

# Secondary Endpoint for Traffic Manager (Warm Standby)
resource "azurerm_traffic_manager_external_endpoint" "secondary_endpoint" {
  name               = "secondary-azure-eastus"
  profile_id         = azurerm_traffic_manager_profile.global_traffic_manager.id
  target             = "secondary.ragnarok-dr.internal"
  weight             = 100
  priority           = 2
  endpoint_status    = "Enabled"
}

output "azure_traffic_manager_fqdn" {
  value       = azurerm_traffic_manager_profile.global_traffic_manager.fqdn
  description = "Global DNS Endpoint managed by Traffic Manager"
}
