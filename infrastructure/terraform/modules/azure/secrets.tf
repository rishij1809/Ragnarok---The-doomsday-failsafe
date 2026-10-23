# Current Azure Client Config Data Source
data "azurerm_client_config" "current" {}

# Azure Key Vault
resource "azurerm_key_vault" "kv" {
  name                       = "kv-rag-sec-${random_string.suffix.result}"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  purge_protection_enabled   = false
  soft_delete_retention_days = 7

  # Access Policy for Terraform Deployer Identity
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get",
      "List",
      "Set",
      "Delete",
      "Purge",
      "Recover"
    ]
  }

  # Access Policy for User Assigned Managed Identity (Container Apps)
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = azurerm_user_assigned_identity.app_identity.principal_id

    secret_permissions = [
      "Get",
      "List"
    ]
  }

  tags = {
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# 1. Secret Key Secret
resource "azurerm_key_vault_secret" "secret_key" {
  name         = "SECRET-KEY"
  value        = var.django_secret_key
  key_vault_id = azurerm_key_vault.kv.id
}

# 2. Postgres User Secret
resource "azurerm_key_vault_secret" "postgres_user" {
  name         = "POSTGRES-USER"
  value        = var.postgres_user
  key_vault_id = azurerm_key_vault.kv.id
}

# 3. Postgres Password Secret
resource "azurerm_key_vault_secret" "postgres_password" {
  name         = "POSTGRES-PASSWORD"
  value        = var.postgres_password
  key_vault_id = azurerm_key_vault.kv.id
}

# 4. DB Name Secret
resource "azurerm_key_vault_secret" "db_name" {
  name         = "DB-NAME"
  value        = var.db_name
  key_vault_id = azurerm_key_vault.kv.id
}
