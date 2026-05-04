# SPARTA (System for Property Administration, Reporting, Tracking & Approval)

SPARTA adalah platform manajemen proyek dan aset toko terintegrasi yang dirancang untuk mengelola siklus pembangunan gedung/toko di lingkungan Alfamart. Aplikasi ini mencakup fitur perencanaan anggaran (RAB), pemantauan progress (Gantt Chart), hingga penyimpanan dokumen teknis.

## 🚀 Teknologi Utama

- **Framework**: [Next.js 16+](https://nextjs.org/) (App Router)
- **Bahasa**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Komponen UI**: [Shadcn UI](https://ui.shadcn.com/) (berbasis Radix UI)
- **Ikon**: Lucide React & Hugeicons
- **Charts**: Chart.js & React-Chartjs-2
- **PDF Generation**: jsPDF & jsPDF-AutoTable

## 📂 Modul Utama

Aplikasi ini terdiri dari beberapa modul fungsional utama:

1. **Rencana Anggaran Biaya (RAB)**: Pembuatan dan pengelolaan penawaran final dari kontraktor.
2. **Surat Perintah Kerja (SPK)**: Pembuatan dan persetujuan SPK serta penambahan masa kerja.
3. **Monitoring Proyek (Gantt Chart)**: Visualisasi progress harian dan mingguan proyek pembangunan toko baru.
4. **Opname Proyek**: Evaluasi lapangan untuk progres fisik bangunan.
5. **Penyimpanan Dokumen Toko**: Database aset toko yang mencakup spesifikasi teknis dan 12 kategori dokumen (Sipil, ME, RAB, SPK, dll).
6. **Dokumentasi Bangunan**: Sistem pelaporan foto progres pembangunan secara sistematis.
7. **Approval System**: Alur persetujuan bertingkat (Branch Manager, Direktur, dll) untuk berbagai dokumen proyek.
8. **Monitoring Dashboard**: Grafik real-time untuk memantau status dan kesehatan proyek di seluruh cabang.

## 🛠️ Persiapan Pengembangan

### Prerequisites
- Node.js 20+
- npm / yarn / pnpm

### Instalasi
1. Clone repository ini.
2. Install dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi Environment Variables:
   Buat file `.env.local` dan tambahkan:
   ```env
   NEXT_PUBLIC_API_URL=https://sparta-be.onrender.com
   ```

### Menjalankan Development Server
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) untuk melihat hasilnya.

## 🏗️ Struktur Folder

```text
├── app/               # Next.js App Router (Halaman & Routing)
│   ├── svdokumen/     # Modul Penyimpanan Dokumen
│   ├── rab/           # Modul RAB
│   ├── spk/           # Modul SPK
│   ├── gantt/         # Modul Gantt Chart
│   └── ...
├── components/        # Reusable UI Components
│   └── ui/            # Shadcn UI Components
├── lib/               # Utility functions & API configuration
│   ├── api.ts         # Koleksi fetcher API
│   ├── constants.ts   # Global constants (URL, Menu, Role)
│   └── utils.ts       # Tailwind merge utility
├── public/            # Static assets (Images, Workers)
└── types/             # Global Type Definitions
```

## 🔐 Keamanan & Role
SPARTA menerapkan kontrol akses berbasis peran (RBAC) yang dikonfigurasi melalui `lib/constants.ts`. Peran yang tersedia meliputi:
- **Head Office**: Akses global monitoring (read-only).
- **Branch Manager**: Approval & Monitoring.
- **Building Coordinator/Support**: Operasional input data & dokumen.
- **Kontraktor**: Input RAB & Monitoring progress harian.

---
© 2026 SPARTA Building Maintenance System.
