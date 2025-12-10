# 🚀 LANGKAH DEPLOYMENT ITERARY - PANDUAN UNTUK ANDA

## ✅ STATUS SAAT INI

- ✅ **Docker**: Terinstall (version 28.3.3)
- ❌ **Google Cloud SDK**: Belum terinstall
- ⏳ **Status**: Perlu install gcloud CLI dulu

---

## 📋 LANGKAH 1: INSTALL GOOGLE CLOUD SDK

### Cara Install (Windows):

1. **Download Installer:**
   - Klik link ini: https://dl.google.com/dl/cloudsql/cloud_sql_proxy_x64.exe
   - Atau buka: https://cloud.google.com/sdk/docs/install
   - Download "Google Cloud SDK Installer"

2. **Jalankan Installer:**
   - Double-click file yang didownload
   - Ikuti wizard instalasi
   - **PENTING**: Centang semua opsi yang ditawarkan
   - Tunggu sampai selesai (~5 menit)

3. **Restart Command Prompt:**
   - Tutup semua Command Prompt yang terbuka
   - Buka Command Prompt BARU
   - Test dengan: `gcloud --version`

4. **Login ke GCP:**
   ```cmd
   gcloud auth login
   ```
   - Browser akan terbuka
   - Login dengan akun Google Anda
   - Klik "Allow" untuk authorize

5. **Set Project:**
   ```cmd
   gcloud config set project YOUR_PROJECT_ID
   ```
   Ganti `YOUR_PROJECT_ID` dengan Project ID GCP Anda

---

## 📋 LANGKAH 2: PERSIAPAN PROJECT ID

Sebelum menjalankan script, Anda perlu:

1. **Buat Project di GCP** (jika belum):
   - Buka: https://console.cloud.google.com
   - Klik "Select a project" → "NEW PROJECT"
   - Project name: `iterary-library`
   - Klik "CREATE"
   - **CATAT PROJECT ID** yang muncul (biasanya: `iterary-library-xxxxx`)

2. **Enable Billing**:
   - Go to: https://console.cloud.google.com/billing
   - Link project dengan billing account
   - Gunakan free trial ($300 credit)

---

## 📋 LANGKAH 3: JALANKAN DEPLOYMENT

Setelah gcloud terinstall dan sudah login:

### Opsi A: Automatic Setup (RECOMMENDED)

```cmd
cd d:\KULIAH\KomA\ITERARY
setup-first-time.bat
```

Script akan otomatis:
- Check prerequisites
- Enable APIs
- Build images
- Deploy to GCP
- Setup database

### Opsi B: Manual Step-by-Step

Jika automatic setup gagal, ikuti langkah manual:

#### 1. Set Project ID
```cmd
set PROJECT_ID=your-project-id-here
```

#### 2. Enable APIs
```cmd
gcloud services enable compute.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable vpcaccess.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

#### 3. Configure Docker
```cmd
gcloud auth configure-docker
```

#### 4. Build Backend
```cmd
cd backend
docker build -t gcr.io/%PROJECT_ID%/iterary-backend:latest .
docker push gcr.io/%PROJECT_ID%/iterary-backend:latest
cd ..
```

#### 5. Build Frontend (Temporary)
```cmd
cd frontend
docker build -t gcr.io/%PROJECT_ID%/iterary-frontend:latest .
docker push gcr.io/%PROJECT_ID%/iterary-frontend:latest
cd ..
```

#### 6. Deploy with Terraform
```cmd
cd terraform

REM Create terraform.tfvars
echo project_id = "YOUR_PROJECT_ID" > terraform.tfvars
echo region = "asia-southeast2" >> terraform.tfvars
echo jwt_secret = "your-secret-key-12345" >> terraform.tfvars
echo backend_image = "gcr.io/YOUR_PROJECT_ID/iterary-backend:latest" >> terraform.tfvars
echo frontend_image = "gcr.io/YOUR_PROJECT_ID/iterary-frontend:latest" >> terraform.tfvars

REM Initialize and apply
terraform init
terraform apply
```

#### 7. Get Backend URL
```cmd
terraform output api_url
```

#### 8. Rebuild Frontend with Correct URL
```cmd
cd ..\frontend

REM Update .env
echo VITE_API_URL=https://your-backend-url.run.app > .env

REM Rebuild
docker build -t gcr.io/%PROJECT_ID%/iterary-frontend:latest .
docker push gcr.io/%PROJECT_ID%/iterary-frontend:latest

REM Redeploy
gcloud run deploy iterary-frontend --image gcr.io/%PROJECT_ID%/iterary-frontend:latest --region asia-southeast2 --platform managed
```

#### 9. Import Database
```cmd
cd ..
import-database.bat
```

---

## 🎯 CHECKLIST SEBELUM MULAI

Pastikan Anda sudah:

- [ ] Punya akun Google
- [ ] Buat project di GCP Console
- [ ] Catat Project ID
- [ ] Enable billing (free trial OK)
- [ ] Install Google Cloud SDK
- [ ] Login dengan `gcloud auth login`
- [ ] Docker Desktop running
- [ ] Koneksi internet stabil

---

## ⏱️ ESTIMASI WAKTU

- Install gcloud SDK: ~5 menit
- Setup & login: ~3 menit
- Build images: ~10 menit
- Terraform deploy: ~15 menit
- Import database: ~2 menit
- **TOTAL: ~35-40 menit**

---

## 🆘 JIKA ADA ERROR

### Error: "gcloud not found" setelah install
**Fix:** Restart Command Prompt atau restart komputer

### Error: "Docker daemon not running"
**Fix:** Buka Docker Desktop, tunggu sampai status "Running"

### Error: "Permission denied"
**Fix:** 
```cmd
gcloud auth login
gcloud auth configure-docker
```

### Error: "API not enabled"
**Fix:** Enable manual di console atau jalankan enable commands di atas

---

## 📞 NEXT STEPS SETELAH INSTALL GCLOUD

Setelah Google Cloud SDK terinstall:

1. **Buka Command Prompt BARU**
2. **Test gcloud:**
   ```cmd
   gcloud --version
   ```
3. **Login:**
   ```cmd
   gcloud auth login
   ```
4. **Set project:**
   ```cmd
   gcloud config set project YOUR_PROJECT_ID
   ```
5. **Jalankan setup:**
   ```cmd
   cd d:\KULIAH\KomA\ITERARY
   setup-first-time.bat
   ```

---

## 💡 TIPS

- Gunakan Project ID yang pendek dan mudah diingat
- Simpan database password yang muncul setelah deployment
- Set budget alert di GCP Console
- Bookmark frontend & backend URLs

---

**Siap untuk memulai? Install Google Cloud SDK dulu, lalu kita lanjut! 🚀**
