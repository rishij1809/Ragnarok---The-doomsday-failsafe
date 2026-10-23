output "edge_load_balancer_id" {
  description = "ID of Global Anycast Cloudflare Load Balancer"
  value       = cloudflare_load_balancer.global_lb.id
}

output "edge_hostname" {
  description = "Public Anycast Hostname for API Ingress"
  value       = cloudflare_load_balancer.global_lb.name
}

output "aws_primary_pool_id" {
  description = "Origin Pool ID for AWS Primary ALB"
  value       = cloudflare_load_balancer_pool.aws_primary_pool.id
}

output "azure_secondary_pool_id" {
  description = "Origin Pool ID for Azure Secondary Container App"
  value       = cloudflare_load_balancer_pool.azure_secondary_pool.id
}
