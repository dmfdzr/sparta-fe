"use client"

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye } from 'lucide-react';
import { fetchGanttData } from '@/lib/api';
import AppNavbar from '@/components/AppNavbar';

const SUPERVISION_RULES: Record<number, number[]> = {
    10: [2, 5, 8, 10], 14: [2, 7, 10, 14], 20: [2, 12, 16, 20],
    30: [2, 7, 14, 18, 23, 30], 35: [2, 7, 17, 22, 28, 35],
    40: [2, 7, 17, 25, 33, 40], 48: [2, 10, 25, 32, 41, 48]
};

function GanttViewer() {
  const searchParams = useSearchParams();
  const urlUlok = searchParams.get('ulok');
  const urlLingkup = searchParams.get('lingkup') || 'Sipil';

  const [projectData, setProjectData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (urlUlok) {
        setIsLoading(true);
        fetchGanttData(urlUlok, urlLingkup)
            .then(data => {
                setProjectData({
                    ulokClean: urlUlok, 
                    store: data.rab?.Nama_Toko || "Toko Tidak Diketahui",
                    duration: parseInt(data.rab?.Durasi_Pekerjaan || 30)
                });
                
                // MOCK: Anda perlu memparsing data Gantt/hari dari backend
                // dan mengkonversinya ke format tasks seperti di halaman page.tsx
                // Format: [{ id, name, ranges: [{start, end}], dependencies: [] }]
                
            })
            .catch(err => setErrorMsg("Gagal memuat data dari server."))
            .finally(() => setIsLoading(false));
    } else {
        setErrorMsg("Parameter URL ?ulok= tidak ditemukan.");
    }
  }, [urlUlok, urlLingkup]);

  // Fungsi Render Graphic sama seperti di file Editor
  const renderGanttChart = () => {
    // Paste seluruh fungsi const renderGanttChart = () => { ... } dari atas kesini
    return <div className="p-8 text-center text-slate-500">Grafik Akan Dimuat Disini</div>;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      <AppNavbar
        title="Laporan Gantt Chart"
        showBackButton
        backHref="/dashboard"
        rightActions={
          <Badge className="bg-blue-500 text-white"><Eye className="w-3 h-3 mr-1" /> VIEWER</Badge>
        }
      />

      <main className="p-4 md:p-8 max-w-400 mx-auto">
          {errorMsg ? (
              <div className="bg-red-50 p-8 text-center rounded-xl border border-red-200">
                  <h2 className="text-red-600 font-bold">{errorMsg}</h2>
              </div>
          ) : (
              <Card className="overflow-hidden shadow-sm">
                  {isLoading ? (
                      <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-slate-400 w-10 h-10" /></div>
                  ) : (
                      renderGanttChart()
                  )}
              </Card>
          )}
      </main>
    </div>
  );
}

export default function Page() {
    return (
        <Suspense fallback={<div>Loading Viewer...</div>}>
            <GanttViewer />
        </Suspense>
    );
}