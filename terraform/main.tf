/**
 * ITERARY - Three-Tier Library Management System
 * Terraform configuration for GCP deployment
 */

# Enable required APIs
module "project_services" {
  source  = "terraform-google-modules/project-factory/google//modules/project_services"
  version = "~> 14.0"

  project_id = var.project_id

  activate_apis = [
    "compute.googleapis.com",
    "cloudapis.googleapis.com",
    "vpcaccess.googleapis.com",
    "servicenetworking.googleapis.com",
    "cloudbuild.googleapis.com",
    "sql-component.googleapis.com",
    "sqladmin.googleapis.com",
    "storage.googleapis.com",
    "run.googleapis.com",
    "redis.googleapis.com",
  ]
}

# Service Account for Cloud Run
resource "google_service_account" "iterary_run_sa" {
  project      = var.project_id
  account_id   = "iterary-run-sa"
  display_name = "Service Account for ITERARY Cloud Run"
}

# IAM roles for Cloud Run service account
resource "google_project_iam_member" "run_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.iterary_run_sa.email}"
}

resource "google_project_iam_member" "run_sql_instance_user" {
  project = var.project_id
  role    = "roles/cloudsql.instanceUser"
  member  = "serviceAccount:${google_service_account.iterary_run_sa.email}"
}

# VPC Network
resource "google_compute_network" "iterary_network" {
  name                    = "iterary-network"
  auto_create_subnetworks = true
  project                 = var.project_id
}

# Reserve IP range for VPC peering (Cloud SQL)
resource "google_compute_global_address" "private_ip_address" {
  name          = "iterary-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.iterary_network.id
  project       = var.project_id
}

# VPC Peering connection for Cloud SQL
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.iterary_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# VPC Access Connector (for Cloud Run to access VPC)
resource "google_vpc_access_connector" "iterary_connector" {
  name          = "iterary-vpc-connector"
  region        = var.region
  network       = google_compute_network.iterary_network.name
  ip_cidr_range = "10.8.0.0/28"
  project       = var.project_id

  depends_on = [module.project_services]
}

# Cloud SQL MySQL Instance
resource "random_id" "db_suffix" {
  byte_length = 4
}

resource "google_sql_database_instance" "iterary_db" {
  name             = "iterary-db-${random_id.db_suffix.hex}"
  database_version = "MYSQL_8_0"
  region           = var.region
  project          = var.project_id

  settings {
    tier              = var.db_tier
    disk_autoresize   = true
    disk_size         = 10
    disk_type         = "PD_SSD"
    availability_type = "ZONAL"

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.iterary_network.id
    }

    backup_configuration {
      enabled            = true
      binary_log_enabled = true
    }
  }

  deletion_protection = false

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# Cloud SQL Database
resource "google_sql_database" "iterary_database" {
  name     = var.db_name
  instance = google_sql_database_instance.iterary_db.name
  project  = var.project_id
}

# Cloud SQL User
resource "random_password" "db_password" {
  length  = 16
  special = true
}

resource "google_sql_user" "iterary_user" {
  name     = var.db_user
  instance = google_sql_database_instance.iterary_db.name
  password = random_password.db_password.result
  project  = var.project_id
}

# Redis Memorystore Instance
resource "google_redis_instance" "iterary_cache" {
  name               = "iterary-cache"
  tier               = "BASIC"
  memory_size_gb     = 1
  region             = var.region
  redis_version      = "REDIS_6_X"
  authorized_network = google_compute_network.iterary_network.id
  project            = var.project_id

  depends_on = [module.project_services]
}

# Cloud Run - Backend API
resource "google_cloud_run_service" "iterary_api" {
  name     = "iterary-api"
  location = var.region
  project  = var.project_id

  template {
    spec {
      service_account_name = google_service_account.iterary_run_sa.email

      containers {
        image = var.backend_image

        ports {
          container_port = 8080
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }
        env {
          name  = "INSTANCE_UNIX_SOCKET"
          value = "/cloudsql/${google_sql_database_instance.iterary_db.connection_name}"
        }
        env {
          name  = "DB_USER"
          value = google_sql_user.iterary_user.name
        }
        env {
          name  = "DB_PASSWORD"
          value = random_password.db_password.result
        }
        env {
          name  = "DB_NAME"
          value = google_sql_database.iterary_database.name
        }
        env {
          name  = "REDIS_ENABLED"
          value = "true"
        }
        env {
          name  = "REDIS_HOST"
          value = google_redis_instance.iterary_cache.host
        }
        env {
          name  = "REDIS_PORT"
          value = "6379"
        }
        env {
          name  = "JWT_SECRET"
          value = var.jwt_secret
        }
        env {
          name  = "CORS_ORIGIN"
          value = "*"
        }

        startup_probe {
          initial_delay_seconds = 0
          timeout_seconds       = 5
          period_seconds        = 10
          failure_threshold     = 24
          tcp_socket {
            port = 8080
          }
        }

        liveness_probe {
          http_get {
            path = "/health"
            port = 8080
          }
          initial_delay_seconds = 30
          period_seconds        = 10
          timeout_seconds       = 5
          failure_threshold     = 3
        }

        resources {
          limits = {
            cpu    = "1000m"
            memory = "512Mi"
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale"        = "10"
        "run.googleapis.com/cloudsql-instances"   = google_sql_database_instance.iterary_db.connection_name
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.iterary_connector.id
        "run.googleapis.com/vpc-access-egress"    = "all-traffic"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_sql_database.iterary_database,
    google_sql_user.iterary_user,
    google_redis_instance.iterary_cache
  ]
}

# Cloud Run - Frontend
resource "google_cloud_run_service" "iterary_frontend" {
  name     = "iterary-frontend"
  location = var.region
  project  = var.project_id

  template {
    spec {
      service_account_name = google_service_account.iterary_run_sa.email

      containers {
        image = var.frontend_image

        ports {
          container_port = 80
        }

        env {
          name  = "VITE_API_URL"
          value = google_cloud_run_service.iterary_api.status[0].url
        }

        resources {
          limits = {
            cpu    = "1000m"
            memory = "256Mi"
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale" = "10"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [google_cloud_run_service.iterary_api]
}

# Allow unauthenticated access to Cloud Run services
resource "google_cloud_run_service_iam_member" "api_noauth" {
  location = google_cloud_run_service.iterary_api.location
  project  = google_cloud_run_service.iterary_api.project
  service  = google_cloud_run_service.iterary_api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_service_iam_member" "frontend_noauth" {
  location = google_cloud_run_service.iterary_frontend.location
  project  = google_cloud_run_service.iterary_frontend.project
  service  = google_cloud_run_service.iterary_frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
