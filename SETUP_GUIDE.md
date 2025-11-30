# Panduan Setup ITERARY - Backend & Frontend

## Prerequisites yang Harus Diinstall

### 1. MySQL Server
**Download dan Install:**
- Download MySQL Community Server dari: https://dev.mysql.com/downloads/mysql/
- Atau install XAMPP yang sudah include MySQL: https://www.apachefriends.org/download.html

**Setelah install:**
1. Start MySQL service
2. Set password root MySQL (bisa kosong untuk development)

### 2. Node.js
- Pastikan Node.js versi 18+ sudah terinstall
- Cek dengan: `node --version`

---

## Langkah Setup (SUDAH SELESAI)

✅ **1. File .env Backend** - Sudah dibuat di `backend\.env`
✅ **2. File .env Frontend** - Sudah dibuat di `frontend\.env`
✅ **3. Install Dependencies Backend** - Sudah selesai
✅ **4. Install Dependencies Frontend** - Sudah selesai

---

## Langkah Selanjutnya (MANUAL)

### Langkah 5: Setup Database MySQL

#### Opsi A: Menggunakan MySQL Command Line
```bash
# Login ke MySQL (password sesuai yang Anda set)
mysql -u root -p

# Buat database
CREATE DATABASE iterary;

# Keluar dari MySQL
exit

# Import schema
mysql -u root -p iterary < d:\ITERARY\iterary-schema-mysql.sql
```

#### Opsi B: Menggunakan XAMPP/phpMyAdmin
1. Buka XAMPP Control Panel
2. Start Apache dan MySQL
3. Buka browser: http://localhost/phpmyadmin
4. Klik "New" untuk buat database baru
5. Nama database: `iterary`
6. Klik tab "Import"
7. Choose file: `d:\ITERARY\iterary-schema-mysql.sql`
8. Klik "Go"

#### Opsi C: Copy-paste SQL Manual
1. Buka phpMyAdmin atau MySQL Workbench
2. Buat database `iterary`
3. Pilih database tersebut
4. Copy semua isi file `iterary-schema-mysql.sql`
5. Paste dan Execute

### Langkah 6: Konfigurasi .env Backend

Edit file `backend\.env` jika perlu:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=      # isi dengan password MySQL Anda (atau kosong jika tidak ada password)
DB_NAME=iterary
```

### Langkah 7: Jalankan Backend

```bash
cd d:\ITERARY\backend
npm run dev
```

Backend akan berjalan di: **http://localhost:8080**

Cek health check: http://localhost:8080/health

### Langkah 8: Jalankan Frontend

Buka terminal baru:
```bash
cd d:\ITERARY\frontend
npm run dev
```

Frontend akan berjalan di: **http://localhost:5173**

---

## Troubleshooting

### Error: MySQL connection failed
- ✅ Pastikan MySQL service sudah running
- ✅ Cek username dan password di `backend\.env`
- ✅ Pastikan database `iterary` sudah dibuat
- ✅ Cek port MySQL (default 3306)

### Error: Port already in use
**Backend (8080):**
```bash
# Cari process yang pakai port 8080
netstat -ano | findstr :8080
# Kill process (ganti PID dengan nomor yang muncul)
taskkill /PID <PID> /F
```

**Frontend (5173):**
```bash
# Cari process yang pakai port 5173
netstat -ano | findstr :5173
# Kill process
taskkill /PID <PID> /F
```

### Error: CORS
Pastikan di `backend\.env`:
```env
CORS_ORIGIN=http://localhost:5173
```

---

## Akses Default

### Admin (Login pertama kali)
File schema sudah include data admin default. Cek di `iterary-schema-mysql.sql` bagian INSERT data.

Biasanya:
- Username: `admin`
- Password: Lihat di file SQL atau buat manual setelah database ready

---

## Perintah Berguna

### Backend
```bash
npm run dev      # Development mode (auto-restart)
npm start        # Production mode
```

### Frontend
```bash
npm run dev      # Development server
npm run build    # Build untuk production
npm run preview  # Preview production build
```

---

## Status Setup Saat Ini

✅ Dependencies terinstall
✅ File .env sudah dibuat
⏳ **NEXT:** Setup database MySQL (lihat Langkah 5)
⏳ **THEN:** Jalankan backend dan frontend

---

## Catatan Penting

1. **Database harus dibuat dulu** sebelum menjalankan backend
2. **Backend harus running** sebelum menggunakan frontend
3. Untuk development, gunakan `npm run dev` (ada auto-reload)
4. Redis opsional - aplikasi masih bisa jalan tanpa Redis

---

## Butuh Bantuan?

Jika ada error, share pesan error lengkapnya untuk troubleshooting lebih lanjut.
