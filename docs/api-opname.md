# Dokumentasi API & Logika - Fitur Opname & Opname Final

Dokumentasi ini mencakup fitur pengawasan penyelesaian kerja atau sering disebut **Opname**. Modul ini digunakan untuk membandingkan volume pekerjaan yang diklaim selesai oleh kontraktor dengan Rencana Anggaran Biaya (RAB) awal.

Logika *frontend* fitur ini dikelola melalui `app/opname/page.tsx` yang dibagi ke dalam 2 *View* (Tampilan) utama berdasarkan *Role* pengguna.

## 1. Alur Kerja (Workflows)

Aplikasi memiliki dua antarmuka (UI) berbeda yang dirender bergantung pada status akses _Kontraktor_:

### 1.1 PIC/SAT View (Submit Volume Akhir)
Ditujukan untuk PIC Pengawasan atau koordinator proyek internal.
1. **Pilih Proyek:** Sistem memuat daftar RAB yang berstatus "Disetujui" (Approved) dan sesuai dengan filter Cabang (`fetchRABList`).
2. **Form Pengisian Opname:** 
   - Aplikasi memuat detail item RAB awal (`fetchRABDetail`).
   - PIC akan memasukkan `volume_akhir` (hasil aktual di lapangan) serta status pengecekan verifikasi (*Desain, Kualitas, Spesifikasi*).
   - Wajib menyertakan foto bukti (`file_foto_opname`).
3. **Submit Bulk:** Item dapat di-submit satu per satu, maupun sekaligus secara massal (_bulk_). Pengiriman ini akan mengubah status item menjadi `pending`.
4. **Kunci Opname Final:** Jika **seluruh** item telah disetujui (_Approved_) oleh pihak Kontraktor, PIC dapat mengklik tombol "Kunci Opname Final". Ini akan memicu `kunciOpnameFinal()` yang mengunci proses pengajuan dan melempar keseluruhan berkas untuk melalui rantai persetujuan (Koordinator -> Manager -> Direktur).

### 1.2 Kontraktor View (Review & Approve/Reject)
Ditujukan untuk vendor (Kontraktor).
1. **Pilih Proyek:** Kontraktor memilih proyek berdasarkan filter `nama_pt` perusahaan mereka (`fetchOpnameList`).
2. **Persetujuan Item:** Kontraktor mengecek hasil `volume_akhir` dan foto bukti yang dikirim PIC.
   - **Setujui (Approve):** Memperbarui status item menjadi `disetujui` (via `updateOpname(id, { status: 'disetujui' })`).
   - **Tolak (Reject):** Memperbarui status item menjadi `ditolak` dan mewajibkan catatan penolakan. Data yang ditolak akan kembali muncul di form PIC untuk direvisi ulang.

## 2. Struktur Payload & Endpoint Submit

Karena mengirimkan banyak _file_ foto sekaligus dengan struktur JSON bersarang (nested), endpoint menggunakan **Multipart/Form-Data** dengan `FormData`.

**Fungsi:** `submitOpnameBulk(formData)`
**Endpoint:** `POST /api/opname/bulk`

**Format Payload (FormData):**
- `id_toko`: ID Toko
- `email_pembuat`: Email PIC
- `grand_total_opname`: Harga akumulatif aktual
- `grand_total_rab`: Harga akumulatif RAB
- `items`: *(JSON String)* Kumpulan objek payload item opname yang berisi:
  - `id_rab_item`
  - `status` ('pending')
  - `volume_akhir`
  - `selisih_volume`
  - `total_selisih`
  - `total_harga_opname`
  - `desain`, `kualitas`, `spesifikasi`
  - `foto` (Jika foto sudah ada dari revisi sebelumnya dan tidak diperbarui).
- `file_foto_opname`: *(Array Files)* File blob gambar-gambar baru.
- `file_foto_opname_indexes`: *(JSON String)* Array indeks (angka) yang memberi tahu backend file gambar A milik `items` indeks ke-berapa.

## 3. Endpoint Kunci Opname (Lock)

Ketika semua validasi selesai, PIC mengirim berkas Opname Final.
**Fungsi:** `kunciOpnameFinal(opnameFinalId, payload)`
**Endpoint:** `PUT /api/opname_final/{id}/kunci`

**Format Payload JSON:**
```json
{
  "id_toko": 12,
  "email_pembuat": "pic@alfa.com",
  "aksi": "terkunci",
  "grand_total_opname": "12000000",
  "grand_total_rab": "13000000",
  "opname_item": [
     // List objek detail item final
  ]
}
```

## 4. Alur Persetujuan (Approval Hub)

Setelah `Opname Final` dikunci, ia akan masuk ke siklus _Centralized Approval Hub_.
- Sama halnya dengan RAB dan Instruksi Lapangan, alur _approval_ Opname Final akan diproses di backend dan dapat direview di halaman `/approval` menggunakan aksi `tindakan: 'APPROVE' | 'REJECT'`.
- PDF laporan (*Opname Final PDF*) otomatis di-generate setelah melewati tahapan persetujuan dan dapat diunduh (melalui modul List menggunakan `downloadOpnameFinalPdf(id)`).
