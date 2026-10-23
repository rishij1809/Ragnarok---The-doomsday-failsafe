output "azure_infrastructure_summary" {
  description = "Summary of Azure Secondary Infrastructure Module"
  value       = module.azure_infrastructure.django_env_vars
}

output "resource_group_name" {
  value = module.azure_infrastructure.resource_group_name
}

output "vnet_id" {
  value = module.azure_infrastructure.vnet_id
}

output "acr_login_server" {
  value = module.azure_infrastructure.acr_login_server
}

output "key_vault_uri" {
  value = module.azure_infrastructure.key_vault_uri
}
