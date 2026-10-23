terraform {
  required_version = ">= 1.5.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# Cloudflare Health Monitor for Edge Synthetic Probing
resource "cloudflare_load_balancer_monitor" "health_check" {
  account_id     = var.cloudflare_account_id
  type           = "https"
  path           = "/ready"
  port           = 443
  method         = "GET"
  timeout        = 2
  interval       = 5
  retries        = 2
  expected_codes = "200"
  follow_redirects = false

  description = "Health check probe monitoring /ready endpoint for Project Ragnarock"
}

# Cloudflare Origin Pool 1: AWS Primary Region (us-east-1)
resource "cloudflare_load_balancer_pool" "aws_primary_pool" {
  account_id = var.cloudflare_account_id
  name       = "pool-ragnarock-aws-primary"
  enabled    = true

  origins {
    name    = "aws-primary-alb"
    address = var.aws_alb_dns_name
    enabled = true
    weight  = 1.0
  }

  monitor = cloudflare_load_balancer_monitor.health_check.id
  notification_email = var.alert_email
  
  description = "Primary origin pool targeting AWS Application Load Balancer"
}

# Cloudflare Origin Pool 2: Azure Secondary Region (eastus Warm Standby)
resource "cloudflare_load_balancer_pool" "azure_secondary_pool" {
  account_id = var.cloudflare_account_id
  name       = "pool-ragnarock-azure-secondary"
  enabled    = true

  origins {
    name    = "azure-secondary-container-app"
    address = var.azure_container_app_fqdn
    enabled = true
    weight  = 1.0
  }

  monitor = cloudflare_load_balancer_monitor.health_check.id
  notification_email = var.alert_email

  description = "Secondary origin pool targeting Azure Container Apps Ingress"
}

# Global Anycast Load Balancer & Traffic Director (api.ragnarock.io)
resource "cloudflare_load_balancer" "global_lb" {
  zone_id          = var.cloudflare_zone_id
  name             = "api.${var.domain_name}"
  fallback_pool_id = cloudflare_load_balancer_pool.azure_secondary_pool.id
  default_pool_ids = [
    cloudflare_load_balancer_pool.aws_primary_pool.id,
    cloudflare_load_balancer_pool.azure_secondary_pool.id
  ]

  steering_policy = "priority"
  proxied         = true
  ttl             = 30

  session_affinity = "none"

  description = "Global Anycast Edge Traffic Director for Project Ragnarock Multi-Cloud DR"
}
