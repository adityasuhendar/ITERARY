# ITERARY Terraform Deployment

Infrastructure as Code untuk deploy ITERARY ke Google Cloud Platform.

## Prerequisites

1. **Google Cloud Platform Account**
   - Project GCP yang sudah dibuat
   - Billing account yang aktif

2. **Tools yang diperlukan:**
   ```bash
   # Install gcloud CLI
   # https://cloud.google.com/sdk/docs/install

   # Install Terraform
   # https://www.terraform.io/downloads

   # Login ke GCP
   gcloud auth login
   gcloud auth application-default login
   ```

3. **Docker Images**
   - Build dan push backend & frontend images ke GCR terlebih dahulu

## Setup Steps

### 1. Build & Push Docker Images

```bash
# Set your GCP project ID
export PROJECT_ID="your-gcp-project-id"

# Build backend
cd ../backend
docker build -t gcr.io/$PROJECT_ID/iterary-backend:latest .
docker push gcr.io/$PROJECT_ID/iterary-backend:latest

# Build frontend
cd ../frontend
docker build -t gcr.io/$PROJECT_ID/iterary-frontend:latest .
docker push gcr.io/$PROJECT_ID/iterary-frontend:latest
```

### 2. Configure Terraform Variables

```bash
# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars dengan values yang benar
nano terraform.tfvars
```

Required variables:
- `project_id`: Your GCP project ID
- `region`: GCP region (default: asia-southeast2)
- `jwt_secret`: Secret key untuk JWT authentication
- `backend_image`: GCR image URL untuk backend
- `frontend_image`: GCR image URL untuk frontend

### 3. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply changes
terraform apply
```

### 4. Get Outputs

```bash
# Get frontend URL
terraform output frontend_url

# Get API URL
terraform output api_url

# Get database password (sensitive)
terraform output -raw db_password
```

### 5. Initialize Database

Setelah Cloud SQL running, import schema:

```bash
# Get database connection name
DB_CONN=$(terraform output -raw database_connection_name)

# Import schema via Cloud SQL Proxy
gcloud sql connect $DB_CONN --user=iterary_user < ../iterary-schema-mysql.sql
```

## Architecture Deployed

```
Internet
   │
   ├─── Cloud Run (Frontend) - Nginx serving React app
   │
   ├─── Cloud Run (API) - Express.js backend
   │         │
   │         ├─── Cloud SQL MySQL (Private)
   │         └─── Redis Memorystore (Private)
   │
   └─── VPC Network
          └── VPC Access Connector
```

## Cost Estimation

Dengan konfigurasi default (free tier eligible):
- Cloud Run: ~$0 (free tier 2M requests/month)
- Cloud SQL f1-micro: ~$7-10/month
- Redis 1GB: ~$30/month
- VPC Connector: ~$8/month
- **Total**: ~$45-50/month

## Cleanup

```bash
# Destroy all resources
terraform destroy
```

## Troubleshooting

### Error: APIs not enabled
```bash
gcloud services enable \
  compute.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  servicenetworking.googleapis.com \
  vpcaccess.googleapis.com
```

### Error: Permission denied
Pastikan service account punya roles:
- Cloud Run Admin
- Cloud SQL Admin
- Redis Admin
- Compute Network Admin

### Database connection failed
Check:
1. VPC Access Connector sudah running
2. Cloud SQL private IP sudah assigned
3. Service account punya role `cloudsql.client`
