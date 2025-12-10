# 🚀 ITERARY Deployment Scripts

Kumpulan script untuk mempermudah deployment ITERARY ke Google Cloud Platform.

## 📁 Files Overview

| File | Purpose | When to Use |
|------|---------|-------------|
| `setup-first-time.bat` | Complete first-time setup | First deployment |
| `redeploy.bat` | Quick redeploy after code changes | After editing code |
| `import-database.bat` | Import database schema | After first deployment |
| `REDEPLOY_GUIDE.md` | Detailed deployment guide | Reference documentation |
| `QUICK_REFERENCE.md` | Quick command reference | Daily operations |

---

## 🎯 Quick Start Guide

### First Time Deployment

1. **Install Prerequisites:**
   - Google Cloud SDK: https://cloud.google.com/sdk/docs/install
   - Docker Desktop: https://www.docker.com/products/docker-desktop

2. **Run Setup Script:**
   ```cmd
   setup-first-time.bat
   ```
   
   This script will:
   - ✅ Check prerequisites
   - ✅ Enable GCP APIs
   - ✅ Configure Docker for GCR
   - ✅ Generate JWT secret
   - ✅ Create configuration files
   - ✅ Build Docker images
   - ✅ Deploy to Cloud Run
   - ✅ Setup database

3. **Import Database:**
   ```cmd
   import-database.bat
   ```
   
   Choose your preferred method:
   - Option 1: Cloud SQL Proxy (Recommended)
   - Option 2: gcloud sql connect
   - Option 3: Cloud Console (Manual)

4. **Test Application:**
   - Open frontend URL in browser
   - Login with: `admin` / `admin123`

---

### Redeploy After Code Changes

1. **Set Project ID:**
   ```cmd
   set PROJECT_ID=your-project-id
   ```

2. **Run Redeploy Script:**
   ```cmd
   redeploy.bat
   ```
   
   This will:
   - ✅ Build new Docker images
   - ✅ Push to Container Registry
   - ✅ Deploy to Cloud Run
   - ✅ Show service URLs

---

## 📋 Detailed Instructions

### setup-first-time.bat

**What it does:**
- Checks for gcloud and Docker installation
- Prompts for GCP Project ID
- Enables all required GCP APIs
- Configures Docker authentication
- Generates secure JWT secret
- Creates `terraform.tfvars` with your settings
- Creates backend and frontend `.env` files
- Builds Docker images for both services
- Pushes images to Google Container Registry
- Deploys infrastructure with Terraform
- Rebuilds frontend with correct backend URL
- Displays all service URLs and credentials

**Prerequisites:**
- Google Cloud SDK installed
- Docker Desktop installed and running
- GCP account with billing enabled
- GCP project created

**Usage:**
```cmd
setup-first-time.bat
```

**Expected Duration:** 15-20 minutes

**What you'll need:**
- Your GCP Project ID

**Output:**
- Frontend URL
- Backend API URL
- Database instance name
- Database password (save this!)

---

### redeploy.bat

**What it does:**
- Builds fresh Docker images (no cache)
- Pushes images to GCR
- Deploys updated services to Cloud Run
- Shows updated service URLs

**Prerequisites:**
- First-time setup completed
- PROJECT_ID environment variable set
- Code changes committed

**Usage:**
```cmd
set PROJECT_ID=your-project-id
redeploy.bat
```

**Expected Duration:** 5-10 minutes

**When to use:**
- After changing backend code
- After changing frontend code
- After updating dependencies
- After fixing bugs

---

### import-database.bat

**What it does:**
- Gets database instance info from Terraform
- Retrieves database password
- Offers 3 import methods
- Guides you through the import process

**Prerequisites:**
- Infrastructure deployed (setup-first-time.bat completed)
- Database schema file: `iterary-schema-mysql.sql`

**Usage:**
```cmd
import-database.bat
```

**Import Methods:**

**Option 1: Cloud SQL Proxy (Recommended)**
- Downloads Cloud SQL Proxy
- Starts local proxy on port 3306
- Allows local MySQL client connection
- Best for: Developers familiar with MySQL CLI

**Option 2: gcloud sql connect**
- Uses gcloud CLI to connect
- Interactive MySQL session
- Best for: Quick imports, no extra tools needed

**Option 3: Cloud Console (Manual)**
- Opens GCP Console in browser
- Upload SQL file via web interface
- Best for: Non-technical users, GUI preference

---

## 🔧 Troubleshooting

### "gcloud not found"

**Problem:** Google Cloud SDK not installed or not in PATH

**Solution:**
1. Install from: https://cloud.google.com/sdk/docs/install
2. Restart Command Prompt
3. Verify: `gcloud --version`

---

### "Docker daemon not running"

**Problem:** Docker Desktop not started

**Solution:**
1. Open Docker Desktop
2. Wait for "Running" status
3. Verify: `docker --version`

---

### "Permission denied" when pushing images

**Problem:** Docker not authenticated with GCR

**Solution:**
```cmd
gcloud auth login
gcloud auth configure-docker
```

---

### "API not enabled"

**Problem:** Required GCP APIs not enabled

**Solution:**
```cmd
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable redis.googleapis.com
```

Or run `setup-first-time.bat` which enables all APIs.

---

### Frontend shows "Network Error"

**Problem:** Frontend trying to connect to wrong backend URL

**Solution:**
1. Get backend URL:
   ```cmd
   cd terraform
   terraform output api_url
   ```

2. Update `frontend/.env`:
   ```env
   VITE_API_URL=https://your-backend-url.run.app
   ```

3. Rebuild frontend:
   ```cmd
   cd frontend
   docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-frontend:latest .
   docker push gcr.io/%PROJECT_ID%/iterary-frontend:latest
   gcloud run deploy iterary-frontend --image gcr.io/%PROJECT_ID%/iterary-frontend:latest --region asia-southeast2 --platform managed
   ```

---

### Database import fails

**Problem:** Connection timeout or authentication error

**Solutions:**

1. **Check database is running:**
   ```cmd
   gcloud sql instances list
   ```

2. **Verify password:**
   ```cmd
   cd terraform
   terraform output db_password
   ```

3. **Try different import method:**
   - Use Cloud Console (Option 3) if CLI methods fail
   - Check firewall rules in GCP Console

---

## 💡 Tips & Best Practices

### Development Workflow

1. **Make code changes locally**
2. **Test locally** (optional):
   ```cmd
   cd backend
   npm run dev
   ```
3. **Commit changes to Git**
4. **Redeploy:**
   ```cmd
   set PROJECT_ID=your-project-id
   redeploy.bat
   ```
5. **Test in production**

---

### Cost Optimization

1. **Set budget alerts:**
   - Go to: https://console.cloud.google.com/billing/budgets
   - Set limit: $50/month
   - Enable email notifications

2. **Stop database when not in use** (development only):
   ```cmd
   gcloud sql instances patch INSTANCE_NAME --activation-policy=NEVER
   ```

3. **Delete old Docker images:**
   ```cmd
   gcloud container images list --repository=gcr.io/%PROJECT_ID%
   gcloud container images delete gcr.io/%PROJECT_ID%/iterary-backend:old-tag
   ```

---

### Monitoring

**View logs:**
```cmd
# Backend
gcloud run services logs read iterary-api --region asia-southeast2 --limit 50

# Frontend
gcloud run services logs read iterary-frontend --region asia-southeast2 --limit 50
```

**Check service status:**
```cmd
gcloud run services describe iterary-api --region asia-southeast2
```

**Monitor costs:**
- Dashboard: https://console.cloud.google.com/billing

---

## 🗑️ Cleanup

### Delete Everything

**Warning:** This will delete all resources and data!

```cmd
cd terraform
terraform destroy
```

Type `yes` to confirm.

---

## 📞 Support

### Documentation Files

- `REDEPLOY_GUIDE.md` - Comprehensive deployment guide
- `QUICK_REFERENCE.md` - Quick command reference
- `README.md` - Project overview
- `API_SPEC.md` - API documentation

### GCP Console Links

- **Cloud Run:** https://console.cloud.google.com/run
- **Cloud SQL:** https://console.cloud.google.com/sql
- **Container Registry:** https://console.cloud.google.com/gcr
- **Billing:** https://console.cloud.google.com/billing

---

## ✅ Deployment Checklist

### Before Running Scripts

- [ ] Google Cloud SDK installed
- [ ] Docker Desktop installed and running
- [ ] GCP account created
- [ ] Billing enabled (free trial OK)
- [ ] GCP project created
- [ ] Project ID noted down

### After First Deployment

- [ ] Frontend URL accessible
- [ ] Backend API responding
- [ ] Database schema imported
- [ ] Admin login works
- [ ] Member registration works
- [ ] Budget alerts configured
- [ ] Database password saved

### Regular Maintenance

- [ ] Monitor costs weekly
- [ ] Check logs for errors
- [ ] Backup database monthly
- [ ] Update dependencies quarterly

---

**Version:** 1.0.0  
**Last Updated:** December 2024  
**Maintained by:** ITERARY Team - ITERA
