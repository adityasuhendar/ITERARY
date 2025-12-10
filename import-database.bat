@echo off
REM ========================================
REM ITERARY - Database Import Helper
REM ========================================

echo.
echo ========================================
echo   ITERARY - DATABASE IMPORT
echo ========================================
echo.

REM Check if PROJECT_ID is set
if "%PROJECT_ID%"=="" (
    echo [ERROR] PROJECT_ID not set!
    echo.
    set /p PROJECT_ID="Enter your GCP Project ID: "
)

echo [INFO] Using Project ID: %PROJECT_ID%
echo.

REM ========================================
REM Get Database Instance Name
REM ========================================
echo [INFO] Getting database instance name...
cd terraform

for /f "delims=" %%i in ('terraform output -raw database_instance 2^>nul') do set DB_INSTANCE=%%i

if "%DB_INSTANCE%"=="" (
    echo [ERROR] Cannot get database instance name!
    echo.
    echo Make sure Terraform has been applied successfully.
    echo.
    pause
    exit /b 1
)

echo [INFO] Database Instance: %DB_INSTANCE%
echo.

REM ========================================
REM Get Database Password
REM ========================================
echo [INFO] Getting database password...
for /f "delims=" %%i in ('terraform output -raw db_password 2^>nul') do set DB_PASSWORD=%%i

echo [INFO] Database Password: %DB_PASSWORD%
echo [INFO] (Save this password for future use!)
echo.

cd ..

REM ========================================
REM Option Selection
REM ========================================
echo ========================================
echo   IMPORT OPTIONS
echo ========================================
echo.
echo 1. Import via Cloud SQL Proxy (Recommended)
echo 2. Import via gcloud sql connect
echo 3. Import via Cloud Console (Manual)
echo.
set /p OPTION="Select option (1-3): "

if "%OPTION%"=="1" goto PROXY_IMPORT
if "%OPTION%"=="2" goto GCLOUD_IMPORT
if "%OPTION%"=="3" goto CONSOLE_IMPORT

echo [ERROR] Invalid option!
pause
exit /b 1

REM ========================================
REM Option 1: Cloud SQL Proxy
REM ========================================
:PROXY_IMPORT
echo.
echo ========================================
echo   CLOUD SQL PROXY IMPORT
echo ========================================
echo.

echo [INFO] Downloading Cloud SQL Proxy...
curl -o cloud_sql_proxy.exe https://dl.google.com/cloudsql/cloud_sql_proxy_x64.exe

echo.
echo [INFO] Getting connection name...
cd terraform
for /f "delims=" %%i in ('terraform output -raw database_connection_name') do set CONNECTION_NAME=%%i
cd ..

echo [INFO] Connection Name: %CONNECTION_NAME%
echo.

echo [INFO] Starting Cloud SQL Proxy...
echo [INFO] Keep this window open!
echo.

start "Cloud SQL Proxy" cloud_sql_proxy.exe -instances=%CONNECTION_NAME%=tcp:3306

timeout /t 5 /nobreak >nul

echo.
echo [INFO] Now you can connect to MySQL at localhost:3306
echo.
echo Run this command in a NEW terminal:
echo.
echo mysql -h 127.0.0.1 -u iterary_user -p iterary ^< iterary-schema-mysql.sql
echo.
echo Password: %DB_PASSWORD%
echo.
echo Press any key when done...
pause >nul

taskkill /FI "WINDOWTITLE eq Cloud SQL Proxy*" /F >nul 2>&1

goto END

REM ========================================
REM Option 2: gcloud sql connect
REM ========================================
:GCLOUD_IMPORT
echo.
echo ========================================
echo   GCLOUD SQL CONNECT
echo ========================================
echo.

echo [INFO] Connecting to Cloud SQL...
echo [INFO] Password: %DB_PASSWORD%
echo.
echo After connecting, run these commands:
echo   USE iterary;
echo   SOURCE iterary-schema-mysql.sql;
echo   EXIT;
echo.
pause

gcloud sql connect %DB_INSTANCE% --user=iterary_user

goto END

REM ========================================
REM Option 3: Cloud Console
REM ========================================
:CONSOLE_IMPORT
echo.
echo ========================================
echo   CLOUD CONSOLE IMPORT
echo ========================================
echo.

echo [INFO] Follow these steps:
echo.
echo 1. Go to Cloud SQL in GCP Console:
echo    https://console.cloud.google.com/sql/instances/%DB_INSTANCE%/overview?project=%PROJECT_ID%
echo.
echo 2. Click "IMPORT" button
echo.
echo 3. Upload iterary-schema-mysql.sql
echo.
echo 4. Database: iterary
echo.
echo 5. User: iterary_user
echo.
echo 6. Click "IMPORT"
echo.
echo Database Password: %DB_PASSWORD%
echo.

start https://console.cloud.google.com/sql/instances/%DB_INSTANCE%/overview?project=%PROJECT_ID%

goto END

REM ========================================
REM End
REM ========================================
:END
echo.
echo ========================================
echo   DATABASE IMPORT COMPLETE
echo ========================================
echo.

echo [INFO] Verify import by testing:
echo.
echo 1. Test API endpoint:
echo    curl https://iterary-api-xxxxx.run.app/api/books
echo.
echo 2. Login to frontend:
echo    Username: admin
echo    Password: admin123
echo.

pause
