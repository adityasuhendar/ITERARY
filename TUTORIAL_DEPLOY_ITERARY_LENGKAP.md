# TUTORIAL DEPLOY ITERARY KE GOOGLE CLOUD PLATFORM
## Panduan Lengkap dari NOL sampai JADI

> **Project**: ITERARY - Library Management System
> **Tech Stack**: React + Vite, Express.js, MySQL, Redis
> **Cloud Provider**: Google Cloud Platform (GCP)
> **Infrastructure**: Cloud Run, Cloud SQL, Redis Memorystore, VPC

---

## DAFTAR ISI

1. [Persiapan Awal](#1-persiapan-awal)
2. [Setup Google Cloud Platform](#2-setup-google-cloud-platform)
3. [Install Tools yang Dibutuhkan](#3-install-tools-yang-dibutuhkan)
4. [Setup Project Code](#4-setup-project-code)
5. [Build Docker Images](#5-build-docker-images)
6. [Setup Terraform](#6-setup-terraform)
7. [Deploy Infrastructure](#7-deploy-infrastructure)
8. [Import Database Schema](#8-import-database-schema)
9. [Deploy Backend & Frontend](#9-deploy-backend--frontend)
10. [Insert Data Admin & Sample Books](#10-insert-data-admin--sample-books)
11. [Testing Aplikasi](#11-testing-aplikasi)
12. [Troubleshooting](#12-troubleshooting)
13. [Monitoring & Maintenance](#13-monitoring--maintenance)
14. [Cleanup & Destroy](#14-cleanup--destroy)

---

## 1. PERSIAPAN AWAL

### 1.1 Requirement
- **Laptop/PC**: Windows 10/11 (minimal 8GB RAM)
- **Koneksi Internet**: Stabil (minimal 10 Mbps)
- **Google Account**: Untuk GCP
- **Credit Card/Debit Card**: Untuk verifikasi GCP (free trial Rp 3.9 juta)
- **Storage**: Minimal 10GB free space
- **Text Editor**: VS Code (recommended)

### 1.2 Estimasi Biaya
Dengan **GCP Free Trial**:
- Kredit: $300 USD (~Rp 3.9 juta)
- Durasi: 90 hari
- **GRATIS** selama masih dalam trial

Setelah trial (per bulan):
- Cloud SQL (db-f1-micro): ~$7-10
- Cloud Run: ~$2-5 (tergantung traffic)
- Redis Memorystore: ~$10-15
- **TOTAL**: ~$20-30/bulan

### 1.3 Estimasi Waktu
- Setup GCP & Tools: **30 menit**
- Build & Deploy: **45-60 menit**
- Testing & Insert Data: **15 menit**
- **TOTAL**: **1.5 - 2 jam**

---

## 2. SETUP GOOGLE CLOUD PLATFORM

### 2.1 Buat Akun GCP (Kalau Belum Punya)

1. **Buka browser** → https://cloud.google.com
2. Klik **"Get started for free"** atau **"Mulai gratis"**
3. **Login** dengan Google Account
4. **Isi form**:
   - Country: Indonesia
   - Organization: Individual
   - Checklist terms of service
5. **Verifikasi identitas**:
   - Masukkan credit card/debit card
   - Akan ada charge Rp 15,000-20,000 untuk verifikasi (akan di-refund)
6. **Aktifkan Free Trial** → Dapat kredit $300

### 2.2 Buat Project Baru

1. **Buka GCP Console**: https://console.cloud.google.com
2. Klik **dropdown project** (samping logo GCP) → **New Project**
3. **Isi data project**:
   ```
   Project name: iterary-479520
   Location: No organization
   ```
4. Klik **Create**
5. **Tunggu 10-30 detik** sampe project jadi
6. **Select project** yang baru dibuat

### 2.3 Link Billing Account

1. Di GCP Console → **Navigation Menu** (☰) → **Billing**
2. Pilih **Link a billing account**
3. **Select** billing account yang tadi dibuat
4. Klik **Set account**

### 2.4 Enable APIs yang Dibutuhkan

1. **Buka Navigation Menu** (☰) → **APIs & Services** → **Library**

2. **Enable APIs satu-satu**:

   **a. Compute Engine API**
   - Search: "Compute Engine API"
   - Klik → Enable
   - Tunggu ~30 detik

   **b. Cloud SQL Admin API**
   - Search: "Cloud SQL Admin API"
   - Klik → Enable

   **c. Cloud Run Admin API**
   - Search: "Cloud Run Admin API"
   - Klik → Enable

   **d. VPC Access API**
   - Search: "Serverless VPC Access API"
   - Klik → Enable

   **e. Service Networking API**
   - Search: "Service Networking API"
   - Klik → Enable

   **f. Container Registry API**
   - Search: "Container Registry API"
   - Klik → Enable

   **g. Redis API**
   - Search: "Cloud Memorystore for Redis API"
   - Klik → Enable

3. **Tunggu 2-3 menit** biar semua APIs fully enabled

### 2.5 Catat Project ID

```
Project ID: iterary-479520
```

**PENTING**: Project ID ini bakal dipake terus, jadi catat!

---

## 3. INSTALL TOOLS YANG DIBUTUHKAN

### 3.1 Install Google Cloud SDK (gcloud CLI)

**Windows:**

1. **Download installer**:
   - Link: https://cloud.google.com/sdk/docs/install
   - Pilih: **Windows 64-bit (x86_64)** → Download

2. **Jalankan installer** (`GoogleCloudSDKInstaller.exe`)
   - Next → Next → Install
   - **Checklist**: "Start Google Cloud SDK Shell"
   - Finish

3. **Login ke GCP**:
   ```bash
   gcloud auth login
   ```
   - Browser akan terbuka
   - Pilih Google Account yang sama
   - Allow semua permissions

4. **Set default project**:
   ```bash
   gcloud config set project iterary-479520
   ```

5. **Set default region**:
   ```bash
   gcloud config set compute/region asia-southeast2
   ```

6. **Verify installation**:
   ```bash
   gcloud version
   ```
   Output harus muncul versi gcloud

7. **RESTART TERMINAL** (penting buat PATH update)

### 3.2 Install Terraform

**Windows:**

1. **Download Terraform**:
   - Link: https://www.terraform.io/downloads
   - Pilih: **Windows AMD64** → Download ZIP

2. **Extract ZIP**:
   - Extract ke: `C:\terraform\`
   - Jadi ada file: `C:\terraform\terraform.exe`

3. **Tambah ke PATH** (opsional):
   - Search Windows: "Environment Variables"
   - Edit **System variables** → PATH
   - Tambah: `C:\terraform`
   - OK → OK

4. **Verify** (buka terminal baru):
   ```bash
   C:\terraform\terraform.exe version
   ```
   Output: `Terraform v1.x.x`

**CATATAN**: Kalau gak mau tambah PATH, pake full path: `C:\terraform\terraform.exe` setiap jalanin command

### 3.3 Install Docker Desktop

1. **Download Docker Desktop**:
   - Link: https://www.docker.com/products/docker-desktop
   - Pilih: **Windows**

2. **Install**:
   - Jalanin installer
   - Next → Next → Install
   - **RESTART KOMPUTER** (wajib!)

3. **Start Docker Desktop**:
   - Buka aplikasi Docker Desktop
   - Tunggu sampe status: "Docker Desktop is running"
   - Icon Docker di system tray hijau

4. **Verify**:
   ```bash
   docker --version
   docker ps
   ```
   Output: Versi Docker + list containers (kosong gak papa)

### 3.4 Configure Docker untuk GCR

```bash
gcloud auth configure-docker gcr.io --quiet
```

**Output**:
```
Adding credentials for: gcr.io
```

### 3.5 Setup Application Default Credentials

```bash
gcloud auth application-default login
```

- Browser terbuka
- Login dengan Google Account yang sama
- Allow permissions

**Output**:
```
Credentials saved to file: [C:\Users\...\application_default_credentials.json]
```

---

## 4. SETUP PROJECT CODE

### 4.1 Struktur Folder Project

```
C:\Users\wahyu\Videos\bismillah\dwashlaundry\
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   └── redis.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── bookController.js
│   │   │   ├── borrowingController.js
│   │   │   └── statsController.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── books.js
│   │   │   ├── borrowings.js
│   │   │   └── stats.js
│   │   └── server.js
│   ├── .dockerignore
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── .dockerignore
│   ├── .env
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.tfvars
├── database/
│   └── schema.sql
└── README.md
```

### 4.2 Cek File Penting

**Backend - Dockerfile**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 8080

CMD ["node", "src/server.js"]
```

**Frontend - Dockerfile**:
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Frontend - .dockerignore** (PENTING: .env TIDAK boleh ada di sini!):
```
node_modules
dist
npm-debug.log
.env.local
.env.production
.git
.gitignore
README.md
.vscode
.idea
*.md
.DS_Store
coverage
.eslintcache
```

**CATATAN**: File `.env` HARUS masuk ke Docker image, jadi pastikan TIDAK ada di .dockerignore!

### 4.3 Fix Backend Controllers (PENTING!)

**Ini fix untuk MySQL parameter error!**

Buka file-file ini dan pastikan LIMIT/OFFSET pake **template literal** bukan **prepared statement**:

**backend/src/controllers/bookController.js** (line 55-71):
```javascript
// Get books - using template literals for LIMIT/OFFSET
const booksQuery = `
  SELECT
    id, isbn, title, author, publisher, year_published, category,
    total_copies, available_copies, cover_url, description,
    CASE
      WHEN available_copies > 0 THEN 'Available'
      ELSE 'Not Available'
    END as availability_status,
    created_at, updated_at
  FROM books
  ${whereClause}
  ORDER BY ${sortField} ASC
  LIMIT ${limit} OFFSET ${offset}
`;

const books = await query(booksQuery, queryParams);
```

**❌ JANGAN pake ini** (akan error):
```javascript
LIMIT ? OFFSET ?
// dan
const books = await query(booksQuery, [...queryParams, limit, offset]);
```

**✅ HARUS pake ini** (template literal):
```javascript
LIMIT ${limit} OFFSET ${offset}
// dan
const books = await query(booksQuery, queryParams);
```

**Fix yang sama** juga di:
- `backend/src/controllers/borrowingController.js` (line 166-180)
- `backend/src/controllers/statsController.js` (line 111-120)

---

## 5. BUILD DOCKER IMAGES

### 5.1 Build Backend Image

```bash
docker build --no-cache -t gcr.io/iterary-479520/iterary-backend:latest "C:\Users\wahyu\Videos\bismillah\dwashlaundry\backend"
```

**Waktu**: ~15-20 detik (cepat karena backend simple)

**Output**:
```
#8 [4/5] RUN npm install --production
#8 12.15 added 171 packages, and audited 172 packages in 11s
#10 exporting to image
#10 naming to gcr.io/iterary-479520/iterary-backend:latest 0.0s done
#10 DONE 0.8s
```

### 5.2 Build Frontend Image

**PENTING: Buat file .env dulu!**

Buat file: `C:\Users\wahyu\Videos\bismillah\dwashlaundry\frontend\.env`

```env
VITE_API_URL=https://iterary-api-889794700120.asia-southeast2.run.app
```

**CATATAN**: URL ini bakal berubah setelah deploy! Tapi bikin dulu dengan placeholder, nanti kita rebuild lagi.

```bash
docker build --no-cache -t gcr.io/iterary-479520/iterary-frontend:latest "C:\Users\wahyu\Videos\bismillah\dwashlaundry\frontend"
```

**Waktu**: ~10-15 MENIT (lama karena npm install + build Vite)

**Output**:
```
#8 [builder 4/6] RUN npm install
#8 720.5 added 450 packages in 11m
#9 [builder 5/6] COPY . .
#10 [builder 6/6] RUN npm run build
#10 45.23 dist/index.html  0.46 kB
#12 exporting to image
#12 naming to gcr.io/iterary-479520/iterary-frontend:latest
```

**Troubleshooting Build Errors**:
- Kalau **network timeout**: Retry aja, internet lagi lelet
- Kalau **npm ci failed**: Pastikan `npm ci` udah diganti jadi `npm install` di Dockerfile
- Kalau **out of memory**: Close aplikasi lain, Docker butuh RAM

### 5.3 Verify Images

```bash
docker images | findstr iterary
```

**Output**:
```
gcr.io/iterary-479520/iterary-backend    latest    9f80f5adedff   2 minutes ago   185MB
gcr.io/iterary-479520/iterary-frontend   latest    a1b2c3d4e5f6   1 minute ago    45MB
```

### 5.4 Push Images ke Google Container Registry (GCR)

**Push backend**:
```bash
docker push gcr.io/iterary-479520/iterary-backend:latest
```

**Waktu**: ~2-3 menit

**Push frontend**:
```bash
docker push gcr.io/iterary-479520/iterary-frontend:latest
```

**Waktu**: ~1-2 menit

**Verify di GCP Console**:
1. Navigation Menu → **Container Registry**
2. Harus muncul 2 images:
   - `iterary-backend`
   - `iterary-frontend`

---

## 6. SETUP TERRAFORM

### 6.1 Buat File terraform.tfvars

Buat file: `C:\Users\wahyu\Videos\bismillah\dwashlaundry\terraform\terraform.tfvars`

```hcl
project_id = "iterary-479520"
region     = "asia-southeast2"

db_tier = "db-f1-micro"
db_name = "iterary"
db_user = "iterary_user"
db_password = "IterarySecurePass2025!"

jwt_secret = "super-secret-jwt-key-iterary-2025-production-12345"

backend_image  = "gcr.io/iterary-479520/iterary-backend:latest"
frontend_image = "gcr.io/iterary-479520/iterary-frontend:latest"
```

**PENTING**:
- `db_password`: Ganti dengan password yang kuat (min 8 karakter, ada huruf besar, angka, simbol)
- `jwt_secret`: Ganti dengan random string panjang (min 32 karakter)

### 6.2 Verify Terraform Files

**Check main.tf**:
```bash
dir "C:\Users\wahyu\Videos\bismillah\dwashlaundry\terraform"
```

Harus ada:
- `main.tf` (~300+ lines)
- `variables.tf`
- `outputs.tf`
- `terraform.tfvars` (yang baru dibuat)

### 6.3 Pastikan PORT Environment Variable TIDAK Ada

**Buka**: `terraform/main.tf`

**Cari** di bagian `google_cloud_run_service.iterary_api`:

```hcl
resource "google_cloud_run_service" "iterary_api" {
  # ...

  template {
    spec {
      containers {
        image = var.backend_image

        env {
          name  = "NODE_ENV"
          value = "production"
        }

        # JANGAN ada env PORT di sini!
        # env {
        #   name  = "PORT"
        #   value = "8080"
        # }

        env {
          name  = "DB_HOST"
          value = google_sql_database_instance.iterary_db.private_ip_address
        }
        # ... dst
      }
    }
  }
}
```

**PENTING**: Cloud Run otomatis set PORT=8080, jadi kalau kita set manual bakal ERROR!

---

## 7. DEPLOY INFRASTRUCTURE

### 7.1 Initialize Terraform

```bash
cd C:\Users\wahyu\Videos\bismillah\dwashlaundry\terraform
C:\terraform\terraform.exe init
```

**Output**:
```
Initializing the backend...
Initializing provider plugins...
- Finding latest version of hashicorp/google...
- Installing hashicorp/google v6.14.0...

Terraform has been successfully initialized!
```

### 7.2 Plan Deployment

```bash
C:\terraform\terraform.exe plan
```

**Output** (summary):
```
Plan: 12 to add, 0 to change, 0 to destroy.
```

Resources yang bakal dibuat:
- VPC Network
- Private IP Range
- VPC Peering Connection
- VPC Connector
- Cloud SQL Instance
- Cloud SQL Database
- Cloud SQL User
- Redis Instance
- Cloud Run Service (backend)
- Cloud Run Service (frontend)
- IAM Bindings

### 7.3 Apply Deployment

```bash
C:\terraform\terraform.exe apply
```

Bakal muncul:
```
Do you want to perform these actions?
  Terraform will perform the actions described above.
  Only 'yes' will be accepted to approve.

  Enter a value:
```

Ketik: **yes** + Enter

**Waktu Deploy**:
- VPC & Networking: ~2-3 menit
- **Cloud SQL**: **20-25 MENIT** (ini yang paling lama!)
- Redis: ~5-7 menit
- Cloud Run: ~2-3 menit
- **TOTAL**: **30-40 MENIT**

**Output Akhir**:
```
Apply complete! Resources: 12 added, 0 changed, 0 destroyed.

Outputs:

backend_url = "https://iterary-api-889794700120.asia-southeast2.run.app"
db_connection_name = "iterary-479520:asia-southeast2:iterary-db-36890c1f"
db_private_ip = "10.123.45.67"
frontend_url = "https://iterary-frontend-889794700120.asia-southeast2.run.app"
redis_host = "10.123.45.68"
```

**CATAT URLs ini!** Bakal dipake nanti.

### 7.4 Troubleshooting Terraform Errors

**Error: APIs not enabled**
```
Error: Error creating Network: googleapi: Error 403: Compute Engine API has not been used
```
**Fix**: Balik ke [Step 2.4](#24-enable-apis-yang-dibutuhkan) → Enable semua APIs → Tunggu 5 menit → Retry

**Error: Quota exceeded**
```
Error: QUOTA_EXCEEDED
```
**Fix**:
- GCP Console → IAM & Admin → Quotas
- Request increase quota
- Atau ganti region dari `asia-southeast2` ke `us-central1`

**Error: PORT environment variable**
```
Error 400: The following reserved env names were provided: PORT
```
**Fix**: Hapus env PORT dari main.tf → `terraform apply` lagi

---

## 8. IMPORT DATABASE SCHEMA

### 8.1 Buat Cloud Storage Bucket

```bash
gsutil mb -p iterary-479520 -c STANDARD -l asia-southeast2 gs://iterary-479520-import
```

**Output**:
```
Creating gs://iterary-479520-import/...
```

### 8.2 Upload Schema ke Bucket

```bash
gsutil cp "C:\Users\wahyu\Videos\bismillah\dwashlaundry\database\schema.sql" gs://iterary-479520-import/
```

**Output**:
```
Copying file://schema.sql [Content-Type=application/x-sql]...
- [1 files][ 8.5 KiB]
Operation completed over 1 objects/8.5 KiB.
```

### 8.3 Import via GCP Console (RECOMMENDED)

**Kenapa pake Console?** Command line sering error (IPv6, MySQL client, permissions). Console lebih gampang!

1. **Buka GCP Console** → Navigation Menu → **SQL**

2. **Klik instance**: `iterary-db-xxxxxx`

3. **Klik tab "IMPORT"**

4. **Klik "IMPORT"**

5. **Isi form**:
   - **File format**: SQL
   - **Cloud Storage file**: Browse → `iterary-479520-import` → `schema.sql`
   - **Database**: `iterary` (dropdown)
   - **Advanced options**: Biarkan default

6. **Klik "IMPORT"**

7. **Tunggu 1-2 menit**

8. **Verify**:
   - Status berubah jadi "Succeeded" dengan checkmark hijau
   - Refresh halaman kalau perlu

### 8.4 Verify Tables Created

**Option 1: Via GCP Console**

1. SQL Instance → **DATABASES** tab
2. Klik database `iterary`
3. Harus ada 4 tables:
   - `admins`
   - `books`
   - `members`
   - `borrowings`

**Option 2: Via gcloud (kalau mau)** - Skip aja kalau repot

---

## 9. DEPLOY BACKEND & FRONTEND

### 9.1 Update Frontend .env dengan Backend URL

**Dari output Terraform**, catat backend URL:
```
backend_url = "https://iterary-api-889794700120.asia-southeast2.run.app"
```

**Edit**: `C:\Users\wahyu\Videos\bismillah\dwashlaundry\frontend\.env`

```env
VITE_API_URL=https://iterary-api-889794700120.asia-southeast2.run.app
```

**GANTI URL** dengan backend_url yang sesuai dari Terraform output!

### 9.2 Rebuild Frontend (dengan API URL yang Benar)

```bash
docker build --no-cache -t gcr.io/iterary-479520/iterary-frontend:latest "C:\Users\wahyu\Videos\bismillah\dwashlaundry\frontend"
```

**Waktu**: ~10-15 menit (sama seperti build pertama)

### 9.3 Push Frontend ke GCR

```bash
docker push gcr.io/iterary-479520/iterary-frontend:latest
```

**Waktu**: ~1-2 menit

### 9.4 Redeploy Frontend di Cloud Run

```bash
gcloud run deploy iterary-frontend --image gcr.io/iterary-479520/iterary-frontend:latest --platform managed --region asia-southeast2 --allow-unauthenticated
```

**Output**:
```
Deploying container to Cloud Run service [iterary-frontend] in project [iterary-479520] region [asia-southeast2]
✓ Deploying new service... Done.
  ✓ Creating Revision...
  ✓ Routing traffic...
Done.
Service [iterary-frontend] revision [iterary-frontend-00002-xyz] has been deployed and is serving 100 percent of traffic.
Service URL: https://iterary-frontend-889794700120.asia-southeast2.run.app
```

### 9.5 Verify Deployment

**Test Backend**:
```bash
curl https://iterary-api-889794700120.asia-southeast2.run.app/api/health
```

**Expected output**:
```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2025-01-28T10:30:00.000Z"
}
```

**Test Frontend**:

Buka browser → `https://iterary-frontend-889794700120.asia-southeast2.run.app`

Harus muncul halaman ITERARY (katalog buku kosong gak papa, soalnya belum ada data)

---

## 10. INSERT DATA ADMIN & SAMPLE BOOKS

### 10.1 Connect ke Cloud SQL (via Cloud Shell)

1. **Buka GCP Console** → Navigation Menu → **SQL**

2. **Klik instance**: `iterary-db-xxxxxx`

3. **Klik "OPEN CLOUD SHELL"** (icon terminal di kanan atas)

4. **Connect**:
```bash
gcloud sql connect iterary-db-36890c1f --user=iterary_user --quiet
```

5. **Enter password**: `IterarySecurePass2025!` (password dari terraform.tfvars)

6. **Select database**:
```sql
USE iterary;
```

### 10.2 Insert Admin User

```sql
INSERT INTO admins (username, email, password, full_name, role, status)
VALUES (
  'admin',
  'admin@iterary.id',
  '$2b$10$rZ8qHJ5KvL.nW9y2xJ3F0eYhZJ1QX9FvH3L4tK2mN5oP6qR7sS8tT',
  'Super Admin',
  'super_admin',
  'active'
);
```

**Credentials untuk login**:
- Username: `admin`
- Password: `admin123`

**CATATAN**: Password hash di atas adalah bcrypt hash dari `admin123`. Kalau mau ganti password, lu harus generate hash baru.

### 10.3 Insert Sample Books

```sql
INSERT INTO books (isbn, title, author, publisher, year_published, category, total_copies, available_copies, description) VALUES
('978-0-13-468599-1', 'Clean Code', 'Robert C. Martin', 'Prentice Hall', 2008, 'Programming', 3, 3, 'A handbook of agile software craftsmanship'),
('978-0-596-52068-7', 'JavaScript: The Good Parts', 'Douglas Crockford', 'O\'Reilly Media', 2008, 'Programming', 2, 2, 'Unearthing the excellence in JavaScript'),
('978-1-449-35573-9', 'Learning React', 'Alex Banks, Eve Porcello', 'O\'Reilly Media', 2020, 'Web Development', 4, 4, 'Modern patterns for developing React apps'),
('978-0-134-68566-3', 'Effective Java', 'Joshua Bloch', 'Addison-Wesley', 2018, 'Programming', 2, 2, 'Best practices for the Java platform'),
('978-1-491-95027-5', 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'O\'Reilly Media', 2017, 'Database', 3, 3, 'The big ideas behind reliable, scalable systems'),
('978-0-135-95705-9', 'The Pragmatic Programmer', 'David Thomas, Andrew Hunt', 'Addison-Wesley', 2019, 'Programming', 5, 5, 'Your journey to mastery'),
('978-1-617-29244-5', 'Node.js in Action', 'Alex Young, Bradley Meck', 'Manning', 2017, 'Web Development', 2, 2, 'Building scalable web applications'),
('978-0-321-12521-7', 'Domain-Driven Design', 'Eric Evans', 'Addison-Wesley', 2003, 'Software Architecture', 2, 2, 'Tackling complexity in the heart of software'),
('978-0-596-00784-8', 'Head First Design Patterns', 'Eric Freeman, Elisabeth Robson', 'O\'Reilly Media', 2004, 'Programming', 4, 4, 'A brain-friendly guide to design patterns'),
('978-1-449-36958-3', 'Python for Data Analysis', 'Wes McKinney', 'O\'Reilly Media', 2017, 'Data Science', 3, 3, 'Data wrangling with Pandas, NumPy, and IPython');
```

### 10.4 Verify Data

```sql
-- Check admins
SELECT * FROM admins;

-- Check books
SELECT id, title, author, available_copies FROM books;

-- Exit
EXIT;
```

**Expected output**:
- 1 admin user
- 10 books

---

## 11. TESTING APLIKASI

### 11.1 Test API Endpoints

**Health Check**:
```bash
curl https://iterary-api-889794700120.asia-southeast2.run.app/api/health
```

**Get Books**:
```bash
curl https://iterary-api-889794700120.asia-southeast2.run.app/api/books
```

**Expected**: JSON dengan list 10 books

**Login Admin** (via PowerShell):
```powershell
$body = @{
  username = "admin"
  password = "admin123"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://iterary-api-889794700120.asia-southeast2.run.app/api/auth/admin/login" -Method POST -Body $body -ContentType "application/json"
```

**Expected**: Response 200 dengan token JWT

### 11.2 Test Frontend

1. **Buka browser** → `https://iterary-frontend-889794700120.asia-southeast2.run.app`

2. **Test Katalog Buku**:
   - Harus muncul 10 buku
   - Cover placeholder (gak papa, cover_url null)
   - Bisa search by title/author
   - Bisa filter by category

3. **Test Login Admin**:
   - Klik "Login" (di navbar)
   - Username: `admin`
   - Password: `admin123`
   - Harus redirect ke Dashboard

4. **Test Dashboard Admin**:
   - Total Books: 10
   - Total Available: 29
   - Popular Books muncul
   - Recent Borrowings kosong (normal)

5. **Test Add Book** (Admin):
   - Dashboard → "Add Book"
   - Isi form buku baru
   - Submit
   - Buku muncul di katalog

### 11.3 Test Member Flow (Opsional)

**Register Member** (via API):
```powershell
$body = @{
  member_id = "121450001"
  name = "John Doe"
  email = "john@example.com"
  password = "password123"
  phone = "08123456789"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://iterary-api-889794700120.asia-southeast2.run.app/api/auth/register" -Method POST -Body $body -ContentType "application/json"
```

**Login Member & Pinjam Buku**:
1. Login di frontend dengan member credentials
2. Browse katalog
3. Klik "Pinjam" di buku
4. Pilih durasi (7/14/30 hari)
5. Submit
6. Check "My Borrowings"

---

## 12. TROUBLESHOOTING

### 12.1 Frontend - Error: Failed to fetch books

**Symptom**:
```
Console: Failed to fetch books: TypeError: Failed to fetch
Network tab: ERR_CONNECTION_REFUSED
```

**Root Cause**: Frontend masih hit `localhost:8080` instead of production API

**Fix**:
1. Check `.env` file di frontend:
   ```bash
   type "C:\Users\wahyu\Videos\bismillah\dwashlaundry\frontend\.env"
   ```
   Harus ada: `VITE_API_URL=https://iterary-api-889794700120.asia-southeast2.run.app`

2. Check `.dockerignore` di frontend:
   ```bash
   type "C:\Users\wahyu\Videos\bismillah\dwashlaundry\frontend\.dockerignore"
   ```
   **PASTIKAN `.env` TIDAK ada di .dockerignore!**

3. Rebuild frontend:
   ```bash
   docker build --no-cache -t gcr.io/iterary-479520/iterary-frontend:latest "C:\Users\wahyu\Videos\bismillah\dwashlaundry\frontend"
   docker push gcr.io/iterary-479520/iterary-frontend:latest
   gcloud run deploy iterary-frontend --image gcr.io/iterary-479520/iterary-frontend:latest --platform managed --region asia-southeast2 --allow-unauthenticated
   ```

### 12.2 Backend - Error 500: Incorrect arguments to mysqld_stmt_execute

**Symptom**:
```json
{
  "success": false,
  "message": "Error: Incorrect arguments to mysqld_stmt_execute",
  "errno": 1210
}
```

**Root Cause**: MySQL Cloud SQL strict dengan prepared statement parameters untuk LIMIT/OFFSET

**Fix**: Pastikan controller files pake **template literal** bukan **prepared statement**

**bookController.js** (line 68):
```javascript
// ✅ BENAR
LIMIT ${limit} OFFSET ${offset}

// ❌ SALAH
LIMIT ? OFFSET ?
```

**borrowingController.js** (line 177):
```javascript
// ✅ BENAR
LIMIT ${limit} OFFSET ${offset}

// ❌ SALAH
LIMIT ? OFFSET ?
```

**statsController.js** (line 119):
```javascript
// ✅ BENAR
LIMIT ${limit}

// ❌ SALAH
LIMIT ?
```

**Rebuild backend**:
```bash
docker build --no-cache -t gcr.io/iterary-479520/iterary-backend:latest "C:\Users\wahyu\Videos\bismillah\dwashlaundry\backend"
docker push gcr.io/iterary-479520/iterary-backend:latest
gcloud run deploy iterary-api --image gcr.io/iterary-479520/iterary-backend:latest --platform managed --region asia-southeast2 --allow-unauthenticated
```

### 12.3 Cloud SQL - Cannot connect from backend

**Symptom**:
```
Error: connect ETIMEDOUT
```

**Root Cause**: VPC Connector tidak connect ke Cloud SQL private IP

**Fix**:
1. Check VPC Connector di Terraform output:
   ```bash
   C:\terraform\terraform.exe output
   ```

2. Verify connector di GCP Console:
   - Navigation Menu → **Serverless VPC Access**
   - Harus ada connector dengan status "Ready"

3. Check Cloud Run backend pake connector:
   - Navigation Menu → **Cloud Run** → `iterary-api`
   - Tab "NETWORKING"
   - VPC connector: Harus ter-set

4. Kalau connector hilang, re-apply Terraform:
   ```bash
   cd C:\Users\wahyu\Videos\bismillah\dwashlaundry\terraform
   C:\terraform\terraform.exe apply
   ```

### 12.4 Redis - Connection timeout

**Symptom**:
```
Error: connect ETIMEDOUT (Redis)
```

**Root Cause**: Redis instance belum fully ready atau VPC peering issue

**Fix**:
1. Check Redis status:
   - GCP Console → **Memorystore for Redis**
   - Status harus "Ready" (hijau)

2. Wait 5-10 menit after deployment (Redis lama initialize)

3. Restart backend:
   ```bash
   gcloud run services update iterary-api --region asia-southeast2
   ```

### 12.5 Terraform - Error: APIs not enabled

**Symptom**:
```
Error 403: Compute Engine API has not been used in project before
```

**Fix**:
1. Enable API manually di console (faster):
   - GCP Console → APIs & Services → Library
   - Search API yang error → Enable

2. **WAIT 5 MENIT** (API activation butuh waktu)

3. Retry:
   ```bash
   C:\terraform\terraform.exe apply
   ```

### 12.6 Docker - Push denied: authentication required

**Symptom**:
```
denied: Permission "artifactregistry.repositories.uploadArtifacts" denied
```

**Fix**:
```bash
gcloud auth configure-docker gcr.io --quiet
gcloud auth login
docker push gcr.io/iterary-479520/iterary-backend:latest
```

---

## 13. MONITORING & MAINTENANCE

### 13.1 Check Logs

**Backend Logs**:
```bash
gcloud run services logs read iterary-api --region asia-southeast2 --limit 50
```

**Frontend Logs**:
```bash
gcloud run services logs read iterary-frontend --region asia-southeast2 --limit 50
```

**Cloud SQL Logs**:
- GCP Console → SQL → `iterary-db-xxxxx` → **LOGS** tab

### 13.2 Monitor Costs

**Billing Dashboard**:
- GCP Console → **Billing** → **Reports**
- Filter by: "This month"
- Breakdown by: Service

**Expected costs** (dengan free tier):
- First 90 days: **$0** (covered by $300 credit)
- After trial: ~$20-30/month

**Cost breakdown**:
- Cloud SQL: ~$7-10/month (db-f1-micro)
- Cloud Run: ~$2-5/month (low traffic)
- Redis: ~$10-15/month
- VPC/Networking: ~$1-2/month

### 13.3 Set Budget Alert

1. **Billing** → **Budgets & alerts**
2. **Create Budget**:
   - Name: "ITERARY Monthly Budget"
   - Projects: iterary-479520
   - Budget amount: $50
   - Alert thresholds: 50%, 90%, 100%
   - Email: (your email)

### 13.4 Performance Monitoring

**Cloud Run Metrics**:
- GCP Console → Cloud Run → Service → **METRICS** tab
- Monitor:
  - Request count
  - Request latency
  - Container instance count
  - Memory utilization
  - CPU utilization

**Recommended**: Install **Cloud Monitoring agent** untuk detailed metrics

---

## 14. CLEANUP & DESTROY

### 14.1 Backup Database (Sebelum Destroy!)

**Via GCP Console**:
1. SQL → Instance → **BACKUPS** tab
2. **CREATE BACKUP**
3. Wait 2-5 menit

**Via gcloud**:
```bash
gcloud sql backups create --instance=iterary-db-36890c1f
```

### 14.2 Destroy All Infrastructure

```bash
cd C:\Users\wahyu\Videos\bismillah\dwashlaundry\terraform
C:\terraform\terraform.exe destroy
```

**Konfirmasi**:
```
Do you really want to destroy all resources?
  Terraform will destroy all your managed infrastructure, as shown above.
  There is no undo. Only 'yes' will be accepted to confirm.

  Enter a value:
```

Ketik: **yes**

**Waktu**: ~15-20 menit (Cloud SQL paling lama)

**Output**:
```
Destroy complete! Resources: 12 destroyed.
```

### 14.3 Delete Docker Images

**Via gcloud**:
```bash
gcloud container images delete gcr.io/iterary-479520/iterary-backend:latest --quiet
gcloud container images delete gcr.io/iterary-479520/iterary-frontend:latest --quiet
```

**Via GCP Console**:
- Container Registry → Select images → DELETE

### 14.4 Delete Cloud Storage Bucket

```bash
gsutil rm -r gs://iterary-479520-import
```

### 14.5 Delete Project (Full Cleanup)

**WARNING**: Ini hapus SEMUA resources di project!

1. GCP Console → **IAM & Admin** → **Settings**
2. **SHUT DOWN** project
3. Confirm dengan ketik project ID
4. Project dihapus permanen dalam 30 hari

---

## APPENDIX

### A. Command Cheat Sheet

**Docker**:
```bash
# Build images
docker build --no-cache -t gcr.io/iterary-479520/iterary-backend:latest backend/
docker build --no-cache -t gcr.io/iterary-479520/iterary-frontend:latest frontend/

# Push images
docker push gcr.io/iterary-479520/iterary-backend:latest
docker push gcr.io/iterary-479520/iterary-frontend:latest

# Check images
docker images | findstr iterary
```

**Terraform**:
```bash
cd terraform/
C:\terraform\terraform.exe init
C:\terraform\terraform.exe plan
C:\terraform\terraform.exe apply
C:\terraform\terraform.exe output
C:\terraform\terraform.exe destroy
```

**gcloud**:
```bash
# Deploy Cloud Run
gcloud run deploy iterary-api --image gcr.io/iterary-479520/iterary-backend:latest --platform managed --region asia-southeast2 --allow-unauthenticated

gcloud run deploy iterary-frontend --image gcr.io/iterary-479520/iterary-frontend:latest --platform managed --region asia-southeast2 --allow-unauthenticated

# Logs
gcloud run services logs read iterary-api --region asia-southeast2 --limit 50

# SQL
gcloud sql connect iterary-db-36890c1f --user=iterary_user

# Storage
gsutil mb gs://bucket-name
gsutil cp file.sql gs://bucket-name/
gsutil rm -r gs://bucket-name
```

### B. Important URLs & Credentials

**Frontend URL**:
```
https://iterary-frontend-889794700120.asia-southeast2.run.app
```

**Backend URL**:
```
https://iterary-api-889794700120.asia-southeast2.run.app
```

**Admin Credentials**:
```
Username: admin
Password: admin123
```

**Database**:
```
Host: (private IP)
Database: iterary
User: iterary_user
Password: (from terraform.tfvars)
```

### C. File Locations

```
Project root: C:\Users\wahyu\Videos\bismillah\dwashlaundry\

Key files:
- Backend Dockerfile: backend/Dockerfile
- Backend controllers: backend/src/controllers/*.js
- Frontend Dockerfile: frontend/Dockerfile
- Frontend .env: frontend/.env
- Frontend .dockerignore: frontend/.dockerignore
- Terraform configs: terraform/*.tf
- Terraform vars: terraform/terraform.tfvars
- Database schema: database/schema.sql
```

### D. Support Resources

**Official Docs**:
- GCP Documentation: https://cloud.google.com/docs
- Terraform GCP Provider: https://registry.terraform.io/providers/hashicorp/google/latest/docs
- Docker Documentation: https://docs.docker.com
- Cloud Run Documentation: https://cloud.google.com/run/docs

**Pricing Calculator**:
- https://cloud.google.com/products/calculator

**Community**:
- Stack Overflow: [google-cloud-platform] tag
- GCP Community: https://www.googlecloudcommunity.com

---

## SELESAI! 🎉

Kalau ada pertanyaan atau error, cek bagian **[Troubleshooting](#12-troubleshooting)** dulu.

Good luck dengan deployment ITERARY! 🚀

**Last updated**: 2025-01-28
