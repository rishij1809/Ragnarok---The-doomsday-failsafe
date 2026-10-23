# AWS Virtual Private Gateway (VGW)
resource "aws_vpn_gateway" "vgw" {
  vpc_id          = aws_vpc.primary_vpc.id
  amazon_side_asn = 64512

  tags = {
    Name        = "vgw-ragnarock-aws-primary"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Attachment Confirmation
resource "aws_vpn_gateway_attachment" "vgw_attachment" {
  vpc_id         = aws_vpc.primary_vpc.id
  vpn_gateway_id = aws_vpn_gateway.vgw.id
}

# Route Propagation for Private App and DB Route Tables
resource "aws_vpn_gateway_route_propagation" "app_route_propagation" {
  vpn_gateway_id = aws_vpn_gateway.vgw.id
  route_table_id = aws_route_table.app_rt.id
}

resource "aws_vpn_gateway_route_propagation" "db_route_propagation" {
  vpn_gateway_id = aws_vpn_gateway.vgw.id
  route_table_id = aws_route_table.db_rt.id
}

# Explicit Static Routes to Azure Secondary VNet (10.200.0.0/16) via VGW
resource "aws_route" "azure_vnet_app_route" {
  route_table_id         = aws_route_table.app_rt.id
  destination_cidr_block = var.azure_vnet_cidr
  gateway_id             = aws_vpn_gateway.vgw.id
}

resource "aws_route" "azure_vnet_db_route" {
  route_table_id         = aws_route_table.db_rt.id
  destination_cidr_block = var.azure_vnet_cidr
  gateway_id             = aws_vpn_gateway.vgw.id
}

# Generate Secure Pre-Shared Keys (PSKs) dynamically
resource "random_password" "tunnel1_psk" {
  length           = 32
  special          = false
  override_special = "!@#$"
}

resource "random_password" "tunnel2_psk" {
  length           = 32
  special          = false
  override_special = "!@#$"
}

# AWS Customer Gateway 1 (Pointing to Azure VPN Gateway Public IP 1)
resource "aws_customer_gateway" "cgw_1" {
  bgp_asn    = 65000
  ip_address = var.azure_vpn_gateway_public_ip_1
  type       = "ipsec.1"

  tags = {
    Name        = "cgw-ragnarock-azure-endpoint-1"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# AWS Customer Gateway 2 (Pointing to Azure VPN Gateway Public IP 2 for Dual Redundancy)
resource "aws_customer_gateway" "cgw_2" {
  bgp_asn    = 65000
  ip_address = var.azure_vpn_gateway_public_ip_2
  type       = "ipsec.1"

  tags = {
    Name        = "cgw-ragnarock-azure-endpoint-2"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# AWS Site-to-Site VPN Connection with AES256-GCM, SHA2-256, DH Group 14/19
resource "aws_vpn_connection" "s2s_vpn" {
  vpn_gateway_id      = aws_vpn_gateway.vgw.id
  customer_gateway_id = aws_customer_gateway.cgw_1.id
  type                = "ipsec.1"
  static_routes_only  = true

  tunnel1_preshared_key = random_password.tunnel1_psk.result
  tunnel2_preshared_key = random_password.tunnel2_psk.result

  # Phase 1 & 2 Security Specifications
  tunnel1_ike_versions                  = ["ikev2"]
  tunnel1_phase1_encryption_algorithms = ["AES256", "AES256-GCM-16"]
  tunnel1_phase2_encryption_algorithms = ["AES256", "AES256-GCM-16"]
  tunnel1_phase1_integrity_algorithms  = ["SHA2-256"]
  tunnel1_phase2_integrity_algorithms  = ["SHA2-256"]
  tunnel1_phase1_dh_group_numbers       = [14, 19]
  tunnel1_phase2_dh_group_numbers       = [14, 19]

  tunnel2_ike_versions                  = ["ikev2"]
  tunnel2_phase1_encryption_algorithms = ["AES256", "AES256-GCM-16"]
  tunnel2_phase2_encryption_algorithms = ["AES256", "AES256-GCM-16"]
  tunnel2_phase1_integrity_algorithms  = ["SHA2-256"]
  tunnel2_phase2_integrity_algorithms  = ["SHA2-256"]
  tunnel2_phase1_dh_group_numbers       = [14, 19]
  tunnel2_phase2_dh_group_numbers       = [14, 19]

  tags = {
    Name        = "vpn-ragnarock-aws-to-azure"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Static Route for Azure VNet CIDR over the Site-to-Site VPN
resource "aws_vpn_connection_route" "azure_vnet_route" {
  destination_cidr_block = var.azure_vnet_cidr
  vpn_connection_id      = aws_vpn_connection.s2s_vpn.id
}
