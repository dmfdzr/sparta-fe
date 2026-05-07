# Dokumentasi API & Logika - Fitur Manajemen User Cabang

Dokumentasi ini menjelaskan pengelolaan data pengguna (User Management) yang ada di SPARTA. Fitur ini dirancang untuk memetakan alamat email (_Single Sign-On / SSO_ email SAT) ke spesifik jabatan (Role) dan Cabang.

Antarmuka fitur ini terdapat pada `app/users/page.tsx`, sementara fungsi pemanggilan API-nya dikelola dalam `lib/api.ts`.

## 1. Hak Akses (Role Base Access Control)
Halaman Manajemen User memiliki pembatasan tingkat tinggi (_High Restriction_).
- Fitur ini **Hanya dapat diakses oleh pengguna dari cabang HEAD OFFICE**.
- Jika pengguna dari cabang reguler (misal: "MALANG" atau "BATAM") mencoba mengakses rute `/users`, sistem akan memberikan _alert_ peringatan dan me-redirect pengguna kembali ke `/dashboard`.

## 2. Struktur Data User
Objek tipe data utama untuk fitur ini direpresentasikan di database sebagai `user_cabang`.

Field yang tersedia:
- `cabang`: (Wajib) Lokasi penempatan pengguna. Menggunakan dropdown *Pre-defined* dari `BRANCH_TO_ULOK` + `'HEAD OFFICE'`.
- `email_sat`: (Wajib) Email pengguna yang akan digunakan untuk SSO / Login.
- `nama_lengkap`: (Opsional) Nama lengkap pengguna.
- `jabatan`: (Opsional) Role spesifik. Terdiri dari:
  - `BRANCH BUILDING & MAINTENANCE MANAGER`
  - `BRANCH BUILDING COORDINATOR`
  - `BRANCH BUILDING SUPPORT`
  - `BRANCH MANAGER`
  - `KONTRAKTOR`
  - `DIREKTUR`
- `nama_pt`: (Opsional) Nama perusahaan vendor (Hanya digunakan untuk jabatan `KONTRAKTOR`). Parameter ini penting untuk _filtering_ dokumen RAB/SPK nantinya agar Kontraktor hanya melihat proyek dari PT mereka sendiri.

## 3. Endpoint API (CRUD)

Modul ini sepenuhnya menggunakan standar operasi Create, Read, Update, Delete (CRUD).

### 3.1 Ambil Daftar User (Read / List)
**Fungsi:** `fetchUserCabangList({ search, cabang, jabatan })`
**Endpoint:** `GET /api/user_cabang`
- Menerima _query parameter_ untuk pencarian spesifik. Frontend akan mengirim parameter pencarian berdasarkan _Search Bar_ (nama, email) dan _Dropdown Filter_ (cabang, jabatan).

### 3.2 Tambah User Baru (Create)
**Fungsi:** `createUserCabang(payload)`
**Endpoint:** `POST /api/user_cabang`
- Menerima JSON payload berupa struktur data user.

### 3.3 Perbarui Data User (Update)
**Fungsi:** `updateUserCabang(id, payload)`
**Endpoint:** `PUT /api/user_cabang/{id}`
- Form akan masuk ke _Edit Mode_ (variabel `isEditing`). 
- ID baris tabel disisipkan pada URL, dan payload dikirimkan (secara parsial / hanya field yang tidak kosong/berubah).

### 3.4 Hapus User (Delete)
**Fungsi:** `deleteUserCabang(id)`
**Endpoint:** `DELETE /api/user_cabang/{id}`
- Pengguna yang dihapus tidak akan bisa mengakses dasbor karena `email_sat` mereka terputus (_unmapped_) dari database autentikasi role aplikasi.
