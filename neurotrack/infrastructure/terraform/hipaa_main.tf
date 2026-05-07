# NeuroTrack — HIPAA-Compliant AWS Infrastructure
# Covers: KMS, RDS, S3 (audit + PHI), CloudTrail, VPC, IAM least-privilege
# Requires: AWS BAA signed via AWS Artifact before any PHI touches these resources.

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {
    bucket         = "neurotrack-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    kms_key_id     = "alias/terraform-state-key"
    dynamodb_table = "terraform-state-locks"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "NeuroTrack"
      Environment = var.environment
      Compliance  = "HIPAA"
      DataClass   = "PHI"
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

# ─────────────────────────────────────────────────────────────────────────────
# KMS — Customer-Managed Key for PHI at rest (AES-256, rotated annually)
# HIPAA § 164.312(a)(2)(iv) — Encryption and decryption
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_kms_key" "phi" {
  description             = "NeuroTrack PHI encryption key (RDS, S3, EBS)"
  deletion_window_in_days = 30
  enable_key_rotation     = true      # Annual auto-rotation per HIPAA recommendation
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "RootAccess"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action   = "kms:*"
        Resource = "*"
      },
      # Only allow decrypt via RDS service — prevents direct key use by IAM users
      {
        Sid    = "RestrictDecryptToRDS"
        Effect = "Deny"
        Principal = "*"
        Action = ["kms:Decrypt", "kms:GenerateDataKey"]
        Resource = "*"
        Condition = {
          StringNotEqualsIfExists = {
            "kms:ViaService" = [
              "rds.${var.aws_region}.amazonaws.com",
              "s3.${var.aws_region}.amazonaws.com",
            ]
          }
        }
      }
    ]
  })
}

resource "aws_kms_alias" "phi" {
  name          = "alias/neurotrack-phi"
  target_key_id = aws_kms_key.phi.key_id
}

# Separate key for audit log bucket (defense-in-depth)
resource "aws_kms_key" "audit" {
  description             = "NeuroTrack audit log encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "audit" {
  name          = "alias/neurotrack-audit"
  target_key_id = aws_kms_key.audit.key_id
}

# ─────────────────────────────────────────────────────────────────────────────
# RDS — PostgreSQL with forced TLS, encryption, deletion protection
# HIPAA § 164.312(e)(2)(ii) — Encryption in transit
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_db_parameter_group" "neurotrack" {
  family = "postgres15"
  name   = "neurotrack-hipaa-pg15"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "immediate"
  }

  parameter {
    name         = "log_connections"
    value        = "1"
    apply_method = "immediate"
  }

  parameter {
    name         = "log_disconnections"
    value        = "1"
    apply_method = "immediate"
  }
}

resource "aws_db_instance" "neurotrack" {
  identifier     = "neurotrack-phi-db"
  engine         = "postgres"
  engine_version = "15.3"
  instance_class = "db.r6g.large"

  storage_encrypted   = true
  kms_key_id          = aws_kms_key.phi.arn
  storage_type        = "gp3"
  allocated_storage   = 100
  max_allocated_storage = 1000  # Auto-scaling storage

  db_name  = "neurotrack"
  username = var.db_username
  # Use AWS Secrets Manager reference — never plain text in tfvars
  manage_master_user_password                 = true
  master_user_secret_kms_key_id              = aws_kms_key.phi.arn

  parameter_group_name   = aws_db_parameter_group.neurotrack.name
  db_subnet_group_name   = aws_db_subnet_group.private.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period  = 30        # 30-day PITR (HIPAA recommends > 6 years for records; use S3 export for long-term)
  backup_window            = "03:00-04:00"
  maintenance_window       = "sun:04:00-sun:05:00"
  copy_tags_to_snapshot    = true

  deletion_protection      = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "neurotrack-final-${formatdate("YYYY-MM-DD", timestamp())}"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  performance_insights_enabled          = true
  performance_insights_kms_key_id       = aws_kms_key.phi.arn
  performance_insights_retention_period = 7
}

resource "aws_db_subnet_group" "private" {
  name       = "neurotrack-private-subnets"
  subnet_ids = var.private_subnet_ids
}

# ─────────────────────────────────────────────────────────────────────────────
# S3 — Immutable audit log bucket (WORM, Object Lock, 6-year HIPAA retention)
# HIPAA § 164.530(j) — Documentation (retain 6 years minimum)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_s3_bucket" "audit_logs" {
  bucket        = "neurotrack-audit-logs-${data.aws_caller_identity.current.account_id}"
  force_destroy = false

  object_lock_enabled = true  # Must be set at creation time
}

resource "aws_s3_bucket_versioning" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_object_lock_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  rule {
    default_retention {
      mode = "COMPLIANCE"   # Cannot be overridden even by root user
      days = 2190           # 6 years = 6 × 365 = 2190 days
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.audit.arn
    }
    bucket_key_enabled = true   # Reduces KMS API calls by 99%
  }
}

resource "aws_s3_bucket_public_access_block" "audit_logs" {
  bucket                  = aws_s3_bucket.audit_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─────────────────────────────────────────────────────────────────────────────
# CloudTrail — Management events + data events on audit bucket
# HIPAA § 164.308(a)(1)(ii)(D) — Information system activity review
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_cloudtrail" "neurotrack" {
  name                          = "neurotrack-hipaa-trail"
  s3_bucket_name               = aws_s3_bucket.audit_logs.id
  s3_key_prefix                = "cloudtrail"
  include_global_service_events = true
  is_multi_region_trail        = true
  enable_log_file_validation   = true    # SHA-256 integrity hash per log file

  event_selector {
    read_write_type           = "All"
    include_management_events = true

    # Log all S3 object operations on the audit bucket itself
    data_resource {
      type   = "AWS::S3::Object"
      values = ["arn:aws:s3:::${aws_s3_bucket.audit_logs.id}/"]
    }
  }

  cloud_watch_logs_group_arn = "${aws_cloudwatch_log_group.trail.arn}:*"
  cloud_watch_logs_role_arn  = aws_iam_role.cloudtrail_cw.arn
}

resource "aws_cloudwatch_log_group" "trail" {
  name              = "/aws/cloudtrail/neurotrack"
  retention_in_days = 90
  kms_key_id        = aws_kms_key.audit.arn
}

# ─────────────────────────────────────────────────────────────────────────────
# SECURITY GROUP — RDS: only port 5432 from ECS tasks
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_security_group" "rds" {
  name        = "neurotrack-rds-sg"
  description = "Allow PostgreSQL only from ECS task security group"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs_tasks" {
  name        = "neurotrack-ecs-sg"
  description = "ECS task security group"
  vpc_id      = var.vpc_id

  # No port 80 — ALB enforces TLS 1.3, HTTP redirects to HTTPS at CloudFront/ALB level
  ingress {
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# IAM — Least privilege for application role (HIPAA § 164.308(a)(3))
# No wildcard "*" on any PHI resource actions
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_iam_role" "neurotrack_app" {
  name = "neurotrack-app-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy" "neurotrack_app" {
  name = "NeuroTrackAppPolicy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "KMSEncryptDecrypt"
        Effect = "Allow"
        Action = ["kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
        Resource = [aws_kms_key.phi.arn]
      },
      {
        Sid    = "SecretsManagerRead"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = ["arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:neurotrack/*"]
      },
      {
        Sid    = "DenyPHIBulkExport"
        Effect = "Deny"
        Action = ["rds:StartExportTask", "s3:GetBucketAcl"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "app" {
  role       = aws_iam_role.neurotrack_app.name
  policy_arn = aws_iam_policy.neurotrack_app.arn
}

# ─────────────────────────────────────────────────────────────────────────────
# VARIABLES
# ─────────────────────────────────────────────────────────────────────────────
variable "aws_region"          { default = "us-east-1" }
variable "environment"         { default = "production" }
variable "vpc_id"              {}
variable "vpc_cidr"            {}
variable "private_subnet_ids"  { type = list(string) }
variable "db_username"         { default = "neurotrack_app" }

# ─────────────────────────────────────────────────────────────────────────────
# OUTPUTS
# ─────────────────────────────────────────────────────────────────────────────
output "rds_endpoint"          { value = aws_db_instance.neurotrack.endpoint }
output "phi_kms_key_arn"       { value = aws_kms_key.phi.arn }
output "audit_bucket_name"     { value = aws_s3_bucket.audit_logs.id }
output "app_role_arn"          { value = aws_iam_role.neurotrack_app.arn }
