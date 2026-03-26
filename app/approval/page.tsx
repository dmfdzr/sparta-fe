"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft, Loader2, CheckCircle, XCircle,
    Search, FileText, ClipboardList, Lightbulb, Eye,
    AlertTriangle, FileDown, Building2, CalendarDays, User
} from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';

import {
    // RAB
    fetchRABList, fetchRABDetail, processRABApproval, downloadRABPdf,
    type RABListItem, type RABDetailItem,
    // SPK
    fetchSPKList, fetchSPKDetail, processSPKApproval,
    type SPKListItem, type SPKDetailItem,
    // IL
    fetchILList, fetchILDetail, processILApproval,
    type ILListItem, type ILDetailItem,
} from '@/lib/api';

import { parseCurrency } from '@/lib/utils';

// =============================================
// TYPES INTERNAL
// =============================================
type ApprovalType = 'RAB' | 'SPK' | 'IL';
type ActiveView = 'menu' | 'list' | 'detail';
type FilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

interface NormalizedListItem {
    id: number;
    tipe: ApprovalType;
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    status: string;
    total_nilai: number;
    email_pembuat: string;
    created_at: string;
    _raw: RABListItem | SPKListItem | ILListItem;
}

interface NormalizedDetail {
    id: number;
    tipe: ApprovalType;
    nomor_ulok: string;
    nama_toko: string;
    alamat?: string;
    cabang: string;
    lingkup_pekerjaan?: string;
    status: string;
    total_nilai: number;
    email_pembuat: string;
    created_at: string;
    alasan_penolakan?: string | null;
    // Approval trail (RAB & IL)
    approval_koordinator?: { pemberi: string | null; waktu: string | null };
    approval_manager?: { pemberi: string | null; waktu: string | null };
    approval_direktur?: { pemberi: string | null; waktu: string | null };
    // SPK specific
    nama_kontraktor?: string;
    masa_berlaku?: string;
    nilai_kontrak?: number;
    // PDF
    link_pdf_gabungan?: string | null;
    // Items
    items: Array<{
        id: number;
        kategori: string;
        jenis_pekerjaan: string;
        satuan: string;
        volume: number;
        harga_material: number;
        harga_upah: number;
        total: number;
    }>;
}

// =============================================
// UTILS
// =============================================
const formatRupiah = (num: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num || 0);

const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
};

// =============================================
// ROLE CONFIG
// =============================================
const ROLE_ACCESS: Record<ApprovalType, string[]> = {
    RAB: ['BRANCH BUILDING COORDINATOR', 'BRANCH BUILDING & MAINTENANCE MANAGER'],
    SPK: ['BRANCH MANAGER'],
    IL:  ['BRANCH BUILDING COORDINATOR', 'BRANCH BUILDING & MAINTENANCE MANAGER'],
};

const ROLE_TO_JABATAN: Record<string, 'KOORDINATOR' | 'MANAGER'> = {
    'BRANCH BUILDING COORDINATOR':           'KOORDINATOR',
    'BRANCH BUILDING & MAINTENANCE MANAGER': 'MANAGER',
};

const APPROVAL_CONFIG: Record<ApprovalType, {
    label: string;
    icon: React.ReactNode;
    color: string;
    hoverBorder: string;
    badgeColor: string;
    description: string;
    emptyMsg: string;
}> = {
    RAB: {
        label: 'Approval RAB',
        icon: <FileText className="w-10 h-10" />,
        color: 'text-blue-700',
        hoverBorder: 'hover:border-blue-500',
        badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
        description: 'Rencana Anggaran Biaya yang menunggu persetujuan.',
        emptyMsg: 'Tidak ada pengajuan RAB yang menunggu persetujuan.',
    },
    SPK: {
        label: 'Approval SPK',
        icon: <ClipboardList className="w-10 h-10" />,
        color: 'text-purple-700',
        hoverBorder: 'hover:border-purple-500',
        badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
        description: 'Surat Perintah Kerja yang menunggu penandatanganan.',
        emptyMsg: 'Tidak ada pengajuan SPK yang menunggu persetujuan.',
    },
    IL: {
        label: 'Approval IL',
        icon: <Lightbulb className="w-10 h-10" />,
        color: 'text-amber-700',
        hoverBorder: 'hover:border-amber-500',
        badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
        description: 'Instruksi Lapangan yang menunggu persetujuan.',
        emptyMsg: 'Tidak ada pengajuan IL yang menunggu persetujuan.',
    },
};

const STATUS_BADGE_CLASS: Record<string, string> = {
    PENDING:             'bg-yellow-100 text-yellow-700 border-yellow-200',
    PENDING_KOORDINATOR: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    PENDING_MANAGER:     'bg-orange-100 text-orange-700 border-orange-200',
    PENDING_DIREKTUR:    'bg-red-100 text-red-700 border-red-200',
    APPROVED:            'bg-green-100 text-green-700 border-green-200',
    REJECTED:            'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABEL: Record<string, string> = {
    PENDING:             'PENDING',
    PENDING_KOORDINATOR: 'PENDING (KOORD.)',
    PENDING_MANAGER:     'PENDING (MGR.)',
    PENDING_DIREKTUR:    'PENDING (DIR.)',
    APPROVED:            'APPROVED',
    REJECTED:            'REJECTED',
};

// =============================================
// NORMALIZE HELPERS
// =============================================
const normalizeRABList = (items: RABListItem[]): NormalizedListItem[] =>
    items.map(r => ({
        id: r.id,
        tipe: 'RAB' as ApprovalType,
        nomor_ulok:    r.nomor_ulok ?? r.toko?.nomor_ulok ?? '-',
        nama_toko:     r.nama_toko  ?? r.toko?.nama_toko  ?? '-',
        cabang:        r.cabang     ?? r.toko?.cabang     ?? '-',
        status:        r.status,
        total_nilai:   parseCurrency(r.grand_total_final ?? r.grand_total),
        email_pembuat: r.email_pembuat,
        created_at:    r.created_at,
        _raw: r,
    }));

const normalizeSPKList = (items: SPKListItem[]): NormalizedListItem[] =>
    items.map(s => ({
        id: s.id,
        tipe: 'SPK' as ApprovalType,
        nomor_ulok:    s.nomor_ulok,
        nama_toko:     s.nama_toko,
        cabang:        s.cabang,
        status:        s.status,
        total_nilai:   parseCurrency(s.nilai_kontrak),
        email_pembuat: s.email_pembuat,
        created_at:    s.created_at,
        _raw: s,
    }));

const normalizeILList = (items: ILListItem[]): NormalizedListItem[] =>
    items.map(il => ({
        id: il.id,
        tipe: 'IL' as ApprovalType,
        nomor_ulok:    il.nomor_ulok,
        nama_toko:     il.nama_toko,
        cabang:        il.cabang,
        status:        il.status,
        total_nilai:   parseCurrency(il.grand_total_final ?? il.grand_total),
        email_pembuat: il.email_pembuat,
        created_at:    il.created_at,
        _raw: il,
    }));

// =============================================
// SUB-COMPONENTS
// =============================================
const ApprovalBadge = ({ status }: { status: string }) => {
    const upper = (status ?? '').toUpperCase();
    return (
        <Badge className={`${STATUS_BADGE_CLASS[upper] ?? 'bg-slate-100 text-slate-600'} font-semibold text-xs px-2 py-0.5 border`}>
            {STATUS_LABEL[upper] ?? status}
        </Badge>
    );
};

const ApprovalHistoryRow = ({ label, pemberi, waktu }: {
    label: string; pemberi?: string | null; waktu?: string | null;
}) => {
    if (!pemberi) return null;
    return (
        <div className="flex items-center gap-3 text-sm">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            <span className="text-slate-600 font-medium w-28">{label}</span>
            <span className="text-slate-800 font-semibold">{pemberi}</span>
            {waktu && <span className="text-slate-400 text-xs ml-1">{formatDate(waktu)}</span>}
        </div>
    );
};

// =============================================
// MAIN PAGE COMPONENT
// =============================================
export default function ApprovalPage() {
    const router = useRouter();

    // --- AUTH ---
    const [userInfo, setUserInfo]       = useState({ name: '', role: '', cabang: '', email: '' });
    const [accessibleTypes, setAccessibleTypes] = useState<ApprovalType[]>([]);
    const [jabatan, setJabatan]         = useState<'KOORDINATOR' | 'MANAGER' | null>(null);

    // --- NAVIGATION ---
    const [activeView, setActiveView]     = useState<ActiveView>('menu');
    const [selectedType, setSelectedType] = useState<ApprovalType | null>(null);

    // --- DATA ---
    const [listData, setListData]         = useState<NormalizedListItem[]>([]);
    const [selectedDetail, setSelectedDetail] = useState<NormalizedDetail | null>(null);
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('PENDING');
    const [searchQuery, setSearchQuery]   = useState('');

    // --- UI ---
    const [isLoading, setIsLoading]           = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [processingId, setProcessingId]     = useState<number | string | null>(null);
    const [rejectModal, setRejectModal]       = useState<NormalizedListItem | null>(null);
    const [rejectNote, setRejectNote]         = useState('');
    const [toast, setToast]                   = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // ==========================================
    // AUTH INIT
    // ==========================================
    useEffect(() => {
        const isAuth  = sessionStorage.getItem("authenticated");
        const role    = sessionStorage.getItem("userRole") || '';
        const email   = sessionStorage.getItem("loggedInUserEmail") || '';
        const cabang  = sessionStorage.getItem("loggedInUserCabang") || '';
        const namaLengkap = sessionStorage.getItem("nama_lengkap") || email.split('@')[0];

        if (isAuth !== "true" || !role) { router.push('/auth'); return; }

        const roleUpper = role.toUpperCase().trim();
        const types = (Object.keys(ROLE_ACCESS) as ApprovalType[]).filter(t =>
            ROLE_ACCESS[t].some(r => r.toUpperCase() === roleUpper)
        );

        if (types.length === 0) {
            alert("Role tidak memiliki akses ke halaman Approval.");
            router.push('/dashboard');
            return;
        }

        setUserInfo({ name: namaLengkap.toUpperCase(), role, cabang, email });
        setAccessibleTypes(types);
        setJabatan(ROLE_TO_JABATAN[roleUpper] ?? null);
    }, [router]);

    // ==========================================
    // SESSION STORAGE ANTI-REFRESH
    // ==========================================
    useEffect(() => {
        if (activeView === 'menu') {
            sessionStorage.removeItem('approval_lastView');
            sessionStorage.removeItem('approval_selectedType');
        } else {
            sessionStorage.setItem('approval_lastView', activeView);
            if (selectedType) sessionStorage.setItem('approval_selectedType', selectedType);
        }
    }, [activeView, selectedType]);

    // ==========================================
    // TOAST
    // ==========================================
    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ==========================================
    // LOAD LIST
    // ==========================================
    const loadList = async (type: ApprovalType) => {
        setIsLoading(true);
        setSearchQuery('');
        setFilterStatus('PENDING');
        try {
            let normalized: NormalizedListItem[] = [];
            if (type === 'RAB') {
                const res = await fetchRABList();
                normalized = normalizeRABList(res.data ?? []);
            } else if (type === 'SPK') {
                const res = await fetchSPKList();
                normalized = normalizeSPKList(res.data ?? []);
            } else if (type === 'IL') {
                const res = await fetchILList();
                normalized = normalizeILList(res.data ?? []);
            }
            setListData(normalized);
        } catch (err: any) {
            showToast(err.message || 'Gagal memuat data.', 'error');
            setListData([]);
        } finally {
            setIsLoading(false);
        }
    };

    // ==========================================
    // LOAD DETAIL
    // ==========================================
    const loadDetail = async (item: NormalizedListItem) => {
        setIsDetailLoading(true);
        setActiveView('detail');
        try {
            let detail: NormalizedDetail | null = null;

            if (item.tipe === 'RAB') {
                const res = await fetchRABDetail(item.id);
                const d = res.data;
                detail = {
                    id: d.rab.id,
                    tipe: 'RAB',
                    nomor_ulok:        d.toko.nomor_ulok,
                    nama_toko:         d.toko.nama_toko,
                    alamat:            d.toko.alamat,
                    cabang:            d.toko.cabang,
                    lingkup_pekerjaan: d.toko.lingkup_pekerjaan,
                    status:            d.rab.status,
                    total_nilai:       parseCurrency(d.rab.grand_total_final ?? d.rab.grand_total),
                    email_pembuat:     d.rab.email_pembuat,
                    created_at:        d.rab.created_at,
                    alasan_penolakan:  d.rab.alasan_penolakan,
                    link_pdf_gabungan: d.rab.link_pdf_gabungan,
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

            } else if (item.tipe === 'SPK') {
                const res = await fetchSPKDetail(item.id);
                const d = res.data;
                detail = {
                    id: d.spk.id,
                    tipe: 'SPK',
                    nomor_ulok:        d.spk.nomor_ulok,
                    nama_toko:         d.spk.nama_toko,
                    cabang:            d.spk.cabang,
                    lingkup_pekerjaan: d.spk.lingkup_pekerjaan,
                    status:            d.spk.status,
                    total_nilai:       parseCurrency(d.spk.nilai_kontrak),
                    email_pembuat:     d.spk.email_pembuat,
                    created_at:        d.spk.created_at,
                    alasan_penolakan:  d.spk.alasan_penolakan,
                    nama_kontraktor:   d.spk.nama_kontraktor,
                    masa_berlaku:      d.spk.masa_berlaku,
                    nilai_kontrak:     parseCurrency(d.spk.nilai_kontrak),
                    items: (d.items ?? []).map((it: SPKDetailItem) => ({
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

            } else if (item.tipe === 'IL') {
                const res = await fetchILDetail(item.id);
                const d = res.data;
                detail = {
                    id: d.il.id,
                    tipe: 'IL',
                    nomor_ulok:        d.il.nomor_ulok,
                    nama_toko:         d.il.nama_toko,
                    cabang:            d.il.cabang,
                    lingkup_pekerjaan: d.il.lingkup_pekerjaan,
                    status:            d.il.status,
                    total_nilai:       parseCurrency(d.il.grand_total_final ?? d.il.grand_total),
                    email_pembuat:     d.il.email_pembuat,
                    created_at:        d.il.created_at,
                    alasan_penolakan:  d.il.alasan_penolakan,
                    approval_koordinator: { pemberi: d.il.pemberi_persetujuan_koordinator ?? null, waktu: d.il.waktu_persetujuan_koordinator ?? null },
                    approval_manager:     { pemberi: d.il.pemberi_persetujuan_manager ?? null,     waktu: d.il.waktu_persetujuan_manager ?? null },
                    items: (d.items ?? []).map((it: ILDetailItem) => ({
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
            }

            setSelectedDetail(detail);
        } catch (err: any) {
            showToast(err.message || 'Gagal memuat detail.', 'error');
            setActiveView('list');
        } finally {
            setIsDetailLoading(false);
        }
    };

    // ==========================================
    // APPROVE
    // ==========================================
    const handleApprove = async (item: NormalizedListItem | NormalizedDetail) => {
        setProcessingId(item.id);
        try {
            if (item.tipe === 'RAB') {
                await processRABApproval(item.id as number, {
                    approver_email: userInfo.email,
                    jabatan:        jabatan ?? 'KOORDINATOR',
                    tindakan:       'APPROVE',
                });
            } else if (item.tipe === 'SPK') {
                await processSPKApproval(item.id as number, {
                    approver_email: userInfo.email,
                    tindakan:       'APPROVE',
                });
            } else if (item.tipe === 'IL') {
                await processILApproval(item.id as number, {
                    approver_email: userInfo.email,
                    jabatan:        jabatan ?? 'KOORDINATOR',
                    tindakan:       'APPROVE',
                });
            }
            setListData(prev => prev.map(d => d.id === item.id ? { ...d, status: 'APPROVED' } : d));
            if (selectedDetail?.id === item.id) setSelectedDetail(prev => prev ? { ...prev, status: 'APPROVED' } : null);
            showToast(`${APPROVAL_CONFIG[item.tipe].label} berhasil di-approve!`, 'success');
        } catch (err: any) {
            showToast(err.message || 'Gagal melakukan approval.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    // ==========================================
    // REJECT
    // ==========================================
    const openRejectModal = (item: NormalizedListItem) => {
        setRejectNote('');
        setRejectModal(item);
    };

    const handleReject = async () => {
        if (!rejectModal) return;
        if (!rejectNote.trim()) { showToast('Harap isi alasan penolakan.', 'error'); return; }
        const item = rejectModal;
        setRejectModal(null);
        setProcessingId(item.id);
        try {
            if (item.tipe === 'RAB') {
                await processRABApproval(item.id as number, {
                    approver_email:   userInfo.email,
                    jabatan:          jabatan ?? 'KOORDINATOR',
                    tindakan:         'REJECT',
                    alasan_penolakan: rejectNote,
                });
            } else if (item.tipe === 'SPK') {
                await processSPKApproval(item.id as number, {
                    approver_email:   userInfo.email,
                    tindakan:         'REJECT',
                    alasan_penolakan: rejectNote,
                });
            } else if (item.tipe === 'IL') {
                await processILApproval(item.id as number, {
                    approver_email:   userInfo.email,
                    jabatan:          jabatan ?? 'KOORDINATOR',
                    tindakan:         'REJECT',
                    alasan_penolakan: rejectNote,
                });
            }
            setListData(prev => prev.map(d => d.id === item.id ? { ...d, status: 'REJECTED' } : d));
            if (selectedDetail?.id === item.id) setSelectedDetail(prev => prev ? { ...prev, status: 'REJECTED' } : null);
            showToast('Pengajuan berhasil ditolak.', 'success');
        } catch (err: any) {
            showToast(err.message || 'Gagal menolak pengajuan.', 'error');
        } finally {
            setProcessingId(null);
            setRejectNote('');
        }
    };

    // ==========================================
    // PDF DOWNLOAD (RAB)
    // ==========================================
    const handleDownloadPDF = async (id: number) => {
        setProcessingId(`pdf-${id}`);
        try {
            await downloadRABPdf(id);
            showToast('PDF berhasil diunduh.', 'success');
        } catch (err: any) {
            showToast(err.message || 'Gagal mengunduh PDF.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    // ==========================================
    // NAVIGATION
    // ==========================================
    const handleSelectType = (type: ApprovalType) => {
        setSelectedType(type);
        setSelectedDetail(null);
        setActiveView('list');
        loadList(type);
    };

    const handleBackToMenu = () => {
        setActiveView('menu');
        setSelectedType(null);
        setListData([]);
        setSelectedDetail(null);
    };

    const handleBackToList = () => {
        setActiveView('list');
        setSelectedDetail(null);
    };

    // ==========================================
    // COMPUTED: FILTERED LIST
    // ==========================================

    /**
     * Menentukan apakah sebuah item bisa di-action oleh role yang sedang login.
     * - KOORDINATOR  → hanya PENDING_KOORDINATOR
     * - MANAGER (RAB/IL) → hanya PENDING_MANAGER
     * - BRANCH MANAGER (SPK) → status PENDING apapun (satu level approval)
     */
    const isActionableByRole = (status: string, tipe: ApprovalType): boolean => {
        const upper = (status ?? '').toUpperCase();
        if (tipe === 'SPK') {
            // SPK hanya punya satu level approval (Branch Manager)
            return upper.startsWith('PENDING');
        }
        // RAB & IL — multi-level: cocokkan jabatan login ke status spesifik
        if (jabatan === 'KOORDINATOR') return upper === 'PENDING_KOORDINATOR';
        if (jabatan === 'MANAGER')     return upper === 'PENDING_MANAGER';
        // Fallback jika jabatan belum di-set
        return upper.startsWith('PENDING');
    };

    const filteredList = useMemo(() => listData.filter(item => {
        let matchStatus = true;
        if (filterStatus === 'PENDING') {
            // Tab "Pending" hanya tampilkan item yang memang giliran role ini
            matchStatus = isActionableByRole(item.status, item.tipe);
        } else if (filterStatus === 'APPROVED') {
            matchStatus = item.status.toUpperCase() === 'APPROVED';
        } else if (filterStatus === 'REJECTED') {
            matchStatus = item.status.toUpperCase() === 'REJECTED';
        }
        // filterStatus === 'ALL' → matchStatus tetap true, tampilkan semua

        const q = searchQuery.toLowerCase();
        const matchSearch = !q
            || item.nama_toko.toLowerCase().includes(q)
            || item.nomor_ulok.toLowerCase().includes(q)
            || item.email_pembuat.toLowerCase().includes(q);

        return matchStatus && matchSearch;
    }), [listData, filterStatus, searchQuery, jabatan]);

    // Hitung hanya item yang memang giliran role ini (bukan semua PENDING_*)
    const pendingCount = useMemo(
        () => listData.filter(i => isActionableByRole(i.status, i.tipe)).length,
        [listData, jabatan]
    );

    // Tombol approve/tolak hanya muncul jika item memang giliran role ini
    const canActOnDetail = selectedDetail && isActionableByRole(selectedDetail.status, selectedDetail.tipe);

    // Helper: buat NormalizedListItem dari detail untuk dikirim ke openRejectModal
    const detailAsListItem: NormalizedListItem | null = selectedDetail ? {
        id: selectedDetail.id, tipe: selectedDetail.tipe,
        nomor_ulok: selectedDetail.nomor_ulok, nama_toko: selectedDetail.nama_toko,
        cabang: selectedDetail.cabang, status: selectedDetail.status,
        total_nilai: selectedDetail.total_nilai, email_pembuat: selectedDetail.email_pembuat,
        created_at: selectedDetail.created_at, _raw: {} as any
    } : null;

    // ==========================================
    // RENDER
    // ==========================================
    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">

            {/* TOAST */}
            {toast && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-semibold animate-in slide-in-from-top-2 duration-300 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                    {toast.msg}
                </div>
            )}

            {/* REJECT MODAL */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Tolak Pengajuan {rejectModal.tipe}</h3>
                                <p className="text-xs text-slate-500">{rejectModal.nama_toko} — ULOK {rejectModal.nomor_ulok}</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">Harap isi alasan penolakan. Alasan ini akan tercatat dan dikirim ke pengaju.</p>
                        <textarea
                            className="w-full border border-slate-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                            rows={4}
                            placeholder="Tulis alasan penolakan..."
                            value={rejectNote}
                            onChange={e => setRejectNote(e.target.value)}
                            autoFocus
                        />
                        <div className="flex gap-3 mt-4">
                            <Button variant="outline" className="flex-1" onClick={() => setRejectModal(null)}>Batal</Button>
                            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleReject}>
                                Konfirmasi Tolak
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <AppNavbar
                title={selectedType ? `Approval ${APPROVAL_CONFIG[selectedType].label}` : 'Approval Dokumen'}
                showBackButton
                backHref="/dashboard"
                rightActions={
                    <div className="flex items-center gap-2">
                        {selectedType && pendingCount > 0 && activeView === 'list' && (
                            <Badge className="bg-yellow-400 text-yellow-900 border-0 font-bold text-xs px-2.5">
                                {pendingCount} Pending
                            </Badge>
                        )}
                        <Badge variant="outline" className="bg-black/10 text-white border-white/30 px-3 py-1 md:py-1.5 shadow-sm backdrop-blur-sm text-[10px] md:text-xs font-semibold hidden md:flex">
                            {userInfo.role || 'LOADING...'}
                        </Badge>
                    </div>
                }
            />

            <main className="max-w-350 mx-auto p-4 md:p-8 mt-4">

                {/* ===== VIEW 0: MENU ===== */}
                {activeView === 'menu' && (
                    <div className="flex flex-col items-center mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-extrabold text-slate-800">Approval Center</h2>
                            <p className="text-slate-500 text-sm mt-1">Pilih jenis dokumen yang ingin Anda setujui</p>
                        </div>
                        <div className={`grid grid-cols-1 gap-6 w-full px-4 ${accessibleTypes.length === 1 ? 'max-w-sm' : accessibleTypes.length === 2 ? 'md:grid-cols-2 max-w-2xl' : 'md:grid-cols-3 max-w-3xl'}`}>
                            {accessibleTypes.map(type => {
                                const cfg = APPROVAL_CONFIG[type];
                                return (
                                    <Card
                                        key={type}
                                        className={`hover:shadow-lg cursor-pointer transition-all border-2 border-transparent ${cfg.hoverBorder} group`}
                                        onClick={() => handleSelectType(type)}
                                    >
                                        <CardContent className="p-10 flex flex-col items-center text-center gap-4">
                                            <div className={`${cfg.color} transition-transform group-hover:scale-110 duration-200`}>
                                                {cfg.icon}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-xl text-slate-800">{cfg.label}</h3>
                                                <p className="text-sm text-slate-500 mt-1">{cfg.description}</p>
                                            </div>
                                            <Badge className={`${cfg.badgeColor} text-xs font-semibold border`}>{type}</Badge>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ===== VIEW 1: LIST ===== */}
                {activeView === 'list' && selectedType && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <div className="flex items-center gap-4">
                                <Button variant="outline" className="h-10" onClick={handleBackToMenu}>
                                    <ArrowLeft className="w-4 h-4 mr-2" /> Menu Utama
                                </Button>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">{APPROVAL_CONFIG[selectedType].label}</h2>
                                    <p className="text-sm text-slate-500">Daftar pengajuan yang memerlukan tindakan Anda</p>
                                </div>
                            </div>
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Cari toko / ULOK / email..."
                                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex bg-slate-200 p-1 rounded-lg w-fit mb-6">
                            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setFilterStatus(s)}
                                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${filterStatus === s ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:bg-slate-300'}`}
                                >
                                    {s === 'ALL' ? 'Semua' : s === 'PENDING' ? 'Pending' : s === 'APPROVED' ? 'Approved' : 'Ditolak'}
                                    {s === 'PENDING' && pendingCount > 0 && (
                                        <span className="ml-1.5 bg-yellow-400 text-yellow-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {isLoading ? (
                            <div className="py-24 text-center text-slate-500">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-red-500" />
                                Memuat data...
                            </div>
                        ) : filteredList.length === 0 ? (
                            <div className="py-20 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-5xl mb-3">📭</div>
                                <h3 className="text-slate-500 font-medium">
                                    {listData.length === 0 ? APPROVAL_CONFIG[selectedType].emptyMsg : 'Tidak ada data yang cocok dengan filter.'}
                                </h3>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                                            <tr>
                                                <th className="p-3 border-r font-semibold">No. ULOK</th>
                                                <th className="p-3 border-r font-semibold min-w-50">Nama Toko</th>
                                                <th className="p-3 border-r font-semibold">Pengaju</th>
                                                <th className="p-3 border-r font-semibold text-center whitespace-nowrap">Tgl Pengajuan</th>
                                                <th className="p-3 border-r font-semibold text-right">Total Nilai</th>
                                                <th className="p-3 border-r font-semibold text-center">Status</th>
                                                <th className="p-3 font-semibold text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredList.map(item => (
                                                <tr
                                                    key={item.id}
                                                    className={`transition-colors ${isActionableByRole(item.status, item.tipe) ? 'hover:bg-yellow-50/40' : item.status.toUpperCase() === 'APPROVED' ? 'bg-green-50/20 hover:bg-green-50/40' : 'bg-red-50/20 hover:bg-red-50/40'}`}
                                                >
                                                    <td className="p-3 font-bold text-slate-700 border-r">{item.nomor_ulok}</td>
                                                    <td className="p-3 border-r">
                                                        <p className="font-semibold text-slate-800">{item.nama_toko}</p>
                                                        <p className="text-xs text-slate-400 mt-0.5">{item.cabang}</p>
                                                    </td>
                                                    <td className="p-3 border-r text-slate-600 text-xs">{item.email_pembuat}</td>
                                                    <td className="p-3 border-r text-center text-xs text-slate-600 whitespace-nowrap">{formatDate(item.created_at)}</td>
                                                    <td className="p-3 border-r text-right font-bold text-slate-800">{formatRupiah(item.total_nilai)}</td>
                                                    <td className="p-3 border-r text-center"><ApprovalBadge status={item.status} /></td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
                                                                onClick={() => loadDetail(item)}
                                                            >
                                                                <Eye className="w-3.5 h-3.5 mr-1" /> Detail
                                                            </Button>
                                                            {isActionableByRole(item.status, item.tipe) && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                                                                        disabled={processingId === item.id}
                                                                        onClick={() => handleApprove(item)}
                                                                    >
                                                                        {processingId === item.id
                                                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                            : <><CheckCircle className="w-3.5 h-3.5 mr-1" />Approve</>
                                                                        }
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                                                        disabled={processingId === item.id}
                                                                        onClick={() => openRejectModal(item)}
                                                                    >
                                                                        <XCircle className="w-3.5 h-3.5 mr-1" />Tolak
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ===== VIEW 2: DETAIL ===== */}
                {activeView === 'detail' && selectedType && (
                    <div className="animate-in zoom-in-95 duration-300">

                        {/* Nav atas */}
                        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
                            <Button variant="ghost" className="text-slate-500 hover:text-slate-800 px-0" onClick={handleBackToList}>
                                <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Daftar
                            </Button>
                            <div className="flex items-center gap-3 flex-wrap">
                                {selectedDetail?.tipe === 'RAB' && (
                                    <Button
                                        variant="outline"
                                        className="border-blue-600 text-blue-700 hover:bg-blue-50 font-bold"
                                        disabled={processingId === `pdf-${selectedDetail.id}`}
                                        onClick={() => handleDownloadPDF(selectedDetail.id as number)}
                                    >
                                        {processingId === `pdf-${selectedDetail.id}`
                                            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            : <FileDown className="w-4 h-4 mr-2" />
                                        }
                                        {processingId === `pdf-${selectedDetail.id}` ? 'Menyiapkan PDF...' : 'Download RAB (PDF)'}
                                    </Button>
                                )}
                                {canActOnDetail && detailAsListItem && (
                                    <>
                                        <Button
                                            variant="outline"
                                            className="border-red-200 text-red-600 hover:bg-red-50 font-bold"
                                            disabled={!!processingId}
                                            onClick={() => openRejectModal(detailAsListItem)}
                                        >
                                            <XCircle className="w-4 h-4 mr-2" /> Tolak
                                        </Button>
                                        <Button
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold"
                                            disabled={!!processingId}
                                            onClick={() => handleApprove(selectedDetail!)}
                                        >
                                            {processingId === selectedDetail!.id
                                                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                : <CheckCircle className="w-4 h-4 mr-2" />
                                            }
                                            Approve Sekarang
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {isDetailLoading ? (
                            <div className="py-24 text-center text-slate-500">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-red-500" />
                                Memuat detail...
                            </div>
                        ) : selectedDetail ? (
                            <>
                                {/* Info Card */}
                                <Card className="mb-6 shadow-sm border-slate-200 bg-slate-50">
                                    <CardContent className="p-6 rounded-xl">
                                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                    <h2 className="text-xl font-bold text-slate-800">{selectedDetail.nama_toko}</h2>
                                                    <ApprovalBadge status={selectedDetail.status} />
                                                </div>
                                                {selectedDetail.alamat && (
                                                    <p className="text-sm text-slate-500 mb-2">{selectedDetail.alamat}</p>
                                                )}
                                                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                                                    <span className="flex items-center gap-1.5">
                                                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                        ULOK: <b>{selectedDetail.nomor_ulok}</b>
                                                    </span>
                                                    {selectedDetail.lingkup_pekerjaan && (
                                                        <span className="flex items-center gap-1.5">
                                                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                                                            Lingkup: <b>{selectedDetail.lingkup_pekerjaan}</b>
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1.5">
                                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                                        Pengaju: <b>{selectedDetail.email_pembuat}</b>
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                                        Tgl Pengajuan: <b>{formatDate(selectedDetail.created_at)}</b>
                                                    </span>
                                                    {selectedDetail.nama_kontraktor && (
                                                        <span className="flex items-center gap-1.5">
                                                            <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                                                            Kontraktor: <b>{selectedDetail.nama_kontraktor}</b>
                                                        </span>
                                                    )}
                                                    {selectedDetail.masa_berlaku && (
                                                        <span className="flex items-center gap-1.5">
                                                            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                                            Masa Berlaku: <b>{formatDate(selectedDetail.masa_berlaku)}</b>
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Alasan penolakan */}
                                                {selectedDetail.alasan_penolakan && (
                                                    <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex gap-2">
                                                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                        <span><b>Alasan Penolakan:</b> {selectedDetail.alasan_penolakan}</span>
                                                    </div>
                                                )}

                                                {/* Riwayat approval */}
                                                {(selectedDetail.approval_koordinator?.pemberi || selectedDetail.approval_manager?.pemberi || selectedDetail.approval_direktur?.pemberi) && (
                                                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Riwayat Persetujuan</p>
                                                        <ApprovalHistoryRow label="Koordinator" pemberi={selectedDetail.approval_koordinator?.pemberi} waktu={selectedDetail.approval_koordinator?.waktu} />
                                                        <ApprovalHistoryRow label="Manager" pemberi={selectedDetail.approval_manager?.pemberi} waktu={selectedDetail.approval_manager?.waktu} />
                                                        <ApprovalHistoryRow label="Direktur" pemberi={selectedDetail.approval_direktur?.pemberi} waktu={selectedDetail.approval_direktur?.waktu} />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Total */}
                                            <div className="text-right shrink-0">
                                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Nilai</p>
                                                <p className="text-3xl font-extrabold text-slate-800">{formatRupiah(selectedDetail.total_nilai)}</p>
                                                <Badge className={`mt-2 ${APPROVAL_CONFIG[selectedDetail.tipe].badgeColor} font-semibold border`}>
                                                    {APPROVAL_CONFIG[selectedDetail.tipe].label}
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Tabel Rincian */}
                                {selectedDetail.items.length > 0 ? (
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                                        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                                            <h3 className="font-bold text-slate-700 text-sm">Rincian Pekerjaan</h3>
                                            <span className="text-xs text-slate-400">{selectedDetail.items.length} item</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left border-collapse">
                                                <thead className="bg-slate-100 text-slate-700 border-b">
                                                    <tr>
                                                        <th className="p-3 border-r font-semibold">Kategori</th>
                                                        <th className="p-3 border-r font-semibold min-w-50">Jenis Pekerjaan</th>
                                                        <th className="p-3 border-r font-semibold text-center">Vol</th>
                                                        <th className="p-3 border-r font-semibold text-center">Sat</th>
                                                        <th className="p-3 border-r font-semibold text-right">Hrg Material</th>
                                                        <th className="p-3 border-r font-semibold text-right">Hrg Upah</th>
                                                        <th className="p-3 font-semibold text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {selectedDetail.items.map(row => (
                                                        <tr key={row.id} className="hover:bg-slate-50">
                                                            <td className="p-3 font-semibold text-slate-600 border-r text-xs">{row.kategori}</td>
                                                            <td className="p-3 text-slate-800 border-r">{row.jenis_pekerjaan}</td>
                                                            <td className="p-3 text-center font-bold border-r">{row.volume}</td>
                                                            <td className="p-3 text-center text-slate-500 border-r">{row.satuan}</td>
                                                            <td className="p-3 text-right text-slate-500 border-r">{formatRupiah(row.harga_material)}</td>
                                                            <td className="p-3 text-right text-slate-500 border-r">{formatRupiah(row.harga_upah)}</td>
                                                            <td className="p-3 text-right font-bold text-slate-800">{formatRupiah(row.total)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-slate-100 border-t border-slate-300">
                                                    <tr>
                                                        <td colSpan={6} className="p-3 font-bold text-slate-700 text-right">GRAND TOTAL</td>
                                                        <td className="p-3 font-extrabold text-slate-800 text-right">
                                                            {formatRupiah(selectedDetail.items.reduce((s, r) => s + (r.total ?? 0), 0))}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-10 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-sm mb-6">
                                        Tidak ada rincian item tersedia.
                                    </div>
                                )}

                                {/* Sticky bottom bar */}
                                {canActOnDetail && detailAsListItem && (
                                    <div className="sticky bottom-6 flex justify-center">
                                        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl px-6 py-4 flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-300">
                                            <span className="text-sm text-slate-600 font-medium hidden md:block">Ambil tindakan pada pengajuan ini:</span>
                                            <Button
                                                variant="outline"
                                                className="border-red-200 text-red-600 hover:bg-red-50 font-bold px-6"
                                                disabled={!!processingId}
                                                onClick={() => openRejectModal(detailAsListItem)}
                                            >
                                                <XCircle className="w-4 h-4 mr-2" /> Tolak
                                            </Button>
                                            <Button
                                                className="bg-green-600 hover:bg-green-700 text-white font-bold px-8"
                                                disabled={!!processingId}
                                                onClick={() => handleApprove(selectedDetail)}
                                            >
                                                {processingId === selectedDetail.id
                                                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    : <CheckCircle className="w-4 h-4 mr-2" />
                                                }
                                                Approve
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                )}

            </main>
        </div>
    );
}