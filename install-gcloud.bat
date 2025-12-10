@echo off
REM ========================================
REM ITERARY - Install Google Cloud SDK
REM ========================================

echo.
echo ========================================
echo   GOOGLE CLOUD SDK INSTALLER
echo ========================================
echo.

REM Check if gcloud already installed
gcloud --version >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Google Cloud SDK already installed!
    gcloud --version
    echo.
    echo If you want to reinstall, uninstall first from Control Panel.
    pause
    exit /b 0
)

echo [INFO] Google Cloud SDK not found. Starting installation...
echo.

REM ========================================
REM Download Installer
REM ========================================
echo ========================================
echo STEP 1: Downloading Installer
echo ========================================
echo.

set INSTALLER_URL=https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe
set INSTALLER_FILE=%TEMP%\GoogleCloudSDKInstaller.exe

echo [INFO] Downloading from: %INSTALLER_URL%
echo [INFO] Saving to: %INSTALLER_FILE%
echo.

powershell -Command "& {Invoke-WebRequest -Uri '%INSTALLER_URL%' -OutFile '%INSTALLER_FILE%'}"

if not exist "%INSTALLER_FILE%" (
    echo [ERROR] Download failed!
    echo.
    echo Please download manually from:
    echo https://cloud.google.com/sdk/docs/install
    echo.
    pause
    exit /b 1
)

echo [SUCCESS] Download complete!
echo.

REM ========================================
REM Run Installer
REM ========================================
echo ========================================
echo STEP 2: Running Installer
echo ========================================
echo.

echo [INFO] Starting Google Cloud SDK installer...
echo [INFO] Please follow the installation wizard.
echo.
echo IMPORTANT:
echo - Check ALL options during installation
echo - Allow installer to update PATH
echo - Allow installer to run gcloud init
echo.

pause

start /wait "" "%INSTALLER_FILE%"

echo.
echo [INFO] Installation complete!
echo.

REM ========================================
REM Verify Installation
REM ========================================
echo ========================================
echo STEP 3: Verifying Installation
echo ========================================
echo.

echo [INFO] Please close this window and open a NEW Command Prompt.
echo.
echo Then run these commands:
echo.
echo   1. gcloud --version
echo   2. gcloud auth login
echo   3. gcloud config set project YOUR_PROJECT_ID
echo   4. cd d:\KULIAH\KomA\ITERARY
echo   5. setup-first-time.bat
echo.

pause

REM Clean up
del "%INSTALLER_FILE%" >nul 2>&1

echo.
echo ========================================
echo   INSTALLATION COMPLETE
echo ========================================
echo.
echo Next steps:
echo 1. CLOSE this Command Prompt
echo 2. OPEN a NEW Command Prompt
echo 3. Run: gcloud auth login
echo 4. Run: cd d:\KULIAH\KomA\ITERARY
echo 5. Run: setup-first-time.bat
echo.

pause
