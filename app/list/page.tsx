"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AppNavbar from '@/components/AppNavbar';

import {
    ArrowLeft, Loader2, Search, FileText, FileSignature,
    Eye, FileDown, Building2, CalendarDays, User, XCircle,
    CheckCircle, Hash, Clock, ChevronRight, Filter,
    RefreshCw, AlertTriangle, Download,
} from 'lucide-react';

import {
    fetchRABList, fetchRABDetail, downloadRABPdf,
    type RABListItem, type RABDetailItem, type RABDetailResponse,
    fetchSPKList, fetchSPKDetail, downloadSPKPdf,
    type SPKListItem, type SPKDetailResponse,
} from '@/lib/api';
import { parseCurrency, formatRupiah } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================
type DokumenKategori = 'RAB' | 'SPK';
type ActiveView = 'menu' | 'list' | 'detail';

interface NormalizedDoc {
    id: number;
    tipe: DokumenKategori;
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    proyek: string;
    status: string;
    email_pembuat: string;
    total_nilai: number;
    created_at: string;
    link_pdf: string | null;
    // SPK specific
    nomor_spk?: string;
    nama_kontraktor?: string;
    lingkup_pekerjaan?: string;
    durasi?: number;
    waktu_mulai?: string;
    waktu_selesai?: string;
}

interface NormalizedDetail {
    id: number;
    tipe: DokumenKategori;
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    proyek: string;
    status: string;
    email_pembuat: string;
    total_nilai: number;
    created_at: string;
    // RAB specific
    alamat?: string;
    lingkup_pekerjaan?: string;
    nama_pt?: string;
    durasi_pekerjaan?: string;
    kategori_lokasi?: string;
    grand_total?: string;
    grand_total_non_sbo?: string;
    grand_total_final?: string;
    link_pdf_gabungan?: string | null;
    link_pdf_non_sbo?: string | null;
    link_pdf_rekapitulasi?: string | null;
    approval_koordinator?: { pemberi: string | null; waktu: string | null };
    approval_manager?: { pemberi: string | null; waktu: string | null };
    approval_direktur?: { pemberi: string | null; waktu: string | null };
    items?: Array<{
        id: number;
        kategori: string;
        jenis_pekerjaan: string;
        satuan: string;
        volume: number;
        harga_material: number;
        harga_upah: number;
        total: number;
    }>;
    // SPK specific
    nomor_spk?: string;
    nama_kontraktor?: string;
    durasi?: number;
    waktu_mulai?: string;
    waktu_selesai?: string;
    terbilang?: string;
    par?: string;
    link_pdf?: string | null;
    alasan_penolakan?: string | null;
    approver_email?: string | null;
    waktu_persetujuan?: string | null;
    approval_logs?: Array<{
        approver_email: string;
        tindakan: string;
        alasan_penolakan: string | null;
        waktu_tindakan: string;
    }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================
const KATEGORI_CONFIG: Record<DokumenKategori, {
    label: string;
    fullLabel: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
    hoverBorder: string;
    badgeColor: string;
    description: string;
}> = {
    RAB: {
        label: 'RAB',
        fullLabel: 'Rencana Anggaran Biaya',
        icon: <FileText className="w-10 h-10" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        hoverBorder: 'hover:border-blue-400',
        badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
        description: 'Daftar seluruh dokumen RAB yang telah diajukan.',
    },
    SPK: {
        label: 'SPK',
        fullLabel: 'Surat Perintah Kerja',
        icon: <FileSignature className="w-10 h-10" />,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        hoverBorder: 'hover:border-purple-400',
        badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
        description: 'Daftar seluruh dokumen SPK yang telah diajukan.',
    },
};

const STATUS_BADGE: Record<string, string> = {
    'PENDING':                          'bg-yellow-100 text-yellow-700 border-yellow-200',
    'PENDING_KOORDINATOR':              'bg-yellow-100 text-yellow-700 border-yellow-200',
    'MENUNGGU PERSETUJUAN KOORDINATOR': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'PENDING_MANAGER':                  'bg-orange-100 text-orange-700 border-orange-200',
    'MENUNGGU PERSETUJUAN MANAGER':     'bg-orange-100 text-orange-700 border-orange-200',
    'MENUNGGU PERSETUJUAN MANAJER':     'bg-orange-100 text-orange-700 border-orange-200',
    'PENDING_DIREKTUR':                 'bg-red-100 text-red-700 border-red-200',
    'MENUNGGU PERSETUJUAN DIREKTUR':    'bg-red-100 text-red-700 border-red-200',
    'APPROVED':                         'bg-green-100 text-green-700 border-green-200',
    'DISETUJUI':                        'bg-green-100 text-green-700 border-green-200',
    'REJECTED':                         'bg-red-100 text-red-700 border-red-200',
    'DITOLAK':                          'bg-red-100 text-red-700 border-red-200',
    'WAITING_FOR_BM_APPROVAL':          'bg-yellow-100 text-yellow-700 border-yellow-200',
    'SPK_APPROVED':                     'bg-green-100 text-green-700 border-green-200',
    'SPK_REJECTED':                     'bg-red-100 text-red-700 border-red-200',
};

const STATUS_OPTIONS = [
    { value: '', label: 'Semua Status' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
];

// =============================================================================
// UTILS
// =============================================================================
const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
};

const formatDateFull = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
};

const getStatusBadgeClass = (status: string) => {
    const upper = (status ?? '').toUpperCase();
    return STATUS_BADGE[upper] ?? 'bg-slate-100 text-slate-600 border-slate-200';
};

const getStatusLabel = (status: string) => {
    if (!status) return '-';
    const upper = status.toUpperCase();
    if (upper.includes('KOORDINATOR')) return 'Pending Koord.';
    if (upper.includes('MANAGER') || upper.includes('MANAJER')) return 'Pending Mgr.';
    if (upper.includes('DIREKTUR')) return 'Pending Dir.';
    if (upper === 'WAITING_FOR_BM_APPROVAL') return 'Pending BM';
    if (upper.includes('DISETUJUI') || upper === 'APPROVED' || upper === 'SPK_APPROVED') return 'Approved';
    if (upper.includes('TOLAK') || upper === 'REJECTED' || upper === 'SPK_REJECTED') return 'Rejected';
    if (upper.includes('PENDING')) return 'Pending';
    return status;
};

// =============================================================================
// NORMALIZE HELPERS
// =============================================================================
const normalizeRABDocs = (items: RABListItem[]): NormalizedDoc[] =>
    items.map(r => ({
        id: r.id,
        tipe: 'RAB' as DokumenKategori,
        nomor_ulok:    r.nomor_ulok ?? r.toko?.nomor_ulok ?? '-',
        nama_toko:     r.nama_toko  ?? r.toko?.nama_toko  ?? '-',
        cabang:        r.cabang     ?? r.toko?.cabang     ?? '-',
        proyek:        r.proyek     ?? r.toko?.proyek     ?? '-',
        status:        r.status,
        email_pembuat: r.email_pembuat,
        total_nilai:   parseCurrency(r.grand_total_final ?? r.grand_total),
        created_at:    r.created_at,
        link_pdf:      r.link_pdf_gabungan ?? null,
    }));

const normalizeSPKDocs = (items: SPKListItem[]): NormalizedDoc[] =>
    items.map(s => {
        const raw = s as any;
        return {
            id: s.id,
            tipe: 'SPK' as DokumenKategori,
            nomor_ulok:        s.nomor_ulok,
            nama_toko:         raw.toko?.nama_toko ?? raw.nama_toko ?? '-',
            cabang:            raw.toko?.cabang ?? raw.cabang ?? '-',
            proyek:            s.proyek ?? '-',
            status:            s.status,
            email_pembuat:     s.email_pembuat,
            total_nilai:       parseCurrency(s.grand_total),
            created_at:        s.created_at,
            link_pdf:          s.link_pdf ?? null,
            nomor_spk:         s.nomor_spk,
            nama_kontraktor:   s.nama_kontraktor,
            lingkup_pekerjaan: s.lingkup_pekerjaan,
            durasi:            s.durasi,
            waktu_mulai:       s.waktu_mulai,
            waktu_selesai:     s.waktu_selesai,
        };
    });

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function DaftarDokumenPage() {
    const router = useRouter();

    // --- Auth ---
    const [userInfo, setUserInfo] = useState({ name: '', role: '', cabang: '', email: '' });

    // --- Navigation ---
    const [activeView, setActiveView] = useState<ActiveView>('menu');
    const [selectedKategori, setSelectedKategori] = useState<DokumenKategori | null>(null);

    // --- Data ---
    const [listData, setListData] = useState<NormalizedDoc[]>([]);
    const [selectedDetail, setSelectedDetail] = useState<NormalizedDetail | null>(null);

    // --- Filters ---
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // --- UI ---
    const [isLoading, setIsLoading] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // =========================================================================
    // AUTH + INIT
    // =========================================================================
    useEffect(() => {
        const isAuth  = sessionStorage.getItem("authenticated");
        const role    = sessionStorage.getItem("userRole") || '';
        const email   = sessionStorage.getItem("loggedInUserEmail") || '';
        const cabang  = sessionStorage.getItem("loggedInUserCabang") || '';
        const namaLengkap = sessionStorage.getItem("nama_lengkap") || email.split('@')[0];

        if (isAuth !== "true" || !role) { router.push('/auth'); return; }

        setUserInfo({ name: namaLengkap.toUpperCase(), role, cabang, email });
    }, [router]);

    // =========================================================================
    // TOAST
    // =========================================================================
    const showToast = useCallback((msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    // =========================================================================
    // LOAD LIST
    // =========================================================================
    const loadList = useCallback(async (kategori: DokumenKategori) => {
        setIsLoading(true);
        setSearchQuery('');
        setStatusFilter('');
        try {
            let docs: NormalizedDoc[] = [];
            if (kategori === 'RAB') {
                const res = await fetchRABList();
                docs = normalizeRABDocs(res.data ?? []);
            } else if (kategori === 'SPK') {
                const res = await fetchSPKList();
                docs = normalizeSPKDocs(res.data ?? []);
            }

            // Filter by cabang for non-HO users
            if (userInfo.cabang && userInfo.cabang.toUpperCase() !== 'HEAD OFFICE') {
                docs = docs.filter(d =>
                    d.cabang.toUpperCase() === userInfo.cabang.toUpperCase()
                );
            }

            // Sort by newest first
            docs.sort((a, b) => {
                const da = new Date(a.created_at).getTime() || 0;
                const db = new Date(b.created_at).getTime() || 0;
                return db - da;
            });

            setListData(docs);
        } catch (err: any) {
            showToast(err.message || 'Gagal memuat data.', 'error');
            setListData([]);
        } finally {
            setIsLoading(false);
        }
    }, [userInfo.cabang, showToast]);

    // =========================================================================
    // LOAD DETAIL
    // =========================================================================
    const loadDetail = useCallback(async (doc: NormalizedDoc) => {
        setIsDetailLoading(true);
        setActiveView('detail');
        try {
            let detail: NormalizedDetail | null = null;

            if (doc.tipe === 'RAB') {
                const res = await fetchRABDetail(doc.id);
                const d = res.data;
                detail = {
                    id: d.rab.id,
                    tipe: 'RAB',
                    nomor_ulok:          d.toko.nomor_ulok,
                    nama_toko:           d.toko.nama_toko,
                    cabang:              d.toko.cabang,
                    proyek:              d.toko.proyek,
                    alamat:              d.toko.alamat,
                    lingkup_pekerjaan:   d.toko.lingkup_pekerjaan,
                    status:              d.rab.status,
                    email_pembuat:       d.rab.email_pembuat,
                    nama_pt:             d.rab.nama_pt,
                    durasi_pekerjaan:    d.rab.durasi_pekerjaan,
                    kategori_lokasi:     d.rab.kategori_lokasi,
                    total_nilai:         parseCurrency(d.rab.grand_total_final ?? d.rab.grand_total),
                    grand_total:         d.rab.grand_total,
                    grand_total_non_sbo: d.rab.grand_total_non_sbo,
                    grand_total_final:   d.rab.grand_total_final,
                    created_at:          d.rab.created_at,
                    link_pdf_gabungan:   d.rab.link_pdf_gabungan,
                    link_pdf_non_sbo:    d.rab.link_pdf_non_sbo,
                    link_pdf_rekapitulasi: d.rab.link_pdf_rekapitulasi,
                    alasan_penolakan:    d.rab.alasan_penolakan,
                    approval_koordinator: { pemberi: d.rab.pemberi_persetujuan_koordinator, waktu: d.rab.waktu_persetujuan_koordinator },
                    approval_manager:     { pemberi: d.rab.pemberi_persetujuan_manager,     waktu: d.rab.waktu_persetujuan_manager },
                    approval_direktur:    { pemberi: d.rab.pemberi_persetujuan_direktur,    waktu: d.rab.waktu_persetujuan_direktur },
                    items: (d.items ?? []).map((it: RABDetailItem) => ({
                        id: it.id,
                        kategori:        it.kategori_pekerjaan,
                        jenis_pekerjaan: it.jenis_pekerjaan,
                        satuan:          it.satuan,
                        volume:          it.volume,
                        harga_material:  it.harga_material,
                        harga_upah:      it.harga_upah,
                        total:           it.total_harga,
                    })),
                };
            } else if (doc.tipe === 'SPK') {
                const res = await fetchSPKDetail(doc.id);
                const d = res.data;
                detail = {
                    id: d.pengajuan.id,
                    tipe: 'SPK',
                    nomor_ulok:        d.pengajuan.nomor_ulok,
                    nama_toko:         doc.nama_toko,
                    cabang:            doc.cabang,
                    proyek:            d.pengajuan.proyek,
                    status:            d.pengajuan.status,
                    email_pembuat:     d.pengajuan.email_pembuat,
                    total_nilai:       parseCurrency(d.pengajuan.grand_total),
                    created_at:        d.pengajuan.created_at,
                    nomor_spk:         d.pengajuan.nomor_spk,
                    nama_kontraktor:   d.pengajuan.nama_kontraktor,
                    lingkup_pekerjaan: d.pengajuan.lingkup_pekerjaan,
                    durasi:            d.pengajuan.durasi,
                    waktu_mulai:       d.pengajuan.waktu_mulai,
                    waktu_selesai:     d.pengajuan.waktu_selesai,
                    terbilang:         d.pengajuan.terbilang,
                    par:               d.pengajuan.par,
                    link_pdf:          d.pengajuan.link_pdf,
                    alasan_penolakan:  d.pengajuan.alasan_penolakan,
                    approver_email:    d.pengajuan.approver_email,
                    waktu_persetujuan: d.pengajuan.waktu_persetujuan,
                    approval_logs: (d.approvalLogs ?? []).map(log => ({
                        approver_email: log.approver_email,
                        tindakan: log.tindakan,
                        alasan_penolakan: log.alasan_penolakan,
                        waktu_tindakan: log.waktu_tindakan,
                    })),
                };
            }

            setSelectedDetail(detail);
        } catch (err: any) {
            showToast(err.message || 'Gagal memuat detail.', 'error');
            setActiveView('list');
        } finally {
            setIsDetailLoading(false);
        }
    }, [showToast]);

    // =========================================================================
    // PDF DOWNLOAD
    // =========================================================================
    const handleDownloadPDF = useCallback(async (id: number, tipe: DokumenKategori) => {
        setDownloadingId(id);
        try {
            if (tipe === 'RAB') {
                await downloadRABPdf(id);
            } else if (tipe === 'SPK') {
                await downloadSPKPdf(id);
            }
            showToast('PDF berhasil diunduh.', 'success');
        } catch (err: any) {
            showToast(err.message || 'Gagal mengunduh PDF.', 'error');
        } finally {
            setDownloadingId(null);
        }
    }, [showToast]);

    // =========================================================================
    // NAVIGATION
    // =========================================================================
    const handleSelectKategori = (kat: DokumenKategori) => {
        setSelectedKategori(kat);
        setSelectedDetail(null);
        setActiveView('list');
        loadList(kat);
    };

    const handleBackToMenu = () => {
        setActiveView('menu');
        setSelectedKategori(null);
        setListData([]);
        setSelectedDetail(null);
        setSearchQuery('');
        setStatusFilter('');
    };

    const handleBackToList = () => {
        setActiveView('list');
        setSelectedDetail(null);
    };

    // =========================================================================
    // FILTERED LIST
    // =========================================================================
    const filteredList = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return listData.filter(item => {
            // Search filter
            if (q) {
                const matchSearch =
                    item.nama_toko.toLowerCase().includes(q) ||
                    item.nomor_ulok.toLowerCase().includes(q) ||
                    item.email_pembuat.toLowerCase().includes(q) ||
                    (item.nomor_spk ?? '').toLowerCase().includes(q) ||
                    (item.nama_kontraktor ?? '').toLowerCase().includes(q);
                if (!matchSearch) return false;
            }
            // Status filter
            if (statusFilter) {
                const upper = (item.status ?? '').toUpperCase();
                if (statusFilter === 'PENDING') {
                    if (!upper.includes('PENDING') && !upper.includes('MENUNGGU') && upper !== 'WAITING_FOR_BM_APPROVAL') return false;
                } else if (statusFilter === 'APPROVED') {
                    if (!upper.includes('APPROVED') && !upper.includes('DISETUJUI')) return false;
                } else if (statusFilter === 'REJECTED') {
                    if (!upper.includes('REJECTED') && !upper.includes('TOLAK') && !upper.includes('DITOLAK')) return false;
                }
            }
            return true;
        });
    }, [listData, searchQuery, statusFilter]);

    // =========================================================================
    // RENDER
    // =========================================================================
    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">

            {/* TOAST */}
            {toast && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-semibold animate-in slide-in-from-top-2 duration-300 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                    {toast.msg}
                </div>
            )}

            {/* NAVBAR */}
            <AppNavbar
                title={selectedKategori ? `Dokumen ${KATEGORI_CONFIG[selectedKategori].label}` : 'Daftar Dokumen'}
                showBackButton
                backHref="/dashboard"
                rightActions={
                    <div className="flex items-center gap-2">
                        {selectedKategori && activeView === 'list' && (
                            <Badge className={`${KATEGORI_CONFIG[selectedKategori].badgeColor} font-bold text-xs px-2.5 border`}>
                                {filteredList.length} Dokumen
                            </Badge>
                        )}
                        <Badge variant="outline" className="bg-black/10 text-white border-white/30 px-3 py-1 md:py-1.5 shadow-sm backdrop-blur-sm text-[10px] md:text-xs font-semibold hidden md:flex">
                            {userInfo.cabang || 'LOADING...'}
                        </Badge>
                    </div>
                }
            />

            <main className="max-w-7xl mx-auto p-4 md:p-8 mt-4">

                {/* ===== VIEW 0: MENU KATEGORI ===== */}
                {activeView === 'menu' && (
                    <div className="flex flex-col items-center mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center mb-10">
                            <div className="mx-auto w-16 h-16 rounded-2xl bg-linear-to-br from-red-500 to-red-700 flex items-center justify-center mb-5 shadow-lg shadow-red-200">
                                <FileText className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">Daftar Dokumen</h2>
                            <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
                                Pilih kategori dokumen untuk melihat daftar lengkap dokumen yang telah diajukan.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-4">
                            {(Object.keys(KATEGORI_CONFIG) as DokumenKategori[]).map(kat => {
                                const cfg = KATEGORI_CONFIG[kat];
                                return (
                                    <Card
                                        key={kat}
                                        className={`cursor-pointer transition-all duration-300 border-2 border-transparent ${cfg.hoverBorder} group hover:shadow-xl hover:-translate-y-1`}
                                        onClick={() => handleSelectKategori(kat)}
                                    >
                                        <CardContent className="p-8 md:p-10 flex flex-col items-center text-center gap-4">
                                            <div className={`${cfg.bgColor} p-5 rounded-2xl transition-transform group-hover:scale-110 duration-300`}>
                                                <div className={cfg.color}>{cfg.icon}</div>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-slate-800 mb-1">{cfg.fullLabel}</h3>
                                                <p className="text-sm text-slate-500">{cfg.description}</p>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-400 group-hover:text-slate-600 transition-colors">
                                                <span>Lihat Dokumen</span>
                                                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ===== VIEW 1: LIST ===== */}
                {activeView === 'list' && selectedKategori && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <div className="flex items-center gap-4">
                                <Button variant="outline" className="h-10" onClick={handleBackToMenu}>
                                    <ArrowLeft className="w-4 h-4 mr-2" /> Kategori
                                </Button>
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold text-slate-800">
                                        Dokumen {KATEGORI_CONFIG[selectedKategori].fullLabel}
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        Menampilkan {filteredList.length} dari {listData.length} dokumen
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                className="h-10"
                                onClick={() => loadList(selectedKategori)}
                                disabled={isLoading}
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-5">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    id="search-dokumen"
                                    type="text"
                                    placeholder="Cari ULOK, toko, email, atau kontraktor..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none transition-all"
                                />
                            </div>
                            <div className="relative w-full sm:w-48">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    id="filter-status"
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none appearance-none cursor-pointer"
                                >
                                    {STATUS_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* List */}
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-3" />
                                <p className="text-sm text-slate-500 font-medium">Memuat data dokumen...</p>
                            </div>
                        ) : filteredList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                    <FileText className="w-8 h-8 text-slate-300" />
                                </div>
                                <p className="text-slate-500 font-semibold">Tidak ada dokumen ditemukan</p>
                                <p className="text-sm text-slate-400 mt-1">Coba ubah filter pencarian Anda</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {filteredList.map(doc => (
                                    <div
                                        key={doc.id}
                                        className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
                                        onClick={() => loadDetail(doc)}
                                    >
                                        <div className="p-4 md:p-5">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                {/* Left info */}
                                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                                    <div className={`w-10 h-10 rounded-xl ${KATEGORI_CONFIG[selectedKategori].bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                                                        <div className={`${KATEGORI_CONFIG[selectedKategori].color}`}>
                                                            {selectedKategori === 'RAB'
                                                                ? <FileText className="w-5 h-5" />
                                                                : <FileSignature className="w-5 h-5" />
                                                            }
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-slate-800 text-sm">{doc.nomor_ulok}</span>
                                                            <Badge className={`${getStatusBadgeClass(doc.status)} text-[10px] font-semibold border px-2 py-0`}>
                                                                {getStatusLabel(doc.status)}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-slate-600 truncate mt-0.5">
                                                            {selectedKategori === 'RAB' ? doc.nama_toko : (doc.nama_kontraktor || doc.nama_toko)}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                                <CalendarDays className="w-3 h-3" /> {formatDate(doc.created_at)}
                                                            </span>
                                                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                                <User className="w-3 h-3" /> {doc.email_pembuat}
                                                            </span>
                                                            {doc.proyek && doc.proyek !== '-' && (
                                                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                                    <Building2 className="w-3 h-3" /> {doc.proyek}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right info */}
                                                <div className="flex items-center gap-3 shrink-0 md:pl-4">
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-slate-800">{formatRupiah(doc.total_nilai)}</p>
                                                        {selectedKategori === 'SPK' && doc.nomor_spk && (
                                                            <p className="text-[11px] text-slate-400 mt-0.5">SPK: {doc.nomor_spk}</p>
                                                        )}
                                                    </div>
                                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ===== VIEW 2: DETAIL ===== */}
                {activeView === 'detail' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Back button */}
                        <div className="flex items-center gap-4 mb-6">
                            <Button variant="outline" className="h-10" onClick={handleBackToList}>
                                <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Daftar
                            </Button>
                        </div>

                        {isDetailLoading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-3" />
                                <p className="text-sm text-slate-500 font-medium">Memuat detail dokumen...</p>
                            </div>
                        ) : selectedDetail ? (
                            <div className="space-y-5">

                                {/* Detail Header Card */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className={`px-6 py-4 ${selectedDetail.tipe === 'RAB' ? 'bg-linear-to-r from-blue-50 to-blue-100/50 border-b border-blue-100' : 'bg-linear-to-r from-purple-50 to-purple-100/50 border-b border-purple-100'}`}>
                                        <div className="flex items-center justify-between flex-wrap gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl ${selectedDetail.tipe === 'RAB' ? 'bg-blue-100' : 'bg-purple-100'} flex items-center justify-center`}>
                                                    {selectedDetail.tipe === 'RAB'
                                                        ? <FileText className="w-5 h-5 text-blue-600" />
                                                        : <FileSignature className="w-5 h-5 text-purple-600" />
                                                    }
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg text-slate-800">
                                                        {selectedDetail.tipe === 'RAB' ? 'Detail RAB' : 'Detail SPK'}
                                                    </h3>
                                                    <p className="text-sm text-slate-500">ID: {selectedDetail.id}</p>
                                                </div>
                                            </div>
                                            <Badge className={`${getStatusBadgeClass(selectedDetail.status)} font-semibold text-xs border px-3 py-1`}>
                                                {getStatusLabel(selectedDetail.status)}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                            <InfoRow icon={<Hash className="w-4 h-4" />} label="Nomor ULOK" value={selectedDetail.nomor_ulok} />
                                            <InfoRow icon={<Building2 className="w-4 h-4" />} label="Nama Toko" value={selectedDetail.nama_toko} />
                                            <InfoRow icon={<Building2 className="w-4 h-4" />} label="Cabang" value={selectedDetail.cabang} />
                                            <InfoRow icon={<Building2 className="w-4 h-4" />} label="Proyek" value={selectedDetail.proyek} />
                                            <InfoRow icon={<User className="w-4 h-4" />} label="Email Pembuat" value={selectedDetail.email_pembuat} />
                                            <InfoRow icon={<CalendarDays className="w-4 h-4" />} label="Tanggal Dibuat" value={formatDateFull(selectedDetail.created_at)} />

                                            {/* RAB-specific fields */}
                                            {selectedDetail.tipe === 'RAB' && (
                                                <>
                                                    {selectedDetail.lingkup_pekerjaan && (
                                                        <InfoRow icon={<FileText className="w-4 h-4" />} label="Lingkup Pekerjaan" value={selectedDetail.lingkup_pekerjaan} />
                                                    )}
                                                    {selectedDetail.nama_pt && (
                                                        <InfoRow icon={<Building2 className="w-4 h-4" />} label="Nama PT" value={selectedDetail.nama_pt} />
                                                    )}
                                                    {selectedDetail.alamat && (
                                                        <InfoRow icon={<Building2 className="w-4 h-4" />} label="Alamat" value={selectedDetail.alamat} />
                                                    )}
                                                    {selectedDetail.durasi_pekerjaan && (
                                                        <InfoRow icon={<Clock className="w-4 h-4" />} label="Durasi Pekerjaan" value={`${selectedDetail.durasi_pekerjaan} Hari`} />
                                                    )}
                                                </>
                                            )}

                                            {/* SPK-specific fields */}
                                            {selectedDetail.tipe === 'SPK' && (
                                                <>
                                                    {selectedDetail.nomor_spk && (
                                                        <InfoRow icon={<Hash className="w-4 h-4" />} label="Nomor SPK" value={selectedDetail.nomor_spk} />
                                                    )}
                                                    {selectedDetail.nama_kontraktor && (
                                                        <InfoRow icon={<User className="w-4 h-4" />} label="Kontraktor" value={selectedDetail.nama_kontraktor} />
                                                    )}
                                                    {selectedDetail.lingkup_pekerjaan && (
                                                        <InfoRow icon={<FileText className="w-4 h-4" />} label="Lingkup Pekerjaan" value={selectedDetail.lingkup_pekerjaan} />
                                                    )}
                                                    {selectedDetail.durasi != null && (
                                                        <InfoRow icon={<Clock className="w-4 h-4" />} label="Durasi" value={`${selectedDetail.durasi} Hari`} />
                                                    )}
                                                    {selectedDetail.waktu_mulai && (
                                                        <InfoRow icon={<CalendarDays className="w-4 h-4" />} label="Waktu Mulai" value={formatDateFull(selectedDetail.waktu_mulai)} />
                                                    )}
                                                    {selectedDetail.waktu_selesai && (
                                                        <InfoRow icon={<CalendarDays className="w-4 h-4" />} label="Waktu Selesai" value={formatDateFull(selectedDetail.waktu_selesai)} />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Nilai Kontrak Card */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-5 bg-red-500 rounded-full" />
                                        Nilai Kontrak
                                    </h4>
                                    <div className="bg-linear-to-r from-slate-50 to-slate-100/50 rounded-xl p-5 border border-slate-200">
                                        <p className="text-2xl font-extrabold text-slate-800">
                                            {formatRupiah(selectedDetail.total_nilai)}
                                        </p>
                                        {selectedDetail.tipe === 'SPK' && selectedDetail.terbilang && (
                                            <p className="text-sm text-slate-500 mt-1 italic">"{selectedDetail.terbilang}"</p>
                                        )}
                                        {selectedDetail.tipe === 'RAB' && (
                                            <div className="flex flex-wrap gap-4 mt-3 text-sm">
                                                {selectedDetail.grand_total && (
                                                    <div>
                                                        <span className="text-slate-400">Total RAB: </span>
                                                        <span className="font-semibold text-slate-700">{formatRupiah(parseCurrency(selectedDetail.grand_total))}</span>
                                                    </div>
                                                )}
                                                {selectedDetail.grand_total_non_sbo && (
                                                    <div>
                                                        <span className="text-slate-400">Non-SBO: </span>
                                                        <span className="font-semibold text-slate-700">{formatRupiah(parseCurrency(selectedDetail.grand_total_non_sbo))}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Approval Trail (RAB) */}
                                {selectedDetail.tipe === 'RAB' && (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                        <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-5 bg-green-500 rounded-full" />
                                            Riwayat Persetujuan
                                        </h4>
                                        <div className="space-y-3">
                                            <ApprovalRow label="Koordinator" pemberi={selectedDetail.approval_koordinator?.pemberi} waktu={selectedDetail.approval_koordinator?.waktu} />
                                            <ApprovalRow label="Manager" pemberi={selectedDetail.approval_manager?.pemberi} waktu={selectedDetail.approval_manager?.waktu} />
                                            <ApprovalRow label="Direktur" pemberi={selectedDetail.approval_direktur?.pemberi} waktu={selectedDetail.approval_direktur?.waktu} />
                                            {selectedDetail.alasan_penolakan && (
                                                <div className="flex items-start gap-3 text-sm mt-2 bg-red-50 rounded-lg p-3 border border-red-100">
                                                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="text-red-700 font-semibold">Alasan Penolakan: </span>
                                                        <span className="text-red-600">{selectedDetail.alasan_penolakan}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Approval Logs (SPK) */}
                                {selectedDetail.tipe === 'SPK' && selectedDetail.approval_logs && selectedDetail.approval_logs.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                        <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-5 bg-green-500 rounded-full" />
                                            Log Approval
                                        </h4>
                                        <div className="space-y-3">
                                            {selectedDetail.approval_logs.map((log, idx) => (
                                                <div key={idx} className="flex items-start gap-3 text-sm">
                                                    {log.tindakan.toUpperCase() === 'APPROVE' ? (
                                                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                                    )}
                                                    <div>
                                                        <span className="text-slate-700 font-semibold">{log.approver_email}</span>
                                                        <span className="text-slate-400 mx-1">—</span>
                                                        <Badge className={`${log.tindakan.toUpperCase() === 'APPROVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-[10px] font-semibold border-0`}>
                                                            {log.tindakan}
                                                        </Badge>
                                                        <span className="text-slate-400 text-xs ml-2">{formatDateFull(log.waktu_tindakan)}</span>
                                                        {log.alasan_penolakan && (
                                                            <p className="text-red-500 text-xs mt-1 italic">{log.alasan_penolakan}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Alasan Penolakan (SPK) */}
                                {selectedDetail.tipe === 'SPK' && selectedDetail.alasan_penolakan && (
                                    <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-bold text-red-700">Alasan Penolakan</p>
                                                <p className="text-sm text-red-600 mt-1">{selectedDetail.alasan_penolakan}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Items Table (RAB) */}
                                {selectedDetail.tipe === 'RAB' && selectedDetail.items && selectedDetail.items.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 border-b border-slate-100">
                                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                <div className="w-1.5 h-5 bg-blue-500 rounded-full" />
                                                Item Pekerjaan ({selectedDetail.items.length} item)
                                            </h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 text-slate-500">
                                                    <tr>
                                                        <th className="text-left px-4 py-3 font-semibold text-xs">No</th>
                                                        <th className="text-left px-4 py-3 font-semibold text-xs">Kategori</th>
                                                        <th className="text-left px-4 py-3 font-semibold text-xs">Jenis Pekerjaan</th>
                                                        <th className="text-left px-4 py-3 font-semibold text-xs">Satuan</th>
                                                        <th className="text-right px-4 py-3 font-semibold text-xs">Vol</th>
                                                        <th className="text-right px-4 py-3 font-semibold text-xs">Material</th>
                                                        <th className="text-right px-4 py-3 font-semibold text-xs">Upah</th>
                                                        <th className="text-right px-4 py-3 font-semibold text-xs">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedDetail.items.map((item, idx) => (
                                                        <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                                                            <td className="px-4 py-2.5 text-slate-400">{idx + 1}</td>
                                                            <td className="px-4 py-2.5 text-slate-600 font-medium text-xs">{item.kategori}</td>
                                                            <td className="px-4 py-2.5 text-slate-700">{item.jenis_pekerjaan}</td>
                                                            <td className="px-4 py-2.5 text-slate-500">{item.satuan}</td>
                                                            <td className="px-4 py-2.5 text-right text-slate-600">{item.volume}</td>
                                                            <td className="px-4 py-2.5 text-right text-slate-600">{formatRupiah(item.harga_material)}</td>
                                                            <td className="px-4 py-2.5 text-right text-slate-600">{formatRupiah(item.harga_upah)}</td>
                                                            <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{formatRupiah(item.total)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* PDF Download Actions */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
                                        Unduh Dokumen
                                    </h4>
                                    <div className="flex flex-wrap gap-3">
                                        <Button
                                            className="bg-red-600 hover:bg-red-700 text-white"
                                            disabled={downloadingId === selectedDetail.id}
                                            onClick={() => handleDownloadPDF(selectedDetail.id, selectedDetail.tipe)}
                                        >
                                            {downloadingId === selectedDetail.id ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <Download className="w-4 h-4 mr-2" />
                                            )}
                                            Unduh PDF {selectedDetail.tipe}
                                        </Button>

                                        {/* Additional RAB PDF links */}
                                        {selectedDetail.tipe === 'RAB' && selectedDetail.link_pdf_gabungan && (
                                            <a href={selectedDetail.link_pdf_gabungan} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline">
                                                    <FileDown className="w-4 h-4 mr-2" /> PDF Gabungan
                                                </Button>
                                            </a>
                                        )}
                                        {selectedDetail.tipe === 'RAB' && selectedDetail.link_pdf_non_sbo && (
                                            <a href={selectedDetail.link_pdf_non_sbo} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline">
                                                    <FileDown className="w-4 h-4 mr-2" /> PDF Non-SBO
                                                </Button>
                                            </a>
                                        )}
                                        {selectedDetail.tipe === 'RAB' && selectedDetail.link_pdf_rekapitulasi && (
                                            <a href={selectedDetail.link_pdf_rekapitulasi} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline">
                                                    <FileDown className="w-4 h-4 mr-2" /> PDF Rekapitulasi
                                                </Button>
                                            </a>
                                        )}

                                        {/* SPK PDF link */}
                                        {selectedDetail.tipe === 'SPK' && selectedDetail.link_pdf && (
                                            <a href={selectedDetail.link_pdf} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline">
                                                    <FileDown className="w-4 h-4 mr-2" /> Lihat PDF Online
                                                </Button>
                                            </a>
                                        )}
                                    </div>
                                </div>

                            </div>
                        ) : null}
                    </div>
                )}

            </main>
        </div>
    );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    if (!value || value === '-') return null;
    return (
        <div className="flex items-start gap-3">
            <div className="text-slate-400 mt-0.5 shrink-0">{icon}</div>
            <div className="min-w-0">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
                <p className="text-sm text-slate-800 font-semibold truncate">{value}</p>
            </div>
        </div>
    );
}

function ApprovalRow({ label, pemberi, waktu }: { label: string; pemberi?: string | null; waktu?: string | null }) {
    return (
        <div className="flex items-center gap-3 text-sm">
            {pemberi ? (
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            ) : (
                <div className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0" />
            )}
            <span className="text-slate-500 font-medium w-24 shrink-0">{label}</span>
            {pemberi ? (
                <>
                    <span className="text-slate-800 font-semibold truncate">{pemberi}</span>
                    {waktu && <span className="text-slate-400 text-xs ml-1 shrink-0">{formatDateFull(waktu)}</span>}
                </>
            ) : (
                <span className="text-slate-300 italic text-xs">Belum diproses</span>
            )}
        </div>
    );
}
