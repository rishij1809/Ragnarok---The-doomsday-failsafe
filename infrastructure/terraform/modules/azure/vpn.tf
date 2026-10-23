# Standard Public IP 1 for Azure Virtual Network Gateway
resource "azurerm_public_ip" "vpn_gw_pip_1" {
  name                = "pip-ragnarock-vnet-gateway-1"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = {
    Name        = "pip-ragnarock-vnet-gateway-1"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Standard Public IP 2 for Azure Virtual Network Gateway (Dual Active Active/Standby Endpoint)
resource "azurerm_public_ip" "vpn_gw_pip_2" {
  name                = "pip-ragnarock-vnet-gateway-2"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = {
    Name        = "pip-ragnarock-vnet-gateway-2"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Azure Virtual Network Gateway (Route-Based VpnGw1 in dedicated GatewaySubnet)
resource "azurerm_virtual_network_gateway" "vnet_gw" {
  name                = "vgw-ragnarock-secondary"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  type                = "Vpn"
  vpn_type            = "RouteBased"
  active_active       = true
  enable_bgp          = false
  sku                 = "VpnGw1"

  ip_configuration {
    name                          = "vnetGwPipConfig1"
    public_ip_address_id          = azurerm_public_ip.vpn_gw_pip_1.id
    private_ip_address_allocation = "Dynamic"
    subnet_id                     = azurerm_subnet.gateway_subnet.id
  }

  ip_configuration {
    name                          = "vnetGwPipConfig2"
    public_ip_address_id          = azurerm_public_ip.vpn_gw_pip_2.id
    private_ip_address_allocation = "Dynamic"
    subnet_id                     = azurerm_subnet.gateway_subnet.id
  }

  tags = {
    Name        = "vgw-ragnarock-secondary"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Local Network Gateway 1 (Representing AWS VPN Tunnel 1 Endpoint)
resource "azurerm_local_network_gateway" "aws_lng_1" {
  name                = "lng-ragnarock-aws-tunnel1"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  gateway_address     = var.aws_vpn_tunnel1_address
  address_space       = [var.aws_vpc_cidr]

  tags = {
    Name        = "lng-ragnarock-aws-tunnel1"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Local Network Gateway 2 (Representing AWS VPN Tunnel 2 Endpoint)
resource "azurerm_local_network_gateway" "aws_lng_2" {
  name                = "lng-ragnarock-aws-tunnel2"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  gateway_address     = var.aws_vpn_tunnel2_address
  address_space       = [var.aws_vpc_cidr]

  tags = {
    Name        = "lng-ragnarock-aws-tunnel2"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Virtual Network Gateway Connection 1 to AWS Tunnel 1
resource "azurerm_virtual_network_gateway_connection" "aws_conn_1" {
  name                       = "conn-ragnarock-azure-to-aws-tunnel1"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  type                       = "IPsec"
  virtual_network_gateway_id = azurerm_virtual_network_gateway.vnet_gw.id
  local_network_gateway_id   = azurerm_local_network_gateway.aws_lng_1.id
  shared_key                 = var.tunnel1_psk

  ipsec_policy {
    dh_group         = "DHGroup14"
    ike_encryption   = "AES256"
    ike_integrity    = "SHA256"
    ipsec_encryption = "GCMAES256"
    ipsec_integrity  = "SHA256"
    pfs_group        = "PFS14"
    sa_datasize      = 102400000
    sa_lifetime      = 27000
  }

  tags = {
    Name        = "conn-ragnarock-azure-to-aws-tunnel1"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Virtual Network Gateway Connection 2 to AWS Tunnel 2
resource "azurerm_virtual_network_gateway_connection" "aws_conn_2" {
  name                       = "conn-ragnarock-azure-to-aws-tunnel2"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  type                       = "IPsec"
  virtual_network_gateway_id = azurerm_virtual_network_gateway.vnet_gw.id
  local_network_gateway_id   = azurerm_local_network_gateway.aws_lng_2.id
  shared_key                 = var.tunnel2_psk

  ipsec_policy {
    dh_group         = "DHGroup14"
    ike_encryption   = "AES256"
    ike_integrity    = "SHA256"
    ipsec_encryption = "GCMAES256"
    ipsec_integrity  = "SHA256"
    pfs_group        = "PFS14"
    sa_datasize      = 102400000
    sa_lifetime      = 27000
  }

  tags = {
    Name        = "conn-ragnarock-azure-to-aws-tunnel2"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Azure Route Table Rules pointing AWS VPC CIDR (10.100.0.0/16) to VirtualNetworkGateway
resource "azurerm_route" "aws_route_app" {
  name                = "route-to-aws-primary-app"
  resource_group_name = azurerm_resource_group.rg.name
  route_table_name    = azurerm_route_table.app_rt.name
  address_prefix      = var.aws_vpc_cidr
  next_hop_type       = "VirtualNetworkGateway"
}

resource "azurerm_route" "aws_route_db" {
  name                = "route-to-aws-primary-db"
  resource_group_name = azurerm_resource_group.rg.name
  route_table_name    = azurerm_route_table.db_rt.name
  address_prefix      = var.aws_vpc_cidr
  next_hop_type       = "VirtualNetworkGateway"
}
