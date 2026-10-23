output "resource_group_name" {
  description = "Resource Group Name for Azure Secondary Deployment"
  value       = azurerm_resource_group.rg.name
}

output "vnet_id" {
  description = "The ID of the Azure Standby Virtual Network"
  value       = azurerm_virtual_network.vnet.id
}

output "gateway_subnet_id" {
  description = "ID of the GatewaySubnet for Azure VPN Gateway"
  value       = azurerm_subnet.gateway_subnet.id
}

output "public_subnet_id" {
  description = "ID of the Azure public/ingress subnet"
  value       = azurerm_subnet.public_subnet.id
}

output "app_subnet_id" {
  description = "ID of the Azure private Django container subnet"
  value       = azurerm_subnet.app_subnet.id
}

output "db_subnet_id" {
  description = "ID of the Azure PostgreSQL delegated database subnet"
  value       = azurerm_subnet.db_subnet.id
}

output "acr_login_server" {
  description = "Login server endpoint for Azure Container Registry"
  value       = azurerm_container_registry.acr.login_server
}

output "acr_name" {
  description = "Name of Azure Container Registry"
  value       = azurerm_container_registry.acr.name
}

output "container_app_environment_id" {
  description = "ID of Azure Container Apps Environment"
  value       = azurerm_container_app_environment.aca_env.id
}

output "container_app_id" {
  description = "ID of Azure Container App"
  value       = azurerm_container_app.django_app.id
}

output "container_app_fqdn" {
  description = "FQDN endpoint of Azure Container App"
  value       = azurerm_container_app.django_app.ingress[0].fqdn
}

# Azure Storage Outputs
output "storage_account_name" {
  description = "Azure Storage Account Name for Secondary Media"
  value       = azurerm_storage_account.media_storage.name
}

output "storage_container_name" {
  description = "Azure Storage Container Name for Secondary Media"
  value       = azurerm_storage_container.media_container.name
}

output "storage_primary_access_key" {
  description = "Azure Storage Account Primary Access Key"
  value       = azurerm_storage_account.media_storage.primary_access_key
  sensitive   = true
}

# Azure PostgreSQL Standby Outputs
output "postgres_fqdn" {
  description = "FQDN hostname of Azure PostgreSQL Flexible Server Standby"
  value       = azurerm_postgresql_flexible_server.standby_pg.fqdn
}

output "postgres_id" {
  description = "Resource ID of Azure PostgreSQL Flexible Server Standby"
  value       = azurerm_postgresql_flexible_server.standby_pg.id
}

output "user_assigned_identity_id" {
  description = "ID of User Assigned Managed Identity"
  value       = azurerm_user_assigned_identity.app_identity.id
}

output "user_assigned_identity_client_id" {
  description = "Client ID of User Assigned Managed Identity"
  value       = azurerm_user_assigned_identity.app_identity.client_id
}

output "key_vault_id" {
  description = "ID of Azure Key Vault"
  value       = azurerm_key_vault.kv.id
}

output "key_vault_uri" {
  description = "URI endpoint for Azure Key Vault"
  value       = azurerm_key_vault.kv.vault_uri
}

# Azure VPN Gateway Telemetry Outputs
output "vpn_gateway_id" {
  description = "Azure Virtual Network Gateway ID"
  value       = azurerm_virtual_network_gateway.vnet_gw.id
}

output "vpn_gateway_public_ip_1" {
  description = "Public IP 1 of Azure Virtual Network Gateway"
  value       = azurerm_public_ip.vpn_gw_pip_1.ip_address
}

output "vpn_gateway_public_ip_2" {
  description = "Public IP 2 of Azure Virtual Network Gateway"
  value       = azurerm_public_ip.vpn_gw_pip_2.ip_address
}

output "vpn_connection1_id" {
  description = "ID of Azure VPN Connection to AWS Tunnel 1"
  value       = azurerm_virtual_network_gateway_connection.aws_conn_1.id
}

output "vpn_connection2_id" {
  description = "ID of Azure VPN Connection to AWS Tunnel 2"
  value       = azurerm_virtual_network_gateway_connection.aws_conn_2.id
}

output "django_env_vars" {
  description = "Structured map of environment variables ready for injection into Azure Container Apps runtime"
  value = {
    CURRENT_CLOUD              = "AZURE"
    AZURE_LOCATION             = var.azure_location
    VNET_ID                    = azurerm_virtual_network.vnet.id
    APP_SUBNET_ID              = azurerm_subnet.app_subnet.id
    DB_SUBNET_ID               = azurerm_subnet.db_subnet.id
    AZURE_STORAGE_ACCOUNT_NAME = azurerm_storage_account.media_storage.name
    AZURE_STORAGE_CONTAINER    = azurerm_storage_container.media_container.name
    POSTGRES_HOST              = azurerm_postgresql_flexible_server.standby_pg.fqdn
    POSTGRES_PORT              = "5432"
    KEY_VAULT_URI              = azurerm_key_vault.kv.vault_uri
    ACR_LOGIN_SERVER           = azurerm_container_registry.acr.login_server
    MANAGED_IDENTITY_ID        = azurerm_user_assigned_identity.app_identity.id
    MANAGED_IDENTITY_CLIENT_ID = azurerm_user_assigned_identity.app_identity.client_id
    CONTAINER_APP_ENV_ID       = azurerm_container_app_environment.aca_env.id
    CONTAINER_APP_FQDN         = azurerm_container_app.django_app.ingress[0].fqdn
    AZURE_VPN_GATEWAY_PIP_1    = azurerm_public_ip.vpn_gw_pip_1.ip_address
    AZURE_VPN_GATEWAY_PIP_2    = azurerm_public_ip.vpn_gw_pip_2.ip_address
    DR_FAILOVER_ACTIVE         = "true"
  }
}
