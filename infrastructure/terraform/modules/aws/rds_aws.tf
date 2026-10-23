# Custom Parameter Group for PostgreSQL Logical Replication
resource "aws_db_parameter_group" "rds_pg_params" {
  name        = "ragnarock-aws-rds-pg16-params"
  family      = "postgres16"
  description = "Custom parameter group for PostgreSQL logical replication publisher"

  parameter {
    name         = "wal_level"
    value        = "logical"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "max_wal_senders"
    value        = "10"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "max_replication_slots"
    value        = "10"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "wal_keep_size"
    value        = "2048" # 2GB WAL retention segment
    apply_method = "immediate"
  }

  parameter {
    name         = "track_commit_timestamp"
    value        = "on"
    apply_method = "pending-reboot"
  }

  tags = {
    Name        = "ragnarock-aws-rds-pg-params"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# AWS RDS PostgreSQL Master Instance (Multi-AZ Deployment)
resource "aws_db_instance" "primary_rds" {
  identifier                  = "ragnarock-aws-rds-primary"
  engine                      = "postgres"
  engine_version              = "16.1"
  instance_class              = "db.t4g.medium"
  allocated_storage           = 50
  max_allocated_storage       = 200
  storage_type                = "gp3"
  multi_az                    = true
  publicly_accessible         = false

  db_name                     = var.db_name
  username                    = var.postgres_user
  password                    = var.postgres_password
  port                        = 5432

  db_subnet_group_name        = aws_db_subnet_group.rds_subnet_group.name
  vpc_security_group_ids      = [aws_security_group.rds_sg.id]
  parameter_group_name        = aws_db_parameter_group.rds_pg_params.name

  storage_encrypted           = true
  deletion_protection         = false
  skip_final_snapshot         = true

  backup_retention_period     = 7
  preferred_backup_window     = "03:00-04:00"
  preferred_maintenance_window = "Sun:04:30-Sun:05:30"

  tags = {
    Name        = "ragnarock-aws-rds-primary"
    Project     = "Ragnarock"
    Environment = var.environment
    Role        = "Primary-Publisher"
  }
}
