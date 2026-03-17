import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Info, 
  FileText, 
  Activity, 
  CheckCircle, 
  HardHat,
  Briefcase,
  Eye,
  ClipboardList,
  Camera,
  Archive
} from 'lucide-react';

export default function TentangSparta() {
  // 8 Proses inti SPARTA berdasarkan dokumen Latar Belakang
  const processes = [
    {
      title: "Penawaran",
      icon: <Briefcase className="w-6 h-6 text-slate-700" />
    },
    {
      title: "Pembuatan SPK",
      icon: <FileText className="w-6 h-6 text-slate-700" />
    },
    {
      title: "Pengawasan",
      icon: <Eye className="w-6 h-6 text-slate-700" />
    },
    {
      title: "Opname",
      icon: <Activity className="w-6 h-6 text-slate-700" />
    },
    {
      title: "Instruksi Lapangan",
      icon: <ClipboardList className="w-6 h-6 text-slate-700" />
    },
    {
      title: "Serah Terima",
      icon: <CheckCircle className="w-6 h-6 text-slate-700" />
    },
    {
      title: "Dokumentasi",
      desc: "Bangunan toko baru",
      icon: <Camera className="w-6 h-6 text-slate-700" />
    },
    {
      title: "Penyimpanan",
      desc: "Dokumen toko eksisting terpusat",
      icon: <Archive className="w-6 h-6 text-slate-700" />
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* HEADER */}
      <header className="flex items-center justify-between p-4 md:p-6 bg-linear-to-br from-red-600 to-red-800 text-white border-b border-red-900 shadow-md">
        <Link 
          href="/" 
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-white outline-none"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium hidden sm:inline">Kembali</span>
        </Link>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">
          Tentang SPARTA
        </h1>
        <div className="w-20"></div> {/* Spacer untuk keseimbangan flex */}
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 mt-4 md:mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* HERO SECTION */}
        <div className="flex flex-col items-center text-center mb-12">
          <div className="bg-red-100 p-4 rounded-full mb-6">
            <HardHat className="w-12 h-12 text-red-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-4">
            System for Property Administration, Reporting, Tracking & Approval
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl leading-relaxed">
            SPARTA merupakan program untuk mendigitalisasi proses bisnis yang ada pada 
            <span className="font-semibold text-slate-800"> Building & Maintenance</span> (khususnya Building). 
            Melalui satu platform digital, sistem ini terintegrasi dan dirancang untuk menghubungkan seluruh proses kerja.
          </p>
        </div>

        {/* PROCESSES GRID */}
        <div className="mb-12">
          <h3 className="text-xl font-bold text-center text-slate-800 mb-8">
            Platform Digital Terpusat untuk Proses:
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {processes.map((item, index) => (
              <Card key={index} className="border-slate-200 hover:border-red-300 hover:shadow-md transition-all duration-300">
                <CardHeader className="flex flex-col items-center gap-3 p-4 text-center h-full justify-center">
                  <div className="bg-slate-100 p-3 rounded-full">
                    {item.icon}
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold text-slate-800">{item.title}</CardTitle>
                    {item.desc && (
                      <CardDescription className="text-xs text-slate-500 mt-1">{item.desc}</CardDescription>
                    )}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* VERSION & SYSTEM INFO */}
        <Card className="border-dashed border-2 border-slate-300 bg-transparent shadow-none text-center p-8 max-w-2xl mx-auto">
          <Info className="w-8 h-8 text-slate-400 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-800 mb-2">Informasi Sistem</h3>
          <p className="text-sm text-slate-500 mb-1">Versi: 1.0.0</p>
          <p className="text-sm text-slate-500">
            Dikembangkan khusus untuk kegunaan manajemen internal.
          </p>
        </Card>

      </main>
    </div>
  );
}