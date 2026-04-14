"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Save, Loader2, Search, FilePlus, AlertCircle, CheckCircle, XCircle, AlertTriangle,
    CalendarPlus, CalendarClock, Clock, FileText, Link2, Info,
    ChevronDown, Calendar, Hash, ArrowRight, UploadCloud, X, Image as ImageIcon, FileDown
} from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';
import {
    fetchSPKList,
    fetchPertambahanSPKList,
    submitPertambahanSPK,
    type SPKListItem,
    type PertambahanSPKListItem,
    updatePertambahanSPK,
    downloadPertambahanSPKLampiran,
} from '@/lib/api';
import { BRANCH_GROUPS } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format tanggal ISO → "dd MMMM yyyy" dalam bahasa Indonesia */
const formatTanggal = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Format tanggal ISO → "yyyy-MM-dd" untuk input date */
const toDateInputValue = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/** Tambah N hari ke tanggal ISO, return "yyyy-MM-dd" */
const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TambahSPKPage() {
    const router = useRouter();

    // ── Auth & User ──────────────────────────────────────────────────────
    const [userInfo, setUserInfo] = useState({ name: '', role: '', cabang: '', email: '' });

    // ── Loading & Submitting ─────────────────────────────────────────────
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── Success modal ────────────────────────────────────────────────────
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // ── Data from API ────────────────────────────────────────────────────
    const [approvedSpks, setApprovedSpks] = useState<SPKListItem[]>([]);
    const [existingPerpanjangan, setExistingPerpanjangan] = useState<PertambahanSPKListItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // ── Selected SPK ─────────────────────────────────────────────────────
    const [selectedSpk, setSelectedSpk] = useState<SPKListItem | null>(null);

    // ── Form fields ──────────────────────────────────────────────────────
    const [pertambahanHari, setPertambahanHari] = useState('');
    const [alasanPerpanjangan, setAlasanPerpanjangan] = useState('');
    const [fileLampiran, setFileLampiran] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // ── Status info ──────────────────────────────────────────────────────
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' as '' | 'info' | 'success' | 'warning' | 'error' });

    // ── Revision States ──────────────────────────────────────────────────
    const [originalRejectedForm, setOriginalRejectedForm] = useState<{
        pertambahan_hari: string;
        alasan_perpanjangan: string;
    } | null>(null);

    const [rejectedModal, setRejectedModal] = useState<{
        isOpen: boolean;
        alasanPenolakan: string;
    }>({ isOpen: false, alasanPenolakan: '' });

    const isRevisiUnchanged = useMemo(() => {
        if (!originalRejectedForm) return false;
        if (fileLampiran) return false;
        return originalRejectedForm.pertambahan_hari === pertambahanHari &&
               originalRejectedForm.alasan_perpanjangan === alasanPerpanjangan;
    }, [originalRejectedForm, pertambahanHari, alasanPerpanjangan, fileLampiran]);

    // ════════════════════════════════════════════════════════════════════
    //   DERIVED VALUES
    // ════════════════════════════════════════════════════════════════════

    /** Tanggal SPK akhir (waktu_selesai dari SPK terpilih) */
    const tanggalSpkAkhir = useMemo(() => {
        if (!selectedSpk) return '';
        return toDateInputValue(selectedSpk.waktu_selesai);
    }, [selectedSpk]);

    /** Tanggal akhir setelah perpanjangan (auto-hitung) */
    const tanggalSetelahPerpanjangan = useMemo(() => {
        if (!tanggalSpkAkhir || !pertambahanHari || parseInt(pertambahanHari) <= 0) return '';
        return addDays(tanggalSpkAkhir, parseInt(pertambahanHari));
    }, [tanggalSpkAkhir, pertambahanHari]);

    /** Filter SPK berdasarkan search */
    const filteredSpks = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return approvedSpks.filter(s =>
            (s.nomor_ulok || '').toLowerCase().includes(q) ||
            (s.nomor_spk || '').toLowerCase().includes(q) ||
            (s.lingkup_pekerjaan || '').toLowerCase().includes(q) ||
            (s.toko?.kode_toko || s.kode_toko || '').toLowerCase().includes(q) ||
            (s.toko?.nama_toko || '').toLowerCase().includes(q)
        );
    }, [approvedSpks, searchQuery]);
    

    // ════════════════════════════════════════════════════════════════════
    //   EFFECTS
    // ════════════════════════════════════════════════════════════════════

    useEffect(() => {
        const isAuth = sessionStorage.getItem("authenticated");
        const role = sessionStorage.getItem("userRole");
        const email = sessionStorage.getItem("loggedInUserEmail") || '';
        const cabang = sessionStorage.getItem("loggedInUserCabang") || '';

        if (isAuth !== "true" || !role) { router.push('/auth'); return; }

        const allowedRoles = [
            'BRANCH BUILDING & MAINTENANCE MANAGER',
            'BRANCH BUILDING SUPPORT DOKUMENTASI',
        ];
        if (!allowedRoles.includes(role.toUpperCase())) {
            alert("Anda tidak memiliki akses ke halaman ini.");
            router.push('/dashboard');
            return;
        }

        const name = email.split('@')[0].toUpperCase();
        setUserInfo({ name, role, cabang, email });

        loadApprovedSpks(cabang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    // ════════════════════════════════════════════════════════════════════
    //   DATA LOADING
    // ════════════════════════════════════════════════════════════════════

    // ════════════════════════════════════════════════════════════════════
    //   HANDLERS
    // ════════════════════════════════════════════════════════════════════

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setFileLampiran(file);

        // Cleanup old preview
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }

        if (file) {
            if (file.type.startsWith('image/')) {
                const url = URL.createObjectURL(file);
                setPreviewUrl(url);
            }
        }
    };

    const handleRemoveFile = () => {
        setFileLampiran(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    };

    const loadApprovedSpks = async (cabang: string) => {
        setIsLoading(true);
        try {
            const res = await fetchSPKList({ status: 'SPK_APPROVED' });
            const allSpks = res.data || [];

            // Get matching branches from branch groups
            const branchGroup = Object.values(BRANCH_GROUPS).find(group =>
                group.some(b => b.toUpperCase() === cabang.toUpperCase())
            );
            const matchBranches = branchGroup
                ? branchGroup.map(b => b.toUpperCase())
                : [cabang.toUpperCase()];

            // Filter by nomor_ulok containing branch code
            // Since SPK doesn't have cabang field directly, we match by brute force
            // Actually SPK data comes from RAB which has cabang, but SPKListItem doesn't have it.
            // We'll show all approved SPKs and let the user filter. The backend should handle it.
            // For now, show all approved SPKs (the user's access is already limited by role).
            setApprovedSpks(allSpks);
        } catch (error: any) {
            setStatusMsg({ text: "Gagal memuat data SPK: " + error.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // ════════════════════════════════════════════════════════════════════
    //   HANDLERS
    // ════════════════════════════════════════════════════════════════════

    const handleSpkSelect = async (spkId: string) => {
        setStatusMsg({ text: '', type: '' });
        setPertambahanHari('');
        setAlasanPerpanjangan('');
        handleRemoveFile();
        setExistingPerpanjangan([]);
        setOriginalRejectedForm(null);

        if (!spkId) {
            setSelectedSpk(null);
            return;
        }

        const selected = approvedSpks.find(s => s.id === parseInt(spkId));
        if (!selected) return;

        setSelectedSpk(selected);

        // Check existing pertambahan for this SPK
        try {
            const perpRes = await fetchPertambahanSPKList({ id_spk: selected.id });
            const existings = perpRes.data || [];
            
            // Urutkan berdasarkan yang terbaru (created_at)
            const sortedExistings = [...existings].sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            
            setExistingPerpanjangan(sortedExistings);

            const latest = sortedExistings[0];
            if (latest) {
                if (latest.status_persetujuan === 'Menunggu Persetujuan') {
                    setStatusMsg({
                        text: "SPK ini sudah memiliki pengajuan perpanjangan yang masih menunggu persetujuan.",
                        type: 'warning'
                    });
                } else if (latest.status_persetujuan === 'Ditolak BM') {
                    // Pre-fill data otomatis agar user bisa merevisi input sebelumnya
                    setPertambahanHari(latest.pertambahan_hari);
                    setAlasanPerpanjangan(latest.alasan_perpanjangan);
                    setOriginalRejectedForm({
                        pertambahan_hari: latest.pertambahan_hari,
                        alasan_perpanjangan: latest.alasan_perpanjangan,
                    });
                    setRejectedModal({
                        isOpen: true,
                        alasanPenolakan: latest.alasan_penolakan || 'Tidak ada alasan yang diberikan.',
                    });
                    setStatusMsg({
                        text: "Data pengajuan yang ditolak telah dimuat. Ubah minimal 1 field lalu kirim ulang.",
                        type: 'warning'
                    });
                } else {
                    setStatusMsg({
                        text: "Silakan lengkapi form untuk pengajuan perpanjangan SPK.",
                        type: 'info'
                    });
                }
            } else {
                setStatusMsg({
                    text: "Silakan lengkapi form untuk pengajuan perpanjangan SPK.",
                    type: 'info'
                });
            }
        } catch {
            // No existing data, continue
            setStatusMsg({ text: "Silakan lengkapi form untuk pengajuan perpanjangan SPK.", type: 'info' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpk) return;
    if (!pertambahanHari || parseInt(pertambahanHari) <= 0) {
        alert("Pertambahan hari harus lebih dari 0.");
        return;
    }
    if (!alasanPerpanjangan.trim()) {
        alert("Alasan perpanjangan wajib diisi.");
        return;
    }
    if (originalRejectedForm && isRevisiUnchanged) {
        alert("Harap ubah minimal 1 field sebelum mengirim revisi pengajuan. Data tidak boleh sama persis dengan pengajuan yang ditolak.");
        return;
    }

    setIsSubmitting(true);
    try {
        const latestPerpanjangan = existingPerpanjangan[0];
        const isRevisi = latestPerpanjangan && latestPerpanjangan.status_persetujuan === 'Ditolak BM';

        const payload: any = {
            id_spk: selectedSpk.id,
            pertambahan_hari: pertambahanHari,
            tanggal_spk_akhir: tanggalSpkAkhir,
            tanggal_spk_akhir_setelah_perpanjangan: tanggalSetelahPerpanjangan,
            alasan_perpanjangan: alasanPerpanjangan.trim(),
            dibuat_oleh: userInfo.email,
            file_lampiran_pendukung: fileLampiran || undefined,
        };

        if (isRevisi) {
            // Force reset status saat operasi update agar di-review ulang oleh BM
            payload.status_persetujuan = 'Menunggu Persetujuan';
            await updatePertambahanSPK(latestPerpanjangan.id, payload);
        } else {
            await submitPertambahanSPK(payload);
        }
        
        setShowSuccessModal(true);
    } catch (err: any) {
        alert(err.message);
    } finally {
        setIsSubmitting(false);
    }
};

    // Check if form can be submitted
    const hasPendingPerpanjangan = existingPerpanjangan.some(
        p => p.status_persetujuan === 'Menunggu Persetujuan'
    );
    const isFormDisabled = hasPendingPerpanjangan;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12 relative">
            <AppNavbar
                title="PERTAMBAHAN HARI SPK"
                showBackButton
                backHref="/dashboard"
            />

            <main className="max-w-5xl mx-auto p-4 md:p-8 mt-4">
                <Card className="shadow-sm border-slate-200 relative z-10">
                    {/* ──── HEADER ──── */}
                    <div className="p-6 border-b border-slate-100 bg-white rounded-t-xl flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <CalendarPlus className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Pertambahan Hari SPK</h2>
                            <p className="text-sm text-slate-500">Ajukan perpanjangan durasi untuk SPK yang telah disetujui.</p>
                        </div>
                    </div>

                    <CardContent className="p-6 md:p-8 bg-slate-50/50">
                        <form onSubmit={handleSubmit} className="space-y-8">

                            {/* ═══════════════════════════════════════════════════
                                SECTION 1: PILIH SPK
                            ═══════════════════════════════════════════════════ */}
                            <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-emerald-600" />
                                    1. Pilih SPK yang Akan Diperpanjang
                                </h3>

                                {/* Search */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Cari & Pilih SPK *</label>
                                    <div className="relative mb-2">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Ketik No Ulok / Nomor SPK..."
                                            className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>

                                    {isLoading ? (
                                        <div className="p-3 text-center text-slate-500 bg-slate-100 rounded-lg text-sm">
                                            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                            Memuat data SPK yang disetujui...
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <select
                                                required
                                                className="w-full p-3 border rounded-lg bg-slate-50 outline-none font-semibold text-slate-700 cursor-pointer focus:bg-white focus:ring-2 focus:ring-emerald-500 appearance-none pr-10"
                                                value={selectedSpk?.id?.toString() || ''}
                                                onChange={(e) => handleSpkSelect(e.target.value)}
                                            >
                                                <option value="">-- Klik untuk Pilih SPK --</option>
                                                {filteredSpks.map(s => (
                                                    <option key={s.id} value={s.id.toString()}>
                                                        {s.nomor_spk} — {s.toko?.kode_toko || s.kode_toko || ''} — {s.toko?.nama_toko || ''} — {s.nomor_ulok} ({s.lingkup_pekerjaan}) — {s.proyek}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                        </div>
                                    )}
                                </div>

                                 {/* Status Message */}
                                {statusMsg.text && (
                                    <div className={`p-4 rounded-lg flex items-start gap-3 mt-4 font-medium text-sm ${
                                        statusMsg.type === 'error'   ? 'bg-red-50 text-red-700 border border-red-200' :
                                        statusMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                                        statusMsg.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                        'bg-blue-50 text-blue-700 border border-blue-200'
                                    }`}>
                                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                        <p>{statusMsg.text}</p>
                                    </div>
                                )}

                                {/* Banner perubahan wajib saat revisi */}
                                {originalRejectedForm && (
                                    <div className={`p-3 rounded-lg flex items-center gap-2 text-xs font-semibold border mt-4 ${
                                        isRevisiUnchanged
                                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                                            : 'bg-green-50 text-green-700 border-green-200'
                                    }`}>
                                        {isRevisiUnchanged
                                            ? <><AlertTriangle className="w-4 h-4 shrink-0"/> Belum ada perubahan dari pengajuan yang ditolak. Ubah minimal 1 field agar tombol submit aktif.</>
                                            : <><CheckCircle className="w-4 h-4 shrink-0"/> Perubahan terdeteksi. Anda bisa mengirim revisi pengajuan.</>
                                        }
                                    </div>
                                )}

                                {/* SPK Detail Card */}
                                {selectedSpk && (
                                    <div className="pt-4 border-t mt-4 border-slate-100">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-linear-to-br from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200">
                                            <InfoItem
                                                icon={<Hash className="w-3.5 h-3.5" />}
                                                label="Nomor SPK"
                                                value={selectedSpk.nomor_spk || '-'}
                                            />
                                            <InfoItem
                                                icon={<FileText className="w-3.5 h-3.5" />}
                                                label="Nomor ULOK"
                                                value={selectedSpk.nomor_ulok}
                                            />
                                            <InfoItem
                                                icon={<Hash className="w-3.5 h-3.5" />}
                                                label="Kode Toko"
                                                value={selectedSpk.toko?.kode_toko || selectedSpk.kode_toko || '-'}
                                            />
                                            <InfoItem
                                                icon={<Info className="w-3.5 h-3.5" />}
                                                label="Nama Toko"
                                                value={selectedSpk.toko?.nama_toko || '-'}
                                            />
                                            <InfoItem
                                                icon={<Info className="w-3.5 h-3.5" />}
                                                label="Cabang"
                                                value={selectedSpk.toko?.cabang || '-'}
                                            />
                                            <InfoItem
                                                icon={<Info className="w-3.5 h-3.5" />}
                                                label="Lingkup Pekerjaan"
                                                value={selectedSpk.lingkup_pekerjaan}
                                            />
                                            <InfoItem
                                                icon={<Info className="w-3.5 h-3.5" />}
                                                label="Proyek"
                                                value={selectedSpk.proyek}
                                            />
                                            <InfoItem
                                                icon={<Info className="w-3.5 h-3.5" />}
                                                label="Kontraktor"
                                                value={selectedSpk.nama_kontraktor}
                                            />
                                            <InfoItem
                                                icon={<Clock className="w-3.5 h-3.5" />}
                                                label="Durasi Awal"
                                                value={`${selectedSpk.durasi} hari`}
                                            />
                                            <InfoItem
                                                icon={<Calendar className="w-3.5 h-3.5" />}
                                                label="Tgl Mulai"
                                                value={formatTanggal(selectedSpk.waktu_mulai)}
                                            />
                                            <InfoItem
                                                icon={<Calendar className="w-3.5 h-3.5" />}
                                                label="Tgl Selesai (Akhir SPK)"
                                                value={formatTanggal(selectedSpk.waktu_selesai)}
                                                highlight
                                            />
                                        </div>

                                        {/* Existing perpanjangan history */}
                                        {existingPerpanjangan.length > 0 && (
                                            <div className="mt-4">
                                                <p className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                                    <CalendarClock className="w-3.5 h-3.5" />
                                                    Riwayat Perpanjangan
                                                </p>
                                                <div className="space-y-2">
                                                    {existingPerpanjangan.map((p) => (
                                                        <div
                                                            key={p.id}
                                                            className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                                                                p.status_persetujuan === 'Disetujui BM'
                                                                    ? 'bg-green-50 border-green-200'
                                                                    : p.status_persetujuan === 'Ditolak BM'
                                                                    ? 'bg-red-50 border-red-200'
                                                                    : 'bg-amber-50 border-amber-200'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                                    p.status_persetujuan === 'Disetujui BM'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : p.status_persetujuan === 'Ditolak BM'
                                                                        ? 'bg-red-100 text-red-700'
                                                                        : 'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                    {p.status_persetujuan}
                                                                </span>
                                                                <span className="font-semibold text-slate-700">
                                                                    +{p.pertambahan_hari} hari
                                                                </span>
                                                            </div>
                                                            <span className="text-xs text-slate-500">
                                                                {formatTanggal(p.created_at)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ═══════════════════════════════════════════════════
                                SECTION 2: PERTAMBAHAN HARI
                            ═══════════════════════════════════════════════════ */}
                            <div className={`space-y-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-opacity ${isFormDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                <h3 className="font-bold text-slate-700 border-b pb-2 flex items-center gap-2">
                                    <CalendarPlus className="w-4 h-4 text-emerald-600" />
                                    2. Detail Perpanjangan
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Pertambahan Hari */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Pertambahan Hari *</label>
                                        <input
                                            type="number"
                                            required
                                            min={1}
                                            max={365}
                                            placeholder="Masukkan jumlah hari tambahan..."
                                            className="w-full p-2.5 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                                            value={pertambahanHari}
                                            onChange={(e) => setPertambahanHari(e.target.value)}
                                        />
                                        <p className="text-xs text-slate-500">Jumlah hari kalender yang ditambahkan.</p>
                                    </div>

                                    {/* Auto-calculated dates preview */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Perhitungan Otomatis</label>
                                        {tanggalSpkAkhir && pertambahanHari && parseInt(pertambahanHari) > 0 ? (
                                            <div className="bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Calendar className="w-4 h-4 text-slate-500" />
                                                    <span className="text-slate-600">Tgl Akhir SPK Saat Ini:</span>
                                                    <span className="font-bold text-slate-800">{formatTanggal(tanggalSpkAkhir)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm pl-6">
                                                    <ArrowRight className="w-4 h-4 text-emerald-500" />
                                                    <span className="text-emerald-700 font-semibold">+ {pertambahanHari} hari</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm border-t border-emerald-200 pt-3">
                                                    <CalendarClock className="w-4 h-4 text-emerald-600" />
                                                    <span className="text-emerald-700">Tgl Akhir Setelah Perpanjangan:</span>
                                                    <span className="font-bold text-emerald-800 text-base">{formatTanggal(tanggalSetelahPerpanjangan)}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-sm text-slate-500 flex items-center gap-2">
                                                <Info className="w-4 h-4" />
                                                Pilih SPK dan masukkan jumlah hari untuk melihat perhitungan.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Alasan */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Alasan Perpanjangan *</label>
                                    <textarea
                                        required
                                        rows={4}
                                        placeholder="Misal: Progress lapangan terdampak cuaca, material terlambat datang, dll..."
                                        className="w-full p-3 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-sm"
                                        value={alasanPerpanjangan}
                                        onChange={(e) => setAlasanPerpanjangan(e.target.value)}
                                    />
                                    <p className="text-xs text-slate-500">Jelaskan alasan proyek membutuhkan waktu tambahan.</p>
                                </div>
                            </div>

                            {/* ═══════════════════════════════════════════════════
                                SECTION 3: LAMPIRAN PENDUKUNG (OPSIONAL)
                            ═══════════════════════════════════════════════════ */}
                            <div className={`space-y-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-opacity ${isFormDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                <h3 className="font-bold text-slate-700 border-b pb-2 flex items-center gap-2">
                                    <UploadCloud className="w-4 h-4 text-emerald-600" />
                                    3. Lampiran Pendukung
                                    <span className="text-xs font-normal text-slate-400 ml-1">(Opsional)</span>
                                </h3>

                                <div className="space-y-4">
                                    {existingPerpanjangan[0]?.link_lampiran_pendukung && (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between mb-4 pointer-events-auto">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">Lampiran Perpanjangan Terakhir</p>
                                                    <p className="text-xs text-slate-500">Terdapat file yang diunggah sebelumnya.</p>
                                                </div>
                                            </div>
                                            <Button 
                                                type="button"
                                                variant="outline" 
                                                className="border-emerald-200 text-emerald-700 hover:bg-emerald-100 shrink-0"
                                                onClick={async () => {
                                                    try {
                                                        const id = existingPerpanjangan[0].id;
                                                        await downloadPertambahanSPKLampiran(id);
                                                    } catch (err: any) {
                                                        alert(err.message || 'Gagal mengunduh lampiran');
                                                    }
                                                }}
                                            >
                                                <FileDown className="w-4 h-4 mr-2" />
                                                Lihat Lampiran
                                            </Button>
                                        </div>
                                    )}

                                    {!fileLampiran ? (
                                        <div className="relative group cross-fade duration-300">
                                            <input
                                                type="file"
                                                accept="image/*,application/pdf"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                onChange={handleFileChange}
                                            />
                                            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 bg-slate-50 group-hover:bg-emerald-50/50 group-hover:border-emerald-200 transition-all">
                                                <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-400 group-hover:text-emerald-500 group-hover:scale-110 transition-all">
                                                    <UploadCloud className="w-6 h-6" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-slate-700">Klik atau seret file ke sini</p>
                                                    <p className="text-xs text-slate-500 mt-1">Upload foto (JPG, PNG) atau dokumen PDF pendukung.</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-4 animate-in zoom-in-95 duration-200">
                                            {previewUrl ? (
                                                <div className="w-20 h-20 rounded-lg overflow-hidden border border-emerald-200 bg-white shrink-0">
                                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className="w-20 h-20 rounded-lg bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                                                    <FileText className="w-8 h-8 text-emerald-600" />
                                                </div>
                                            )}
                                            
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{fileLampiran.name}</p>
                                                <p className="text-xs text-slate-500">{(fileLampiran.size / 1024 / 1024).toFixed(2)} MB</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded border border-emerald-200">
                                                        {fileLampiran.type.split('/')[1] || 'FILE'}
                                                    </span>
                                                </div>
                                            </div>

                                            <button 
                                                type="button" 
                                                onClick={handleRemoveFile}
                                                className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-full transition-colors"
                                                title="Hapus file"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ═══════════════════════════════════════════════════
                                TOMBOL SUBMIT
                            ═══════════════════════════════════════════════════ */}
                            <div className="pt-4 pb-4">
                                <Button
                                    type="submit"
                                    disabled={
                                        isSubmitting ||
                                        !selectedSpk ||
                                        !pertambahanHari ||
                                        !alasanPerpanjangan.trim() ||
                                        isFormDisabled ||
                                        isRevisiUnchanged
                                    }
                                    className={`w-full h-14 text-lg font-bold shadow-lg transition-all ${
                                        isRevisiUnchanged
                                            ? 'bg-slate-400 cursor-not-allowed'
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    }`}
                                >
                                    {isSubmitting
                                        ? <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> Menyimpan Data...</>
                                        : <><Save className="w-6 h-6 mr-2" /> Kirim Pengajuan Perpanjangan SPK</>
                                    }
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </main>


            {/* ════════════════════════════════════════════════════════════
                MODAL: NOTIFIKASI DITOLAK
            ════════════════════════════════════════════════════════════ */}
            {rejectedModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-in zoom-in-95 duration-300">
                        {/* Icon */}
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                            <XCircle className="w-12 h-12 text-red-600" />
                        </div>

                        {/* Judul */}
                        <h2 className="text-2xl font-bold text-slate-800 mb-1">Pengajuan Ditolak</h2>
                        <p className="text-sm text-slate-500 mb-5">
                            Pengajuan perpanjangan SPK untuk ULOK ini sebelumnya ditolak oleh Branch Manager.
                        </p>

                        {/* Alasan Penolakan */}
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
                            <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Alasan Penolakan</p>
                            <p className="text-sm font-semibold text-red-800 leading-relaxed">
                                &ldquo;{rejectedModal.alasanPenolakan}&rdquo;
                            </p>
                        </div>

                        {/* Info */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-start gap-2 text-left">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 font-medium leading-relaxed">
                                Data pengajuan lama telah dimuat secara otomatis. Anda <strong>wajib mengubah minimal 1 field</strong> sebelum bisa mengirim revisi.
                            </p>
                        </div>

                        {/* Tombol */}
                        <Button
                            onClick={() => setRejectedModal(prev => ({ ...prev, isOpen: false }))}
                            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold text-base rounded-xl"
                        >
                            Tutup &amp; Mulai Revisi
                        </Button>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                MODAL: SUKSES
            ════════════════════════════════════════════════════════════ */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center transform scale-100 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Berhasil!</h2>
                        <p className="text-slate-600 mb-3 leading-relaxed">
                            Pengajuan pertambahan hari SPK untuk <b>{selectedSpk?.nomor_ulok}</b> berhasil dikirim.
                        </p>
                        <p className="text-sm text-slate-500 mb-8">
                            Perpanjangan <b>+{pertambahanHari} hari</b> — menunggu persetujuan Branch Manager.
                        </p>
                        <Button
                            onClick={() => router.push('/dashboard')}
                            className="w-full h-12 bg-slate-800 hover:bg-slate-900 text-white font-bold text-lg rounded-xl"
                        >
                            Kembali ke Dashboard
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Sub-component: Info Item for SPK detail display
// ---------------------------------------------------------------------------
function InfoItem({ icon, label, value, highlight }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <div className="space-y-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                {icon} {label}
            </p>
            <p className={`font-semibold text-sm ${highlight ? 'text-emerald-700 text-base' : 'text-slate-800'}`}>
                {value || '-'}
            </p>
        </div>
    );
}
