@echo off
REM ========================================
REM ITERARY - First Time Deployment Setup
REM ========================================

echo.
echo ========================================
echo   ITERARY - FIRST TIME SETUP
echo ========================================
echo.

REM ========================================
REM STEP 1: Check Prerequisites
REM ========================================
echo ========================================
echo STEP 1: Checking Prerequisites
echo ========================================
echo.

echo [INFO] Checking gcloud...
gcloud --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] gcloud CLI not found!
    echo.
    echo Please install Google Cloud SDK:
    echo https://cloud.google.com/sdk/docs/install
    echo.
    pause
    exit /b 1
)
echo [OK] gcloud CLI installed

echo [INFO] Checking docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker not found!
    echo.
    echo Please install Docker Desktop:
    echo https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)
echo [OK] Docker installed

echo.

REM ========================================
REM STEP 2: Get Project ID
REM ========================================
echo ========================================
echo STEP 2: Project Configuration
echo ========================================
echo.

set /p PROJECT_ID="Enter your GCP Project ID: "

if "%PROJECT_ID%"=="" (
    echo [ERROR] Project ID cannot be empty!
    pause
    exit /b 1
)

echo [INFO] Setting project: %PROJECT_ID%
gcloud config set project %PROJECT_ID%

echo.

REM ========================================
REM STEP 3: Enable APIs
REM ========================================
echo ========================================
echo STEP 3: Enabling Required APIs
echo ========================================
echo.

echo [INFO] This may take a few minutes...
echo.

gcloud services enable compute.googleapis.com
gcloud services enable cloudapis.googleapis.com
gcloud services enable vpcaccess.googleapis.com
gcloud services enable servicenetworking.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable sql-component.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable containerregistry.googleapis.com

echo [SUCCESS] All APIs enabled!
echo.

REM ========================================
REM STEP 4: Configure Docker
REM ========================================
echo ========================================
echo STEP 4: Configuring Docker for GCR
echo ========================================
echo.

gcloud auth configure-docker
echo [SUCCESS] Docker configured!
echo.

REM ========================================
REM STEP 5: Generate JWT Secret
REM ========================================
echo ========================================
echo STEP 5: Generating JWT Secret
echo ========================================
echo.

REM Generate random JWT secret
set JWT_SECRET=iterary-jwt-secret-%RANDOM%%RANDOM%%RANDOM%
echo [INFO] Generated JWT Secret: %JWT_SECRET%
echo.

REM ========================================
REM STEP 6: Create terraform.tfvars
REM ========================================
echo ========================================
echo STEP 6: Creating Terraform Config
echo ========================================
echo.

cd terraform

echo project_id      = "%PROJECT_ID%" > terraform.tfvars
echo region          = "asia-southeast2" >> terraform.tfvars
echo jwt_secret      = "%JWT_SECRET%" >> terraform.tfvars
echo backend_image   = "gcr.io/%PROJECT_ID%/iterary-backend:latest" >> terraform.tfvars
echo frontend_image  = "gcr.io/%PROJECT_ID%/iterary-frontend:latest" >> terraform.tfvars

echo [SUCCESS] terraform.tfvars created!
echo.

REM ========================================
REM STEP 7: Create Backend .env
REM ========================================
echo ========================================
echo STEP 7: Creating Backend Environment
echo ========================================
echo.

cd ..\backend

echo # Server Configuration > .env
echo PORT=8080 >> .env
echo NODE_ENV=production >> .env
echo. >> .env
echo # Database (will be overridden by Terraform) >> .env
echo DB_HOST=localhost >> .env
echo DB_PORT=3306 >> .env
echo DB_USER=iterary_user >> .env
echo DB_PASSWORD=temporary >> .env
echo DB_NAME=iterary >> .env
echo. >> .env
echo # Redis >> .env
echo REDIS_HOST=localhost >> .env
echo REDIS_PORT=6379 >> .env
echo REDIS_ENABLED=true >> .env
echo. >> .env
echo # JWT Secret >> .env
echo JWT_SECRET=%JWT_SECRET% >> .env
echo JWT_EXPIRES_IN=7d >> .env
echo. >> .env
echo # CORS >> .env
echo CORS_ORIGIN=* >> .env

echo [SUCCESS] backend/.env created!
echo.

REM ========================================
REM STEP 8: Create Frontend .env (temporary)
REM ========================================
echo ========================================
echo STEP 8: Creating Frontend Environment
echo ========================================
echo.

cd ..\frontend

echo VITE_API_URL=http://localhost:8080 > .env

echo [SUCCESS] frontend/.env created (will be updated after backend deploy)!
echo.

cd ..

REM ========================================
REM STEP 9: Build Docker Images
REM ========================================
echo ========================================
echo STEP 9: Building Docker Images
echo ========================================
echo.

echo [INFO] Building backend...
cd backend
docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-backend:latest .
if errorlevel 1 (
    echo [ERROR] Backend build failed!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [INFO] Building frontend (temporary)...
cd frontend
docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-frontend:latest .
if errorlevel 1 (
    echo [ERROR] Frontend build failed!
    cd ..
    pause
    exit /b 1
)
cd ..

echo [SUCCESS] Docker images built!
echo.

REM ========================================
REM STEP 10: Push Images
REM ========================================
echo ========================================
echo STEP 10: Pushing Images to GCR
echo ========================================
echo.

echo [INFO] Pushing backend...
docker push gcr.io/%PROJECT_ID%/iterary-backend:latest
if errorlevel 1 (
    echo [ERROR] Backend push failed!
    pause
    exit /b 1
)

echo.
echo [INFO] Pushing frontend...
docker push gcr.io/%PROJECT_ID%/iterary-frontend:latest
if errorlevel 1 (
    echo [ERROR] Frontend push failed!
    pause
    exit /b 1
)

echo [SUCCESS] Images pushed!
echo.

REM ========================================
REM STEP 11: Deploy with Terraform
REM ========================================
echo ========================================
echo STEP 11: Deploying Infrastructure
echo ========================================
echo.

cd terraform

echo [INFO] Initializing Terraform...
terraform init

echo.
echo [INFO] Planning deployment...
terraform plan

echo.
echo [WARNING] This will create resources in GCP!
echo [WARNING] Estimated cost: ~$24/month (covered by free trial)
echo.
set /p CONFIRM="Continue with deployment? (yes/no): "

if not "%CONFIRM%"=="yes" (
    echo [INFO] Deployment cancelled.
    cd ..
    pause
    exit /b 0
)

echo.
echo [INFO] Applying Terraform configuration...
echo [INFO] This will take 10-15 minutes...
echo.

terraform apply -auto-approve

if errorlevel 1 (
    echo [ERROR] Terraform deployment failed!
    cd ..
    pause
    exit /b 1
)

echo [SUCCESS] Infrastructure deployed!
echo.

REM ========================================
REM STEP 12: Get Backend URL
REM ========================================
echo ========================================
echo STEP 12: Getting Service URLs
echo ========================================
echo.

echo [INFO] Extracting backend URL...
for /f "delims=" %%i in ('terraform output -raw api_url') do set BACKEND_URL=%%i

echo Backend URL: %BACKEND_URL%
echo.

cd ..

REM ========================================
REM STEP 13: Rebuild Frontend with Correct URL
REM ========================================
echo ========================================
echo STEP 13: Rebuilding Frontend
echo ========================================
echo.

cd frontend

echo VITE_API_URL=%BACKEND_URL% > .env

echo [INFO] Rebuilding frontend with correct API URL...
docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-frontend:latest .

echo [INFO] Pushing updated frontend...
docker push gcr.io/%PROJECT_ID%/iterary-frontend:latest

echo [INFO] Redeploying frontend...
gcloud run deploy iterary-frontend --image gcr.io/%PROJECT_ID%/iterary-frontend:latest --region asia-southeast2 --platform managed --quiet

cd ..

echo [SUCCESS] Frontend redeployed with correct API URL!
echo.

REM ========================================
REM STEP 14: Display Results
REM ========================================
echo ========================================
echo   DEPLOYMENT COMPLETE!
echo ========================================
echo.

cd terraform

echo Frontend URL:
terraform output frontend_url

echo.
echo Backend API URL:
terraform output api_url

echo.
echo Database Instance:
terraform output database_instance

echo.
echo [INFO] Database Password (save this!):
terraform output db_password

echo.
echo ========================================
echo   NEXT STEPS
echo ========================================
echo.
echo 1. Import database schema:
echo    - Go to Cloud SQL in GCP Console
echo    - Connect to instance
echo    - Import iterary-schema-mysql.sql
echo.
echo 2. Test the application:
echo    - Open frontend URL in browser
echo    - Login with: admin / admin123
echo.
echo 3. Monitor costs:
echo    - Set up billing alerts in GCP Console
echo    - Budget: $50/month recommended
echo.
echo ========================================

cd ..

echo.
echo [INFO] Setup complete! Press any key to exit...
pause >nul
