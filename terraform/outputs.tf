output "frontend_url" {
  description = "URL of the ITERARY frontend application"
  value       = google_cloud_run_service.iterary_frontend.status[0].url
}

output "api_url" {
  description = "URL of the ITERARY backend API"
  value       = google_cloud_run_service.iterary_api.status[0].url
}

output "database_instance" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.iterary_db.name
}

output "database_connection_name" {
  description = "Cloud SQL connection name"
  value       = google_sql_database_instance.iterary_db.connection_name
}

output "database_private_ip" {
  description = "Cloud SQL private IP address"
  value       = google_sql_database_instance.iterary_db.private_ip_address
}

output "redis_host" {
  description = "Redis Memorystore host"
  value       = google_redis_instance.iterary_cache.host
}

output "redis_port" {
  description = "Redis Memorystore port"
  value       = google_redis_instance.iterary_cache.port
}

output "service_account_email" {
  description = "Service account email for Cloud Run"
  value       = google_service_account.iterary_run_sa.email
}

output "db_password" {
  description = "Database password (sensitive)"
  value       = random_password.db_password.result
  sensitive   = true
}
