variable "project_id" {
  description = "The GCP project ID to deploy resources"
  type        = string
}

variable "region" {
  description = "The GCP region for resources"
  type        = string
  default     = "asia-southeast2"
}

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "db_name" {
  description = "Cloud SQL database name"
  type        = string
  default     = "iterary"
}

variable "db_user" {
  description = "Cloud SQL database user"
  type        = string
  default     = "iterary_user"
}

variable "jwt_secret" {
  description = "JWT secret for authentication"
  type        = string
  sensitive   = true
}

variable "backend_image" {
  description = "Docker image URL for backend API (e.g., gcr.io/PROJECT_ID/iterary-backend:latest)"
  type        = string
}

variable "frontend_image" {
  description = "Docker image URL for frontend (e.g., gcr.io/PROJECT_ID/iterary-frontend:latest)"
  type        = string
}
