# ITERARY - Library Management System

**ITERA Repository Archive Reading facilitY**

> Your Library, Elevated

A modern three-tier web application for library management, built on Google Cloud Platform.

## 👥 Contributors

**Sistem Perpustakaan Digital ITERARY (ITERA Repository Archive Reading Facility)**

| No | Name | NIM |
|----|------|-----|
| 1 | Edwin Darren Hasannudin | 122140111 |
| 2 | Michael Caren Sihombing | 122140066 |
| 3 | Marchel Karuna Kwee | 122140065 |
| 4 | Muhammad Fauzan As Shabierin | 122140074 |
| 5 | Aditya Wahyu Suhendar | 122140235 |
| 6 | Dina Rahma Dita | 122140184 |

**Course**: IF25-40201 - Komputasi Awan
**Institution**: Institut Teknologi Sumatera

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Deployment to GCP](#deployment-to-gcp)
- [API Documentation](#api-documentation)
- [Contributors](#contributors)

## 🎯 Overview

ITERARY is a cloud-native library management system designed for Institut Teknologi Sumatera. Built as a three-tier web application deployed on Google Cloud Platform, it demonstrates modern cloud architecture patterns including containerization, managed databases, and serverless computing.

**Course:** IF25-40201 - Komputasi Awan
**Semester:** Genap 2024/2025
**Deliverable:** Iterasi 1 - MVP

## 🏗️ Architecture

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     PRESENTATION TIER                    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │     Cloud Run (Frontend)                       │    │
│  │     - React 18 + Vite                          │    │
│  │     - TailwindCSS                              │    │
│  │     - Nginx (Production)                       │    │
│  └────────────────────────────────────────────────┘    │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────┴───────────────────────────────────┐
│                    APPLICATION TIER                      │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │     Cloud Run (Backend API)                    │    │
│  │     - Node.js + Express                        │    │
│  │     - JWT Authentication                       │    │
│  │     - Raw SQL Queries                          │    │
│  └────────────────────────────────────────────────┘    │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────┴───────────────────────────────────┐
│                       DATA TIER                          │
│                                                          │
│  ┌─────────────────────┐      ┌──────────────────┐     │
│  │   Cloud SQL MySQL   │      │  Redis Memory-   │     │
│  │   - Private IP      │      │  store (Cache)   │     │
│  │   - Automated       │      │  - 1GB Basic     │     │
│  │     Backups         │      │  - 5min TTL      │     │
│  └─────────────────────┘      └──────────────────┘     │
│                                                          │
│              Connected via VPC Network                   │
└──────────────────────────────────────────────────────────┘
```

### GCP Services Used

- **Cloud Run**: Serverless containers untuk frontend & backend
- **Cloud SQL**: Managed MySQL 8.0 database
- **Redis Memorystore**: In-memory caching layer
- **VPC Network**: Private networking untuk database
- **Cloud Build**: CI/CD untuk containerization
- **Container Registry (GCR)**: Docker image storage
- **Terraform**: Infrastructure as Code

## ✨ Features

### For Members (Students)
- 📚 Browse book catalog with search & filter
- 📖 Borrow books online
- 📊 View borrowing history
- ⏰ Track due dates
- 💰 View fines for overdue books

### For Admins (Librarians)
- 📈 Dashboard with statistics
- 📚 Manage books (CRUD operations)
- 👥 View all borrowings
- ✅ Process book returns
- 🔍 Track overdue books
- 📊 View popular books

### Technical Features
- 🔐 JWT-based authentication
- 🚀 Redis caching (5-60s TTL)
- 🔄 Database transactions for consistency
- 📱 Responsive design
- ⚡ Fast API responses with caching
- 🛡️ Role-based access control (Admin/Member)

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Production Server**: Nginx

### Backend
- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Database**: MySQL 8.0 (Raw SQL)
- **Cache**: Redis 6.x
- **Authentication**: JWT (jsonwebtoken)
- **Security**: bcrypt, CORS
- **Connection Pool**: mysql2/promise

### Infrastructure
- **IaC**: Terraform
- **Containerization**: Docker
- **Cloud Platform**: Google Cloud Platform
- **Region**: asia-southeast2 (Jakarta)

## 📁 Project Structure

```
iterary/
├── backend/                 # Express.js API
│   ├── src/
│   │   ├── config/         # Database & Redis config
│   │   ├── controllers/    # Business logic
│   │   ├── middleware/     # Auth & error handling
│   │   ├── routes/         # API routes
│   │   └── server.js       # Entry point
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── context/       # Auth context
│   │   ├── pages/         # Page components
│   │   ├── utils/         # API client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.js
│
├── terraform/              # Infrastructure as Code
│   ├── main.tf            # Main configuration
│   ├── variables.tf       # Input variables
│   ├── outputs.tf         # Output values
│   ├── versions.tf        # Provider versions
│   ├── deploy.sh          # Deployment script
│   └── README.md
│
├── iterary-schema-mysql.sql   # Database schema
├── API_SPEC.md                # API documentation
├── iterary-usecase.drawio     # Use case diagram
└── README.md                  # This file
```

## 💻 Local Development

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- MySQL 8.0
- Redis (optional for local dev)

### Setup Backend

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Setup MySQL database
docker run -d --name iterary-mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=iterary \
  -p 3306:3306 mysql:8.0

# Import schema
docker cp ../iterary-schema-mysql.sql iterary-mysql:/tmp/
docker exec -it iterary-mysql mysql -uroot -ppassword iterary < /tmp/schema.sql

# Setup Redis (optional)
docker run -d --name iterary-redis -p 6379:6379 redis:6-alpine

# Configure environment
cp .env.example .env
# Edit .env with your values

# Start backend
npm run dev
# Backend runs on http://localhost:8080
```

### Setup Frontend

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set VITE_API_URL=http://localhost:8080

# Start development server
npm run dev
# Frontend runs on http://localhost:3000
```

### Test API

```bash
# Health check
curl http://localhost:8080/health

# Get books
curl http://localhost:8080/api/books

# Admin login (default credentials from schema)
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 🚀 Deployment to GCP

### Quick Deployment

```bash
cd terraform
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Enable required GCP APIs
2. Build & push Docker images to GCR
3. Create terraform.tfvars with generated secrets
4. Deploy all infrastructure with Terraform
5. Output frontend and API URLs

### Manual Deployment

See detailed instructions in [terraform/README.md](terraform/README.md)

### Post-Deployment

1. **Initialize Database**
   ```bash
   gcloud sql connect INSTANCE_NAME --user=iterary_user < iterary-schema-mysql.sql
   ```

2. **Access Application**
   - Frontend: Check `terraform output frontend_url`
   - API: Check `terraform output api_url`

3. **Default Credentials** (from schema)
   - Admin: `admin` / `admin123`
   - Member: Register via `/register` page

## 📚 API Documentation

See [API_SPEC.md](API_SPEC.md) for complete API documentation.

### Base URL
```
Production: https://iterary-api-xxxxx.run.app
Local: http://localhost:8080
```

### Key Endpoints

#### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/member-login` - Member login
- `POST /api/auth/register` - Member registration
- `GET /api/auth/me` - Get current user

#### Books
- `GET /api/books` - List books (search, filter, pagination)
- `GET /api/books/:id` - Get book details
- `POST /api/books` - Create book (admin only)
- `PUT /api/books/:id` - Update book (admin only)
- `DELETE /api/books/:id` - Delete book (admin only)

#### Borrowings
- `POST /api/borrowings` - Borrow book (member)
- `GET /api/borrowings/me` - My borrowings (member)
- `GET /api/borrowings` - All borrowings (admin)
- `PUT /api/borrowings/:id/return` - Process return (admin)

#### Stats
- `GET /api/stats/dashboard` - Dashboard stats (admin)
- `GET /api/stats/popular-books` - Popular books (public)

## 🔒 Security

- JWT-based authentication with secure secrets
- Password hashing with bcrypt
- Role-based access control (RBAC)
- SQL injection prevention (parameterized queries)
- CORS configuration
- Private VPC for database
- Environment-based configuration
- Security headers in Nginx

## 📊 Performance

- **Caching Strategy**:
  - Books list: 5 minutes
  - Book detail: 10 minutes
  - Categories: 1 hour
  - Dashboard stats: 1 minute

- **Database Optimization**:
  - Indexed foreign keys
  - Connection pooling (10 connections)
  - Efficient joins with views

- **Cloud Run**:
  - Auto-scaling (0-10 instances)
  - CPU: 1000m, Memory: 512Mi (backend)
  - CPU: 1000m, Memory: 256Mi (frontend)

## 💰 Cost Estimation

Monthly costs (Free tier eligible where applicable):

- Cloud Run: ~$0-5 (2M free requests)
- Cloud SQL (f1-micro): ~$7-10
- Redis (1GB Basic): ~$30
- VPC Connector: ~$8
- Networking: ~$2-5
- **Total**: ~$47-58/month

## 📄 License

This project is created for educational purposes as part of the Cloud Computing course at Institut Teknologi Sumatera.

## 🙏 Acknowledgments

- Google Cloud Platform for the three-tier app template
- Institut Teknologi Sumatera for the course
- All open-source libraries used in this project

---

**Built with ❤️ for ITERA**

*Last updated: January 2025*
