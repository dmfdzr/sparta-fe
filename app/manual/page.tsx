"use client"

import React, { useEffect, useRef, useState } from 'react';
import AppNavbar from '@/components/AppNavbar'; // Menggunakan AppNavbar
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  AlertCircle,
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
  FileUp,
  LineChart,
  ClipboardCheck,
  Building2,
  MapPin,
  Download,
  ExternalLink,
  Sparkles
} from 'lucide-react';

function PdfCanvasPreview({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    let renderGeneration = 0;

    const renderPdf = async () => {
      const generation = ++renderGeneration;
      setStatus('loading');
      setErrorMessage('');

      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();

        const container = containerRef.current;
        if (!container) return;

        container.innerHTML = '';
        const loadingTask = pdfjsLib.getDocument(src);
        const pdf = await loadingTask.promise;
        const deviceScale = window.devicePixelRatio || 1;
        const targetWidth = Math.min(container.clientWidth || 820, 980);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled || generation !== renderGeneration) {
            await loadingTask.destroy();
            return;
          }

          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = targetWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });
          const pageShell = document.createElement('div');
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) {
            throw new Error('Canvas browser tidak tersedia.');
          }

          canvas.width = Math.floor(viewport.width * deviceScale);
          canvas.height = Math.floor(viewport.height * deviceScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);

          pageShell.className = 'mx-auto mb-4 flex w-fit max-w-full justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200';
          canvas.className = 'block max-w-full rounded-lg';
          pageShell.appendChild(canvas);
          container.appendChild(pageShell);

          await page.render({ canvasContext: context, viewport }).promise;
        }

        if (!cancelled && generation === renderGeneration) {
          setStatus('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Preview PDF gagal dimuat.');
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className="relative h-[72vh] min-h-[520px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-inner">
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/90 text-sm font-semibold text-slate-600">
          Memuat preview PDF...
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-100 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <p className="max-w-md text-sm font-semibold text-slate-700">Preview PDF belum bisa dimuat.</p>
          <p className="max-w-md text-xs text-slate-500">{errorMessage}</p>
        </div>
      )}
      <div ref={containerRef} className="mx-auto w-full max-w-[980px]" />
    </div>
  );
}

export default function UserManualPage() {
  const [activeMenu, setActiveMenu] = useState('pengenalan');

  const menus = [
    { id: 'pengenalan', label: 'Pengenalan SPARTA', icon: BookOpen },
    { id: 'pembaruan-v2', label: 'Pembaruan SPARTA V2', icon: Sparkles },
    { id: 'kontraktor', label: 'Panduan Kontraktor', icon: HardHat },
    { id: 'sat', label: 'Panduan Internal SAT', icon: UserCheck },
  ];

  const pembaruanPdfHref = '/user-manual/pembaruan-sparta-v2.pdf';

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

          {/* CONTENT: PEMBARUAN V2 */}
          {activeMenu === 'pembaruan-v2' && (
            <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 border border-slate-200 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-white pb-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-slate-900">
                        Pembaruan SPARTA V2
                      </CardTitle>
                      <CardDescription className="mt-2 max-w-2xl text-base text-slate-600">
                        Ringkasan pembaruan fitur dan alur kerja terbaru SPARTA.
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 lg:justify-end">
                    <a href={pembaruanPdfHref} target="_blank" rel="noopener noreferrer">
                      <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100">
                        <ExternalLink className="w-4 h-4" />
                        Lihat PDF
                      </button>
                    </a>
                    <a href={pembaruanPdfHref} download>
                      <button className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700">
                        <Download className="w-4 h-4" />
                        Unduh PDF
                      </button>
                    </a>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 md:p-6 space-y-5 bg-white">
                <div className="rounded-xl border border-slate-200 bg-linear-to-r from-slate-50 to-white p-5">
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wide">Dokumen PDF</p>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">Pembaruan Sparta V2.pdf</h3>
                  <p className="text-slate-600 mt-2">
                    Preview akan tampil di bawah. Jika browser tidak mendukung preview PDF, gunakan tombol Lihat PDF.
                  </p>
                </div>

                <PdfCanvasPreview src={pembaruanPdfHref} />
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
                      <li>Hasil Riwayat Opname yang telah diapprove dapat dilihat dan di-download dalam bentuk PDF.</li>
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
                      <li>Riwayat Opname dapat dilihat pada menu Lihat Opname dan bisa diunduh PDF (Berita Acara Opname Pekerjaan).</li>
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
