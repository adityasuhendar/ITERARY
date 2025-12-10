# 🚀 ITERARY - Quick Redeploy Reference

## 📌 QUICK COMMANDS

### First Time Setup
```cmd
setup-first-time.bat
```

### Redeploy (After Code Changes)
```cmd
set PROJECT_ID=your-project-id
redeploy.bat
```

---

## 🔑 PREREQUISITES CHECKLIST

- [ ] Google Cloud SDK installed
- [ ] Docker Desktop running
- [ ] GCP Project created
- [ ] Billing enabled (Free trial OK)
- [ ] PROJECT_ID environment variable set

---

## 📋 MANUAL REDEPLOY STEPS

### 1. Set Project ID
```cmd
set PROJECT_ID=your-gcp-project-id
```

### 2. Build & Push Backend
```cmd
cd backend
docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-backend:latest .
docker push gcr.io/%PROJECT_ID%/iterary-backend:latest
cd ..
```

### 3. Build & Push Frontend
```cmd
cd frontend
docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-frontend:latest .
docker push gcr.io/%PROJECT_ID%/iterary-frontend:latest
cd ..
```

### 4. Deploy to Cloud Run
```cmd
gcloud run deploy iterary-api --image gcr.io/%PROJECT_ID%/iterary-backend:latest --region asia-southeast2 --platform managed

gcloud run deploy iterary-frontend --image gcr.io/%PROJECT_ID%/iterary-frontend:latest --region asia-southeast2 --platform managed
```

---

## 🔧 COMMON ISSUES & FIXES

### Issue: "gcloud not found"
**Fix:**
```cmd
# Add to PATH or restart terminal after installation
# Install from: https://cloud.google.com/sdk/docs/install
```

### Issue: "Docker daemon not running"
**Fix:**
- Open Docker Desktop
- Wait until status shows "Running"

### Issue: "Permission denied" when pushing
**Fix:**
```cmd
gcloud auth login
gcloud auth configure-docker
```

### Issue: Frontend can't connect to backend
**Fix:**
1. Get backend URL:
   ```cmd
   gcloud run services describe iterary-api --region asia-southeast2 --format="value(status.url)"
   ```

2. Update `frontend/.env`:
   ```env
   VITE_API_URL=https://iterary-api-xxxxx-et.a.run.app
   ```

3. Rebuild frontend:
   ```cmd
   cd frontend
   docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-frontend:latest .
   docker push gcr.io/%PROJECT_ID%/iterary-frontend:latest
   gcloud run deploy iterary-frontend --image gcr.io/%PROJECT_ID%/iterary-frontend:latest --region asia-southeast2 --platform managed
   ```

---

## 📊 USEFUL COMMANDS

### View Service URLs
```cmd
gcloud run services list --region asia-southeast2
```

### View Logs
```cmd
# Backend logs
gcloud run services logs read iterary-api --region asia-southeast2 --limit 50

# Frontend logs
gcloud run services logs read iterary-frontend --region asia-southeast2 --limit 50
```

### Check Service Status
```cmd
gcloud run services describe iterary-api --region asia-southeast2
gcloud run services describe iterary-frontend --region asia-southeast2
```

### Get Database Info
```cmd
cd terraform
terraform output database_instance
terraform output database_connection_name
terraform output db_password
```

### Connect to Database
```cmd
gcloud sql connect INSTANCE_NAME --user=iterary_user
```

### List Docker Images in GCR
```cmd
gcloud container images list --repository=gcr.io/%PROJECT_ID%
```

### Delete Old Images (Save Storage Costs)
```cmd
gcloud container images delete gcr.io/%PROJECT_ID%/iterary-backend:old-tag --quiet
```

---

## 🗄️ DATABASE MANAGEMENT

### Import Schema (First Time)
```cmd
# Option 1: Via gcloud
gcloud sql connect INSTANCE_NAME --user=iterary_user

# Then in MySQL:
USE iterary;
SOURCE iterary-schema-mysql.sql;
```

### Backup Database
```cmd
gcloud sql export sql INSTANCE_NAME gs://YOUR_BUCKET/backup.sql --database=iterary
```

### Restore Database
```cmd
gcloud sql import sql INSTANCE_NAME gs://YOUR_BUCKET/backup.sql --database=iterary
```

---

## 💰 COST MANAGEMENT

### View Current Costs
```cmd
gcloud billing accounts list
gcloud billing projects describe %PROJECT_ID%
```

### Set Budget Alert
1. Go to: https://console.cloud.google.com/billing/budgets
2. Create budget: $50/month
3. Set alerts: 50%, 90%, 100%

### Stop Database (Development Only)
```cmd
# Stop to save costs
gcloud sql instances patch INSTANCE_NAME --activation-policy=NEVER

# Start again
gcloud sql instances patch INSTANCE_NAME --activation-policy=ALWAYS
```

---

## 🧹 CLEANUP

### Delete Everything (Careful!)
```cmd
cd terraform
terraform destroy
```

### Delete Specific Service
```cmd
gcloud run services delete iterary-api --region asia-southeast2
gcloud run services delete iterary-frontend --region asia-southeast2
```

---

## 📱 TESTING ENDPOINTS

### Health Check
```cmd
curl https://iterary-api-xxxxx-et.a.run.app/health
```

### Get Books
```cmd
curl https://iterary-api-xxxxx-et.a.run.app/api/books
```

### Admin Login
```cmd
curl -X POST https://iterary-api-xxxxx-et.a.run.app/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

---

## 🔐 DEFAULT CREDENTIALS

### Admin Account
- Username: `admin`
- Password: `admin123`

### Member Account
- Register via frontend: `/register`
- Or create manually in database

---

## 📞 SUPPORT LINKS

- **GCP Console:** https://console.cloud.google.com
- **Cloud Run:** https://console.cloud.google.com/run
- **Cloud SQL:** https://console.cloud.google.com/sql
- **Container Registry:** https://console.cloud.google.com/gcr
- **Billing:** https://console.cloud.google.com/billing

---

## 🎯 DEPLOYMENT CHECKLIST

### Before Deployment
- [ ] Docker Desktop running
- [ ] gcloud authenticated (`gcloud auth login`)
- [ ] Project ID set (`set PROJECT_ID=...`)
- [ ] APIs enabled
- [ ] Docker configured for GCR (`gcloud auth configure-docker`)

### After Deployment
- [ ] Test backend health endpoint
- [ ] Test frontend loads
- [ ] Import database schema
- [ ] Test admin login
- [ ] Test member registration
- [ ] Set up billing alerts
- [ ] Save database password

### Regular Maintenance
- [ ] Monitor costs weekly
- [ ] Check logs for errors
- [ ] Backup database monthly
- [ ] Update dependencies quarterly
- [ ] Review security settings

---

**Last Updated:** December 2024
**Version:** 1.0.0
