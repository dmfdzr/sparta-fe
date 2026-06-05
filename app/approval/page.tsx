"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft, Loader2, CheckCircle, XCircle,
    Search, FileText, ClipboardList, Eye,
    AlertTriangle, FileDown, Building2, CalendarDays, User, RefreshCw, Plus
} from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';
import GanttViewer from '@/components/GanttViewer';

import {
    // RAB
    fetchRABList, fetchRABDetail, processRABApproval, downloadRABPdf,
    type RABListItem, type RABDetailItem,
    fetchUserCabangList,
    // SPK
    fetchSPKList, fetchSPKDetail, processSPKApproval, downloadSPKPdf,
    type SPKListItem,
    // Pertambahan SPK
    fetchPertambahanSPKList, fetchPertambahanSPKDetail, processPertambahanSPKApproval,
    type PertambahanSPKListItem, type PertambahanSPKDetailResponse,
    // Opname Final
    fetchOpnameFinalList, fetchOpnameFinalDetail, approveOpnameFinal, downloadOpnameFinalPdf,
    sendEmailNotification,
    fetchProjekPlanningList,
    type ProjekPlanningItem,
} from '@/lib/api';
import {
    fetchInstruksiLapanganList, fetchInstruksiLapanganDetail,
    processInstruksiLapanganApproval, downloadInstruksiLapanganPdf
} from '@/lib/api';

import { parseCurrency } from '@/lib/utils';
import { BRANCH_GROUPS, BRANCH_TO_ULOK, canViewAllBranches, isViewOnlyUser } from '@/lib/constants';
import {
    EMPTY_APPROVAL_COUNTS,
    fetchApprovalNotificationCounts,
    getApprovalNotificationTotal,
    type ApprovalCounts,
} from '@/lib/approval-notifications';

// =============================================
// TYPES INTERNAL
// =============================================
type ApprovalType = 'RAB' | 'SPK' | 'PERTAMBAHAN_SPK' | 'OPNAME_FINAL' | 'INSTRUKSI_LAPANGAN' | 'PROJECT_PLANNING';
type ActiveView = 'menu' | 'list' | 'detail';


interface NormalizedListItem {
    id: number;
    id_toko?: number;
    tipe: ApprovalType;
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    status: string;
    total_nilai: number;
    email_pembuat: string;
    created_at: string;
    _raw: RABListItem | SPKListItem | PertambahanSPKListItem | any;
    // Pertambahan SPK specific
    pertambahan_hari?: string;
    nomor_spk?: string;
    alasan_perpanjangan?: string;
    hari_denda?: number;
    nilai_denda?: string;
}

interface NormalizedDetail {
    id: number;
    tipe: ApprovalType;
    nomor_ulok: string;
    id_toko?: number;
    nama_toko: string;
    kode_toko?: string;
    alamat?: string;
    cabang: string;
    lingkup_pekerjaan?: string;
    status: string;
    total_nilai: number;
    email_pembuat: string;
    created_at: string;
    alasan_penolakan?: string | null;
    // Approval trail (RAB & IL)
    // Approval trail (RAB & IL)
    approval_koordinator?: { pemberi: string | null; waktu: string | null };
    approval_manager?: { pemberi: string | null; waktu: string | null };
    approval_direktur?: { pemberi: string | null; waktu: string | null };
    // SPK specific
    nama_kontraktor?: string;
    durasi?: number;
    waktu_mulai?: string;
    waktu_selesai?: string;
    nilai_kontrak?: number;
    // PDF
    link_pdf_gabungan?: string | null;
    link_lampiran_pendukung?: string | null;
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
        desain?: string | null;
        kualitas?: string | null;
        spesifikasi?: string | null;
        catatan?: string | null;
        foto?: string | null;
    }>;
    // Pertambahan SPK specific
    pertambahan_hari?: string;
    tanggal_spk_akhir?: string;
    tanggal_spk_akhir_setelah_perpanjangan?: string;
    alasan_perpanjangan?: string;
    nomor_spk?: string;
    link_pdf?: string | null;
    hari_denda?: number;
    nilai_denda?: string;
    tanggal_akhir_spk_denda?: string;
    tanggal_serah_terima_denda?: string;
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

const normalizeBranch = (branch?: string | null) => (branch ?? '').trim().toUpperCase();

const getFirstNonEmptyString = (...values: unknown[]) => {
    const value = values.find(v => typeof v === 'string' && v.trim());
    return typeof value === 'string' ? value.trim() : null;
};

type ObjectRecord = Record<string, unknown>;

const isObjectRecord = (value: unknown): value is ObjectRecord =>
    typeof value === 'object' && value !== null;

const getNestedRecord = (source: ObjectRecord, key: string) => {
    const value = source[key];
    return isObjectRecord(value) ? value : null;
};

const getOpnameFinalItems = (payload: unknown) => {
    if (!isObjectRecord(payload)) return [];
    if (Array.isArray(payload.items)) return payload.items;

    const toko = getNestedRecord(payload, 'toko');
    if (Array.isArray(toko?.items)) return toko.items;

    const opnameFinal = getNestedRecord(payload, 'opname_final');
    if (Array.isArray(opnameFinal?.items)) return opnameFinal.items;

    return [];
};

// =============================================
// ROLE CONFIG
// =============================================
const ROLE_ACCESS: Record<ApprovalType, string[]> = {
    RAB: ['BRANCH BUILDING COORDINATOR', 'BRANCH BUILDING & MAINTENANCE MANAGER', 'DIREKTUR KONTRAKTOR', 'DIREKTUR', 'COORDINATOR', 'MANAGER'],
    SPK: ['BRANCH MANAGER', 'MANAGER'],
    PERTAMBAHAN_SPK: ['BRANCH MANAGER', 'MANAGER'],
    OPNAME_FINAL: ['BRANCH BUILDING COORDINATOR', 'BRANCH BUILDING & MAINTENANCE MANAGER', 'DIREKTUR KONTRAKTOR', 'DIREKTUR', 'COORDINATOR', 'MANAGER'],
    INSTRUKSI_LAPANGAN: ['BRANCH BUILDING COORDINATOR', 'BRANCH BUILDING & MAINTENANCE MANAGER', 'COORDINATOR', 'MANAGER'],
    PROJECT_PLANNING: ['BRANCH BUILDING & MAINTENANCE MANAGER', 'PROJECT PLANNING & DEVELOPMENT SPECIALIST', 'PROJECT PLANNING & DEVELOPMENT MANAGER'],
};

const ROLE_TO_JABATAN: Record<string, 'KOORDINATOR' | 'MANAGER' | 'DIREKTUR' | 'KONTRAKTOR'> = {
    'BRANCH BUILDING COORDINATOR':           'KOORDINATOR',
    'BRANCH BUILDING & MAINTENANCE MANAGER': 'MANAGER',
    'DIREKTUR KONTRAKTOR':                   'DIREKTUR',
    'DIREKTUR':                              'DIREKTUR',
    'KONTRAKTOR':                            'KONTRAKTOR',
};

const hasDirectorRole = (roles: string[]) =>
    roles.some(role => role === 'DIREKTUR' || role === 'DIREKTUR KONTRAKTOR' || role.includes('DIREKTUR'));

const isHeadOfficeDirector = (cabang?: string | null, roles: string[] = []) =>
    normalizeBranch(cabang) === 'HEAD OFFICE' && hasDirectorRole(roles);

const isContractorCompanyScopedRole = (roles: string[]) =>
    roles.some(role => role.includes('KONTRAKTOR'));

const normalizeCompanyName = (value?: string | null) =>
    String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();

const isPendingApprovalStatus = (status?: string | null) => {
    const upper = String(status ?? '').trim().toUpperCase();
    return upper.includes('MENUNGGU') || upper.startsWith('PENDING');
};

const isCoordinatorApprovalStatus = (status?: string | null) => {
    const upper = String(status ?? '').trim().toUpperCase();
    return upper.includes('KOORDINATOR');
};

const isManagerApprovalStatus = (status?: string | null) => {
    const upper = String(status ?? '').trim().toUpperCase();
    return upper.includes('MANAGER') || upper.includes('MANAJER');
};

const isDirectorApprovalStatus = (status?: string | null) => {
    const upper = String(status ?? '').trim().toUpperCase();
    return upper.includes('DIREKTUR') || upper.includes('DIR.');
};

const matchesUserCompany = (value: unknown, userCompany?: string | null) => {
    const normalizedUserCompany = normalizeCompanyName(userCompany);
    if (!normalizedUserCompany || !value || typeof value !== 'object') return false;

    const source = value as Record<string, any>;
    const candidates = [
        source.nama_pt,
        source.nama_kontraktor,
        source.toko?.nama_pt,
        source.toko?.nama_kontraktor,
    ];

    return candidates.some(candidate => normalizeCompanyName(candidate) === normalizedUserCompany);
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

    PERTAMBAHAN_SPK: {
        label: 'Approval Pertambahan SPK',
        icon: <ClipboardList className="w-10 h-10" />,
        color: 'text-emerald-700',
        hoverBorder: 'hover:border-emerald-500',
        badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        description: 'Perpanjangan hari SPK yang menunggu persetujuan.',
        emptyMsg: 'Tidak ada pengajuan pertambahan SPK yang menunggu persetujuan.',
    },
    OPNAME_FINAL: {
        label: 'Approval Opname Final',
        icon: <CheckCircle className="w-10 h-10" />,
        color: 'text-indigo-700',
        hoverBorder: 'hover:border-indigo-500',
        badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        description: 'Opname Final yang menunggu persetujuan.',
        emptyMsg: 'Tidak ada pengajuan Opname Final yang menunggu persetujuan.',
    },
    INSTRUKSI_LAPANGAN: {
        label: 'Approval Instruksi Lapangan',
        icon: <FileText className="w-10 h-10" />,
        color: 'text-amber-700',
        hoverBorder: 'hover:border-amber-500',
        badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
        description: 'Instruksi Lapangan yang menunggu persetujuan.',
        emptyMsg: 'Tidak ada pengajuan Instruksi Lapangan yang menunggu persetujuan.',
    },
    PROJECT_PLANNING: {
        label: 'Approval Project Planning',
        icon: <ClipboardList className="w-10 h-10" />,
        color: 'text-red-700',
        hoverBorder: 'hover:border-red-500',
        badgeColor: 'bg-red-100 text-red-700 border-red-200',
        description: 'FPD Project Planning yang memerlukan review atau persetujuan.',
        emptyMsg: 'Tidak ada project planning yang menunggu persetujuan.',
    },
};

const STATUS_BADGE_CLASS: Record<string, string> = {
    'MENUNGGU GANTT CHART': 'bg-slate-100 text-slate-700 border-slate-200',
    PENDING:             'bg-yellow-100 text-yellow-700 border-yellow-200',
    PENDING_KOORDINATOR: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    PENDING_MANAGER:     'bg-orange-100 text-orange-700 border-orange-200',
    PENDING_DIREKTUR:    'bg-red-100 text-red-700 border-red-200',
    APPROVED:            'bg-green-100 text-green-700 border-green-200',
    REJECTED:            'bg-red-100 text-red-700 border-red-200',
    WAITING_FOR_BM_APPROVAL: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    SPK_APPROVED:            'bg-green-100 text-green-700 border-green-200',
    SPK_REJECTED:            'bg-red-100 text-red-700 border-red-200',
    'MENUNGGU PERSETUJUAN':  'bg-yellow-100 text-yellow-700 border-yellow-200',
    'DISETUJUI BM':          'bg-green-100 text-green-700 border-green-200',
    'DITOLAK BM':            'bg-red-100 text-red-700 border-red-200',
    // Opname Final Specific
    'MENUNGGU PERSETUJUAN KOORDINATOR': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'MENUNGGU PERSETUJUAN MANAJER':     'bg-orange-100 text-orange-700 border-orange-200',
    'MENUNGGU PERSETUJUAN DIREKTUR KONTRAKTOR': 'bg-red-100 text-red-700 border-red-200',
    'MENUNGGU PERSETUJUAN DIREKTUR':    'bg-red-100 text-red-700 border-red-200',
    'DISETUJUI':                        'bg-green-100 text-green-700 border-green-200',
    'DITOLAK OLEH KOORDINATOR':         'bg-red-100 text-red-700 border-red-200',
    'DITOLAK OLEH MANAJER':             'bg-red-100 text-red-700 border-red-200',
    'DITOLAK OLEH DIREKTUR KONTRAKTOR': 'bg-red-100 text-red-700 border-red-200',
    'DITOLAK OLEH DIREKTUR':            'bg-red-100 text-red-700 border-red-200',
    // Project Planning
    WAITING_BM_APPROVAL:                'bg-yellow-100 text-yellow-700 border-yellow-200',
    WAITING_PP_APPROVAL_1:              'bg-yellow-100 text-yellow-700 border-yellow-200',
    PP_DESIGN_3D_REQUIRED:              'bg-purple-100 text-purple-700 border-purple-200',
    WAITING_RAB_UPLOAD:                 'bg-orange-100 text-orange-700 border-orange-200',
    WAITING_BM_APPROVAL_2:              'bg-yellow-100 text-yellow-700 border-yellow-200',
    WAITING_PP_APPROVAL_2:              'bg-yellow-100 text-yellow-700 border-yellow-200',
    WAITING_PP_MANAGER_APPROVAL:        'bg-yellow-100 text-yellow-700 border-yellow-200',
    COMPLETED:                          'bg-green-100 text-green-700 border-green-200',
    DRAFT:                              'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_LABEL: Record<string, string> = {
    'MENUNGGU GANTT CHART': 'MENUNGGU GANTT',
    PENDING:             'PENDING',
    PENDING_KOORDINATOR: 'PENDING (KOORD.)',
    PENDING_MANAGER:     'PENDING (MGR.)',
    PENDING_DIREKTUR:    'PENDING (DIR.)',
    APPROVED:            'APPROVED',
    REJECTED:            'REJECTED',
    WAITING_FOR_BM_APPROVAL: 'PENDING BM',
    SPK_APPROVED:            'APPROVED',
    SPK_REJECTED:            'REJECTED',
    'MENUNGGU PERSETUJUAN':  'PENDING BM',
    'DISETUJUI BM':          'APPROVED',
    'DITOLAK BM':            'REJECTED',
    // Opname Final Specific
    'MENUNGGU PERSETUJUAN KOORDINATOR': 'PENDING (KOORD.)',
    'MENUNGGU PERSETUJUAN MANAJER':     'PENDING (MGR.)',
    'MENUNGGU PERSETUJUAN DIREKTUR KONTRAKTOR': 'PENDING (DIR. KONTRAKTOR)',
    'MENUNGGU PERSETUJUAN DIREKTUR':    'PENDING (DIR.)',
    'DISETUJUI':                        'APPROVED',
    'DITOLAK OLEH KOORDINATOR':         'REJECTED (KOORD.)',
    'DITOLAK OLEH MANAJER':             'REJECTED (MGR.)',
    'DITOLAK OLEH DIREKTUR KONTRAKTOR': 'REJECTED (DIR. KONTRAKTOR)',
    'DITOLAK OLEH DIREKTUR':            'REJECTED (DIR.)',
    // Instruksi Lapangan
    // Project Planning
    WAITING_BM_APPROVAL:                'Pending B&M Mgr',
    WAITING_PP_APPROVAL_1:              'Pending PP (1)',
    PP_DESIGN_3D_REQUIRED:              'Design 3D',
    WAITING_RAB_UPLOAD:                 'Input Tahap 2',
    WAITING_BM_APPROVAL_2:              'Pending B&M (2)',
    WAITING_PP_APPROVAL_2:              'Pending PP (2)',
    WAITING_PP_MANAGER_APPROVAL:        'Pending PP Mgr',
    COMPLETED:                          'Selesai',
    DRAFT:                              'Draft',
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
    items.map(s => {
        const raw = s as any; // Bypass TS strict jika tipe di api.ts belum diperbarui
        return {
            id: raw.id,
            id_toko: raw.toko?.id ?? raw.id_toko,
            tipe: 'SPK' as ApprovalType,
            nomor_ulok:    raw.nomor_ulok,
            nama_toko:     raw.toko?.nama_toko ?? raw.nama_toko ?? '-',
            cabang:        raw.toko?.cabang ?? raw.cabang ?? '-',
            status:        raw.status,
            total_nilai:   parseCurrency(raw.grand_total),
            email_pembuat: raw.email_pembuat,
            created_at:    raw.created_at,
            _raw: raw,
        };
    });



const normalizePertambahanSPKList = (items: PertambahanSPKListItem[]): NormalizedListItem[] =>
    items.map(p => ({
        id: p.id,
        tipe: 'PERTAMBAHAN_SPK' as ApprovalType,
        nomor_ulok:    p.toko?.nomor_ulok || p.spk?.nomor_ulok || p.nomor_spk || '-',
        nama_toko:     p.toko?.nama_toko || `Perpanjangan ${p.pertambahan_hari} Hari`,
        cabang:        p.toko?.cabang || '',
        status:        p.status_persetujuan,
        total_nilai:   0,
        email_pembuat: p.dibuat_oleh,
        created_at:    p.created_at,
        pertambahan_hari: p.pertambahan_hari,
        nomor_spk:     p.nomor_spk,
        alasan_perpanjangan: p.alasan_perpanjangan,
        _raw: p,
    }));

const normalizeOpnameFinalList = (items: any[]): NormalizedListItem[] =>
    items.map(o => ({
        id: o.id,
        tipe: 'OPNAME_FINAL' as ApprovalType,
        nomor_ulok:    o.nomor_ulok || o.toko?.nomor_ulok || '-',
        nama_toko:     o.nama_toko  || o.toko?.nama_toko  || '-',
        cabang:        o.cabang     || o.toko?.cabang     || '-',
        status:        o.status_opname_final,
        total_nilai:   Math.max(0, parseCurrency(o.grand_total_opname) - parseCurrency(o.nilai_denda)),
        email_pembuat: o.email_pembuat,
        created_at:    o.created_at,
        hari_denda:    Number(o.hari_denda ?? 0),
        nilai_denda:   o.nilai_denda,
        _raw: o,
    }));

const normalizeInstruksiLapanganList = (items: any[]): NormalizedListItem[] =>
    items.map(i => ({
        id: i.id,
        tipe: 'INSTRUKSI_LAPANGAN' as ApprovalType,
        nomor_ulok:    i.nomor_ulok ?? '-',
        nama_toko:     i.nama_toko ?? '-',
        cabang:        i.cabang ?? '-',
        status:        i.status,
        total_nilai:   parseCurrency(i.grand_total_final ?? i.grand_total),
        email_pembuat: i.email_pembuat,
        created_at:    i.created_at,
        _raw: i,
    }));

const normalizeProjekPlanningList = (items: ProjekPlanningItem[]): NormalizedListItem[] =>
    items.map(p => ({
        id: p.id,
        tipe: 'PROJECT_PLANNING' as ApprovalType,
        nomor_ulok:    p.nomor_ulok ?? '-',
        nama_toko:     p.nama_lokasi || p.nama_toko || '-',
        cabang:        p.cabang || '-',
        status:        p.status,
        total_nilai:   parseCurrency(p.estimasi_biaya ?? '0'),
        email_pembuat: p.email_pembuat,
        created_at:    p.created_at,
        _raw: p,
    }));

// =============================================
// SUB-COMPONENTS
// =============================================
const ApprovalBadge = ({ status }: { status: string }) => {
    const upper = (status ?? '').toUpperCase();
    return (
        <Badge className={`${STATUS_BADGE_CLASS[upper] ?? 'bg-slate-100 text-slate-600 border-slate-200'} font-semibold text-xs px-2 py-0.5 border`}>
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
    const [userInfo, setUserInfo]       = useState({ name: '', role: '', cabang: '', email: '', nama_pt: '' });
    const [accessibleTypes, setAccessibleTypes] = useState<ApprovalType[]>([]);
    const [jabatan, setJabatan]         = useState<'KOORDINATOR' | 'MANAGER' | 'DIREKTUR' | 'KONTRAKTOR' | null>(null);

    // --- NAVIGATION ---
    const [activeView, setActiveView]     = useState<ActiveView>('menu');
    const [selectedType, setSelectedType] = useState<ApprovalType | null>(null);

    // --- DATA ---
    const [listData, setListData]         = useState<NormalizedListItem[]>([]);
    const [selectedDetail, setSelectedDetail] = useState<NormalizedDetail | null>(null);
    const [approvalCounts, setApprovalCounts] = useState<ApprovalCounts>(EMPTY_APPROVAL_COUNTS);
    const [isCountsLoading, setIsCountsLoading] = useState(false);
    const [searchQuery, setSearchQuery]   = useState('');
    const [cabangFilter, setCabangFilter] = useState('');

    // --- UI ---
    const [isLoading, setIsLoading]           = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [processingId, setProcessingId]     = useState<number | string | null>(null);
    const [rejectModal, setRejectModal]       = useState<NormalizedListItem | NormalizedDetail | null>(null);
    const [rejectNote, setRejectNote]         = useState('');
    const [rejectRabRevisionItems, setRejectRabRevisionItems] = useState<Array<{ id: number | null; note: string }>>([]);
    const [approveModal, setApproveModal]     = useState<NormalizedListItem | NormalizedDetail | null>(null);
    const [approveNote, setApproveNote]       = useState('');
    const [toast, setToast]                   = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // ==========================================
    // AUTH INIT
    // ==========================================
    const { user } = useSession();

    useEffect(() => {
        if (!user) return;

        const { role, email, cabang, namaLengkap, namaPt: nama_pt } = user;

        // Handle Multi-Role
        const roles = role.split(',').map(r => r.trim().toUpperCase());
        
        const isHO = cabang?.toUpperCase() === 'HEAD OFFICE';
        const isDirectorHO = isHeadOfficeDirector(cabang, roles);
        const isSuperHuman = user.isSuperHuman ?? false;
        const isRegionalManager = user.isRegionalManager ?? false;
        const isProjectPlanningApprovalRole = roles.some(r =>
            r.includes('PROJECT PLANNING & DEVELOPMENT SPECIALIST') ||
            r.includes('PROJECT PLANNING & DEVELOPMENT MANAGER') ||
            r.includes('PP SPECIALIST') ||
            r.includes('PP MANAGER')
        );

        // Find all accessible types across all roles
        const allAccessibleTypes = new Set<ApprovalType>();
        if (isRegionalManager || isSuperHuman) {
            allAccessibleTypes.add('RAB');
            allAccessibleTypes.add('SPK');
            allAccessibleTypes.add('PERTAMBAHAN_SPK');
            allAccessibleTypes.add('OPNAME_FINAL');
            allAccessibleTypes.add('INSTRUKSI_LAPANGAN');
            allAccessibleTypes.add('PROJECT_PLANNING');
        } else if (isProjectPlanningApprovalRole && isHO) {
            allAccessibleTypes.add('PROJECT_PLANNING');
        } else if (isDirectorHO) {
            allAccessibleTypes.add('RAB');
            allAccessibleTypes.add('OPNAME_FINAL');
        } else {
            roles.forEach(r => {
                (Object.keys(ROLE_ACCESS) as ApprovalType[]).forEach(type => {
                    if (ROLE_ACCESS[type].some(allowedRole => allowedRole.toUpperCase() === r)) {
                        allAccessibleTypes.add(type);
                    }
                });
            });
        }
        if (isHO && roles.some(r => ROLE_ACCESS.PROJECT_PLANNING.some(allowedRole => allowedRole.toUpperCase() === r))) {
            allAccessibleTypes.add('PROJECT_PLANNING');
        }

        const typesArr = Array.from(allAccessibleTypes);

        if (typesArr.length === 0) {
            alert("Role tidak memiliki akses ke halaman Approval.");
            router.push('/dashboard');
            return;
        }

        // Prioritas Jabatan: DIREKTUR KONTRAKTOR > MANAGER > KOORDINATOR
        // Super Human mendapat jabatan MANAGER untuk bisa approve semua level
        let currentJabatan: 'KOORDINATOR' | 'MANAGER' | 'DIREKTUR' | 'KONTRAKTOR' | null = null;
        if (isSuperHuman) {
            currentJabatan = 'MANAGER';
        } else if (roles.some(r => r.includes('DIREKTUR'))) {
            currentJabatan = 'DIREKTUR';
        } else if (roles.includes('BRANCH BUILDING & MAINTENANCE MANAGER') || roles.includes('MANAGER')) {
            currentJabatan = 'MANAGER';
        } else if (roles.includes('BRANCH BUILDING COORDINATOR') || roles.includes('COORDINATOR')) {
            currentJabatan = 'KOORDINATOR';
        }

        setUserInfo({ name: namaLengkap.toUpperCase(), role, cabang, email, nama_pt });
        setAccessibleTypes(typesArr);
        setJabatan(currentJabatan);
    }, [user, router]);

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

    const refreshApprovalCounts = useCallback(async () => {
        if (!user) return;
        setIsCountsLoading(true);
        try {
            const counts = await fetchApprovalNotificationCounts(user);
            setApprovalCounts(counts);
        } catch {
            setApprovalCounts(EMPTY_APPROVAL_COUNTS);
        } finally {
            setIsCountsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        refreshApprovalCounts();
    }, [refreshApprovalCounts]);

    // ==========================================
    // LOAD LIST
    // ==========================================
    const loadList = async (type: ApprovalType) => {
        setIsLoading(true);
        setSearchQuery('');
        try {
            let normalized: NormalizedListItem[] = [];
            if (type === 'RAB') {
                // Approval must not rely on nama_pt at API level because older RAB data can
                // contain the wrong contractor name and would disappear before role filtering.
                const res = await fetchRABList();
                normalized = normalizeRABList(res.data ?? []);
            } else if (type === 'SPK') {
                const res = await fetchSPKList({ status: 'WAITING_FOR_BM_APPROVAL' });
                normalized = normalizeSPKList(res.data ?? []);
            } else if (type === 'PERTAMBAHAN_SPK') {
                const res = await fetchPertambahanSPKList({ status_persetujuan: 'Menunggu Persetujuan' });
                normalized = normalizePertambahanSPKList(res.data ?? []);
            } else if (type === 'OPNAME_FINAL') {
                const res = await fetchOpnameFinalList({ aksi: 'terkunci' });
                const opnameListRaw = Array.isArray(res.data)
                    ? res.data
                    : Array.isArray((res.data as any)?.opname_final)
                        ? (res.data as any).opname_final
                        : [];
                normalized = normalizeOpnameFinalList(opnameListRaw);
            } else if (type === 'INSTRUKSI_LAPANGAN') {
                const res = await fetchInstruksiLapanganList();
                normalized = normalizeInstruksiLapanganList(res.data ?? []);
            } else if (type === 'PROJECT_PLANNING') {
                const res = await fetchProjekPlanningList();
                normalized = normalizeProjekPlanningList(res.data ?? []);
            }

            // Filter Berdasarkan Role & Jabatan & Cabang
            normalized = normalized.filter(item => {
                const upper = (item.status ?? '').toUpperCase();
                const upperUserCabang = normalizeBranch(userInfo.cabang);
                const userRoles = userInfo.role
                    .split(',')
                    .map(r => r.trim().toUpperCase())
                    .filter(Boolean);
                const isHOUser = upperUserCabang === 'HEAD OFFICE';
                const isDirectorHOUser = isHeadOfficeDirector(userInfo.cabang, userRoles);
                const isSuperHumanUser = user?.isSuperHuman ?? false;
                const canSeeAllBranches = canViewAllBranches(userInfo.role, isSuperHumanUser);
                const isRegionalManagerUser = user?.isRegionalManager ?? false;

                if (
                    type === 'RAB'
                    && isContractorCompanyScopedRole(userRoles)
                    && userInfo.nama_pt
                    && !matchesUserCompany(item._raw, userInfo.nama_pt)
                ) {
                    return false;
                }

                if (type === 'PROJECT_PLANNING') {
                    if (canSeeAllBranches) return true;
                    if (!isHOUser) return false;
                    const projek = item._raw as ProjekPlanningItem;

                    const isBmManager = userRoles.some(r =>
                        r.includes('BRANCH BUILDING & MAINTENANCE MANAGER') ||
                        r.includes('MAINTENANCE MANAGER') ||
                        r.includes('BBMM')
                    );
                    const isPpSpecialist = userRoles.some(r =>
                        r.includes('PROJECT PLANNING & DEVELOPMENT SPECIALIST') ||
                        r.includes('PP SPECIALIST')
                    );
                    const isPpManager = userRoles.some(r =>
                        r.includes('PROJECT PLANNING & DEVELOPMENT MANAGER') ||
                        r.includes('PP MANAGER')
                    );

                    const statusMatchesRole =
                        (isBmManager && !['DRAFT', 'COMPLETED', 'REJECTED'].includes(upper)) ||
                        (isPpSpecialist && !['DRAFT', 'WAITING_BM_APPROVAL', 'WAITING_BM_APPROVAL_2', 'COMPLETED', 'REJECTED'].includes(upper)) ||
                        (isPpManager && (
                            upper === 'WAITING_PP_MANAGER_APPROVAL' ||
                            (upper === 'WAITING_RAB_UPLOAD' && !!projek.pp_manager_approver_email)
                        ));

                    if (!statusMatchesRole) return false;
                    if (isHOUser) return normalizeBranch(item.cabang) === upperUserCabang;
                    if (!upperUserCabang || !item.cabang || item.cabang === '-') return true;

                    let userGroup: string[] | null = null;
                    for (const grp of Object.values(BRANCH_GROUPS)) {
                        if (grp.includes(upperUserCabang)) {
                            userGroup = grp;
                            break;
                        }
                    }

                    const itemCabangUpper = item.cabang.toUpperCase();
                    return userGroup ? userGroup.includes(itemCabangUpper) : itemCabangUpper === upperUserCabang;
                }

                if (canSeeAllBranches || isRegionalManagerUser) {
                    return true;
                }

                // 1. FILTER CABANG (Wajib sesuai cabang user)
                // Jika item.cabang adalah '-' atau empty, kita loloskan agar tidak tersembunyi karena data kurang
                if (jabatan !== 'DIREKTUR' && type !== 'PERTAMBAHAN_SPK' && upperUserCabang && item.cabang && item.cabang !== '-') {
                    let userGroup: string[] | null = null;
                    for (const grp of Object.values(BRANCH_GROUPS)) {
                        if (grp.includes(upperUserCabang)) {
                            userGroup = grp;
                            break;
                        }
                    }
                    
                    const itemCabangUpper = item.cabang.toUpperCase();
                    if (userGroup) {
                        if (!userGroup.includes(itemCabangUpper)) return false;
                    } else {
                        if (itemCabangUpper !== upperUserCabang) return false;
                    }
                }
                
                // 2. FILTER STATUS & JABATAN (Eksisting)
                // Khusus SPK, pastikan statusnya valid menunggu BM
                if (type === 'SPK') {
                    return upper === 'WAITING_FOR_BM_APPROVAL';
                }

                // Pertambahan SPK — hanya yang Menunggu Persetujuan
                if (type === 'PERTAMBAHAN_SPK') {
                    return upper === 'MENUNGGU PERSETUJUAN';
                }

                if (type === 'RAB' && jabatan === 'DIREKTUR') {
                    if (upperUserCabang && !isDirectorHOUser && item.cabang && item.cabang !== '-') {
                        let userGroup: string[] | null = null;
                        for (const grp of Object.values(BRANCH_GROUPS)) {
                            if (grp.includes(upperUserCabang)) {
                                userGroup = grp;
                                break;
                            }
                        }

                        const itemCabangUpper = normalizeBranch(item.cabang);
                        if (userGroup) {
                            if (!userGroup.includes(itemCabangUpper)) return false;
                        } else if (itemCabangUpper !== upperUserCabang) {
                            return false;
                        }
                    }

                    return isPendingApprovalStatus(upper) && isDirectorApprovalStatus(upper);
                }

                // Untuk RAB & IL (Multi-level)
                if (!isPendingApprovalStatus(upper)) return false;
                if (jabatan === 'KOORDINATOR') return isCoordinatorApprovalStatus(upper);
                if (jabatan === 'MANAGER')     return isManagerApprovalStatus(upper);
                if (jabatan === 'DIREKTUR')    return isDirectorApprovalStatus(upper);
                return true;
            });

            setListData(normalized);
            refreshApprovalCounts();
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
        if (item.tipe === 'PROJECT_PLANNING') {
            router.push(`/projek-planning/${item.id}?from=approval`);
            return;
        }

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
                    id_toko:           d.toko.id,
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
                    items: (d.items ?? []).map((it: RABDetailItem) => {
                        console.log("RAB ITEM:", it);
                        return {
                            id: it.id,
                            kategori:        it.kategori_pekerjaan,
                            jenis_pekerjaan: it.jenis_pekerjaan,
                            satuan:          it.satuan,
                            volume:          it.volume,
                            harga_material:  it.harga_material,
                            harga_upah:      it.harga_upah,
                            total:           it.total_harga,
                            catatan:         it.catatan,
                        };
                    }),
                };

            } else if (item.tipe === 'SPK') {
            const res = await fetchSPKDetail(item.id);
            const d = res.data;
            detail = {
                id: d.pengajuan.id,
                tipe: 'SPK',
                nomor_ulok:        d.pengajuan.nomor_ulok,
                id_toko:           (d.pengajuan as any).toko?.id ?? (d.pengajuan as any).id_toko,
                nama_toko:         item.nama_toko,
                kode_toko:         (d.pengajuan as any).toko?.kode_toko ?? (d.pengajuan as any).kode_toko,
                cabang:            item.cabang,
                lingkup_pekerjaan: (d.pengajuan as any).lingkup_pekerjaan ?? '-',
                status:            d.pengajuan.status,
                total_nilai:       parseCurrency((d.pengajuan as any).grand_total),
                email_pembuat:     (d.pengajuan as any).email_pembuat,
                created_at:        (d.pengajuan as any).created_at,
                alasan_penolakan:  (d.pengajuan as any).alasan_penolakan,
                nama_kontraktor:   (d.pengajuan as any).nama_kontraktor,
                durasi:            (d.pengajuan as any).durasi,
                waktu_mulai:       (d.pengajuan as any).waktu_mulai,
                waktu_selesai:     (d.pengajuan as any).waktu_selesai,
                nilai_kontrak:     parseCurrency((d.pengajuan as any).grand_total),
                items: [],
            };

            } else if (item.tipe === 'PERTAMBAHAN_SPK') {
                const res = await fetchPertambahanSPKDetail(item.id);
                const d = res.data;
                detail = {
                    id: d.id,
                    tipe: 'PERTAMBAHAN_SPK',
                    nomor_ulok:        d.toko?.nomor_ulok || d.spk?.nomor_ulok || d.nomor_spk || '-',
                    id_toko:           d.toko?.id,
                    nama_toko:         d.toko?.nama_toko || '-',
                    kode_toko:         d.toko?.kode_toko,
                    alamat:            d.toko?.alamat,
                    cabang:            d.toko?.cabang || '',
                    lingkup_pekerjaan: d.toko?.lingkup_pekerjaan || d.spk?.lingkup_pekerjaan,
                    status:            d.status_persetujuan,
                    total_nilai:       d.spk?.grand_total || 0,
                    email_pembuat:     d.dibuat_oleh,
                    created_at:        d.created_at,
                    alasan_penolakan:  d.alasan_penolakan,
                    nama_kontraktor:   d.toko?.nama_kontraktor || d.spk?.nama_kontraktor || '-',
                    durasi:            d.spk?.durasi,
                    waktu_mulai:       d.spk?.waktu_mulai,
                    waktu_selesai:     d.spk?.waktu_selesai,
                    link_lampiran_pendukung: d.link_lampiran_pendukung || null,
                    link_pdf:          d.link_pdf || null,
                    // Pertambahan SPK specific
                    pertambahan_hari:  d.pertambahan_hari,
                    tanggal_spk_akhir: d.tanggal_spk_akhir,
                    tanggal_spk_akhir_setelah_perpanjangan: d.tanggal_spk_akhir_setelah_perpanjangan,
                    alasan_perpanjangan: d.alasan_perpanjangan,
                    nomor_spk:         d.nomor_spk || d.spk?.nomor_spk,
                    items: [],
                };
            } else if (item.tipe === 'OPNAME_FINAL') {
                const res = await fetchOpnameFinalDetail(item.id);
                const payload = res?.data ?? {};
                const header = payload.opname_final ?? payload;
                const toko = payload.toko ?? {};
                const detailItems = getOpnameFinalItems(payload);
                detail = {
                    id: header.id,
                    tipe: 'OPNAME_FINAL',
                    nomor_ulok:        toko.nomor_ulok || item.nomor_ulok || '-',
                    id_toko:           header.id_toko ?? toko.id,
                    nama_toko:         toko.nama_toko || item.nama_toko || '-',
                    kode_toko:         toko.kode_toko,
                    alamat:            toko.alamat,
                    cabang:            toko.cabang || item.cabang || '',
                    lingkup_pekerjaan: toko.lingkup_pekerjaan,
                    status:            header.status_opname_final,
                    total_nilai:       Math.max(0, parseCurrency(header.grand_total_opname) - parseCurrency(header.nilai_denda)),
                    email_pembuat:     header.email_pembuat,
                    created_at:        header.created_at,
                    alasan_penolakan:  header.alasan_penolakan,
                    link_pdf_gabungan: header.link_pdf_opname,
                    hari_denda:        Number(header.hari_denda ?? 0),
                    nilai_denda:       header.nilai_denda,
                    tanggal_akhir_spk_denda: header.tanggal_akhir_spk_denda,
                    tanggal_serah_terima_denda: header.tanggal_serah_terima_denda,
                    approval_koordinator: { pemberi: header.pemberi_persetujuan_koordinator, waktu: header.waktu_persetujuan_koordinator },
                    approval_manager:     { pemberi: header.pemberi_persetujuan_manager,     waktu: header.waktu_persetujuan_manager },
                    approval_direktur:    { pemberi: header.pemberi_persetujuan_direktur,    waktu: header.waktu_persetujuan_direktur },
                    items: detailItems.map((it: any) => {
                        const vol = parseCurrency(it.volume_akhir ?? it.volume);
                        const mat = parseCurrency(it.harga_material ?? it.rab_item?.harga_material);
                        const upah = parseCurrency(it.harga_upah ?? it.rab_item?.harga_upah);
                        return {
                            id: it.id,
                            kategori:        it.kategori_pekerjaan || it.rab_item?.kategori_pekerjaan || '-',
                            jenis_pekerjaan: it.jenis_pekerjaan || it.rab_item?.jenis_pekerjaan || '-',
                            satuan:          it.satuan || it.rab_item?.satuan || '-',
                            volume:          vol,
                            harga_material:  mat,
                            harga_upah:      upah,
                            total:           parseCurrency(it.total_harga_opname) || (vol * (mat + upah)),
                            desain:          it.desain ?? it.opname_desain ?? null,
                            kualitas:        it.kualitas ?? it.opname_kualitas ?? null,
                            spesifikasi:     it.spesifikasi ?? it.opname_spesifikasi ?? null,
                            catatan:         it.catatan ?? it.opname_catatan ?? null,
                            foto:            getFirstNonEmptyString(it.foto, it.opname_foto, it.dokumentasi, it.link_foto, it.foto_url),
                        };
                    }),
                };
            } else if (item.tipe === 'INSTRUKSI_LAPANGAN') {
                const res = await fetchInstruksiLapanganDetail(item.id);
                const d = res.data;
                detail = {
                    id: d.id,
                    tipe: 'INSTRUKSI_LAPANGAN',
                    nomor_ulok:        d.nomor_ulok || item.nomor_ulok || '-',
                    id_toko:           d.id_toko,
                    nama_toko:         d.nama_toko || item.nama_toko || '-',
                    cabang:            d.cabang || item.cabang || '-',
                    status:            d.status || item.status,
                    total_nilai:       parseCurrency(d.grand_total_final ?? d.grand_total),
                    email_pembuat:     d.email_pembuat || item.email_pembuat,
                    created_at:        d.created_at || item.created_at,
                    alasan_penolakan:  d.alasan_penolakan,
                    link_pdf_gabungan: d.link_pdf_gabungan,
                    link_lampiran_pendukung: d.link_lampiran,
                    approval_koordinator: { pemberi: d.pemberi_persetujuan_koordinator, waktu: d.waktu_persetujuan_koordinator },
                    approval_manager:     { pemberi: d.pemberi_persetujuan_manager,     waktu: d.waktu_persetujuan_manager },
                    items: (d.items ?? []).map((it: any) => ({
                        id: it.id,
                        kategori:        it.kategori_pekerjaan,
                        jenis_pekerjaan: it.jenis_pekerjaan,
                        satuan:          it.satuan,
                        volume:          it.volume,
                        harga_material:  it.harga_material,
                        harga_upah:      it.harga_upah,
                        total:           it.total_harga || ((Number(it.volume) || 0) * ((Number(it.harga_material) || 0) + (Number(it.harga_upah) || 0))),
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
    // HELPER: Ambil nama Direktur Kontraktor berdasarkan email
    // (email bisa shared dengan Kontraktor, jadi cari yg jabatan-nya mengandung 'DIREKTUR')
    // ==========================================
    const fetchDirekturName = async (email: string): Promise<string | null> => {
        try {
            const res = await fetchUserCabangList({ email_sat: email });
            if (res.data && res.data.length > 0) {
                // Cari entry dengan jabatan yang mengandung 'DIREKTUR'
                const direkturEntry = res.data.find(
                    (u: any) => (u.jabatan ?? '').toUpperCase().includes('DIREKTUR')
                );
                if (direkturEntry) return direkturEntry.nama_lengkap;
            }
        } catch (err) {
            console.error('fetchDirekturName failed:', err);
        }
        return null;
    };

    const shouldSkipRABCoordinatorApproval = (item: NormalizedListItem | NormalizedDetail) => {
        const status = (item.status ?? '').toUpperCase();
        return item.tipe === 'RAB'
            && normalizeBranch(item.cabang) === 'BOGOR'
            && jabatan === 'DIREKTUR'
            && status.includes('MENUNGGU')
            && status.includes('DIREKTUR');
    };

    const shouldFinalizeRABAfterCoordinatorApproval = (item: NormalizedListItem | NormalizedDetail) => {
        const status = (item.status ?? '').toUpperCase();
        return item.tipe === 'RAB'
            && normalizeBranch(item.cabang) === 'BATAM'
            && jabatan === 'KOORDINATOR'
            && status.includes('MENUNGGU')
            && status.includes('KOORDINATOR');
    };

    // ==========================================
    // APPROVE
    // ==========================================
    const openApproveModal = (item: NormalizedListItem | NormalizedDetail) => {
        setApproveNote('');
        setApproveModal(item);
    };

    const handleConfirmApprove = async () => {
        if (!approveModal) return;
        const item = approveModal;
        const note = approveNote;
        setApproveModal(null);
        setApproveNote('');
        await handleApprove(item, note);
    };

    const handleApprove = async (item: NormalizedListItem | NormalizedDetail, note = '') => {
        setProcessingId(item.id);
        try {
            const catatanApproval = note.trim() || null;
            if (item.tipe === 'RAB') {
                let currentName = userInfo.name;
                if (jabatan === 'DIREKTUR' && item.status.toUpperCase().includes('MENUNGGU PERSETUJUAN DIREKTUR')) {
                    const direkturName = await fetchDirekturName(userInfo.email);
                    if (direkturName) currentName = direkturName;
                }
                
                await processRABApproval(item.id as number, {
                    approver_email: userInfo.email,
                    nama_lengkap:   currentName,
                    jabatan:        jabatan ?? 'KOORDINATOR',
                    ...(shouldSkipRABCoordinatorApproval(item) ? { next_jabatan: 'MANAGER' } : {}),
                    ...(shouldFinalizeRABAfterCoordinatorApproval(item) ? { next_status: 'DISETUJUI' } : {}),
                    tindakan:       'APPROVE',
                    catatan_approval: catatanApproval,
                });
            } else if (item.tipe === 'SPK') {
                await processSPKApproval(item.id as number, {
                    approver_email: userInfo.email,
                    tindakan:       'APPROVE',
                    catatan_approval: catatanApproval,
                });

                // Kirim notifikasi email ke semua user Kontraktor pada cabang terkait
                try {
                    await sendEmailNotification({
                        cabang: item.cabang,
                        id_toko: item.id_toko,
                        flag: "notification-spk-has-approve"
                    });
                } catch (emailErr) {
                    console.error("Gagal mengirim email notifikasi:", emailErr);
                }
            } else if (item.tipe === 'PERTAMBAHAN_SPK') {
                await processPertambahanSPKApproval(item.id as number, {
                    approver_email: userInfo.email,
                    tindakan:       'APPROVE',
                    catatan_approval: catatanApproval,
                });
            } else if (item.tipe === 'OPNAME_FINAL') {
                await approveOpnameFinal(item.id as number, {
                    approver_email: userInfo.email,
                    jabatan:        jabatan as any ?? 'KOORDINATOR',
                    tindakan:       'APPROVE',
                    catatan_approval: catatanApproval,
                });
            } else if (item.tipe === 'INSTRUKSI_LAPANGAN') {
                await processInstruksiLapanganApproval(item.id as number, {
                    approver_email: userInfo.email,
                    jabatan:        jabatan as any ?? 'KOORDINATOR',
                    tindakan:       'APPROVE',
                    catatan_approval: catatanApproval,
                });
            }
            // Hapus item dari list karena sudah bukan giliran role ini lagi
            setListData(prev => prev.filter(d => d.id !== item.id));
            if (selectedDetail?.id === item.id) {
                setSelectedDetail(null);
                setActiveView('list');
            }
            refreshApprovalCounts();
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
    const openRejectModal = (item: NormalizedListItem | NormalizedDetail) => {
        setRejectNote('');
        setRejectRabRevisionItems([]);
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
                let currentName = userInfo.name;
                if (jabatan === 'DIREKTUR' && item.status.toUpperCase().includes('MENUNGGU PERSETUJUAN DIREKTUR')) {
                    const direkturName = await fetchDirekturName(userInfo.email);
                    if (direkturName) currentName = direkturName;
                }
                
                await processRABApproval(item.id as number, {
                    approver_email:   userInfo.email,
                    nama_lengkap:     currentName,
                    jabatan:          jabatan ?? 'KOORDINATOR',
                    tindakan:         'REJECT',
                    alasan_penolakan: rejectNote,
                    catatan_approval: rejectNote,
                    revisi_item_ids: rejectRabRevisionItems
                        .map(item => item.id)
                        .filter((id): id is number => typeof id === 'number'),
                    revisi_item_notes: rejectRabRevisionItems.reduce<Record<string, string>>((acc, item) => {
                        if (typeof item.id === 'number' && item.note.trim()) acc[String(item.id)] = item.note.trim();
                        return acc;
                    }, {}),
                });
            } else if (item.tipe === 'SPK') {
                await processSPKApproval(item.id as number, {
                    approver_email:   userInfo.email,
                    tindakan:         'REJECT',
                    alasan_penolakan: rejectNote,
                    catatan_approval: rejectNote,
                });

                // Email notification is best-effort so approval state is not rolled back by mail delivery issues.
                try {
                    await sendEmailNotification({
                        cabang: item.cabang,
                        id_toko: item.id_toko,
                        flag: "notification-spk-has-reject"
                    });
                } catch (emailErr) {
                    console.error("Gagal mengirim email notifikasi:", emailErr);
                }
            } else if (item.tipe === 'PERTAMBAHAN_SPK') {
                await processPertambahanSPKApproval(item.id as number, {
                    approver_email:   userInfo.email,
                    tindakan:         'REJECT',
                    alasan_penolakan: rejectNote,
                    catatan_approval: rejectNote,
                });
            } else if (item.tipe === 'OPNAME_FINAL') {
                await approveOpnameFinal(item.id as number, {
                    approver_email:   userInfo.email,
                    jabatan:          jabatan as any ?? 'KOORDINATOR',
                    tindakan:         'REJECT',
                    alasan_penolakan: rejectNote,
                    catatan_approval: rejectNote,
                });
            } else if (item.tipe === 'INSTRUKSI_LAPANGAN') {
                await processInstruksiLapanganApproval(item.id as number, {
                    approver_email:   userInfo.email,
                    jabatan:          jabatan as any ?? 'KOORDINATOR',
                    tindakan:         'REJECT',
                    alasan_penolakan: rejectNote,
                    catatan_approval: rejectNote,
                });
            }
            // Hapus item dari list karena sudah ditolak
            setListData(prev => prev.filter(d => d.id !== item.id));
            if (selectedDetail?.id === item.id) {
                setSelectedDetail(null);
                setActiveView('list');
            }
            refreshApprovalCounts();
            showToast('Pengajuan berhasil ditolak.', 'success');
        } catch (err: any) {
            showToast(err.message || 'Gagal menolak pengajuan.', 'error');
        } finally {
            setProcessingId(null);
            setRejectNote('');
        }
    };

    // ==========================================
    // PDF DOWNLOAD (RAB & SPK)
    // ==========================================
    const handleDownloadPDF = async (id: number, type: ApprovalType) => {
        setProcessingId(`pdf-${id}`);
        try {
            if (type === 'RAB') {
                await downloadRABPdf(id);
            } else if (type === 'SPK') {
                await downloadSPKPdf(id);
            } else if (type === 'OPNAME_FINAL') {
                await downloadOpnameFinalPdf(id);
            } else if (type === 'INSTRUKSI_LAPANGAN') {
                await downloadInstruksiLapanganPdf(id);
            }
            showToast('PDF berhasil dibuka.', 'success');
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
     * Backend mengembalikan status dalam bahasa Indonesia:
     *   - "Menunggu Persetujuan Koordinator"
     *   - "Menunggu Persetujuan Manager"
     *   - "Disetujui" / "Approved"
     *   - "Ditolak"  / "Rejected"
     */
    const isActionableByRole = (status: string, tipe: ApprovalType): boolean => {
        const isSuperHumanUser = user?.isSuperHuman ?? false;
        if (isViewOnlyUser(userInfo.role, isSuperHumanUser)) return false;
        const upper = (status ?? '').toUpperCase();
        
        // Cek Tolak/Setuju secara universal termasuk SPK
        if (upper.includes('TOLAK') || upper === 'REJECTED' || upper === 'SPK_REJECTED') return false;
        if (upper.includes('DISETUJUI') || upper === 'APPROVED' || upper === 'SPK_APPROVED') return false;

        // Project Planning diproses di halaman detail FPD, bukan tombol approve umum di sini.
        if (tipe === 'PROJECT_PLANNING') return false;

        // Validasi tombol Action khusus SPK (hanya untuk Branch Manager)
        if (tipe === 'SPK') {
            return upper === 'WAITING_FOR_BM_APPROVAL';
        }

        // Pertambahan SPK — status "Menunggu Persetujuan"
        if (tipe === 'PERTAMBAHAN_SPK') {
            return upper === 'MENUNGGU PERSETUJUAN';
        }

        // RAB & IL — multi-level
        if (jabatan === 'KOORDINATOR') return isPendingApprovalStatus(upper) && isCoordinatorApprovalStatus(upper);
        if (jabatan === 'MANAGER')     return isPendingApprovalStatus(upper) && isManagerApprovalStatus(upper);
        if (jabatan === 'DIREKTUR')    return isPendingApprovalStatus(upper) && isDirectorApprovalStatus(upper);
        return isPendingApprovalStatus(upper);
    };

    const isApproved = (status: string) => {
        const upper = (status ?? '').toUpperCase();
        return upper === 'APPROVED' || upper.includes('DISETUJUI');
    };

    const isRejected = (status: string) => {
        const upper = (status ?? '').toUpperCase();
        return upper === 'REJECTED' || upper.includes('DITOLAK') || upper.includes('TOLAK');
    };

    const isSuperHuman = user?.isSuperHuman ?? false;
    const canSeeAllBranches = canViewAllBranches(userInfo.role, isSuperHuman);
    const branchGroupForUser = useMemo(() => {
        const upper = normalizeBranch(userInfo.cabang);
        if (!upper) return null;
        const entry = Object.entries(BRANCH_GROUPS).find(([, group]) => group.includes(upper));
        return entry ? { name: entry[0], branches: entry[1] } : null;
    }, [userInfo.cabang]);
    const isBranchGroupUser = !!branchGroupForUser;
    const showCabangFilter = canSeeAllBranches || isBranchGroupUser;

    // Static cabang options based on user role/group
    const cabangOptions = useMemo(() => {
        if (canSeeAllBranches) {
            return Object.keys(BRANCH_TO_ULOK).sort();
        }
        return branchGroupForUser ? [...branchGroupForUser.branches].sort() : [];
    }, [branchGroupForUser, canSeeAllBranches]);

    const cabangFilterDefaultLabel = canSeeAllBranches
        ? 'Semua Cabang'
        : branchGroupForUser
            ? `Semua Cabang Group ${branchGroupForUser.name}`
            : 'Semua Cabang';

    useEffect(() => {
        if (!cabangFilter) return;
        const selectedStillAvailable = cabangOptions.some(c => c.toUpperCase() === cabangFilter.toUpperCase());
        if (!selectedStillAvailable) setCabangFilter('');
    }, [cabangFilter, cabangOptions]);

    const filteredList = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return listData.filter(item => {
            if (cabangFilter) {
                if (item.cabang?.toUpperCase() !== cabangFilter.toUpperCase()) return false;
            }
            if (!q) return true;
            return item.nama_toko.toLowerCase().includes(q)
                || item.nomor_ulok.toLowerCase().includes(q)
                || item.email_pembuat.toLowerCase().includes(q);
        });
    }, [listData, searchQuery, cabangFilter]);

    // Tombol approve/tolak hanya muncul jika item memang giliran role ini
    const canActOnDetail = selectedDetail && isActionableByRole(selectedDetail.status, selectedDetail.tipe);

    // Helper: buat NormalizedListItem dari detail untuk dikirim ke openRejectModal
    const detailAsListItem: NormalizedListItem | null = selectedDetail ? {
        id: selectedDetail.id, tipe: selectedDetail.tipe,
        id_toko: selectedDetail.id_toko,
        nomor_ulok: selectedDetail.nomor_ulok, nama_toko: selectedDetail.nama_toko,
        cabang: selectedDetail.cabang, status: selectedDetail.status,
        total_nilai: selectedDetail.total_nilai, email_pembuat: selectedDetail.email_pembuat,
        created_at: selectedDetail.created_at, _raw: {} as any
    } : null;
    const approvalTotalCount = getApprovalNotificationTotal(approvalCounts, accessibleTypes);

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

            {/* APPROVE NOTE MODAL */}
            {approveModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-green-100 bg-green-50/70 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                <CheckCircle className="w-5 h-5 text-green-700" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-slate-900">Setujui Pengajuan {approveModal.tipe}</h3>
                                <p className="text-xs text-slate-600 mt-0.5 truncate">{approveModal.nama_toko} - ULOK {approveModal.nomor_ulok}</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                Catatan bersifat opsional dan akan tersimpan sebagai catatan approval role Anda.
                            </div>
                            <textarea
                                className="w-full border border-slate-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                                rows={4}
                                placeholder="Catatan approval, jika ada..."
                                value={approveNote}
                                onChange={e => setApproveNote(e.target.value)}
                                autoFocus
                            />
                            <div className="flex gap-3 pt-1">
                                <Button variant="outline" className="flex-1" onClick={() => setApproveModal(null)}>Batal</Button>
                                <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleConfirmApprove}>
                                    Konfirmasi Setuju
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* REJECT MODAL */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-red-100 bg-red-50/70 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-slate-900">Tolak Pengajuan {rejectModal.tipe}</h3>
                                <p className="text-xs text-slate-600 mt-0.5 truncate">{rejectModal.nama_toko} - ULOK {rejectModal.nomor_ulok}</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                Alasan penolakan wajib diisi dan akan dikirim ke pengaju sebagai arahan revisi.
                            </div>
                            <textarea
                                className="w-full border border-slate-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                                rows={4}
                                placeholder="Tulis alasan penolakan..."
                                value={rejectNote}
                                onChange={e => setRejectNote(e.target.value)}
                                autoFocus
                            />
                            {rejectModal.tipe === 'RAB' && Array.isArray((rejectModal as NormalizedDetail).items) && (rejectModal as NormalizedDetail).items.length > 0 && (
                                <div className="rounded-xl border border-red-100 bg-red-50/40 p-3 space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-bold text-red-700">Detail Revisi RAB</p>
                                                <p className="text-xs text-slate-600">Pilih item RAB yang perlu direvisi. Catatan ditulis langsung pada item terkait.</p>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-8 border-red-200 text-red-700 hover:bg-red-50"
                                                disabled={rejectRabRevisionItems.filter(item => typeof item.id === 'number').length >= (rejectModal as NormalizedDetail).items.length}
                                                onClick={() => setRejectRabRevisionItems(prev => [...prev, { id: null, note: '' }])}
                                            >
                                                <Plus className="w-3.5 h-3.5 mr-1" /> Item
                                            </Button>
                                        </div>
                                    </div>
                                    {rejectRabRevisionItems.map((revision, index) => {
                                        const selectedIds = new Set(rejectRabRevisionItems.map(item => item.id).filter((id): id is number => typeof id === 'number'));
                                        const availableItems = (rejectModal as NormalizedDetail).items.filter(item => item.id === revision.id || !selectedIds.has(item.id));
                                        return (
                                            <div key={index} className="rounded-lg border border-slate-200 bg-white p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-slate-700">Item Revisi #{index + 1}</span>
                                                    <button
                                                        type="button"
                                                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                                                        onClick={() => setRejectRabRevisionItems(prev => prev.filter((_, itemIndex) => itemIndex !== index))}
                                                    >
                                                        Hapus
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-2">
                                                    <select
                                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
                                                        value={revision.id ?? ''}
                                                        onChange={e => {
                                                            const nextId = e.target.value ? Number(e.target.value) : null;
                                                            setRejectRabRevisionItems(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, id: nextId } : item));
                                                        }}
                                                    >
                                                        <option value="">Pilih item RAB...</option>
                                                        {availableItems.map(item => (
                                                            <option key={item.id} value={item.id}>
                                                                #{item.id} - {item.kategori} / {item.jenis_pekerjaan}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
                                                        value={revision.note}
                                                        onChange={e => setRejectRabRevisionItems(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, note: e.target.value } : item))}
                                                        placeholder="Catatan item..."
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="flex gap-3 pt-1">
                                <Button variant="outline" className="flex-1" onClick={() => setRejectModal(null)}>Batal</Button>
                                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleReject}>
                                    Konfirmasi Tolak
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <AppNavbar
                title={selectedType ? APPROVAL_CONFIG[selectedType].label : 'Approval Dokumen'}
                showBackButton
                backHref="/dashboard"
                rightActions={
                    <div className="flex items-center gap-2">
                        {approvalTotalCount > 0 && (
                            <Badge className="bg-red-100 text-red-700 border-red-200 font-bold text-xs px-2.5">
                                {approvalTotalCount} Proses
                            </Badge>
                        )}
                        {selectedType && listData.length > 0 && activeView === 'list' && (
                            <Badge className="bg-yellow-400 text-yellow-900 border-0 font-bold text-xs px-2.5">
                                {listData.length} Item
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
                                const count = approvalCounts[type] ?? 0;
                                return (
                                    <Card
                                        key={type}
                                        className={`hover:shadow-lg cursor-pointer transition-all border-2 border-transparent ${cfg.hoverBorder} group relative overflow-hidden`}
                                        onClick={() => handleSelectType(type)}
                                    >
                                        {count > 0 && (
                                            <div className="absolute right-4 top-4 min-w-7 h-7 px-2 rounded-full bg-red-600 text-white text-xs font-extrabold flex items-center justify-center shadow-sm">
                                                {count > 99 ? '99+' : count}
                                            </div>
                                        )}
                                        <CardContent className="p-10 flex flex-col items-center text-center gap-4">
                                            <div className={`${cfg.color} transition-transform group-hover:scale-110 duration-200`}>
                                                {cfg.icon}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-xl text-slate-800">{cfg.label}</h3>
                                                <p className="text-sm text-slate-500 mt-1">{cfg.description}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge className={`${cfg.badgeColor} text-xs font-semibold border`}>{type}</Badge>
                                                {isCountsLoading && (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
                                                )}
                                            </div>
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
                            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                                {showCabangFilter && cabangOptions.length > 0 && (
                                    <div className="relative w-full md:w-48">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <select
                                            value={cabangFilter}
                                            onChange={e => setCabangFilter(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white appearance-none cursor-pointer"
                                        >
                                            <option value="">{cabangFilterDefaultLabel}</option>
                                            {cabangOptions.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Cari toko / ULOK / email..."
                                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    className="h-10 w-full md:w-auto shrink-0 bg-white"
                                    onClick={() => loadList(selectedType)}
                                    disabled={isLoading}
                                >
                                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </Button>
                            </div>
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
                                                {selectedType !== 'PROJECT_PLANNING' && (
                                                    <th className="p-3 border-r font-semibold text-right">Total Nilai</th>
                                                )}
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
                                                    {selectedType !== 'PROJECT_PLANNING' && (
                                                        <td className="p-3 border-r text-right font-bold text-slate-800">{item.tipe === 'PERTAMBAHAN_SPK' ? `+${item.pertambahan_hari || '-'} Hari` : formatRupiah(item.total_nilai)}</td>
                                                    )}
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
                                                                        onClick={() => openApproveModal(item)}
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
                                        onClick={() => handleDownloadPDF(selectedDetail.id as number, 'RAB')}
                                    >
                                        {processingId === `pdf-${selectedDetail.id}`
                                            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            : <FileDown className="w-4 h-4 mr-2" />
                                        }
                                        {processingId === `pdf-${selectedDetail.id}` ? 'Menyiapkan PDF...' : 'Download RAB (PDF)'}
                                    </Button>
                                )}
                                {selectedDetail?.tipe === 'SPK' && (
                                    <Button
                                        variant="outline"
                                        className="border-purple-600 text-purple-700 hover:bg-purple-50 font-bold"
                                        disabled={processingId === `pdf-${selectedDetail.id}`}
                                        onClick={() => handleDownloadPDF(selectedDetail.id as number, 'SPK')}
                                    >
                                        {processingId === `pdf-${selectedDetail.id}`
                                            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            : <FileDown className="w-4 h-4 mr-2" />
                                        }
                                        {processingId === `pdf-${selectedDetail.id}` ? 'Menyiapkan PDF...' : 'Download SPK (PDF)'}
                                    </Button>
                                )}
                                {selectedDetail?.tipe === 'OPNAME_FINAL' && (
                                    <Button
                                        variant="outline"
                                        className="border-indigo-600 text-indigo-700 hover:bg-indigo-50 font-bold"
                                        disabled={processingId === `pdf-${selectedDetail.id}`}
                                        onClick={() => handleDownloadPDF(selectedDetail.id as number, 'OPNAME_FINAL')}
                                    >
                                        {processingId === `pdf-${selectedDetail.id}`
                                            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            : <FileDown className="w-4 h-4 mr-2" />
                                        }
                                        {processingId === `pdf-${selectedDetail.id}` ? 'Menyiapkan PDF...' : 'Download Opname (PDF)'}
                                    </Button>
                                )}
                                {selectedDetail?.tipe === 'INSTRUKSI_LAPANGAN' && (
                                    <Button
                                        variant="outline"
                                        className="border-amber-600 text-amber-700 hover:bg-amber-50 font-bold"
                                        disabled={processingId === `pdf-${selectedDetail.id}`}
                                        onClick={() => handleDownloadPDF(selectedDetail.id as number, 'INSTRUKSI_LAPANGAN')}
                                    >
                                        {processingId === `pdf-${selectedDetail.id}`
                                            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            : <FileDown className="w-4 h-4 mr-2" />
                                        }
                                        {processingId === `pdf-${selectedDetail.id}` ? 'Menyiapkan PDF...' : 'Download Instruksi Lapangan'}
                                    </Button>
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
                                                    {selectedDetail.kode_toko && (
                                                        <span className="flex items-center gap-1.5">
                                                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                            Kode Toko: <b>{selectedDetail.kode_toko}</b>
                                                        </span>
                                                    )}
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
                                                    {selectedDetail.durasi && (
                                                        <span className="flex items-center gap-1.5">
                                                            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                                            Durasi: <b>{selectedDetail.durasi} Hari</b>
                                                        </span>
                                                    )}
                                                    {selectedDetail.waktu_mulai && (
                                                        <span className="flex items-center gap-1.5">
                                                            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                                            Tanggal Mulai: <b>{formatDate(selectedDetail.waktu_mulai)}</b>
                                                        </span>
                                                    )}
                                                    {selectedDetail.waktu_selesai && (
                                                        <span className="flex items-center gap-1.5">
                                                            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                                            Tanggal Selesai: <b>{formatDate(selectedDetail.waktu_selesai)}</b>
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
                                                        <ApprovalHistoryRow label="Direktur Kontraktor" pemberi={selectedDetail.approval_direktur?.pemberi} waktu={selectedDetail.approval_direktur?.waktu} />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Total / Pertambahan SPK summary */}
                                            <div className="text-right shrink-0">
                                                {selectedDetail.tipe === 'PERTAMBAHAN_SPK' ? (
                                                    <>
                                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Perpanjangan</p>
                                                        <p className="text-3xl font-extrabold text-emerald-700">+{selectedDetail.pertambahan_hari} Hari</p>
                                                    </>
                                                ) : selectedDetail.tipe !== 'PROJECT_PLANNING' ? (
                                                    <>
                                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Nilai</p>
                                                        <p className="text-3xl font-extrabold text-slate-800">{formatRupiah(selectedDetail.total_nilai)}</p>
                                                        {selectedDetail.tipe === 'OPNAME_FINAL' && (
                                                            <p className="text-xs font-semibold text-red-500 mt-1">
                                                                Denda {formatRupiah(parseCurrency(selectedDetail.nilai_denda))} ({selectedDetail.hari_denda ?? 0} hari)
                                                            </p>
                                                        )}
                                                    </>
                                                ) : (
                                                    null
                                                )}
                                                <Badge className={`mt-2 ${APPROVAL_CONFIG[selectedDetail.tipe].badgeColor} font-semibold border`}>
                                                    {APPROVAL_CONFIG[selectedDetail.tipe].label}
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Visualisasi Gantt Chart - untuk RAB & SPK */}
                                {(selectedDetail.tipe === 'RAB' || selectedDetail.tipe === 'SPK') && selectedDetail.id_toko && (
                                    <div className="mb-6">
                                        <GanttViewer
                                            nomorUlok={selectedDetail.nomor_ulok}
                                            idToko={selectedDetail.id_toko}
                                            spkStartDate={selectedDetail.tipe === 'SPK' ? selectedDetail.waktu_mulai : undefined}
                                            spkDuration={selectedDetail.tipe === 'SPK' ? selectedDetail.durasi : undefined}
                                        />
                                    </div>
                                )}

                                {/* Pertambahan SPK Detail Card */}
                                {selectedDetail.tipe === 'PERTAMBAHAN_SPK' && (
                                    <Card className="mb-6 shadow-sm border-emerald-200 bg-white">
                                        <CardContent className="p-6">
                                            <h3 className="font-bold text-slate-700 text-sm mb-4 flex items-center gap-2">
                                                <CalendarDays className="w-4 h-4 text-emerald-600" />
                                                Detail Perpanjangan SPK
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nomor SPK</p>
                                                    <p className="text-sm font-semibold text-slate-800">{selectedDetail.nomor_spk || '-'}</p>
                                                </div>
                                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pertambahan Hari</p>
                                                    <p className="text-sm font-bold text-emerald-700">+{selectedDetail.pertambahan_hari} Hari</p>
                                                </div>
                                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Durasi SPK Awal</p>
                                                    <p className="text-sm font-semibold text-slate-800">{selectedDetail.durasi ? `${selectedDetail.durasi} Hari` : '-'}</p>
                                                </div>
                                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tgl Mulai SPK</p>
                                                    <p className="text-sm font-semibold text-slate-800">{formatDate(selectedDetail.waktu_mulai || '')}</p>
                                                </div>
                                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tgl Akhir SPK (Sebelum)</p>
                                                    <p className="text-sm font-semibold text-slate-800">{formatDate(selectedDetail.tanggal_spk_akhir || '')}</p>
                                                </div>
                                                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                                                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Tgl Akhir Setelah Perpanjangan</p>
                                                    <p className="text-sm font-bold text-emerald-800">{formatDate(selectedDetail.tanggal_spk_akhir_setelah_perpanjangan || '')}</p>
                                                </div>
                                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nilai Kontrak SPK</p>
                                                    <p className="text-sm font-semibold text-slate-800">{formatRupiah(selectedDetail.total_nilai)}</p>
                                                </div>
                                            </div>
                                            {/* Alasan Perpanjangan */}
                                            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                                                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1">Alasan Perpanjangan</p>
                                                <p className="text-sm text-slate-800">{selectedDetail.alasan_perpanjangan || '-'}</p>
                                            </div>
                                            {/* Lampiran links */}
                                            <div className="mt-4 flex flex-wrap gap-3">
                                                {selectedDetail.link_pdf && (
                                                    <a
                                                        href={selectedDetail.link_pdf}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                        Lihat PDF Perpanjangan
                                                    </a>
                                                )}
                                                {selectedDetail.link_lampiran_pendukung && (
                                                    <a
                                                        href={selectedDetail.link_lampiran_pendukung}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition-colors"
                                                    >
                                                        <FileDown className="w-4 h-4" />
                                                        Lihat Lampiran Pendukung
                                                    </a>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

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
                                                        <th className="p-3 border-r font-semibold text-center whitespace-nowrap">Kategori</th>
                                                        <th className="p-3 border-r font-semibold min-w-62.5 text-center whitespace-nowrap">Jenis Pekerjaan</th>
                                                        {selectedDetail.tipe !== 'INSTRUKSI_LAPANGAN' && (
                                                            <>
                                                                {selectedDetail.tipe !== 'RAB' && (
                                                                    <th className="p-3 border-r font-semibold text-center whitespace-nowrap">Dokumentasi</th>
                                                                )}
                                                                <th className="p-3 border-r font-semibold min-w-48 text-center">Catatan</th>
                                                            </>
                                                        )}
                                                        <th className="p-3 border-r font-semibold text-center whitespace-nowrap">Volume</th>
                                                        <th className="p-3 border-r font-semibold text-center whitespace-nowrap">Satuan</th>
                                                        <th className="p-3 border-r font-semibold text-center whitespace-nowrap">Harga Material</th>
                                                        <th className="p-3 border-r font-semibold text-center whitespace-nowrap">Harga Upah</th>
                                                        <th className="p-3 font-semibold text-center whitespace-nowrap">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {selectedDetail.items.map(row => (
                                                        <tr key={row.id} className="hover:bg-slate-50">
                                                            <td className="p-3 font-semibold text-slate-600 border-r text-xs whitespace-nowrap">{row.kategori}</td>
                                                            <td className="p-3 text-slate-700 border-r whitespace-normal min-w-62.5">{row.jenis_pekerjaan}</td>
                                                            {selectedDetail.tipe !== 'INSTRUKSI_LAPANGAN' && (
                                                                <>
                                                                    {selectedDetail.tipe !== 'RAB' && (
                                                                        <td className="p-3 text-center border-r">
                                                                            {row.foto ? (
                                                                                <a href={row.foto} target="_blank" rel="noopener noreferrer">
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        className="h-8 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                                                                    >
                                                                                        <Eye className="w-3.5 h-3.5 mr-1" />
                                                                                        Lihat Foto
                                                                                    </Button>
                                                                                </a>
                                                                            ) : (
                                                                                <span className="text-xs text-slate-400">Tidak ada foto</span>
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                    <td className="p-3 text-slate-500 italic text-xs border-r">{row.catatan || '-'}</td>
                                                                </>
                                                            )}
                                                            <td className="p-3 text-center font-bold border-r whitespace-nowrap">{row.volume}</td>
                                                            <td className="p-3 text-center text-slate-500 border-r whitespace-nowrap">{row.satuan}</td>
                                                            <td className="p-3 text-right font-medium text-slate-700 border-r whitespace-nowrap">{formatRupiah(row.harga_material || 0)}</td>
                                                            <td className="p-3 text-right font-medium text-slate-700 border-r whitespace-nowrap">{formatRupiah(row.harga_upah || 0)}</td>
                                                            <td className="p-3 text-right font-bold text-slate-800 whitespace-nowrap">{formatRupiah(row.total || 0)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-slate-100 border-t border-slate-300">
                                                    <tr>
                                                        <td colSpan={selectedDetail.tipe === 'INSTRUKSI_LAPANGAN' ? 6 : selectedDetail.tipe === 'RAB' ? 7 : 8} className="p-3 font-bold text-slate-700 text-right">GRAND TOTAL</td>
                                                        <td className="p-3 font-extrabold text-slate-800 text-right whitespace-nowrap">
                                                            {formatRupiah(selectedDetail.items.reduce((s, r) => s + Number(r.total ?? 0), 0))}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                ) : selectedDetail.tipe !== 'SPK' && selectedDetail.tipe !== 'PERTAMBAHAN_SPK' ? (
                                    <div className="py-10 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-sm mb-6">
                                        Tidak ada rincian item tersedia.
                                    </div>
                                ) : null}

                                {/* Sticky bottom bar */}
                                {canActOnDetail && detailAsListItem && (
                                    <div className="sticky bottom-6 flex justify-center z-50">
                                        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl px-6 py-4 flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-300">
                                            <span className="text-sm text-slate-600 font-medium hidden md:block">Ambil tindakan pada pengajuan ini:</span>
                                            <Button
                                                variant="outline"
                                                className="border-red-200 text-red-600 hover:bg-red-50 font-bold px-6"
                                                disabled={!!processingId}
                                                onClick={() => openRejectModal(selectedDetail)}
                                            >
                                                <XCircle className="w-4 h-4 mr-2" /> Tolak
                                            </Button>
                                            <Button
                                                className="bg-green-600 hover:bg-green-700 text-white font-bold px-8"
                                                disabled={!!processingId}
                                                onClick={() => openApproveModal(selectedDetail)}
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
