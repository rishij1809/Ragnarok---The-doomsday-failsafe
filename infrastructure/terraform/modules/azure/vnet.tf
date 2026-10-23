# Azure Resource Group
resource "azurerm_resource_group" "rg" {
  name     = "rg-ragnarock-secondary-${var.azure_location}"
  location = var.azure_location

  tags = {
    Project     = "Ragnarock"
    Environment = var.environment
    Cloud       = "Azure"
  }
}

# Azure Standby VNet Definition (10.200.0.0/16)
resource "azurerm_virtual_network" "vnet" {
  name                = "vnet-ragnarock-secondary"
  address_space       = [var.vnet_cidr]
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  tags = {
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# 1. Dedicated GatewaySubnet (10.200.255.0/27 - Prepared for Phase 3 S2S VPN)
resource "azurerm_subnet" "gateway_subnet" {
  name                 = "GatewaySubnet" # Required exact name for Azure VNet Gateway
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = [var.gateway_subnet_cidr]
}

# 2. Public / Ingress Subnet (10.200.1.0/24 - Azure App Gateway / ALB)
resource "azurerm_subnet" "public_subnet" {
  name                 = "snet-pub-az1"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = [var.public_subnet_cidr]
}

# 3. Private App Subnet (10.200.10.0/24 - Django Containers)
resource "azurerm_subnet" "app_subnet" {
  name                 = "snet-app-priv-az1"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = [var.app_subnet_cidr]

  delegation {
    name = "aca-delegation"
    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

# 4. Private DB Subnet (10.200.20.0/24 - PostgreSQL Flexible Server)
resource "azurerm_subnet" "db_subnet" {
  name                 = "snet-db-priv-az1"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = [var.db_subnet_cidr]

  delegation {
    name = "fs-delegation"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

# Route Table for Application Subnet
resource "azurerm_route_table" "app_rt" {
  name                = "rt-ragnarock-app"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  tags = {
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Route Table Association for App Subnet
resource "azurerm_subnet_route_table_association" "app_rt_assoc" {
  subnet_id      = azurerm_subnet.app_subnet.id
  route_table_id = azurerm_route_table.app_rt.id
}

# Isolated Route Table for Database Subnet
resource "azurerm_route_table" "db_rt" {
  name                = "rt-ragnarock-db"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  tags = {
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Route Table Association for DB Subnet
resource "azurerm_subnet_route_table_association" "db_rt_assoc" {
  subnet_id      = azurerm_subnet.db_subnet.id
  route_table_id = azurerm_route_table.db_rt.id
}
