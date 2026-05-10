# Dokumentasi API & Logika - Fitur Project Planning (FPD)

Dokumentasi ini menjelaskan logika, arsitektur, dan integrasi API untuk fitur **Project Planning** (Form Pengajuan Data / FPD) pada aplikasi SPARTA. Modul ini menggantikan proses Google Form sebelumnya untuk pengajuan design toko, dengan alur approval multi-tahap dari Coordinator hingga PP Specialist.

Logika utama antarmuka pengguna tersebar di tiga halaman: `app/projek-planning/page.tsx` (daftar), `app/projek-planning/form/page.tsx` (input), dan `app/projek-planning/[id]/page.tsx` (detail & approval). Seluruh komunikasi API dikelola di `lib/api.ts`.

## 1. Modul & Alur Kerja (Workflow)

Fitur ini mendukung alur approval berlapis:
1. **Input FPD:** Coordinator (Cabang) mengisi form lengkap (identitas toko, jenis pengajuan, fasilitas, ketentuan, catatan design, dan upload dokumen).
2. **Approval B&M Manager:** Manajer cabang menyetujui atau menolak pengajuan.
3. **Approval PP Specialist (Tahap 1):** PP menentukan apakah butuh Desain 3D atau langsung lanjut.
4. *(Opsional)* **Upload Desain 3D:** Jika dibutuhkan, PP Specialist mengupload desain 3D terlebih dahulu.
5. **Upload RAB & Gambar Kerja:** Coordinator mengupload dokumen RAB dan gambar kerja.
6. **Approval PP Manager:** Manajer PP menyetujui atau menolak.
7. **Approval PP Specialist (Final):** PP menyelesaikan proses, FPD dikirim ke Cabang.

> **Rejection Behavior:** Penolakan di tahap mana pun akan mengembalikan status ke `DRAFT` (reset total). Coordinator harus mengajukan ulang via endpoint _resubmit_.

## 2. Pemetaan Hak Akses (Role Access)

Menu `menu-projek-planning` dikonfigurasi di `lib/constants.ts` dan dapat diakses oleh:
- **BRANCH MANAGER** (BM)
- **BRANCH BUILDING & MAINTENANCE MANAGER** (BBMM)
- **BRANCH BUILDING COORDINATOR** (BBC)

### Matriks Aksi per Role:
- **Coordinator (BBC):** Submit FPD, Resubmit, Upload RAB & Gambar Kerja
- **B&M Manager (BM/BBMM):** Approval tahap BM
- **PP Specialist:** Approval tahap 1 & 2, Upload Desain 3D
- **PP Manager:** Approval tahap PP Manager

## 3. Tipe Data (Types) Utama

Tipe-tipe berikut diekspor dari `lib/api.ts`:
- `ProjekPlanningItem`: Data lengkap satu record FPD (identitas, fasilitas, ketentuan, catatan, status, approval trail).
- `ProjekPlanningLog`: Entry audit log (aktor, aksi, status sebelum/sesudah, timestamp).
- `ProjekPlanningDetail`: Gabungan `{ projek: ProjekPlanningItem, logs: ProjekPlanningLog[] }`.
- `ProjekPlanningListFilters`: Parameter filter untuk list query (`status`, `cabang`, `nomor_ulok`, `email_pembuat`, `id_toko`).

## 4. Endpoint & Fungsi Terkait

### 4.1 Submit / Buat FPD Baru
**Fungsi:** `submitProjekPlanning(payload)`
**Endpoint:** `POST /api/projek-planning/submit`
Membuat pengajuan baru. Payload mencakup identitas toko, jenis pengajuan design, fasilitas, ketentuan landlord, catatan design, dan link file. Status awal: `WAITING_BM_APPROVAL`.

### 4.2 Resubmit FPD (Update Record DRAFT)
**Fungsi:** `resubmitProjekPlanning(id, payload)`
**Endpoint:** `POST /api/projek-planning/:id/resubmit`
Digunakan setelah record ditolak (status `DRAFT`). Semua data approval sebelumnya sudah direset, Coordinator bisa memperbaiki dan mengajukan ulang.

### 4.3 Ambil Daftar FPD (List)
**Fungsi:** `fetchProjekPlanningList(filters?)`
**Endpoint:** `GET /api/projek-planning`
Parameter filter meliputi `status`, `nomor_ulok`, `cabang`, `email_pembuat`, dan `id_toko`.

### 4.4 Ambil Detail FPD
**Fungsi:** `fetchProjekPlanningDetail(id)`
**Endpoint:** `GET /api/projek-planning/:id`
Mengambil detail FPD lengkap beserta riwayat log (_audit trail_) dari seluruh tahap approval.

### 4.5 Ambil Audit Trail
**Fungsi:** `fetchProjekPlanningLogs(id)`
**Endpoint:** `GET /api/projek-planning/:id/logs`
Mengambil daftar log aktivitas (submit, approve, reject, upload) untuk satu record FPD.

### 4.6 Approval BM Manager
**Fungsi:** `processBmApproval(id, payload)`
**Endpoint:** `POST /api/projek-planning/:id/bm-approval`
Persetujuan oleh Branch Manager. Jika APPROVE → status bergeser ke `WAITING_PP_APPROVAL_1`. Jika REJECT → kembali ke `DRAFT`.

### 4.7 Approval PP Specialist (Tahap 1)
**Fungsi:** `processPpApproval1(id, payload)`
**Endpoint:** `POST /api/projek-planning/:id/pp-approval-1`
PP Specialist menentukan apakah butuh Desain 3D (`butuh_desain_3d: true/false`). Jika butuh 3D → `PP_DESIGN_3D_REQUIRED`. Jika tidak → `WAITING_RAB_UPLOAD`.

### 4.8 Upload Desain 3D
**Fungsi:** `uploadDesain3d(id, payload)`
**Endpoint:** `POST /api/projek-planning/:id/upload-3d`
PP Specialist mengupload link desain 3D. Status bergeser ke `WAITING_RAB_UPLOAD`.

### 4.9 Upload RAB & Gambar Kerja
**Fungsi:** `uploadRabGambarKerja(id, payload)`
**Endpoint:** `POST /api/projek-planning/:id/upload-rab`
Coordinator mengupload link RAB dan/atau gambar kerja. Minimal salah satu harus diisi. Status bergeser ke `WAITING_PP_MANAGER_APPROVAL`.

### 4.10 Approval PP Manager
**Fungsi:** `processPpManagerApproval(id, payload)`
**Endpoint:** `POST /api/projek-planning/:id/pp-manager-approval`
Jika APPROVE → `WAITING_PP_APPROVAL_2`. Jika REJECT → `DRAFT`.

### 4.11 Approval PP Specialist (Final)
**Fungsi:** `processPpApproval2(id, payload)`
**Endpoint:** `POST /api/projek-planning/:id/pp-approval-2`
Jika APPROVE → `COMPLETED`, FPD selesai. Jika REJECT → `DRAFT`.

## 5. Struktur Payload Global Approval

Untuk endpoint approval (BM, PP Manager, PP Final), struktur payload JSON yang dikirimkan adalah:

```json
{
  "approver_email": "email_user@alfamart.co.id",
  "tindakan": "APPROVE",
  "alasan_penolakan": "Isi alasan jika tindakan == REJECT"
}
```

Khusus PP Approval Tahap 1, terdapat field tambahan:

```json
{
  "approver_email": "pp@alfamart.co.id",
  "tindakan": "APPROVE",
  "butuh_desain_3d": true
}
```

## 6. Struktur Form FPD (6 Section)

Form FPD terbagi menjadi 6 bagian yang memetakan field Google Form lama:
1. **Informasi Toko** — Autocomplete toko (ULOK/nama), nama pengaju, estimasi biaya
2. **Pengajuan Design** — Jenis: DRIVE THRU, BEAN SPOT, FASADE, LAINNYA
3. **Fasilitas** — Checkbox + keterangan: Air Bersih, Drain, AC, Lainnya
4. **Ketentuan Landlord** — 5 field teks untuk ketentuan pengelola/pihak ketiga
5. **Catatan Design** — 5 field textarea untuk hasil ukur & kondisi lingkungan
6. **Upload Files** — Link Google Drive untuk Gambar Kerja & RAB (Sipil + ME)

## 7. Panel Aksi Dinamis (Detail Page)

Halaman detail menampilkan panel aksi yang berbeda tergantung status saat ini dan role user:

| Status | Panel | Aksi |
|--------|-------|------|
| `WAITING_BM_APPROVAL` | Approval BM | Setujui / Tolak (BM/BBMM) |
| `WAITING_PP_APPROVAL_1` | Approval PP | Setujui (± 3D) / Tolak (PP) |
| `PP_DESIGN_3D_REQUIRED` | Upload 3D | Input link (PP) |
| `WAITING_RAB_UPLOAD` | Upload RAB | Input link RAB & Gambar Kerja (Coordinator) |
| `WAITING_PP_MANAGER_APPROVAL` | Approval Mgr | Setujui / Tolak (PP Manager) |
| `WAITING_PP_APPROVAL_2` | Approval Final | Setujui (Selesai) / Tolak (PP) |

Setelah eksekusi berhasil, data di-refresh dan status badge diperbarui secara otomatis.
