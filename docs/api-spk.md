# Dokumentasi API - Fitur Surat Perintah Kerja (SPK)

Dokumentasi ini mencakup logika, tipe data, dan integrasi API untuk modul **Surat Perintah Kerja (SPK)**. Di dalam SPARTA, modul ini terbagi menjadi dua bagian besar:
1. **SPK Utama (Reguler)**: Penerbitan surat penunjukan/perintah kerja untuk Kontraktor pada awal proyek.
2. **Pertambahan SPK**: Modul _Addendum_ (Kerja Tambah Kurang) yang digunakan ketika terjadi penyesuaian waktu (perpanjangan hari) dan penyesuaian biaya proyek setelah SPK berjalan.

Seluruh komunikasi API dikelola di `lib/api.ts`.

---

## Bagian 1: SPK Utama (Reguler)

### 1.1 Tipe Data (Types) Utama
- `SPKSubmitPayload`: Data awal pembuatan SPK (id toko, email pembuat, data durasi, nilai `grand_total` dari RAB, dan format cetak _par / spk_manual_).
- `SPKListItem`: Representasi data list SPK (Status, Waktu Mulai, Durasi, Waktu Selesai).
- `SPKDetailResponse`: Response ketika menarik SPK tunggal, berisi object `pengajuan` (SPK) dan array `approvalLogs` (histori proses persetujuan).

### 1.2 Endpoint & Fungsi Terkait

- **Submit / Buat SPK Baru**
  **Fungsi:** `submitSPK(payload)`
  **Endpoint:** `POST /api/spk/submit`
  Menyimpan SPK. *(Catatan: Backend dirancang untuk otomatis me-replace / menimpa data (revisi) jika SPK sebelumnya berstatus `REJECTED`)*.

- **Ambil Daftar SPK (List)**
  **Fungsi:** `fetchSPKList(filters?)`
  **Endpoint:** `GET /api/spk`
  Parameter filter meliputi `status` dan `nomor_ulok`.

- **Ambil Detail SPK**
  **Fungsi:** `fetchSPKDetail(id)`
  **Endpoint:** `GET /api/spk/{id}`
  Mengambil detail SPK dan riwayat log (_trail_) dari approval.

- **Daftar Kontraktor per Cabang**
  **Fungsi:** `fetchKontraktorList(cabang?)`
  **Endpoint:** `GET /api/get_kontraktor`
  Mengembalikan array String berisi daftar Kontraktor/PT yang valid di cabang tersebut.

- **Persetujuan (Approval)**
  **Fungsi:** `processSPKApproval(id, payload)`
  **Endpoint:** `POST /api/spk/{id}/approval`
  Persetujuan hanya diperuntukkan bagi level _Branch Manager_.

- **Download PDF SPK**
  **Fungsi:** `downloadSPKPdf(id)`
  **Endpoint:** `GET /api/spk/{id}/pdf`
  Mengunduh dokumen PDF final SPK yang siap ditandatangani.

---

## Bagian 2: Pertambahan SPK (Kerja Tambah Kurang / CCO)

Digunakan apabila terdapat _Change Order_ yang menyebabkan waktu pekerjaan bertambah panjang dari estimasi awal, atau terjadi penambahan komponen kerja di luar rancangan awal.

### 2.1 Tipe Data (Types)
- `PertambahanSPKPayload`: Payload input mencakup ID SPK lama, durasi tambahan, dokumen pendukung (Lampiran BAST/dll), dan alasan.
- `PertambahanSPKListItem`: Data list dengan tambahan informasi `spk` dan `toko` induk.

### 2.2 Endpoint & Fungsi Terkait

- **Submit Pertambahan SPK**
  **Fungsi:** `submitPertambahanSPK(payload)`
  **Endpoint:** `POST /api/pertambahan-spk`
  Mendukung **dua mode upload**:
  - Jika terdapat form `file_lampiran_pendukung` (bertipe _File_), pengiriman dikonversi menggunakan format `multipart/form-data`.
  - Jika tidak ada lampiran, pengiriman berjalan normal sebagai `application/json`.

- **Update / Revisi Pertambahan SPK**
  **Fungsi:** `updatePertambahanSPK(id, payload)`
  **Endpoint:** `PUT /api/pertambahan-spk/{id}`
  Jika user mengunggah file baru saat revisi, fungsi otomatis mengubah mode request menjadi `multipart/form-data`.

- **Ambil Daftar (List) & Detail**
  - **List:** `fetchPertambahanSPKList(filters)` -> `GET /api/pertambahan-spk`
  - **Detail:** `fetchPertambahanSPKDetail(id)` -> `GET /api/pertambahan-spk/{id}`

- **Persetujuan Pertambahan SPK**
  **Fungsi:** `processPertambahanSPKApproval(id, payload)`
  **Endpoint:** `POST /api/pertambahan-spk/{id}/approval`

- **Hapus Data Pertambahan**
  **Fungsi:** `deletePertambahanSPK(id)`
  **Endpoint:** `DELETE /api/pertambahan-spk/{id}`

- **Unduh Lampiran Pendukung**
  **Fungsi:** `downloadPertambahanSPKLampiran(id)`
  **Endpoint:** `GET /api/pertambahan-spk/{id}/lampiran-pendukung`
  Akan membaca _Content-Type_ (PDF/JPG/PNG) dari backend dan mengunduh _blob file_ yang tersimpan.

## 3. Alur Kerja (Workflow) Utama
1. **Pembuatan RAB:** RAB harus berstatus Final & Disetujui sebelum SPK diterbitkan.
2. **Input Data SPK:** PIC membuat SPK dengan menentukan _Waktu Mulai_, _Durasi_, dan mem-binding data _Grand Total_ secara otomatis dari dokumen RAB.
3. **Approval BM:** SPK menunggu disetujui (Approved) oleh Branch Manager.
4. **Distribusi:** Kontraktor bisa mengunduh file SPK (`downloadSPKPdf`).
5. *(Opsional)* **Pertambahan:** Jika di tengah jalan terdapat perpanjangan pengerjaan, PIC mengajukan *Pertambahan SPK* yang akan me-reset *Waktu Selesai* setelah disetujui (Approved) kembali.
