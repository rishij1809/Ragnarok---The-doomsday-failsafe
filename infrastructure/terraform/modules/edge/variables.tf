variable "cloudflare_account_id" {
  type        = string
  default     = "0123456789abcdef0123456789abcdef"
  description = "Cloudflare Account ID"
}

variable "cloudflare_zone_id" {
  type        = string
  default     = "abcdef0123456789abcdef0123456789"
  description = "Cloudflare DNS Zone ID"
}

variable "domain_name" {
  type        = string
  default     = "ragnarock.io"
  description = "Apex domain name for Project Ragnarock"
}

variable "aws_alb_dns_name" {
  type        = string
  default     = "ragnarock-aws-alb-123456.us-east-1.elb.amazonaws.com"
  description = "AWS Application Load Balancer DNS Endpoint"
}

variable "azure_container_app_fqdn" {
  type        = string
  default     = "ca-ragnarock-django-secondary.eastus.azurecontainerapps.io"
  description = "Azure Container Apps FQDN Endpoint"
}

variable "alert_email" {
  type        = string
  default     = "devops-alerts@ragnarock.io"
  description = "Alert email address for origin pool health notifications"
}
