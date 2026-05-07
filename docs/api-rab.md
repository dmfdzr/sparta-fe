# Dokumentasi API - Fitur RAB (Rencana Anggaran Biaya)

Dokumentasi ini menjelaskan logika dan integrasi API untuk fitur **Rencana Anggaran Biaya (RAB)** pada aplikasi SPARTA. Semua komunikasi ke backend dilakukan melalui fungsi-fungsi yang telah didefinisikan di `lib/api.ts`.

## 1. Tipe Data (Types)

Beberapa tipe data utama yang digunakan dalam fitur RAB meliputi:

- `RABListItem`: Representasi data RAB pada tabel list (termasuk status, nomor ulok, grand total, link dokumen).
- `RABDetailData`: Representasi data detail spesifik RAB (informasi bangunan, persetujuan, link PDF, dan total harga).
- `RABDetailToko`: Informasi detail terkait Toko/ULOK yang diajukan RAB-nya.
- `RABDetailItem`: Detail tiap item pekerjaan dalam RAB (harga upah, material, volume, dll).
- `RABApprovalPayload`: Payload untuk melakukan persetujuan (Approve/Reject) RAB.

## 2. Endpoint & Fungsi Terkait RAB

Berikut adalah daftar fungsi utama yang digunakan di frontend untuk berinteraksi dengan API RAB:

### 2.1 Submit / Buat RAB Baru
**Fungsi:** `submitRABData(fields, detailItems, asuransiFile?)`
**Endpoint:** `POST /api/rab/submit`
- **Fungsi:** Menyimpan data pengajuan RAB baru atau revisi RAB.
- **Logika:**
  - Jika terdapat `asuransiFile`, pengiriman dilakukan menggunakan `multipart/form-data` dan file tersebut diupload ke Google Drive.
  - Jika **tidak ada** `asuransiFile`, pengiriman dilakukan menggunakan format JSON (Backward compatible).
  - Jika merupakan revisi, akan menggunakan parameter key `rev_file_asuransi`.

### 2.2 Ambil Daftar RAB (List)
**Fungsi:** `fetchRABList(filters?)`
**Endpoint:** `GET /api/rab`
- **Fungsi:** Mengambil data seluruh RAB.
- **Parameter Filter (opsional):** `status`, `nomor_ulok`, `cabang`, `nama_pt`, `email_pembuat`.

### 2.3 Ambil Detail RAB
**Fungsi:** `fetchRABDetail(id)`
**Endpoint:** `GET /api/rab/{id}`
- **Fungsi:** Mengambil informasi spesifik dari sebuah RAB, termasuk data Toko dan Item Pekerjaan (RAB Detail Items) secara lengkap.

### 2.4 Cek Status Revisi RAB
**Fungsi:** `checkRevisionStatus(email, cabang)`
- **Fungsi:** Mengecek RAB mana saja yang dimiliki oleh user dan berstatus ditolak / dikembalikan (Revisi) untuk dimunculkan alert atau opsi revisi.

### 2.5 Ambil Data Harga (Prices Data)
**Fungsi:** `fetchPricesData(cabang, lingkup)`
**Endpoint:** `GET /get-data?cabang={cabang}&lingkup={lingkup}`
- **Fungsi:** Mengambil master data harga material dan upah yang berlaku pada cabang tertentu untuk lingkup pekerjaan tertentu. Digunakan saat pengisian detail RAB.

### 2.6 Persetujuan (Approval/Reject) RAB
**Fungsi:** `processRABApproval(id, payload)`
**Endpoint:** `POST /api/rab/{id}/approval`
- **Fungsi:** Digunakan oleh pihak approver (Koordinator, Manager, Direktur) untuk menyetujui atau menolak RAB.
- **Payload:** `{ approver_email, jabatan, tindakan, alasan_penolakan? }`

### 2.7 Update Status RAB
**Fungsi:** `updateRABStatus(payload)`
**Endpoint:** `PUT /api/rab/update-status`
- **Fungsi:** Digunakan untuk memperbarui status RAB secara eksplisit (Misalnya penolakan otomatis oleh HEAD OFFICE).

### 2.8 Dokumen & Unduhan RAB
Fitur RAB melibatkan banyak dokumen PDF dan file yang dihasilkan oleh backend.

- **Download PDF Gabungan**
  **Fungsi:** `downloadRABPdf(id)`
  **Endpoint:** `GET /api/rab/{id}/pdf`
  Digunakan untuk mengunduh RAB Gabungan dalam format PDF langsung ke browser.

- **Dapatkan Link Logo RAB**
  **Fungsi:** `getRABLogoDownloadUrl(id)`
  **Endpoint:** `GET /api/rab/{id}/logo`

- **Dapatkan Link Asuransi RAB**
  **Fungsi:** `getRABInsuranceDownloadUrl(id)`
  **Endpoint:** `GET /api/rab/{id}/file-asuransi`

## 3. Alur Kerja (Workflow) RAB

1. **Pembuatan (Drafting):** PIC atau user cabang membuat RAB dengan memanggil `submitRABData()`. User akan memilih Toko, mengisi detail bangunan, dan memasukkan nilai item pekerjaan yang nilainya ditarik otomatis dari master data (`fetchPricesData()`).
2. **Review/Approval:** RAB yang tersubmit akan muncul di halaman List (`fetchRABList()`). User dengan peran khusus dapat melakukan klik untuk memanggil `fetchRABDetail()`, mengecek isinya, lalu menekan tombol Approve/Reject yang akan memicu `processRABApproval()`.
3. **Revisi:** Jika RAB ditolak, maka pembuatnya dapat mengakses melalui fungsi `checkRevisionStatus()` untuk memperbaiki RAB (resubmit).
4. **Penyelesaian:** RAB yang sudah final dapat didownload dengan memanggil `downloadRABPdf()`.
