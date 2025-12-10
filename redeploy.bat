@echo off
REM ========================================
REM ITERARY - Automated Redeploy Script
REM ========================================

echo.
echo ========================================
echo   ITERARY REDEPLOY SCRIPT
echo ========================================
echo.

REM Check if PROJECT_ID is set
if "%PROJECT_ID%"=="" (
    echo [ERROR] PROJECT_ID not set!
    echo.
    echo Please set your GCP Project ID first:
    echo   set PROJECT_ID=your-project-id
    echo.
    pause
    exit /b 1
)

echo [INFO] Using Project ID: %PROJECT_ID%
echo.

REM ========================================
REM STEP 1: Build Backend
REM ========================================
echo ========================================
echo STEP 1: Building Backend Docker Image
echo ========================================
echo.

cd backend
if errorlevel 1 (
    echo [ERROR] Cannot find backend directory!
    pause
    exit /b 1
)

echo [INFO] Building backend image...
docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-backend:latest .
if errorlevel 1 (
    echo [ERROR] Backend build failed!
    cd ..
    pause
    exit /b 1
)

echo [SUCCESS] Backend image built successfully!
echo.

REM ========================================
REM STEP 2: Push Backend
REM ========================================
echo ========================================
echo STEP 2: Pushing Backend to GCR
echo ========================================
echo.

docker push gcr.io/%PROJECT_ID%/iterary-backend:latest
if errorlevel 1 (
    echo [ERROR] Backend push failed!
    echo.
    echo Make sure you are authenticated:
    echo   gcloud auth configure-docker
    cd ..
    pause
    exit /b 1
)

echo [SUCCESS] Backend pushed successfully!
echo.

cd ..

REM ========================================
REM STEP 3: Build Frontend
REM ========================================
echo ========================================
echo STEP 3: Building Frontend Docker Image
echo ========================================
echo.

cd frontend
if errorlevel 1 (
    echo [ERROR] Cannot find frontend directory!
    pause
    exit /b 1
)

echo [INFO] Building frontend image...
docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-frontend:latest .
if errorlevel 1 (
    echo [ERROR] Frontend build failed!
    cd ..
    pause
    exit /b 1
)

echo [SUCCESS] Frontend image built successfully!
echo.

REM ========================================
REM STEP 4: Push Frontend
REM ========================================
echo ========================================
echo STEP 4: Pushing Frontend to GCR
echo ========================================
echo.

docker push gcr.io/%PROJECT_ID%/iterary-frontend:latest
if errorlevel 1 (
    echo [ERROR] Frontend push failed!
    cd ..
    pause
    exit /b 1
)

echo [SUCCESS] Frontend pushed successfully!
echo.

cd ..

REM ========================================
REM STEP 5: Deploy with Cloud Run
REM ========================================
echo ========================================
echo STEP 5: Deploying to Cloud Run
echo ========================================
echo.

echo [INFO] Deploying backend...
gcloud run deploy iterary-api --image gcr.io/%PROJECT_ID%/iterary-backend:latest --region asia-southeast2 --platform managed --quiet
if errorlevel 1 (
    echo [WARNING] Backend deployment may have issues. Check logs.
)

echo.
echo [INFO] Deploying frontend...
gcloud run deploy iterary-frontend --image gcr.io/%PROJECT_ID%/iterary-frontend:latest --region asia-southeast2 --platform managed --quiet
if errorlevel 1 (
    echo [WARNING] Frontend deployment may have issues. Check logs.
)

echo.
echo ========================================
echo   DEPLOYMENT COMPLETE!
echo ========================================
echo.

echo [INFO] Getting service URLs...
echo.

gcloud run services describe iterary-api --region asia-southeast2 --format="value(status.url)"
gcloud run services describe iterary-frontend --region asia-southeast2 --format="value(status.url)"

echo.
echo ========================================
echo   Next Steps:
echo ========================================
echo.
echo 1. Test backend API health:
echo    curl [BACKEND_URL]/health
echo.
echo 2. Open frontend in browser:
echo    [FRONTEND_URL]
echo.
echo 3. Login with default admin:
echo    Username: admin
echo    Password: admin123
echo.
echo ========================================

pause
