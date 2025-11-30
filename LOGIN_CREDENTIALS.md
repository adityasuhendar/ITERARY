# 🚀 ITERARY - Aplikasi Sudah Berjalan!

## ✅ Status Aplikasi

- **Backend API**: http://localhost:8080 ✅ RUNNING
- **Frontend**: http://localhost:3000 ✅ RUNNING
- **Database**: MySQL (Docker) ✅ RUNNING

---

## 🔑 Login Credentials

### ADMIN
- **URL**: http://localhost:3000 (pilih Admin Login)
- **Username**: `admin`
- **Password**: `admin123`

### MEMBER/USER
- **URL**: http://localhost:3000 (pilih Member Login)
- **Email**: `budi@students.itera.ac.id`
- **Password**: `member123`

#### Member Lainnya:
- Email: `siti@students.itera.ac.id` | Password: `member123`
- Email: `ahmad@students.itera.ac.id` | Password: `member123`

### 📝 REGISTER MEMBER BARU
- **URL**: http://localhost:3000/register
- **Field yang diperlukan**:
  - Member ID/NIM: Contoh `120450004`
  - Full Name: Nama lengkap
  - Email: Email valid
  - Password: Minimal 6 karakter
  - Confirm Password: Harus sama dengan password

---

## 🌐 Cara Mengakses

1. **Buka browser** (Chrome, Firefox, Edge, dll)
2. **Akses**: http://localhost:3000
3. **Login** dengan credentials di atas

---

## 🛠️ Troubleshooting

### Frontend tidak muncul?
- Pastikan akses: **http://localhost:3000** (bukan 5173)
- Buka Developer Tools (F12) → cek tab Console untuk error
- Pastikan backend dan frontend sudah running

### Cannot connect to backend?
- Cek backend masih running di http://localhost:8080/health
- Jika backend mati, restart: `cd d:\ITERARY\backend && npm run dev`

### Database error?
- Cek Docker container: `docker ps`
- Start MySQL jika mati: `docker start iterary-mysql`

---

## 🔄 Cara Restart Aplikasi

### Matikan Semua
- Frontend: Ctrl+C di terminal frontend
- Backend: Ctrl+C di terminal backend
- MySQL: `docker stop iterary-mysql`

### Jalankan Ulang
```bash
# 1. Start MySQL (jika mati)
docker start iterary-mysql

# 2. Start Backend (terminal 1)
cd d:\ITERARY\backend
npm run dev

# 3. Start Frontend (terminal 2 - buka terminal baru)
cd d:\ITERARY\frontend
npm run dev

# 4. Buka browser: http://localhost:3000
```

---

## 📊 Fitur Aplikasi

### Admin Dashboard
- Manajemen buku (tambah, edit, hapus)
- Manajemen member
- Laporan peminjaman
- Statistik perpustakaan

### Member Dashboard
- Browse buku yang tersedia
- Pinjam buku
- Lihat riwayat peminjaman
- Profil member

---

## 💡 Tips

- **Auto-reload**: Kedua server (backend & frontend) otomatis reload saat ada perubahan code
- **Database**: Data tersimpan di Docker container. Untuk reset database, hapus container dan buat ulang
- **Logs**: Cek terminal backend untuk melihat request logs

---

## 🎯 Next Steps

1. Coba login sebagai admin dan member
2. Tambah beberapa buku di admin dashboard
3. Coba pinjam buku dari member dashboard
4. Eksplorasi fitur-fitur lainnya

---

**Selamat menggunakan ITERARY! 📚**
