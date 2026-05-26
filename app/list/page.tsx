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
    ClipboardList, ExternalLink, MapPin,
} from 'lucide-react';

import {
    fetchRABList, fetchRABDetail, downloadRABPdf,
    type RABListItem, type RABDetailItem, type RABDetailResponse,
    fetchSPKList, fetchSPKDetail, downloadSPKPdf,
    type SPKListItem, type SPKDetailResponse,
    fetchPertambahanSPKList, fetchPertambahanSPKDetail, downloadPertambahanSPKPdf,
    type PertambahanSPKListItem,
    fetchOpnameFinalList, fetchOpnameFinalDetail, downloadOpnameFinalPdf,
    fetchPengawasanList, fetchPengawasanDetail, downloadPengawasanPdf,
    fetchGanttList, fetchGanttDetail,
    updateRABStatus, fetchBerkasSerahTerimaList, interveneSPKStatus,
    fetchActivityLogs, type ActivityLog,
    fetchInstruksiLapanganList, fetchInstruksiLapanganDetail, downloadInstruksiLapanganPdf,
    fetchProjekPlanningList, fetchProjekPlanningDetail, downloadProjekPlanningPdf, proxyProjekPlanningFile,
    fetchDokumentasiBangunanList, fetchDokumentasiBangunanDetail, downloadSerahTerimaPdf, downloadDokumentasiBangunanPdf, viewGeneratedPdfOnline,
    type ProjekPlanningItem,
} from '@/lib/api';
import { parseCurrency, formatRupiah } from '@/lib/utils';
import { BRANCH_GROUPS, BRANCH_TO_ULOK, getPpRoles, canAccessProjectPlanningByCabang, canViewAllBranches, hasSuperHumanRole, isViewOnlyUser } from '@/lib/constants';

// =============================================================================
// TYPES
// =============================================================================
type DokumenKategori = 'RAB' | 'SPK' | 'PERTAMBAHAN_SPK' | 'OPNAME_FINAL' | 'PENGAWASAN' | 'BERKAS_SERAH_TERIMA' | 'INSTRUKSI_LAPANGAN' | 'PROJECT_PLANNING' | 'DOKUMENTASI_BANGUNAN';
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
    // Project Planning specific
    jenis_proyek?: string;
    jenis_pengajuan?: string;
    nama_pengaju?: string;
    // Pengawasan specific
    id_gantt?: number;
    id_pengawasan_gantt?: number;
    tanggal_pengawasan?: string;
    grouped_items?: any[];
    hari_denda?: number;
    nilai_denda?: string;
    tanggal_akhir_spk_denda?: string;
    tanggal_serah_terima_denda?: string;
}

interface PengawasanDocGroup {
    key: string;
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    proyek: string;
    status: string;
    latest_created_at: string;
    docs: NormalizedDoc[];
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
    hari_denda?: number;
    nilai_denda?: string;
    tanggal_akhir_spk_denda?: string;
    tanggal_serah_terima_denda?: string;
    // Pengawasan specific
    id_gantt?: number;
    id_pengawasan_gantt?: number;
    kategori_pekerjaan?: string;
    jenis_pekerjaan?: string;
    catatan?: string | null;
    dokumentasi?: string | null;
    link_pdf_pengawasan?: string | null;
    tanggal_pengawasan?: string;
    pengawasan_items?: any[];
    // Project Planning specific
    jenis_proyek_pp?: string;
    jenis_pengajuan_pp?: string;
    jenis_pengajuan_lainnya_pp?: string;
    nama_pengaju_pp?: string;
    nama_lokasi_pp?: string;
    estimasi_biaya_pp?: string;
    keterangan_pp?: string;
    link_fpd_pp?: string | null;
    link_desain_3d_pp?: string | null;
    link_gambar_kerja_pp?: string | null;
    link_rab_pp?: string | null;
    link_fpd_approved_pp?: string | null;
    link_gambar_rab_sipil_pp?: string | null;
    link_gambar_rab_me_pp?: string | null;
    link_gambar_kompetitor_pp?: string | null;
    link_google_maps_pp?: string | null;
    link_rab_sipil_pp?: string | null;
    link_rab_me_pp?: string | null;
    link_gambar_kerja_final_pp?: string | null;
    link_gambar_kerja_final_sipil_pp?: string | null;
    link_gambar_kerja_final_me_pp?: string | null;
    foto_items_pp?: { id?: number; item_index: number; link_foto: string }[];
    butuh_desain_3d_pp?: boolean;
    bm_approval_pp?: { pemberi: string | null; waktu: string | null };
    pp1_approval?: { pemberi: string | null; waktu: string | null };
    pp2_approval?: { pemberi: string | null; waktu: string | null };
    pp_manager_approval?: { pemberi: string | null; waktu: string | null };
    // Dokumentasi Bangunan specific
    kode_toko?: string;
    tanggal_go?: string;
    tanggal_serah_terima?: string;
    tanggal_ambil_foto?: string;
    spk_awal?: string;
    spk_akhir?: string;
    kontraktor_sipil?: string;
    kontraktor_me?: string;
    email_pengirim?: string;
    status_validasi?: string;
    alasan_revisi?: string;
    pic_dokumentasi?: string;
    dokumentasi_items?: any[];
    activity_logs?: ActivityLog[];
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
        label: 'Instruksi Lapangan',
        fullLabel: 'Instruksi Lapangan',
        icon: <ClipboardList className="w-10 h-10" />,
        color: 'text-pink-600',
        bgColor: 'bg-pink-50',
        borderColor: 'border-pink-200',
        hoverBorder: 'hover:border-pink-400',
        badgeColor: 'bg-pink-100 text-pink-700 border-pink-200',
        description: 'Daftar dokumen instruksi lapangan.',
    },
    PROJECT_PLANNING: {
        label: 'Project Planning',
        fullLabel: 'Project Planning',
        icon: <ClipboardList className="w-10 h-10" />,
        color: 'text-cyan-600',
        bgColor: 'bg-cyan-50',
        borderColor: 'border-cyan-200',
        hoverBorder: 'hover:border-cyan-400',
        badgeColor: 'bg-cyan-100 text-cyan-700 border-cyan-200',
        description: 'Daftar dokumen FPD project planning.',
    },
    DOKUMENTASI_BANGUNAN: {
        label: 'Dokumentasi Bangunan Toko Baru',
        fullLabel: 'Dokumentasi Bangunan Toko Baru',
        icon: <Building2 className="w-10 h-10" />,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        hoverBorder: 'hover:border-amber-400',
        badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
        description: 'Daftar dokumen dokumentasi bangunan toko baru.',
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
    'MENUNGGU PERSETUJUAN DIREKTUR KONTRAKTOR': 'bg-red-100 text-red-700 border-red-200',
    'MENUNGGU PERSETUJUAN DIREKTUR':    'bg-red-100 text-red-700 border-red-200',
    'APPROVED':                         'bg-green-100 text-green-700 border-green-200',
    'DISETUJUI':                        'bg-green-100 text-green-700 border-green-200',
    'REJECTED':                         'bg-red-100 text-red-700 border-red-200',
    'DITOLAK':                          'bg-red-100 text-red-700 border-red-200',
    'DITOLAK OLEH DIREKTUR KONTRAKTOR': 'bg-red-100 text-red-700 border-red-200',
    'DITOLAK OLEH DIREKTUR':            'bg-red-100 text-red-700 border-red-200',
    'WAITING_FOR_BM_APPROVAL':          'bg-yellow-100 text-yellow-700 border-yellow-200',
    'SPK_APPROVED':                     'bg-green-100 text-green-700 border-green-200',
    'SPK_REJECTED':                     'bg-red-100 text-red-700 border-red-200',
    'MENUNGGU PERSETUJUAN':              'bg-yellow-100 text-yellow-700 border-yellow-200',
    'DISETUJUI BM':                      'bg-green-100 text-green-700 border-green-200',
    'DITOLAK BM':                        'bg-red-100 text-red-700 border-red-200',
    'SELESAI':                           'bg-green-100 text-green-700 border-green-200',
    'PROGRESS':                          'bg-blue-100 text-blue-700 border-blue-200',
    'TERLAMBAT':                         'bg-red-100 text-red-700 border-red-200',
    'DRAFT':                             'bg-slate-100 text-slate-600 border-slate-200',
    'WAITING_BM_APPROVAL':               'bg-amber-100 text-amber-700 border-amber-200',
    'WAITING_PP_APPROVAL_1':             'bg-blue-100 text-blue-700 border-blue-200',
    'PP_DESIGN_3D_REQUIRED':             'bg-purple-100 text-purple-700 border-purple-200',
    'WAITING_RAB_UPLOAD':                'bg-orange-100 text-orange-700 border-orange-200',
    'WAITING_PP_APPROVAL_2':             'bg-cyan-100 text-cyan-700 border-cyan-200',
    'WAITING_PP_MANAGER_APPROVAL':       'bg-indigo-100 text-indigo-700 border-indigo-200',
    'COMPLETED':                         'bg-green-100 text-green-700 border-green-200',
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
const parseDateValue = (dateStr: string) => {
    if (!dateStr) return null;
    const trimmed = String(dateStr).trim();
    const dmy = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(trimmed);
    if (dmy) {
        const [, day, month, year] = dmy;
        const parsed = new Date(Number(year), Number(month) - 1, Number(day));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
        const parsed = parseDateValue(dateStr);
        return parsed ? parsed.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : dateStr;
    } catch { return dateStr; }
};

const formatDateFull = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
        const parsed = parseDateValue(dateStr);
        return parsed ? parsed.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : dateStr;
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
        if (upper.includes('DIREKTUR')) return 'Ditolak Dir. Kontraktor';
        return 'Rejected';
    }

    if (upper.includes('DISETUJUI') || upper === 'APPROVED' || upper === 'SPK_APPROVED') return 'Approved';

    // Project Planning statuses
    if (upper === 'DRAFT') return 'Draft';
    if (upper === 'WAITING_BM_APPROVAL') return 'Pending B&M Mgr';
    if (upper === 'WAITING_PP_APPROVAL_1') return 'Pending PP (1)';
    if (upper === 'PP_DESIGN_3D_REQUIRED') return 'Design 3D';
    if (upper === 'WAITING_RAB_UPLOAD') return 'Upload RAB';
    if (upper === 'WAITING_PP_MANAGER_APPROVAL') return 'Pending PP Mgr';
    if (upper === 'WAITING_PP_APPROVAL_2') return 'Pending PP (2)';
    if (upper === 'COMPLETED') return 'Selesai';

    if (upper.includes('KOORDINATOR')) return 'Pending Koord.';
    if (upper.includes('MANAGER') || upper.includes('MANAJER')) return 'Pending Mgr.';
    if (upper.includes('DIREKTUR')) return 'Pending Dir. Kontraktor';
    if (upper === 'WAITING_FOR_BM_APPROVAL' || upper === 'MENUNGGU PERSETUJUAN') return 'Pending BM';
    if (upper.includes('PENDING')) return 'Pending';

    return status;
};

type ProjectPlanningAttachment = {
    label: string;
    url: string | null | undefined;
    field?: string;
    itemIndex?: number;
    icon?: React.ReactNode;
};

const hasLink = (url?: string | null) => !!url && url.trim() !== '';

const firstAttachmentUrl = (url?: string | null) =>
    String(url || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean)[0] || '';

const isUploadedDriveFileLink = (url: string) => {
    const lower = firstAttachmentUrl(url).toLowerCase();
    return (
        lower.includes('drive.google.com/file/d/') ||
        lower.includes('drive.google.com/open?id=') ||
        lower.includes('drive.google.com/uc?id=') ||
        lower.includes('drive.google.com/thumbnail?id=')
    );
};

const isExternalOnlyLink = (url: string) => {
    const lower = firstAttachmentUrl(url).toLowerCase();
    return (
        lower.includes('google.com/maps') ||
        lower.includes('maps.app.goo.gl') ||
        !isUploadedDriveFileLink(url)
    );
};

const isDownloadableAttachment = (url: string) => isUploadedDriveFileLink(url);

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
        total_nilai:   Math.max(0, parseCurrency(o.grand_total_opname) - parseCurrency(o.nilai_denda)),
        created_at:    o.created_at,
        link_pdf:      o.link_pdf_opname ?? null,
        hari_denda:    Number(o.hari_denda ?? 0),
        nilai_denda:   o.nilai_denda,
    }));

const normalizePengawasanDocs = (items: any[], ganttMap?: Map<number, any>): NormalizedDoc[] => {
    const groups = new Map<number, any[]>();
    items.forEach(p => {
        const key = p.id_pengawasan_gantt;
        if (!key) return;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(p);
    });

    const docs: NormalizedDoc[] = [];
    groups.forEach((groupItems, id_pengawasan_gantt) => {
        const first = groupItems[0];
        const g = ganttMap?.get(first.id_gantt);
        
        let aggStatus = 'SELESAI';
        if (groupItems.some(i => i.status?.toLowerCase() === 'progress')) aggStatus = 'PROGRESS';
        else if (groupItems.some(i => i.status?.toLowerCase() === 'terlambat')) aggStatus = 'TERLAMBAT';

        const tanggal = first.created_at || first.berkas_pengawasan?.created_at || first.tanggal_pengawasan;

        docs.push({
            id: id_pengawasan_gantt,
            tipe: 'PENGAWASAN' as DokumenKategori,
            nomor_ulok:    g?.nomor_ulok ?? '-',
            nama_toko:     g?.nama_toko ?? '-',
            cabang:        g?.cabang ?? '-',
            proyek:        g?.proyek ?? '-',
            status:        aggStatus,
            email_pembuat: '-',
            total_nilai:   0,
            created_at:    tanggal,
            link_pdf:      first.berkas_pengawasan?.link_pdf_pengawasan ?? null,
            id_gantt:      first.id_gantt,
            id_pengawasan_gantt: id_pengawasan_gantt,
            tanggal_pengawasan: first.tanggal_pengawasan,
            grouped_items: groupItems
        });
    });
    return docs;
};

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
        total_nilai:   parseCurrency(i.grand_total_final ?? i.grand_total),
        created_at:    i.created_at ?? i.timestamp ?? '-',
        link_pdf:      i.link_pdf_gabungan ?? null,
    }));

const normalizeProjekPlanningDocs = (items: ProjekPlanningItem[]): NormalizedDoc[] =>
    items.map(p => ({
        id: p.id,
        tipe: 'PROJECT_PLANNING' as DokumenKategori,
        nomor_ulok:      p.nomor_ulok ?? '-',
        nama_toko:       p.nama_toko  ?? '-',
        cabang:          p.cabang     ?? '-',
        proyek:          p.proyek     ?? '-',
        status:          p.status,
        email_pembuat:   p.email_pembuat ?? '-',
        total_nilai:     parseCurrency(p.estimasi_biaya),
        created_at:      p.created_at,
        link_pdf:        p.link_pdf ?? null,
        jenis_proyek:    p.jenis_proyek ?? undefined,
        jenis_pengajuan: p.jenis_pengajuan ?? undefined,
        nama_pengaju:    p.nama_pengaju ?? undefined,
    }));

const normalizeDokumentasiBangunanDocs = (items: any[]): NormalizedDoc[] =>
    items.map(d => ({
        id: d.id,
        tipe: 'DOKUMENTASI_BANGUNAN' as DokumenKategori,
        nomor_ulok:      d.nomor_ulok ?? '-',
        nama_toko:       d.nama_toko  ?? '-',
        cabang:          d.cabang     ?? '-',
        proyek:          '-',
        status:          d.status_validasi ?? 'SELESAI',
        email_pembuat:   d.email_pengirim ?? '-',
        total_nilai:     0,
        created_at:      d.created_at,
        link_pdf:        d.link_pdf ?? null,
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
    const [isPPOnly, setIsPPOnly] = useState(false);
    const [isSuperHuman, setIsSuperHuman] = useState(false);

    // --- Navigation ---
    const [activeView, setActiveView] = useState<ActiveView>('menu');
    const [selectedKategori, setSelectedKategori] = useState<DokumenKategori | null>(null);
    const [selectedPengawasanGroupKey, setSelectedPengawasanGroupKey] = useState<string | null>(null);

    // --- Data ---
    const [listData, setListData] = useState<NormalizedDoc[]>([]);
    const [selectedDetail, setSelectedDetail] = useState<NormalizedDetail | null>(null);

    // --- Filters ---
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [cabangFilter, setCabangFilter] = useState('');
    const [hasAppliedQueryParams, setHasAppliedQueryParams] = useState(false);
    // --- UI ---
    const [isLoading, setIsLoading] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // --- RAB Status Update (HO only) ---
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedNewStatus, setSelectedNewStatus] = useState('');
    const [rabInterventionReason, setRabInterventionReason] = useState('');
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // --- SPK Intervention (Super Human only) ---
    const [showSpkInterventionModal, setShowSpkInterventionModal] = useState(false);
    const [spkInterventionStatus, setSpkInterventionStatus] = useState<'WAITING_FOR_BM_APPROVAL' | 'SPK_APPROVED' | 'SPK_REJECTED'>('SPK_REJECTED');
    const [spkInterventionReason, setSpkInterventionReason] = useState('');
    const [isInterveningSPK, setIsInterveningSPK] = useState(false);

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
        const superHumanFlag = hasSuperHumanRole(roles);
        setIsContractor(contractorFlag);
        setIsDirektur(direkturFlag);
        setIsSuperHuman(superHumanFlag);
        const ppRoles = getPpRoles(role, email);
        const ppOnlyFlag = ppRoles.isPP && !ppRoles.isPPMgr && !ppRoles.isCoor && !ppRoles.isBM && !contractorFlag && !direkturFlag;
        setIsPPOnly(ppOnlyFlag);
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
    const loadList = useCallback(async (kategori: DokumenKategori, initialSearch = '') => {
        const sessionRoleRaw = sessionStorage.getItem('userRole') || '';
        const sessionRoles = sessionRoleRaw.split(',').map(r => r.trim().toUpperCase()).filter(Boolean);
        const sessionIsSuperHuman = hasSuperHumanRole(sessionRoles);
        const sessionCanViewAllBranches = canViewAllBranches(sessionRoles, sessionIsSuperHuman);
        setSelectedPengawasanGroupKey(null);
        if (kategori === 'PROJECT_PLANNING' && !sessionCanViewAllBranches && !canAccessProjectPlanningByCabang(sessionStorage.getItem('loggedInUserCabang') || '')) {
            showToast('Project Planning sementara hanya dapat diakses oleh user cabang HEAD OFFICE.', 'error');
            return;
        }
        setIsLoading(true);
        setSearchQuery(initialSearch);
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
                const ganttRes = await fetchGanttList();
                const gMap = new Map();
                (ganttRes.data ?? []).forEach((g: any) => gMap.set(g.id, g));
                docs = normalizePengawasanDocs(res.data ?? [], gMap);
            } else if (kategori === 'BERKAS_SERAH_TERIMA') {
                const res = await fetchBerkasSerahTerimaList();
                docs = normalizeBerkasSerahTerimaDocs(res.data ?? []);
            } else if (kategori === 'INSTRUKSI_LAPANGAN') {
                const res = await fetchInstruksiLapanganList();
                docs = normalizeInstruksiLapanganDocs(res.data ?? []);
            } else if (kategori === 'PROJECT_PLANNING') {
                const res = await fetchProjekPlanningList();
                docs = normalizeProjekPlanningDocs(res.data ?? []);
            } else if (kategori === 'DOKUMENTASI_BANGUNAN') {
                const res = await fetchDokumentasiBangunanList();
                docs = normalizeDokumentasiBangunanDocs(res.data ?? []);
            }

            // Filter by cabang for users without global branch visibility.
            const upperUserCabang = (sessionStorage.getItem('loggedInUserCabang') || '').toUpperCase();
            if (upperUserCabang && !sessionCanViewAllBranches) {
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
            setSearchQuery(initialSearch);
        } catch (err: any) {
            showToast(err.message || 'Gagal memuat data.', 'error');
            setListData([]);
        } finally {
            setIsLoading(false);
        }
    }, [userInfo.cabang, userInfo.nama_pt, userInfo.email, isContractor, isDirektur, showToast]);

    useEffect(() => {
        if (hasAppliedQueryParams || typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const kategori = params.get('kategori') as DokumenKategori | null;
        const query = params.get('q') || '';

        setHasAppliedQueryParams(true);
        if (!kategori || !(kategori in KATEGORI_CONFIG)) return;

        setSelectedKategori(kategori);
        setSelectedDetail(null);
        setSelectedPengawasanGroupKey(null);
        setActiveView('list');
        loadList(kategori, query);
    }, [hasAppliedQueryParams, loadList]);

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
                    total_nilai:         Math.max(0, parseCurrency(d.opname_final.grand_total_opname) - parseCurrency(d.opname_final.nilai_denda)),
                    created_at:          d.opname_final.created_at,
                    link_pdf:            d.opname_final.link_pdf_opname,
                    grand_total_opname:  d.opname_final.grand_total_opname,
                    grand_total_rab:     d.opname_final.grand_total_rab,
                    hari_denda:          Number(d.opname_final.hari_denda ?? 0),
                    nilai_denda:         d.opname_final.nilai_denda,
                    tanggal_akhir_spk_denda: d.opname_final.tanggal_akhir_spk_denda,
                    tanggal_serah_terima_denda: d.opname_final.tanggal_serah_terima_denda,
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
                let ganttInfo: any = null;
                let actualTanggal = doc.tanggal_pengawasan;

                if (doc.id_gantt) {
                    try {
                        const gRes = await fetchGanttDetail(doc.id_gantt);
                        ganttInfo = gRes.data;
                        const pengawasanArr = gRes.data.pengawasan || [];
                        const pItem = pengawasanArr.find((p: any) => p.id === doc.id_pengawasan_gantt);
                        if (pItem?.tanggal_pengawasan) {
                            actualTanggal = pItem.tanggal_pengawasan;
                        }
                    } catch (e) { console.error("Gagal load gantt detail for pengawasan", e); }
                }

                const first = doc.grouped_items?.[0] || doc;

                detail = {
                    id: doc.id,
                    tipe: 'PENGAWASAN',
                    nomor_ulok:        ganttInfo?.toko?.nomor_ulok ?? doc.nomor_ulok,
                    nama_toko:         ganttInfo?.toko?.nama_toko ?? doc.nama_toko,
                    cabang:            ganttInfo?.toko?.cabang ?? doc.cabang,
                    proyek:            ganttInfo?.toko?.proyek ?? doc.proyek,
                    status:            doc.status,
                    email_pembuat:     '-',
                    total_nilai:       0,
                    created_at:        first?.created_at || doc.created_at,
                    tanggal_pengawasan: actualTanggal,
                    link_pdf:          first?.berkas_pengawasan?.link_pdf_pengawasan ?? doc.link_pdf,
                    link_pdf_pengawasan: first?.berkas_pengawasan?.link_pdf_pengawasan ?? doc.link_pdf,
                    id_gantt:          doc.id_gantt,
                    id_pengawasan_gantt: doc.id_pengawasan_gantt,
                    pengawasan_items:  doc.grouped_items || [],
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
                    total_nilai:       parseCurrency(d.grand_total_final ?? d.grand_total),
                    grand_total:       d.grand_total,
                    grand_total_non_sbo: d.grand_total_non_sbo,
                    grand_total_final: d.grand_total_final,
                    created_at:        d.created_at || d.timestamp || doc.created_at,
                    link_pdf_gabungan: d.link_pdf_gabungan,
                    link_pdf_non_sbo:  d.link_pdf_non_sbo,
                    link_pdf_rekapitulasi: d.link_pdf_rekapitulasi,
                    link_lampiran_pendukung: d.link_lampiran,
                    approval_koordinator: { pemberi: d.pemberi_persetujuan_koordinator, waktu: d.waktu_persetujuan_koordinator },
                    approval_manager:     { pemberi: d.pemberi_persetujuan_manager,     waktu: d.waktu_persetujuan_manager },
                    alasan_penolakan:    d.alasan_penolakan,
                    items: (d.items ?? []).map((it: any) => ({
                        id: it.id,
                        kategori:        it.kategori_pekerjaan || '-',
                        jenis_pekerjaan: it.item_pekerjaan || it.jenis_pekerjaan || '-',
                        satuan:          it.satuan || '-',
                        volume:          it.volume || 0,
                        harga_material:  it.harga_material || 0,
                        harga_upah:      it.harga_upah || 0,
                        total:           it.total_harga || ((Number(it.volume) || 0) * ((Number(it.harga_material) || 0) + (Number(it.harga_upah) || 0))),
                        catatan:         it.instruksi || it.keterangan || it.catatan || '-',
                    })),
                };
            } else if (doc.tipe === 'PROJECT_PLANNING') {
                const res = await fetchProjekPlanningDetail(doc.id);
                const d = res.data.projek;
                detail = {
                    id: d.id,
                    tipe: 'PROJECT_PLANNING',
                    nomor_ulok:        d.nomor_ulok || doc.nomor_ulok,
                    nama_toko:         d.nama_toko || doc.nama_toko,
                    cabang:            d.cabang || doc.cabang,
                    proyek:            d.proyek || doc.proyek,
                    status:            d.status,
                    email_pembuat:     d.email_pembuat,
                    total_nilai:       parseCurrency(d.estimasi_biaya),
                    created_at:        d.created_at,
                    jenis_proyek_pp:         d.jenis_proyek ?? undefined,
                    jenis_pengajuan_pp:      d.jenis_pengajuan ?? undefined,
                    jenis_pengajuan_lainnya_pp: d.jenis_pengajuan_lainnya ?? undefined,
                    nama_pengaju_pp:         d.nama_pengaju ?? undefined,
                    nama_lokasi_pp:          d.nama_lokasi ?? undefined,
                    estimasi_biaya_pp:       d.estimasi_biaya ?? undefined,
                    keterangan_pp:           d.keterangan ?? undefined,
                    link_fpd_pp:             d.link_fpd,
                    link_desain_3d_pp:       d.link_desain_3d,
                    link_gambar_kerja_pp:    d.link_gambar_kerja,
                    link_rab_pp:             d.link_rab,
                    link_fpd_approved_pp:    d.link_fpd_approved,
                    link_gambar_rab_sipil_pp: d.link_gambar_rab_sipil,
                    link_gambar_rab_me_pp:   d.link_gambar_rab_me,
                    link_gambar_kompetitor_pp: d.link_gambar_kompetitor,
                    link_google_maps_pp:     d.link_google_maps,
                    link_rab_sipil_pp:       d.link_rab_sipil,
                    link_rab_me_pp:          d.link_rab_me,
                    link_gambar_kerja_final_pp: d.link_gambar_kerja_final,
                    link_gambar_kerja_final_sipil_pp: d.link_gambar_kerja_final_sipil,
                    link_gambar_kerja_final_me_pp: d.link_gambar_kerja_final_me,
                    foto_items_pp:           d.foto_items ?? [],
                    butuh_desain_3d_pp:      d.butuh_desain_3d,
                    bm_approval_pp:    { pemberi: d.bm_approver_email, waktu: d.bm_waktu_persetujuan },
                    pp1_approval:      { pemberi: d.pp1_approver_email, waktu: d.pp1_waktu_persetujuan },
                    pp2_approval:      { pemberi: d.pp2_approver_email, waktu: d.pp2_waktu_persetujuan },
                    pp_manager_approval: { pemberi: d.pp_manager_approver_email, waktu: d.pp_manager_waktu_persetujuan },
                };
            } else if (doc.tipe === 'DOKUMENTASI_BANGUNAN') {
                const res = await fetchDokumentasiBangunanDetail(doc.id);
                const d = res.data.dokumentasi;
                detail = {
                    id: d.id,
                    tipe: 'DOKUMENTASI_BANGUNAN',
                    nomor_ulok:        d.nomor_ulok || doc.nomor_ulok,
                    nama_toko:         d.nama_toko || doc.nama_toko,
                    cabang:            d.cabang || doc.cabang,
                    proyek:            '-',
                    status:            d.status_validasi || doc.status,
                    email_pembuat:     d.email_pengirim || doc.email_pembuat,
                    total_nilai:       0,
                    created_at:        d.created_at || doc.created_at,
                    kode_toko:         d.kode_toko,
                    tanggal_go:        d.tanggal_go,
                    tanggal_serah_terima: d.tanggal_serah_terima,
                    tanggal_ambil_foto: d.tanggal_ambil_foto,
                    spk_awal:          d.spk_awal,
                    spk_akhir:         d.spk_akhir,
                    kontraktor_sipil:  d.kontraktor_sipil,
                    kontraktor_me:     d.kontraktor_me,
                    email_pengirim:    d.email_pengirim,
                    status_validasi:   d.status_validasi,
                    alasan_revisi:     d.alasan_revisi,
                    pic_dokumentasi:   d.pic_dokumentasi,
                    link_pdf:          d.link_pdf,
                    dokumentasi_items: res.data.items || [],
                };
            }

            if (detail) {
                const logs = await fetchActivityLogs(detail.tipe, detail.id)
                    .then(res => res.data)
                    .catch(() => []);
                detail = { ...detail, activity_logs: logs };
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
            } else if (tipe === 'PERTAMBAHAN_SPK') {
                await downloadPertambahanSPKPdf(id);
            } else if (tipe === 'OPNAME_FINAL') {
                await downloadOpnameFinalPdf(id);
            } else if (tipe === 'PENGAWASAN') {
                await downloadPengawasanPdf(id);
            } else if (tipe === 'INSTRUKSI_LAPANGAN') {
                await downloadInstruksiLapanganPdf(id);
            } else if (tipe === 'PROJECT_PLANNING') {
                await downloadProjekPlanningPdf(id);
            } else if (tipe === 'BERKAS_SERAH_TERIMA') {
                await downloadSerahTerimaPdf(id);
            } else if (tipe === 'DOKUMENTASI_BANGUNAN') {
                await downloadDokumentasiBangunanPdf(id);
            }
            showToast('PDF berhasil diunduh.', 'success');
        } catch (err: any) {
            showToast(err.message || 'Gagal mengunduh PDF.', 'error');
        } finally {
            setDownloadingId(null);
        }
    }, [showToast]);

    const handleViewPDFOnline = useCallback(async (detail: NormalizedDetail) => {
        try {
            if ((detail.tipe === 'RAB' || detail.tipe === 'SPK') && detail.link_pdf) {
                window.open(detail.link_pdf, '_blank', 'noopener,noreferrer');
                return;
            }

            if (
                detail.tipe === 'OPNAME_FINAL' ||
                detail.tipe === 'INSTRUKSI_LAPANGAN' ||
                detail.tipe === 'PROJECT_PLANNING' ||
                detail.tipe === 'BERKAS_SERAH_TERIMA' ||
                detail.tipe === 'DOKUMENTASI_BANGUNAN' ||
                detail.tipe === 'PENGAWASAN' ||
                detail.tipe === 'PERTAMBAHAN_SPK'
            ) {
                await viewGeneratedPdfOnline(detail.id, detail.tipe);
                return;
            }

            showToast('PDF online belum tersedia untuk dokumen ini.', 'error');
        } catch (err: any) {
            showToast(err.message || 'Gagal membuka PDF online.', 'error');
        }
    }, [showToast]);

    const handleDownloadProjectPlanningAttachment = useCallback(async (field: string, itemIndex?: number) => {
        if (!selectedDetail || selectedDetail.tipe !== 'PROJECT_PLANNING') return;
        setDownloadingId(selectedDetail.id);
        try {
            await proxyProjekPlanningFile(selectedDetail.id, field, 'download', itemIndex);
        } catch (err: any) {
            showToast(err.message || 'Gagal mengunduh dokumen.', 'error');
        } finally {
            setDownloadingId(null);
        }
    }, [selectedDetail, showToast]);

    const handleViewProjectPlanningAttachment = useCallback(async (field: string, itemIndex?: number) => {
        if (!selectedDetail || selectedDetail.tipe !== 'PROJECT_PLANNING') return;
        try {
            await proxyProjekPlanningFile(selectedDetail.id, field, 'view', itemIndex);
        } catch (err: any) {
            showToast(err.message || 'Gagal membuka dokumen.', 'error');
        }
    }, [selectedDetail, showToast]);

    // =========================================================================
    // NAVIGATION
    // =========================================================================
    const handleSelectKategori = (kat: DokumenKategori) => {
        setSelectedKategori(kat);
        setSelectedDetail(null);
        setSelectedPengawasanGroupKey(null);
        setActiveView('list');
        loadList(kat);
    };

    const handleBackToMenu = () => {
        setActiveView('menu');
        setSelectedKategori(null);
        setListData([]);
        setSelectedDetail(null);
        setSelectedPengawasanGroupKey(null);
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
        { value: 'Menunggu Gantt Chart', label: 'Menunggu Gantt Chart' },
        { value: 'Ditolak oleh Koordinator', label: 'Ditolak oleh Koordinator' },
        { value: 'Ditolak oleh Manajer', label: 'Ditolak oleh Manajer' },
        { value: 'Ditolak oleh Direktur Kontraktor', label: 'Ditolak oleh Direktur Kontraktor' },
        { value: 'Ditolak oleh Direktur', label: 'Ditolak oleh Direktur (lama)' },
    ];

    const SPK_STATUS_OPTIONS: Array<{ value: 'WAITING_FOR_BM_APPROVAL' | 'SPK_APPROVED' | 'SPK_REJECTED'; label: string }> = [
        { value: 'SPK_REJECTED', label: 'Ditolak untuk Revisi' },
        { value: 'WAITING_FOR_BM_APPROVAL', label: 'Menunggu Persetujuan Branch Manager' },
        { value: 'SPK_APPROVED', label: 'Disetujui' },
    ];

    const handleUpdateRABStatus = useCallback(async () => {
        if (!selectedDetail || !selectedNewStatus || !selectedDetail.id_toko) return;
        setIsUpdatingStatus(true);
        try {
            await updateRABStatus({
                id_toko: selectedDetail.id_toko,
                id_rab: selectedDetail.id,
                status: selectedNewStatus,
                actor_email: userInfo.email || undefined,
                actor_role: userInfo.role || undefined,
                alasan_intervensi: isSuperHuman ? rabInterventionReason.trim() || undefined : undefined,
            });
            const freshLogs = await fetchActivityLogs('RAB', selectedDetail.id).then(res => res.data).catch(() => []);
            showToast(`Status RAB berhasil diubah menjadi "${selectedNewStatus}".`, 'success');
            // Update local state
            setSelectedDetail(prev => prev ? { ...prev, status: selectedNewStatus, activity_logs: freshLogs } : null);
            setListData(prev => prev.map(d =>
                d.id === selectedDetail.id && d.tipe === 'RAB' ? { ...d, status: selectedNewStatus } : d
            ));
            setShowStatusModal(false);
            setSelectedNewStatus('');
            setRabInterventionReason('');
        } catch (err: any) {
            showToast(err.message || 'Gagal memperbarui status RAB.', 'error');
        } finally {
            setIsUpdatingStatus(false);
        }
    }, [fetchActivityLogs, isSuperHuman, rabInterventionReason, selectedDetail, selectedNewStatus, showToast, userInfo.email, userInfo.role]);

    const handleInterveneSPKStatus = useCallback(async () => {
        if (!selectedDetail || selectedDetail.tipe !== 'SPK') return;
        if (selectedDetail.status === spkInterventionStatus) {
            showToast('Status SPK sudah sama dengan target intervensi.', 'error');
            return;
        }

        setIsInterveningSPK(true);
        const oldStatus = selectedDetail.status;
        const targetStatus = spkInterventionStatus;
        const reason = spkInterventionReason.trim();
        const logReason = reason
            ? `[INTERVENSI SUPER HUMAN] ${oldStatus} -> ${targetStatus}. ${reason}`
            : `[INTERVENSI SUPER HUMAN] ${oldStatus} -> ${targetStatus}`;

        try {
            await interveneSPKStatus(selectedDetail.id, {
                actor_email: userInfo.email,
                actor_role: userInfo.role,
                target_status: targetStatus,
                alasan_intervensi: reason || undefined,
            });

            const fresh = await fetchSPKDetail(selectedDetail.id).catch(() => null);
            const freshPengajuan = fresh?.data?.pengajuan;
            const freshLogs = fresh?.data?.approvalLogs;
            const freshActivityLogs = await fetchActivityLogs('SPK', selectedDetail.id).then(res => res.data).catch(() => []);

            setSelectedDetail(prev => prev ? {
                ...prev,
                status: freshPengajuan?.status ?? targetStatus,
                alasan_penolakan: freshPengajuan?.alasan_penolakan ?? (targetStatus === 'SPK_REJECTED' ? logReason : null),
                approver_email: freshPengajuan?.approver_email ?? (targetStatus === 'SPK_APPROVED' ? userInfo.email : null),
                waktu_persetujuan: freshPengajuan?.waktu_persetujuan ?? (targetStatus === 'SPK_APPROVED' ? new Date().toISOString() : null),
                link_pdf: freshPengajuan?.link_pdf ?? (targetStatus === 'SPK_APPROVED' ? prev.link_pdf : null),
                approval_logs: freshLogs ? freshLogs.map(log => ({
                    approver_email: log.approver_email,
                    tindakan: log.tindakan,
                    alasan_penolakan: log.alasan_penolakan,
                    waktu_tindakan: log.waktu_tindakan,
                })) : [
                    ...(prev.approval_logs ?? []),
                    {
                        approver_email: userInfo.email,
                        tindakan: targetStatus === 'SPK_APPROVED' ? 'APPROVE' : 'REJECT',
                        alasan_penolakan: logReason,
                        waktu_tindakan: new Date().toISOString(),
                    },
                ],
                activity_logs: freshActivityLogs,
            } : null);

            setListData(prev => prev.map(d =>
                d.id === selectedDetail.id && d.tipe === 'SPK'
                    ? { ...d, status: targetStatus, link_pdf: targetStatus === 'SPK_APPROVED' ? d.link_pdf : null }
                    : d
            ));
            setSpkInterventionReason('');
            setShowSpkInterventionModal(false);
            showToast(`Intervensi SPK berhasil: ${oldStatus} menjadi ${targetStatus}.`, 'success');
        } catch (err: any) {
            showToast(err.message || 'Gagal melakukan intervensi SPK.', 'error');
        } finally {
            setIsInterveningSPK(false);
        }
    }, [fetchActivityLogs, selectedDetail, spkInterventionReason, spkInterventionStatus, showToast, userInfo.email, userInfo.role]);

    // =========================================================================
    // FILTERED LIST
    // =========================================================================
    // Static cabang options based on user role/group
    const cabangOptions = useMemo(() => {
        const upper = userInfo.cabang?.toUpperCase();
        if (!upper) return [];
        const canSeeAllBranches = canViewAllBranches(userInfo.role, isSuperHuman);
        if (canSeeAllBranches) {
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
    }, [userInfo.cabang, userInfo.role, isSuperHuman]);

    const canSeeAllBranches = canViewAllBranches(userInfo.role, isSuperHuman);
    const isHO = userInfo.cabang?.toUpperCase() === 'HEAD OFFICE';
    const isGlobalViewOnly = isViewOnlyUser(userInfo.role, isSuperHuman);
    const isHeadGroup = useMemo(() => {
        if (!userInfo.cabang) return false;
        const upper = userInfo.cabang.toUpperCase();
        return Object.values(BRANCH_GROUPS).some(grp => grp.includes(upper));
    }, [userInfo.cabang]);
    const showCabangFilter = canSeeAllBranches || isHeadGroup || isContractor || isDirektur;

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

    const pengawasanGroups = useMemo<PengawasanDocGroup[]>(() => {
        if (selectedKategori !== 'PENGAWASAN') return [];

        const groups = new Map<string, NormalizedDoc[]>();
        filteredList.forEach((doc) => {
            const key = (doc.nomor_ulok || doc.nama_toko || String(doc.id)).trim().toUpperCase();
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(doc);
        });

        return Array.from(groups.entries()).map(([key, docs]) => {
            const sortedDocs = [...docs].sort((a, b) => {
                const da = parseDateValue(a.created_at)?.getTime() ?? 0;
                const db = parseDateValue(b.created_at)?.getTime() ?? 0;
                return db - da;
            });
            const first = sortedDocs[0];
            const statuses = sortedDocs.map(doc => (doc.status ?? '').toUpperCase());
            const status = statuses.some(statusValue => statusValue.includes('PROGRESS'))
                ? 'PROGRESS'
                : statuses.some(statusValue => statusValue.includes('TERLAMBAT'))
                    ? 'TERLAMBAT'
                    : 'SELESAI';

            return {
                key,
                nomor_ulok: first?.nomor_ulok ?? '-',
                nama_toko: first?.nama_toko ?? '-',
                cabang: first?.cabang ?? '-',
                proyek: first?.proyek ?? '-',
                status,
                latest_created_at: first?.created_at ?? '',
                docs: sortedDocs
            };
        }).sort((a, b) => {
            const da = parseDateValue(a.latest_created_at)?.getTime() ?? 0;
            const db = parseDateValue(b.latest_created_at)?.getTime() ?? 0;
            return db - da;
        });
    }, [filteredList, selectedKategori]);

    const selectedPengawasanGroup = useMemo(
        () => pengawasanGroups.find(group => group.key === selectedPengawasanGroupKey) ?? null,
        [pengawasanGroups, selectedPengawasanGroupKey]
    );

    const visibleList = selectedKategori === 'PENGAWASAN' && selectedPengawasanGroup
        ? selectedPengawasanGroup.docs
        : filteredList;

    // =========================================================================
    // RENDER
    // =========================================================================
    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">



            {/* STATUS UPDATE MODAL (HO / SUPER HUMAN) */}
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
                            {isSuperHuman && (
                                <div>
                                    <label className="text-sm font-medium text-slate-600 mb-2 block">Alasan Intervensi</label>
                                    <textarea
                                        value={rabInterventionReason}
                                        onChange={(event) => setRabInterventionReason(event.target.value)}
                                        placeholder="Tulis alasan perubahan status oleh Super Human..."
                                        className="min-h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                    />
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => { setShowStatusModal(false); setSelectedNewStatus(''); setRabInterventionReason(''); }}
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

            {/* SPK STATUS INTERVENTION MODAL (SUPER HUMAN ONLY) */}
            {showSpkInterventionModal && selectedDetail && selectedDetail.tipe === 'SPK' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="px-6 py-4 bg-linear-to-r from-red-50 to-red-100/50 border-b border-red-100">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                Ubah Status SPK
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {selectedDetail.nama_toko} — {selectedDetail.nomor_ulok}
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-sm font-medium text-slate-600 mb-1">Status Saat Ini</p>
                                <Badge className={`${getStatusBadgeClass(selectedDetail.status)} font-semibold text-xs border px-3 py-1`}>
                                    {getStatusLabel(selectedDetail.status)}
                                </Badge>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-600 mb-2 block">Ubah Menjadi</label>
                                <div className="space-y-2">
                                    {SPK_STATUS_OPTIONS.map(opt => (
                                        <label
                                            key={opt.value}
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                spkInterventionStatus === opt.value
                                                    ? 'border-red-400 bg-red-50'
                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                            } ${selectedDetail.status === opt.value ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="spk-status"
                                                value={opt.value}
                                                checked={spkInterventionStatus === opt.value}
                                                disabled={selectedDetail.status === opt.value}
                                                onChange={() => setSpkInterventionStatus(opt.value)}
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
                                    onClick={() => setShowSpkInterventionModal(false)}
                                    disabled={isInterveningSPK}
                                >
                                    Batal
                                </Button>
                                <Button
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                    disabled={selectedDetail.status === spkInterventionStatus || isInterveningSPK}
                                    onClick={handleInterveneSPKStatus}
                                >
                                    {isInterveningSPK ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <AlertTriangle className="w-4 h-4 mr-2" />
                                    )}
                                    {isInterveningSPK ? 'Memproses...' : 'Konfirmasi'}
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
                                // PP-only roles: hanya tampilkan card PROJECT_PLANNING
                                if (isPPOnly && kat !== 'PROJECT_PLANNING') return false;
                                // Hide PROJECT_PLANNING dari KONTRAKTOR dan DIREKTUR
                                if (kat === 'PROJECT_PLANNING' && (isContractor || isDirektur)) return false;
                                if (kat === 'PROJECT_PLANNING' && !canViewAllBranches(userInfo.role, isSuperHuman) && !canAccessProjectPlanningByCabang(userInfo.cabang)) return false;
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
                                        {selectedKategori === 'PENGAWASAN' && selectedPengawasanGroup
                                            ? `Menampilkan ${visibleList.length} dokumen untuk ${selectedPengawasanGroup.nomor_ulok}`
                                            : selectedKategori === 'PENGAWASAN'
                                                ? `Menampilkan ${pengawasanGroups.length} ULOK dari ${filteredList.length} dokumen`
                                                : `Menampilkan ${filteredList.length} dari ${listData.length} dokumen`}
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
                                    placeholder="Cari ULOK, toko, dokumen, email, atau kontraktor..."
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
                        ) : (selectedKategori === 'PENGAWASAN' && !selectedPengawasanGroup ? pengawasanGroups.length === 0 : visibleList.length === 0) ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                    <FileText className="w-8 h-8 text-slate-300" />
                                </div>
                                <p className="text-slate-500 font-semibold">Tidak ada dokumen ditemukan</p>
                                <p className="text-sm text-slate-400 mt-1">Coba ubah filter pencarian Anda</p>
                            </div>
                        ) : (
                            <>
                            {selectedKategori === 'PENGAWASAN' && selectedPengawasanGroup && (
                                <div className="mb-3">
                                    <Button
                                        variant="outline"
                                        className="h-9"
                                        onClick={() => setSelectedPengawasanGroupKey(null)}
                                    >
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Grup ULOK
                                    </Button>
                                </div>
                            )}
                            <div className="grid gap-3">
                                {selectedKategori === 'PENGAWASAN' && !selectedPengawasanGroup ? pengawasanGroups.map(group => (
                                    <div
                                        key={group.key}
                                        className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
                                        onClick={() => setSelectedPengawasanGroupKey(group.key)}
                                    >
                                        <div className="p-4 md:p-5">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                                    <div className={`w-10 h-10 rounded-xl ${KATEGORI_CONFIG[selectedKategori].bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                                                        <div className={`${KATEGORI_CONFIG[selectedKategori].color}`}>
                                                            <FilePlus className="w-5 h-5" />
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-slate-800 text-sm">{group.nomor_ulok}</span>
                                                            <Badge className={`${getStatusBadgeClass(group.status)} text-[10px] font-semibold border px-2 py-0`}>
                                                                {getStatusLabel(group.status)}
                                                            </Badge>
                                                            <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-semibold border px-2 py-0">
                                                                {group.docs.length} memo
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-slate-600 truncate mt-0.5">{group.nama_toko}</p>
                                                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                                <CalendarDays className="w-3 h-3" /> Terakhir {formatDate(group.latest_created_at)}
                                                            </span>
                                                            {group.proyek && group.proyek !== '-' && (
                                                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                                    <Building2 className="w-3 h-3" /> {group.proyek}
                                                                </span>
                                                            )}
                                                            {group.cabang && group.cabang !== '-' && (
                                                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                                    <Building2 className="w-3 h-3" /> {group.cabang}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0 md:pl-4">
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-slate-800">{group.docs.length} Dokumen</p>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">Klik untuk melihat detail</p>
                                                    </div>
                                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )) : visibleList.map(doc => (
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
                                                                : selectedKategori === 'PROJECT_PLANNING'
                                                                ? <ClipboardList className="w-5 h-5" />
                                                                : <FilePlus className="w-5 h-5" />
                                                            }
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-slate-800 text-sm">{doc.nomor_ulok}</span>
                                                            {selectedKategori !== 'DOKUMENTASI_BANGUNAN' && (
                                                                <Badge className={`${getStatusBadgeClass(doc.status)} text-[10px] font-semibold border px-2 py-0`}>
                                                                    {getStatusLabel(doc.status)}
                                                                </Badge>
                                                            )}
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
                                                            {doc.email_pembuat !== '-' && (
                                                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                                    <User className="w-3 h-3" /> {doc.email_pembuat}
                                                                </span>
                                                            )}
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
                                                        {selectedKategori === 'PERTAMBAHAN_SPK' ? (
                                                            <p className="text-sm font-bold text-slate-800">+{doc.pertambahan_hari || '-'} Hari</p>
                                                        ) : (
                                                            selectedKategori !== 'PENGAWASAN'
                                                            && selectedKategori !== 'DOKUMENTASI_BANGUNAN'
                                                            && doc.total_nilai > 0
                                                            && (
                                                                <p className="text-sm font-bold text-slate-800">
                                                                    {formatRupiah(doc.total_nilai)}
                                                                </p>
                                                            )
                                                        )}
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
                            </>
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
                                        : selectedDetail.tipe === 'PROJECT_PLANNING' ? 'bg-linear-to-r from-cyan-50 to-cyan-100/50 border-b border-cyan-100'
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
                                                    : selectedDetail.tipe === 'PROJECT_PLANNING' ? 'bg-cyan-100'
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
                                                        : selectedDetail.tipe === 'PROJECT_PLANNING'
                                                        ? <ClipboardList className="w-5 h-5 text-cyan-600" />
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
                                                        : selectedDetail.tipe === 'PROJECT_PLANNING' ? 'Detail Project Planning'
                                                        : 'Detail Dokumen'}
                                                    </h3>
                                                    <p className="text-sm text-slate-500">ID: {selectedDetail.id}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {selectedDetail.tipe !== 'DOKUMENTASI_BANGUNAN' && (
                                                    <Badge className={`${getStatusBadgeClass(selectedDetail.status)} font-semibold text-xs border px-3 py-1`}>
                                                        {getStatusLabel(selectedDetail.status)}
                                                    </Badge>
                                                )}
                                                {(isHO || isSuperHuman) && !isGlobalViewOnly && selectedDetail.tipe === 'RAB' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-7"
                                                        onClick={() => { setShowStatusModal(true); setSelectedNewStatus(''); setRabInterventionReason(''); }}
                                                    >
                                                        <AlertTriangle className="w-3 h-3 mr-1" /> Ubah Status
                                                    </Button>
                                                )}
                                                {isSuperHuman && selectedDetail.tipe === 'SPK' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-7"
                                                        onClick={() => {
                                                            const nextStatus = selectedDetail.status === 'SPK_REJECTED' ? 'WAITING_FOR_BM_APPROVAL' : 'SPK_REJECTED';
                                                            setSpkInterventionStatus(nextStatus);
                                                            setSpkInterventionReason('');
                                                            setShowSpkInterventionModal(true);
                                                        }}
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
                                            {/* Pengawasan-specific fields */}
                                            {selectedDetail.tipe === 'PENGAWASAN' && (
                                                <>
                                                    {selectedDetail.id_gantt && (
                                                        <InfoRow icon={<Hash className="w-4 h-4" />} label="ID Gantt" value={selectedDetail.id_gantt.toString()} />
                                                    )}
                                                    {selectedDetail.id_pengawasan_gantt && (
                                                        <InfoRow icon={<Hash className="w-4 h-4" />} label="ID Pengawasan Gantt" value={selectedDetail.id_pengawasan_gantt.toString()} />
                                                    )}
                                                    {selectedDetail.tanggal_pengawasan && (
                                                        <InfoRow icon={<CalendarDays className="w-4 h-4" />} label="Tanggal Pengawasan" value={selectedDetail.tanggal_pengawasan} />
                                                    )}
                                                </>
                                            )}
                                            {/* Project Planning-specific fields */}
                                            {selectedDetail.tipe === 'PROJECT_PLANNING' && (
                                                <>
                                                    {selectedDetail.nama_pengaju_pp && (
                                                        <InfoRow icon={<User className="w-4 h-4" />} label="Nama Pengaju" value={selectedDetail.nama_pengaju_pp} />
                                                    )}
                                                    {selectedDetail.nama_lokasi_pp && (
                                                        <InfoRow icon={<Building2 className="w-4 h-4" />} label="Nama Lokasi" value={selectedDetail.nama_lokasi_pp} />
                                                    )}
                                                    {selectedDetail.jenis_proyek_pp && (
                                                        <InfoRow icon={<FileText className="w-4 h-4" />} label="Jenis Proyek" value={selectedDetail.jenis_proyek_pp} />
                                                    )}
                                                    {selectedDetail.jenis_pengajuan_pp && (
                                                        <InfoRow icon={<ClipboardList className="w-4 h-4" />} label="Jenis Pengajuan" value={selectedDetail.jenis_pengajuan_lainnya_pp ? `${selectedDetail.jenis_pengajuan_pp} — ${selectedDetail.jenis_pengajuan_lainnya_pp}` : selectedDetail.jenis_pengajuan_pp} />
                                                    )}
                                                    {/* Estimasi biaya di-hide untuk sementara */}
                                                    {selectedDetail.keterangan_pp && (
                                                        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
                                                            <InfoRow icon={<FileText className="w-4 h-4" />} label="Keterangan" value={selectedDetail.keterangan_pp} />
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {/* Dokumentasi Bangunan-specific fields */}
                                            {selectedDetail.tipe === 'DOKUMENTASI_BANGUNAN' && (
                                                <>
                                                    {selectedDetail.kode_toko && (
                                                        <InfoRow icon={<Hash className="w-4 h-4" />} label="Kode Toko" value={selectedDetail.kode_toko} />
                                                    )}
                                                    {selectedDetail.tanggal_go && (
                                                        <InfoRow icon={<CalendarDays className="w-4 h-4" />} label="Tanggal GO" value={formatDateFull(selectedDetail.tanggal_go)} />
                                                    )}
                                                    {selectedDetail.tanggal_serah_terima && (
                                                        <InfoRow icon={<CalendarDays className="w-4 h-4" />} label="Tanggal Serah Terima" value={formatDateFull(selectedDetail.tanggal_serah_terima)} />
                                                    )}
                                                    {selectedDetail.tanggal_ambil_foto && (
                                                        <InfoRow icon={<CalendarDays className="w-4 h-4" />} label="Tanggal Ambil Foto" value={formatDateFull(selectedDetail.tanggal_ambil_foto)} />
                                                    )}
                                                    {selectedDetail.spk_awal && (
                                                        <InfoRow icon={<Hash className="w-4 h-4" />} label="SPK Awal" value={selectedDetail.spk_awal} />
                                                    )}
                                                    {selectedDetail.spk_akhir && (
                                                        <InfoRow icon={<Hash className="w-4 h-4" />} label="SPK Akhir" value={selectedDetail.spk_akhir} />
                                                    )}
                                                    {selectedDetail.kontraktor_sipil && (
                                                        <InfoRow icon={<Building2 className="w-4 h-4" />} label="Kontraktor Sipil" value={selectedDetail.kontraktor_sipil} />
                                                    )}
                                                    {selectedDetail.kontraktor_me && (
                                                        <InfoRow icon={<Building2 className="w-4 h-4" />} label="Kontraktor ME" value={selectedDetail.kontraktor_me} />
                                                    )}
                                                    {selectedDetail.pic_dokumentasi && (
                                                        <InfoRow icon={<User className="w-4 h-4" />} label="PIC Dokumentasi" value={selectedDetail.pic_dokumentasi} />
                                                    )}
                                                    {selectedDetail.email_pengirim && (
                                                        <InfoRow icon={<User className="w-4 h-4" />} label="Email Pengirim" value={selectedDetail.email_pengirim} />
                                                    )}
                                                    {selectedDetail.alasan_revisi && (
                                                        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
                                                            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
                                                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                                                <div>
                                                                    <p className="text-[11px] text-red-400 font-medium uppercase tracking-wide">Alasan Revisi</p>
                                                                    <p className="text-sm text-red-700 font-semibold">{selectedDetail.alasan_revisi}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Nilai Kontrak Card — hide for PERTAMBAHAN_SPK, PENGAWASAN, PROJECT_PLANNING & DOKUMENTASI_BANGUNAN */}
                                {selectedDetail.tipe !== 'PERTAMBAHAN_SPK' && selectedDetail.tipe !== 'PENGAWASAN' && selectedDetail.tipe !== 'PROJECT_PLANNING' && selectedDetail.tipe !== 'DOKUMENTASI_BANGUNAN' && (
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
                                        {(selectedDetail.tipe === 'RAB' || selectedDetail.tipe === 'INSTRUKSI_LAPANGAN') && (
                                            <div className="flex flex-wrap gap-4 mt-3 text-sm">
                                                {selectedDetail.grand_total && (
                                                    <div>
                                                        <span className="text-slate-400">Total: </span>
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
                                        {selectedDetail.tipe === 'OPNAME_FINAL' && (
                                            <div className="flex flex-wrap gap-4 mt-3 text-sm">
                                                <div>
                                                    <span className="text-slate-400">Subtotal Opname: </span>
                                                    <span className="font-semibold text-slate-700">{formatRupiah(parseCurrency(selectedDetail.grand_total_opname))}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400">Denda: </span>
                                                    <span className="font-semibold text-red-600">{formatRupiah(parseCurrency(selectedDetail.nilai_denda))}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400">Hari Denda: </span>
                                                    <span className="font-semibold text-slate-700">{selectedDetail.hari_denda ?? 0} hari</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                )}

                                {/* Approval Trail (RAB & INSTRUKSI_LAPANGAN) */}
                                {(selectedDetail.tipe === 'RAB' || selectedDetail.tipe === 'INSTRUKSI_LAPANGAN') && (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                        <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-5 bg-green-500 rounded-full" />
                                            Riwayat Persetujuan
                                        </h4>
                                        <div className="space-y-3">
                                            <ApprovalRow label="Koordinator" pemberi={selectedDetail.approval_koordinator?.pemberi} waktu={selectedDetail.approval_koordinator?.waktu} />
                                            <ApprovalRow label="Manager" pemberi={selectedDetail.approval_manager?.pemberi} waktu={selectedDetail.approval_manager?.waktu} />
                                            {selectedDetail.tipe === 'RAB' && (
                                                <ApprovalRow label="Direktur Kontraktor" pemberi={selectedDetail.approval_direktur?.pemberi} waktu={selectedDetail.approval_direktur?.waktu} />
                                            )}
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

                                {selectedDetail.activity_logs && selectedDetail.activity_logs.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                        <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
                                            Log Aktivitas
                                        </h4>
                                        <div className="space-y-3">
                                            {selectedDetail.activity_logs.map((log) => (
                                                <div key={log.id} className="flex items-start gap-3 text-sm">
                                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-slate-700 font-semibold">{log.actor_email || '-'}</span>
                                                            <Badge className="bg-amber-100 text-amber-700 text-[10px] font-semibold border-0">
                                                                {log.action.replaceAll('_', ' ')}
                                                            </Badge>
                                                            <span className="text-slate-400 text-xs">{formatDateFull(log.created_at)}</span>
                                                        </div>
                                                        {(log.status_before || log.status_after) && (
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                {log.status_before || '-'} &rarr; {log.status_after || '-'}
                                                            </p>
                                                        )}
                                                        {log.reason && (
                                                            <p className="text-red-500 text-xs mt-1 italic">{log.reason}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Approval Trail (PROJECT_PLANNING) */}
                                {selectedDetail.tipe === 'PROJECT_PLANNING' && (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                        <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-5 bg-cyan-500 rounded-full" />
                                            Riwayat Persetujuan
                                        </h4>
                                        <div className="space-y-3">
                                            <ApprovalRow label="B&M Manager" pemberi={selectedDetail.bm_approval_pp?.pemberi} waktu={selectedDetail.bm_approval_pp?.waktu} />
                                            <ApprovalRow label="PP Specialist" pemberi={selectedDetail.pp1_approval?.pemberi} waktu={selectedDetail.pp1_approval?.waktu} />
                                            <ApprovalRow label="PP Review" pemberi={selectedDetail.pp2_approval?.pemberi} waktu={selectedDetail.pp2_approval?.waktu} />
                                            <ApprovalRow label="PP Manager" pemberi={selectedDetail.pp_manager_approval?.pemberi} waktu={selectedDetail.pp_manager_approval?.waktu} />
                                        </div>
                                    </div>
                                )}

                                {/* Dokumen Lampiran (PROJECT_PLANNING) */}
                                {selectedDetail.tipe === 'PROJECT_PLANNING' && (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                        <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-5 bg-cyan-500 rounded-full" />
                                            Dokumen Lampiran
                                        </h4>
                                        {(() => {
                                            const koordinatorDocs: ProjectPlanningAttachment[] = [
                                                { label: 'Google Maps', url: selectedDetail.link_google_maps_pp, icon: <MapPin className="w-4 h-4" /> },
                                                { label: 'Gambar Kerja Sipil / FPD', url: selectedDetail.link_fpd_pp, field: 'fpd' },
                                                { label: 'Gambar Kerja ME', url: selectedDetail.link_gambar_kerja_pp, field: 'gambar_kerja_awal' },
                                                { label: 'RAB Sipil Awal', url: selectedDetail.link_gambar_rab_sipil_pp, field: 'rab_sipil_awal' },
                                                { label: 'RAB ME Awal', url: selectedDetail.link_gambar_rab_me_pp, field: 'rab_me_awal' },
                                                { label: 'Gambar Kompetitor', url: selectedDetail.link_gambar_kompetitor_pp, field: 'gambar_kompetitor' },
                                            ];
                                            const fotoDocs: ProjectPlanningAttachment[] = [
                                                ...(selectedDetail.foto_items_pp ?? []).map(foto => ({
                                                    label: `Foto Lokasi ${foto.item_index}`,
                                                    url: foto.link_foto,
                                                    field: 'foto_item',
                                                    itemIndex: foto.item_index,
                                                })),
                                            ];
                                            const ppDocs: ProjectPlanningAttachment[] = [
                                                { label: 'Desain 3D', url: selectedDetail.link_desain_3d_pp, field: 'desain_3d' },
                                                { label: 'Gambar Kerja Disetujui', url: selectedDetail.link_fpd_approved_pp, field: 'fpd_approved' },
                                            ];
                                            const finalDocs: ProjectPlanningAttachment[] = [
                                                { label: 'RAB Sipil Final', url: selectedDetail.link_rab_sipil_pp, field: 'rab_sipil_final' },
                                                { label: 'RAB ME Final', url: selectedDetail.link_rab_me_pp, field: 'rab_me_final' },
                                                { label: 'RAB Final', url: selectedDetail.link_rab_pp, field: 'rab' },
                                                { label: 'Gambar Kerja Final Sipil', url: selectedDetail.link_gambar_kerja_final_sipil_pp || selectedDetail.link_gambar_kerja_final_pp, field: 'gambar_kerja_final_sipil' },
                                                { label: 'Gambar Kerja Final ME', url: selectedDetail.link_gambar_kerja_final_me_pp, field: 'gambar_kerja_final_me' },
                                            ];
                                            const hasAnyDocs = [...koordinatorDocs, ...fotoDocs, ...ppDocs, ...finalDocs].some(doc => hasLink(doc.url));

                                            return hasAnyDocs ? (
                                                <div className="space-y-5">
                                                    <ProjectPlanningAttachmentGroup
                                                        title="Diunggah Koordinator"
                                                        items={koordinatorDocs}
                                                        onView={handleViewProjectPlanningAttachment}
                                                        onDownload={handleDownloadProjectPlanningAttachment}
                                                        isDownloading={downloadingId === selectedDetail.id}
                                                    />
                                                    <ProjectPlanningAttachmentGroup
                                                        title="Dokumentasi Foto Denah"
                                                        items={fotoDocs}
                                                        onView={handleViewProjectPlanningAttachment}
                                                        onDownload={handleDownloadProjectPlanningAttachment}
                                                        isDownloading={downloadingId === selectedDetail.id}
                                                    />
                                                    <ProjectPlanningAttachmentGroup
                                                        title="Diunggah PP Specialist"
                                                        items={ppDocs}
                                                        onView={handleViewProjectPlanningAttachment}
                                                        onDownload={handleDownloadProjectPlanningAttachment}
                                                        isDownloading={downloadingId === selectedDetail.id}
                                                    />
                                                    <ProjectPlanningAttachmentGroup
                                                        title="Diunggah Koordinator Final"
                                                        items={finalDocs}
                                                        onView={handleViewProjectPlanningAttachment}
                                                        onDownload={handleDownloadProjectPlanningAttachment}
                                                        isDownloading={downloadingId === selectedDetail.id}
                                                    />
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-400 italic">Belum ada dokumen lampiran.</p>
                                            );
                                        })()}
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

                                {/* Items Table (PENGAWASAN) */}
                                {selectedDetail.tipe === 'PENGAWASAN' && selectedDetail.pengawasan_items && selectedDetail.pengawasan_items.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
                                        <div className="px-6 py-4 border-b border-slate-100">
                                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                <div className="w-1.5 h-5 bg-indigo-500 rounded-full" />
                                                Daftar Pengawasan ({selectedDetail.pengawasan_items.length} item)
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
                                                        <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">Status</th>
                                                        <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">Dokumentasi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedDetail.pengawasan_items.map((item: any, idx: number) => (
                                                        <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                                                            <td className="px-4 py-2.5 text-center text-slate-400 whitespace-nowrap">{idx + 1}</td>
                                                            <td className="px-4 py-2.5 text-slate-600 font-medium text-xs whitespace-nowrap">{item.kategori_pekerjaan}</td>
                                                            <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{item.jenis_pekerjaan}</td>
                                                            <td className="px-4 py-2.5 text-slate-500 italic text-xs">{item.catatan || '-'}</td>
                                                            <td className="px-4 py-2.5 text-center whitespace-nowrap">
                                                                <Badge className={`${getStatusBadgeClass(item.status)} text-[10px] font-semibold border px-2 py-0`}>
                                                                    {getStatusLabel(item.status)}
                                                                </Badge>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center whitespace-nowrap">
                                                                {item.dokumentasi ? (
                                                                    <a href={item.dokumentasi} target="_blank" rel="noopener noreferrer">
                                                                        <Button variant="outline" size="sm" className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                                                                            <Eye className="w-3 h-3 mr-1" /> Lihat
                                                                        </Button>
                                                                    </a>
                                                                ) : '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Items Table (DOKUMENTASI_BANGUNAN) */}
                                {selectedDetail.tipe === 'DOKUMENTASI_BANGUNAN' && selectedDetail.dokumentasi_items && selectedDetail.dokumentasi_items.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
                                        <div className="px-6 py-4 border-b border-slate-100">
                                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
                                                Daftar Foto Dokumentasi ({selectedDetail.dokumentasi_items.length} item)
                                            </h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 text-slate-500">
                                                    <tr>
                                                        <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">No</th>
                                                        <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">Tanggal Diunggah</th>
                                                        <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedDetail.dokumentasi_items.map((item: any, idx: number) => (
                                                        <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                                                            <td className="px-4 py-2.5 text-center text-slate-400 whitespace-nowrap">{idx + 1}</td>
                                                            <td className="px-4 py-2.5 text-center text-slate-600 whitespace-nowrap">{formatDateFull(item.created_at)}</td>
                                                            <td className="px-4 py-2.5 text-center whitespace-nowrap">
                                                                {item.link_foto ? (
                                                                    <a href={item.link_foto} target="_blank" rel="noopener noreferrer">
                                                                        <Button variant="outline" size="sm" className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50">
                                                                            <Eye className="w-3 h-3 mr-1" /> Lihat Foto
                                                                        </Button>
                                                                    </a>
                                                                ) : '-'}
                                                            </td>
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
                                        {/* Download button for generated/stored PDFs */}
                                        {(
                                            (selectedDetail.tipe === 'RAB' && selectedDetail.link_pdf_gabungan) ||
                                            (selectedDetail.tipe === 'SPK' && selectedDetail.link_pdf) ||
                                            selectedDetail.tipe === 'PERTAMBAHAN_SPK' ||
                                            selectedDetail.tipe === 'OPNAME_FINAL' ||
                                            selectedDetail.tipe === 'PENGAWASAN' ||
                                            selectedDetail.tipe === 'INSTRUKSI_LAPANGAN' ||
                                            (selectedDetail.tipe === 'PROJECT_PLANNING') ||
                                            selectedDetail.tipe === 'BERKAS_SERAH_TERIMA' ||
                                            selectedDetail.tipe === 'DOKUMENTASI_BANGUNAN'
                                        ) && (
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

                                        {/* Additional PDF links */}
                                        {(selectedDetail.tipe === 'RAB' || selectedDetail.tipe === 'INSTRUKSI_LAPANGAN') && selectedDetail.link_pdf_gabungan && (
                                            <a href={selectedDetail.link_pdf_gabungan} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline">
                                                    <FileDown className="w-4 h-4 mr-2" /> PDF Gabungan
                                                </Button>
                                            </a>
                                        )}
                                        {(selectedDetail.tipe === 'RAB' || selectedDetail.tipe === 'INSTRUKSI_LAPANGAN') && selectedDetail.link_pdf_non_sbo && (
                                            <a href={selectedDetail.link_pdf_non_sbo} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline">
                                                    <FileDown className="w-4 h-4 mr-2" /> PDF Non-SBO
                                                </Button>
                                            </a>
                                        )}
                                        {(selectedDetail.tipe === 'RAB' || selectedDetail.tipe === 'INSTRUKSI_LAPANGAN') && selectedDetail.link_pdf_rekapitulasi && (
                                            <a href={selectedDetail.link_pdf_rekapitulasi} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline">
                                                    <FileDown className="w-4 h-4 mr-2" /> PDF Rekapitulasi
                                                </Button>
                                            </a>
                                        )}

                                        {(
                                            ((selectedDetail.tipe === 'RAB' || selectedDetail.tipe === 'SPK') && selectedDetail.link_pdf) ||
                                            selectedDetail.tipe === 'OPNAME_FINAL' ||
                                            selectedDetail.tipe === 'INSTRUKSI_LAPANGAN' ||
                                            selectedDetail.tipe === 'PROJECT_PLANNING' ||
                                            selectedDetail.tipe === 'BERKAS_SERAH_TERIMA' ||
                                            selectedDetail.tipe === 'DOKUMENTASI_BANGUNAN' ||
                                            selectedDetail.tipe === 'PENGAWASAN' ||
                                            selectedDetail.tipe === 'PERTAMBAHAN_SPK'
                                        ) && (
                                            <Button
                                                variant="outline"
                                                onClick={() => handleViewPDFOnline(selectedDetail)}
                                            >
                                                <FileDown className="w-4 h-4 mr-2" /> Lihat PDF Online
                                            </Button>
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

function ProjectPlanningAttachmentGroup({
    title,
    items,
    onView,
    onDownload,
    isDownloading,
}: {
    title: string;
    items: ProjectPlanningAttachment[];
    onView: (field: string, itemIndex?: number) => void;
    onDownload: (field: string, itemIndex?: number) => void;
    isDownloading: boolean;
}) {
    const availableItems = items.filter(item => hasLink(item.url));
    if (availableItems.length === 0) return null;

    return (
        <div className="space-y-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 pb-2 border-b border-slate-200">{title}</p>
            <div className="divide-y divide-slate-100">
                {availableItems.map(item => {
                    const url = firstAttachmentUrl(item.url);
                    const canDownload = !!item.field && isDownloadableAttachment(url);
                    const canProxyView = !!item.field && !isExternalOnlyLink(url);
                    return (
                        <div key={`${title}-${item.label}-${item.itemIndex ?? 'main'}`} className="flex flex-col sm:flex-row sm:items-center gap-2 py-3">
                            <span className="text-xs font-semibold text-slate-700 sm:w-56 shrink-0 flex items-center gap-2">
                                {item.icon ?? <FileText className="w-3.5 h-3.5 text-slate-400" />}
                                {item.label}
                            </span>
                            <div className="flex gap-2">
                            {canProxyView ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 px-3 rounded-lg border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold"
                                    onClick={() => onView(item.field!, item.itemIndex)}
                                >
                                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                                    Lihat
                                </Button>
                            ) : (
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                    <Button variant="outline" className="h-8 px-3 rounded-lg border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold">
                                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                                        Lihat
                                        <ExternalLink className="w-3 h-3 ml-1.5" />
                                    </Button>
                                </a>
                            )}
                            {canDownload && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 px-3 rounded-lg border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
                                    disabled={isDownloading}
                                    onClick={() => onDownload(item.field!, item.itemIndex)}
                                >
                                    {isDownloading ? (
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                        <Download className="w-3.5 h-3.5 mr-1.5" />
                                    )}
                                    Unduh
                                </Button>
                            )}
                            </div>
                        </div>
                    );
                })}
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
