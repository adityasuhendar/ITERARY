# 🚀 PANDUAN REDEPLOY ITERARY KE GCP

## ✅ CHECKLIST PERSIAPAN

Sebelum mulai redeploy, pastikan Anda sudah memiliki:

- [ ] Google Cloud Platform account dengan free trial aktif
- [ ] Project GCP sudah dibuat (catat PROJECT_ID)
- [ ] Google Cloud SDK (gcloud) terinstall
- [ ] Docker Desktop terinstall dan running
- [ ] Akses internet stabil

---

## 📋 LANGKAH 1: INSTALL GOOGLE CLOUD SDK (Jika Belum)

### Windows:

1. Download Google Cloud SDK:
   - URL: https://cloud.google.com/sdk/docs/install
   - Atau direct link: https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe

2. Jalankan installer dan ikuti instruksi

3. Setelah install, buka **Command Prompt baru** dan test:
   ```cmd
   gcloud --version
   ```

4. Login ke GCP:
   ```cmd
   gcloud auth login
   ```
   - Browser akan terbuka
   - Login dengan akun Google Anda
   - Authorize akses

5. Set project ID (ganti dengan PROJECT_ID Anda):
   ```cmd
   gcloud config set project YOUR_PROJECT_ID
   ```

---

## 📋 LANGKAH 2: PERSIAPAN ENVIRONMENT VARIABLES

### A. Backend Environment

1. Buka file `backend/.env` (buat jika belum ada)

2. Isi dengan konfigurasi berikut:
   ```env
   # Server Configuration
   PORT=8080
   NODE_ENV=production
   
   # Database (akan di-override oleh Terraform di Cloud Run)
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=iterary_user
   DB_PASSWORD=temporary
   DB_NAME=iterary
   
   # Redis (akan di-override oleh Terraform)
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_ENABLED=true
   
   # JWT Secret (PENTING: Ganti dengan secret Anda sendiri!)
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-12345
   JWT_EXPIRES_IN=7d
   
   # CORS
   CORS_ORIGIN=*
   ```

### B. Frontend Environment

1. Buka file `frontend/.env` (buat jika belum ada)

2. Isi dengan:
   ```env
   VITE_API_URL=https://iterary-api-XXXXXX-et.a.run.app
   ```
   
   **CATATAN:** URL ini akan kita update setelah backend di-deploy

---

## 📋 LANGKAH 3: BUILD & PUSH DOCKER IMAGES

### A. Set Project ID

```cmd
set PROJECT_ID=YOUR_PROJECT_ID_HERE
```

Ganti `YOUR_PROJECT_ID_HERE` dengan project ID GCP Anda.

### B. Enable Container Registry API

```cmd
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### C. Configure Docker untuk GCR

```cmd
gcloud auth configure-docker
```

### D. Build & Push Backend Image

```cmd
cd backend

docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-backend:latest .

docker push gcr.io/%PROJECT_ID%/iterary-backend:latest

cd ..
```

### E. Build & Push Frontend Image (Temporary)

**PENTING:** Frontend akan di-rebuild setelah kita tahu backend URL

```cmd
cd frontend

docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-frontend:latest .

docker push gcr.io/%PROJECT_ID%/iterary-frontend:latest

cd ..
```

---

## 📋 LANGKAH 4: DEPLOY DENGAN TERRAFORM

### A. Masuk ke folder Terraform

```cmd
cd terraform
```

### B. Buat file `terraform.tfvars`

Buat file baru `terraform.tfvars` dengan isi:

```hcl
project_id      = "YOUR_PROJECT_ID_HERE"
region          = "asia-southeast2"
jwt_secret      = "your-super-secret-jwt-key-change-this-in-production-12345"
backend_image   = "gcr.io/YOUR_PROJECT_ID_HERE/iterary-backend:latest"
frontend_image  = "gcr.io/YOUR_PROJECT_ID_HERE/iterary-frontend:latest"
```

**Ganti:**
- `YOUR_PROJECT_ID_HERE` dengan project ID Anda
- `jwt_secret` dengan secret yang sama seperti di backend/.env

### C. Initialize Terraform

```cmd
terraform init
```

### D. Plan Deployment (Optional - untuk preview)

```cmd
terraform plan
```

### E. Apply Deployment

```cmd
terraform apply
```

- Ketik `yes` saat diminta konfirmasi
- Tunggu ~10-15 menit untuk provisioning semua resources

### F. Catat Output URLs

Setelah selesai, Terraform akan menampilkan output seperti:

```
Outputs:

api_url = "https://iterary-api-xxxxx-et.a.run.app"
frontend_url = "https://iterary-frontend-xxxxx-et.a.run.app"
database_instance = "iterary-db-xxxxx"
redis_host = "10.x.x.x"
```

**CATAT `api_url` ini!** Kita akan gunakan untuk rebuild frontend.

---

## 📋 LANGKAH 5: REBUILD FRONTEND DENGAN API URL YANG BENAR

### A. Update Frontend .env

1. Buka `frontend/.env`

2. Update dengan API URL yang benar:
   ```env
   VITE_API_URL=https://iterary-api-xxxxx-et.a.run.app
   ```
   (Ganti dengan `api_url` dari output Terraform)

### B. Rebuild & Push Frontend

```cmd
cd ..\frontend

docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-frontend:latest .

docker push gcr.io/%PROJECT_ID%/iterary-frontend:latest
```

### C. Redeploy Frontend di Cloud Run

```cmd
gcloud run deploy iterary-frontend ^
  --image gcr.io/%PROJECT_ID%/iterary-frontend:latest ^
  --region asia-southeast2 ^
  --platform managed
```

Ketik `Y` saat ditanya konfirmasi.

---

## 📋 LANGKAH 6: IMPORT DATABASE SCHEMA

### A. Get Database Connection Info

```cmd
cd ..\terraform
terraform output database_instance
terraform output database_connection_name
```

### B. Connect ke Cloud SQL

```cmd
gcloud sql connect INSTANCE_NAME --user=iterary_user
```

Ganti `INSTANCE_NAME` dengan nama dari output.

### C. Masukkan Password

Untuk mendapatkan password:

```cmd
terraform output db_password
```

Copy password tersebut dan paste saat diminta.

### D. Import Schema

Di MySQL prompt:

```sql
USE iterary;
SOURCE ../iterary-schema-mysql.sql;
```

Atau dari command line (tanpa connect dulu):

```cmd
gcloud sql import sql INSTANCE_NAME gs://YOUR_BUCKET/iterary-schema-mysql.sql ^
  --database=iterary ^
  --user=iterary_user
```

**Alternatif - Import via Local File:**

1. Upload schema ke Cloud Storage bucket dulu
2. Atau gunakan Cloud SQL Studio di GCP Console

---

## 📋 LANGKAH 7: TESTING

### A. Test Backend API

```cmd
curl https://iterary-api-xxxxx-et.a.run.app/health
```

Expected response:
```json
{
  "success": true,
  "message": "ITERARY Backend API is running",
  "timestamp": "..."
}
```

### B. Test Get Books

```cmd
curl https://iterary-api-xxxxx-et.a.run.app/api/books
```

### C. Test Frontend

Buka browser dan akses:
```
https://iterary-frontend-xxxxx-et.a.run.app
```

### D. Test Login

**Admin Login:**
- Username: `admin`
- Password: `admin123`

**Member Registration:**
- Buat akun baru via halaman Register

---

## 🔄 REDEPLOY SETELAH CODE CHANGES

Jika Anda mengubah code dan ingin redeploy:

### Backend Changes:

```cmd
cd backend
docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-backend:latest .
docker push gcr.io/%PROJECT_ID%/iterary-backend:latest

gcloud run deploy iterary-api ^
  --image gcr.io/%PROJECT_ID%/iterary-backend:latest ^
  --region asia-southeast2 ^
  --platform managed
```

### Frontend Changes:

```cmd
cd frontend
docker build --no-cache -t gcr.io/%PROJECT_ID%/iterary-frontend:latest .
docker push gcr.io/%PROJECT_ID%/iterary-frontend:latest

gcloud run deploy iterary-frontend ^
  --image gcr.io/%PROJECT_ID%/iterary-frontend:latest ^
  --region asia-southeast2 ^
  --platform managed
```

---

## 🛠️ TROUBLESHOOTING

### Error: "gcloud not found"
- Restart Command Prompt setelah install gcloud
- Atau tambahkan ke PATH: `C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin`

### Error: "Docker daemon not running"
- Buka Docker Desktop
- Tunggu sampai status "Running"

### Error: "Permission denied" saat push image
- Jalankan: `gcloud auth configure-docker`
- Pastikan sudah login: `gcloud auth login`

### Error: "API not enabled"
- Enable manual via console atau:
  ```cmd
  gcloud services enable run.googleapis.com
  gcloud services enable sqladmin.googleapis.com
  gcloud services enable redis.googleapis.com
  gcloud services enable vpcaccess.googleapis.com
  ```

### Frontend tidak bisa connect ke Backend
- Cek CORS setting di backend
- Pastikan frontend .env memiliki API URL yang benar
- Rebuild frontend setelah update .env

### Database connection failed
- Pastikan VPC Connector sudah dibuat
- Cek Cloud Run annotation untuk VPC access
- Verify database private IP di terraform output

---

## 📊 MONITORING

### View Logs

**Backend logs:**
```cmd
gcloud run services logs read iterary-api --region asia-southeast2
```

**Frontend logs:**
```cmd
gcloud run services logs read iterary-frontend --region asia-southeast2
```

### GCP Console

1. Cloud Run: https://console.cloud.google.com/run
2. Cloud SQL: https://console.cloud.google.com/sql
3. Redis: https://console.cloud.google.com/memorystore/redis

---

## 💰 COST MONITORING

Setup budget alert:

1. Buka: https://console.cloud.google.com/billing/budgets
2. Create Budget
3. Set amount: $50
4. Set alerts: 50%, 90%, 100%
5. Add email notification

---

## 🗑️ CLEANUP (Jika Ingin Hapus Semua)

**HATI-HATI:** Ini akan menghapus semua resources!

```cmd
cd terraform
terraform destroy
```

Ketik `yes` untuk konfirmasi.

---

## 📞 SUPPORT

Jika ada masalah:

1. Cek logs di Cloud Run
2. Verify environment variables
3. Test database connection
4. Check API endpoints manually

**Good luck dengan deployment! 🚀**
