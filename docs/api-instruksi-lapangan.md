# Dokumentasi API & Logika - Fitur Instruksi Lapangan

Dokumentasi ini menjelaskan integrasi dan logika untuk modul **Instruksi Lapangan (IL)** pada aplikasi SPARTA. Modul ini digunakan untuk mengajukan penambahan atau perubahan pekerjaan (Change Order / CCO) di luar Rencana Anggaran Biaya (RAB) awal.

Logika formulir pengajuannya terdapat di `app/instruksi-lapangan/page.tsx` dan integrasi ke backend-nya berada di `lib/api.ts`.

## 1. Alur Pembuatan (Form Submission)

Pembuat Instruksi Lapangan (biasanya Koordinator / PIC Proyek) melakukan input melalui antarmuka *builder* dinamis:

1. **Pilih Proyek (Toko):**
   - Aplikasi memuat daftar toko `fetchTokoList()` yang sesuai dengan *Cabang* pengguna.
   - Ketika toko dipilih, sistem akan memeriksa apakah ada data IL sebelumnya yang berstatus `DITOLAK`. Jika ada, data (item & lampiran) dari IL yang ditolak tersebut otomatis dimuat (_auto-populate_) untuk dilakukan **Revisi**.
2. **Kalkulasi Harga Acuan (Master Price):**
   - Berdasarkan `lingkup_pekerjaan` toko (Sipil atau ME), aplikasi memanggil `fetchPricesData(cabang, lingkup)` untuk mendapatkan *Master Standard Price* per item pekerjaan.
   - Saat pengguna memilih "Jenis Pekerjaan", Harga Material dan Harga Upah otomatis terisi (_binded_).
   - Terdapat kondisi khusus **"Kondisional"**: Jika master data menunjukkan harga kondisional, *input text* akan terbuka _(editable)_ agar pengguna dapat mengisi harganya sendiri. Jika bukan kondisional, input harga terkunci _(readonly)_.
3. **Pajak & Cabang Bebas PPN (Batam):**
   - Sistem menjumlahkan semua item pekerjaan dan melakukan Pembulatan Ratusan/Ribuan (ke Rp. 10.000 terdekat).
   - Jika `cabang === "BATAM"`, PPN otomatis **0%**. Jika bukan Batam, dikenakan PPN sebesar **11%**.

## 2. Struktur Payload & Endpoint Submit

Karena Instruksi Lapangan mengizinkan **opsi lampiran (File)** pendukung, sistem mengakomodasi dua mode unggahan (_Dual Mode Upload_):

**Fungsi:** `submitInstruksiLapangan(fields, detailItems, lampiranFile?)`
**Endpoint:** `POST /api/instruksi-lapangan/submit`

- **Jika Tidak Ada Lampiran:** Sistem mengirimkan data sebagai `application/json` murni. *Array* `detail_items` dimasukkan secara *native* di dalam JSON.
- **Jika Terdapat Lampiran:** Sistem mengirimkan data sebagai `multipart/form-data`. Karena *form-data* tidak mendukung tipe data array/nested object secara langsung, variabel `detail_items` (kumpulan tabel pekerjaan) diubah (_stringify_) menjadi teks JSON sebelum disematkan di dalam payload.

## 3. Alur Persetujuan (Approval Hub)

Setelah diajukan, Instruksi Lapangan akan masuk ke sistem Hub Persetujuan Sentral (yang dapat dilihat di dashboard Approval).

**Endpoint List & Detail:**
- `GET /api/instruksi-lapangan/list?status=&nomor_ulok=` : Memuat daftar pengajuan yang perlu diproses.
- `GET /api/instruksi-lapangan/{id}` : Memuat informasi detail IL, array _items_ pekerjaan, dan log persetujuan.

**Endpoint Approval:**
- `POST /api/instruksi-lapangan/{id}/approval`
- **Hierarki Persetujuan (Role Access):**
  1. `KONTRAKTOR` (sebagai pihak eksternal yang menyetujui perintah penambahan kerja)
  2. `KOORDINATOR`
  3. `MANAGER`
  4. `DIREKTUR` (untuk instruksi yang melewati plafon tertentu, jika dikonfigurasi).

## 4. Cetak PDF
Setelah IL disetujui, pihak yang berwenang dapat mengunduh dokumen resmi berupa PDF yang berisi tabel spesifikasi pekerjaan, harga CCO, dan rekam jejak persetujuan *digital signature*.
- **Endpoint PDF:** `GET /api/instruksi-lapangan/{id}/pdf`
- Diakses melalui fungsi `downloadInstruksiLapanganPdf(id)`.
