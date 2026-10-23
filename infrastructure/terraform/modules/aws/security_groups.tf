# ALB Security Group
resource "aws_security_group" "alb_sg" {
  name        = "ragnarock-aws-alb-sg"
  description = "Public Application Load Balancer Ingress Security Group"
  vpc_id      = aws_vpc.primary_vpc.id

  # HTTP Ingress
  ingress {
    description = "Allow inbound HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS Ingress
  ingress {
    description = "Allow inbound HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Egress to App Container Tier
  egress {
    description = "Allow egress to Django application tier"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = var.app_subnet_cidrs
  }

  tags = {
    Name        = "ragnarock-aws-alb-sg"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Django Application Tier Security Group
resource "aws_security_group" "app_sg" {
  name        = "ragnarock-aws-app-sg"
  description = "Django REST Backend Security Group (Strict Zero-Trust)"
  vpc_id      = aws_vpc.primary_vpc.id

  # Ingress from Public ALB
  ingress {
    description     = "Allow port 8000 from ALB Security Group"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  # Ingress from Azure App & DB Subnets ONLY for Cross-Cloud Health Probing
  ingress {
    description = "Allow port 8000 from Azure App Subnet over IPsec"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = [var.azure_app_subnet_cidr]
  }

  # Ingress ICMP for Network Telemetry and Latency Probing over VPN
  ingress {
    description = "Allow ICMP Echo Request from Azure App & DB Subnets"
    from_port   = 8
    to_port     = 0
    protocol    = "icmp"
    cidr_blocks = [var.azure_app_subnet_cidr, var.azure_db_subnet_cidr]
  }

  # Egress to DB and External APIs via NAT GW
  egress {
    description = "Allow outbound to PostgreSQL database tier"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.db_subnet_cidrs
  }

  egress {
    description = "Allow HTTPS outbound for AWS service endpoints and updates"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "ragnarock-aws-app-sg"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# RDS PostgreSQL Database Security Group (Zero-Trust Hardened)
resource "aws_security_group" "rds_sg" {
  name        = "ragnarock-aws-rds-sg"
  description = "PostgreSQL DB Tier Security Group (Strict Zero-Trust Isolated)"
  vpc_id      = aws_vpc.primary_vpc.id

  # Ingress from local App Security Group
  ingress {
    description     = "Allow PostgreSQL from local Django App Security Group"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app_sg.id]
  }

  # Ingress from Azure Secondary DB & App Subnets ONLY for PostgreSQL Logical Replication Stream
  ingress {
    description = "Allow PostgreSQL port 5432 from Azure App Subnet over IPsec"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.azure_app_subnet_cidr]
  }

  ingress {
    description = "Allow PostgreSQL port 5432 from Azure DB Subnet over IPsec"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.azure_db_subnet_cidr]
  }

  # ICMP Health Check for DB Tunnel Telemetry
  ingress {
    description = "Allow ICMP Echo Request from Azure DB Subnet"
    from_port   = 8
    to_port     = 0
    protocol    = "icmp"
    cidr_blocks = [var.azure_db_subnet_cidr]
  }

  tags = {
    Name        = "ragnarock-aws-rds-sg"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}
