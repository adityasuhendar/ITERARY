# PANDUAN DEPLOYMENT APLIKASI 3-TIER KE GOOGLE CLOUD PLATFORM
## Tutorial Universal untuk Semua Platform

> **Aplikasi**: ITERARY - Library Management System
> **Arsitektur**: Three-Tier Web Application
> **Tech Stack**: React (Frontend) + Express.js (Backend) + MySQL (Database) + Redis (Cache)
> **Cloud Provider**: Google Cloud Platform
> **Deployment Method**: Docker + Terraform + Cloud Run

---

## DAFTAR ISI

- [Tentang Project ITERARY](#tentang-project-iterary)
- [Mengapa Deployment ke Cloud?](#mengapa-deployment-ke-cloud)
- [Arsitektur & Design Decisions](#arsitektur--design-decisions)
- [Tech Stack Justification](#tech-stack-justification)
- [Challenges & Solutions](#challenges--solutions)
- [Cost Analysis](#cost-analysis)
- [Arsitektur Aplikasi](#arsitektur-aplikasi)
- [Prasyarat](#prasyarat)
- [Bagian 1: Persiapan Akun GCP](#bagian-1-persiapan-akun-gcp)
- [Bagian 2: Install Tools](#bagian-2-install-tools)
- [Bagian 3: Persiapan Kode Aplikasi](#bagian-3-persiapan-kode-aplikasi)
- [Bagian 4: Containerization dengan Docker](#bagian-4-containerization-dengan-docker)
- [Bagian 5: Infrastructure as Code dengan Terraform](#bagian-5-infrastructure-as-code-dengan-terraform)
- [Bagian 6: Deployment ke GCP](#bagian-6-deployment-ke-gcp)
- [Bagian 7: Database Setup](#bagian-7-database-setup)
- [Bagian 8: Testing & Verification](#bagian-8-testing--verification)
- [Bagian 9: Monitoring & Maintenance](#bagian-9-monitoring--maintenance)
- [Bagian 10: Troubleshooting](#bagian-10-troubleshooting)
- [Referensi](#referensi)

---

## TENTANG PROJECT ITERARY

### Apa itu ITERARY?

**ITERARY** adalah singkatan dari **IT**ERAS Lib**RARY** Management System - sebuah aplikasi web untuk manajemen perpustakaan digital yang dibangun khusus untuk **Institut Teknologi Sumatera (ITERA)**.

### Tujuan Project

Project ini dibuat sebagai tugas mata kuliah **Cloud Computing** dengan objectives:

1. **Implementasi 3-Tier Architecture** pada cloud platform
2. **Containerization** aplikasi menggunakan Docker
3. **Infrastructure as Code** menggunakan Terraform
4. **Deployment** ke Google Cloud Platform dengan managed services
5. **Best Practices** dalam cloud-native application development

### Fitur Aplikasi

**Untuk Mahasiswa (Members):**
- 📚 Browse katalog buku perpustakaan
- 🔍 Search buku berdasarkan judul/author/ISBN
- 🏷️ Filter buku berdasarkan kategori
- 📖 Pinjam buku dengan durasi flexible (7/14/30 hari)
- 📋 Lihat history peminjaman
- ⏰ Track due date & denda keterlambatan

**Untuk Admin/Petugas:**
- 👨‍💼 Dashboard statistik perpustakaan
- ➕ CRUD operations untuk manajemen buku
- ✅ Proses peminjaman & pengembalian
- 📊 Lihat buku populer & statistik
- 🚨 Monitor buku overdue & hitung denda
- 👥 Manajemen anggota perpustakaan

### Database Schema

Aplikasi menggunakan 4 tabel utama:

```sql
admins       → Petugas perpustakaan (username, password, role)
books        → Koleksi buku (isbn, title, author, category, stock)
members      → Anggota perpustakaan/mahasiswa (NIM, name, email)
borrowings   → Transaksi peminjaman (member, book, dates, status, fines)
```

### Business Logic

**Peminjaman Buku:**
- Member hanya bisa pinjam jika tidak ada buku overdue
- Durasi peminjaman: 7, 14, atau 30 hari
- Stock berkurang otomatis saat dipinjam
- Status: borrowed → overdue (jika lewat due_date) → returned

**Denda Keterlambatan:**
- Rp 1,000 per hari keterlambatan
- Dihitung otomatis saat pengembalian
- Tracking di field `fine_amount`

---

## MENGAPA DEPLOYMENT KE CLOUD?

### Traditional Hosting vs Cloud

| Aspect | Traditional (On-Premise) | Cloud (GCP) |
|--------|-------------------------|-------------|
| **Setup Time** | Berhari-hari (beli server, install OS) | Menit (provision via API) |
| **Scalability** | Manual (beli hardware baru) | Otomatis (auto-scaling) |
| **Availability** | Tergantung 1 server | High availability (multi-zone) |
| **Maintenance** | Manual patching, monitoring | Managed by cloud provider |
| **Cost** | High upfront (CAPEX) | Pay-as-you-go (OPEX) |
| **Disaster Recovery** | Manual backup setup | Automated backups |

### Kenapa Pilih Google Cloud Platform?

**1. Free Trial Generous**
- $300 USD credit (≈ Rp 4.7 juta)
- Valid 90 hari
- Cukup untuk development & testing

**2. Managed Services**
- Cloud SQL → No need manage MySQL server
- Cloud Run → No need manage containers/orchestration
- Redis Memorystore → Fully managed cache

**3. Modern Architecture**
- Serverless (Cloud Run) → Pay only when used
- Auto-scaling → Handle traffic spikes
- Global infrastructure → Low latency

**4. Developer-Friendly**
- Terraform support excellent
- Good documentation
- Integration dengan GitHub, Docker, dll

**5. Industry Standard**
- Used by Spotify, Twitter, PayPal
- Good for CV/portfolio
- Relevant untuk job market

### Alternatif Cloud Providers

| Provider | Pros | Cons |
|----------|------|------|
| **AWS** | Market leader, most services | Complex pricing, steeper learning curve |
| **Azure** | Good Windows integration | More expensive, less generous free tier |
| **GCP** | ✅ Best free tier, modern services | Smaller market share than AWS |
| **DigitalOcean** | Simple, cheap VPS | Limited managed services |
| **Heroku** | Easy deployment | Expensive at scale, less control |

**Verdict**: GCP optimal untuk tugas kuliah (free tier + learning experience)

---

## ARSITEKTUR & DESIGN DECISIONS

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────┐
│  TIER 1: PRESENTATION LAYER                             │
│  • Frontend (React + Vite)                              │
│  • Served by nginx                                      │
│  • Client-side routing                                  │
│  • Responsive UI                                        │
└────────────────┬────────────────────────────────────────┘
                 │ HTTPS / REST API
┌────────────────┴────────────────────────────────────────┐
│  TIER 2: APPLICATION LAYER                              │
│  • Backend (Express.js)                                 │
│  • Business logic                                       │
│  • Authentication (JWT)                                 │
│  • API endpoints                                        │
│  • Caching logic (Redis)                                │
└────────────────┬────────────────────────────────────────┘
                 │ SQL / Redis Protocol
┌────────────────┴────────────────────────────────────────┐
│  TIER 3: DATA LAYER                                     │
│  • Database (MySQL 8.0)                                 │
│  • Cache (Redis)                                        │
│  • Data persistence                                     │
│  • Automated backups                                    │
└─────────────────────────────────────────────────────────┘
```

### Design Decisions Explained

**1. Kenapa 3-Tier?**

✅ **Separation of Concerns**
- Frontend fokus UI/UX
- Backend fokus business logic
- Database fokus data persistence

✅ **Independent Scaling**
- Frontend bisa scale berbeda dari backend
- Database bisa upgrade specs terpisah

✅ **Team Collaboration**
- Frontend dev & backend dev bisa kerja parallel
- Clear API contract

✅ **Technology Flexibility**
- Ganti frontend (React → Vue) tanpa touch backend
- Ganti database (MySQL → PostgreSQL) minimal code change

**2. Kenapa Serverless (Cloud Run)?**

✅ **No Server Management**
- No patching OS
- No container orchestration (Kubernetes complexity)
- No capacity planning

✅ **Auto-Scaling**
- Scale to zero (no traffic = $0 cost)
- Scale to thousands (traffic spike handled)
- Per-request pricing

✅ **Fast Deployment**
- Deploy new version dalam menit
- Rollback instan jika ada issue
- Blue-green deployment otomatis

**3. Kenapa Cloud SQL (bukan self-hosted MySQL)?**

✅ **Automated Backups**
- Daily backup otomatis
- Point-in-time recovery
- 7 days retention

✅ **High Availability**
- 99.95% uptime SLA
- Automatic failover
- Multi-zone replication (optional)

✅ **Maintenance-Free**
- Security patches otomatis
- MySQL upgrades managed
- No downtime for maintenance

✅ **Performance**
- SSD storage default
- Connection pooling built-in
- Query insights for optimization

**4. Kenapa VPC (Private Network)?**

✅ **Security**
- Database tidak exposed ke internet
- Hanya backend yang bisa akses
- Reduce attack surface

✅ **Compliance**
- Meet security best practices
- Data privacy compliance
- Network isolation

✅ **Performance**
- Low latency (private network)
- No internet egress charges
- Predictable network performance

**5. Kenapa Redis Cache?**

✅ **Performance Boost**
- Book list cache → 100x faster
- Reduce database load
- Sub-millisecond response time

✅ **Cost Reduction**
- Less database queries
- Lower Cloud SQL CPU usage
- Cheaper than upgrading database

✅ **Better UX**
- Instant page loads
- Smooth browsing experience
- Handle more concurrent users

---

## TECH STACK JUSTIFICATION

### Frontend: React + Vite

**Why React?**
- ✅ Industry standard (most popular framework)
- ✅ Component reusability
- ✅ Large ecosystem (libraries, tools)
- ✅ Job market demand

**Why Vite (not Webpack)?**
- ✅ **10x faster** development server
- ✅ Instant hot module replacement (HMR)
- ✅ Optimized production builds
- ✅ Modern, zero-config

**Alternatives Considered:**
- Vue.js → Lebih simple tapi less popular
- Angular → Too complex untuk project kecil
- Next.js → Overkill (SSR tidak needed)

### Backend: Express.js + Node.js

**Why Express.js?**
- ✅ Minimalist & flexible
- ✅ Huge middleware ecosystem
- ✅ Easy to learn & use
- ✅ Perfect for REST APIs

**Why Node.js?**
- ✅ JavaScript full-stack (frontend & backend)
- ✅ Non-blocking I/O (good for I/O-heavy apps)
- ✅ NPM package ecosystem
- ✅ Fast development

**Alternatives Considered:**
- Django (Python) → Overkill, monolithic
- Spring Boot (Java) → Too heavy, slow startup
- Laravel (PHP) → Less modern
- Go → Steep learning curve

### Database: MySQL 8.0

**Why MySQL?**
- ✅ Relational data (books, members, borrowings)
- ✅ ACID transactions needed
- ✅ Mature & stable
- ✅ Great Cloud SQL support

**Why MySQL 8.0 (not 5.7)?**
- ✅ Better JSON support
- ✅ Window functions
- ✅ Faster & more efficient
- ✅ Active support

**Alternatives Considered:**
- PostgreSQL → More features tapi overkill
- MongoDB → NoSQL tidak cocok (relational data)
- SQLite → Tidak production-ready

### Infrastructure: Docker + Terraform

**Why Docker?**
- ✅ Consistent environments (dev = prod)
- ✅ Easy deployment
- ✅ Isolation & portability
- ✅ Required for Cloud Run

**Why Terraform?**
- ✅ Infrastructure as Code
- ✅ Version control infrastructure
- ✅ Reproducible deployments
- ✅ Multi-cloud support

**Alternatives:**
- Cloud Deployment Manager → GCP-only
- Pulumi → More complex
- Manual setup → Error-prone, slow

---

## CHALLENGES & SOLUTIONS

### Challenge 1: MySQL Parameter Type Error

**Problem:**
```
Error: Incorrect arguments to mysqld_stmt_execute
errno: 1210
sql: SELECT * FROM books LIMIT ? OFFSET ?
```

**Root Cause:**
Cloud SQL MySQL 8.0 sangat strict dengan prepared statement parameter types. Integer parameters untuk LIMIT/OFFSET tidak diterima via prepared statement placeholders (`?`).

**Solution:**
Ganti prepared statement dengan template literals (direct value injection):

```javascript
// ❌ WRONG - Prepared statement
const query = `SELECT * FROM books LIMIT ? OFFSET ?`;
const books = await db.query(query, [limit, offset]);

// ✅ CORRECT - Template literal
const query = `SELECT * FROM books LIMIT ${limit} OFFSET ${offset}`;
const books = await db.query(query);
```

**Why This Works:**
- `limit` dan `offset` sudah di-validate sebagai integers
- Direct injection aman karena tidak user input
- MySQL menerima literal integers untuk LIMIT/OFFSET

**Files Modified:**
- `backend/src/controllers/bookController.js`
- `backend/src/controllers/borrowingController.js`
- `backend/src/controllers/statsController.js`

### Challenge 2: Frontend API URL Configuration

**Problem:**
Frontend production masih hit `localhost:8080` instead of production backend URL.

**Root Cause:**
Vite uses **build-time environment variables** (`VITE_*`). File `.env` tidak included dalam Docker image karena ada di `.dockerignore`.

**Solution:**

1. Remove `.env` from `.dockerignore`
2. Create `.env` with production API URL:
   ```env
   VITE_API_URL=https://backend-production-url.run.app
   ```
3. Rebuild frontend Docker image:
   ```bash
   docker build --no-cache -t frontend:latest ./frontend
   ```

**Key Learning:**
- Vite env vars ≠ runtime env vars
- `.env` must exist during `npm run build`
- Docker build includes `.env` in image

### Challenge 3: VPC Networking

**Problem:**
Backend tidak bisa connect ke Cloud SQL private IP.

```
Error: connect ETIMEDOUT 10.x.x.x:3306
```

**Root Cause:**
Cloud Run (public network) tidak bisa langsung akses Cloud SQL (private VPC network).

**Solution:**
Setup **VPC Connector** untuk bridge Cloud Run ↔ VPC:

```hcl
# Terraform config
resource "google_vpc_access_connector" "connector" {
  name          = "vpc-connector"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.8.0.0/28"
}

# Attach to Cloud Run
resource "google_cloud_run_service" "backend" {
  # ...
  template {
    metadata {
      annotations = {
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.connector.id
        "run.googleapis.com/vpc-access-egress"    = "private-ranges-only"
      }
    }
  }
}
```

**Key Learning:**
- Serverless services need explicit VPC connection
- VPC Connector = bridge between serverless ↔ VPC
- Egress control untuk optimize network costs

### Challenge 4: PORT Environment Variable Conflict

**Problem:**
```
Error 400: The following reserved env names were provided: PORT
```

**Root Cause:**
Cloud Run **automatically sets** `PORT=8080`. Kalau kita set manual via Terraform, akan conflict.

**Solution:**
Remove PORT from Terraform env vars:

```hcl
# ❌ WRONG
env {
  name  = "PORT"
  value = "8080"
}

# ✅ CORRECT - Hapus env PORT
# Cloud Run auto-inject PORT
```

Backend code baca dari process.env.PORT (auto-set by Cloud Run):

```javascript
const PORT = process.env.PORT || 8080;
app.listen(PORT);
```

### Challenge 5: Docker Build Cache Issues

**Problem:**
Code changes tidak reflected dalam container setelah rebuild.

**Root Cause:**
Docker cache layers dari previous build. File changes tidak trigger rebuild jika COPY layer cached.

**Solution:**
Use `--no-cache` flag:

```bash
docker build --no-cache -t image:latest .
```

**Alternative:**
Change COPY order untuk maximize cache hits:

```dockerfile
# Good: Dependencies cached separately
COPY package*.json ./
RUN npm install
COPY . .  # Code changes invalidate from here

# Bad: Everything invalidated on any file change
COPY . .
RUN npm install
```

### Challenge 6: Terraform State Management

**Problem:**
Multiple developers running Terraform causes state conflicts.

**Solution (untuk production):**
Use remote state backend:

```hcl
terraform {
  backend "gcs" {
    bucket = "terraform-state-bucket"
    prefix = "iterary/state"
  }
}
```

**Untuk tugas kuliah:**
Local state OK (single developer). Commit `terraform.tfstate` ke Git jika perlu share.

---

## COST ANALYSIS

### Monthly Cost Breakdown

**With GCP Free Trial ($300 credit, 90 days):**
```
Total Cost: $0 (covered by credit)
Duration: ~9-13 months of testing/development
```

**After Free Trial:**

| Service | Specs | Usage Pattern | Monthly Cost |
|---------|-------|---------------|--------------|
| **Cloud SQL** | db-f1-micro, 10GB SSD | 24/7 running | $7.50 |
| **Cloud Run (Backend)** | 512MB RAM, 1 vCPU | ~5000 req/day | $2.00 |
| **Cloud Run (Frontend)** | 256MB RAM, 1 vCPU | ~1000 req/day | $0.50 |
| **Redis Memorystore** | 1GB Basic tier | 24/7 running | $12.00 |
| **VPC Connector** | f1-micro equivalent | 24/7 active | $1.50 |
| **Networking** | Egress (private only) | Minimal | $0.50 |
| **Container Registry** | 2 images, ~500MB | Storage only | $0.10 |
| **Cloud Storage** | Database import bucket | ~10MB | $0.01 |
| **TOTAL** | | | **$24.11/month** |

### Cost Optimization Strategies

**1. Database Tier**
```
db-f1-micro → $7.50/mo  (development)
db-g1-small → $25/mo    (production low-traffic)
db-n1-standard-1 → $70/mo (production high-traffic)
```
**Recommendation**: Stick with db-f1-micro untuk tugas kuliah.

**2. Cloud Run Scaling**
```hcl
# Set max instances to control costs
metadata {
  annotations = {
    "autoscaling.knative.dev/maxScale" = "5"
  }
}
```

**3. Redis Alternative**
- **Keep Redis**: $12/mo untuk performance boost
- **Remove Redis**: Save $12/mo, slightly slower queries
**Recommendation**: Keep Redis (worth the performance).

**4. Auto-Stop Database** (Development only)
```bash
# Stop database saat tidak pakai
gcloud sql instances patch INSTANCE_NAME --activation-policy=NEVER

# Start lagi saat butuh
gcloud sql instances patch INSTANCE_NAME --activation-policy=ALWAYS
```
**Caveat**: Takes ~2 minutes to start. Not for production.

**5. Delete Old Docker Images**
```bash
# List images
gcloud container images list --repository=gcr.io/PROJECT_ID

# Delete specific tag
gcloud container images delete gcr.io/PROJECT_ID/backend:old-tag --quiet
```

### Budget Alert Setup

**Prevent Bill Shock:**

1. Navigation menu → **Billing** → **Budgets & alerts**
2. Create budget:
   ```
   Name: Monthly Budget
   Amount: $50
   Alerts: 50%, 90%, 100%
   Email: your-email@example.com
   ```
3. **Enable auto-notifications**

### Free Tier Limits (Always Free)

Some GCP services free forever:
- Cloud Run: 2 million requests/month
- Cloud Storage: 5GB storage
- Cloud Functions: 2 million invocations/month

**Note**: Cloud SQL & Redis **NOT** in always-free tier.

### Total Cost of Ownership (3 Months)

**Scenario: Tugas kuliah (3 bulan)**

```
Month 1: $0 (Free trial)
Month 2: $0 (Free trial)
Month 3: $0 (Free trial)
Total: $0 ✅

Remaining credit: ~$228 (enough for 9 more months!)
```

**Scenario: Production app (1 year)**

```
Free trial (3 months): $0
Paid period (9 months): $24 × 9 = $216
Total: $216/year = $18/month average
```

**Compare to alternatives:**
- Heroku: $25/month (basic dyno + database)
- DigitalOcean: $18/month (VPS only, no managed database)
- AWS: $30-40/month (similar setup)

**Verdict**: GCP cost-competitive, excellent untuk tugas & small projects.

---

## ARSITEKTUR APLIKASI

### Diagram Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   Cloud Load Balancer (Auto)  │
         └───────────────┬───────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────┐            ┌─────────────────┐
│  Cloud Run      │            │  Cloud Run      │
│  (Frontend)     │            │  (Backend)      │
│                 │            │                 │
│  React + Nginx  │◄──────────►│  Express.js     │
│  Port: 80       │            │  Port: 8080     │
└─────────────────┘            └────────┬────────┘
                                        │
                        ┌───────────────┼───────────────┐
                        │               │               │
                        ▼               ▼               ▼
              ┌──────────────┐ ┌──────────────┐ ┌──────────┐
              │ VPC Network  │ │ Cloud SQL    │ │  Redis   │
              │              │ │ (MySQL 8.0)  │ │Memorystore│
              │ VPC Connector│ │ Private IP   │ │Private IP│
              └──────────────┘ └──────────────┘ └──────────┘
```

### Komponen Infrastruktur

| Komponen | Service GCP | Fungsi |
|----------|-------------|--------|
| Frontend | Cloud Run | Serve React SPA dengan nginx |
| Backend | Cloud Run | REST API dengan Express.js |
| Database | Cloud SQL | MySQL 8.0 database |
| Cache | Redis Memorystore | Session & query caching |
| Network | VPC + VPC Connector | Private networking untuk database |
| Container Registry | GCR | Menyimpan Docker images |
| IaC | Terraform | Automate infrastructure provisioning |

---

## PRASYARAT

### Hardware Requirements
- **Processor**: Dual-core atau lebih
- **RAM**: Minimal 8GB (16GB recommended)
- **Storage**: Minimal 20GB free space
- **Network**: Koneksi internet stabil (minimal 5 Mbps)

### Software Requirements
- **OS**: Windows 10/11, macOS 10.14+, atau Linux (Ubuntu 20.04+)
- **Browser**: Chrome/Firefox terbaru
- **Terminal**: PowerShell (Windows), Terminal (macOS/Linux)
- **Text Editor**: VS Code, Sublime, atau sejenisnya

### Account Requirements
- **Google Account**: Untuk GCP
- **Credit/Debit Card**: Untuk verifikasi GCP (tidak akan di-charge jika pakai free trial)
- **Email**: Aktif untuk notifikasi

### Knowledge Requirements
- Dasar-dasar command line
- Konsep Docker & containerization
- Dasar-dasar SQL
- Konsep REST API

---

## BAGIAN 1: PERSIAPAN AKUN GCP

### 1.1 Registrasi Google Cloud Platform

**Langkah:**

1. **Akses GCP Console**
   - URL: https://cloud.google.com
   - Klik "Get started for free" atau "Coba gratis"

2. **Login dengan Google Account**
   - Pilih akun Google yang akan digunakan
   - Atau buat akun Google baru jika belum punya

3. **Isi Informasi Billing**
   - Country: Pilih negara Anda
   - Account type: Individual
   - Terms of Service: Checklist persetujuan

4. **Verifikasi Payment Method**
   - Masukkan kartu kredit/debit
   - Akan ada charge kecil untuk verifikasi (akan di-refund)
   - Tidak akan auto-charge setelah trial kecuali Anda upgrade

5. **Aktivasi Free Trial**
   - Kredit: $300 USD
   - Durasi: 90 hari
   - Cukup untuk development & testing

### 1.2 Buat Project GCP

**Langkah:**

1. Buka GCP Console: https://console.cloud.google.com

2. Klik **project dropdown** (sebelah logo GCP)

3. Klik **"NEW PROJECT"**

4. Isi form:
   ```
   Project name: iterary-library
   Project ID: iterary-library-xxxxx (auto-generated, catat ini!)
   Organization: No organization
   Location: No organization
   ```

5. Klik **CREATE**

6. Tunggu ~30 detik hingga project selesai dibuat

7. **Select project** yang baru dibuat dari dropdown

### 1.3 Enable Required APIs

**APIs yang perlu di-enable:**

| API Name | Purpose |
|----------|---------|
| Compute Engine API | Virtual machines & networking |
| Cloud SQL Admin API | Managed database |
| Cloud Run Admin API | Serverless containers |
| Serverless VPC Access API | VPC networking for Cloud Run |
| Service Networking API | Private IP peering |
| Container Registry API | Docker image storage |
| Cloud Memorystore for Redis API | Redis cache |

**Cara Enable:**

1. Navigation menu (☰) → **APIs & Services** → **Library**

2. Untuk setiap API di atas:
   - Search nama API
   - Klik API card
   - Klik **ENABLE**
   - Tunggu ~10-30 detik

3. **Verifikasi** semua APIs enabled:
   - APIs & Services → **Dashboard**
   - Harus muncul 7+ APIs dalam list

**PENTING**: Tunggu 2-3 menit setelah enable semua APIs sebelum lanjut ke step berikutnya!

### 1.4 Setup Billing Alert (Recommended)

**Untuk menghindari biaya tak terduga:**

1. Navigation menu → **Billing**

2. Pilih billing account → **Budgets & alerts**

3. **CREATE BUDGET**:
   ```
   Name: Monthly Budget Alert
   Projects: (pilih project Anda)
   Budget type: Specified amount
   Target amount: $50 (atau sesuai kebutuhan)
   ```

4. Set alert thresholds:
   - 50% of budget: Email alert
   - 90% of budget: Email alert
   - 100% of budget: Email alert

5. Add email notification

6. **SAVE**

---

## BAGIAN 2: INSTALL TOOLS

### 2.1 Install Google Cloud SDK (gcloud CLI)

**Windows:**

```powershell
# Download installer
# URL: https://cloud.google.com/sdk/docs/install

# Jalankan GoogleCloudSDKInstaller.exe
# Follow wizard → Install

# Setelah install, restart terminal

# Initialize gcloud
gcloud init

# Login
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Set region
gcloud config set compute/region asia-southeast2
```

**macOS:**

```bash
# Install via Homebrew
brew install --cask google-cloud-sdk

# Initialize
gcloud init

# Login
gcloud auth login

# Set project & region
gcloud config set project YOUR_PROJECT_ID
gcloud config set compute/region asia-southeast2
```

**Linux (Ubuntu/Debian):**

```bash
# Add Cloud SDK repo
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list

# Import Google Cloud public key
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -

# Update and install
sudo apt-get update && sudo apt-get install google-cloud-sdk

# Initialize
gcloud init
```

**Verify Installation:**

```bash
gcloud version
# Output: Google Cloud SDK 4xx.x.x
```

### 2.2 Install Terraform

**Windows:**

```powershell
# Download dari https://www.terraform.io/downloads
# Pilih Windows AMD64

# Extract ZIP ke folder (misal: C:\terraform\)

# Tambah ke PATH:
# Settings → System → Environment Variables
# Edit Path → New → C:\terraform

# Verify (terminal baru)
terraform version
```

**macOS:**

```bash
# Install via Homebrew
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Verify
terraform version
```

**Linux:**

```bash
# Download binary
wget https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_linux_amd64.zip

# Extract
unzip terraform_1.7.0_linux_amd64.zip

# Move to /usr/local/bin
sudo mv terraform /usr/local/bin/

# Verify
terraform version
```

### 2.3 Install Docker Desktop

**Windows:**

1. Download: https://www.docker.com/products/docker-desktop
2. Install Docker Desktop for Windows
3. **Restart komputer** (wajib!)
4. Start Docker Desktop
5. Tunggu hingga status "Docker Desktop is running"

**macOS:**

1. Download: https://www.docker.com/products/docker-desktop
2. Install Docker.dmg
3. Jalankan aplikasi Docker
4. Tunggu hingga Docker whale icon di menu bar aktif

**Linux:**

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group (agar tidak perlu sudo)
sudo usermod -aG docker $USER

# Logout & login ulang
```

**Verify Docker:**

```bash
docker --version
docker ps
# Output: Empty list (normal jika belum ada container)
```

### 2.4 Configure Docker untuk GCR

```bash
gcloud auth configure-docker gcr.io
```

**Output:**
```
Adding credentials for: gcr.io
```

### 2.5 Setup Application Default Credentials

```bash
gcloud auth application-default login
```

Browser akan terbuka → Login → Allow permissions

**Output:**
```
Credentials saved to file: [~/.config/gcloud/application_default_credentials.json]
```

---

## BAGIAN 3: PERSIAPAN KODE APLIKASI

### 3.1 Struktur Project

```
project-root/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js              # MySQL connection
│   │   │   └── redis.js           # Redis connection
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── bookController.js
│   │   │   ├── borrowingController.js
│   │   │   └── statsController.js
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT middleware
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── books.js
│   │   │   ├── borrowings.js
│   │   │   └── stats.js
│   │   └── server.js              # Express app entry
│   ├── .dockerignore
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── pages/                 # Page components
│   │   ├── services/              # API calls
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── .dockerignore
│   ├── .env                       # Environment variables
│   ├── Dockerfile
│   ├── nginx.conf                 # Nginx config
│   ├── package.json
│   └── vite.config.js
│
├── terraform/
│   ├── main.tf                    # Main infrastructure config
│   ├── variables.tf               # Variable definitions
│   ├── outputs.tf                 # Output values
│   └── terraform.tfvars           # Variable values (gitignore!)
│
├── database/
│   └── schema.sql                 # Database schema & initial data
│
├── .gitignore
└── README.md
```

### 3.2 File Konfigurasi Penting

#### Backend Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# IMPORTANT: Use 'npm install' NOT 'npm ci' if no package-lock.json
RUN npm install --production

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Start application
CMD ["node", "src/server.js"]
```

#### Frontend Dockerfile

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Frontend nginx.conf

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

#### Frontend .dockerignore

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

**CRITICAL**: `.env` file **TIDAK boleh** ada di .dockerignore! File ini harus masuk ke Docker image.

#### Frontend .env

```env
VITE_API_URL=https://your-backend-url.run.app
```

**PENTING**:
- Ganti `your-backend-url.run.app` dengan backend URL setelah deploy
- Vite menggunakan build-time environment variables
- File .env harus ada SEBELUM build Docker image

### 3.3 Fix Backend untuk MySQL Cloud SQL

**Issue**: MySQL 8.0 Cloud SQL strict dengan prepared statement parameters.

**Solution**: Gunakan template literals untuk LIMIT/OFFSET, bukan prepared statement placeholders.

#### File: backend/src/controllers/bookController.js

```javascript
// ❌ WRONG (akan error di Cloud SQL)
const booksQuery = `
  SELECT * FROM books
  WHERE ${whereClause}
  ORDER BY ${sortField} ASC
  LIMIT ? OFFSET ?
`;
const books = await query(booksQuery, [...queryParams, limit, offset]);

// ✅ CORRECT
const booksQuery = `
  SELECT * FROM books
  WHERE ${whereClause}
  ORDER BY ${sortField} ASC
  LIMIT ${limit} OFFSET ${offset}
`;
const books = await query(booksQuery, queryParams);
```

**Apply fix yang sama di**:
- `backend/src/controllers/borrowingController.js`
- `backend/src/controllers/statsController.js`

**Alasan**: Cloud SQL MySQL 8.0 tidak menerima integer parameters untuk LIMIT/OFFSET via prepared statements. Harus hardcode values atau gunakan template literals.

---

## BAGIAN 4: CONTAINERIZATION DENGAN DOCKER

### 4.1 Build Backend Image

**Command:**

```bash
# Ganti PROJECT_ID dengan project ID GCP Anda
export PROJECT_ID=your-gcp-project-id

# Build image
docker build -t gcr.io/$PROJECT_ID/backend:latest ./backend

# Atau dengan --no-cache untuk fresh build
docker build --no-cache -t gcr.io/$PROJECT_ID/backend:latest ./backend
```

**Windows PowerShell:**

```powershell
$PROJECT_ID="your-gcp-project-id"
docker build -t gcr.io/$PROJECT_ID/backend:latest ./backend
```

**Expected Output:**

```
[+] Building 15.2s (10/10) FINISHED
 => [internal] load build definition
 => [internal] load .dockerignore
 => [1/5] FROM docker.io/library/node:18-alpine
 => [2/5] WORKDIR /app
 => [3/5] COPY package*.json ./
 => [4/5] RUN npm install --production
 => [5/5] COPY . .
 => exporting to image
 => => naming to gcr.io/your-project/backend:latest
```

**Estimated Time**: 15-30 seconds

### 4.2 Build Frontend Image

**IMPORTANT**: Buat file `.env` terlebih dahulu!

**File: frontend/.env**

```env
VITE_API_URL=https://placeholder.run.app
```

(URL akan diupdate setelah backend deployed)

**Command:**

```bash
docker build -t gcr.io/$PROJECT_ID/frontend:latest ./frontend
```

**Expected Output:**

```
[+] Building 720.5s (15/15) FINISHED
 => [builder 1/6] FROM docker.io/library/node:18-alpine
 => [builder 4/6] RUN npm install
 => [builder 5/6] COPY . .
 => [builder 6/6] RUN npm run build
 => [stage-1 2/3] COPY --from=builder /app/dist /usr/share/nginx/html
 => exporting to image
```

**Estimated Time**: 10-15 minutes (karena npm install banyak dependencies)

### 4.3 Test Images Locally (Optional)

**Test Backend:**

```bash
# Run backend container
docker run -p 8080:8080 \
  -e NODE_ENV=development \
  -e DB_HOST=localhost \
  -e DB_USER=root \
  -e DB_PASSWORD=password \
  -e DB_NAME=iterary \
  gcr.io/$PROJECT_ID/backend:latest

# Test endpoint
curl http://localhost:8080/api/health
```

**Test Frontend:**

```bash
# Run frontend container
docker run -p 80:80 gcr.io/$PROJECT_ID/frontend:latest

# Open browser
# http://localhost
```

**Stop containers:**

```bash
docker ps
docker stop <container_id>
```

### 4.4 Push Images ke Google Container Registry

**Login Docker ke GCR:**

```bash
gcloud auth configure-docker gcr.io
```

**Push Backend:**

```bash
docker push gcr.io/$PROJECT_ID/backend:latest
```

**Estimated Time**: 2-5 minutes

**Push Frontend:**

```bash
docker push gcr.io/$PROJECT_ID/frontend:latest
```

**Estimated Time**: 1-3 minutes

**Verify Upload:**

```bash
gcloud container images list --repository=gcr.io/$PROJECT_ID
```

**Expected Output:**

```
NAME
gcr.io/your-project/backend
gcr.io/your-project/frontend
```

**Atau verify via GCP Console:**

1. Navigation menu → **Container Registry**
2. Harus muncul 2 repositories: backend & frontend

---

## BAGIAN 5: INFRASTRUCTURE AS CODE DENGAN TERRAFORM

### 5.1 Terraform Configuration Files

#### File: terraform/variables.tf

```hcl
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "asia-southeast2"
}

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "iterary"
}

variable "db_user" {
  description = "Database user"
  type        = string
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
}

variable "backend_image" {
  description = "Backend Docker image URL"
  type        = string
}

variable "frontend_image" {
  description = "Frontend Docker image URL"
  type        = string
}
```

#### File: terraform/terraform.tfvars

```hcl
project_id = "your-gcp-project-id"
region     = "asia-southeast2"

db_tier     = "db-f1-micro"
db_name     = "iterary"
db_user     = "app_user"
db_password = "YourSecurePassword123!"

jwt_secret = "your-super-secret-jwt-key-min-32-chars"

backend_image  = "gcr.io/your-project-id/backend:latest"
frontend_image = "gcr.io/your-project-id/frontend:latest"
```

**PENTING**:
- Ganti `your-gcp-project-id` dengan project ID Anda
- Gunakan password yang kuat (min 8 chars, uppercase, lowercase, number, symbol)
- JWT secret minimal 32 karakter random
- **JANGAN commit terraform.tfvars ke git!** (tambahkan ke .gitignore)

#### File: terraform/main.tf

```hcl
# Provider configuration
terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# VPC Network
resource "google_compute_network" "vpc_network" {
  name                    = "iterary-vpc"
  auto_create_subnetworks = false
}

# Subnet
resource "google_compute_subnetwork" "subnet" {
  name          = "iterary-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc_network.id
}

# Private IP address range for Cloud SQL
resource "google_compute_global_address" "private_ip_address" {
  name          = "private-ip-address"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc_network.id
}

# Private VPC connection
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# Cloud SQL Instance
resource "google_sql_database_instance" "mysql_instance" {
  name             = "iterary-db-${random_id.db_suffix.hex}"
  database_version = "MYSQL_8_0"
  region           = var.region

  depends_on = [google_service_networking_connection.private_vpc_connection]

  settings {
    tier = var.db_tier

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc_network.id
    }

    backup_configuration {
      enabled            = true
      start_time         = "03:00"
      binary_log_enabled = true
    }
  }

  deletion_protection = false
}

# Random suffix for DB instance name
resource "random_id" "db_suffix" {
  byte_length = 4
}

# Database
resource "google_sql_database" "database" {
  name     = var.db_name
  instance = google_sql_database_instance.mysql_instance.name
}

# Database user
resource "google_sql_user" "db_user" {
  name     = var.db_user
  instance = google_sql_database_instance.mysql_instance.name
  password = var.db_password
}

# VPC Connector for Cloud Run
resource "google_vpc_access_connector" "connector" {
  name          = "iterary-connector"
  region        = var.region
  network       = google_compute_network.vpc_network.name
  ip_cidr_range = "10.8.0.0/28"
}

# Redis Instance
resource "google_redis_instance" "cache" {
  name           = "iterary-redis"
  tier           = "BASIC"
  memory_size_gb = 1
  region         = var.region

  authorized_network = google_compute_network.vpc_network.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# Cloud Run - Backend
resource "google_cloud_run_service" "backend" {
  name     = "iterary-api"
  location = var.region

  template {
    spec {
      containers {
        image = var.backend_image

        env {
          name  = "NODE_ENV"
          value = "production"
        }

        # IMPORTANT: Do NOT set PORT manually
        # Cloud Run sets it automatically

        env {
          name  = "DB_HOST"
          value = google_sql_database_instance.mysql_instance.private_ip_address
        }

        env {
          name  = "DB_USER"
          value = var.db_user
        }

        env {
          name  = "DB_PASSWORD"
          value = var.db_password
        }

        env {
          name  = "DB_NAME"
          value = var.db_name
        }

        env {
          name  = "REDIS_HOST"
          value = google_redis_instance.cache.host
        }

        env {
          name  = "REDIS_PORT"
          value = tostring(google_redis_instance.cache.port)
        }

        env {
          name  = "JWT_SECRET"
          value = var.jwt_secret
        }

        resources {
          limits = {
            cpu    = "1000m"
            memory = "512Mi"
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale"        = "10"
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.connector.id
        "run.googleapis.com/vpc-access-egress"    = "private-ranges-only"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

# Cloud Run - Frontend
resource "google_cloud_run_service" "frontend" {
  name     = "iterary-frontend"
  location = var.region

  template {
    spec {
      containers {
        image = var.frontend_image

        resources {
          limits = {
            cpu    = "1000m"
            memory = "256Mi"
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale" = "10"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

# IAM - Allow public access
resource "google_cloud_run_service_iam_member" "backend_public" {
  service  = google_cloud_run_service.backend.name
  location = google_cloud_run_service.backend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_service_iam_member" "frontend_public" {
  service  = google_cloud_run_service.frontend.name
  location = google_cloud_run_service.frontend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
```

#### File: terraform/outputs.tf

```hcl
output "backend_url" {
  description = "Backend Cloud Run URL"
  value       = google_cloud_run_service.backend.status[0].url
}

output "frontend_url" {
  description = "Frontend Cloud Run URL"
  value       = google_cloud_run_service.frontend.status[0].url
}

output "db_connection_name" {
  description = "Cloud SQL connection name"
  value       = google_sql_database_instance.mysql_instance.connection_name
}

output "db_private_ip" {
  description = "Cloud SQL private IP"
  value       = google_sql_database_instance.mysql_instance.private_ip_address
  sensitive   = true
}

output "redis_host" {
  description = "Redis host IP"
  value       = google_redis_instance.cache.host
  sensitive   = true
}
```

### 5.2 Initialize Terraform

```bash
cd terraform/

terraform init
```

**Expected Output:**

```
Initializing the backend...

Initializing provider plugins...
- Finding hashicorp/google versions matching "~> 5.0"...
- Installing hashicorp/google v5.x.x...
- Installed hashicorp/google v5.x.x

Terraform has been successfully initialized!
```

### 5.3 Validate Configuration

```bash
terraform validate
```

**Expected Output:**

```
Success! The configuration is valid.
```

### 5.4 Plan Deployment

```bash
terraform plan
```

**Expected Output:**

```
Terraform will perform the following actions:

  # google_cloud_run_service.backend will be created
  # google_cloud_run_service.frontend will be created
  # google_compute_network.vpc_network will be created
  # google_sql_database_instance.mysql_instance will be created
  # google_redis_instance.cache will be created
  # ... (dan lainnya)

Plan: 12 to add, 0 to change, 0 to destroy.
```

**Review output** untuk memastikan semua resources yang akan dibuat sudah benar.

---

## BAGIAN 6: DEPLOYMENT KE GCP

### 6.1 Deploy Infrastructure

```bash
terraform apply
```

**Confirmation prompt:**

```
Do you want to perform these actions?
  Terraform will perform the actions described above.
  Only 'yes' will be accepted to approve.

  Enter a value:
```

**Ketik:** `yes` + Enter

**Deployment Timeline:**

| Resource | Estimated Time |
|----------|----------------|
| VPC Network | 1-2 minutes |
| VPC Peering | 2-3 minutes |
| VPC Connector | 3-5 minutes |
| **Cloud SQL** | **20-25 minutes** ⏰ |
| Redis Memorystore | 5-8 minutes |
| Cloud Run (backend) | 2-3 minutes |
| Cloud Run (frontend) | 2-3 minutes |
| **TOTAL** | **30-40 minutes** |

**Expected Final Output:**

```
Apply complete! Resources: 12 added, 0 changed, 0 destroyed.

Outputs:

backend_url = "https://iterary-api-abc123-xx.a.run.app"
db_connection_name = "your-project:asia-southeast2:iterary-db-xyz789"
db_private_ip = <sensitive>
frontend_url = "https://iterary-frontend-abc123-xx.a.run.app"
redis_host = <sensitive>
```

**CATAT URLs ini!** Akan digunakan untuk konfigurasi selanjutnya.

### 6.2 View Outputs

```bash
# View all outputs
terraform output

# View specific output (including sensitive)
terraform output -raw db_private_ip
terraform output -raw redis_host
```

### 6.3 Verify Deployment via GCP Console

**Check Cloud Run:**

1. Navigation menu → **Cloud Run**
2. Harus ada 2 services:
   - `iterary-api` (status: ✓ Ready)
   - `iterary-frontend` (status: ✓ Ready)

**Check Cloud SQL:**

1. Navigation menu → **SQL**
2. Harus ada instance: `iterary-db-xxxxx` (status: Available)

**Check VPC:**

1. Navigation menu → **VPC Network**
2. Harus ada network: `iterary-vpc`

**Check Redis:**

1. Navigation menu → **Memorystore** → **Redis**
2. Harus ada instance: `iterary-redis` (status: Ready)

---

## BAGIAN 7: DATABASE SETUP

### 7.1 Upload Schema ke Cloud Storage

**Create bucket:**

```bash
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$PROJECT_ID-sql-import
```

**Upload schema file:**

```bash
gsutil cp database/schema.sql gs://$PROJECT_ID-sql-import/
```

**Verify upload:**

```bash
gsutil ls gs://$PROJECT_ID-sql-import/
```

### 7.2 Import Database Schema

**Via GCP Console (RECOMMENDED):**

1. **SQL** → Select instance `iterary-db-xxxxx`

2. Klik tab **IMPORT**

3. Klik button **IMPORT**

4. Form import:
   - File format: **SQL**
   - Cloud Storage file: **Browse** → Select `schema.sql`
   - Database: **iterary** (pilih dari dropdown)

5. Klik **IMPORT**

6. Tunggu 1-2 menit

7. Verify status: "Succeeded" dengan checkmark hijau

**Via gcloud (Alternative):**

```bash
# Get Cloud SQL connection name
CONNECTION_NAME=$(terraform output -raw db_connection_name)

# Import
gcloud sql import sql $CONNECTION_NAME \
  gs://$PROJECT_ID-sql-import/schema.sql \
  --database=iterary
```

### 7.3 Verify Tables Created

**Via Cloud Shell:**

```bash
# Connect ke Cloud SQL
gcloud sql connect iterary-db-xxxxx --user=app_user

# Enter password saat diminta

# Select database
USE iterary;

# Show tables
SHOW TABLES;
```

**Expected output:**

```
+-------------------+
| Tables_in_iterary |
+-------------------+
| admins            |
| books             |
| borrowings        |
| members           |
+-------------------+
4 rows in set (0.00 sec)
```

```bash
# Exit MySQL
EXIT;
```

### 7.4 Insert Sample Data

**Connect ke database:**

```bash
gcloud sql connect iterary-db-xxxxx --user=app_user
USE iterary;
```

**Insert admin user:**

```sql
INSERT INTO admins (username, email, password, full_name, role, status)
VALUES (
  'admin',
  'admin@library.com',
  '$2b$10$rZ8qHJ5KvL.nW9y2xJ3F0eYhZJ1QX9FvH3L4tK2mN5oP6qR7sS8tT',
  'System Administrator',
  'super_admin',
  'active'
);
```

**Login credentials:**
- Username: `admin`
- Password: `admin123`

**Insert sample books:**

```sql
INSERT INTO books (isbn, title, author, publisher, year_published, category, total_copies, available_copies, description)
VALUES
('978-0-13-468599-1', 'Clean Code', 'Robert C. Martin', 'Prentice Hall', 2008, 'Programming', 3, 3, 'A handbook of agile software craftsmanship'),
('978-0-596-52068-7', 'JavaScript: The Good Parts', 'Douglas Crockford', "O'Reilly Media", 2008, 'Programming', 2, 2, 'Unearthing the excellence in JavaScript'),
('978-1-449-35573-9', 'Learning React', 'Alex Banks, Eve Porcello', "O'Reilly Media", 2020, 'Web Development', 4, 4, 'Modern patterns for developing React apps'),
('978-0-134-68566-3', 'Effective Java', 'Joshua Bloch', 'Addison-Wesley', 2018, 'Programming', 2, 2, 'Best practices for the Java platform'),
('978-1-491-95027-5', 'Designing Data-Intensive Applications', 'Martin Kleppmann', "O'Reilly Media", 2017, 'Database', 3, 3, 'The big ideas behind reliable, scalable systems');
```

**Verify data:**

```sql
SELECT COUNT(*) FROM admins;
SELECT COUNT(*) FROM books;

SELECT id, title, author FROM books;

EXIT;
```

---

## BAGIAN 8: TESTING & VERIFICATION

### 8.1 Update Frontend Environment Variable

**Get backend URL dari Terraform:**

```bash
terraform output backend_url
```

Output: `https://iterary-api-abc123-xx.a.run.app`

**Update file frontend/.env:**

```env
VITE_API_URL=https://iterary-api-abc123-xx.a.run.app
```

**Rebuild & redeploy frontend:**

```bash
# Rebuild image
docker build --no-cache -t gcr.io/$PROJECT_ID/frontend:latest ./frontend

# Push to GCR
docker push gcr.io/$PROJECT_ID/frontend:latest

# Redeploy Cloud Run
gcloud run deploy iterary-frontend \
  --image gcr.io/$PROJECT_ID/frontend:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated
```

**Wait ~2-3 minutes** untuk deployment selesai.

### 8.2 Test Backend API

**Health check:**

```bash
BACKEND_URL=$(terraform output -raw backend_url)

curl $BACKEND_URL/api/health
```

**Expected response:**

```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2025-01-28T12:00:00.000Z"
}
```

**Get books:**

```bash
curl $BACKEND_URL/api/books
```

**Expected response:**

```json
{
  "success": true,
  "data": {
    "books": [
      {
        "id": 1,
        "isbn": "978-0-13-468599-1",
        "title": "Clean Code",
        "author": "Robert C. Martin",
        ...
      },
      ...
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "total_pages": 1
    }
  }
}
```

**Admin login:**

```bash
curl -X POST $BACKEND_URL/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Expected response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": 1,
      "username": "admin",
      "email": "admin@library.com",
      "role": "super_admin"
    }
  }
}
```

### 8.3 Test Frontend Application

**Get frontend URL:**

```bash
terraform output frontend_url
```

**Open browser:**

```
https://iterary-frontend-abc123-xx.a.run.app
```

**Test scenarios:**

1. **Home page loads**
   - ✓ Navbar visible
   - ✓ Book catalog displays
   - ✓ All 5 books shown

2. **Search functionality**
   - Search: "Clean"
   - ✓ Shows "Clean Code" book

3. **Category filter**
   - Filter: "Programming"
   - ✓ Shows 3 programming books

4. **Admin login**
   - Click "Login" button
   - Username: `admin`
   - Password: `admin123`
   - ✓ Redirects to dashboard

5. **Dashboard stats**
   - ✓ Total Books: 5
   - ✓ Total Available: 14
   - ✓ Active Borrowings: 0

6. **Add new book (Admin)**
   - Dashboard → "Add Book"
   - Fill form with test data
   - Submit
   - ✓ Book appears in catalog

### 8.4 Performance Testing (Optional)

**Load testing dengan Apache Bench:**

```bash
# Install ab (Apache Bench)
# Ubuntu: sudo apt-get install apache2-utils
# macOS: Already installed

# Test backend
ab -n 100 -c 10 $BACKEND_URL/api/books

# Results should show:
# - Requests per second: >50
# - Mean response time: <500ms
```

---

## BAGIAN 9: MONITORING & MAINTENANCE

### 9.1 Cloud Monitoring

**Setup monitoring:**

1. Navigation menu → **Monitoring**

2. **Dashboards** → Create dashboard

3. Add widgets:
   - **Cloud Run requests** (iterary-api)
   - **Cloud Run latency** (iterary-api)
   - **Cloud SQL connections**
   - **Cloud SQL CPU utilization**
   - **Redis memory usage**

**Set up alerts:**

1. **Alerting** → Create Policy

2. Example alert: High error rate
   ```
   Condition: Cloud Run request count (error)
   Threshold: > 10 errors in 5 minutes
   Notification: Email
   ```

### 9.2 Logging

**View logs:**

```bash
# Backend logs
gcloud run services logs read iterary-api \
  --region=$REGION \
  --limit=50

# Filter errors only
gcloud run services logs read iterary-api \
  --region=$REGION \
  --filter="severity>=ERROR" \
  --limit=50
```

**Logs Explorer (Console):**

1. Navigation menu → **Logging** → **Logs Explorer**

2. Query:
   ```
   resource.type="cloud_run_revision"
   resource.labels.service_name="iterary-api"
   severity>=ERROR
   ```

### 9.3 Cost Management

**View current costs:**

1. Navigation menu → **Billing** → **Reports**

2. Filter:
   - Time range: This month
   - Projects: Your project
   - Group by: Service

**Expected monthly costs** (after free trial):

| Service | Cost |
|---------|------|
| Cloud SQL (db-f1-micro) | $7-10 |
| Cloud Run (both services) | $2-5 |
| Redis Memorystore (1GB) | $10-15 |
| VPC/Networking | $1-2 |
| Storage (GCR + Cloud Storage) | $0.50-1 |
| **TOTAL** | **~$20-35/month** |

**Cost optimization tips:**

- Gunakan `db-f1-micro` untuk development
- Set autoscaling maxScale sesuai kebutuhan
- Delete unused Docker images di GCR
- Enable Cloud SQL auto-stop (jika tidak 24/7)

### 9.4 Backup Strategy

**Automated backups (sudah di-enable via Terraform):**

- Cloud SQL: Daily backup at 03:00 UTC
- Retention: 7 days (default)

**Manual backup:**

```bash
# Create on-demand backup
gcloud sql backups create \
  --instance=iterary-db-xxxxx
```

**Restore dari backup:**

```bash
# List backups
gcloud sql backups list --instance=iterary-db-xxxxx

# Restore
gcloud sql backups restore BACKUP_ID \
  --backup-instance=iterary-db-xxxxx \
  --backup-id=BACKUP_ID
```

---

## BAGIAN 10: TROUBLESHOOTING

### 10.1 Frontend tidak bisa akses Backend

**Symptoms:**
- Console error: `Failed to fetch`
- Network tab: `ERR_CONNECTION_REFUSED` atau request ke `localhost:8080`

**Root cause:**
Frontend masih menggunakan localhost URL, bukan production backend URL.

**Solution:**

1. Verify `.env` file:
   ```bash
   cat frontend/.env
   ```
   Harus berisi production backend URL.

2. Verify `.dockerignore`:
   ```bash
   cat frontend/.dockerignore
   ```
   **Pastikan `.env` TIDAK ada di .dockerignore!**

3. Rebuild frontend:
   ```bash
   docker build --no-cache -t gcr.io/$PROJECT_ID/frontend:latest ./frontend
   docker push gcr.io/$PROJECT_ID/frontend:latest
   gcloud run deploy iterary-frontend --image gcr.io/$PROJECT_ID/frontend:latest --platform managed --region $REGION --allow-unauthenticated
   ```

### 10.2 Backend Error 500: MySQL Parameter Error

**Symptoms:**
```json
{
  "success": false,
  "message": "Error: Incorrect arguments to mysqld_stmt_execute",
  "errno": 1210
}
```

**Root cause:**
Cloud SQL MySQL 8.0 tidak accept integer parameters untuk LIMIT/OFFSET via prepared statements.

**Solution:**

Ganti prepared statement placeholders dengan template literals:

**File: backend/src/controllers/bookController.js**

```javascript
// ❌ WRONG
LIMIT ? OFFSET ?
const books = await query(booksQuery, [...queryParams, limit, offset]);

// ✅ CORRECT
LIMIT ${limit} OFFSET ${offset}
const books = await query(booksQuery, queryParams);
```

Apply fix yang sama di semua controller files yang menggunakan LIMIT/OFFSET.

Rebuild & redeploy backend:

```bash
docker build --no-cache -t gcr.io/$PROJECT_ID/backend:latest ./backend
docker push gcr.io/$PROJECT_ID/backend:latest
gcloud run deploy iterary-api --image gcr.io/$PROJECT_ID/backend:latest --platform managed --region $REGION --allow-unauthenticated
```

### 10.3 Cloud SQL Connection Timeout

**Symptoms:**
```
Error: connect ETIMEDOUT
```

**Root cause:**
VPC Connector tidak terhubung atau Cloud SQL belum siap.

**Solutions:**

**Check 1**: Verify VPC Connector status

```bash
gcloud compute networks vpc-access connectors list --region=$REGION
```

Status harus: `READY`

**Check 2**: Verify Cloud Run menggunakan connector

```bash
gcloud run services describe iterary-api --region=$REGION --format="value(spec.template.metadata.annotations)"
```

Harus ada: `run.googleapis.com/vpc-access-connector`

**Check 3**: Wait for Cloud SQL to fully initialize

Cloud SQL butuh 20-30 menit setelah creation untuk fully ready. Check status:

```bash
gcloud sql instances describe iterary-db-xxxxx --format="value(state)"
```

Output harus: `RUNNABLE`

**Fix**: Re-apply Terraform

```bash
terraform apply
```

### 10.4 Terraform Error: APIs Not Enabled

**Symptoms:**
```
Error 403: Compute Engine API has not been used in project before
```

**Solution:**

1. Enable API manually:
   - GCP Console → APIs & Services → Library
   - Search API name → Enable

2. **WAIT 5 MINUTES** (API activation needs propagation time)

3. Retry:
   ```bash
   terraform apply
   ```

### 10.5 Docker Push Authentication Error

**Symptoms:**
```
denied: Permission "artifactregistry.repositories.uploadArtifacts" denied
```

**Solution:**

```bash
# Reconfigure Docker auth
gcloud auth configure-docker gcr.io

# Re-login
gcloud auth login

# Retry push
docker push gcr.io/$PROJECT_ID/backend:latest
```

### 10.6 Redis Connection Error

**Symptoms:**
```
Error: connect ETIMEDOUT (Redis)
```

**Solutions:**

**Check 1**: Verify Redis status

```bash
gcloud redis instances describe iterary-redis --region=$REGION
```

Status harus: `READY`

**Check 2**: Wait for initialization

Redis butuh 5-10 menit setelah creation. Be patient!

**Check 3**: Restart backend

```bash
gcloud run services update iterary-api --region=$REGION
```

### 10.7 High Cloud Run Cold Start Time

**Symptoms:**
First request setelah idle takes >5 seconds.

**Solutions:**

**Option 1**: Set minimum instances (ada biaya)

```hcl
# In terraform/main.tf
metadata {
  annotations = {
    "autoscaling.knative.dev/minScale" = "1"
  }
}
```

**Option 2**: Implement health check pinging

Setup Cloud Scheduler untuk ping `/api/health` setiap 5 menit.

**Option 3**: Accept cold starts (free tier friendly)

Cold starts normal untuk serverless. User pertama agak lambat, user selanjutnya cepat.

---

## REFERENSI

### Official Documentation

- **Google Cloud Platform**: https://cloud.google.com/docs
- **Cloud Run**: https://cloud.google.com/run/docs
- **Cloud SQL**: https://cloud.google.com/sql/docs
- **Terraform GCP Provider**: https://registry.terraform.io/providers/hashicorp/google/latest/docs
- **Docker**: https://docs.docker.com

### Pricing

- **GCP Pricing Calculator**: https://cloud.google.com/products/calculator
- **Cloud Run Pricing**: https://cloud.google.com/run/pricing
- **Cloud SQL Pricing**: https://cloud.google.com/sql/pricing
- **Redis Pricing**: https://cloud.google.com/memorystore/pricing

### Community & Support

- **Stack Overflow**: Tag `[google-cloud-platform]`
- **GCP Community**: https://www.googlecloudcommunity.com
- **Terraform Community**: https://discuss.hashicorp.com

### Tools

- **gcloud CLI**: https://cloud.google.com/sdk/gcloud
- **Terraform**: https://www.terraform.io
- **Docker**: https://www.docker.com

---

## PENUTUP

Tutorial ini memberikan panduan lengkap deployment aplikasi three-tier architecture ke Google Cloud Platform menggunakan modern DevOps practices:

- ✅ Infrastructure as Code (Terraform)
- ✅ Containerization (Docker)
- ✅ Serverless Computing (Cloud Run)
- ✅ Managed Database (Cloud SQL)
- ✅ Private Networking (VPC)
- ✅ Caching (Redis)

**Key Takeaways:**

1. Gunakan IaC untuk reproducible infrastructure
2. Containerize aplikasi untuk portability
3. Leverage managed services untuk reduce operational overhead
4. Implement monitoring & logging dari awal
5. Setup cost alerts untuk avoid surprises

**Next Steps:**

- Implement CI/CD pipeline (Cloud Build, GitHub Actions)
- Add custom domain & SSL certificate
- Setup CDN (Cloud CDN) untuk static assets
- Implement advanced monitoring (APM, tracing)
- Configure autoscaling policies
- Add disaster recovery plan

**Good luck dengan deployment Anda!** 🚀

---

**Document Version**: 1.0
**Last Updated**: January 2025
**Maintained By**: Infrastructure Team
