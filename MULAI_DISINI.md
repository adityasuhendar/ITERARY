# 🚀 MULAI DEPLOYMENT - LANGKAH SIMPEL

## ❌ LUPAKAN SEMUA FILE LAIN - IKUTI INI SAJA!

---

## LANGKAH 1: INSTALL GOOGLE CLOUD SDK

### Cara Manual (PALING MUDAH):

1. **Buka browser, download installer:**
   
   **Link:** https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe
   
   Atau kunjungi: https://cloud.google.com/sdk/docs/install

2. **Double-click file yang didownload** (`GoogleCloudSDKInstaller.exe`)

3. **Ikuti wizard:**
   - Klik "Next" → "Next" → "Install"
   - Centang semua opsi
   - Tunggu ~5 menit

4. **Setelah install selesai:**
   - Akan muncul terminal hitam (Google Cloud SDK Shell)
   - Ikuti prompt yang muncul
   - Login saat diminta (browser akan terbuka)

5. **Verify:**
   - Buka **Command Prompt BARU**
   - Ketik: `gcloud --version`
   - Jika muncul versi → Berhasil!

---

## LANGKAH 2: BUAT/PILIH PROJECT GCP

1. **Buka:** https://console.cloud.google.com

2. **Klik "Select a project"** (di atas, sebelah logo GCP)

3. **Klik "NEW PROJECT"**
   - Project name: `iterary-library`
   - Klik "CREATE"
   - **CATAT PROJECT ID** yang muncul (contoh: `iterary-library-123456`)

4. **Enable Billing:**
   - Klik menu ☰ → "Billing"
   - Link project dengan billing account
   - Gunakan free trial ($300)

---

## LANGKAH 3: SETUP MANUAL (TANPA SCRIPT)

Buka **Command Prompt** dan jalankan satu per satu:

### A. Login & Set Project

```cmd
gcloud auth login
```
(Browser akan terbuka, login dan allow)

```cmd
gcloud config set project YOUR_PROJECT_ID
```
(Ganti YOUR_PROJECT_ID dengan project ID Anda)

### B. Enable APIs

```cmd
gcloud services enable compute.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable vpcaccess.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable servicenetworking.googleapis.com
```

### C. Configure Docker

```cmd
gcloud auth configure-docker
```

### D. Set Project ID Variable

```cmd
set PROJECT_ID=your-project-id-here
```
(Ganti dengan project ID Anda)

---

## LANGKAH 4: BUILD & DEPLOY

### A. Navigate ke folder

```cmd
cd d:\KULIAH\KomA\ITERARY
```

### B. Build Backend

```cmd
cd backend
docker build -t gcr.io/%PROJECT_ID%/iterary-backend:latest .
docker push gcr.io/%PROJECT_ID%/iterary-backend:latest
cd ..
```

### C. Build Frontend (Temporary)

```cmd
cd frontend
docker build -t gcr.io/%PROJECT_ID%/iterary-frontend:latest .
docker push gcr.io/%PROJECT_ID%/iterary-frontend:latest
cd ..
```

### D. Deploy Infrastructure

```cmd
cd terraform
```

**Buat file `terraform.tfvars`** dengan isi:

```
project_id      = "your-project-id"
region          = "asia-southeast2"
jwt_secret      = "iterary-secret-key-12345"
backend_image   = "gcr.io/your-project-id/iterary-backend:latest"
frontend_image  = "gcr.io/your-project-id/iterary-frontend:latest"
```

Ganti `your-project-id` dengan project ID Anda!

**Jalankan Terraform:**

```cmd
terraform init
terraform apply
```

Ketik `yes` saat diminta.

Tunggu ~15 menit.

---

## LANGKAH 5: UPDATE FRONTEND

Setelah Terraform selesai, catat **Backend URL** yang muncul.

```cmd
cd ..\frontend
```

**Edit file `.env`:**

```
VITE_API_URL=https://iterary-api-xxxxx-et.a.run.app
```

Ganti dengan Backend URL Anda!

**Rebuild & Deploy:**

```cmd
docker build -t gcr.io/%PROJECT_ID%/iterary-frontend:latest .
docker push gcr.io/%PROJECT_ID%/iterary-frontend:latest

gcloud run deploy iterary-frontend --image gcr.io/%PROJECT_ID%/iterary-frontend:latest --region asia-southeast2 --platform managed
```

---

## LANGKAH 6: IMPORT DATABASE

```cmd
cd ..\terraform
terraform output database_instance
```

Catat nama instance.

```cmd
gcloud sql connect INSTANCE_NAME --user=iterary_user
```

Masukkan password (lihat dari `terraform output db_password`)

Di MySQL prompt:

```sql
USE iterary;
SOURCE ../iterary-schema-mysql.sql;
EXIT;
```

---

## SELESAI! 🎉

**Test aplikasi:**
- Buka Frontend URL di browser
- Login: `admin` / `admin123`

---

## ATAU... PAKAI SCRIPT (Jika sudah install gcloud)

Jika gcloud sudah terinstall, cukup:

```cmd
cd d:\KULIAH\KomA\ITERARY
set PROJECT_ID=your-project-id
setup-first-time.bat
```

---

**Pilih cara mana yang Anda mau. Semua cara akan sampai ke hasil yang sama!**
