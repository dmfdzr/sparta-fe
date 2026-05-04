"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, Search, Filter, Download, FileSpreadsheet, FileText, 
  ChevronLeft, ChevronRight, Edit, Trash2, ExternalLink, 
  PlusCircle, X, Upload, File, Image as ImageIcon, CheckCircle, 
  AlertCircle, LayoutDashboard, Loader2, Info, ArrowLeft, Save
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import AppNavbar from '@/components/AppNavbar';

// ==========================================
// 1. CONFIG & CONSTANTS
// ==========================================

const TARGET_API_URL = "https://script.google.com/macros/s/AKfycbw9m4ckqXZIjIwFIqJUYz7CGxSgX-ONmhcDeTEPo_VA6D7kI3VEjvYAww2Gn_eHCA_u/exec";

const MOCK_DOCUMENTS: StoreDocument[] = [
  {
    id: "1",
    kode_toko: "T001",
    nama_toko: "ALFAMART GADING SERPONG",
    cabang: "CIKOKOL",
    luas_sales: 120,
    luas_parkir: 50,
    luas_gudang: 30,
    luas_bangunan_lantai_1: 150,
    luas_bangunan_lantai_2: 0,
    luas_bangunan_lantai_3: 0,
    total_luas_bangunan: 150,
    luas_area_terbuka: 20,
    tinggi_plafon: 3.5,
    file_links: "Foto|Toko Depan|https://example.com/foto1.jpg",
    folder_drive: "https://drive.google.com/...",
    status: "Lengkap",
    updated_at: new Date().toISOString()
  },
  {
    id: "2",
    kode_toko: "T002",
    nama_toko: "ALFAMART BSD CITY",
    cabang: "CIKOKOL",
    luas_sales: 100,
    luas_parkir: 40,
    luas_gudang: 25,
    luas_bangunan_lantai_1: 125,
    luas_bangunan_lantai_2: 0,
    luas_bangunan_lantai_3: 0,
    total_luas_bangunan: 125,
    luas_area_terbuka: 15,
    tinggi_plafon: 3.2,
    file_links: "",
    folder_drive: "",
    status: "Belum Lengkap",
    updated_at: new Date().toISOString()
  }
];

const MOCK_TARGETS: TargetData[] = [
  { cabang: "CIKOKOL", reguler: 10, franchise: 5, total: 15 },
  { cabang: "PARUNG", reguler: 8, franchise: 4, total: 12 }
];

const UPLOAD_CATEGORIES = [
    { key: "fotoExisting", label: "Foto Toko Existing", group: "Foto" },
    { key: "fotoRenovasi", label: "Foto Proses Renovasi", group: "Foto" },
    { key: "me", label: "Gambar ME", group: "Gambar" },
    { key: "sipil", label: "Gambar Sipil", group: "Gambar" },
    { key: "sketsaAwal", label: "Sketsa Awal (Layout)", group: "Gambar" },
    { key: "spk", label: "Dokumen SPK", group: "Dokumen" },
    { key: "rab", label: "Dokumen RAB & Penawaran", group: "Dokumen" },
    { key: "pendukung", label: "Dokumen Pendukung", group: "Dokumen" },
    { key: "instruksiLapangan", label: "Instruksi Lapangan", group: "Dokumen" },
    { key: "pengawasan", label: "Berkas Pengawasan", group: "Dokumen" },
    { key: "aanwijzing", label: "Aanwijzing", group: "Dokumen" },
    { key: "kerjaTambahKurang", label: "Kerja Tambah Kurang", group: "Dokumen" },
];

const ITEMS_PER_PAGE = 10;

interface StoreDocument {
  id: string;
  _id?: string;
  kode_toko: string;
  nama_toko: string;
  cabang: string;
  luas_sales: number;
  luas_parkir: number;
  luas_gudang: number;
  luas_bangunan_lantai_1: number;
  luas_bangunan_lantai_2: number;
  luas_bangunan_lantai_3: number;
  total_luas_bangunan: number;
  luas_area_terbuka: number;
  tinggi_plafon: number;
  file_links: string;
  folder_drive?: string;
  status?: string;
  updated_at?: string;
}

interface TargetData {
  cabang: string;
  reguler: number;
  franchise: number;
  total: number;
}

interface FileEntry {
  category: string;
  name: string;
  url: string;
}

// ==========================================
// 2. MAIN COMPONENT
// ==========================================

export default function StoreAssetManagement() {
  const router = useRouter();
  
  // --- UI State ---
  const [view, setView] = useState<'list' | 'form'>('list');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' | 'info' } | null>(null);

  // --- Data State ---
  const [documents, setDocuments] = useState<StoreDocument[]>([]);
  const [targets, setTargets] = useState<TargetData[]>([]);
  const [userInfo, setUserInfo] = useState({ email: '', cabang: '', role: '' });

  // --- Filter State ---
  const [search, setSearch] = useState('');
  const [filterCabang, setFilterCabang] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // --- Form State ---
  const [isEditing, setIsEditing] = useState(false);
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    kodeToko: '',
    namaToko: '',
    luasSales: '',
    luasParkir: '',
    luasGudang: '',
    luasBangunanLantai1: '',
    luasBangunanLantai2: '',
    luasBangunanLantai3: '',
    totalLuasBangunan: '',
    luasAreaTerbuka: '',
    tinggiPlafon: '',
    folderDrive: ''
  });
  const [filesBuffer, setFilesBuffer] = useState<Record<string, File[]>>({});
  const [existingFiles, setExistingFiles] = useState<FileEntry[]>([]);
  const [deletedFiles, setDeletedFiles] = useState<FileEntry[]>([]);

  // ==========================================
  // INITIALIZATION
  // ==========================================

  useEffect(() => {
    const auth = sessionStorage.getItem("authenticated");
    const email = sessionStorage.getItem("loggedInUserEmail") || "";
    const cabang = sessionStorage.getItem("loggedInUserCabang") || "";
    const role = sessionStorage.getItem("userRole") || "";

    if (auth !== "true" || !email) {
      router.push('/auth');
      return;
    }

    setUserInfo({ email, cabang, role });
    fetchData(cabang);
  }, [router]);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchData = async (cabang: string) => {
    setIsLoading(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Filter mock documents by cabang if not head office
      let filteredDocs = MOCK_DOCUMENTS;
      if (cabang && cabang.toLowerCase() !== "head office") {
        filteredDocs = MOCK_DOCUMENTS.filter(d => d.cabang.toUpperCase() === cabang.toUpperCase());
      }
      setDocuments(filteredDocs);
      setTargets(MOCK_TARGETS);

    } catch (err) {
      console.error(err);
      showToast("Gagal memuat data", "error");
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // DASHBOARD CALCULATIONS
  // ==========================================

  const currentStats = useMemo(() => {
    const isHeadOffice = userInfo.cabang.toLowerCase() === "head office";
    const filteredTargets = isHeadOffice 
      ? targets 
      : targets.filter(t => t.cabang.toUpperCase() === userInfo.cabang.toUpperCase());
    
    const targetReguler = filteredTargets.reduce((sum, t) => sum + Number(t.reguler), 0);
    const targetFranchise = filteredTargets.reduce((sum, t) => sum + Number(t.franchise), 0);
    const targetTotal = targetReguler + targetFranchise;
    
    const inputCount = documents.length;
    const progressPercent = targetTotal > 0 ? (inputCount / targetTotal) * 100 : 0;

    return { targetReguler, targetFranchise, targetTotal, inputCount, progressPercent };
  }, [targets, documents, userInfo.cabang]);

  // ==========================================
  // FILTER & PAGINATION
  // ==========================================

  const filteredDocs = useMemo(() => {
    if (!Array.isArray(documents)) return [];
    
    return documents.filter(doc => {
      const matchSearch = (doc.nama_toko || "").toLowerCase().includes(search.toLowerCase()) || 
                          (doc.kode_toko || "").toLowerCase().includes(search.toLowerCase());
      const matchCabang = filterCabang === 'all' || doc.cabang === filterCabang;
      const matchStatus = filterStatus === 'all' || (filterStatus === 'complete' ? !!doc.file_links : !doc.file_links);
      return matchSearch && matchCabang && matchStatus;
    });
  }, [documents, search, filterCabang, filterStatus]);

  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDocs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDocs, currentPage]);

  const totalPages = Math.ceil(filteredDocs.length / ITEMS_PER_PAGE);

  // ==========================================
  // FORM HANDLERS
  // ==========================================

  const resetForm = () => {
    setFormData({
      kodeToko: '', namaToko: '', luasSales: '', luasParkir: '', 
      luasGudang: '', luasBangunanLantai1: '', luasBangunanLantai2: '', 
      luasBangunanLantai3: '', totalLuasBangunan: '', luasAreaTerbuka: '', 
      tinggiPlafon: '', folderDrive: ''
    });
    setFilesBuffer({});
    setExistingFiles([]);
    setDeletedFiles([]);
    setIsEditing(false);
    setCurrentEditId(null);
  };

  const handleEdit = (doc: StoreDocument) => {
    resetForm();
    setIsEditing(true);
    setCurrentEditId(doc._id || doc.id);
    setFormData({
      kodeToko: doc.kode_toko,
      namaToko: doc.nama_toko,
      luasSales: String(doc.luas_sales || ''),
      luasParkir: String(doc.luas_parkir || ''),
      luasGudang: String(doc.luas_gudang || ''),
      luasBangunanLantai1: String(doc.luas_bangunan_lantai_1 || ''),
      luasBangunanLantai2: String(doc.luas_bangunan_lantai_2 || ''),
      luasBangunanLantai3: String(doc.luas_bangunan_lantai_3 || ''),
      totalLuasBangunan: String(doc.total_luas_bangunan || ''),
      luasAreaTerbuka: String(doc.luas_area_terbuka || ''),
      tinggiPlafon: String(doc.tinggi_plafon || ''),
      folderDrive: doc.folder_drive || ''
    });

    // Parse file links
    if (doc.file_links) {
      const entries = doc.file_links.split(',').map(s => s.trim()).filter(Boolean);
      const parsed: FileEntry[] = entries.map(e => {
        const parts = e.split('|');
        if (parts.length === 3) return { category: parts[0], name: parts[1], url: parts[2] };
        return { category: 'pendukung', name: parts[0], url: parts[1] };
      });
      setExistingFiles(parsed);
    }

    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus data toko ini?")) return;
    setIsSyncing(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setDocuments(prev => prev.filter(d => (d._id || d.id) !== id));
      showToast("Data dihapus (Mock)");
    } catch (err) {
      showToast("Gagal menghapus", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileChange = (category: string, files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    setFilesBuffer(prev => {
      const existing = prev[category] || [];
      return { ...prev, [category]: [...existing, ...newFiles] };
    });
  };

  const removeNewFile = (category: string, index: number) => {
    setFilesBuffer(prev => {
      const existing = [...(prev[category] || [])];
      existing.splice(index, 1);
      return { ...prev, [category]: existing };
    });
  };

  const markExistingForDeletion = (file: FileEntry) => {
    if (!confirm(`Hapus file "${file.name}"?`)) return;
    setDeletedFiles(prev => [...prev, file]);
    setExistingFiles(prev => prev.filter(f => f.url !== file.url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      showToast("Data berhasil disimpan (Mock)", "success");
      setView('list');
      // In a real app, we would update the state with the new/edited document
      // For mock, let's just refresh the mock view
      fetchData(userInfo.cabang);
    } catch (err: any) {
      showToast(err.message || "Gagal menyimpan", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  // ==========================================
  // EXPORT LOGIC
  // ==========================================

  const exportCSV = () => {
    const headers = ["No", "Kode Toko", "Nama Toko", "Cabang", "Luas Sales", "Luas Parkir", "Folder Drive"];
    const rows = filteredDocs.map((doc, i) => [
      i + 1, doc.kode_toko, doc.nama_toko, doc.cabang, doc.luas_sales, doc.luas_parkir, doc.folder_drive || "-"
    ]);
    const csvContent = headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Export_Toko_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // ==========================================
  // RENDER LIST VIEW
  // ==========================================

  const renderList = () => (
    <div className="space-y-6">
      {/* Dashboard Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white shadow-sm border-slate-100">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Target Reguler</div>
            <div className="text-3xl font-bold text-slate-900 mt-1">{currentStats.targetReguler}</div>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border-slate-100">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Target Franchise</div>
            <div className="text-3xl font-bold text-slate-900 mt-1">{currentStats.targetFranchise}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-600 text-white shadow-md border-none">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-red-100 uppercase tracking-wider">Target Total</div>
            <div className="text-3xl font-extrabold mt-1">{currentStats.targetTotal}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-100">
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between items-end">
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Progress Input</div>
              <div className="text-xs font-bold text-red-600">{currentStats.inputCount} / {currentStats.targetTotal} ({Math.round(currentStats.progressPercent)}%)</div>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-red-600 transition-all" style={{ width: `${currentStats.progressPercent}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-1 gap-4 w-full">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Cari kode atau nama toko..." 
                className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {userInfo.cabang.toLowerCase() === "head office" && (
              <Select value={filterCabang} onValueChange={setFilterCabang}>
                <SelectTrigger className="w-50 h-10 rounded-xl">
                  <SelectValue placeholder="Semua Cabang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Cabang</SelectItem>
                  {Array.from(new Set(documents.map(d => d.cabang))).map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-50 h-10 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="complete">Sudah Lengkap</SelectItem>
                <SelectItem value="incomplete">Belum Lengkap</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" className="rounded-xl border-slate-200 hover:bg-slate-50" onClick={exportCSV}>
              <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" /> Export CSV
            </Button>
            {userInfo.cabang.toLowerCase() !== "head office" && (
              <Button className="bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-200" onClick={() => { resetForm(); setView('form'); }}>
                <Plus className="w-4 h-4 mr-2" /> Tambah Data
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm overflow-hidden border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">No</th>
                <th className="px-6 py-4">Kode Toko</th>
                <th className="px-6 py-4">Nama Toko</th>
                <th className="px-6 py-4">Cabang</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Waktu Update</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedDocs.length > 0 ? paginatedDocs.map((doc, i) => (
                <tr key={doc._id || doc.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-slate-500">{(currentPage - 1) * ITEMS_PER_PAGE + i + 1}</td>
                  <td className="px-6 py-4 font-bold text-slate-900 tracking-tight">{doc.kode_toko}</td>
                  <td className="px-6 py-4 font-medium text-slate-700">{doc.nama_toko}</td>
                  <td className="px-6 py-4 text-slate-600">{doc.cabang}</td>
                  <td className="px-6 py-4">
                    {doc.file_links ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Sudah Lengkap</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-slate-200">Belum Lengkap</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {doc.updated_at ? new Date(doc.updated_at).toLocaleString('id-ID') : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon-sm" className="hover:bg-blue-50 hover:text-blue-600" onClick={() => handleEdit(doc)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      {userInfo.cabang.toLowerCase() !== "head office" && (
                        <Button variant="ghost" size="icon-sm" className="hover:bg-red-50 hover:text-red-600" onClick={() => handleDelete(doc._id || doc.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">Tidak ada data ditemukan</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">Halaman {currentPage} dari {totalPages}</div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 rounded-lg"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 rounded-lg"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  // ==========================================
  // RENDER FORM VIEW
  // ==========================================

  const renderForm = () => {
    const isReadOnly = userInfo.role.toUpperCase() === "BRANCH MANAGER" || userInfo.cabang.toLowerCase() === "head office";
    
    return (
      <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200" onClick={() => setView('list')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{isEditing ? `Edit Data: ${formData.namaToko}` : "Tambah Data Toko Baru"}</h2>
            <p className="text-xs text-slate-500">Lengkapi spesifikasi teknis dan lampiran dokumen.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Basic Info & Dimensions */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400" /> Spesifikasi Bangunan
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-600">Kode Toko</Label>
                  <Input 
                    value={formData.kodeToko} 
                    onChange={e => setFormData(p => ({ ...p, kodeToko: e.target.value.toUpperCase() }))}
                    className="h-10 font-bold tracking-widest uppercase"
                    disabled={isEditing || isReadOnly}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-bold text-slate-600">Nama Toko</Label>
                  <Input 
                    value={formData.namaToko} 
                    onChange={e => setFormData(p => ({ ...p, namaToko: e.target.value.toUpperCase() }))}
                    className="h-10 font-bold uppercase"
                    disabled={isEditing || isReadOnly}
                    required
                  />
                </div>

                <Separator className="md:col-span-3 my-2" />

                {[
                  { key: 'luasSales', label: 'Luas Sales (m²)' },
                  { key: 'luasParkir', label: 'Luas Parkir (m²)' },
                  { key: 'luasGudang', label: 'Luas Gudang (m²)' },
                  { key: 'luasBangunanLantai1', label: 'Lantai 1 (m²)' },
                  { key: 'luasBangunanLantai2', label: 'Lantai 2 (m²)' },
                  { key: 'luasBangunanLantai3', label: 'Lantai 3 (m²)' },
                  { key: 'totalLuasBangunan', label: 'Total Luas (m²)' },
                  { key: 'luasAreaTerbuka', label: 'Area Terbuka (m²)' },
                  { key: 'tinggiPlafon', label: 'Tinggi Plafon (m)' },
                ].map(item => (
                  <div key={item.key} className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500">{item.label}</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="0.00"
                      value={formData[item.key as keyof typeof formData]} 
                      onChange={e => setFormData(p => ({ ...p, [item.key]: e.target.value }))}
                      className="h-10 bg-slate-50/50"
                      disabled={isReadOnly}
                    />
                  </div>
                ))}

                <div className="space-y-2 md:col-span-3">
                  <Label className="text-xs font-bold text-slate-500">Link Folder Google Drive</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={formData.folderDrive} 
                      onChange={e => setFormData(p => ({ ...p, folderDrive: e.target.value }))}
                      placeholder="https://drive.google.com/..."
                      className="h-10 text-blue-600 bg-blue-50/20 border-blue-100"
                      disabled={isReadOnly}
                    />
                    {formData.folderDrive && (
                      <Button variant="outline" size="icon" asChild className="shrink-0 h-10 w-10">
                        <a href={formData.folderDrive} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: File Uploads */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-red-600" /> Lampiran Dokumen
            </h3>

            {['Foto', 'Gambar', 'Dokumen'].map(groupName => (
              <div key={groupName} className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px bg-slate-200 flex-1"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{groupName}</span>
                  <div className="h-px bg-slate-200 flex-1"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {UPLOAD_CATEGORIES.filter(c => c.group === groupName).map(cat => (
                    <Card key={cat.key} className="shadow-sm border-slate-100 hover:border-slate-300 transition-colors overflow-hidden">
                      <div className="p-3 bg-slate-50/50 border-b flex justify-between items-center">
                        <span className="text-[11px] font-bold text-slate-700 truncate mr-2">{cat.label}</span>
                        {!isReadOnly && (
                          <label className="cursor-pointer hover:text-red-600 transition-colors">
                            <PlusCircle className="w-4 h-4" />
                            <input 
                              type="file" 
                              multiple 
                              className="hidden" 
                              onChange={e => handleFileChange(cat.key, e.target.files)} 
                            />
                          </label>
                        )}
                      </div>
                      <CardContent className="p-3 space-y-2 min-h-15">
                        {/* Existing Files */}
                        {existingFiles.filter(f => f.category === cat.key).map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 p-1.5 bg-white border border-slate-100 rounded-lg text-xs group/file">
                            <a href={file.url} target="_blank" className="flex items-center gap-2 truncate flex-1 text-blue-600 hover:underline">
                              {file.url.match(/\.(jpg|jpeg|png)$/i) ? <ImageIcon className="w-3 h-3 shrink-0" /> : <File className="w-3 h-3 shrink-0" />}
                              <span className="truncate">{file.name}</span>
                            </a>
                            {!isReadOnly && (
                              <button type="button" onClick={() => markExistingForDeletion(file)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover/file:opacity-100 transition-opacity">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}

                        {/* New Files */}
                        {(filesBuffer[cat.key] || []).map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 p-1.5 bg-red-50 border border-red-100 rounded-lg text-xs">
                            <div className="flex items-center gap-2 truncate flex-1 text-red-700 italic">
                              <Plus className="w-3 h-3 shrink-0" />
                              <span className="truncate font-medium">{file.name}</span>
                            </div>
                            <button type="button" onClick={() => removeNewFile(cat.key, idx)} className="text-red-300 hover:text-red-600">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}

                        {existingFiles.filter(f => f.category === cat.key).length === 0 && (!filesBuffer[cat.key] || filesBuffer[cat.key].length === 0) && (
                          <div className="text-[10px] text-slate-400 italic text-center py-2">Belum ada file</div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-4 pt-8 pb-12">
            <Button variant="outline" type="button" size="lg" className="rounded-xl px-8" onClick={() => setView('list')}>Batal</Button>
            {!isReadOnly && (
              <Button disabled={isSyncing} className="bg-red-600 hover:bg-red-700 rounded-xl px-12 shadow-lg shadow-red-200 h-11" type="submit">
                {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Simpan Perubahan
              </Button>
            )}
          </div>
        </form>
      </div>
    );
  };

  // ==========================================
  // FINAL RENDER
  // ==========================================

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <AppNavbar title="Penyimpanan Dokumen Toko" showBackButton={true} backHref="/dashboard" />
      
      <main className="flex-1 container max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {isLoading ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
            <div className="text-slate-500 font-medium tracking-tight animate-pulse">Memuat database dokumen...</div>
          </div>
        ) : (
          view === 'list' ? renderList() : renderForm()
        )}
      </main>

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-200 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-bold tracking-tight">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
