#!/bin/bash

# ITERARY Deployment Script
# This script automates the deployment of ITERARY to Google Cloud Platform

set -e

echo "=================================="
echo "  ITERARY GCP Deployment Script"
echo "=================================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "Error: Terraform is not installed"
    echo "Install from: https://www.terraform.io/downloads"
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    echo "Install from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Get project ID
read -p "Enter your GCP Project ID: " PROJECT_ID
if [ -z "$PROJECT_ID" ]; then
    echo "Error: Project ID cannot be empty"
    exit 1
fi

# Set project
echo "Setting GCP project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo ""
echo "Enabling required GCP APIs..."
gcloud services enable \
    compute.googleapis.com \
    run.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    servicenetworking.googleapis.com \
    vpcaccess.googleapis.com \
    cloudbuild.googleapis.com

# Configure Docker for GCR
echo ""
echo "Configuring Docker for Google Container Registry..."
gcloud auth configure-docker

# Build and push backend
echo ""
echo "Building backend Docker image..."
cd ../backend
docker build -t gcr.io/$PROJECT_ID/iterary-backend:latest .
echo "Pushing backend image to GCR..."
docker push gcr.io/$PROJECT_ID/iterary-backend:latest

# Build and push frontend
echo ""
echo "Building frontend Docker image..."
cd ../frontend
docker build -t gcr.io/$PROJECT_ID/iterary-frontend:latest .
echo "Pushing frontend image to GCR..."
docker push gcr.io/$PROJECT_ID/iterary-frontend:latest

# Go back to terraform directory
cd ../terraform

# Create terraform.tfvars if not exists
if [ ! -f terraform.tfvars ]; then
    echo ""
    echo "Creating terraform.tfvars..."

    # Generate random JWT secret
    JWT_SECRET=$(openssl rand -base64 32)

    cat > terraform.tfvars <<EOF
project_id = "$PROJECT_ID"
region     = "asia-southeast2"

db_tier = "db-f1-micro"
db_name = "iterary"
db_user = "iterary_user"

jwt_secret = "$JWT_SECRET"

backend_image  = "gcr.io/$PROJECT_ID/iterary-backend:latest"
frontend_image = "gcr.io/$PROJECT_ID/iterary-frontend:latest"
EOF

    echo "terraform.tfvars created with generated JWT secret"
else
    echo ""
    echo "terraform.tfvars already exists, skipping creation"
fi

# Initialize Terraform
echo ""
echo "Initializing Terraform..."
terraform init

# Plan
echo ""
echo "Creating Terraform plan..."
terraform plan -out=tfplan

# Ask for confirmation
echo ""
read -p "Do you want to apply this plan? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled"
    exit 0
fi

# Apply
echo ""
echo "Applying Terraform configuration..."
terraform apply tfplan

# Get outputs
echo ""
echo "=================================="
echo "  Deployment Complete!"
echo "=================================="
echo ""
echo "Frontend URL: $(terraform output -raw frontend_url)"
echo "API URL: $(terraform output -raw api_url)"
echo ""
echo "Database Connection: $(terraform output -raw database_connection_name)"
echo ""
echo "Next steps:"
echo "1. Initialize database with schema:"
echo "   gcloud sql connect $(terraform output -raw database_instance) --user=iterary_user < ../iterary-schema-mysql.sql"
echo ""
echo "2. Visit your application:"
echo "   $(terraform output -raw frontend_url)"
echo ""
echo "=================================="
