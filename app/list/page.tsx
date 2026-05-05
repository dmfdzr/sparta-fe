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
    RefreshCw, AlertTriangle, Download, FilePlus, CheckSquare,
    ClipboardList,
} from 'lucide-react';

import {
    fetchRABList, fetchRABDetail, downloadRABPdf,
    type RABListItem, type RABDetailItem, type RABDetailResponse,
    fetchSPKList, fetchSPKDetail, downloadSPKPdf,
    type SPKListItem, type SPKDetailResponse,
    fetchPertambahanSPKList, fetchPertambahanSPKDetail,
    type PertambahanSPKListItem,
    fetchOpnameFinalList, fetchOpnameFinalDetail, downloadOpnameFinalPdf,
    fetchPengawasanList, fetchPengawasanDetail,
    updateRABStatus, fetchBerkasSerahTerimaList,
    fetchInstruksiLapanganList, fetchInstruksiLapanganDetail, downloadInstruksiLapanganPdf,
} from '@/lib/api';
import { parseCurrency, formatRupiah } from '@/lib/utils';
import { BRANCH_GROUPS, BRANCH_TO_ULOK } from '@/lib/constants';

// =============================================================================
// TYPES
// =============================================================================
type DokumenKategori = 'RAB' | 'SPK' | 'PERTAMBAHAN_SPK' | 'OPNAME_FINAL' | 'PENGAWASAN' | 'BERKAS_SERAH_TERIMA' | 'INSTRUKSI_LAPANGAN';
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
    // Pertambahan SPK specific
    pertambahan_hari?: string;
    alasan_perpanjangan?: string;
    tanggal_spk_akhir?: string;
    tanggal_spk_akhir_setelah_perpanjangan?: string;
    status_persetujuan?: string;
    dibuat_oleh?: string;
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
    id_toko?: number;
    // RAB specific
    alamat?: string;
    lingkup_pekerjaan?: string;
    nama_pt?: string;
    durasi_pekerjaan?: string;
    kategori_lokasi?: string;
    grand_total?: string;
    grand_total_non_sbo?: string;
    grand_total_final?: string;
    link_pdf?: string | null;
    link_pdf_gabungan?: string | null;
    link_pdf_non_sbo?: string | null;
    link_pdf_rekapitulasi?: string | null;
    link_lampiran_pendukung?: string | null;
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
        catatan?: string | null;
    }>;
    // SPK specific
    nomor_spk?: string;
    nama_kontraktor?: string;
    durasi?: number;
    waktu_mulai?: string;
    waktu_selesai?: string;
    terbilang?: string;
    par?: string;
    alasan_penolakan?: string | null;
    approver_email?: string | null;
    waktu_persetujuan?: string | null;
    approval_logs?: Array<{
        approver_email: string;
        tindakan: string;
        alasan_penolakan: string | null;
        waktu_tindakan: string;
    }>;
    // Pertambahan SPK specific
    pertambahan_hari?: string;
    alasan_perpanjangan?: string;
    tanggal_spk_akhir?: string;
    tanggal_spk_akhir_setelah_perpanjangan?: string;
    disetujui_oleh?: string;
    waktu_persetujuan_detail?: string;
    // Opname Final specific
    grand_total_opname?: string;
    grand_total_rab?: string;
    // Pengawasan specific
    id_gantt?: number;
    id_pengawasan_gantt?: number;
    kategori_pekerjaan?: string;
    jenis_pekerjaan?: string;
    catatan?: string | null;
    dokumentasi?: string | null;
    link_pdf_pengawasan?: string | null;
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
    PERTAMBAHAN_SPK: {
        label: 'Pertambahan SPK',
        fullLabel: 'Pertambahan Hari SPK',
        icon: <FilePlus className="w-10 h-10" />,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        hoverBorder: 'hover:border-emerald-400',
        badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        description: 'Daftar pengajuan perpanjangan hari SPK.',
    },
    OPNAME_FINAL: {
        label: 'Opname Final',
        fullLabel: 'Opname Final',
        icon: <CheckSquare className="w-10 h-10" />,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        hoverBorder: 'hover:border-orange-400',
        badgeColor: 'bg-orange-100 text-orange-700 border-orange-200',
        description: 'Daftar dokumen Opname Final.',
    },
    PENGAWASAN: {
        label: 'Pengawasan',
        fullLabel: 'Pengawasan',
        icon: <Eye className="w-10 h-10" />,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        hoverBorder: 'hover:border-indigo-400',
        badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        description: 'Daftar dokumen memo pengawasan.',
    },
    BERKAS_SERAH_TERIMA: {
        label: 'Serah Terima',
        fullLabel: 'Serah Terima',
        icon: <CheckCircle className="w-10 h-10" />,
        color: 'text-teal-600',
        bgColor: 'bg-teal-50',
        borderColor: 'border-teal-200',
        hoverBorder: 'hover:border-teal-400',
        badgeColor: 'bg-teal-100 text-teal-700 border-teal-200',
        description: 'Daftar dokumen serah terima toko.',
    },
    INSTRUKSI_LAPANGAN: {
        label: 'Instruksi Lap.',
        fullLabel: 'Instruksi Lapangan',
        icon: <ClipboardList className="w-10 h-10" />,
        color: 'text-pink-600',
        bgColor: 'bg-pink-50',
        borderColor: 'border-pink-200',
        hoverBorder: 'hover:border-pink-400',
        badgeColor: 'bg-pink-100 text-pink-700 border-pink-200',
        description: 'Daftar dokumen instruksi lapangan.',
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
    'MENUNGGU PERSETUJUAN':              'bg-yellow-100 text-yellow-700 border-yellow-200',
    'DISETUJUI BM':                      'bg-green-100 text-green-700 border-green-200',
    'DITOLAK BM':                        'bg-red-100 text-red-700 border-red-200',
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
    if (upper.includes('TOLAK') || upper.includes('REJECTED')) {
        return 'bg-red-100 text-red-700 border-red-200';
    }
    if (upper.includes('SETUJUI') || upper.includes('APPROVED')) {
        return 'bg-green-100 text-green-700 border-green-200';
    }
    if (upper.includes('PENDING') || upper.includes('MENUNGGU') || upper.includes('WAITING')) {
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
    return STATUS_BADGE[upper] ?? 'bg-slate-100 text-slate-600 border-slate-200';
};

const getStatusLabel = (status: string) => {
    if (!status) return '-';
    const upper = status.toUpperCase();
    
    if (upper.includes('TOLAK') || upper === 'REJECTED' || upper === 'SPK_REJECTED') {
        if (upper.includes('KOORDINATOR')) return 'Ditolak Koord.';
        if (upper.includes('MANAGER') || upper.includes('MANAJER')) return 'Ditolak Mgr.';
        if (upper.includes('DIREKTUR')) return 'Ditolak Dir.';
        return 'Rejected';
    }

    if (upper.includes('DISETUJUI') || upper === 'APPROVED' || upper === 'SPK_APPROVED') return 'Approved';

    if (upper.includes('KOORDINATOR')) return 'Pending Koord.';
    if (upper.includes('MANAGER') || upper.includes('MANAJER')) return 'Pending Mgr.';
    if (upper.includes('DIREKTUR')) return 'Pending Dir.';
    if (upper === 'WAITING_FOR_BM_APPROVAL' || upper === 'MENUNGGU PERSETUJUAN') return 'Pending BM';
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

const normalizePertambahanSPKDocs = (items: PertambahanSPKListItem[]): NormalizedDoc[] =>
    items.map(p => ({
        id: p.id,
        tipe: 'PERTAMBAHAN_SPK' as DokumenKategori,
        nomor_ulok:    p.nomor_spk || p.toko?.nomor_ulok || p.spk?.nomor_ulok || '-',
        nama_toko:     p.toko?.nama_toko || p.spk?.nama_toko || '-',
        cabang:        p.toko?.cabang || p.spk?.cabang || '',
        proyek:        p.toko?.proyek || p.spk?.proyek || '-',
        status:        p.status_persetujuan,
        email_pembuat: p.dibuat_oleh,
        total_nilai:   0,
        created_at:    p.created_at,
        link_pdf:      p.link_pdf ?? null,
        pertambahan_hari: p.pertambahan_hari,
        alasan_perpanjangan: p.alasan_perpanjangan,
        tanggal_spk_akhir: p.tanggal_spk_akhir,
        tanggal_spk_akhir_setelah_perpanjangan: p.tanggal_spk_akhir_setelah_perpanjangan,
        status_persetujuan: p.status_persetujuan,
        dibuat_oleh: p.dibuat_oleh,
    }));

const normalizeOpnameFinalDocs = (items: any[]): NormalizedDoc[] =>
    items.map(o => ({
        id: o.id,
        tipe: 'OPNAME_FINAL' as DokumenKategori,
        nomor_ulok:    o.nomor_ulok    ?? o.toko?.nomor_ulok ?? '-',
        nama_toko:     o.nama_toko     ?? o.toko?.nama_toko  ?? '-',
        cabang:        o.cabang        ?? o.toko?.cabang     ?? '-',
        proyek:        o.proyek        ?? o.toko?.proyek     ?? '-',
        status:        o.status_opname_final,
        email_pembuat: o.email_pembuat,
        total_nilai:   parseCurrency(o.grand_total_opname),
        created_at:    o.created_at,
        link_pdf:      o.link_pdf_opname ?? null,
    }));

const normalizePengawasanDocs = (items: any[]): NormalizedDoc[] =>
    items.map(p => ({
        id: p.id,
        tipe: 'PENGAWASAN' as DokumenKategori,
        nomor_ulok:    '-',
        nama_toko:     p.kategori_pekerjaan ? `${p.kategori_pekerjaan} - ${p.jenis_pekerjaan}` : '-',
        cabang:        '-',
        proyek:        '-',
        status:        p.status,
        email_pembuat: '-',
        total_nilai:   0,
        created_at:    p.created_at,
        link_pdf:      p.berkas_pengawasan?.link_pdf_pengawasan ?? null,
    }));

const normalizeBerkasSerahTerimaDocs = (items: any[]): NormalizedDoc[] =>
    items.map(b => ({
        id: b.id,
        tipe: 'BERKAS_SERAH_TERIMA' as DokumenKategori,
        nomor_ulok:    b.toko?.nomor_ulok ?? '-',
        nama_toko:     b.toko?.nama_toko  ?? '-',
        cabang:        b.toko?.cabang     ?? '-',
        proyek:        b.toko?.proyek     ?? '-',
        status:        'SELESAI',
        email_pembuat: '-',
        total_nilai:   0,
        created_at:    b.created_at,
        link_pdf:      b.link_pdf ?? null,
    }));

const normalizeInstruksiLapanganDocs = (items: any[]): NormalizedDoc[] =>
    items.map(i => ({
        id: i.id,
        tipe: 'INSTRUKSI_LAPANGAN' as DokumenKategori,
        nomor_ulok:    i.nomor_ulok ?? '-',
        nama_toko:     i.nama_toko  ?? '-',
        cabang:        i.cabang     ?? '-',
        proyek:        i.proyek     ?? '-',
        status:        i.status,
        email_pembuat: i.email_pembuat ?? '-',
        total_nilai:   0,
        created_at:    i.created_at ?? i.timestamp ?? '-',
        link_pdf:      null,
    }));

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function DaftarDokumenPage() {
    const router = useRouter();

    // --- Auth ---
    const [userInfo, setUserInfo] = useState({ name: '', role: '', cabang: '', email: '', nama_pt: '' });
    const [isContractor, setIsContractor] = useState(false);
    const [isDirektur, setIsDirektur] = useState(false);

    // --- Navigation ---
    const [activeView, setActiveView] = useState<ActiveView>('menu');
    const [selectedKategori, setSelectedKategori] = useState<DokumenKategori | null>(null);

    // --- Data ---
    const [listData, setListData] = useState<NormalizedDoc[]>([]);
    const [selectedDetail, setSelectedDetail] = useState<NormalizedDetail | null>(null);

    // --- Filters ---
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [cabangFilter, setCabangFilter] = useState('');

    // --- UI ---
    const [isLoading, setIsLoading] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // --- RAB Status Update (HO only) ---
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedNewStatus, setSelectedNewStatus] = useState('');
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // =========================================================================
    // AUTH + INIT
    // =========================================================================
    useEffect(() => {
        const isAuth  = sessionStorage.getItem("authenticated");
        const role    = sessionStorage.getItem("userRole") || '';
        const email   = sessionStorage.getItem("loggedInUserEmail") || '';
        const cabang  = sessionStorage.getItem("loggedInUserCabang") || '';
        const namaLengkap = sessionStorage.getItem("nama_lengkap") || email.split('@')[0];

        const nama_pt = sessionStorage.getItem("nama_pt") || '';

        if (isAuth !== "true" || !role) { router.push('/auth'); return; }

        const roles = role.split(',').map(r => r.trim().toUpperCase());
        const contractorFlag = roles.some(r => r.includes('KONTRAKTOR'));
        const direkturFlag = roles.some(r => r.includes('DIREKTUR'));
        setIsContractor(contractorFlag);
        setIsDirektur(direkturFlag);
        setUserInfo({ name: namaLengkap.toUpperCase(), role, cabang, email, nama_pt });
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
        setCabangFilter('');
        try {
            let docs: NormalizedDoc[] = [];
            if (kategori === 'RAB') {
                let filters: any = undefined;
                // Read directly from sessionStorage to avoid stale closure
                const sessionRole = (sessionStorage.getItem('userRole') || '').toUpperCase();
                const sessionNamaPt = sessionStorage.getItem('nama_pt') || '';
                const isKontraktorOrDirektur = sessionRole.includes('KONTRAKTOR') || sessionRole.includes('DIREKTUR');
                if (isKontraktorOrDirektur && sessionNamaPt) {
                    filters = { nama_pt: sessionNamaPt };
                }
                const res = await fetchRABList(filters);
                docs = normalizeRABDocs(res.data ?? []);
            } else if (kategori === 'SPK') {
                const res = await fetchSPKList();
                docs = normalizeSPKDocs(res.data ?? []);
            } else if (kategori === 'PERTAMBAHAN_SPK') {
                const res = await fetchPertambahanSPKList();
                docs = normalizePertambahanSPKDocs(res.data ?? []);
            } else if (kategori === 'OPNAME_FINAL') {
                const res = await fetchOpnameFinalList();
                docs = normalizeOpnameFinalDocs(res.data ?? []);
            } else if (kategori === 'PENGAWASAN') {
                const res = await fetchPengawasanList();
                docs = normalizePengawasanDocs(res.data ?? []);
            } else if (kategori === 'BERKAS_SERAH_TERIMA') {
                const res = await fetchBerkasSerahTerimaList();
                docs = normalizeBerkasSerahTerimaDocs(res.data ?? []);
            } else if (kategori === 'INSTRUKSI_LAPANGAN') {
                const res = await fetchInstruksiLapanganList();
                docs = normalizeInstruksiLapanganDocs(res.data ?? []);
            }

            // Filter by cabang for non-HO users (branch group aware)
            const upperUserCabang = (sessionStorage.getItem('loggedInUserCabang') || '').toUpperCase();
            if (upperUserCabang && upperUserCabang !== 'HEAD OFFICE') {
                let userGroup: string[] | null = null;
                for (const grp of Object.values(BRANCH_GROUPS)) {
                    if (grp.includes(upperUserCabang)) {
                        userGroup = grp;
                        break;
                    }
                }
                
                if (userGroup) {
                    docs = docs.filter(d => userGroup!.includes(d.cabang.toUpperCase()));
                } else {
                    docs = docs.filter(d => d.cabang.toUpperCase() === upperUserCabang);
                }
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
    }, [userInfo.cabang, userInfo.nama_pt, userInfo.email, isContractor, isDirektur, showToast]);

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
                    id_toko:             d.toko.id,
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
                    link_lampiran_pendukung: d.rab.link_lampiran_pendukung,
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
                        catatan:         it.catatan,
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
            } else if (doc.tipe === 'OPNAME_FINAL') {
                const res = await fetchOpnameFinalDetail(doc.id);
                const d = res.data;
                detail = {
                    id: d.opname_final.id,
                    tipe: 'OPNAME_FINAL',
                    nomor_ulok:          d.toko?.nomor_ulok || doc.nomor_ulok,
                    nama_toko:           d.toko?.nama_toko || doc.nama_toko,
                    cabang:              d.toko?.cabang || doc.cabang,
                    proyek:              d.toko?.proyek || doc.proyek,
                    status:              d.opname_final.status_opname_final,
                    email_pembuat:       d.opname_final.email_pembuat,
                    total_nilai:         parseCurrency(d.opname_final.grand_total_opname),
                    created_at:          d.opname_final.created_at,
                    link_pdf:            d.opname_final.link_pdf_opname,
                    grand_total_opname:  d.opname_final.grand_total_opname,
                    grand_total_rab:     d.opname_final.grand_total_rab,
                    approval_koordinator: { pemberi: d.opname_final.pemberi_persetujuan_koordinator, waktu: d.opname_final.waktu_persetujuan_koordinator },
                    approval_manager:     { pemberi: d.opname_final.pemberi_persetujuan_manager,     waktu: d.opname_final.waktu_persetujuan_manager },
                    approval_direktur:    { pemberi: d.opname_final.pemberi_persetujuan_direktur,    waktu: d.opname_final.waktu_persetujuan_direktur },
                    alasan_penolakan:    d.opname_final.alasan_penolakan,
                    items: (d.items ?? []).map((it: any) => ({
                        id: it.id,
                        kategori:        it.kategori_pekerjaan || it.rab_item?.kategori_pekerjaan,
                        jenis_pekerjaan: it.jenis_pekerjaan || it.rab_item?.jenis_pekerjaan,
                        satuan:          it.satuan || it.rab_item?.satuan,
                        volume:          it.volume_akhir,
                        harga_material:  it.rab_item?.harga_material || 0,
                        harga_upah:      it.rab_item?.harga_upah || 0,
                        total:           it.total_harga_opname,
                        catatan:         it.catatan,
                    })),
                };
            } else if (doc.tipe === 'PENGAWASAN') {
                const res = await fetchPengawasanDetail(doc.id);
                const d = res.data;
                detail = {
                    id: d.id,
                    tipe: 'PENGAWASAN',
                    nomor_ulok:        '-',
                    nama_toko:         d.kategori_pekerjaan ? `${d.kategori_pekerjaan} - ${d.jenis_pekerjaan}` : '-',
                    cabang:            '-',
                    proyek:            '-',
                    status:            d.status,
                    email_pembuat:     '-',
                    total_nilai:       0,
                    created_at:        d.created_at,
                    link_pdf:          d.berkas_pengawasan?.link_pdf_pengawasan ?? null,
                    kategori_pekerjaan: d.kategori_pekerjaan,
                    jenis_pekerjaan:   d.jenis_pekerjaan,
                    catatan:           d.catatan,
                    dokumentasi:       d.dokumentasi,
                    link_pdf_pengawasan: d.berkas_pengawasan?.link_pdf_pengawasan ?? null,
                };
            } else if (doc.tipe === 'BERKAS_SERAH_TERIMA') {
                detail = {
                    id: doc.id,
                    tipe: 'BERKAS_SERAH_TERIMA',
                    nomor_ulok:        doc.nomor_ulok,
                    nama_toko:         doc.nama_toko,
                    cabang:            doc.cabang,
                    proyek:            doc.proyek,
                    status:            doc.status,
                    email_pembuat:     doc.email_pembuat,
                    total_nilai:       0,
                    created_at:        doc.created_at,
                    link_pdf:          doc.link_pdf,
                };
            } else if (doc.tipe === 'INSTRUKSI_LAPANGAN') {
                const res = await fetchInstruksiLapanganDetail(doc.id);
                const d = res.data;
                detail = {
                    id: d.id,
                    tipe: 'INSTRUKSI_LAPANGAN',
                    nomor_ulok:        d.nomor_ulok || doc.nomor_ulok,
                    nama_toko:         d.nama_toko || doc.nama_toko,
                    cabang:            d.cabang || doc.cabang,
                    proyek:            d.proyek || doc.proyek,
                    status:            d.status || doc.status,
                    email_pembuat:     d.email_pembuat || doc.email_pembuat,
                    total_nilai:       0,
                    created_at:        d.created_at || d.timestamp || doc.created_at,
                    items: (d.items ?? []).map((it: any) => ({
                        id: it.id,
                        kategori:        it.kategori_pekerjaan || '-',
                        jenis_pekerjaan: it.item_pekerjaan || it.jenis_pekerjaan || '-',
                        satuan:          it.satuan || '-',
                        volume:          it.volume || 0,
                        harga_material:  0,
                        harga_upah:      0,
                        total:           0,
                        catatan:         it.instruksi || it.keterangan || it.catatan || '-',
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
            } else if (tipe === 'OPNAME_FINAL') {
                await downloadOpnameFinalPdf(id);
            } else if (tipe === 'INSTRUKSI_LAPANGAN') {
                await downloadInstruksiLapanganPdf(id);
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
    // UPDATE RAB STATUS (HO ONLY)
    // =========================================================================
    const RAB_STATUS_OPTIONS = [
        { value: 'Ditolak oleh Koordinator', label: 'Ditolak oleh Koordinator' },
        { value: 'Ditolak oleh Manajer', label: 'Ditolak oleh Manajer' },
        { value: 'Ditolak oleh Direktur', label: 'Ditolak oleh Direktur' },
    ];

    const handleUpdateRABStatus = useCallback(async () => {
        if (!selectedDetail || !selectedNewStatus || !selectedDetail.id_toko) return;
        setIsUpdatingStatus(true);
        try {
            await updateRABStatus({
                id_toko: selectedDetail.id_toko,
                id_rab: selectedDetail.id,
                status: selectedNewStatus,
            });
            showToast(`Status RAB berhasil diubah menjadi "${selectedNewStatus}".`, 'success');
            // Update local state
            setSelectedDetail(prev => prev ? { ...prev, status: selectedNewStatus } : null);
            setListData(prev => prev.map(d =>
                d.id === selectedDetail.id && d.tipe === 'RAB' ? { ...d, status: selectedNewStatus } : d
            ));
            setShowStatusModal(false);
            setSelectedNewStatus('');
        } catch (err: any) {
            showToast(err.message || 'Gagal memperbarui status RAB.', 'error');
        } finally {
            setIsUpdatingStatus(false);
        }
    }, [selectedDetail, selectedNewStatus, showToast]);

    // =========================================================================
    // FILTERED LIST
    // =========================================================================
    // Static cabang options based on user role/group
    const cabangOptions = useMemo(() => {
        const upper = userInfo.cabang?.toUpperCase();
        if (!upper) return [];
        if (upper === 'HEAD OFFICE') {
            return Object.keys(BRANCH_TO_ULOK).sort();
        }
        let userGroup: string[] | null = null;
        for (const grp of Object.values(BRANCH_GROUPS)) {
            if (grp.includes(upper)) {
                userGroup = grp;
                break;
            }
        }
        return userGroup ? [...userGroup].sort() : [];
    }, [userInfo.cabang]);

    const isHO = userInfo.cabang?.toUpperCase() === 'HEAD OFFICE';
    const isHeadGroup = useMemo(() => {
        if (!userInfo.cabang) return false;
        const upper = userInfo.cabang.toUpperCase();
        return Object.values(BRANCH_GROUPS).some(grp => grp.includes(upper));
    }, [userInfo.cabang]);
    const showCabangFilter = isHO || isHeadGroup || isContractor || isDirektur;

    const filteredList = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return listData.filter(item => {
            // Cabang filter (HO only)
            if (cabangFilter) {
                if (item.cabang.toUpperCase() !== cabangFilter.toUpperCase()) return false;
            }
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
    }, [listData, searchQuery, statusFilter, cabangFilter]);

    // =========================================================================
    // RENDER
    // =========================================================================
    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">



            {/* STATUS UPDATE MODAL (HO ONLY) */}
            {showStatusModal && selectedDetail && selectedDetail.tipe === 'RAB' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="px-6 py-4 bg-linear-to-r from-red-50 to-red-100/50 border-b border-red-100">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                Ubah Status RAB
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {selectedDetail.nama_toko} — {selectedDetail.nomor_ulok}
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-sm font-medium text-slate-600 mb-1">Status Saat Ini</p>
                                <Badge className={`${getStatusBadgeClass(selectedDetail.status)} font-semibold text-xs border px-3 py-1`}>
                                    {selectedDetail.status}
                                </Badge>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-600 mb-2 block">Ubah Menjadi</label>
                                <div className="space-y-2">
                                    {RAB_STATUS_OPTIONS.map(opt => (
                                        <label
                                            key={opt.value}
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                selectedNewStatus === opt.value
                                                    ? 'border-red-400 bg-red-50'
                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="rab-status"
                                                value={opt.value}
                                                checked={selectedNewStatus === opt.value}
                                                onChange={() => setSelectedNewStatus(opt.value)}
                                                className="accent-red-500"
                                            />
                                            <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => { setShowStatusModal(false); setSelectedNewStatus(''); }}
                                    disabled={isUpdatingStatus}
                                >
                                    Batal
                                </Button>
                                <Button
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                    disabled={!selectedNewStatus || isUpdatingStatus}
                                    onClick={handleUpdateRABStatus}
                                >
                                    {isUpdatingStatus ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <AlertTriangle className="w-4 h-4 mr-2" />
                                    )}
                                    {isUpdatingStatus ? 'Memproses...' : 'Konfirmasi'}
                                </Button>
                            </div>
                        </div>
                    </div>
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl px-4">
                            {(Object.keys(KATEGORI_CONFIG) as DokumenKategori[]).filter(kat => {
                                // Hide PERTAMBAHAN_SPK, PENGAWASAN, BERKAS_SERAH_TERIMA and INSTRUKSI_LAPANGAN from KONTRAKTOR and DIREKTUR
                                if ((kat === 'PERTAMBAHAN_SPK' || kat === 'PENGAWASAN' || kat === 'BERKAS_SERAH_TERIMA' || kat === 'INSTRUKSI_LAPANGAN') && (isContractor || isDirektur)) return false;
                                return true;
                            }).map(kat => {
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
                            {showCabangFilter && cabangOptions.length > 0 && (
                                <div className="relative w-full sm:w-56">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select
                                        id="filter-cabang"
                                        value={cabangFilter}
                                        onChange={e => setCabangFilter(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="">Semua Cabang</option>
                                        {cabangOptions.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
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
                                                                : selectedKategori === 'SPK'
                                                                ? <FileSignature className="w-5 h-5" />
                                                                : selectedKategori === 'BERKAS_SERAH_TERIMA'
                                                                ? <CheckCircle className="w-5 h-5" />
                                                                : selectedKategori === 'INSTRUKSI_LAPANGAN'
                                                                ? <ClipboardList className="w-5 h-5" />
                                                                : <FilePlus className="w-5 h-5" />
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
                                                            {selectedKategori === 'RAB' 
                                                                ? doc.nama_toko 
                                                                : (selectedKategori === 'SPK' ? (doc.nama_kontraktor || doc.nama_toko) : doc.nama_toko)
                                                            }
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
                                                        <p className="text-sm font-bold text-slate-800">
                                                            {selectedKategori === 'PERTAMBAHAN_SPK'
                                                                ? `+${doc.pertambahan_hari || '-'} Hari`
                                                                : formatRupiah(doc.total_nilai)
                                                            }
                                                        </p>
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
                                    <div className={`px-6 py-4 ${
                                        selectedDetail.tipe === 'RAB' ? 'bg-linear-to-r from-blue-50 to-blue-100/50 border-b border-blue-100'
                                        : selectedDetail.tipe === 'PERTAMBAHAN_SPK' ? 'bg-linear-to-r from-emerald-50 to-emerald-100/50 border-b border-emerald-100'
                                        : selectedDetail.tipe === 'OPNAME_FINAL' ? 'bg-linear-to-r from-orange-50 to-orange-100/50 border-b border-orange-100'
                                        : selectedDetail.tipe === 'PENGAWASAN' ? 'bg-linear-to-r from-indigo-50 to-indigo-100/50 border-b border-indigo-100'
                                        : selectedDetail.tipe === 'BERKAS_SERAH_TERIMA' ? 'bg-linear-to-r from-teal-50 to-teal-100/50 border-b border-teal-100'
                                        : selectedDetail.tipe === 'INSTRUKSI_LAPANGAN' ? 'bg-linear-to-r from-pink-50 to-pink-100/50 border-b border-pink-100'
                                        : 'bg-linear-to-r from-purple-50 to-purple-100/50 border-b border-purple-100'
                                    }`}>
                                        <div className="flex items-center justify-between flex-wrap gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl ${
                                                    selectedDetail.tipe === 'RAB' ? 'bg-blue-100'
                                                    : selectedDetail.tipe === 'PERTAMBAHAN_SPK' ? 'bg-emerald-100'
                                                    : selectedDetail.tipe === 'OPNAME_FINAL' ? 'bg-orange-100'
                                                    : selectedDetail.tipe === 'PENGAWASAN' ? 'bg-indigo-100'
                                                    : selectedDetail.tipe === 'BERKAS_SERAH_TERIMA' ? 'bg-teal-100'
                                                    : selectedDetail.tipe === 'INSTRUKSI_LAPANGAN' ? 'bg-pink-100'
                                                    : 'bg-purple-100'
                                                } flex items-center justify-center`}>
                                                    {selectedDetail.tipe === 'RAB'
                                                        ? <FileText className="w-5 h-5 text-blue-600" />
                                                        : selectedDetail.tipe === 'PERTAMBAHAN_SPK'
                                                        ? <FilePlus className="w-5 h-5 text-emerald-600" />
                                                        : selectedDetail.tipe === 'OPNAME_FINAL'
                                                        ? <CheckSquare className="w-5 h-5 text-orange-600" />
                                                        : selectedDetail.tipe === 'PENGAWASAN'
                                                        ? <Eye className="w-5 h-5 text-indigo-600" />
                                                        : selectedDetail.tipe === 'BERKAS_SERAH_TERIMA'
                                                        ? <CheckCircle className="w-5 h-5 text-teal-600" />
                                                        : selectedDetail.tipe === 'INSTRUKSI_LAPANGAN'
                                                        ? <ClipboardList className="w-5 h-5 text-pink-600" />
                                                        : <FileSignature className="w-5 h-5 text-purple-600" />
                                                    }
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg text-slate-800">
                                                        {selectedDetail.tipe === 'RAB' ? 'Detail RAB'
                                                        : selectedDetail.tipe === 'SPK' ? 'Detail SPK'
                                                        : selectedDetail.tipe === 'PERTAMBAHAN_SPK' ? 'Detail Pertambahan SPK'
                                                        : selectedDetail.tipe === 'OPNAME_FINAL' ? 'Detail Opname Final'
                                                        : selectedDetail.tipe === 'PENGAWASAN' ? 'Detail Pengawasan'
                                                        : selectedDetail.tipe === 'BERKAS_SERAH_TERIMA' ? 'Detail Serah Terima'
                                                        : selectedDetail.tipe === 'INSTRUKSI_LAPANGAN' ? 'Detail Instruksi Lapangan'
                                                        : 'Detail Dokumen'}
                                                    </h3>
                                                    <p className="text-sm text-slate-500">ID: {selectedDetail.id}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge className={`${getStatusBadgeClass(selectedDetail.status)} font-semibold text-xs border px-3 py-1`}>
                                                    {getStatusLabel(selectedDetail.status)}
                                                </Badge>
                                                {isHO && selectedDetail.tipe === 'RAB' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-7"
                                                        onClick={() => { setShowStatusModal(true); setSelectedNewStatus(''); }}
                                                    >
                                                        <AlertTriangle className="w-3 h-3 mr-1" /> Ubah Status
                                                    </Button>
                                                )}
                                            </div>
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

                                            {/* Pertambahan SPK-specific fields */}
                                            {selectedDetail.tipe === 'PERTAMBAHAN_SPK' && (
                                                <>
                                                    <InfoRow icon={<Hash className="w-4 h-4" />} label="Nomor SPK" value={selectedDetail.nomor_ulok} />
                                                    <InfoRow icon={<Clock className="w-4 h-4" />} label="Pertambahan Hari" value={`+${selectedDetail.pertambahan_hari || '-'} Hari`} />
                                                    <InfoRow icon={<CalendarDays className="w-4 h-4" />} label="Tgl Akhir SPK" value={selectedDetail.tanggal_spk_akhir ? formatDateFull(selectedDetail.tanggal_spk_akhir) : '-'} />
                                                    <InfoRow icon={<CalendarDays className="w-4 h-4" />} label="Tgl Akhir Setelah Perpanjangan" value={selectedDetail.tanggal_spk_akhir_setelah_perpanjangan ? formatDateFull(selectedDetail.tanggal_spk_akhir_setelah_perpanjangan) : '-'} />
                                                    {selectedDetail.alasan_perpanjangan && (
                                                        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
                                                            <InfoRow icon={<FileText className="w-4 h-4" />} label="Alasan Perpanjangan" value={selectedDetail.alasan_perpanjangan} />
                                                        </div>
                                                    )}
                                                    {selectedDetail.disetujui_oleh && (
                                                        <InfoRow icon={<User className="w-4 h-4" />} label="Disetujui Oleh" value={selectedDetail.disetujui_oleh} />
                                                    )}
                                                    {selectedDetail.waktu_persetujuan_detail && (
                                                        <InfoRow icon={<CalendarDays className="w-4 h-4" />} label="Waktu Persetujuan" value={formatDateFull(selectedDetail.waktu_persetujuan_detail)} />
                                                    )}
                                                    {selectedDetail.alasan_penolakan && (
                                                        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
                                                            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
                                                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                                                <div>
                                                                    <p className="text-[11px] text-red-400 font-medium uppercase tracking-wide">Alasan Penolakan</p>
                                                                    <p className="text-sm text-red-700 font-semibold">{selectedDetail.alasan_penolakan}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Nilai Kontrak Card — hide for PERTAMBAHAN_SPK */}
                                {selectedDetail.tipe !== 'PERTAMBAHAN_SPK' && (
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
                                )}

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
                                {/* Catatan (PENGAWASAN) */}
                                {selectedDetail.tipe === 'PENGAWASAN' && selectedDetail.catatan && (
                                    <div className="bg-indigo-50 rounded-2xl border border-indigo-200 p-5">
                                        <div className="flex items-start gap-3">
                                            <FileText className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-bold text-indigo-700">Catatan Pengawasan</p>
                                                <p className="text-sm text-indigo-600 mt-1">{selectedDetail.catatan}</p>
                                            </div>
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

                                {/* Items Table (RAB, OPNAME_FINAL & INSTRUKSI_LAPANGAN) */}
                                {(selectedDetail.tipe === 'RAB' || selectedDetail.tipe === 'OPNAME_FINAL' || selectedDetail.tipe === 'INSTRUKSI_LAPANGAN') && selectedDetail.items && selectedDetail.items.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 border-b border-slate-100">
                                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                <div className={`w-1.5 h-5 ${selectedDetail.tipe === 'OPNAME_FINAL' ? 'bg-orange-500' : selectedDetail.tipe === 'INSTRUKSI_LAPANGAN' ? 'bg-pink-500' : 'bg-blue-500'} rounded-full`} />
                                                Item Pekerjaan ({selectedDetail.items.length} item)
                                            </h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 text-slate-500">
                                                    <tr>
                                                        <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">No</th>
                                                        <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">Kategori</th>
                                                        <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">Jenis Pekerjaan</th>
                                                        <th className="text-center px-4 py-3 font-semibold text-xs min-w-48">Catatan</th>
                                                        <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">Satuan</th>
                                                        <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">Volume</th>
                                                        <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">Material</th>
                                                        <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">Upah</th>
                                                        <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedDetail.items.map((item, idx) => (
                                                        <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                                                            <td className="px-4 py-2.5 text-center text-slate-400 whitespace-nowrap">{idx + 1}</td>
                                                            <td className="px-4 py-2.5 text-slate-600 font-medium text-xs whitespace-nowrap">{item.kategori}</td>
                                                            <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{item.jenis_pekerjaan}</td>
                                                            <td className="px-4 py-2.5 text-slate-500 italic text-xs">{item.catatan || '-'}</td>
                                                            <td className="px-4 py-2.5 text-center text-slate-500 whitespace-nowrap">{item.satuan}</td>
                                                            <td className="px-4 py-2.5 text-center text-slate-600 whitespace-nowrap">{item.volume}</td>
                                                            <td className="px-4 py-2.5 text-right text-slate-600 whitespace-nowrap">{formatRupiah(item.harga_material)}</td>
                                                            <td className="px-4 py-2.5 text-right text-slate-600 whitespace-nowrap">{formatRupiah(item.harga_upah)}</td>
                                                            <td className="px-4 py-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">{formatRupiah(item.total)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-slate-100 border-t border-slate-300">
                                                    <tr>
                                                        <td colSpan={8} className="p-3 font-bold text-slate-700 text-right">GRAND TOTAL</td>
                                                        <td className="p-3 font-extrabold text-slate-800 text-right whitespace-nowrap">
                                                            {formatRupiah((selectedDetail.items || []).reduce((s, r) => s + Number(r.total ?? 0), 0))}
                                                        </td>
                                                    </tr>
                                                </tfoot>
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
                                        {/* Download button for RAB, SPK, OPNAME_FINAL, INSTRUKSI_LAPANGAN */}
                                        {(selectedDetail.tipe === 'RAB' || selectedDetail.tipe === 'SPK' || selectedDetail.tipe === 'OPNAME_FINAL' || selectedDetail.tipe === 'INSTRUKSI_LAPANGAN') && (
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
                                        )}

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

                                        {/* SPK, OPNAME_FINAL, PENGAWASAN & BERKAS_SERAH_TERIMA PDF link */}
                                        {(selectedDetail.tipe === 'SPK' || selectedDetail.tipe === 'OPNAME_FINAL' || selectedDetail.tipe === 'PENGAWASAN' || selectedDetail.tipe === 'BERKAS_SERAH_TERIMA') && selectedDetail.link_pdf && (
                                            <a href={selectedDetail.link_pdf} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline">
                                                    <FileDown className="w-4 h-4 mr-2" /> Lihat PDF Online
                                                </Button>
                                            </a>
                                        )}

                                        {/* Pertambahan SPK Attachment */}
                                        {selectedDetail.tipe === 'PERTAMBAHAN_SPK' && selectedDetail.link_lampiran_pendukung && (
                                            <Button
                                                variant="outline"
                                                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                                onClick={() => {
                                                    const link = selectedDetail.link_lampiran_pendukung!;
                                                    if (link.startsWith('data:')) {
                                                        const win = window.open();
                                                        if (win) {
                                                            win.document.write(`<iframe src="${link}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                                        }
                                                    } else {
                                                        window.open(link, '_blank');
                                                    }
                                                }}
                                            >
                                                <FileDown className="w-4 h-4 mr-2" /> Lihat Lampiran Pendukung
                                            </Button>
                                        )}
                                        {selectedDetail.tipe === 'PERTAMBAHAN_SPK' && !selectedDetail.link_lampiran_pendukung && (
                                            <p className="text-sm text-slate-400 italic">Tidak ada lampiran pendukung.</p>
                                        )}

                                        {/* Pengawasan Dokumentasi Link */}
                                        {selectedDetail.tipe === 'PENGAWASAN' && selectedDetail.dokumentasi && (
                                            <a href={selectedDetail.dokumentasi} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                                                    <Eye className="w-4 h-4 mr-2" /> Lihat Dokumentasi
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
            {/* TOAST */}
            {toast && (
                <div className={`fixed top-5 right-5 z-100 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-semibold animate-in slide-in-from-top-2 duration-300 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                    {toast.msg}
                </div>
            )}
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
