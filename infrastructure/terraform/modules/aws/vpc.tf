# AWS Primary VPC Definition
resource "aws_vpc" "primary_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "ragnarock-aws-primary-vpc"
    Project     = "Ragnarock"
    Environment = var.environment
    Tier        = "Network"
  }
}

# Internet Gateway for Public Traffic
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.primary_vpc.id

  tags = {
    Name        = "ragnarock-aws-igw"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# 1. Public Subnets (2 AZs: 10.100.1.0/24, 10.100.2.0/24)
resource "aws_subnet" "public_subnets" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.primary_vpc.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = "${var.aws_region}${count.index == 0 ? "a" : "b"}"
  map_public_ip_on_launch = true

  tags = {
    Name        = "ragnarock-aws-public-sub-az${count.index + 1}"
    Project     = "Ragnarock"
    Environment = var.environment
    Type        = "Public"
  }
}

# 2. Private App Subnets (2 AZs: 10.100.10.0/24, 10.100.20.0/24)
resource "aws_subnet" "app_subnets" {
  count             = length(var.app_subnet_cidrs)
  vpc_id            = aws_vpc.primary_vpc.id
  cidr_block        = var.app_subnet_cidrs[count.index]
  availability_zone = "${var.aws_region}${count.index == 0 ? "a" : "b"}"

  tags = {
    Name        = "ragnarock-aws-app-priv-sub-az${count.index + 1}"
    Project     = "Ragnarock"
    Environment = var.environment
    Type        = "Private-App"
  }
}

# 3. Isolated DB Subnets (2 AZs: 10.100.30.0/24, 10.100.40.0/24)
resource "aws_subnet" "db_subnets" {
  count             = length(var.db_subnet_cidrs)
  vpc_id            = aws_vpc.primary_vpc.id
  cidr_block        = var.db_subnet_cidrs[count.index]
  availability_zone = "${var.aws_region}${count.index == 0 ? "a" : "b"}"

  tags = {
    Name        = "ragnarock-aws-db-priv-sub-az${count.index + 1}"
    Project     = "Ragnarock"
    Environment = var.environment
    Type        = "Isolated-DB"
  }
}

# Elastic IP for NAT Gateway
resource "aws_eip" "nat_eip" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.igw]

  tags = {
    Name        = "ragnarock-aws-nat-eip"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# NAT Gateway for Application Outbound Connectivity
resource "aws_nat_gateway" "nat_gw" {
  allocation_id = aws_eip.nat_eip.id
  subnet_id     = aws_subnet.public_subnets[0].id

  tags = {
    Name        = "ragnarock-aws-nat-gw"
    Project     = "Ragnarock"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.igw]
}

# Route Table for Public Subnets
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.primary_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name        = "ragnarock-aws-public-rt"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Route Table Association for Public Subnets
resource "aws_route_table_association" "public_assoc" {
  count          = length(aws_subnet.public_subnets)
  subnet_id      = aws_subnet.public_subnets[count.index].id
  route_table_id = aws_route_table.public_rt.id
}

# Route Table for Private App Subnets (Routed via NAT Gateway)
resource "aws_route_table" "app_rt" {
  vpc_id = aws_vpc.primary_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat_gw.id
  }

  tags = {
    Name        = "ragnarock-aws-app-private-rt"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Route Table Association for Private App Subnets
resource "aws_route_table_association" "app_assoc" {
  count          = length(aws_subnet.app_subnets)
  subnet_id      = aws_subnet.app_subnets[count.index].id
  route_table_id = aws_route_table.app_rt.id
}

# Isolated Route Table for Private DB Subnets (Strict Zero-Trust Local Routing)
resource "aws_route_table" "db_rt" {
  vpc_id = aws_vpc.primary_vpc.id

  tags = {
    Name        = "ragnarock-aws-db-isolated-rt"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Route Table Association for Private DB Subnets
resource "aws_route_table_association" "db_assoc" {
  count          = length(aws_subnet.db_subnets)
  subnet_id      = aws_subnet.db_subnets[count.index].id
  route_table_id = aws_route_table.db_rt.id
}

# RDS DB Subnet Group
resource "aws_db_subnet_group" "rds_subnet_group" {
  name        = "ragnarock-aws-rds-subnet-group"
  subnet_ids  = aws_subnet.db_subnets[*].id
  description = "Subnet group for RDS PostgreSQL Primary Instance"

  tags = {
    Name        = "ragnarock-aws-rds-subnet-group"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}
