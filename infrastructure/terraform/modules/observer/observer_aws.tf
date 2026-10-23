# Independent Observer Region Provider Configuration (eu-west-1)
provider "aws" {
  alias  = "observer_region"
  region = "eu-west-1"
}

# DynamoDB Table for Distributed Fencing Lease & Quorum Consensus State
resource "aws_dynamodb_table" "quorum_state_table" {
  provider     = aws.observer_region
  name         = "ragnarock_quorum_state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "lock_key"

  attribute {
    name = "lock_key"
    type = "S"
  }

  ttl {
    attribute_name = "lease_ttl"
    enabled        = true
  }

  tags = {
    Name        = "ragnarock-quorum-dynamodb"
    Project     = "Ragnarock"
    Environment = var.environment
    Role        = "Quorum-Arbiter-Lock"
  }
}

# IAM Role for Neutral Observer Lambda Function
resource "aws_iam_role" "observer_lambda_role" {
  provider = aws.observer_region
  name     = "ragnarock-observer-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy granting DynamoDB & CloudWatch access
resource "aws_iam_policy" "observer_dynamo_policy" {
  provider    = aws.observer_region
  name        = "ragnarock-observer-dynamodb-policy"
  description = "Allows Observer Lambda to read/write quorum consensus state in DynamoDB"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Resource = [aws_dynamodb_table.quorum_state_table.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "observer_attach" {
  provider   = aws.observer_region
  role       = aws_iam_role.observer_lambda_role.name
  policy_arn = aws_iam_policy.observer_dynamo_policy.arn
}
