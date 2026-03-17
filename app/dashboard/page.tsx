"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LogOut, AlertTriangle, Menu, X, ChevronRight, RefreshCw } from 'lucide-react';

import { ALL_MENUS, ROLE_CONFIG } from '@/lib/constants';
import { fetchMonitoringData } from '@/lib/api';
import { formatRupiah, parseCurrency } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================
interface MonitoringStats {
    totalProyek:             number;
    perluPerhatian:          number;
    totalNilaiPenawaran:     number;
    totalNilaiSPK:           number;
    rataRataJHK:             number;
    rataRataKeterlambatan:   number;
    totalDenda:              number;
    rataRataCostM2:          number;
    rataRataNilaiToko:       number;
    rataRataNilaiKontraktor: number;
    rataRataBeanspot:        number;
    statusCounts:            Record<string, number>;
}

// =============================================================================
// STAT CARD CONFIG — 9 kartu kecil (baris 2–4, masing-masing span 2 dari 6 kolom)
// =============================================================================
const STAT_CARDS = [
    {
        id: 'penawaran', label: 'Total Nilai Penawaran',
        iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', accent: 'border-l-indigo-500',
        getValue: (s: MonitoringStats) => formatRupiah(s.totalNilaiPenawaran),
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    },
    {
        id: 'spk', label: 'Total Nilai SPK',
        iconBg: 'bg-orange-50', iconColor: 'text-orange-600', accent: 'border-l-orange-500',
        getValue: (s: MonitoringStats) => formatRupiah(s.totalNilaiSPK),
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    },
    {
        id: 'jhk', label: 'Rata-rata JHK', sub: 'Durasi SPK + Tambah + Terlambat',
        iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', accent: 'border-l-emerald-500',
        getValue: (s: MonitoringStats) => `${Math.round(s.rataRataJHK)} Hari`,
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    },
    {
        id: 'keterlambatan', label: 'Rata-rata Keterlambatan', sub: 'Per Proyek',
        iconBg: 'bg-red-50', iconColor: 'text-red-500', accent: 'border-l-red-400',
        getValue: (s: MonitoringStats) => `${Math.round(s.rataRataKeterlambatan)} Hari`,
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    },
    {
        id: 'denda', label: 'Total Denda', sub: 'Keterlambatan Proyek',
        iconBg: 'bg-rose-50', iconColor: 'text-rose-700', accent: 'border-l-rose-700',
        getValue: (s: MonitoringStats) => formatRupiah(s.totalDenda),
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    },
    {
        id: 'cost-m2', label: 'Rata-rata Cost/m²', sub: 'Terbangun | Bangunan | Terbuka',
        iconBg: 'bg-violet-50', iconColor: 'text-violet-600', accent: 'border-l-violet-500',
        getValue: (s: MonitoringStats) => formatRupiah(s.rataRataCostM2),
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    },
    {
        id: 'nilai-toko', label: 'Rata-rata Nilai Toko',
        iconBg: 'bg-amber-50', iconColor: 'text-amber-600', accent: 'border-l-amber-500',
        getValue: (s: MonitoringStats) => formatRupiah(s.rataRataNilaiToko),
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    },
    {
        id: 'nilai-kontraktor', label: 'Rata-rata Nilai Kontraktor',
        iconBg: 'bg-sky-50', iconColor: 'text-sky-600', accent: 'border-l-sky-500',
        getValue: (s: MonitoringStats) => formatRupiah(s.rataRataNilaiKontraktor),
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>,
    },
    {
        id: 'beanspot', label: 'Rata-rata Nilai Beanspot', sub: 'Cost / Store',
        iconBg: 'bg-pink-50', iconColor: 'text-pink-600', accent: 'border-l-pink-500',
        getValue: (s: MonitoringStats) => formatRupiah(s.rataRataBeanspot),
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
    },
];

// =============================================================================
// PARSE MONITORING DATA
// =============================================================================
function parseMonitoringStats(raw: any): MonitoringStats {
    const data: any[] = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
    let totalNilaiPenawaran = 0, totalNilaiSPK = 0, totalJHK = 0;
    let totalKeterlambatan = 0, totalDenda = 0, totalCostM2 = 0;
    let totalNilaiToko = 0, totalNilaiKontraktor = 0, totalBeanspot = 0;
    let jhkCount = 0, ketCount = 0, costCount = 0, tokoCount = 0, konCount = 0, beanCount = 0;
    const statusCounts: Record<string, number> = {};

    data.forEach((item: any) => {
        totalNilaiPenawaran   += parseCurrency(item.grand_total_final ?? item.grand_total ?? 0);
        totalNilaiSPK         += parseCurrency(item.nilai_kontrak ?? 0);
        totalDenda            += parseCurrency(item.total_denda ?? 0);
        const jhk = Number(item.jhk ?? item.hari_kerja ?? 0);
        if (jhk > 0) { totalJHK += jhk; jhkCount++; }
        const ket = Number(item.hari_terlambat ?? item.keterlambatan ?? 0);
        if (ket > 0) { totalKeterlambatan += ket; ketCount++; }
        const cm2 = parseCurrency(item.cost_per_m2 ?? 0);
        if (cm2 > 0) { totalCostM2 += cm2; costCount++; }
        const nt = parseCurrency(item.nilai_toko ?? 0);
        if (nt > 0) { totalNilaiToko += nt; tokoCount++; }
        const nk = parseCurrency(item.nilai_kontraktor ?? 0);
        if (nk > 0) { totalNilaiKontraktor += nk; konCount++; }
        const bs = parseCurrency(item.nilai_beanspot ?? item.beanspot ?? 0);
        if (bs > 0) { totalBeanspot += bs; beanCount++; }
        const status = item.status_proyek ?? item.status ?? 'Lainnya';
        statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    });

    return {
        totalProyek:             data.length,
        perluPerhatian:          data.filter((d: any) => Number(d.hari_terlambat ?? d.keterlambatan ?? 0) > 0).length,
        totalNilaiPenawaran,     totalNilaiSPK,
        rataRataJHK:             jhkCount  > 0 ? totalJHK  / jhkCount  : 0,
        rataRataKeterlambatan:   ketCount  > 0 ? totalKeterlambatan / ketCount : 0,
        totalDenda,
        rataRataCostM2:          costCount > 0 ? totalCostM2 / costCount : 0,
        rataRataNilaiToko:       tokoCount > 0 ? totalNilaiToko / tokoCount : 0,
        rataRataNilaiKontraktor: konCount  > 0 ? totalNilaiKontraktor / konCount : 0,
        rataRataBeanspot:        beanCount > 0 ? totalBeanspot / beanCount : 0,
        statusCounts,
    };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function DashboardPage() {
    const router = useRouter();

    const [userInfo, setUserInfo]           = useState({ name: '', role: '', cabang: '' });
    const [allowedMenus, setAllowedMenus]   = useState<any[]>([]);
    const [isLoading, setIsLoading]         = useState(true);
    const [sidebarOpen, setSidebarOpen]     = useState(true);
    const [isContractor, setIsContractor]   = useState(false);

    const [stats, setStats]                 = useState<MonitoringStats | null>(null);
    const [statsLoading, setStatsLoading]   = useState(false);

    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const [featureAlertOpen, setFeatureAlertOpen] = useState(false);

    // =========================================================================
    // INIT
    // =========================================================================
    useEffect(() => {
        const userRole    = sessionStorage.getItem('userRole') || '';
        const userCabang  = sessionStorage.getItem('loggedInUserCabang') || '';
        const email       = sessionStorage.getItem('loggedInUserEmail') || '';
        const namaLengkap = sessionStorage.getItem('nama_lengkap') || email.split('@')[0];

        if (!userRole) { router.push('/'); return; }

        const currentRole    = userRole.toUpperCase().trim();
        const contractorFlag = currentRole.includes('KONTRAKTOR');
        const isHO           = userCabang.toUpperCase().trim() === 'HEAD OFFICE';

        let allowedIds: string[] = ROLE_CONFIG[currentRole] ? [...ROLE_CONFIG[currentRole]] : [];
        if (allowedIds.length === 0) {
            allowedIds = isHO
                ? [...(ROLE_CONFIG['BRANCH BUILDING & MAINTENANCE MANAGER'] ?? [])]
                : [...(ROLE_CONFIG['BRANCH BUILDING SUPPORT'] ?? [])];
        }
        if (isHO && !contractorFlag && !allowedIds.includes('menu-userlog')) {
            allowedIds.push('menu-userlog');
        }

        setAllowedMenus(ALL_MENUS.filter(m => allowedIds.includes(m.id)));
        setUserInfo({ name: namaLengkap.toUpperCase(), role: currentRole, cabang: userCabang.toUpperCase() });
        setIsContractor(contractorFlag);
        if (window.innerWidth <= 768) setSidebarOpen(false);
        setIsLoading(false);
    }, [router]);

    // =========================================================================
    // MONITORING DATA
    // =========================================================================
    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const raw = await fetchMonitoringData();
            setStats(parseMonitoringStats(raw));
        } catch {
            setStats(null);
        } finally {
            setStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isLoading && !isContractor) loadStats();
    }, [isLoading, isContractor, loadStats]);

    const handleLogout = () => { sessionStorage.clear(); router.push('/'); };

    // =========================================================================
    // LOADING STATE
    // =========================================================================
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
                    <span className="text-sm font-medium">Memuat Dashboard...</span>
                </div>
            </div>
        );
    }

    // =========================================================================
    // RENDER
    // =========================================================================
    return (
        // h-screen + overflow-hidden → tidak ada scroll sama sekali
        <div className="h-screen flex flex-col overflow-hidden bg-slate-100 font-sans text-slate-800">

            {/* ================================================================
                HEADER — PERSIS SAMA dengan halaman lain (opname, approval, dll.)
            ================================================================ */}
            <header className="flex items-center justify-between p-4 md:px-8 bg-linear-to-r from-red-700 via-red-600 to-red-800 text-white shadow-md border-b border-red-900 sticky top-0 z-30 shrink-0">
                <div className="flex items-center gap-3 md:gap-5">
                    <button
                        onClick={() => setSidebarOpen(prev => !prev)}
                        className="p-2 rounded-lg bg-white/15 hover:bg-white/30 border border-white/20 transition-all duration-200 shrink-0"
                        aria-label="Toggle sidebar"
                    >
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                    <img src="/assets/Alfamart-Emblem.png" alt="Logo" className="h-8 md:h-12 object-contain drop-shadow-md" />
                    <div className="h-6 md:h-8 w-px bg-white/30 hidden md:block" />
                    <h1 className="text-lg md:text-2xl font-bold md:font-extrabold tracking-widest drop-shadow-md">SPARTA</h1>
                    <img src="/assets/Building-Logo.png" alt="BM Logo" className="h-8 md:h-12 hidden sm:block object-contain drop-shadow-md" />
                </div>
                <div className="flex items-center gap-2 relative z-10">
                    <Button
                        variant="outline"
                        onClick={() => setLogoutDialogOpen(true)}
                        className="bg-black/10 hover:bg-white hover:text-red-700 text-white border-white/30 transition-all shadow-sm backdrop-blur-sm h-9 px-3 md:px-4"
                    >
                        <LogOut className="w-4 h-4 md:mr-2" />
                        <span className="hidden md:inline">Logout</span>
                    </Button>
                </div>
            </header>

            {/* ================================================================
                BODY: SIDEBAR + MAIN CONTENT
            ================================================================ */}
            <div className="flex flex-1 overflow-hidden relative">

                {/* Overlay gelap — hanya mobile */}
                {sidebarOpen && (
                    <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
                )}

                {/* ===================== SIDEBAR ===================== */}
                <aside
                    className={`
                        shrink-0 bg-white border-r border-slate-200 flex flex-col z-20
                        transition-all duration-300 ease-in-out overflow-hidden
                        absolute md:relative top-0 left-0 h-full
                        ${sidebarOpen
                            ? 'w-62.5 translate-x-0 shadow-xl md:shadow-none'
                            : 'w-0 -translate-x-full md:translate-x-0 md:w-0'}
                    `}
                >
                    {/* Sidebar header */}
                    <div className="px-4 pt-4 pb-2.5 border-b border-slate-100 shrink-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Navigasi</p>
                        <h2 className="text-sm font-bold text-slate-700 mt-0.5">Fitur Akses</h2>
                    </div>

                    {/* Menu items */}
                    <nav className="flex-1 overflow-y-auto px-2.5 py-2.5 flex flex-col gap-0.5">
                        {allowedMenus.map((menu) => {
                            const IconComp = menu.icon;
                            const inner = (
                                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 hover:border-red-200 border border-transparent transition-all duration-200 group cursor-pointer">
                                    <div className="w-7 h-7 rounded-md bg-slate-100 group-hover:bg-red-100 flex items-center justify-center shrink-0 transition-colors">
                                        <IconComp className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-600 transition-colors" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-semibold text-slate-700 group-hover:text-red-700 truncate leading-tight transition-colors">{menu.title}</p>
                                        <p className="text-[10px] text-slate-400 truncate leading-tight">{menu.desc}</p>
                                    </div>
                                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-red-400 shrink-0 transition-colors" />
                                </div>
                            );
                            if (menu.isAlert) return (
                                <div key={menu.id} onClick={() => { setFeatureAlertOpen(true); if (window.innerWidth <= 768) setSidebarOpen(false); }}>{inner}</div>
                            );
                            if (menu.external) return (
                                <a key={menu.id} href={menu.href} target="_blank" rel="noopener noreferrer">{inner}</a>
                            );
                            return (
                                <Link key={menu.id} href={menu.href} onClick={() => { if (window.innerWidth <= 768) setSidebarOpen(false); }}>{inner}</Link>
                            );
                        })}
                        {allowedMenus.length === 0 && (
                            <div className="text-center py-8 px-3">
                                <AlertTriangle className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                                <p className="text-xs text-slate-400">Tidak ada menu tersedia</p>
                            </div>
                        )}
                    </nav>

                    {/* Sidebar footer */}
                    <div className="px-4 py-2.5 border-t border-slate-100 shrink-0">
                        <p className="text-[10px] text-slate-300 text-center">SPARTA — Alfamart B&amp;M</p>
                    </div>
                </aside>

                {/* ===================== MAIN — no scroll, hanya monitoring ===================== */}
                <main className="flex-1 flex flex-col overflow-hidden p-3 gap-2 min-w-0">

                    {/* === TOP BAR: info user (1 baris kompak) + judul + refresh === */}
                    <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-2 shrink-0 shadow-sm gap-3">

                        {/* Kiri: avatar inisial + nama + role + cabang */}
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                                {userInfo.name ? userInfo.name.charAt(0) : '?'}
                            </div>
                            <span className="text-sm font-bold text-slate-800 truncate max-w-40 hidden sm:block">
                                {userInfo.name || '-'}
                            </span>
                            {userInfo.role && (
                                <span className="text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full hidden md:block whitespace-nowrap">
                                    {userInfo.role}
                                </span>
                            )}
                            {userInfo.cabang && (
                                <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full hidden lg:block whitespace-nowrap">
                                    {userInfo.cabang}
                                </span>
                            )}
                        </div>

                        {/* Kanan: judul + tombol refresh */}
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-slate-700 leading-tight">Live Monitoring</p>
                                <p className="text-[10px] text-slate-400 leading-tight">Ringkasan data proyek aktif</p>
                            </div>
                            <button
                                onClick={loadStats}
                                disabled={statsLoading}
                                title="Refresh data monitoring"
                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 flex items-center justify-center text-slate-500 hover:text-red-600 transition-all disabled:opacity-50 shrink-0"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* === AREA MONITORING === */}
                    {isContractor ? (
                        // Kontraktor tidak melihat monitoring
                        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200">
                            <div className="text-center text-slate-400">
                                <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                                <p className="text-sm font-semibold">Pilih menu dari sidebar untuk memulai</p>
                                <p className="text-xs mt-1 text-slate-300">Data monitoring tidak tersedia untuk Kontraktor</p>
                            </div>
                        </div>

                    ) : statsLoading && !stats ? (
                        // Skeleton — pertahankan struktur grid agar tidak layout-shift
                        <div
                            className="flex-1 grid gap-2 min-h-0"
                            style={{ gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(4, 1fr)' }}
                        >
                            {[...Array(11)].map((_, i) => (
                                <div
                                    key={i}
                                    className="bg-white rounded-xl border border-slate-200 animate-pulse"
                                    style={{ gridColumn: i < 2 ? 'span 3' : 'span 2' }}
                                />
                            ))}
                        </div>

                    ) : !stats ? (
                        // Error state
                        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200">
                            <div className="text-center">
                                <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                <p className="text-sm font-semibold text-slate-500">Gagal memuat data monitoring</p>
                                <button onClick={loadStats} className="mt-2 text-xs text-red-600 font-semibold underline">
                                    Coba lagi
                                </button>
                            </div>
                        </div>

                    ) : (
                        // =====================================================
                        // MONITORING GRID: 6 kolom × 4 baris
                        //
                        // Struktur:
                        //   Baris 1 → [Total Proyek, span 3] [Perlu Perhatian, span 3]
                        //   Baris 2 → [Penawaran][SPK][JHK]      (masing-masing span 2)
                        //   Baris 3 → [Keterlambatan][Denda][Cost/m²]
                        //   Baris 4 → [Nilai Toko][Nilai Kontraktor][Beanspot]
                        //
                        // Semua baris memakai 1fr → mengisi tinggi yang tersisa.
                        // overflow: hidden → tidak ada scroll apapun.
                        // =====================================================
                        <div
                            className="flex-1 grid gap-2 min-h-0"
                            style={{
                                gridTemplateColumns: 'repeat(6, 1fr)',
                                gridTemplateRows:    'repeat(4, 1fr)',
                            }}
                        >
                            {/* ----- Baris 1: Total Proyek ----- */}
                            <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-blue-500 shadow-sm p-3 flex items-center gap-3 min-w-0 overflow-hidden col-span-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                </div>
                                <div className="shrink-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 leading-none">Total Proyek</p>
                                    <p className="text-2xl font-extrabold text-slate-800 leading-tight">{stats.totalProyek}</p>
                                    <p className="text-[10px] text-slate-400 leading-none">Toko Terdaftar</p>
                                </div>
                                {Object.keys(stats.statusCounts).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 border-l border-dashed border-slate-200 pl-3 flex-1 items-center min-w-0 overflow-hidden">
                                        {Object.entries(stats.statusCounts).slice(0, 6).map(([label, count]) => (
                                            <div key={label} className="text-center bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 min-w-11">
                                                <span className="block text-[9px] text-slate-500 font-semibold truncate max-w-14">{label}</span>
                                                <span className="block text-xs font-bold text-blue-600">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ----- Baris 1: Perlu Perhatian ----- */}
                            <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-red-500 shadow-sm p-3 flex items-center gap-3 min-w-0 overflow-hidden col-span-3">
                                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                </div>
                                <div className="shrink-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 leading-none">Perlu Perhatian</p>
                                    <p className="text-2xl font-extrabold text-red-500 leading-tight">{stats.perluPerhatian}</p>
                                    <p className="text-[10px] text-slate-400 leading-none">Toko Melebihi SLA</p>
                                </div>
                                <div className="flex flex-wrap gap-1.5 border-l border-dashed border-slate-200 pl-3 flex-1 items-center min-w-0 overflow-hidden">
                                    {[
                                        { label: 'Approval RAB', hint: '≤ 2 Hari' },
                                        { label: 'Proses PJU',   hint: '≤ 7 Hari' },
                                        { label: 'Approval SPK', hint: '≤ 2 Hari' },
                                        { label: 'Ongoing',      hint: 'Sebelum Akhir SPK' },
                                        { label: 'KTK',          hint: '≤ 14 Hari' },
                                    ].map(({ label, hint }) => (
                                        <div key={label} className="text-center bg-red-50 rounded-lg px-2 py-1 border border-red-100 min-w-14">
                                            <span className="block text-[9px] text-red-500 font-semibold truncate max-w-16">{label}</span>
                                            <span className="block text-[9px] text-red-300 leading-none">{hint}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ----- Baris 2–4: 9 kartu metrik (masing-masing span 2) ----- */}
                            {STAT_CARDS.map((card) => (
                                <div
                                    key={card.id}
                                    className={`bg-white rounded-xl border border-slate-200 border-l-4 ${card.accent} shadow-sm p-3 flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 min-w-0 overflow-hidden col-span-2`}
                                >
                                    <div className={`w-9 h-9 rounded-xl ${card.iconBg} ${card.iconColor} flex items-center justify-center shrink-0`}>
                                        {card.icon}
                                    </div>
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 leading-none truncate">{card.label}</p>
                                        <p className="text-base font-extrabold text-slate-800 leading-snug mt-0.5 truncate">{card.getValue(stats)}</p>
                                        {card.sub && <p className="text-[9px] text-slate-400 truncate leading-none">{card.sub}</p>}
                                    </div>
                                </div>
                            ))}

                        </div>
                    )}

                </main>
            </div>

            {/* ====================== MODALS ====================== */}
            <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
                <AlertDialogContent className="rounded-2xl max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Keluar</AlertDialogTitle>
                        <AlertDialogDescription>
                            Apakah Anda yakin ingin keluar dari sistem SPARTA? Sesi Anda akan diakhiri.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700">Ya, Logout</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={featureAlertOpen} onOpenChange={setFeatureAlertOpen}>
                <AlertDialogContent className="text-center rounded-2xl max-w-sm">
                    <AlertDialogHeader>
                        <div className="mx-auto bg-amber-100 text-amber-600 w-16 h-16 flex items-center justify-center rounded-full mb-4">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <AlertDialogTitle className="text-center">Informasi</AlertDialogTitle>
                        <AlertDialogDescription className="text-center">
                            Fitur Surat Peringatan belum tersedia saat ini.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:justify-center">
                        <AlertDialogAction className="bg-amber-500 hover:bg-amber-600 w-full rounded-lg">Tutup</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}