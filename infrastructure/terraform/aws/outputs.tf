output "aws_infrastructure_summary" {
  description = "Summary of AWS Primary Infrastructure Module"
  value       = module.aws_infrastructure.django_env_vars
}

output "vpc_id" {
  value = module.aws_infrastructure.vpc_id
}

output "ecr_repository_url" {
  value = module.aws_infrastructure.ecr_repository_url
}

output "ecs_cluster_name" {
  value = module.aws_infrastructure.ecs_cluster_name
}

output "secrets_manager_secret_arn" {
  value = module.aws_infrastructure.secrets_manager_secret_arn
}
