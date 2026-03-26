"use client"

import React, { useState } from 'react';
import Link from 'next/link';
import AppNavbar from '@/components/AppNavbar'; // Menggunakan AppNavbar
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  BookOpen, 
  HardHat, 
  UserCheck, 
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  FileSignature,
  Camera,
  ClipboardList,
  CalendarDays,
  FileCheck2,
  FileUp,
  LineChart,
  ClipboardCheck,
  Building2,
  MapPin
} from 'lucide-react';

export default function UserManualPage() {
  const [activeMenu, setActiveMenu] = useState('pengenalan');

  const menus = [
    { id: 'pengenalan', label: 'Pengenalan SPARTA', icon: BookOpen },
    { id: 'kontraktor', label: 'Panduan Kontraktor', icon: HardHat },
    { id: 'sat', label: 'Panduan Internal SAT', icon: UserCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* Menggunakan AppNavbar dengan konfigurasi tombol back dan judul */}
      <AppNavbar 
        title="USER MANUAL"
        showBackButton={true}
        backHref="/"
        showBuildingLogo={true}
      />

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8">
        
        {/* SIDEBAR NAVIGATION */}
        <div className="w-full md:w-1/4 flex flex-col gap-2">
          {menus.map((menu) => {
            const Icon = menu.icon;
            const isActive = activeMenu === menu.id;
            return (
              <button
                key={menu.id}
                onClick={() => setActiveMenu(menu.id)}
                className={`flex items-center justify-between p-4 rounded-xl transition-all duration-300 text-left ${
                  isActive 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'bg-white text-slate-600 hover:bg-red-50 hover:text-red-600 border border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 font-semibold">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {menu.label}
                </div>
                <ChevronRight className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-300'}`} />
              </button>
            );
          })}
        </div>

        {/* CONTENT AREA */}
        <div className="w-full md:w-3/4 flex flex-col gap-6">
          
          {/* CONTENT: PENGENALAN */}
          {activeMenu === 'pengenalan' && (
            <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 border-none shadow-lg">
              <CardHeader className="border-b border-slate-100 bg-white rounded-t-xl pb-6">
                <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <BookOpen className="w-7 h-7 text-red-600" /> 
                  Tentang SPARTA
                </CardTitle>
                <CardDescription className="text-base">
                  Latar Belakang dan Fitur Utama Sistem
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6 bg-white rounded-b-xl">
                <p className="text-slate-600 leading-relaxed">
                  <strong>SPARTA</strong> (System for Property Administration, Reporting, Tracking, and Approval) merupakan program untuk mendigitalisasi proses bisnis yang ada pada Building & Maintenance (khususnya Building).
                </p>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-3">Melalui satu platform digital, SPARTA menghubungkan proses:</h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {['Penawaran', 'Pembuatan SPK', 'Pengawasan', 'Opname', 'Instruksi Lapangan', 'Serah Terima', 'Dokumentasi Bangunan Toko Baru', 'Penyimpanan Dokumen Terpusat'].map((fitur, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <CheckSquare className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <span>{fitur}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CONTENT: KONTRAKTOR */}
          {activeMenu === 'kontraktor' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100 bg-white rounded-t-xl">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <HardHat className="w-7 h-7 text-red-600" /> 
                    Alur Kerja Kontraktor
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  
                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                      <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                      Akses & Login
                    </h3>
                    <ul className="list-disc list-outside ml-11 text-slate-600 space-y-2">
                      <li>Buka link aplikasi SPARTA (<a href="https://sparta-alfamart.vercel.app/" target="_blank" className="text-red-600 hover:underline">https://sparta-alfamart.vercel.app/</a>).</li>
                      <li>Pilih menu <strong>Dashboard</strong>.</li>
                      <li>Login menggunakan email yang pernah didaftarkan.</li>
                      <li>Password default menggunakan nama Cabang lokasi bekerja dengan <strong>huruf kapital</strong> (Contoh: CIKOKOL).</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                      <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                      Penawaran Final Kontraktor
                    </h3>
                    <ul className="list-disc list-outside ml-11 text-slate-600 space-y-2">
                      <li>Pilih menu <strong>Penawaran Final Kontraktor</strong> di halaman utama.</li>
                      <li>Isi form item pekerjaan yang tersedia (seperti Pekerjaan Persiapan, Pekerjaan Bobokan/Bongkaran, dll).</li>
                      <li>Pilih tombol <strong>Kirim</strong> apabila sudah selesai mengisi seluruh penawaran.</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                      <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
                      Dokumen Final RAB Termaterai
                    </h3>
                    <ul className="list-disc list-outside ml-11 text-slate-600 space-y-2">
                      <li>Pilih menu <strong>Dokumen Final RAB Termaterai</strong>.</li>
                      <li>Pilih tombol <strong>Buka Form</strong>.</li>
                      <li>Upload Cover SPH beserta dokumen RAB Final yang telah disetujui Manager dalam format PDF, lalu pilih <strong>Simpan</strong>.</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                      <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">4</span>
                      Gantt Chart (POV Kontraktor)
                    </h3>
                    <ul className="list-disc list-outside ml-11 text-slate-600 space-y-2">
                      <li>Gantt Chart ditampilkan sebagai bentuk komitmen Kontraktor terhadap jadwal kerja.</li>
                      <li>Kontraktor hanya bisa melihat (view) Gantt Chart.</li>
                      <li>Apabila terdapat input keterlambatan oleh tim pengawas, sistem akan otomatis merubah grafik Gantt Chart pada tampilan Kontraktor.</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                      <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">5</span>
                      Persetujuan Opname
                    </h3>
                    <ul className="list-disc list-outside ml-11 text-slate-600 space-y-2">
                      <li>Pilih menu <strong>Opname</strong>.</li>
                      <li>Lakukan pengecekan pada <strong>Volume Aktual</strong> dan <strong>Foto</strong> yang diunggah oleh pengawas.</li>
                      <li>Berikan catatan opsional jika diperlukan.</li>
                      <li>Pilih tindakan <strong>Approve</strong> atau <strong>Reject</strong> pada setiap item laporan Opname.</li>
                      <li>Hasil Riwayat Opname Final yang telah diapprove dapat dilihat dan di-download dalam bentuk PDF.</li>
                    </ul>
                  </div>

                </CardContent>
              </Card>
            </div>
          )}

          {/* CONTENT: INTERNAL SAT */}
          {activeMenu === 'sat' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100 bg-white rounded-t-xl">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <UserCheck className="w-7 h-7 text-red-600" /> 
                    Alur Internal SAT
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  
                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                      <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                      Akses & Login
                    </h3>
                    <ul className="list-disc list-outside ml-11 text-slate-600 space-y-2">
                      <li>Buka link aplikasi SPARTA dan pilih menu <strong>Dashboard</strong>.</li>
                      <li>Login menggunakan email Internal SAT yang valid.</li>
                      <li>Password default menggunakan nama Cabang dengan <strong>huruf kapital</strong> (Contoh: CIKOKOL).</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                      <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                      Persetujuan Penawaran Final
                    </h3>
                    <ul className="list-disc list-outside ml-11 text-slate-600 space-y-2">
                      <li>Coordinator & Manager akan menerima notifikasi via Email (PERLU PERSETUJUAN).</li>
                      <li>Cek dan validasi <strong>Penawaran</strong> dan <strong>Gantt Chart</strong> yang diajukan Kontraktor.</li>
                      <li>Pilih <strong>Setuju</strong> apabila sudah approve atau <strong>Tolak</strong> apabila ada yang harus direvisi. Form otomatis akan kembali ke Kontraktor jika ditolak.</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                      <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
                      Pembuatan SPK & Tambahan SPK
                    </h3>
                    <ul className="list-disc list-outside ml-11 text-slate-600 space-y-2">
                      <li>Pilih form <strong>Surat Perintah Kerja</strong>, lengkapi data-data yang dibutuhkan, dan kirim untuk persetujuan Branch Manager.</li>
                      <li>Apabila dibutuhkan tambahan hari, pilih <strong>Tambahan Surat Perintah Kerja</strong>, lengkapi alasan (seperti Kendala Cuaca, Perizinan, dll), unggah dokumen pendukung, lalu kirim untuk persetujuan Branch Manager.</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                      <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">4</span>
                      Input PIC & Pengawasan Lapangan
                    </h3>
                    <ul className="list-disc list-outside ml-11 text-slate-600 space-y-2">
                      <li>Pilih menu <strong>PIC Pengawasan</strong> untuk menugaskan personil pengawas proyek.</li>
                      <li>Petugas PIC akan mendapatkan notifikasi email Jadwal Pengawasan. Pengawasan diisi sesuai target hari (Misal: H7, H17) dari hari SPK.</li>
                      <li>Isi status pekerjaan (Tepat Waktu/Terlambat), masukkan catatan spesifik jika terlambat, dan unggah foto dokumentasi di setiap item pekerjaan yang berjalan.</li>
                      <li>Bisa menggunakan bantuan visual fitur <strong>Gantt Chart (POV SAT)</strong> untuk melihat milestone project & pengawasan. Keterlambatan hasil pengawasan akan otomatis memengaruhi Gantt Chart.</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                      <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">5</span>
                      Serah Terima Pekerjaan
                    </h3>
                    <ul className="list-disc list-outside ml-11 text-slate-600 space-y-2">
                      <li>Petugas akan menerima email notifikasi Tugas Serah Terima. Buka Laporan Serah Terima pada hari terakhir pengawasan.</li>
                      <li>Isi Serah Terima secara detail <strong>per item area</strong>. Apabila item tidak ada di lokasi, pilih keterangan "Tidak Ada".</li>
                      <li>Beri penilaian Kesesuaian Design, Kualitas, dan Spesifikasi secara aktual.</li>
                      <li>Tentukan keputusan <strong>Terima</strong> atau <strong>Tidak Diterima</strong> lalu upload foto. Apabila ditolak, wajib ditentukan tanggal serah terima berikutnya.</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                      <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">6</span>
                      Input Opname Harian
                    </h3>
                    <ul className="list-disc list-outside ml-11 text-slate-600 space-y-2">
                      <li>Pilih menu <strong>Opname</strong> lalu klik <strong>Input Opname Harian</strong>.</li>
                      <li>Pilih Lokasi Toko dan Lingkup Pekerjaan.</li>
                      <li>Isi detail Volume Aktual yang diselesaikan, lalu Upload Foto pendukung, dan klik Simpan untuk diverifikasi oleh Kontraktor.</li>
                      <li>Riwayat Opname Final dapat dilihat pada menu Lihat Opname Final dan bisa diunduh PDF (Berita Acara Opname Pekerjaan).</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                      <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">7</span>
                      Instruksi Lapangan
                    </h3>
                    <ul className="list-disc list-outside ml-11 text-slate-600 space-y-2">
                      <li>Fitur Instruksi Lapangan terdapat di bagian paling bawah pada halaman pengisian form (seperti saat input opname).</li>
                      <li>Pembuat dokumen instruksi (Maker) adalah Building Support. Dokumen harus disetujui (Mengetahui) oleh Coordinator dan (Menyetujui) oleh Manager.</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                      <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">8</span>
                      Dokumentasi Bangunan Toko Baru
                    </h3>
                    <ul className="list-disc list-outside ml-11 text-slate-600 space-y-2">
                      <li>Pilih menu <strong>Dokumentasi Bangunan Toko Baru</strong> dan lengkapi data proyek.</li>
                      <li>Pilih warna layout area yang menyala hijau (sesuai list urutan). Apabila butuh revisi, klik nomor area yang sudah di-upload.</li>
                      <li>Gunakan opsi sesuai kebutuhan lapangan: <strong>Ambil Foto</strong> (Kamera), <strong>Upload Foto</strong> (Galeri), atau <strong>Tidak Bisa Difoto</strong> (contoh: kendala izin masuk area tetangga).</li>
                      <li>Hasil dokumentasi akan dikirim melalui Email untuk validasi (Pengecekan & Approval) oleh Tim Building & Maintenance Control pusat.</li>
                    </ul>
                  </div>

                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}