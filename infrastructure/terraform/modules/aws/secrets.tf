# AWS Secrets Manager Resource for Django DB Credentials
resource "aws_secretsmanager_secret" "django_db_credentials" {
  name                    = "ragnarock/${var.environment}/django_db_credentials"
  description             = "Database and Application secrets for Django REST Framework (Ragnarock DR)"
  recovery_window_in_days = 0

  tags = {
    Name        = "ragnarock-aws-secrets"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Secret Version holding JSON encoded credential dictionary
resource "aws_secretsmanager_secret_version" "django_db_credentials_version" {
  secret_id = aws_secretsmanager_secret.django_db_credentials.id
  secret_string = jsonencode({
    SECRET_KEY        = var.django_secret_key
    POSTGRES_USER     = var.postgres_user
    POSTGRES_PASSWORD = var.postgres_password
    DB_NAME           = var.db_name
  })
}
