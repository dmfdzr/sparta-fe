# Dokumentasi API - Fitur Gantt Chart

Dokumentasi ini menjelaskan logika dan integrasi API untuk fitur **Gantt Chart** pada aplikasi SPARTA. Seluruh komunikasi ke backend API dikelola dalam fungsi-fungsi di file `lib/api.ts`. Fitur ini berfokus pada penjadwalan, monitoring hari kerja (Day Items), keterlambatan, kecepatan, pengawasan (PIC), dan dependensi (keterkaitan antar pekerjaan).

## 1. Tipe Data (Types)

Beberapa tipe data penting yang digunakan dalam operasi Gantt Chart:

- `GanttDayItem`: Menyimpan data hari awal (`h_awal`), hari akhir (`h_akhir`), kecepatan, dan keterlambatan untuk setiap kategori pekerjaan.
- `GanttDependency`: Mendefinisikan keterikatan/dependensi antar kategori pekerjaan (contoh: Pekerjaan B baru bisa jalan setelah A).
- `GanttPengawasan`: Menyimpan kategori pekerjaan mana saja yang membutuhkan pengawasan khusus.
- `GanttSubmitPayload` / `GanttUpdatePayload`: Payload (struktur data) untuk membuat atau mengupdate sebuah Gantt Chart secara utuh.
- `GanttDetailData`: Struktur respon komplit yang mencakup data _parent_ Gantt, Toko, Kategori Pekerjaan, Day Items, Pengawasan, dan Dependencies.

## 2. Endpoint & Fungsi Terkait Gantt Chart

### 2.1 Submit / Buat Gantt Chart Baru
**Fungsi:** `submitGanttChart(payload)`
**Endpoint:** `POST /api/gantt/submit`
- **Fungsi:** Menyimpan data awal Gantt Chart yang terdiri dari informasi dasar toko, kategori pekerjaan yang dipilih, day items, pengawasan, dan dependencies. Operasi ini berjalan sebagai _Full Transaction_ di sisi database.

### 2.2 Ambil Daftar Gantt Chart (List)
**Fungsi:** `fetchGanttList(filters?)`
**Endpoint:** `GET /api/gantt`
- **Fungsi:** Mengambil daftar Gantt Chart (biasanya muncul di dashboard atau menu List).
- **Filter (opsional):** `status` (active/terkunci), `nomor_ulok`, dan `email_pembuat`.

### 2.3 Ambil Detail Gantt Chart
Terdapat dua fungsi untuk mengambil detail berdasarkan kunci yang berbeda:
- **Berdasarkan ID Gantt:** `fetchGanttDetail(id)` -> Endpoint: `GET /api/gantt/{id}`
- **Berdasarkan ID Toko:** `fetchGanttDetailByToko(id_toko)` -> Endpoint: `GET /api/gantt/detail/{id_toko}`

### 2.4 Update & Kunci Gantt Chart
- **Fungsi Update:** `updateGanttChart(id, payload)`
  **Endpoint:** `PUT /api/gantt/{id}`
  - Digunakan untuk melakukan pembaruan penuh (Bulk Update) pada Gantt Chart jika statusnya belum terkunci.
- **Fungsi Lock:** `lockGanttChart(id, email)`
  **Endpoint:** `POST /api/gantt/{id}/lock`
  - Merubah status Gantt Chart menjadi `terkunci`. Jika sudah terkunci, pengguna tidak bisa lagi memodifikasi struktur utamanya.

### 2.5 Hapus Gantt Chart
**Fungsi:** `deleteGanttChart(id)`
**Endpoint:** `DELETE /api/gantt/{id}`
- **Fungsi:** Menghapus Gantt Chart. Sama halnya seperti Update, Gantt Chart tidak dapat dihapus apabila statusnya sudah `terkunci`.

### 2.6 Manipulasi Periode (Day Items) & Performa Pekerjaan
Fungsi-fungsi ini diperuntukkan untuk mengubah parameter _monitoring_ berjalannya pekerjaan secara spesifik per baris kategori:
- **Tambah Day Items:** `addGanttDayItems(id, dayItems)` -> Endpoint: `POST /api/gantt/{id}/day`
- **Update Keterlambatan:** `updateGanttDelay(id, payload)` -> Endpoint: `POST /api/gantt/{id}/day/keterlambatan`
- **Update Kecepatan:** `updateGanttSpeed(id, payload)` -> Endpoint: `POST /api/gantt/{id}/day/kecepatan`

### 2.7 Manipulasi Pengawasan (PIC Pengawasan)
Modul untuk mencatat jadwal kunjungan atau kontrol pengawasan ke proyek.
- **Set/Unset Kategori Pengawasan:** `manageGanttPengawasan(id, payload)` -> Endpoint: `POST /api/gantt/{id}/pengawasan`
- **Menambah Jadwal Tanggal:** `submitGanttPengawasan(id, tanggal_pengawasan)` -> Endpoint: `POST /api/gantt/{id}/pengawasan` *(dengan payload list tanggal)*

### 2.8 Operasi Bulk Pengawasan Eksternal (Memo)
Fungsi ini dipakai untuk sinkronisasi form PIC Pengawasan Eksternal yang menyimpan detail pekerjaan beserta foto bukti kontrol.
- **Submit Bulk:** `submitPengawasanBulk(payload)` -> Endpoint: `POST /api/pengawasan/bulk`
- **Update Bulk:** `updatePengawasanBulk(payload)` -> Endpoint: `PUT /api/pengawasan/bulk`
- **Ambil List Pengawasan Eksternal:** `fetchPengawasanList(filters?)` -> Endpoint: `GET /api/pengawasan`

*(Catatan Tambahan: Terdapat juga `fetchGanttData` yang menembak `/api/get_gantt_data`, yang merupakan endpoint _Legacy_ / versi lama yang mengambil data berdasarkan string nomor ulok & lingkup pekerjaan).*

## 3. Alur Kerja (Workflow) Gantt Chart

1. **Inisialisasi (Drafting):** Gantt Chart pertama kali disubmit saat pembuatan SPK baru (Surat Perintah Kerja) atau secara manual. User menyusun `h_awal` (hari mulai), `h_akhir` (hari selesai), keterkaitan _dependencies_ antar tugas, dan memilih pekerjaan apa saja yang wajib diawasi (Pengawasan). Lalu, memanggil `submitGanttChart()`.
2. **Monitoring Aktif:** Saat proyek berjalan, Kontraktor/PIC dapat memperbarui status harian, mencatat **keterlambatan** atau **kecepatan** menggunakan `updateGanttDelay()` dan `updateGanttSpeed()`.
3. **Penguncian (Lock):** Jika seluruh parameter Gantt telah disetujui (biasanya berjalan beriringan dengan Approval final dokumen SPK), status Gantt akan dirubah menjadi `terkunci` via `lockGanttChart()`. Struktur fundamental seperti penambahan kategori pekerjaan baru atau penghapusan akan dicegah.
4. **Input Pengawasan (PIC):** Tim pengawas (seperti PIC cabang) melakukan kunjungan ke lokasi berdasarkan titik _timeline_ pengawasan. Mereka dapat memanggil `submitPengawasanBulk()` untuk menyimpan hasil catatan, bukti foto laporan pekerjaan dan evaluasi harian/mingguan.
