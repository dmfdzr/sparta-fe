# Dokumentasi API - Fitur Autentikasi (Auth)

Dokumentasi ini menjelaskan logika, alur, dan integrasi API untuk fitur **Login / Autentikasi** pada aplikasi SPARTA. Logika utama fitur ini berada di dalam komponen client-side `app/auth/page.tsx`.

## 1. Endpoint & Komunikasi Server

Fitur autentikasi melakukan dua jenis komunikasi ke luar (external fetch):

### 1.1 Endpoint Login Utama
**Fungsi:** Memvalidasi kredensial user untuk masuk ke dalam aplikasi.
- **Endpoint:** `POST {API_URL}/api/auth/login`
- **Payload Request:**
  ```json
  {
    "email_sat": "email_user",
    "cabang": "password_input" 
  }
  ```
  *(Catatan: Aplikasi SPARTA menggunakan kombinasi `email_sat` dan `cabang` sebagai kredensial login. Input form "Password" pada UI akan dikirim sebagai nilai `cabang`.)*

### 1.2 Endpoint Logging (Google Apps Script)
**Fungsi:** Mencatat (tracking) setiap percobaan login (baik berhasil maupun gagal) ke dalam Google Sheets melalui Webhook/Google Apps Script.
- **URL Endpoint:** `POST https://script.google.com/macros/s/.../exec`
- **Payload Request:**
  ```json
  {
    "requestType": "loginAttempt",
    "username": "email_user",
    "cabang": "password_input",
    "status": "Success" // atau "Failed"
  }
  ```
- **Fungsi Terkait di Kode:** `logLoginAttempt(username, cabang, status)`

## 2. Alur Autentikasi (Workflow)

1. **Input Kredensial:** User memasukkan Email dan Password (yang mana password tersebut merujuk pada kode/nama Cabang, lalu input tersebut dikonversi menjadi huruf kapital `toUpperCase()`).
2. **Validasi Maintenance (Opsional):** Jika diaktifkan, terdapat pengecekan apakah sistem sedang dalam perbaikan (Maintenance). Jika aktif, hanya user dengan password "HEAD OFFICE" yang dapat masuk.
3. **Panggilan API & Loading State:** Tombol disable dan menampilkan loading. Request POST dikirim ke `/api/auth/login`.
4. **Respon Berhasil (Success):**
   - API mengembalikan data profil user (`jabatan`, `nama_lengkap`, `nama_pt`, `alamat_cabang`, dsb).
   - Logika Frontend akan menjalankan **Role Mapping** (lihat bagian 3).
   - Data kredensial dan role yang sudah di-mapping akan disimpan ke `sessionStorage`.
   - Logging *Success* dikirim ke Google Apps Script.
   - User diarahkan (`router.push`) ke `/dashboard`.
5. **Respon Gagal (Error):**
   - Jika status API tidak ok, fungsi akan mengecek isi pesan error.
   - Mengubah text error agar lebih ramah (misal: "User belum terdaftar" atau "Email atau password salah").
   - Menampilkan alert text di UI.
   - Logging *Failed* dikirim ke Google Apps Script.

## 3. Role Mapping (Pemetaan Jabatan)

Karena terdapat perbedaan penamaan `jabatan` dari API dan role yang digunakan di dalam aplikasi (dashboard), frontend melakukan pemetaan string jabatan (Mapping) secara eksplisit. Aturan pemetaannya adalah sebagai berikut:

| Data Jabatan dari API (Contains/Equals) | Mapped Role di Aplikasi (sessionStorage) |
| :--- | :--- |
| `BUILDING MAINTENANCE MANAGER` / `BBMM` | `BRANCH BUILDING & MAINTENANCE MANAGER` |
| `BRANCH MANAGER` / `BM` | `BRANCH MANAGER` |
| `DOKUMENTASI` / `BBSD` | `BRANCH BUILDING SUPPORT DOKUMENTASI` |
| `COORDINATOR` / `BBC` | `BRANCH BUILDING COORDINATOR` |
| `SUPPORT` / `BBS` | `BRANCH BUILDING SUPPORT` |
| `KONTRAKTOR` & `DIREKTUR` | `DIREKTUR, KONTRAKTOR` |
| `KONTRAKTOR` (hanya kontraktor) | `KONTRAKTOR` |
| `DIREKTUR` (hanya direktur) | `DIREKTUR` |

## 4. Penyimpanan Sesi (Session Storage)

Aplikasi tidak menggunakan HTTP Cookies, melainkan menggunakan `sessionStorage` di sisi browser. Setelah berhasil login, variabel berikut akan disimpan:

- `authenticated`: `"true"`
- `loggedInUserEmail`: Email dari API (atau email input)
- `loggedInUserCabang`: Cabang dari API (atau input cabang/password)
- `userRole`: Jabatan yang sudah melalui fungsi *Role Mapping*
- `nama_lengkap`: Nama lengkap user
- `nama_pt`: Nama perusahaan (PT)
- `alamat_cabang`: Alamat spesifik dari cabang tersebut

*Nilai-nilai ini akan hilang saat user menutup tab/browser atau menekan tombol Logout (yang menjalankan fungsi `sessionStorage.clear()`).*
