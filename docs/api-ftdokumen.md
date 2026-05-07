 # Dokumentasi API & Logika - Fitur Foto Dokumen (FT Dokumen)

Dokumentasi ini mencakup alur logika dan integrasi API untuk fitur **Dokumentasi Bangunan Toko Baru (FT Dokumen)**. Fitur ini dirancang khusus untuk memungkinkan _PIC Lapangan_ atau staf proyek mengambil foto kondisi fisik toko secara sistematis (terpandu) menggunakan denah titik kamera _(Floor Plan Camera Points)_, dan mengirimkannya ke server sebagai dokumen PDF laporan.

Logika *frontend* fitur ini dikelola melalui `app/ftdokumen/page.tsx` beserta komponen pendukung `CameraModal.tsx` dan `photoPoints.ts`.

## 1. Alur Kerja Aplikasi (Workflow)

Fitur ini berjalan dalam 2 tahapan layar (View):

### Tahap 1: Data Form View (Identitas Proyek)
- **Tarik Data SPK:** Aplikasi secara otomatis memanggil `fetchSPKList({ status: 'approved' })` untuk mendapatkan daftar *Active Projects*.
- **Auto-Fill / Pemisahan Kontraktor:** Aplikasi melakukan _grouping_ berdasarkan `nomor_ulok`. Jika lingkup pekerjaan (dari RAB) mengandung kata *ME / MEKANIKAL / ELEKTRIKAL*, nama kontraktor otomatis diisi ke form `kontraktorMe`. Sebaliknya, diisi ke `kontraktorSipil`.
- **Validasi Wajib:** User harus melengkapi Tanggal GO (Grand Opening), Tanggal ST (Serah Terima), dan Tanggal Pengambilan Foto sebelum bisa berlanjut.

### Tahap 2: Floor Plan View (Pemetaan Denah)
- **Visualisasi Titik (Points):** Terdapat beberapa halaman (_Pages_) gambar denah (misal: Tampak Depan, Area Sales, Area Gudang) yang disimpan di `photoPoints.ts`.
- **Integrasi Kamera (Camera Modal):** Saat pengguna menekan salah satu titik _(point)_ di atas denah, `CameraModal` akan terbuka menggunakan WebRTC/HTML5 Camera API untuk menangkap foto langsung secara _real-time_.
- **Kondisi Validasi:** Seluruh `TOTAL_PHOTOS` (jumlah wajib titik foto) harus dilengkapi (berwarna hijau). Tombol "Simpan & Kirim PDF" tidak akan berfungsi sebelum semua titik terfoto.

## 2. Struktur Payload & Data

Data sementara disimpan di *state* lokal sebelum dikirimkan.
- `FormData`: Menyimpan data teks seperti cabang, ulok, tanggal.
- `PhotoData`: Sebuah *dictionary* (Record) yang menyimpan foto dalam format `dataURL` (Base64 String) berdasarkan ID titik foto, beserta catatan (note) opsional.

## 3. Endpoint & Fungsi Terkait

Penyimpanan akhir dilakukan menggunakan fungsi `submitDokumentasiBangunan()` dari `lib/api.ts`. Karena mengirimkan gambar fisik, API ini menggunakan **Multipart/Form-Data**.

### 3.1 Submit Dokumentasi Bangunan
**Fungsi:** `submitDokumentasiBangunan(fields, photos)`
**Endpoint:** `POST /api/dok/bangunan`

**Logika Eksekusi Data:**
1. Fungsi ini akan membuat objek `FormData` baru.
2. Seluruh `fields` (teks) dari form identitas proyek di-*append* (disisipkan) satu per satu.
3. Fungsi ini melakukan _looping_ terhadap objek `photos` (yang menyimpan gambar dalam format *Data URL / Base64* `data:image/jpeg;base64,...`).
4. **Konversi Blob:** Secara internal, *Data URL* akan di-*fetch* (ditarik ulang) menjadi *Blob*, lalu di-*append* ke `FormData` dengan kunci `foto` dan format nama dinamis `photo_{id}.jpg`.
5. Data dikirimkan. Di sisi *Backend*, kumpulan foto ini biasanya akan digabungkan menjadi 1 Laporan berformat PDF.

### 3.2 Update Dokumentasi Bangunan
**Fungsi:** `updateDokumentasiBangunan(id, fields, photos?)`
**Endpoint:** `PUT /api/dok/bangunan/{id}`
**Tujuan:** Sama halnya dengan submit, fungsi ini menerima perubahan identitas teks. Apabila terdapat `photos` tambahan atau revisi foto, sistem akan mengonversinya menjadi _Blob_ lagi seperti fungsi *Submit*.

### 3.3 Fetch Detail Dokumentasi
**Fungsi:** `fetchDokumentasiBangunanDetail(id)`
**Endpoint:** `GET /api/dok/bangunan/{id}`
**Tujuan:** Untuk menarik detail pengajuan dokumentasi bangunan ketika sedang di-review oleh atasan, termasuk mengambil link _File PDF_ laporan dokumentasinya.
