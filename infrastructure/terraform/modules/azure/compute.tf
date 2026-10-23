# Random String Suffix for Globally Unique Resource Naming
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# Azure Container Registry (ACR)
resource "azurerm_container_registry" "acr" {
  name                = "acrragnarock${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Standard"
  admin_enabled       = true

  tags = {
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# User Assigned Managed Identity for Container Apps Tier
resource "azurerm_user_assigned_identity" "app_identity" {
  name                = "mi-ragnarock-aca-identity"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  tags = {
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Grant AcrPull Role to User Assigned Managed Identity
resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.app_identity.principal_id
}

# Azure Container Apps Environment (VNet Integrated into Private App Subnet)
resource "azurerm_container_app_environment" "aca_env" {
  name                           = "cae-ragnarock-secondary"
  location                       = azurerm_resource_group.rg.location
  resource_group_name            = azurerm_resource_group.rg.name
  infrastructure_subnet_id       = azurerm_subnet.app_subnet.id
  internal_load_balancer_enabled = false

  tags = {
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Azure Container App (Secondary Warm Standby Workload)
resource "azurerm_container_app" "django_app" {
  name                         = "ca-ragnarock-django-secondary"
  container_app_environment_id = azurerm_container_app_environment.aca_env.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app_identity.id]
  }

  secret {
    name  = "secret-key"
    value = var.django_secret_key
  }

  secret {
    name  = "postgres-user"
    value = var.postgres_user
  }

  secret {
    name  = "postgres-password"
    value = var.postgres_password
  }

  secret {
    name  = "db-name"
    value = var.db_name
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.acr.admin_password
  }

  registry {
    server               = azurerm_container_registry.acr.login_server
    username             = azurerm_container_registry.acr.admin_username
    password_secret_name = "acr-password"
  }

  ingress {
    external_enabled = true
    target_port      = 8000
    transport        = "auto"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    # Asymmetric Scaling Rule: Warm Standby (min: 1 replica idle, max: 10 burst capacity on failover)
    min_replicas = 1
    max_replicas = 10

    container {
      name   = "django-backend"
      image  = "${azurerm_container_registry.acr.login_server}/ragnarock-django-backend:latest"
      cpu    = 0.5
      memory = "1.0Gi"

      env {
        name  = "CURRENT_CLOUD"
        value = "AZURE"
      }
      env {
        name  = "AZURE_LOCATION"
        value = var.azure_location
      }
      env {
        name  = "DR_FAILOVER_ACTIVE"
        value = "true"
      }
      env {
        name        = "SECRET_KEY"
        secret_name = "secret-key"
      }
      env {
        name        = "POSTGRES_USER"
        secret_name = "postgres-user"
      }
      env {
        name        = "POSTGRES_PASSWORD"
        secret_name = "postgres-password"
      }
      env {
        name        = "POSTGRES_DB"
        secret_name = "db-name"
      }

      # Liveness Probe (Points to /healthz)
      liveness_probe {
        transport = "HTTP"
        port      = 8000
        path      = "/healthz"

        initial_delay           = 10
        interval_seconds        = 15
        timeout                 = 5
        failure_count_threshold = 3
      }

      # Readiness Probe (Points to /ready)
      readiness_probe {
        transport = "HTTP"
        port      = 8000
        path      = "/ready"

        initial_delay           = 15
        interval_seconds        = 15
        timeout                 = 5
        failure_count_threshold = 3
      }
    }

    # HTTP Concurrent Request Auto-Scaling Rule
    http_scale_rule {
      name                = "http-request-scaling"
      concurrent_requests = "100"
    }
  }

  tags = {
    Project     = "Ragnarock"
    Environment = var.environment
  }
}
