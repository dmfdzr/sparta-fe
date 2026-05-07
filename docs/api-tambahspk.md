# Dokumentasi Logika UI - Fitur Tambah SPK (Addendum)

Dokumentasi ini menjelaskan secara spesifik logika pada sisi antarmuka (*Frontend*) untuk pengajuan **Pertambahan Hari SPK (Addendum/CCO)** yang berada di berkas `app/tambahspk/page.tsx`.

Catatan: Untuk detail *Endpoint* API dan struktur *Payload* pengajuan Pertambahan SPK, Anda dapat merujuk ke [Dokumentasi API SPK](api-spk.md).

## 1. Hak Akses (Role Base Access)
Tidak semua orang dapat mengakses form ini. Berdasarkan fungsi `useEffect`, pengajuan addendum hanya dibatasi untuk role:
- `BRANCH BUILDING & MAINTENANCE MANAGER`
- `BRANCH BUILDING SUPPORT DOKUMENTASI`

Sistem akan otomatis melempar _(redirect)_ kembali ke Dashboard jika _role_ pengguna tidak sesuai.

## 2. Kalkulasi Tanggal Otomatis (Auto-Calculation)
Sistem meminimalisir *human error* dengan tidak mengizinkan pengguna memilih kalender akhir secara manual:
- Saat pengguna memilih sebuah "SPK Approved", sistem menangkap `waktu_selesai` (Tanggal Akhir SPK) yang berlaku.
- Pengguna cukup menginput **Jumlah Hari** perpanjangan.
- Fungsi pembantu `addDays(tanggalSpkAkhir, parseInt(pertambahanHari))` akan secara dinamis (menggunakan `useMemo`) mengkalkulasi dan menampilkan tanggal "SPK Akhir Setelah Perpanjangan" ke layar. Angka ini yang kemudian dikirim ke backend.

## 3. Logika Pemblokiran & Revisi (Validation Rules)

Karena SPK hanya bisa memiliki 1 proses pengajuan aktif, *state* antarmuka memiliki aturan ketat:

### 3.1 Status Pending (Form Disabled)
Apabila sistem mendeteksi ada riwayat pengajuan perpanjangan untuk SPK terpilih yang masih berstatus `Menunggu Persetujuan` (belum dijawab oleh BM), maka **seluruh form otomatis di-disable** (transparan & tidak bisa di-klik) untuk mencegah pengajuan ganda / *spam*.

### 3.2 Mode Revisi (Ditolak BM)
Jika pengajuan terakhir berstatus `Ditolak BM`, sistem akan masuk ke **Mode Revisi**:
1. Menampilkan **Modal Popup Merah** yang berisi Alasan Penolakan dari BM.
2. Mengisi ulang (*Auto-populate*) seluruh *form* dengan data pengajuan lama agar PIC tidak perlu mengetik dari awal.
3. **Validasi Perubahan Wajib:** Variabel `isRevisiUnchanged` akan aktif. Tombol submit tidak akan bisa ditekan jika PIC tidak mengubah *minimal 1 karakter* (baik hari, alasan, atau dokumen baru) dibandingkan pengajuan yang ditolak. Ini mencegah pengajuan ulang data yang sama persis.
4. Ketika dikirim, sistem menggunakan `updatePertambahanSPK` (PUT/Revisi), bukan POST data baru.

## 4. Mode Lampiran Opsional
Lampiran bersifat opsional.
Jika PIC menemukan bahwa ada *existing* lampiran dari revisi sebelumnya dan tidak mengupload lampiran baru, sistem membiarkannya. Jika PIC mengunggah file gambar (JPG/PNG), *Thumbnail Preview* akan otomatis digenerate dan ditampilkan di atas form upload (`URL.createObjectURL`).
