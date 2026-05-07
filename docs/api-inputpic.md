# Dokumentasi API & Logika - Fitur Input PIC Pengawasan

Dokumentasi ini menjelaskan logika, integrasi API, dan alur kerja (workflow) untuk fitur **Input PIC Pengawasan** pada aplikasi SPARTA. Logika frontend fitur ini berada di `app/inputpic/page.tsx` yang kemudian berinteraksi dengan API melalui `lib/api.ts`.

## 1. Fungsi & Kegunaan Utama
Fitur ini dikhususkan bagi **Branch Building Coordinator (BBC)** untuk menugaskan staf *Building Support (BBS)* sebagai PIC Pengawasan (Penanggung Jawab Lapangan) pada suatu proyek. Selain menetapkan *siapa* pengawasnya, fitur ini mewajibkan BBC untuk menentukan **Titik Hari Pengawasan** secara spesifik di atas representasi visual Gantt Chart.

## 2. Pemetaan Hak Akses & Inisialisasi

- **Akses Role:** Secara _hardcoded_, halaman ini menolak (me-*redirect*) pengguna yang tidak login dengan *role* atau jabatan sebagai `BRANCH BUILDING COORDINATOR`.
- **Inisialisasi Data:**
  - Mengambil daftar SPK yang telah disetujui penuh (`SPK_APPROVED`) via `fetchSPKList()`.
  - Memfilter daftar SPK tersebut agar hanya memunculkan SPK yang cabangnya sesuai dengan cabang user yang sedang login.
  - Memuat daftar staf di cabang tersebut yang memiliki jabatan `BRANCH BUILDING SUPPORT` via `fetchUserCabangList()`.

## 3. Alur Interaksi & Validasi (Workflow)

Saat Koordinator memilih sebuah proyek (ULOK) dari daftar SPK, sistem akan memicu _chain of fetch_ (rantai penarikan data) berikut:

1. **Cek Ketersediaan PIC:** Memanggil `fetchPICPengawasanList` dengan parameter `nomor_ulok` untuk memastikan belum ada PIC yang ditetapkan. Jika sudah ada, UI akan terkunci (_locked_).
2. **Tarik Detail RAB:** Memanggil `fetchRABList` lalu `fetchRABDetail` untuk mendapatkan parameter penting: `kategori_lokasi`.
3. **Render Gantt Chart:** Memanggil `fetchGanttDetailByToko` untuk mengambil data jadwal (Day Items) dan melukis komponen **Interactive Gantt Chart**.

### 3.1 Aturan Penentuan Hari Pengawasan (Supervision Rules)
Sistem memiliki validasi ketat (_strict validation_) saat Koordinator menekan (mengklik) angka hari di *header* Gantt Chart:

- **Aturan Jumlah Hari (Required Days):** 
  - Jika `kategori_lokasi` mengandung kata **Non Ruko**, maka jumlah hari pengawasan wajib tepat berjumlah **8 Hari**.
  - Jika `kategori_lokasi` mengandung kata **Ruko**, maka jumlah hari pengawasan wajib tepat berjumlah **4 Hari**.
- **Aturan Hari Wajib:**
  - Koordinator wajib mencentang/memilih awal proyek: antara **H-1** atau **H-2**.
  - Koordinator wajib mencentang hari terakhir proyek (**H-Maksimum** / *Duration*). Hari terakhir ini di-*lock* otomatis oleh sistem saat data termuat.

## 4. Tipe Data (Types) & Endpoint

### 4.1 Tipe Data Utama
```typescript
export type PICPengawasanPayload = {
    id_toko: number;
    nomor_ulok: string;
    id_rab: number;
    id_spk: number;
    kategori_lokasi: string;
    durasi: string;
    tanggal_mulai_spk: string;
    plc_building_support: string; // Nama PIC yang dipilih
    hari_pengawasan: number[];    // Array angka hari (contoh: [1, 7, 14, 20])
};
```

### 4.2 Endpoint Submit
Saat tombol "Simpan" ditekan, fungsi `handleSubmit` menjalankan 2 tahap _submit_ ke API secara asinkron:

**Tahap 1: Simpan PIC**
- **Fungsi:** `submitPICPengawasan(payload)`
- **Endpoint:** `POST /api/pic_pengawasan`
- **Tujuan:** Menyimpan data asosiasi/relasi antara ULOK, SPK, dan nama PIC pengawas.

**Tahap 2: Injeksi ke Gantt Chart (Gantt Pengawasan)**
- **Fungsi:** `submitGanttPengawasan(id_gantt, tanggal_pengawasan)`
- **Endpoint:** `POST /api/gantt/{id_gantt}/pengawasan`
- **Tujuan:** *Array* yang tadinya berbentuk urutan hari (misal `[1, 7, 30]`) akan dikalkulasi di *frontend* dengan menjumlahkannya terhadap *Tanggal Mulai SPK* untuk menghasilkan format tanggal sebenarnya (`YYYY-MM-DD`). Deretan tanggal nyata ini kemudian ditembakkan ke tabel Gantt agar nantinya aplikasi PIC Lapangan (*Mobile / Eksternal*) otomatis memunculkan jadwal kunjungan sesuai tanggal tersebut.
