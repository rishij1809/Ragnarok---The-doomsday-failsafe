# Random String Suffix for Bucket Uniqueness
resource "random_string" "s3_suffix" {
  length  = 6
  special = false
  upper   = false
}

# AWS Primary S3 Storage Bucket for Media Assets
resource "aws_s3_bucket" "media_bucket" {
  bucket        = "ragnarock-media-primary-${random_string.s3_suffix.result}"
  force_destroy = true

  tags = {
    Name        = "ragnarock-media-primary"
    Project     = "Ragnarock"
    Environment = var.environment
    Role        = "Primary-Object-Storage"
  }
}

# Enable S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "media_versioning" {
  bucket = aws_s3_bucket.media_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-Side Encryption (AES256)
resource "aws_s3_bucket_server_side_encryption_configuration" "media_encryption" {
  bucket = aws_s3_bucket.media_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block All Public Access to S3 Bucket
resource "aws_s3_bucket_public_access_block" "media_public_block" {
  bucket = aws_s3_bucket.media_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM Role for AWS Lambda Cross-Cloud Sync Function
resource "aws_iam_role" "lambda_sync_role" {
  name = "ragnarock-lambda-s3-to-azure-role"

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

  tags = {
    Name        = "ragnarock-lambda-sync-role"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# IAM Policy Attachment for CloudWatch Logs & S3 Access
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_sync_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "lambda_s3_policy" {
  name        = "ragnarock-lambda-s3-read-policy"
  description = "Allows Lambda sync function to read S3 objects"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.media_bucket.arn,
          "${aws_s3_bucket.media_bucket.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_s3_attach" {
  role       = aws_iam_role.lambda_sync_role.name
  policy_arn = aws_iam_policy.lambda_s3_policy.arn
}

# Archive Dummy Lambda Function Package for Provisioning
data "archive_file" "lambda_dummy_zip" {
  type        = "zip"
  output_path = "${path.module}/dummy_lambda.zip"
  
  source {
    content  = "# Dummy Lambda Handler\ndef handler(event, context):\n    return {'statusCode': 200}\n"
    filename = "handler.py"
  }
}

# AWS Lambda Function for Real-time S3 to Azure Blob Replication
resource "aws_lambda_function" "s3_to_azure_sync" {
  filename         = data.archive_file.lambda_dummy_zip.output_path
  function_name    = "ragnarock-s3-to-azure-sync"
  role             = aws_iam_role.lambda_sync_role.arn
  handler          = "handlers.sync_s3_to_azure.lambda_handler"
  runtime          = "python3.11"
  timeout          = 60
  memory_size      = 256

  environment {
    variables = {
      AZURE_STORAGE_CONNECTION_STRING = "DefaultEndpointsProtocol=https;AccountName=stragnarockmedia;AccountKey=dummy;EndpointSuffix=core.windows.net"
      AZURE_CONTAINER_NAME            = "ragnarock-media-container"
    }
  }

  tags = {
    Name        = "ragnarock-s3-to-azure-sync"
    Project     = "Ragnarock"
    Environment = var.environment
  }
}

# Lambda Permission allowing S3 Event Trigger
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.s3_to_azure_sync.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.media_bucket.arn
}

# S3 Event Notification Triggering Lambda
resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = aws_s3_bucket.media_bucket.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.s3_to_azure_sync.arn
    events              = ["s3:ObjectCreated:*", "s3:ObjectRemoved:*"]
  }

  depends_on = [aws_lambda_permission.allow_s3]
}
