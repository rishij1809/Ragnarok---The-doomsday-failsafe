# Ingress Subnet NSG
resource "azurerm_network_security_group" "ingress_nsg" {
  name                = "nsg-ragnarock-ingress"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "Allow_HTTP_Inbound"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "Allow_HTTPS_Inbound"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }

  tags = {
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Django Application Tier NSG (Hardened Zero-Trust Rules)
resource "azurerm_network_security_group" "app_nsg" {
  name                = "nsg-ragnarock-app"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  # Allow Ingress from Ingress / Public Subnet Only
  security_rule {
    name                       = "Allow_App_Port_IngressSubnet"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "8000"
    source_address_prefix      = var.public_subnet_cidr
    destination_address_prefix = "*"
  }

  # Allow Ingress from AWS Primary App Subnets ONLY for Cross-Cloud Health Probing
  security_rule {
    name                       = "Allow_CrossCloud_AWS_AppSubnets"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "8000"
    source_address_prefixes    = var.aws_app_subnet_cidrs
    destination_address_prefix = "*"
  }

  # Allow ICMP Echo Requests from AWS App & DB Subnets over IPsec Tunnel
  security_rule {
    name                       = "Allow_ICMP_From_AWS"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Icmp"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefixes    = concat(var.aws_app_subnet_cidrs, var.aws_db_subnet_cidrs)
    destination_address_prefix = "*"
  }

  tags = {
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Azure Database NSG (Strict Zero-Trust Rule Set)
resource "azurerm_network_security_group" "db_nsg" {
  name                = "nsg-ragnarock-db"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  # Ingress from Local Django App Subnet
  security_rule {
    name                       = "Allow_Postgres_AppSubnet"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5432"
    source_address_prefix      = var.app_subnet_cidr
    destination_address_prefix = "*"
  }

  # Ingress from AWS Primary App and DB Subnets ONLY for PostgreSQL Logical Replication Stream
  security_rule {
    name                       = "Allow_Postgres_AWS_Subnets"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5432"
    source_address_prefixes    = concat(var.aws_app_subnet_cidrs, var.aws_db_subnet_cidrs)
    destination_address_prefix = "*"
  }

  # Allow ICMP Echo Requests from AWS Subnets for DB Tunnel Telemetry
  security_rule {
    name                       = "Allow_ICMP_AWS_DB"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Icmp"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefixes    = concat(var.aws_app_subnet_cidrs, var.aws_db_subnet_cidrs)
    destination_address_prefix = "*"
  }

  # Explicit Deny All Other Inbound Traffic
  security_rule {
    name                       = "Deny_All_Other_Inbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = {
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Subnet Network Security Group Associations
resource "azurerm_subnet_network_security_group_association" "public_nsg_assoc" {
  subnet_id                 = azurerm_subnet.public_subnet.id
  network_security_group_id = azurerm_network_security_group.ingress_nsg.id
}

resource "azurerm_subnet_network_security_group_association" "app_nsg_assoc" {
  subnet_id                 = azurerm_subnet.app_subnet.id
  network_security_group_id = azurerm_network_security_group.app_nsg.id
}

resource "azurerm_subnet_network_security_group_association" "db_nsg_assoc" {
  subnet_id                 = azurerm_subnet.db_subnet.id
  network_security_group_id = azurerm_network_security_group.db_nsg.id
}
