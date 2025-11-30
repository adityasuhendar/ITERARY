# 📋 Rangkuman Setup ITERARY - Backend & Frontend

## ✅ Yang Sudah Dikerjakan & Diperbaiki

### 1️⃣ **Setup Awal Environment**

#### Backend `.env` (d:\ITERARY\backend\.env)
```env
NODE_ENV=development
PORT=8080

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root          # ← Diubah dari kosong ke 'root'
DB_NAME=iterary

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

CORS_ORIGIN=*             # ← Diubah dari http://localhost:5173 → http://localhost:3000 → *
```

#### Frontend `.env` (d:\ITERARY\frontend\.env)
```env
VITE_API_URL=http://localhost:8080
```

---

### 2️⃣ **Database Setup dengan Docker**

**MySQL Container:**
```bash
docker run --name iterary-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=iterary -p 3306:3306 -d mysql:8.0
```

**Import Schema:**
```bash
Get-Content d:\ITERARY\iterary-schema-mysql.sql | docker exec -i iterary-mysql mysql -uroot -proot iterary
```

---

### 3️⃣ **Setup User dengan Password Hash yang Benar**

**File Baru:** `d:\ITERARY\backend\setup-users.js`
- Script untuk membuat admin dan member dengan bcrypt hash yang benar
- Admin: username `admin`, password `admin123`
- Member sample: email `budi@students.itera.ac.id`, password `member123`

**Jalankan:**
```bash
node d:\ITERARY\backend\setup-users.js
```

---

### 4️⃣ **Fix Frontend - Form Register**

**File:** `d:\ITERARY\frontend\src\pages\Register.jsx`

**Yang Ditambahkan:**
- Field **Member ID/NIM** (required)
- Removed field **Phone Number** (sesuai permintaan)

**Payload yang dikirim ke backend:**
```javascript
{
  member_id: formData.memberId,
  name: formData.fullName,
  email: formData.email,
  password: formData.password,
  member_type: 'student'
}
```

---

### 5️⃣ **Fix Frontend - Login Member**

**File:** `d:\ITERARY\frontend\src\pages\Login.jsx`

**Masalah:** Form mengirim `username` untuk member, backend expect `email`

**Solusi:**
```javascript
const credentials = loginType === 'member' 
  ? { email: formData.username, password: formData.password }
  : { username: formData.username, password: formData.password };
```

---

### 6️⃣ **Fix Frontend - AuthContext Error Handling**

**File:** `d:\ITERARY\frontend\src\context\AuthContext.jsx`

**Masalah:** Error `"undefined" is not valid JSON`

**Solusi:**
```javascript
if (token && savedUser && savedUser !== 'undefined') {
  try {
    setUser(JSON.parse(savedUser));
  } catch (error) {
    console.error('Error parsing saved user:', error);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}
```

---

### 7️⃣ **Fix Frontend - Prevent .map() Errors**

**File:** `d:\ITERARY\frontend\src\pages\BooksPage.jsx`

**Perubahan:**
```javascript
// Categories
const categoriesData = response.data.data;
setCategories(Array.isArray(categoriesData) ? categoriesData : []);

// Books
setBooks(Array.isArray(data.books) ? data.books : []);
```

**File:** `d:\ITERARY\frontend\src\pages\MemberDashboard.jsx`
```javascript
const data = response.data.data;
setBorrowings(Array.isArray(data) ? data : []);
```

**File:** `d:\ITERARY\frontend\src\pages\AdminDashboard.jsx`
```javascript
setStats(response.data.data || {});
```

**File:** `d:\ITERARY\frontend\src\pages\BookDetail.jsx`
```javascript
setBook(response.data.data || null);
```

---

### 8️⃣ **Fix Syntax Error - Duplikasi Kode**

**File:** `d:\ITERARY\frontend\src\pages\BooksPage.jsx`

**Masalah:** Ada duplikasi kode `finally` block yang menyebabkan syntax error

**Solusi:** Hapus duplikasi kode

---

## 📦 Dependencies yang Diinstall

### Backend
```bash
cd d:\ITERARY\backend
npm install
# 195 packages installed
```

### Frontend
```bash
cd d:\ITERARY\frontend
npm install
# 159 packages installed
```

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Start MySQL (Docker)
```bash
docker start iterary-mysql
```

### 2. Start Backend (Terminal 1)
```bash
cd d:\ITERARY\backend
npm run dev
```
**Running di:** http://localhost:8080

### 3. Start Frontend (Terminal 2)
```bash
cd d:\ITERARY\frontend
npm run dev
```
**Running di:** http://localhost:3000

---

## 🔑 Login Credentials

### Admin
- **URL:** http://localhost:3000 (pilih Admin Login)
- **Username:** `admin`
- **Password:** `admin123`

### Member
- **URL:** http://localhost:3000 (pilih Member Login)
- **Email:** `budi@students.itera.ac.id`
- **Password:** `member123`

### Register Member Baru
- **URL:** http://localhost:3000/register
- **Fields:**
  - Member ID/NIM
  - Full Name
  - Email
  - Password
  - Confirm Password

---

## 📁 File Baru yang Dibuat

1. **`backend\.env`** - Environment variables untuk backend
2. **`frontend\.env`** - Environment variables untuk frontend
3. **`backend\setup-users.js`** - Script setup user dengan password hash
4. **`LOGIN_CREDENTIALS.md`** - Panduan login dan akses aplikasi
5. **`SETUP_GUIDE.md`** - Panduan setup lengkap

---

## 🔧 File yang Dimodifikasi

1. **`backend\.env`**
   - `DB_PASSWORD`: `` → `root`
   - `CORS_ORIGIN`: `http://localhost:5173` → `*`

2. **`frontend\src\pages\Register.jsx`**
   - Tambah field Member ID/NIM
   - Hapus field Phone Number
   - Fix payload ke backend

3. **`frontend\src\pages\Login.jsx`**
   - Fix credentials untuk member login (email vs username)

4. **`frontend\src\context\AuthContext.jsx`**
   - Tambah validasi untuk localStorage.getItem
   - Tambah try-catch untuk JSON.parse

5. **`frontend\src\pages\BooksPage.jsx`**
   - Tambah Array.isArray validation
   - Fix duplikasi kode

6. **`frontend\src\pages\MemberDashboard.jsx`**
   - Tambah Array.isArray validation

7. **`frontend\src\pages\AdminDashboard.jsx`**
   - Tambah fallback untuk stats object

8. **`frontend\src\pages\BookDetail.jsx`**
   - Tambah null fallback untuk book

---

## 🛠️ Masalah yang Diperbaiki

| No | Masalah | Solusi | File |
|----|---------|--------|------|
| 1 | MySQL connection failed | Setup Docker MySQL + import schema | - |
| 2 | CORS error (port mismatch) | Ubah CORS_ORIGIN ke wildcard `*` | `backend\.env` |
| 3 | Register error (missing fields) | Tambah field member_id di form | `Register.jsx` |
| 4 | Login member error | Fix payload: kirim `email` bukan `username` | `Login.jsx` |
| 5 | JSON parse error | Validasi localStorage sebelum parse | `AuthContext.jsx` |
| 6 | `.map() is not a function` | Tambah `Array.isArray()` checks | `BooksPage.jsx`, `MemberDashboard.jsx` |
| 7 | Syntax error di BooksPage | Hapus duplikasi kode | `BooksPage.jsx` |
| 8 | Password hash salah | Buat script setup-users.js dengan bcrypt | `setup-users.js` |

---

## ⚠️ Catatan Penting

### Redis Warning (Bisa Diabaikan)
```
⚠️ Redis connection error (running without cache)
```
- Redis opsional untuk caching
- Aplikasi tetap berfungsi normal tanpa Redis
- Tidak mempengaruhi fungsi utama

### Clear Browser Cache
Jika ada error, jalankan di browser console:
```javascript
localStorage.clear()
```

Lalu refresh halaman (F5).

---

## 🎯 Status Akhir

✅ **Backend:** Running di port 8080  
✅ **Frontend:** Running di port 3000  
✅ **Database:** MySQL di Docker (container: iterary-mysql)  
✅ **Login Admin:** Berhasil  
✅ **Login Member:** Berhasil  
✅ **Register:** Berhasil  
✅ **Browse Books:** Berhasil  
✅ **Dashboard Admin:** Berhasil  
✅ **Dashboard Member:** Berhasil  

**Semua fitur berjalan normal! 🎉**

---

## 📝 Perintah Berguna

### Docker Commands
```bash
# Lihat container yang running
docker ps

# Start MySQL container
docker start iterary-mysql

# Stop MySQL container
docker stop iterary-mysql

# Logs MySQL container
docker logs iterary-mysql

# Hapus container (untuk reset database)
docker rm -f iterary-mysql
```

### Database Commands
```bash
# Akses MySQL shell
docker exec -it iterary-mysql mysql -uroot -proot iterary

# Backup database
docker exec iterary-mysql mysqldump -uroot -proot iterary > backup.sql

# Restore database
Get-Content backup.sql | docker exec -i iterary-mysql mysql -uroot -proot iterary
```

### Development
```bash
# Kill process di port tertentu (PowerShell)
Get-NetTCPConnection -LocalPort 8080 | Select-Object -First 1 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Atau cari PID lalu kill
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

---

**Dibuat pada:** 1 Desember 2025  
**Project:** ITERARY - Library Management System  
**Institut Teknologi Sumatera**
