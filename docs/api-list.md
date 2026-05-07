# Dokumentasi API & Logika - Fitur List / Daftar Dokumen

Dokumentasi ini menjelaskan fitur **Daftar Dokumen (List)** pada aplikasi SPARTA. Halaman ini (`app/list/page.tsx`) berfungsi sebagai *Archive* (Arsip) atau pusat penyimpanan rekam jejak untuk melihat semua dokumen pengajuan, baik yang berstatus _Pending_, _Approved_, maupun _Rejected_.

Berbeda dengan modul *Approval* yang difokuskan pada "Tindakan / Action", modul *List* ini difokuskan pada "View / Read-Only".

## 1. Modul Dokumen yang Didukung

Halaman ini mengelompokkan arsip menjadi 7 kategori (`DokumenKategori`):
1. **RAB** (Rencana Anggaran Biaya)
2. **SPK** (Surat Perintah Kerja)
3. **PERTAMBAHAN_SPK** (Pertambahan Hari SPK / CCO)
4. **OPNAME_FINAL** (Opname Final)
5. **PENGAWASAN** (Log/Memo Pengawasan PIC)
6. **BERKAS_SERAH_TERIMA** (BAST)
7. **INSTRUKSI_LAPANGAN** (Instruksi Perubahan Lapangan)

## 2. Pemetaan & Filter Hak Akses

Fitur List tidak sembarangan menampilkan seluruh data aplikasi. Data difilter di sisi frontend (dan sebagian backend) berdasarkan sesi login pengguna.

1. **Filter Cabang (Branch Grouping):**
   - Jika pengguna bukan dari `HEAD OFFICE`, maka daftar dokumen yang ditarik dari API akan disaring _(filtered)_ ulang menggunakan konfigurasi konstanta `BRANCH_GROUPS` (berada di `lib/constants.ts`). 
   - Pengguna hanya dapat melihat dokumen milik cabang atau _group_ cabangnya sendiri.
2. **Filter Khusus Kontraktor / Direktur (RAB):**
   - Jika pengguna memiliki jabatan `KONTRAKTOR` atau `DIREKTUR` dan memiliki parameter `nama_pt` di sesi (sessionStorage), saat menembak `fetchRABList()`, aplikasi otomatis menyematkan parameter `{ nama_pt: sessionNamaPt }`. Sehingga Kontraktor hanya bisa melihat RAB yang PT-nya bersesuaian dengan perusahaan mereka.

## 3. Alur Normalisasi Data (Frontend)

Sama halnya dengan dasbor Approval, karena setiap endpoint API `List` maupun `Detail` mengembalikan struktur objek JSON yang sangat bervariasi, frontend menggunakan mekanisme *Normalizer* agar UI/Komponen bisa menggunakan satu _template_ tunggal.

### 3.1 Normalisasi List
Fungsi seperti `normalizeRABDocs`, `normalizeSPKDocs`, hingga `normalizeInstruksiLapanganDocs` akan mengubah *response* array API menjadi tipe `NormalizedDoc` yang seragam:
- `id`
- `tipe` (Kategori)
- `nomor_ulok`
- `nama_toko`
- `cabang`
- `status`
- `total_nilai`
- `link_pdf`

### 3.2 Normalisasi Detail
Ketika baris data di-klik, sistem memanggil fungsi `fetch*Detail(id)` (contoh: `fetchRABDetail(id)`), lalu menjalankan blok pembentukan objek tipe `NormalizedDetail`. Proses ini meratakan hierarki JSON, menangkap *array items* (spesifikasi tabel material/upah), dan log persetujuan.

## 4. Fitur Unduh PDF

Beberapa dokumen utama mendukung fitur *Download PDF* Laporan secara langsung dari halaman Detail ini. Panggilan dilakukan ke fungsi-fungsi yang telah diimpor dari `lib/api.ts`:
- `downloadRABPdf(id)` -> untuk RAB
- `downloadSPKPdf(id)` -> untuk SPK
- `downloadOpnameFinalPdf(id)` -> untuk Opname
- `downloadInstruksiLapanganPdf(id)` -> untuk Instruksi Lapangan

## 5. Fitur Update Status RAB Khusus (Manual Update)
Walaupun sebagian besar halaman ini *Read-Only*, terdapat fitur rahasia/terbatas yang ditujukan bagi pengguna `HEAD OFFICE`. Pengguna dengan cabang Head Office memiliki sebuah opsi *Dropdown* untuk me-_override_ atau memperbarui _Status RAB_ secara manual/paksa ke backend (misal dari "Pending" menjadi "Dibatalkan").
