"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import {
  Search, ExternalLink, PlusCircle, X, File,
  CheckCircle, AlertCircle, AlertTriangle, Loader2, ArrowLeft, FolderOpen,
  Trash2, Upload, ChevronLeft, ChevronRight, Eye, FolderArchive,
  FileText, RefreshCw, Edit, Save, MoreVertical
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import AppNavbar from '@/components/AppNavbar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  fetchTokoList,
  fetchPenyimpananDokumenList,
  fetchPenyimpananDokumenArchiveStores,
  createPenyimpananDokumenArchiveStore,
  uploadPenyimpananDokumen,
  updatePenyimpananDokumen,
  deletePenyimpananDokumen,
  PenyimpananDokumenItem,
  RABDetailToko,
} from '@/lib/api';
import { BRANCH_GROUPS, BRANCH_TO_ULOK, canViewAllBranches, isViewOnlyUser } from '@/lib/constants';

// ==========================================
// CONSTANTS
// ==========================================

const DOCUMENT_CATEGORIES = [
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

const getDocumentCategoryKey = (doc: PenyimpananDokumenItem) => doc.kategori_dokumen || doc.nama_dokumen;
const isArchiveToko = (toko?: RABDetailToko | null) => Boolean(toko && toko.id < 0);
const toArchiveToko = (
  store: { kode_toko: string | null; nama_toko: string | null; cabang: string | null; jumlah_dokumen: number },
  index: number
): RABDetailToko => ({
  id: -1 * (index + 1),
  nomor_ulok: store.kode_toko || store.nama_toko || `ARSIP-${index + 1}`,
  kode_toko: store.kode_toko || "",
  nama_toko: store.nama_toko || store.kode_toko || "Dokumen Toko",
  cabang: store.cabang || "-",
  proyek: "Penyimpanan Dokumen",
  lingkup_pekerjaan: "",
  alamat: "",
  nama_kontraktor: "",
});

/** Resolve cabang list user boleh lihat (termasuk sub-branch) */
function getVisibleBranches(cabang: string, canSeeAllBranches = false): string[] | null {
  if (canSeeAllBranches) return null;
  const upper = cabang.toUpperCase();
  for (const [, subs] of Object.entries(BRANCH_GROUPS)) {
    if (subs.map(s => s.toUpperCase()).includes(upper)) return subs.map(s => s.toUpperCase());
  }
  return [upper];
}

function getBranchLocationName(cabang?: string | null): string {
  const upper = String(cabang ?? "").trim().toUpperCase();
  if (!upper) return "-";
  const code = BRANCH_TO_ULOK[upper];
  if (!code) return upper;

  const primary = Object.entries(BRANCH_TO_ULOK).find(([, value]) => value === code)?.[0];
  return primary ?? upper;
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function PenyimpananDokumenPage() {
  const router = useRouter();

  // Auth
  const [userInfo, setUserInfo] = useState({ email: '', cabang: '', role: '' });

  // UI
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Data
  const [tokoList, setTokoList] = useState<RABDetailToko[]>([]);
  const [archiveTokoList, setArchiveTokoList] = useState<RABDetailToko[]>([]);
  const [documents, setDocuments] = useState<PenyimpananDokumenItem[]>([]);
  const [selectedToko, setSelectedToko] = useState<RABDetailToko | null>(null);

  // Filters
  const [searchToko, setSearchToko] = useState('');
  const [filterCabang, setFilterCabang] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Edit/Update Modal State
  const [editingDoc, setEditingDoc] = useState<PenyimpananDokumenItem | null>(null);
  const [newDocName, setNewDocName] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Upload state (per-category inline)
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);

  // Manual toko/catalog input
  const [isCreateStoreOpen, setIsCreateStoreOpen] = useState(false);
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [newStoreForm, setNewStoreForm] = useState({ kode_toko: '', nama_toko: '', cabang: '' });

  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<PenyimpananDokumenItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useSession();

  // ==========================================
  // ACCESS CONTROL
  // ==========================================

  const isReadOnly = useMemo(() => {
    return isViewOnlyUser(userInfo.role, user?.isSuperHuman ?? false);
  }, [userInfo.role, user?.isSuperHuman]);

  // ==========================================
  // INIT
  // ==========================================

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    if (!user) return;
    const { email, cabang, role } = user;
    setUserInfo({ email, cabang, role });
    loadTokoList(cabang, canViewAllBranches(user.roles, user.isSuperHuman ?? false));
  }, [user]);

  const loadTokoList = async (cabang: string, canSeeAllBranches = false) => {
    setIsLoading(true);
    try {
      const res = await fetchTokoList();
      const visible = getVisibleBranches(cabang, canSeeAllBranches);
      const filtered = visible
        ? res.data.filter(t => visible.includes((t.cabang || '').toUpperCase()))
        : res.data;
      setTokoList(filtered);
      setIsLoading(false);

      try {
        const archiveRes = await fetchPenyimpananDokumenArchiveStores("");
        const archiveStores = (archiveRes.data || [])
          .filter(store => store.kode_toko || store.nama_toko)
          .filter(store => !visible || visible.includes((store.cabang || '').toUpperCase()))
          .map(toArchiveToko);
        setArchiveTokoList(archiveStores);
      } catch (archiveErr) {
        console.error(archiveErr);
        showToast("Data toko tampil, tapi sebagian dokumen belum bisa dimuat", "info");
      }
    } catch (err: any) {
      console.error(err);
      showToast("Gagal memuat data toko", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDocuments = useCallback(async (toko: RABDetailToko) => {
    setIsLoadingDocs(true);
    try {
      const res = await fetchPenyimpananDokumenList({
        ...(isArchiveToko(toko) ? {} : { id_toko: toko.id }),
        kode_toko: toko.kode_toko || toko.nomor_ulok,
        nama_toko: toko.nama_toko,
        cabang: toko.cabang,
      });
      setDocuments(res.data || []);
    } catch (err: any) {
      console.error(err);
      showToast("Gagal memuat dokumen", "error");
      setDocuments([]);
    } finally {
      setIsLoadingDocs(false);
    }
  }, [showToast]);

  const openDetail = (toko: RABDetailToko) => {
    setSelectedToko(toko);
    setView('detail');
    loadDocuments(toko);
  };

  const backToList = () => {
    setView('list');
    setSelectedToko(null);
    setDocuments([]);
  };

  // ==========================================
  // CUD HANDLERS
  // ==========================================

  const handleFileUpload = async (categoryKey: string, files: FileList | null) => {
    if (isReadOnly) {
      showToast("Anda tidak memiliki akses untuk menambah dokumen", "error");
      return;
    }
    if (!files || files.length === 0 || !selectedToko) return;
    setUploadingCategory(categoryKey);
    setIsSyncing(true);
    try {
      const folderIdentity = selectedToko.kode_toko || selectedToko.nomor_ulok || String(selectedToko.id);
      await uploadPenyimpananDokumen(
        {
          ...(isArchiveToko(selectedToko) ? {} : { id_toko: selectedToko.id }),
          kode_toko: selectedToko.kode_toko || selectedToko.nomor_ulok,
          nama_toko: selectedToko.nama_toko,
          cabang: selectedToko.cabang,
          nama_dokumen: categoryKey,
          folder_name: `${selectedToko.nama_toko}_${selectedToko.cabang}_${folderIdentity}`.replace(/[^a-zA-Z0-9_]/g, '_'),
        },
        Array.from(files)
      );
      showToast(`${files.length} file berhasil diupload`, "success");
      loadDocuments(selectedToko);
    } catch (err: any) {
      showToast(err.message || "Gagal upload", "error");
    } finally {
      setIsSyncing(false);
      setUploadingCategory(null);
    }
  };

  const handleCreateStore = async () => {
    if (isReadOnly) {
      showToast("Anda tidak memiliki akses untuk menambah data", "error");
      return;
    }

    const payload = {
      kode_toko: newStoreForm.kode_toko.trim(),
      nama_toko: newStoreForm.nama_toko.trim(),
      cabang: newStoreForm.cabang.trim().toUpperCase(),
    };

    if (!payload.kode_toko || !payload.nama_toko || !payload.cabang) {
      showToast("Kode toko, nama toko, dan cabang wajib diisi", "error");
      return;
    }

    setIsCreatingStore(true);
    try {
      await createPenyimpananDokumenArchiveStore(payload);
      showToast("Data toko berhasil disimpan", "success");
      setIsCreateStoreOpen(false);
      setNewStoreForm({ kode_toko: '', nama_toko: '', cabang: '' });
      await loadTokoList(userInfo.cabang, canViewAllBranches(user?.roles ?? [], user?.isSuperHuman ?? false));
    } catch (err: any) {
      showToast(err.message || "Gagal menyimpan data toko", "error");
    } finally {
      setIsCreatingStore(false);
    }
  };

  const handleUpdateDoc = async () => {
    if (isReadOnly) {
      showToast("Anda tidak memiliki akses untuk mengubah dokumen", "error");
      return;
    }
    if (!editingDoc || !selectedToko) return;
    setIsUpdating(true);
    try {
      await updatePenyimpananDokumen(editingDoc.id, { nama_dokumen: newDocName }, newFile);
      showToast("Dokumen berhasil diperbarui", "success");
      setEditingDoc(null);
      setNewFile(null);
      loadDocuments(selectedToko);
    } catch (err: any) {
      showToast(err.message || "Gagal memperbarui dokumen", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteDoc = async (doc: PenyimpananDokumenItem) => {
    if (isReadOnly) {
      showToast("Anda tidak memiliki akses untuk menghapus dokumen", "error");
      return;
    }
    setDeleteModal(doc);
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setIsDeleting(true);
    try {
      await deletePenyimpananDokumen(deleteModal.id);
      showToast("Dokumen berhasil dihapus", "success");
      setDeleteModal(null);
      if (selectedToko) loadDocuments(selectedToko);
    } catch (err: any) {
      showToast(err.message || "Gagal menghapus", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // ==========================================
  // FILTERED DATA
  // ==========================================

  const cabangOptions = useMemo(() => {
    return Array.from(new Set([...archiveTokoList, ...tokoList].map(t => getBranchLocationName(t.cabang)))).sort();
  }, [archiveTokoList, tokoList]);

  const filteredToko = useMemo(() => {
    const combined = [...archiveTokoList, ...tokoList];
    return combined.filter(t => {
      const q = searchToko.toLowerCase();
      const matchSearch = !q || (t.nama_toko || '').toLowerCase().includes(q)
        || (t.nomor_ulok || '').toLowerCase().includes(q)
        || (t.kode_toko || '').toLowerCase().includes(q);
      const matchCabang = filterCabang === 'all' || getBranchLocationName(t.cabang) === filterCabang;
      return matchSearch && matchCabang;
    });
  }, [archiveTokoList, tokoList, searchToko, filterCabang]);

  const totalArchiveToko = archiveTokoList.length;
  const totalCombinedToko = tokoList.length + totalArchiveToko;

  const totalPages = Math.ceil(filteredToko.length / ITEMS_PER_PAGE);
  const paginatedToko = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredToko.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredToko, currentPage]);

  // group documents by category
  const docsByCategory = useMemo(() => {
    const map: Record<string, PenyimpananDokumenItem[]> = {};
    DOCUMENT_CATEGORIES.forEach(c => { map[c.key] = []; });
    documents.forEach(d => {
      const categoryKey = getDocumentCategoryKey(d);
      if (map[categoryKey]) map[categoryKey].push(d);
      else {
        // dokumen yang kategori-nya tidak cocok, masuk "pendukung"
        map["pendukung"] = map["pendukung"] || [];
        map["pendukung"].push(d);
      }
    });
    return map;
  }, [documents]);

  const folderLink = useMemo(() => {
    const withFolder = documents.find(d => d.link_folder);
    return withFolder?.link_folder || null;
  }, [documents]);

  // ==========================================
  // RENDER: TOKO LIST VIEW
  // ==========================================

  const renderList = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white shadow-sm border-slate-100">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Toko</div>
            <div className="text-3xl font-bold text-slate-900 mt-1">{totalCombinedToko}</div>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border-slate-100">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Hasil Filter</div>
            <div className="text-3xl font-bold text-slate-900 mt-1">{filteredToko.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-600 text-white shadow-md border-none">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-red-100 uppercase tracking-wider">Cabang</div>
            <div className="text-3xl font-extrabold mt-1">{cabangOptions.length}</div>
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
                placeholder="Cari ULOK, nama, atau kode toko..."
                className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all"
                value={searchToko}
                onChange={e => { setSearchToko(e.target.value); setCurrentPage(1); }}
              />
            </div>
            {cabangOptions.length > 1 && (
              <Select value={filterCabang} onValueChange={v => { setFilterCabang(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-50 h-10 rounded-xl">
                  <SelectValue placeholder="Semua Cabang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Cabang</SelectItem>
                  {cabangOptions.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {!isReadOnly && (
            <Button className="rounded-xl bg-red-600 hover:bg-red-700 text-white gap-2" onClick={() => setIsCreateStoreOpen(true)}>
              <PlusCircle className="w-4 h-4" /> Tambah Data
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm overflow-hidden border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">No</th>
                <th className="px-6 py-4">ULOK</th>
                <th className="px-6 py-4">Kode Toko</th>
                <th className="px-6 py-4">Nama Toko</th>
                <th className="px-6 py-4">Cabang</th>
                <th className="px-6 py-4">Proyek</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedToko.length > 0 ? paginatedToko.map((toko, i) => (
                <tr key={toko.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-slate-500">{(currentPage - 1) * ITEMS_PER_PAGE + i + 1}</td>
                  <td className="px-6 py-4 font-bold text-slate-900 tracking-tight">{toko.nomor_ulok}</td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{toko.kode_toko || '-'}</td>
                  <td className="px-6 py-4 font-medium text-slate-700">{toko.nama_toko}</td>
                  <td className="px-6 py-4 text-slate-600">{toko.cabang}</td>
                  <td className="px-6 py-4">
                    <Badge className="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100">{toko.proyek || '-'}</Badge>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-xs gap-1.5 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                      onClick={() => openDetail(toko)}
                    >
                      <FolderOpen className="w-3.5 h-3.5" /> Kelola Dokumen
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">Tidak ada toko ditemukan</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">Halaman {currentPage} dari {totalPages}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 rounded-lg" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <Button variant="outline" size="sm" className="h-8 rounded-lg" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  // ==========================================
  // RENDER: DETAIL / DOCUMENT MANAGER VIEW
  // ==========================================

  const renderDetail = () => {
    if (!selectedToko) return null;
    const canManageDocs = !isReadOnly;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200 mt-1" onClick={backToList}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">{selectedToko.nama_toko}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge className="bg-red-100 text-red-700 border-red-200">{selectedToko.nomor_ulok}</Badge>
              <Badge variant="secondary">{selectedToko.cabang}</Badge>
              {selectedToko.proyek && <Badge variant="secondary">{selectedToko.proyek}</Badge>}
            </div>
          </div>
          <div className="flex gap-2 items-center shrink-0">
            {folderLink && (
              <Button variant="outline" size="sm" className="rounded-lg gap-1.5" asChild>
                <a href={folderLink} target="_blank" rel="noopener noreferrer">
                  <FolderArchive className="w-3.5 h-3.5 text-blue-600" /> Folder Drive
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" className="rounded-lg gap-1.5" onClick={() => loadDocuments(selectedToko)} disabled={isLoadingDocs}>
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDocs ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-white shadow-sm border-slate-100">
            <CardContent className="py-4 px-5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Dokumen</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-0.5">{documents.length}</div>
            </CardContent>
          </Card>
          {['Foto', 'Gambar', 'Dokumen'].map(g => {
            const cats = DOCUMENT_CATEGORIES.filter(c => c.group === g).map(c => c.key);
            const count = documents.filter(d => cats.includes(getDocumentCategoryKey(d))).length;
            return (
              <Card key={g} className="bg-white shadow-sm border-slate-100">
                <CardContent className="py-4 px-5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{g}</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-0.5">{count}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {isLoadingDocs ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
            <span className="text-slate-500 font-medium">Memuat dokumen...</span>
          </div>
        ) : (
          /* Category Groups */
          <div className="space-y-6">
            {['Foto', 'Gambar', 'Dokumen'].map(groupName => (
              <div key={groupName} className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{groupName}</span>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {DOCUMENT_CATEGORIES.filter(c => c.group === groupName).map(cat => {
                    const catDocs = docsByCategory[cat.key] || [];
                    const isCatUploading = isSyncing && uploadingCategory === cat.key;
                    return (
                      <Card key={cat.key} className="shadow-sm border-slate-100 hover:border-slate-300 transition-colors overflow-hidden">
                        <div className="p-3 bg-slate-50/50 border-b flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-700 truncate">{cat.label}</span>
                            {catDocs.length > 0 && (
                              <Badge className="bg-red-100 text-red-600 border-red-200 text-[10px] h-5 px-1.5">{catDocs.length}</Badge>
                            )}
                          </div>
                          {canManageDocs && (
                            <label className={`cursor-pointer transition-colors ${isCatUploading ? 'text-slate-300' : 'hover:text-red-600'}`}>
                              {isCatUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                              <input
                                type="file"
                                multiple
                                className="hidden"
                                disabled={isCatUploading}
                                onChange={e => { handleFileUpload(cat.key, e.target.files); e.target.value = ''; }}
                              />
                            </label>
                          )}
                        </div>
                        <CardContent className="p-3 space-y-2 min-h-15">
                          {catDocs.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between gap-2 p-1.5 bg-white border border-slate-100 rounded-lg text-xs group/file hover:border-slate-200 transition-colors">
                              <a
                                href={doc.link_dokumen || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 truncate flex-1 text-blue-600 hover:underline"
                              >
                                <File className="w-3 h-3 shrink-0" />
                                <span className="truncate">{doc.drive_file_id ? doc.nama_dokumen : doc.nama_dokumen}</span>
                                <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover/file:opacity-100" />
                              </a>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] text-slate-400">{new Date(doc.created_at).toLocaleDateString('id-ID')}</span>
                                {canManageDocs && (
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover/file:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => { setEditingDoc(doc); setNewDocName(doc.nama_dokumen); }}
                                      className="p-1 text-slate-300 hover:text-blue-500"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDoc(doc)}
                                      className="p-1 text-slate-300 hover:text-red-500"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                          {catDocs.length === 0 && (
                            <div className="text-[10px] text-slate-400 italic text-center py-3">Belum ada file</div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Update Dialog */}
        <Dialog open={!!editingDoc} onOpenChange={v => !v && setEditingDoc(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Update Dokumen</DialogTitle>
              <DialogDescription>Ubah nama atau ganti file dokumen ini.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nama Dokumen</Label>
                <Input
                  value={newDocName}
                  onChange={e => setNewDocName(e.target.value)}
                  placeholder="Contoh: rab_final"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Ganti File (Optional)</Label>
                <Input
                  type="file"
                  onChange={e => setNewFile(e.target.files?.[0] || null)}
                  className="rounded-xl"
                />
                <p className="text-[10px] text-slate-400 italic">Biarkan kosong jika hanya ingin mengubah nama.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingDoc(null)} disabled={isUpdating} className="rounded-xl">Batal</Button>
              <Button onClick={handleUpdateDoc} disabled={isUpdating} className="bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-100">
                {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
            <div className="text-slate-500 font-medium tracking-tight animate-pulse">Memuat data toko...</div>
          </div>
        ) : (
          view === 'list' ? renderList() : renderDetail()
        )}
      </main>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden border-0">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Konfirmasi Hapus</h3>
              <p className="text-sm text-slate-500 mb-6">
                Apakah Anda yakin ingin menghapus dokumen <br />
                <strong className="text-slate-800">{deleteModal.nama_dokumen}</strong>?
              </p>
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={() => setDeleteModal(null)} className="flex-1 rounded-xl font-semibold border-slate-200">
                  Batal
                </Button>
                <Button onClick={confirmDelete} disabled={isDeleting} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-sm">
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hapus Dokumen'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Dialog open={isCreateStoreOpen} onOpenChange={setIsCreateStoreOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Data Toko</DialogTitle>
            <DialogDescription>Data ini akan masuk ke daftar penyimpanan dokumen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kode Toko</Label>
              <Input
                value={newStoreForm.kode_toko}
                onChange={e => setNewStoreForm(prev => ({ ...prev, kode_toko: e.target.value }))}
                placeholder="Contoh: JB34"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Nama Toko</Label>
              <Input
                value={newStoreForm.nama_toko}
                onChange={e => setNewStoreForm(prev => ({ ...prev, nama_toko: e.target.value }))}
                placeholder="Contoh: KRAN KEMAYORAN"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Cabang</Label>
              <Input
                value={newStoreForm.cabang}
                onChange={e => setNewStoreForm(prev => ({ ...prev, cabang: e.target.value }))}
                placeholder="Contoh: CILEUNGSI"
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateStoreOpen(false)} disabled={isCreatingStore} className="rounded-xl">Batal</Button>
            <Button onClick={handleCreateStore} disabled={isCreatingStore} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">
              {isCreatingStore ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TOAST */}
      {toast && (
        <div className={`fixed top-4 right-4 z-9999 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top-5 ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
          toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
          <p className="text-sm font-semibold">{toast.msg}</p>
        </div>
      )}
    </div>
  );
}
