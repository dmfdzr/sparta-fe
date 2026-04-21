"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Loader2, Search, CheckSquare, AlertCircle, CheckCircle,
    Info, Hash, Send, X, Eye, ChevronDown, ChevronRight,
    Camera, FileText, ThumbsUp, ThumbsDown, Clock, Filter,
    Building2, ClipboardList, ArrowLeft, ExternalLink, RefreshCw, Lock
} from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';
import { useGlobalAlert } from '@/context/GlobalAlertContext';
import {
    fetchRABList, fetchRABDetail, fetchTokoList,
    fetchOpnameList, fetchOpnameDetail, updateOpname, submitOpnameSingle,
    fetchGanttList, fetchGanttDetailByToko, fetchPengawasanList,
    kunciOpnameFinal, fetchOpnameFinalList,
    type OpnameItem, type RABDetailItem, type RABDetailToko, type RABListItem,
} from '@/lib/api';

// =============================================================================
// HELPERS
// =============================================================================

const formatRp = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

const formatTanggal = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatTanggalShort = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function formatUlokWithDash(ulok: string) {
    if (!ulok) return "";
    if (ulok.includes("-")) return ulok;
    const clean = ulok.replace(/[^a-zA-Z0-9]/g, '');
    if (clean.length === 11 || clean.length === 12) {
        return `${clean.substring(0, 4)}-${clean.substring(4, 8)}-${clean.substring(8)}`;
    }
    return ulok;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
    pending:    { label: 'Pending',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
    disetujui:  { label: 'Disetujui', color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
    ditolak:    { label: 'Ditolak',   color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
    
    // Legacy mapping (just in case)
    progress:   { label: 'Pending',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
    selesai:    { label: 'Disetujui',  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
    terlambat:  { label: 'Ditolak',    color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/** Status badge */
function StatusBadge({ status }: { status: string }) {
    const s = status?.toLowerCase() || '';
    const config = statusConfig[s] || statusConfig.pending;
    
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full ${config.bg} ${config.color} ${config.border} border`}>
            {(s === 'selesai' || s === 'disetujui') && <CheckCircle className="w-3 h-3" />}
            {(s === 'progress' || s === 'pending') && <Clock className="w-3 h-3" />}
            {(s === 'terlambat' || s === 'ditolak') && <AlertCircle className="w-3 h-3" />}
            {config.label}
        </span>
    );
}

/** Info item card for project details */
function InfoItem({ icon, label, value, highlight }: {
    icon: React.ReactNode; label: string; value: string; highlight?: boolean;
}) {
    return (
        <div className="flex items-start gap-2.5 p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
            <div className={`p-1.5 rounded-md shrink-0 mt-0.5 ${highlight ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className={`text-sm font-semibold truncate ${highlight ? 'text-amber-700' : 'text-slate-800'}`} title={value}>{value}</p>
            </div>
        </div>
    );
}

// =============================================================================
// PIC/SAT VIEW — Submit Volume Akhir
// =============================================================================

function PICOpnameView({ userInfo }: { userInfo: { name: string; role: string; cabang: string; email: string } }) {
    const router = useRouter();
    const { showAlert } = useGlobalAlert();

    // Data
    const [rabList, setRabList] = useState<RABListItem[]>([]);
    const [selectedRab, setSelectedRab] = useState<RABListItem | null>(null);
    const [rabItems, setRabItems] = useState<RABDetailItem[]>([]);
    const [tokoDetail, setTokoDetail] = useState<RABDetailToko | null>(null);
    const [existingOpname, setExistingOpname] = useState<OpnameItem[]>([]);

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittingItemId, setSubmittingItemId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeView, setActiveView] = useState<'form' | 'history'>('form');

    // Opname inputs: keyed by rab_item id
    const [opnameInputs, setOpnameInputs] = useState<Record<number, {
        volume_akhir: string;
        desain: string;
        kualitas: string;
        spesifikasi: string;
        catatan: string;
        file: File | null;
    }>>({});

    // Expanded categories
    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

    // Load RAB list
    useEffect(() => {
        setIsLoading(true);
        fetchRABList()
            .then(res => {
                const data = res.data || [];
                // Filter berdasarkan cabang user & status disetujui
                const filtered = data.filter(item => {
                    const matchCabang = userInfo.cabang
                        ? item.cabang?.toUpperCase() === userInfo.cabang.toUpperCase()
                        : true;
                    const isApproved = item.status?.toUpperCase().includes('DISETUJUI') ||
                        item.status?.toUpperCase().includes('APPROVED');
                    return matchCabang && isApproved;
                });
                setRabList(filtered);
            })
            .catch(err => console.error("Gagal memuat RAB list:", err))
            .finally(() => setIsLoading(false));
    }, [userInfo.cabang]);

    // Filter RAB List by search
    const filteredRabList = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return rabList.filter(r =>
            (r.nomor_ulok || '').toLowerCase().includes(q) ||
            (r.nama_toko || '').toLowerCase().includes(q) ||
            (r.cabang || '').toLowerCase().includes(q) ||
            (r.proyek || '').toLowerCase().includes(q)
        );
    }, [rabList, searchQuery]);

    // Handle RAB selection
    const handleSelectRab = async (rabId: string) => {
        if (!rabId) {
            setSelectedRab(null);
            setRabItems([]);
            setTokoDetail(null);
            setOpnameInputs({});
            setExistingOpname([]);
            return;
        }

        const rab = rabList.find(r => r.id === parseInt(rabId));
        if (!rab) return;

        setSelectedRab(rab);
        setIsLoadingDetail(true);

        try {
            const detailRes = await fetchRABDetail(rab.id);
            const { items, toko } = detailRes.data;
            setRabItems(items || []);
            setTokoDetail(toko);

            // Check for existing opname data
            let existingData: OpnameItem[] = [];
            try {
                const opnameRes = await fetchOpnameList({ id_toko: rab.id_toko });
                existingData = opnameRes.data || [];
                setExistingOpname(existingData);
            } catch {
                setExistingOpname([]);
            }

            // Initialize inputs - pre-fill with RAB volume, check existing opname
            const inputs: typeof opnameInputs = {};
            (items || []).forEach((item: RABDetailItem) => {
                const existing = existingData.find(o => o.id_rab_item === item.id);
                inputs[item.id] = {
                    volume_akhir: existing ? String(existing.volume_akhir) : String(item.volume),
                    desain: existing?.desain || '',
                    kualitas: existing?.kualitas || '',
                    spesifikasi: existing?.spesifikasi || '',
                    catatan: existing?.catatan || '',
                    file: null,
                };
            });
            setOpnameInputs(inputs);

            // Expand all categories by default
            const cats = new Set<string>();
            (items || []).forEach((item: RABDetailItem) => {
                if (item.kategori_pekerjaan) cats.add(item.kategori_pekerjaan);
            });
            setExpandedCats(cats);

        } catch (err: any) {
            showAlert({ message: `Gagal memuat detail RAB: ${err.message}`, type: "error" });
        } finally {
            setIsLoadingDetail(false);
        }
    };

    // Handle input change
    const handleSetInput = (itemId: number, field: string, value: any) => {
        setOpnameInputs(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], [field]: value }
        }));
    };

    // Toggle category expansion
    const toggleCategory = (cat: string) => {
        setExpandedCats(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };

    // Group items by category — only show items that haven't been submitted yet OR were rejected
    const groupedItems = useMemo(() => {
        const map = new Map<string, RABDetailItem[]>();
        rabItems.forEach(item => {
            const existing = existingOpname.find(o => o.id_rab_item === item.id);
            // Hide items with status pending or disetujui
            if (existing && ['pending', 'disetujui'].includes(existing.status?.toLowerCase())) return;
            // Allow: no existing record (new) or status ditolak (revision)

            const cat = item.kategori_pekerjaan;
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat)!.push(item);
        });
        return Array.from(map.entries()).map(([name, items]) => ({ name, items })).filter(g => g.items.length > 0);
    }, [rabItems, existingOpname]);

    // Helper: check if an item was previously rejected
    const getRejectedOpname = (rabItemId: number) => {
        return existingOpname.find(o => o.id_rab_item === rabItemId && o.status?.toLowerCase() === 'ditolak');
    };

    // Check if all items are approved (for Opname Final button)
    const allApproved = useMemo(() => {
        if (rabItems.length === 0) return false;
        const approvedCount = existingOpname.filter(o => o.status?.toLowerCase() === 'disetujui').length;
        return approvedCount === rabItems.length;
    }, [rabItems, existingOpname]);

    // Handle Kunci Opname Final
    const handleKunciOpnameFinal = async () => {
        if (!selectedRab || !allApproved) return;
        if (!window.confirm('Kunci Opname Final untuk proyek ini? Setelah dikunci, data akan masuk proses approval.')) return;

        setIsSubmitting(true);
        try {
            // Find existing opname_final for this toko
            let opnameFinalId = 0;
            try {
                const finalList = await fetchOpnameFinalList({ id_toko: selectedRab.id_toko });
                const existing = finalList?.data?.[0];
                if (existing?.id) opnameFinalId = existing.id;
            } catch { /* no existing */ }

            if (!opnameFinalId) {
                showAlert({ message: 'Header Opname Final untuk proyek ini tidak ditemukan. Harap hubungi administrator.', type: "warning" });
                setIsSubmitting(false);
                return;
            }

            // Build items payload
            const opnameItemsData = existingOpname.map(item => {
                return {
                    id_rab_item: item.id_rab_item,
                    status: item.status,
                    volume_akhir: item.volume_akhir,
                    selisih_volume: item.selisih_volume,
                    total_selisih: item.total_selisih,
                    desain: item.desain || undefined,
                    kualitas: item.kualitas || undefined,
                    spesifikasi: item.spesifikasi || undefined,
                    catatan: item.catatan || undefined,
                };
            });

            // Calculate grand totals
            let grandTotalRab = 0;
            let grandTotalOpname = 0;
            existingOpname.forEach(item => {
                const rabRef = rabItems.find(r => r.id === item.id_rab_item);
                const hargaSatuan = (rabRef?.harga_material || 0) + (rabRef?.harga_upah || 0);
                const volRab = rabRef?.volume || 0;
                grandTotalRab += volRab * hargaSatuan;
                grandTotalOpname += item.volume_akhir * hargaSatuan;
            });

            await kunciOpnameFinal(opnameFinalId, {
                id_toko: selectedRab.id_toko,
                email_pembuat: userInfo.email,
                grand_total_opname: String(grandTotalOpname),
                grand_total_rab: String(grandTotalRab),
                opname_item: opnameItemsData,
            });

            showAlert({ message: 'Opname Final berhasil dikunci! Data telah dikirim untuk approval Koordinator.', type: "success" });
            // Refresh data
            handleSelectRab(selectedRab.id.toString());
        } catch (err: any) {
            showAlert({ message: `Gagal mengunci opname final: ${err.message}`, type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Submit Opname per item (single)
    const handleSubmitItem = async (rabItem: RABDetailItem) => {
        if (!selectedRab) return;
        const input = opnameInputs[rabItem.id];
        if (!input) return;

        setSubmittingItemId(rabItem.id);
        setIsSubmitting(true);
        try {
            const volAkhir = parseFloat(input.volume_akhir) || 0;
            const selisihVol = volAkhir - rabItem.volume;
            const hargaSatuan = rabItem.harga_material + rabItem.harga_upah;
            const totalSelisih = selisihVol * hargaSatuan;

            const payload: Record<string, any> = {
                id_toko: selectedRab.id_toko,
                id_rab_item: rabItem.id,
                status: 'pending',
                volume_akhir: volAkhir,
                selisih_volume: selisihVol,
                total_selisih: totalSelisih,
                desain: input.desain || undefined,
                kualitas: input.kualitas || undefined,
                spesifikasi: input.spesifikasi || undefined,
                catatan: input.catatan || undefined,
            };

            if (input.file) {
                const formData = new FormData();
                Object.entries(payload).forEach(([k, v]) => {
                    if (v !== undefined) formData.append(k, typeof v === 'number' ? String(v) : v);
                });
                formData.append('file_foto_opname', input.file);
                await submitOpnameSingle(formData);
            } else {
                await submitOpnameSingle(payload);
            }

            showAlert({ message: `Item "${rabItem.jenis_pekerjaan}" berhasil disubmit!`, type: "success" });
            // Refresh existing opname data so the item disappears from form
            try {
                const opnameRes = await fetchOpnameList({ id_toko: selectedRab.id_toko });
                setExistingOpname(opnameRes.data || []);
            } catch { /* ignore */ }
        } catch (err: any) {
            showAlert({ message: `Gagal menyimpan: ${err.message}`, type: "error" });
        } finally {
            setIsSubmitting(false);
            setSubmittingItemId(null);
        }
    };

    // Check if there's existing opname data for this project
    const hasExistingOpname = existingOpname.length > 0;

    return (
        <>
            <main className="max-w-6xl mx-auto p-4 md:p-8 mt-4 pb-24">
                <Card className="shadow-sm border-slate-200 relative z-10">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 bg-white rounded-t-xl flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <CheckSquare className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-slate-800">Opname Final</h2>
                            <p className="text-sm text-slate-500">Isi volume akhir dan verifikasi pekerjaan proyek.</p>
                        </div>
                        {selectedRab && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setActiveView('form')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeView === 'form' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    <ClipboardList className="w-4 h-4 inline mr-1.5" />Form
                                </button>
                                <button
                                    onClick={() => setActiveView('history')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all relative ${activeView === 'history' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    <Clock className="w-4 h-4 inline mr-1.5" />Riwayat
                                    {hasExistingOpname && (
                                        <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{existingOpname.length}</span>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    <CardContent className="p-6 md:p-8 bg-slate-50/50">
                        {/* Section 1: Select ULOK */}
                        <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6">
                            <h3 className="font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2">
                                <Hash className="w-4 h-4 text-emerald-600" />
                                1. Pilih Proyek (ULOK)
                            </h3>

                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Cari No ULOK / Nama Toko..."
                                    className="w-full pl-9 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {isLoading ? (
                                <div className="p-4 text-center text-slate-500 bg-slate-50 rounded-lg text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                    Memuat data proyek...
                                </div>
                            ) : (
                                <div className="relative">
                                    <select
                                        className="w-full p-3 border rounded-lg bg-slate-50 outline-none font-semibold text-slate-700 cursor-pointer focus:bg-white focus:ring-2 focus:ring-emerald-500 appearance-none pr-10"
                                        value={selectedRab?.id?.toString() || ''}
                                        onChange={(e) => handleSelectRab(e.target.value)}
                                    >
                                        <option value="">— Pilih Proyek —</option>
                                        {filteredRabList.map(rab => (
                                            <option key={rab.id} value={rab.id}>
                                                {formatUlokWithDash(rab.nomor_ulok)} — {rab.nama_toko} ({rab.proyek})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            )}
                        </div>

                        {/* Project Info */}
                        {isLoadingDetail && (
                            <div className="flex justify-center items-center py-16 text-slate-500">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                            </div>
                        )}

                        {tokoDetail && !isLoadingDetail && (
                            <>
                                {/* Project Details Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                    <InfoItem icon={<Hash className="w-4 h-4" />} label="No. ULOK" value={formatUlokWithDash(tokoDetail.nomor_ulok)} highlight />
                                    <InfoItem icon={<Building2 className="w-4 h-4" />} label="Nama Toko" value={tokoDetail.nama_toko} />
                                    <InfoItem icon={<FileText className="w-4 h-4" />} label="Lingkup" value={tokoDetail.lingkup_pekerjaan || '-'} />
                                    <InfoItem icon={<Building2 className="w-4 h-4" />} label="Kontraktor" value={tokoDetail.nama_kontraktor || '-'} />
                                </div>

                                {/* Opname Final Button */}
                                <div className={`p-4 rounded-xl border shadow-sm flex items-center justify-between mb-6 ${allApproved ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                                    <div>
                                        <h4 className={`font-bold text-sm ${allApproved ? 'text-emerald-800' : 'text-slate-500'}`}>
                                            <Lock className="w-4 h-4 inline mr-1.5" />
                                            Kunci Opname Final
                                        </h4>
                                        <p className={`text-xs mt-0.5 ${allApproved ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {allApproved
                                                ? 'Semua item telah disetujui oleh Kontraktor. Klik untuk mengunci dan mengirim ke proses approval.'
                                                : `Semua item harus berstatus Disetujui (${existingOpname.filter(o => o.status?.toLowerCase() === 'disetujui').length}/${rabItems.length} item disetujui oleh Kontraktor).`
                                            }
                                        </p>
                                    </div>
                                    <Button
                                        onClick={handleKunciOpnameFinal}
                                        disabled={!allApproved || isSubmitting}
                                        className={`font-bold text-sm px-6 shadow-md shrink-0 ml-4 ${allApproved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed text-slate-500'}`}
                                    >
                                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                                        Opname Final
                                    </Button>
                                </div>

                                {hasExistingOpname && activeView === 'form' && (
                                    <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-bold text-amber-800">Data opname sudah pernah disubmit ({existingOpname.length} item).</p>
                                            <p className="text-xs text-amber-600 mt-0.5">Submit kembali akan membuat data opname baru. Lihat tab <b>Riwayat</b> untuk data yang sudah ada.</p>
                                        </div>
                                    </div>
                                )}

                                {activeView === 'form' ? (
                                    /* Section 2: Form Input */
                                    <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2">
                                            <ClipboardList className="w-4 h-4 text-emerald-600" />
                                            2. Input Volume Akhir & Verifikasi Pekerjaan
                                        </h3>

                                        {groupedItems.length === 0 ? (
                                            <div className="py-12 text-center text-slate-400">
                                                <Info className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                                <p className="font-medium">Tidak ada item pekerjaan.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {groupedItems.map((group, gi) => {
                                                    const isExpanded = expandedCats.has(group.name);
                                                    return (
                                                        <div key={gi} className="border border-slate-200 rounded-xl overflow-hidden">
                                                            {/* Category header */}
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleCategory(group.name)}
                                                                className="w-full px-5 py-3 bg-slate-100 hover:bg-slate-200 flex justify-between items-center transition-colors"
                                                            >
                                                                <h4 className="font-bold text-slate-800 uppercase tracking-wide text-sm flex items-center gap-2">
                                                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-emerald-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                                                    {group.name}
                                                                </h4>
                                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-xs">{group.items.length} Item</Badge>
                                                            </button>

                                                            {/* Items */}
                                                            {isExpanded && (
                                                                <div className="p-4 space-y-4">
                                                                    {group.items.map((item, j) => {
                                                                        const input = opnameInputs[item.id] || { volume_akhir: String(item.volume), desain: '', kualitas: '', spesifikasi: '', catatan: '', file: null };
                                                                        const isItemSubmitting = submittingItemId === item.id;
                                                                        const volAkhir = parseFloat(input.volume_akhir) || 0;
                                                                        const selisih = volAkhir - item.volume;
                                                                        const hargaSatuan = item.harga_material + item.harga_upah;
                                                                        const totalHargaRAB = item.volume * hargaSatuan;
                                                                        const totalHargaBaru = volAkhir * hargaSatuan;
                                                                        const selisihHarga = totalHargaBaru - totalHargaRAB;

                                                                        const rejectedRecord = getRejectedOpname(item.id);

                                                                        return (
                                                                            <div key={j} className={`border p-4 rounded-lg ${rejectedRecord ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-slate-50/50'}`}>
                                                                                {/* Item Header */}
                                                                                <div className="font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 flex justify-between items-center">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-sm">{item.jenis_pekerjaan}</span>
                                                                                        {rejectedRecord && (
                                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700 border border-red-200">
                                                                                                <AlertCircle className="w-3 h-3" />
                                                                                                Ditolak
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <span className="text-[11px] bg-slate-200 text-slate-600 px-2 py-1 rounded font-semibold">
                                                                                        Satuan: {item.satuan} • Harga: {formatRp(hargaSatuan)}
                                                                                    </span>
                                                                                </div>
                                                                                {rejectedRecord?.catatan && (
                                                                                    <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                                                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                                                                        <div>
                                                                                            <span className="font-bold">Alasan penolakan:</span> {rejectedRecord.catatan}
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                                                                                    {/* Col 1: Volume & Cost */}
                                                                                    <div className="space-y-3 bg-white p-3 rounded border border-slate-200 shadow-sm">
                                                                                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b pb-1 mb-2">Volume & Biaya</h4>
                                                                                        <div className="flex justify-between items-center text-xs text-slate-600">
                                                                                            <span>Vol RAB:</span>
                                                                                            <span className="font-bold">{item.volume} <span className="text-[10px] text-slate-400 ml-0.5">{item.satuan}</span></span>
                                                                                        </div>
                                                                                        <div>
                                                                                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Volume Akhir *</label>
                                                                                            <div className="relative mt-1">
                                                                                                <input
                                                                                                    type="number"
                                                                                                    step="any"
                                                                                                    className="w-full p-2 border border-slate-300 rounded text-sm bg-emerald-50 focus:bg-white focus:border-emerald-500 focus:outline-none font-bold pr-12"
                                                                                                    value={input.volume_akhir}
                                                                                                    onChange={(e) => handleSetInput(item.id, 'volume_akhir', e.target.value)}
                                                                                                />
                                                                                                {item.satuan && <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold uppercase">{item.satuan}</span>}
                                                                                            </div>
                                                                                            <div className="text-[10px] text-right mt-1 text-slate-500">
                                                                                                Selisih: <span className={`font-bold ${selisih > 0 ? 'text-blue-600' : (selisih < 0 ? 'text-red-600' : '')}`}>
                                                                                                    {selisih > 0 ? '+' + selisih : selisih} {item.satuan}
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[11px] space-y-1.5 mt-2">
                                                                                            <div className="flex justify-between">
                                                                                                <span className="text-slate-500">Total RAB:</span>
                                                                                                <span className="font-medium">{formatRp(totalHargaRAB)}</span>
                                                                                            </div>
                                                                                            <div className="flex justify-between">
                                                                                                <span className="text-slate-700 font-semibold">Total Opname:</span>
                                                                                                <span className="font-bold text-slate-800">{formatRp(totalHargaBaru)}</span>
                                                                                            </div>
                                                                                            <div className="flex justify-between border-t pt-1 border-slate-200">
                                                                                                <span className="text-slate-600">Selisih:</span>
                                                                                                <span className={`font-bold ${selisihHarga > 0 ? 'text-blue-600' : (selisihHarga < 0 ? 'text-red-600' : 'text-slate-500')}`}>
                                                                                                    {selisihHarga > 0 ? '+' : ''}{formatRp(selisihHarga)}
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Col 2: Quality Verification */}
                                                                                    <div className="space-y-3 bg-white p-3 rounded border border-slate-200 shadow-sm">
                                                                                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b pb-1 mb-2">Verifikasi Pekerjaan</h4>
                                                                                        <div>
                                                                                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Desain</label>
                                                                                            <select className="w-full p-2 border border-slate-300 rounded mt-1 text-xs focus:border-emerald-500 focus:outline-none bg-slate-50"
                                                                                                value={input.desain || ''}
                                                                                                onChange={(e) => handleSetInput(item.id, 'desain', e.target.value)}>
                                                                                                <option value="">-- Pilih --</option>
                                                                                                <option value="Sesuai">Sesuai</option>
                                                                                                <option value="Tidak Sesuai">Tidak Sesuai</option>
                                                                                            </select>
                                                                                        </div>
                                                                                        <div>
                                                                                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Kualitas</label>
                                                                                            <select className="w-full p-2 border border-slate-300 rounded mt-1 text-xs focus:border-emerald-500 focus:outline-none bg-slate-50"
                                                                                                value={input.kualitas || ''}
                                                                                                onChange={(e) => handleSetInput(item.id, 'kualitas', e.target.value)}>
                                                                                                <option value="">-- Pilih --</option>
                                                                                                <option value="Baik">Baik</option>
                                                                                                <option value="Tidak Baik">Tidak Baik</option>
                                                                                            </select>
                                                                                        </div>
                                                                                        <div>
                                                                                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Spesifikasi</label>
                                                                                            <select className="w-full p-2 border border-slate-300 rounded mt-1 text-xs focus:border-emerald-500 focus:outline-none bg-slate-50"
                                                                                                value={input.spesifikasi || ''}
                                                                                                onChange={(e) => handleSetInput(item.id, 'spesifikasi', e.target.value)}>
                                                                                                <option value="">-- Pilih --</option>
                                                                                                <option value="Sesuai">Sesuai</option>
                                                                                                <option value="Tidak Sesuai">Tidak Sesuai</option>
                                                                                            </select>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Col 3: Notes & Photo */}
                                                                                    <div className="space-y-3 bg-white p-3 rounded border border-slate-200 shadow-sm flex flex-col">
                                                                                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b pb-1 mb-2">Catatan & Dokumentasi</h4>
                                                                                        <div className="flex-1 flex flex-col">
                                                                                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Catatan</label>
                                                                                            <textarea
                                                                                                className="w-full p-2 border border-slate-300 rounded mt-1 text-xs focus:border-emerald-500 focus:outline-none placeholder:text-slate-400 bg-slate-50 flex-1 resize-none min-h-15"
                                                                                                placeholder="Keterangan tambahan..."
                                                                                                value={input.catatan || ''}
                                                                                                onChange={(e) => handleSetInput(item.id, 'catatan', e.target.value)}
                                                                                            ></textarea>
                                                                                        </div>
                                                                                        <div>
                                                                                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Foto Bukti</label>
                                                                                            <input
                                                                                                type="file"
                                                                                                accept="image/*"
                                                                                                className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 mt-1 cursor-pointer border border-slate-200 rounded p-1"
                                                                                                onChange={(e) => handleSetInput(item.id, 'file', e.target.files?.[0] || null)}
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Per-item Submit Button */}
                                                                                <div className="flex justify-end pt-3 mt-3 border-t border-slate-200">
                                                                                    <Button
                                                                                        size="sm"
                                                                                        onClick={() => handleSubmitItem(item)}
                                                                                        disabled={isSubmitting}
                                                                                        className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs px-5 py-2 h-auto shadow-md hover:shadow-lg transition-all"
                                                                                    >
                                                                                        {isItemSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                                                                                        Submit Item
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}


                                    </div>
                                ) : (
                                    /* History View */
                                    <OpnameHistoryView opnameList={existingOpname} rabItems={rabItems} />
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </main>


        </>
    );
}

// =============================================================================
// OPNAME HISTORY VIEW (used by PIC)
// =============================================================================

function OpnameHistoryView({ opnameList, rabItems }: { opnameList: OpnameItem[]; rabItems: RABDetailItem[] }) {
    if (opnameList.length === 0) {
        return (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
                <Info className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-600">Belum ada data opname untuk proyek ini.</p>
                <p className="text-sm text-slate-400 mt-1">Submit opname melalui tab Form.</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-700 border-b pb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                Riwayat Opname ({opnameList.length} item)
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="border-b-2 border-slate-200 text-[11px] text-slate-500 uppercase tracking-wider">
                            <th className="pb-3 pr-4">Jenis Pekerjaan</th>
                            <th className="pb-3 pr-4 text-center">Vol RAB</th>
                            <th className="pb-3 pr-4 text-center">Vol Akhir</th>
                            <th className="pb-3 pr-4 text-center">Selisih</th>
                            <th className="pb-3 pr-4 text-center">Desain</th>
                            <th className="pb-3 pr-4 text-center">Kualitas</th>
                            <th className="pb-3 pr-4 text-center">Status</th>
                            <th className="pb-3">Tanggal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {opnameList.map(item => {
                            const rabItem = rabItems.find(r => r.id === item.id_rab_item);
                            return (
                                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                    <td className="py-3 pr-4 font-semibold text-slate-700">
                                        <div className="text-[10px] text-slate-400 uppercase">{rabItem?.kategori_pekerjaan || item.rab_item?.kategori_pekerjaan || '-'}</div>
                                        {rabItem?.jenis_pekerjaan || item.rab_item?.jenis_pekerjaan || '-'}
                                    </td>
                                    <td className="py-3 pr-4 text-center">{rabItem?.volume || item.rab_item?.volume || '-'}</td>
                                    <td className="py-3 pr-4 text-center font-bold">{item.volume_akhir}</td>
                                    <td className={`py-3 pr-4 text-center font-bold ${item.selisih_volume > 0 ? 'text-blue-600' : (item.selisih_volume < 0 ? 'text-red-600' : 'text-slate-500')}`}>
                                        {item.selisih_volume > 0 ? '+' : ''}{item.selisih_volume}
                                    </td>
                                    <td className="py-3 pr-4 text-center">
                                        <span className={`text-xs font-semibold ${item.desain === 'Sesuai' ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.desain || '-'}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4 text-center">
                                        <span className={`text-xs font-semibold ${item.kualitas === 'Baik' ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.kualitas || '-'}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4 text-center">
                                        <StatusBadge status={item.status} />
                                    </td>
                                    <td className="py-3 text-xs text-slate-500">{formatTanggalShort(item.created_at)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// =============================================================================
// KONTRAKTOR VIEW — Review & Approve/Reject Opname
// =============================================================================

function KontraktorOpnameView({ userInfo }: { userInfo: { name: string; role: string; cabang: string; email: string } }) {
    const router = useRouter();
    const { showAlert } = useGlobalAlert();

    // Data
    const [opnameList, setOpnameList] = useState<OpnameItem[]>([]);
    const [rabList, setRabList] = useState<RABListItem[]>([]);
    const [selectedToko, setSelectedToko] = useState<{ id_toko: number; nomor_ulok: string; nama_toko: string } | null>(null);
    const [filteredOpname, setFilteredOpname] = useState<OpnameItem[]>([]);
    const [rabItems, setRabItems] = useState<RABDetailItem[]>([]);

    // Detail modal
    const [selectedOpname, setSelectedOpname] = useState<OpnameItem | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // UI
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingItems, setIsLoadingItems] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    // Load all opname + RAB list kontraktor punya
    useEffect(() => {
        setIsLoading(true);

        // Fetch RAB list milik kontraktor (via email)
        fetchRABList()
            .then(res => {
                const data = res.data || [];
                // Filter RAB by kontraktor email
                const myRabs = data.filter(r =>
                    r.email_pembuat?.toLowerCase() === userInfo.email.toLowerCase()
                );
                setRabList(myRabs);

                // Get unique toko IDs
                const tokoIds = [...new Set(myRabs.map(r => r.id_toko))];

                // Load opname for each toko
                const promises = tokoIds.map(id => fetchOpnameList({ id_toko: id }).catch(() => ({ data: [] as OpnameItem[] })));
                return Promise.all(promises);
            })
            .then(results => {
                const allOpname = results.flatMap(r => r.data || []);
                setOpnameList(allOpname);
            })
            .catch(err => console.error("Gagal memuat data:", err))
            .finally(() => setIsLoading(false));
    }, [userInfo.email]);

    // Group opname by toko for project selection
    const tokoGroups = useMemo(() => {
        const map = new Map<number, { id_toko: number; nomor_ulok: string; nama_toko: string; count: number; items: OpnameItem[] }>();
        opnameList.forEach(item => {
            const id = item.id_toko;
            if (!map.has(id)) {
                const rab = rabList.find(r => r.id_toko === id);
                map.set(id, {
                    id_toko: id,
                    nomor_ulok: rab?.nomor_ulok || item.toko?.nomor_ulok || '-',
                    nama_toko: rab?.nama_toko || item.toko?.nama_toko || 'Toko',
                    count: 0,
                    items: [],
                });
            }
            const group = map.get(id)!;
            group.count++;
            group.items.push(item);
        });
        return Array.from(map.values());
    }, [opnameList, rabList]);

    // Filter by search
    const filteredTokoGroups = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return tokoGroups.filter(g =>
            g.nomor_ulok.toLowerCase().includes(q) ||
            g.nama_toko.toLowerCase().includes(q)
        );
    }, [tokoGroups, searchQuery]);

    // Handle toko selection
    const handleSelectToko = async (tokoId: number) => {
        const group = tokoGroups.find(g => g.id_toko === tokoId);
        if (!group) return;

        setSelectedToko({ id_toko: group.id_toko, nomor_ulok: group.nomor_ulok, nama_toko: group.nama_toko });
        setIsLoadingItems(true);

        try {
            // Load fresh opname data
            const opnameRes = await fetchOpnameList({ id_toko: tokoId });
            const opnameData = opnameRes.data || [];
            setFilteredOpname(opnameData);

            // Load RAB items for reference
            const rab = rabList.find(r => r.id_toko === tokoId);
            if (rab) {
                const rabDetail = await fetchRABDetail(rab.id);
                setRabItems(rabDetail.data.items || []);
            }
        } catch (err: any) {
            showAlert({ message: `Gagal memuat data: ${err.message}`, type: "error" });
        } finally {
            setIsLoadingItems(false);
        }
    };

    // Refresh data
    const refreshData = async () => {
        if (!selectedToko) return;
        setIsLoadingItems(true);
        try {
            const opnameRes = await fetchOpnameList({ id_toko: selectedToko.id_toko });
            setFilteredOpname(opnameRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingItems(false);
        }
    };

    // Filter opname by status
    const displayedOpname = useMemo(() => {
        if (!filterStatus) return filteredOpname;
        return filteredOpname.filter(o => o.status?.toLowerCase() === filterStatus.toLowerCase());
    }, [filteredOpname, filterStatus]);

    // Group by category for display
    const groupedOpname = useMemo(() => {
        const map = new Map<string, (OpnameItem & { rabRef?: RABDetailItem })[]>();
        displayedOpname.forEach(item => {
            const rabRef = rabItems.find(r => r.id === item.id_rab_item);
            const cat = rabRef?.kategori_pekerjaan || item.rab_item?.kategori_pekerjaan || 'Lainnya';
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat)!.push({ ...item, rabRef });
        });
        return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
    }, [displayedOpname, rabItems]);

    // Handle approve
    const handleApprove = async (opnameId: number) => {
        if (!window.confirm("Setujui data opname ini?")) return;
        setIsProcessing(true);
        try {
            await updateOpname(opnameId, { status: 'disetujui' });
            showAlert({ message: "Opname berhasil disetujui.", type: "success" });
            refreshData();
        } catch (err: any) {
            showAlert({ message: `Gagal: ${err.message}`, type: "error" });
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle reject
    const handleReject = async (opnameId: number, reason: string) => {
        if (!reason.trim()) {
            showAlert({ message: "Harap isi alasan penolakan.", type: "warning" });
            return;
        }
        setIsProcessing(true);
        try {
            await updateOpname(opnameId, { status: 'ditolak', catatan: reason });
            showAlert({ message: "Opname ditolak.", type: "info" });
            setShowDetailModal(false);
            setSelectedOpname(null);
            refreshData();
        } catch (err: any) {
            showAlert({ message: `Gagal: ${err.message}`, type: "error" });
        } finally {
            setIsProcessing(false);
        }
    };



    // Stats
    const stats = useMemo(() => {
        const total = filteredOpname.length;
        const pending = filteredOpname.filter(o => o.status?.toLowerCase() === 'pending').length;
        const disetujui = filteredOpname.filter(o => o.status?.toLowerCase() === 'disetujui').length;
        const ditolak = filteredOpname.filter(o => o.status?.toLowerCase() === 'ditolak').length;
        const totalSelisih = filteredOpname.reduce((sum, o) => sum + (o.total_selisih || 0), 0);
        return { total, pending, disetujui, ditolak, totalSelisih };
    }, [filteredOpname]);





    return (
        <>
            <main className="max-w-6xl mx-auto p-4 md:p-8 mt-4 pb-24">
                <Card className="shadow-sm border-slate-200 relative z-10">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 bg-white rounded-t-xl flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <CheckSquare className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-slate-800">Review Opname</h2>
                            <p className="text-sm text-slate-500">Review dan setujui/tolak hasil opname dari PIC/SAT.</p>
                        </div>
                    </div>

                    <CardContent className="p-6 md:p-8 bg-slate-50/50">
                        {/* Project Selector */}
                        {!selectedToko ? (
                            <div className="space-y-4">
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Cari proyek berdasarkan ULOK atau nama toko..."
                                        className="w-full pl-9 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                {isLoading ? (
                                    <div className="flex justify-center py-16">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                    </div>
                                ) : filteredTokoGroups.length === 0 ? (
                                    <div className="py-16 text-center bg-white rounded-xl border border-slate-200">
                                        <Info className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="font-semibold text-slate-600">Belum ada data opname.</p>
                                        <p className="text-sm text-slate-400 mt-1">PIC/SAT belum mensubmit opname untuk proyek Anda.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {filteredTokoGroups.map(group => {
                                            const pendingCount = group.items.filter(i => i.status?.toLowerCase() === 'pending').length;
                                            return (
                                                <button
                                                    key={group.id_toko}
                                                    onClick={() => handleSelectToko(group.id_toko)}
                                                    className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all text-left group"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{formatUlokWithDash(group.nomor_ulok)}</span>
                                                        {pendingCount > 0 && (
                                                            <span className="bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-1 rounded-full border border-amber-200 animate-pulse">
                                                                {pendingCount} Menunggu Review
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors mb-1">{group.nama_toko}</h4>
                                                    <p className="text-xs text-slate-500">{group.count} item opname</p>
                                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors ml-auto mt-2" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Detail View */
                            <div className="space-y-4">
                                {/* Back + Title */}
                                <div className="flex items-center gap-3 mb-2">
                                    <button
                                        onClick={() => { setSelectedToko(null); setFilteredOpname([]); setRabItems([]); setFilterStatus(''); }}
                                        className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4 text-slate-600" />
                                    </button>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800">{selectedToko.nama_toko}</h3>
                                        <p className="text-xs text-slate-500">{formatUlokWithDash(selectedToko.nomor_ulok)}</p>
                                    </div>
                                    <button onClick={refreshData} className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors" title="Refresh">
                                        <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoadingItems ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                                        <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Total Item</p>
                                    </div>
                                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus(filterStatus === 'pending' ? '' : 'pending')}>
                                        <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
                                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mt-1">Pending</p>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-xl border border-green-200 shadow-sm text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus(filterStatus === 'disetujui' ? '' : 'disetujui')}>
                                        <p className="text-2xl font-bold text-green-700">{stats.disetujui}</p>
                                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider mt-1">Disetujui</p>
                                    </div>
                                    <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus(filterStatus === 'ditolak' ? '' : 'ditolak')}>
                                        <p className="text-2xl font-bold text-red-700">{stats.ditolak}</p>
                                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mt-1">Ditolak</p>
                                    </div>
                                    <div className={`p-4 rounded-xl border shadow-sm text-center ${stats.totalSelisih >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                                        <p className={`text-lg font-bold ${stats.totalSelisih >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatRp(stats.totalSelisih)}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Total Selisih</p>
                                    </div>
                                </div>





                                {/* Filter Indicator */}
                                {filterStatus && (
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 border border-slate-200">
                                        <Filter className="w-4 h-4 text-slate-500" />
                                        <span className="text-sm font-medium text-slate-600">
                                            Filter: <b>{statusConfig[filterStatus]?.label || filterStatus}</b>
                                        </span>
                                        <button onClick={() => setFilterStatus('')} className="ml-auto p-1 hover:bg-slate-200 rounded transition-colors">
                                            <X className="w-3 h-3 text-slate-500" />
                                        </button>
                                    </div>
                                )}

                                {/* Opname Items by Category */}
                                {isLoadingItems ? (
                                    <div className="flex justify-center py-16">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                    </div>
                                ) : groupedOpname.length === 0 ? (
                                    <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
                                        <Info className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="font-medium text-slate-600">
                                            {filterStatus ? 'Tidak ada item dengan filter yang dipilih.' : 'Tidak ada data opname.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {groupedOpname.map((group, gi) => (
                                            <div key={gi} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                                <div className="bg-slate-100 px-5 py-3 border-b flex justify-between items-center">
                                                    <h4 className="font-bold text-slate-800 uppercase tracking-wide text-sm">{group.name}</h4>
                                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none text-xs">{group.items.length} Item</Badge>
                                                </div>
                                                <div className="divide-y divide-slate-100">
                                                    {group.items.map((item, j) => {
                                                        const rabRef = item.rabRef;
                                                        const hargaSatuan = (rabRef?.harga_material || 0) + (rabRef?.harga_upah || 0);
                                                        const volRab = rabRef?.volume || 0;
                                                        const isPending = item.status?.toLowerCase() === 'pending';

                                                        return (
                                                            <div key={j} className={`p-4 hover:bg-slate-50/50 transition-colors ${isPending ? 'bg-amber-50/30' : ''}`}>
                                                                <div className="flex items-start justify-between gap-4">
                                                                    {/* Left: Info */}
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <span className="font-bold text-slate-800 text-sm">{rabRef?.jenis_pekerjaan || item.rab_item?.jenis_pekerjaan || '-'}</span>
                                                                            <StatusBadge status={item.status} />
                                                                        </div>

                                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-slate-600">
                                                                            <div>
                                                                                <span className="text-slate-400">Vol RAB: </span>
                                                                                <span className="font-semibold">{volRab}</span>
                                                                                <span className="text-slate-400 ml-0.5">{rabRef?.satuan}</span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-slate-400">Vol Akhir: </span>
                                                                                <span className="font-bold text-slate-800">{item.volume_akhir}</span>
                                                                                <span className="text-slate-400 ml-0.5">{rabRef?.satuan}</span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-slate-400">Selisih Vol: </span>
                                                                                <span className={`font-bold ${item.selisih_volume > 0 ? 'text-blue-600' : (item.selisih_volume < 0 ? 'text-red-600' : '')}`}>
                                                                                    {item.selisih_volume > 0 ? '+' : ''}{item.selisih_volume}
                                                                                </span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-slate-400">Total RAB: </span>
                                                                                <span className="font-semibold">{formatRp(volRab * hargaSatuan)}</span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-slate-400">Total Opname: </span>
                                                                                <span className="font-bold text-slate-800">{formatRp(item.volume_akhir * hargaSatuan)}</span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-slate-400">Selisih Biaya: </span>
                                                                                <span className={`font-bold ${item.total_selisih > 0 ? 'text-blue-600' : (item.total_selisih < 0 ? 'text-red-600' : '')}`}>
                                                                                    {formatRp(item.total_selisih)}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex gap-4 mt-2 text-[11px] text-slate-500">
                                                                            <span>Desain: <b className={item.desain === 'Sesuai' ? 'text-green-600' : 'text-red-600'}>{item.desain || '-'}</b></span>
                                                                            <span>Kualitas: <b className={item.kualitas === 'Baik' ? 'text-green-600' : 'text-red-600'}>{item.kualitas || '-'}</b></span>
                                                                            <span>Spesifikasi: <b className={item.spesifikasi === 'Sesuai' ? 'text-green-600' : 'text-red-600'}>{item.spesifikasi || '-'}</b></span>
                                                                        </div>

                                                                        {item.catatan && (
                                                                            <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 italic">
                                                                                📝 {item.catatan}
                                                                            </div>
                                                                        )}

                                                                        {item.foto && (
                                                                            <a href={item.foto} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-600 hover:text-blue-800 font-semibold">
                                                                                <Camera className="w-3 h-3" /> Lihat Foto
                                                                                <ExternalLink className="w-3 h-3" />
                                                                            </a>
                                                                        )}
                                                                    </div>

                                                                    {/* Right: Actions */}
                                                                    {isPending && (
                                                                        <div className="flex flex-col gap-2 shrink-0">
                                                                            <Button
                                                                                size="sm"
                                                                                onClick={() => handleApprove(item.id)}
                                                                                disabled={isProcessing}
                                                                                className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 shadow-sm"
                                                                            >
                                                                                <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                                                                                Setuju
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                onClick={() => { setSelectedOpname(item); setRejectReason(''); setShowDetailModal(true); }}
                                                                                disabled={isProcessing}
                                                                                className="text-red-600 border-red-200 hover:bg-red-50 font-bold text-xs"
                                                                            >
                                                                                <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                                                                                Tolak
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>

            {/* Reject Modal */}
            {showDetailModal && selectedOpname && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
                        <div className="p-5 border-b flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                                    <ThumbsDown className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">Tolak Opname</h3>
                                    <p className="text-xs text-slate-500">{selectedOpname.rab_item?.jenis_pekerjaan || `ID: ${selectedOpname.id}`}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Summary */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Volume Akhir:</span>
                                    <span className="font-bold">{selectedOpname.volume_akhir}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Selisih Volume:</span>
                                    <span className={`font-bold ${selectedOpname.selisih_volume > 0 ? 'text-blue-600' : (selectedOpname.selisih_volume < 0 ? 'text-red-600' : '')}`}>
                                        {selectedOpname.selisih_volume > 0 ? '+' : ''}{selectedOpname.selisih_volume}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Total Selisih:</span>
                                    <span className={`font-bold ${selectedOpname.total_selisih > 0 ? 'text-blue-600' : (selectedOpname.total_selisih < 0 ? 'text-red-600' : '')}`}>
                                        {formatRp(selectedOpname.total_selisih)}
                                    </span>
                                </div>
                            </div>

                            {/* Reject Reason */}
                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-2 block">
                                    Alasan Penolakan <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    className="w-full p-3 border border-red-200 rounded-lg text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 placeholder:text-slate-400 resize-none"
                                    rows={3}
                                    placeholder="Jelaskan alasan penolakan opname ini..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                ></textarea>
                            </div>
                        </div>

                        <div className="p-5 border-t bg-slate-50 flex justify-end gap-3">
                            <Button variant="outline" className="font-semibold" onClick={() => setShowDetailModal(false)}>Batal</Button>
                            <Button
                                onClick={() => handleReject(selectedOpname.id, rejectReason)}
                                disabled={isProcessing || !rejectReason.trim()}
                                className="bg-red-600 hover:bg-red-700 font-bold px-6 shadow-md"
                            >
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ThumbsDown className="w-4 h-4 mr-2" />}
                                Tolak Opname
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function OpnamePage() {
    const router = useRouter();
    const { showAlert } = useGlobalAlert();
    const [appMode, setAppMode] = useState<'pic' | 'kontraktor' | null>(null);
    const [userInfo, setUserInfo] = useState({ name: '', role: '', cabang: '', email: '' });

    useEffect(() => {
        const isAuth = sessionStorage.getItem("authenticated");
        const role = sessionStorage.getItem("userRole") || '';
        const email = sessionStorage.getItem("loggedInUserEmail") || '';
        const cabang = sessionStorage.getItem("loggedInUserCabang") || '';

        if (isAuth !== "true" || !role) {
            router.push('/auth');
            return;
        }

        const roles = role.split(',').map(r => r.trim().toUpperCase());
        const picRoles = [
            'BRANCH BUILDING & MAINTENANCE MANAGER',
            'BRANCH BUILDING COORDINATOR',
            'BRANCH BUILDING SUPPORT',
            'BRANCH BUILDING SUPPORT DOKUMENTASI',
        ];

        const name = (sessionStorage.getItem('loggedInUserName') || email.split('@')[0]).toUpperCase();
        setUserInfo({ name, role, cabang, email });

        if (roles.includes('KONTRAKTOR')) {
            setAppMode('kontraktor');
        } else if (roles.some(r => picRoles.includes(r))) {
            setAppMode('pic');
        } else {
            showAlert({ message: "Anda tidak memiliki akses ke halaman ini.", type: "error", onConfirm: () => router.push('/dashboard') });
        }
    }, [router]);

    if (!appMode) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-3" />
                <p className="font-semibold text-slate-600">Memuat halaman Opname...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">
            <AppNavbar
                title={appMode === 'pic' ? 'OPNAME FINAL' : 'REVIEW OPNAME'}
                showBackButton
                backHref="/dashboard"
            />

            {appMode === 'pic' ? (
                <PICOpnameView userInfo={userInfo} />
            ) : (
                <KontraktorOpnameView userInfo={userInfo} />
            )}
        </div>
    );
}
