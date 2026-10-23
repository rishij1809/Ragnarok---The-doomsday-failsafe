# Azure Storage Account for Secondary Standby Media Assets
resource "azurerm_storage_account" "media_storage" {
  name                     = "strmedia${random_string.suffix.result}"
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  access_tier              = "Hot"

  blob_properties {
    versioning_enabled = true
    delete_retention_policy {
      days = 7
    }
    container_delete_retention_policy {
      days = 7
    }
  }

  tags = {
    Name        = "strmedia-secondary"
    Project     = "Ragnarock"
    Environment = var.environment
    Role        = "Standby-Object-Storage"
  }
}

# Azure Blob Container for Media Assets
resource "azurerm_storage_container" "media_container" {
  name                  = "ragnarock-media-container"
  storage_account_name  = azurerm_storage_account.media_storage.name
  container_access_type = "private"
}

# Role Assignment granting Storage Blob Data Contributor to User Assigned Managed Identity
resource "azurerm_role_assignment" "blob_data_contributor" {
  scope                = azurerm_storage_account.media_storage.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.app_identity.principal_id
}
