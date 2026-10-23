# Amazon ECR Repository for Django Container Images
resource "aws_ecr_repository" "django_app" {
  name                 = "ragnarock-django-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name        = "ragnarock-django-ecr"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# ECS Cluster for Primary Workload
resource "aws_ecs_cluster" "primary_cluster" {
  name = "ragnarock-aws-primary-ecs"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "ragnarock-aws-primary-ecs"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Capacity Providers for Fargate Execution
resource "aws_ecs_cluster_capacity_providers" "cluster_cp" {
  cluster_name = aws_ecs_cluster.primary_cluster.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# CloudWatch Log Group for ECS Task Logs
resource "aws_cloudwatch_log_group" "ecs_log_group" {
  name              = "/ecs/ragnarock-django-backend"
  retention_in_days = 30

  tags = {
    Name        = "ragnarock-ecs-logs"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Public Application Load Balancer (ALB)
resource "aws_lb" "alb" {
  name               = "ragnarock-aws-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = aws_subnet.public_subnets[*].id

  tags = {
    Name        = "ragnarock-aws-alb"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# ALB Target Group pointing to Django Port 8000
resource "aws_lb_target_group" "app_tg" {
  name        = "ragnarock-aws-app-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.primary_vpc.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/ready"
    protocol            = "HTTP"
    port                = "8000"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = {
    Name        = "ragnarock-aws-app-tg"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# ALB HTTP Listener
resource "aws_lb_listener" "http_listener" {
  load_balancer_arn = aws_lb.alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg.arn
  }
}

# ECS Task Execution IAM Role
resource "aws_iam_role" "ecs_execution_role" {
  name = "ragnarock-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "ragnarock-ecs-execution-role"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_policy_attach" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Secrets Access Policy for Execution Role
resource "aws_iam_policy" "secrets_access_policy" {
  name        = "ragnarock-secrets-manager-policy"
  description = "Allows ECS Tasks to retrieve Django database secrets from Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.django_db_credentials.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "secrets_policy_attach" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = aws_iam_policy.secrets_access_policy.arn
}

# ECS Task IAM Role (for application runtime permissions)
resource "aws_iam_role" "ecs_task_role" {
  name = "ragnarock-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "ragnarock-ecs-task-role"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# ECS Fargate Task Definition for Django REST Backend
resource "aws_ecs_task_definition" "django_app" {
  family                   = "ragnarock-django-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "django-backend"
      image     = "${aws_ecr_repository.django_app.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "CURRENT_CLOUD", value = "AWS" },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "POSTGRES_PORT", value = "5432" },
        { name = "DR_FAILOVER_ACTIVE", value = "false" }
      ]
      secrets = [
        { name = "SECRET_KEY", valueFrom = "${aws_secretsmanager_secret.django_db_credentials.arn}:SECRET_KEY::" },
        { name = "POSTGRES_USER", valueFrom = "${aws_secretsmanager_secret.django_db_credentials.arn}:POSTGRES_USER::" },
        { name = "POSTGRES_PASSWORD", valueFrom = "${aws_secretsmanager_secret.django_db_credentials.arn}:POSTGRES_PASSWORD::" },
        { name = "POSTGRES_DB", valueFrom = "${aws_secretsmanager_secret.django_db_credentials.arn}:DB_NAME::" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_log_group.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "django"
        }
      }
    }
  ])

  tags = {
    Name        = "ragnarock-django-task-def"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# ECS Fargate Service in Private App Subnets
resource "aws_ecs_service" "django_service" {
  name                               = "ragnarock-django-service"
  cluster                            = aws_ecs_cluster.primary_cluster.id
  task_definition                    = aws_ecs_task_definition.django_app.arn
  desired_count                      = 2
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = aws_subnet.app_subnets[*].id
    security_groups  = [aws_security_group.app_sg.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app_tg.arn
    container_name   = "django-backend"
    container_port   = 8000
  }

  depends_on = [
    aws_lb_listener.http_listener,
    aws_iam_role_policy_attachment.ecs_execution_policy_attach
  ]

  tags = {
    Name        = "ragnarock-django-ecs-service"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Application Auto-Scaling Configuration for AWS Primary Active Capacity (Min: 2, Max: 10)
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.primary_cluster.name}/${aws_ecs_service.django_service.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Target Tracking Scaling Policy - CPU Utilization 70%
resource "aws_appautoscaling_policy" "ecs_policy_cpu" {
  name               = "ragnarock-ecs-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 70.0
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Target Tracking Scaling Policy - Memory Utilization 80%
resource "aws_appautoscaling_policy" "ecs_policy_memory" {
  name               = "ragnarock-ecs-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 80.0
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
