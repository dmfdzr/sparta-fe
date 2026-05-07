# Dokumentasi API & Logika - Fitur Approval (Persetujuan Sentral)

Dokumentasi ini menjelaskan logika, arsitektur, dan integrasi API untuk fitur **Approval** (Persetujuan) pada aplikasi SPARTA. Berbeda dengan fitur lain yang spesifik pada satu modul, fitur Approval bertindak sebagai **Hub Terpusat (Centralized Hub)** yang mengumpulkan berbagai jenis dokumen yang membutuhkan aksi dari pimpinan (Koordinator, Manager, Direktur) atau pihak eksternal (Kontraktor).

Logika utama antarmuka pengguna berada di `app/approval/page.tsx`, yang kemudian memanggil berbagai fungsi persetujuan dari `lib/api.ts`.

## 1. Modul Dokumen yang Didukung (Approval Type)

Fitur ini mendukung 5 jenis dokumen yang terintegrasi dalam satu pintu:
1. **RAB (Rencana Anggaran Biaya)**
2. **SPK (Surat Perintah Kerja)**
3. **PERTAMBAHAN_SPK (Kerja Tambah Kurang / Perpanjangan Waktu)**
4. **OPNAME_FINAL (Opname Hasil Akhir Pekerjaan)**
5. **INSTRUKSI_LAPANGAN (Perintah Perubahan Lapangan / CCO)**

## 2. Pemetaan Hak Akses (Role Access & Hierarchy)

Aplikasi akan memfilter dokumen mana saja yang boleh dilihat oleh user berdasarkan pemetaan peran (_Role_) yang disimpan di sesi (`sessionStorage`). 

### Prioritas Jabatan:
Apabila seorang user memiliki peran ganda (Multi-Role), hierarki jabatannya akan diutamakan dengan urutan:
`DIREKTUR` > `MANAGER` > `KOORDINATOR` / `KONTRAKTOR`

### Matriks Akses Dokumen:
- **RAB**: `KOORDINATOR`, `MANAGER`, `DIREKTUR`
- **SPK**: `MANAGER` (Branch Manager)
- **PERTAMBAHAN SPK**: `MANAGER` (Branch Manager)
- **OPNAME FINAL**: `KOORDINATOR`, `MANAGER`, `DIREKTUR`
- **INSTRUKSI LAPANGAN**: `KOORDINATOR`, `MANAGER`, `KONTRAKTOR`

## 3. Alur Fetching & Normalisasi Data (Frontend)

Karena masing-masing modul memiliki struktur database dan format balikan API yang berbeda, halaman Approval menggunakan fungsi _Normalizer_ (`NormalizedListItem` dan `NormalizedDetail`).

1. **Load List:** Sistem mengecek peran user lalu menembak API List yang relevan dengan parameter _filter status_ khusus (misal: SPK hanya menarik data yang berstatus `WAITING_FOR_BM_APPROVAL`).
2. **Filter Cabang:** Semua dokumen yang ditarik akan difilter ulang agar sesuai dengan _Branch Group_ atau Cabang (_Cabang_) milik user, kecuali user tersebut berada di level `HEAD OFFICE`.
3. **Normalisasi:** Data diubah menjadi satu bentuk seragam (berisi `id`, `tipe`, `nomor_ulok`, `nama_toko`, `cabang`, `status`, `total_nilai`, dan `email_pembuat`) agar bisa dirender dalam satu tabel/komponen Card List yang sama.

## 4. Endpoint Eksekusi Approval (Approve / Reject)

Ketika user menekan tombol **Approve** atau **Reject** (beserta alasan penolakan), UI akan memanggil salah satu dari fungsi-fungsi berikut yang berada di `lib/api.ts`, tergantung tipe dokumennya:

### 4.1 Persetujuan RAB
**Fungsi:** `processRABApproval(id, payload)`
**Endpoint:** `POST /api/rab/{id}/approval`
**Payload Khusus:** Membutuhkan variabel `jabatan` (contoh: `KOORDINATOR`) karena RAB melalui persetujuan berlapis.

### 4.2 Persetujuan SPK
**Fungsi:** `processSPKApproval(id, payload)`
**Endpoint:** `POST /api/spk/{id}/approval`
**Catatan:** Biasanya disetujui langsung oleh Branch Manager. Membutuhkan generate PDF SPK beserta _watermark_ tanda tangan setelahnya.

### 4.3 Persetujuan Pertambahan SPK (Waktu/Biaya)
**Fungsi:** `processPertambahanSPKApproval(id, payload)`
**Endpoint:** `POST /api/pertambahan-spk/{id}/approval`

### 4.4 Persetujuan Opname Final
**Fungsi:** `approveOpnameFinal(id, payload)`
**Endpoint:** `POST /api/final_opname/{id}/approval`
**Payload Khusus:** Membutuhkan `jabatan` (berjenjang seperti RAB).

### 4.5 Persetujuan Instruksi Lapangan
**Fungsi:** `processInstruksiLapanganApproval(id, payload)`
**Endpoint:** `POST /api/instruksi-lapangan/{id}/approval`

## 5. Struktur Payload Global Approval
Untuk memanggil endpoint-endpoint di atas, secara umum struktur payload JSON yang dikirimkan adalah:

```json
{
  "approver_email": "email_user_yang_login@alfamart.com",
  "jabatan": "MANAGER", // (Opsional, khusus untuk RAB/Opname/Instruksi)
  "tindakan": "APPROVE", // atau "REJECT"
  "alasan_penolakan": "Alasan jika tindakan == REJECT" // (Hanya jika REJECT)
}
```

Setelah eksekusi berhasil, data akan dihapus dari daftar tunggu (_waiting list_) di frontend karena statusnya sudah bergeser (misal dari `PENDING_KOORDINATOR` menjadi `PENDING_MANAGER`), dan notifikasi toast hijau dimunculkan.
