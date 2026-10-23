# Private DNS Zone for Azure PostgreSQL Flexible Server
resource "azurerm_private_dns_zone" "postgres_dns" {
  name                = "ragnarock.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.rg.name

  tags = {
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Private DNS Zone Virtual Network Link
resource "azurerm_private_dns_zone_virtual_network_link" "dns_vnet_link" {
  name                  = "link-ragnarock-vnet-postgres"
  private_dns_zone_name = azurerm_private_dns_zone.postgres_dns.name
  resource_group_name   = azurerm_resource_group.rg.name
  virtual_network_id    = azurerm_virtual_network.vnet.id
}

# Azure Database for PostgreSQL Flexible Server (Secondary Standby Replica)
resource "azurerm_postgresql_flexible_server" "standby_pg" {
  name                   = "psql-ragnarock-secondary-${random_string.suffix.result}"
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = "16"
  delegated_subnet_id    = azurerm_subnet.db_subnet.id
  private_dns_zone_id    = azurerm_private_dns_zone.postgres_dns.id
  administrator_login    = var.postgres_user
  administrator_password = var.postgres_password
  sku_name               = "GP_Standard_D2s_v3"
  storage_mb             = 65536
  zone                   = "1"

  backup_retention_days = 7

  depends_on = [azurerm_private_dns_zone_virtual_network_link.dns_vnet_link]

  tags = {
    Name        = "psql-ragnarock-secondary"
    Project     = "Ragnarock"
    Environment = var.environment
    Role        = "Secondary-Subscriber"
  }
}

# PostgreSQL Database Definition
resource "azurerm_postgresql_flexible_server_database" "ragnarock_db" {
  name      = var.db_name
  server_id = azurerm_postgresql_flexible_server.standby_pg.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Flexible Server Configuration Parameters for Logical Replication Subscriber Role
resource "azurerm_postgresql_flexible_server_configuration" "max_worker_processes" {
  name      = "max_worker_processes"
  server_id = azurerm_postgresql_flexible_server.standby_pg.id
  value     = "16"
}

resource "azurerm_postgresql_flexible_server_configuration" "max_logical_replication_workers" {
  name      = "max_logical_replication_workers"
  server_id = azurerm_postgresql_flexible_server.standby_pg.id
  value     = "8"
}

resource "azurerm_postgresql_flexible_server_configuration" "max_sync_workers" {
  name      = "max_sync_workers_per_subscription"
  server_id = azurerm_postgresql_flexible_server.standby_pg.id
  value     = "4"
}
