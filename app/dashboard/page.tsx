"use client"

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import AppNavbar from '@/components/AppNavbar';
import { ALL_MENUS, ROLE_CONFIG, getPpRoles } from '@/lib/constants';
import { formatRupiah, parseCurrency } from '@/lib/utils';
import { fetchDashboardAll, fetchProjekPlanningList } from '@/lib/api';
import { 
    Activity, CheckCircle2, ChevronRight, Clock, FileCheck, FileEdit, FileText, 
    HardHat, Layers, Search, Store, Users, MapPin, RefreshCw,
    TrendingUp, AlertCircle, Calendar, Loader2, Home, DollarSign,
    Tag, UserCheck, Coffee, AlertTriangle, X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function DashboardPage() {
    const router = useRouter();

    const [userInfo, setUserInfo]           = useState({ name: '', roles: [] as string[], cabang: '' });
    const [allowedMenus, setAllowedMenus]   = useState<any[]>([]);
    const [isLoading, setIsLoading]         = useState(true);
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [detailModal, setDetailModal] = useState({ open: false, title: '', context: '', subContext: '' });
    const [modalPage, setModalPage] = useState(1);
    const itemsPerPage = 5;
    const [sidebarOpen, setSidebarOpen]     = useState(true);
    const [isContractor, setIsContractor]   = useState(false);
    const [fpdHasUpdate, setFpdHasUpdate]   = useState(false);

    // Data State
    const [projects, setProjects] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCabang, setSelectedCabang] = useState('ALL');
    const [cabangList, setCabangList] = useState<string[]>([]);

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
        
        // Handle Multi-Role (DIREKTUR, KONTRAKTOR)
        const roles = userRole.split(',').map(r => r.trim().toUpperCase());
        const contractorFlag = roles.some(r => r.includes('KONTRAKTOR'));
        const isHO = userCabang.toUpperCase().trim() === 'HEAD OFFICE';

        let combinedAllowedIds: string[] = [];
        roles.forEach(role => {
            if (ROLE_CONFIG[role]) {
                combinedAllowedIds = [...combinedAllowedIds, ...ROLE_CONFIG[role]];
            }
        });

        // Unique IDs
        let allowedIds = Array.from(new Set(combinedAllowedIds));

        if (allowedIds.length === 0) {
            allowedIds = isHO
                ? [...(ROLE_CONFIG['BRANCH BUILDING & MAINTENANCE MANAGER'] ?? [])]
                : [...(ROLE_CONFIG['BRANCH BUILDING SUPPORT'] ?? [])];
        }

        if (isHO) {
            allowedIds.push("menu-users");
        }

        setAllowedMenus(ALL_MENUS.filter(m => allowedIds.includes(m.id)));
        setUserInfo({ name: namaLengkap.toUpperCase(), roles: roles, cabang: userCabang.toUpperCase() });
        setIsContractor(contractorFlag);
        
        if (window.innerWidth <= 768) setSidebarOpen(false);
        
        // Initial Data Fetch
        fetchDashboardData(userCabang.toUpperCase());
        setIsLoading(false);

        if (allowedIds.includes("menu-projek-planning")) {
            const lastChecked = localStorage.getItem("last_checked_fpd") || "1970-01-01T00:00:00Z";
            const filters: Record<string, string> = {};
            
            const { isCoor, isBM, isPP, isPPMgr } = getPpRoles(roles, email);
            
            const isOnlyCoor = isCoor && !isBM && !isPP && !isPPMgr;
            if (isOnlyCoor) filters.email_pembuat = email;
            
            const isHO = userCabang.toUpperCase() === "HEAD OFFICE";
            if (!isHO && userCabang) filters.cabang = userCabang;
            
            fetchProjekPlanningList(filters).then(r => {
                const items = r.data || [];
                let actionRequired = false;
                
                if (isPPMgr) {
                    actionRequired = items.some(i => i.status === "WAITING_PP_MANAGER_APPROVAL");
                } else if (isPP) {
                    actionRequired = items.some(i => i.status === "WAITING_PP_APPROVAL_1" || i.status === "WAITING_PP_APPROVAL_2");
                } else if (isBM) {
                    actionRequired = items.some(i => i.status === "WAITING_BM_APPROVAL");
                } else if (isCoor) {
                    actionRequired = items.some(i => ["DRAFT", "PP_DESIGN_3D_REQUIRED", "WAITING_RAB_UPLOAD", "REJECTED"].includes(i.status));
                }
                
                const hasNew = items.some(i => new Date(i.updated_at) > new Date(lastChecked));
                if (actionRequired || hasNew) setFpdHasUpdate(true);
            }).catch(() => {});
        }
    }, [router]);

    useEffect(() => {
        if (detailModal.open) setModalPage(1);
    }, [detailModal.open, detailModal.context, detailModal.subContext]);

    const fetchDashboardData = async (userCabang: string) => {
        setIsDataLoading(true);
        try {
            // Fetch dari API real
            const json = await fetchDashboardAll();
            let data = json.data || [];
            
            // Filter by branch for non-HO users (except if ALL is selected)
            if (userInfo.cabang !== 'HEAD OFFICE' && userCabang !== 'HEAD OFFICE' && userCabang !== 'ALL') {
                data = data.filter((p: any) => p.toko?.cabang?.toUpperCase() === userCabang);
            }

            setProjects(data);
            
            // Extract unique branches for HO selector
            const branches: string[] = Array.from(new Set(data.map((p: any) => p.toko?.cabang?.toUpperCase()).filter(Boolean)));
            setCabangList(branches.sort());
        } catch (err) {
            console.error('Gagal memuat data dashboard:', err);
            setProjects([]);
            setCabangList([]);
        } finally {
            setIsDataLoading(false);
        }
    };



    // Logic for filtered projects
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const matchSearch = 
                p.toko.nomor_ulok?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.toko.nama_toko?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.toko.kode_toko?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.toko.cabang?.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchCabang = selectedCabang === 'ALL' || (p.toko?.cabang || '').toUpperCase() === selectedCabang;
            
            return matchSearch && matchCabang;
        });
    }, [projects, searchQuery, selectedCabang]);

    // Summary Stats
    const stats = useMemo(() => {
        let totalPenawaran = 0;
        let totalSPK = 0;
        let totalJHK = 0;
        let totalDelay = 0;
        let totalDenda = 0;
        let totalCostM2 = 0;
        let totalNilaiToko = 0;
        let totalNilaiKontraktor = 0;
        let totalBeanspot = 0;
        let attentionCount = 0;
        let jhkProjectCount = 0;

        let miniStats = { 'Approval RAB': 0, 'Proses PJU': 0, 'Approval SPK': 0, 'Ongoing': 0, 'Kerja Tambah Kurang': 0, 'Done': 0 };
        let miniPerhatian = { 'Approval RAB': 0, 'Proses PJU': 0, 'Approval SPK': 0, 'Ongoing': 0, 'Kerja Tambah Kurang': 0 };

        filteredProjects.forEach(p => {
            // Mapping Category (Funnel)
            const hasRAB = (p.rab || []).length > 0;
            const rabData = p.rab?.[0];
            const isRabDisetujui = rabData && (rabData.status || '').toUpperCase() === 'DISETUJUI';
            
            const spkArray = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
            const hasSPK = spkArray.some((s: any) => {
                const st = (s.status || '').toUpperCase();
                return ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes(st);
            });
            const hasApprovalSPK = spkArray.some((s: any) => (s.status || '').toUpperCase() === 'WAITING_FOR_BM_APPROVAL');
            
            const hasST = (p.berkas_serah_terima || []).length > 0;
            const opnameArr = Array.isArray(p.opname_final) ? p.opname_final : (p.opname_final ? [p.opname_final] : []);
            const hasOpname = opnameArr.length > 0;
            const opnameData = opnameArr[0];
            const isOpnameDisetujui = opnameData && (opnameData.status_opname_final || '').toUpperCase() === 'DISETUJUI';

            let cat = '';
            if (hasOpname && isOpnameDisetujui) { cat = 'Done'; miniStats['Done']++; }
            else if (hasOpname && !isOpnameDisetujui) { cat = 'Kerja Tambah Kurang'; miniStats['Kerja Tambah Kurang']++; }
            else if (hasST) { cat = 'Kerja Tambah Kurang'; miniStats['Kerja Tambah Kurang']++; }
            else if (hasSPK) { cat = 'Ongoing'; miniStats['Ongoing']++; }
            else if (hasApprovalSPK) { cat = 'Approval SPK'; miniStats['Approval SPK']++; }
            else if (isRabDisetujui) { cat = 'Proses PJU'; miniStats['Proses PJU']++; }
            else { cat = 'Approval RAB'; miniStats['Approval RAB']++; }

            // SLA / Attention Logic
            const createdAt = new Date(p.toko?.created_at || Date.now());
            const diffDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            
            let isPerhatian = false;
            if (cat === 'Ongoing') {
                const spkArr = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                const approvedSpk = spkArr.find((s: any) => {
                    const st = (s.status || '').toUpperCase();
                    return ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes(st);
                });
                if (approvedSpk) {
                    const waktuMulai = new Date(approvedSpk.waktu_mulai || approvedSpk.created_at || Date.now());
                    const durasiSPK = Number(approvedSpk.durasi || 0);
                    const pertambahanArr = Array.isArray(approvedSpk.pertambahan_spk) ? approvedSpk.pertambahan_spk : [];
                    const totalPertambahan = pertambahanArr
                        .filter((pt: any) => (pt.status_persetujuan || '').toUpperCase() === 'APPROVED')
                        .reduce((sum: number, pt: any) => sum + Number(pt.pertambahan_hari || 0), 0);
                    const totalAllowedDays = durasiSPK + totalPertambahan;
                    const elapsedDays = Math.floor((Date.now() - waktuMulai.getTime()) / (1000 * 60 * 60 * 24));
                    if (elapsedDays > totalAllowedDays) {
                        isPerhatian = true;
                    }
                }
            }
            else if (cat === 'Approval SPK') {
                const spkArray = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                const spkData = spkArray[0];
                if (spkData) {
                    const spkCreatedAt = new Date(spkData.created_at || p.toko?.created_at || Date.now());
                    const spkDiffDays = Math.floor((Date.now() - spkCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                    if (spkDiffDays > 2) {
                        isPerhatian = true;
                    }
                } else {
                    if (diffDays > 7) isPerhatian = true;
                }
            }
            else if (cat === 'Approval RAB') {
                const rabData = p.rab?.[0];
                if (rabData) {
                    const rabCreatedAt = new Date(rabData.created_at || p.toko?.created_at || Date.now());
                    const rabDiffDays = Math.floor((Date.now() - rabCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                    const isDisetujui = (rabData.status || '').toUpperCase() === 'DISETUJUI';
                    
                    if (rabDiffDays > 2 && !isDisetujui) {
                        isPerhatian = true;
                    }
                }
            }
            else if (cat === 'Proses PJU') {
                const rabData = p.rab?.[0];
                if (rabData && (rabData.status || '').toUpperCase() === 'DISETUJUI') {
                    const rabApprovedAt = new Date(rabData.waktu_persetujuan_manager || rabData.updated_at || rabData.created_at || p.toko?.created_at || Date.now());
                    const pjuDiffDays = Math.floor((Date.now() - rabApprovedAt.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (pjuDiffDays > 10) {
                        isPerhatian = true;
                    }
                }
            }
            else if (cat === 'Kerja Tambah Kurang') {
                const opnameArr = Array.isArray(p.opname_final) ? p.opname_final : (p.opname_final ? [p.opname_final] : []);
                const opnameData = opnameArr[0];
                if (opnameData) {
                    const opnameCreatedAt = new Date(opnameData.created_at || Date.now());
                    const opnameDiffDays = Math.floor((Date.now() - opnameCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                    const isDisetujui = (opnameData.status_opname_final || '').toUpperCase() === 'DISETUJUI';
                    
                    if (opnameDiffDays > 14 && !isDisetujui) {
                        isPerhatian = true;
                    }
                }
            }

            if (isPerhatian && cat !== 'Done') {
                attentionCount++;
                if (miniPerhatian[cat as keyof typeof miniPerhatian] !== undefined) {
                    miniPerhatian[cat as keyof typeof miniPerhatian]++;
                }
            }

            // Calculations
            const rab = p.rab?.[0];
            if (rab) {
                totalPenawaran += parseCurrency(rab.grand_total_final);
            }

            const spks = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
            spks.forEach((s: any) => {
                const status = (s.status || '').toUpperCase();
                // Include everything except rejected/cancelled to show the full SPK pipeline value
                if (status && !['REJECTED', 'REJECT', 'CANCELLED', 'CANCEL'].includes(status)) {
                    totalSPK += parseCurrency(s.grand_total || s.total_harga);
                }
            });

            let projectJHK = 0;
            const spkArrJHK = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
            const validSpkJHK = spkArrJHK.find((s: any) => {
                const st = (s.status || '').toUpperCase();
                return ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes(st);
            }) || spkArrJHK[0];

            if (validSpkJHK) {
                jhkProjectCount++;
                const durasi = Number(validSpkJHK.durasi || 0);
                const pertambahanArr = Array.isArray(validSpkJHK.pertambahan_spk) ? validSpkJHK.pertambahan_spk : [];
                const totalPertambahan = pertambahanArr
                    .filter((pt: any) => (pt.status_persetujuan || '').toUpperCase() === 'APPROVED')
                    .reduce((sum: number, pt: any) => sum + Number(pt.pertambahan_hari || 0), 0);
                
                const deadlineDate = new Date(validSpkJHK.created_at || Date.now());
                const totalAllowedDays = durasi + totalPertambahan;
                const deadlineMs = deadlineDate.getTime() + (totalAllowedDays * 24 * 60 * 60 * 1000);
                
                const stArr = Array.isArray(p.berkas_serah_terima) ? p.berkas_serah_terima : (p.berkas_serah_terima ? [p.berkas_serah_terima] : []);
                const stData = stArr[0];
                
                let keterlambatan = 0;
                const compareDateMs = stData ? new Date(stData.created_at).getTime() : Date.now();
                
                if (compareDateMs > deadlineMs) {
                    keterlambatan = Math.floor((compareDateMs - deadlineMs) / (1000 * 60 * 60 * 24));
                    
                    let projectDenda = 0;
                    if (keterlambatan > 0) {
                        const hariPertama = Math.min(keterlambatan, 5);
                        const hariBerikutnya = Math.max(0, Math.min(keterlambatan - 5, 10));
                        projectDenda = (hariPertama * 1000000) + (hariBerikutnya * 500000);
                        projectDenda = Math.min(projectDenda, 10000000);
                    }
                    totalDenda += projectDenda;
                }
                
                projectJHK = totalAllowedDays + keterlambatan;
                totalDelay += keterlambatan;
            }
            totalJHK += projectJHK;

            totalNilaiToko += Number(p.toko?.nilai_toko || 0);
            totalNilaiKontraktor += Number(p.toko?.nilai_kontraktor || 0);
        });

        const count = filteredProjects.length || 1;

        return {
            total: filteredProjects.length,
            attention: attentionCount,
            penawaran: totalPenawaran,
            spk: totalSPK,
            avgJHK: Math.round(totalJHK / (jhkProjectCount || 1)),
            avgDelay: Math.round(totalDelay / (jhkProjectCount || 1)),
            totalDenda: totalDenda,
            avgCostM2: 0,
            avgNilaiToko: (totalNilaiToko / count).toFixed(1),
            avgNilaiKontraktor: (totalNilaiKontraktor / count).toFixed(1),
            avgBeanspot: totalBeanspot,
            miniStats,
            miniPerhatian
        };
    }, [filteredProjects]);

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
                HEADER — Menggunakan AppNavbar dengan konfigurasi khusus Dashboard
            ================================================================ */}
            <AppNavbar 
                title="SPARTA"
                showBuildingLogo={true}
                showMenuToggle={true}
                isMenuOpen={sidebarOpen}
                onMenuToggle={() => setSidebarOpen(prev => !prev)}
                showLogout={true}
                onLogout={() => setLogoutDialogOpen(true)}
            />

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
                                    <div className="flex-1 min-w-0 flex items-center justify-between pr-2">
                                        <div className="flex-1 min-w-0 pr-1">
                                            <p className="text-[12px] font-semibold text-slate-700 group-hover:text-red-700 leading-snug transition-colors wrap-break-word">{menu.title}</p>
                                            <p className="text-[10px] text-slate-400 leading-snug wrap-break-word mt-0.5">{menu.desc}</p>
                                        </div>
                                        {menu.id === 'menu-projek-planning' && fpdHasUpdate && (
                                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-2 shrink-0" title="Ada FPD baru atau diperbarui" />
                                        )}
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
                        <p className="text-[10px] text-slate-400 text-center">SPARTA Building — Alfamart</p>
                    </div>
                </aside>

                {/* ===================== MAIN — Home Portal ===================== */}
                <main className="flex-1 flex flex-col overflow-hidden p-3 gap-2 min-w-0">

                    {/* === TOP BAR: info user (1 baris kompak) + judul === */}
                    <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-1.5 shrink-0 shadow-sm gap-3">

                        {/* Kiri: avatar inisial + nama + role + cabang */}
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                                {userInfo.name ? userInfo.name.charAt(0) : '?'}
                            </div>
                            <span className="text-sm font-bold text-slate-800 truncate max-w-40 hidden sm:block">
                                {userInfo.name || '-'}
                            </span>
                            {userInfo.roles.length > 0 && userInfo.roles.map((r, idx) => (
                                <span key={idx} className="text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full hidden md:block whitespace-nowrap">
                                    {r}
                                </span>
                            ))}
                            {userInfo.cabang && (
                                <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full hidden lg:block whitespace-nowrap">
                                    {userInfo.cabang}
                                </span>
                            )}
                        </div>

                        {/* Kanan: judul & filter info + ACTION (Moved from content) */}
                        <div className="flex items-center gap-3 shrink-0">
                            {/* Branch Select (For HO only) */}
                            {userInfo.cabang === 'HEAD OFFICE' && (
                                <Select value={selectedCabang} onValueChange={setSelectedCabang}>
                                    <SelectTrigger className="w-full md:w-40 h-8 rounded-lg text-xs bg-slate-50 border-slate-200">
                                        <SelectValue placeholder="Pilih Cabang" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Semua Cabang</SelectItem>
                                        {cabangList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}

                            {/* Refresh Button */}
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 shrink-0 bg-slate-50 border-slate-200" 
                                onClick={() => fetchDashboardData(userInfo.cabang)}
                                disabled={isDataLoading}
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isDataLoading ? 'animate-spin' : ''}`} />
                            </Button>

                            <div className="text-right hidden sm:block border-l border-slate-200 pl-3">
                                <p className="text-xs font-bold text-slate-700 leading-tight">Live Dashboard</p>
                                <p className="text-[10px] text-slate-400 leading-tight">Project Monitoring</p>
                            </div>
                        </div>
                    </div>

                    {/* === WELCOME AREA -> MONITORING DASHBOARD === */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 rounded-xl border border-slate-200">
                        
                        {/* 1. SCROLLABLE CONTENT */}
                        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-2 custom-scrollbar">
                            
                            {/* 1.1 SUMMARY CARDS - GRID BARU */}
                            {userInfo.cabang === 'HEAD OFFICE' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-3 auto-rows-min">
                                <StatCard 
                                    title="Total Proyek" 
                                    value={stats.total} 
                                    icon={<Home />} 
                                    bgColor="#eff6ff"
                                    textColor="#2563eb"
                                    subLabel="Toko Terdaftar"
                                    className="xl:col-span-2"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Detail Status Proyek', context: 'PROJECT', subContext: '' })}
                                    renderExtra={
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 w-full mt-2 md:mt-0 md:w-auto">
                                            {Object.entries(stats.miniStats).map(([label, val]) => (
                                                <div key={label} className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 flex flex-col items-center justify-center min-w-17.5 hover:bg-blue-50 transition-colors">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase leading-none text-center">{label}</span>
                                                    <span className="text-[12px] font-black text-blue-600 mt-1 leading-none">{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    }
                                />
                                <StatCard 
                                    title="Perlu Perhatian" 
                                    value={stats.attention} 
                                    icon={<AlertTriangle />} 
                                    bgColor="#fef2f2"
                                    textColor="#ef4444"
                                    subLabel="Toko Melebihi SLA"
                                    valueColor="#ef4444"
                                    className="xl:col-span-2"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Detail SLA (Perlu Perhatian)', context: 'ATTENTION', subContext: '' })}
                                    renderExtra={
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 w-full mt-2 md:mt-0 md:w-auto">
                                            {Object.entries(stats.miniPerhatian).map(([label, val]) => (
                                                <div key={label} className={`rounded-lg px-2 py-1 flex flex-col items-center justify-center min-w-17.5 border hover:opacity-80 transition-opacity ${val > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                                    <span className={`text-[8px] font-bold uppercase leading-none text-center ${val > 0 ? 'text-red-400' : 'text-slate-400'}`}>{label}</span>
                                                    <span className={`text-[12px] font-black mt-1 leading-none ${val > 0 ? 'text-red-600' : 'text-slate-400'}`}>{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    }
                                />
                                <StatCard 
                                    title="Total Nilai Penawaran" 
                                    value={formatRupiah(stats.penawaran)} 
                                    icon={<FileText />} 
                                    bgColor="#e0e7ff"
                                    textColor="#4338ca"
                                    subLabel='Grand Total Final'
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Daftar Penawaran (by Ulok)', context: 'PENAWARAN', subContext: '' })}
                                />
                                <StatCard 
                                    title="Total Nilai SPK" 
                                    value={formatRupiah(stats.spk)} 
                                    icon={<DollarSign />} 
                                    bgColor="#fff7ed"
                                    textColor="#c05621"
                                    subLabel='Grand Total'
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Daftar SPK (by Ulok)', context: 'SPK', subContext: '' })}
                                />
                                <StatCard 
                                    title="Rata-rata JHK Pekerjaan" 
                                    value={`${stats.avgJHK} Hari`} 
                                    icon={<Calendar />} 
                                    bgColor="#f0fff4"
                                    textColor="#2f855a"
                                    subLabel="Durasi SPK + Tambah SPK + Keterlambatan"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Rincian JHK Pekerjaan', context: 'JHK', subContext: '' })}
                                />
                                <StatCard 
                                    title="Rata-rata Keterlambatan" 
                                    value={`${stats.avgDelay} Hari`} 
                                    icon={<Clock />} 
                                    bgColor="#fff5f5"
                                    textColor="#e53e3e"
                                    subLabel="Per Proyek"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Rincian Keterlambatan', context: 'DELAY', subContext: '' })}
                                />
                                <StatCard 
                                    title="Total Denda" 
                                    value={formatRupiah(stats.totalDenda)} 
                                    icon={<AlertCircle />} 
                                    bgColor="#fee2e2"
                                    textColor="#b91c1c"
                                    subLabel="Keterlambatan Proyek"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Rincian Denda', context: 'DENDA', subContext: '' })}
                                />
                                <StatCard 
                                    title="Rata-rata Cost/m²" 
                                    value={formatRupiah(stats.avgCostM2)} 
                                    icon={<Layers />} 
                                    bgColor="#faf5ff"
                                    textColor="#805ad5"
                                    subLabel="Terbangun | Bangunan | Terbuka"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Rata-rata Cost/m²', context: 'COST_M2', subContext: '' })}
                                />
                                <StatCard 
                                    title="Rata-rata Nilai Toko" 
                                    value={stats.avgNilaiToko} 
                                    icon={<Tag />} 
                                    bgColor="#fef3c7"
                                    textColor="#d97706"
                                    subLabel="Nilai Toko"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Rata-rata Nilai Toko', context: 'NILAI_TOKO', subContext: '' })}
                                />
                                <StatCard 
                                    title="Rata-rata Nilai Kontraktor" 
                                    value={stats.avgNilaiKontraktor} 
                                    icon={<UserCheck />} 
                                    bgColor="#e0f2fe"
                                    textColor="#0284c7"
                                    subLabel="Nilai Kontraktor"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Rata-rata Nilai Kontraktor', context: 'NILAI_KONTRAKTOR', subContext: '' })}
                                />
                                <StatCard 
                                    title="Rata-rata Nilai Beanspot" 
                                    value={formatRupiah(stats.avgBeanspot)} 
                                    icon={<Coffee />} 
                                    bgColor="#fdf2f8"
                                    textColor="#db2777"
                                    subLabel="Cost /Store"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Rincian Nilai Beanspot', context: 'BEANSPOT', subContext: '' })}
                                />
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 py-20">
                                    <Activity className="w-12 h-12 text-slate-200" />
                                    <p className="text-sm font-medium">Monitoring Dashboard khusus akses Head Office</p>
                                </div>
                            )}


                        </div>
                    </div>

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

            <AlertDialog 
                open={detailModal.open} 
                onOpenChange={(open) => setDetailModal(prev => ({ ...prev, open }))}
            >
                <AlertDialogContent className="max-w-none! w-[98vw]! max-h-[92vh]! overflow-hidden flex flex-col p-0 rounded-2xl border-none shadow-2xl">
                    <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                                <Activity className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <AlertDialogTitle className="text-base font-bold leading-none">{detailModal.title}</AlertDialogTitle>
                                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-semibold">Monitoring Rincian Data</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-white hover:bg-white/10 rounded-full"
                                onClick={() => fetchDashboardData(selectedCabang)}
                                disabled={isDataLoading}
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isDataLoading ? 'animate-spin' : ''}`} />
                            </Button>
                            <AlertDialogCancel className="bg-white/10 border-none text-white hover:bg-white/20 hover:text-white h-8 w-8 p-0 rounded-full flex items-center justify-center">
                                <X className="w-4 h-4" />
                            </AlertDialogCancel>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                        {detailModal.context === 'PROJECT' && !detailModal.subContext && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(stats.miniStats).map(([label, val]) => (
                                    <div 
                                        key={label} 
                                        onClick={() => setDetailModal(prev => ({ ...prev, subContext: label }))}
                                        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                        <div className="text-3xl font-black text-slate-800">{val}</div>
                                        <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Klik untuk melihat daftar toko</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {detailModal.context === 'ATTENTION' && !detailModal.subContext && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(stats.miniPerhatian).map(([label, val]) => (
                                    <div 
                                        key={label} 
                                        onClick={() => val > 0 && setDetailModal(prev => ({ ...prev, subContext: label }))}
                                        className={`p-5 rounded-2xl border transition-all group ${val > 0 ? 'bg-white border-red-100 hover:border-red-300 shadow-sm hover:shadow-md cursor-pointer' : 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed'}`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${val > 0 ? 'text-red-400' : 'text-slate-400'}`}>{label}</span>
                                            {val > 0 && <ChevronRight className="w-4 h-4 text-red-300 group-hover:text-red-500 transition-colors" />}
                                        </div>
                                        <div className={`text-3xl font-black ${val > 0 ? 'text-red-600' : 'text-slate-300'}`}>{val}</div>
                                        <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Toko melebihi batas SLA</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(detailModal.subContext || !['PROJECT', 'ATTENTION'].includes(detailModal.context)) && (() => {
                            const modalData = filteredProjects.filter(p => {
                                if (!detailModal.subContext) {
                                    // Context-specific filtering for summary views
                                    if (detailModal.context === 'SPK') {
                                        return (Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : [])).some((s: any) => s.status && !['REJECTED', 'REJECT', 'CANCELLED', 'CANCEL'].includes(s.status.toUpperCase()));
                                    }
                                    if (detailModal.context === 'PENAWARAN') {
                                        return (p.rab || []).length > 0;
                                    }
                                    if (detailModal.context === 'JHK' || detailModal.context === 'DELAY' || detailModal.context === 'DENDA') {
                                        const spkArr = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                                        const validSpk = spkArr.find((s: any) => ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes((s.status || '').toUpperCase())) || spkArr[0];
                                        if (!validSpk) return false;
                                        if (detailModal.context === 'JHK') return true;

                                        const durasi = Number(validSpk.durasi || 0);
                                        const pertambahanArr = Array.isArray(validSpk.pertambahan_spk) ? validSpk.pertambahan_spk : [];
                                        const totalPertambahan = pertambahanArr.filter((pt: any) => (pt.status_persetujuan || '').toUpperCase() === 'APPROVED').reduce((sum: number, pt: any) => sum + Number(pt.pertambahan_hari || 0), 0);
                                        const totalAllowedDays = durasi + totalPertambahan;
                                        const deadlineMs = new Date(validSpk.created_at || Date.now()).getTime() + (totalAllowedDays * 24 * 60 * 60 * 1000);
                                        const stArr = Array.isArray(p.berkas_serah_terima) ? p.berkas_serah_terima : (p.berkas_serah_terima ? [p.berkas_serah_terima] : []);
                                        let keterlambatan = 0;
                                        const compareDateMs = stArr[0] ? new Date(stArr[0].created_at).getTime() : Date.now();
                                        if (compareDateMs > deadlineMs) keterlambatan = Math.floor((compareDateMs - deadlineMs) / (1000 * 60 * 60 * 24));
                                        
                                        return keterlambatan > 0;
                                    }
                                    return true;
                                }
                                
                                const hasRAB = (p.rab || []).length > 0;
                                const rabData = p.rab?.[0];
                                const isRabDisetujui = rabData && (rabData.status || '').toUpperCase() === 'DISETUJUI';
                                
                                const spkArray = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                                const hasSPK = spkArray.some((s: any) => ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes((s.status || '').toUpperCase()));
                                const hasApprovalSPK = spkArray.some((s: any) => (s.status || '').toUpperCase() === 'WAITING_FOR_BM_APPROVAL');
                                
                                const hasST = (p.berkas_serah_terima || []).length > 0;
                                const opnameArr = Array.isArray(p.opname_final) ? p.opname_final : (p.opname_final ? [p.opname_final] : []);
                                const hasOpname = opnameArr.length > 0;
                                const opnameData = opnameArr[0];
                                const isOpnameDisetujui = opnameData && (opnameData.status_opname_final || '').toUpperCase() === 'DISETUJUI';

                                let cat = '';
                                if (hasOpname && isOpnameDisetujui) cat = 'Done';
                                else if (hasOpname && !isOpnameDisetujui) cat = 'Kerja Tambah Kurang';
                                else if (hasST) cat = 'Kerja Tambah Kurang';
                                else if (hasSPK) cat = 'Ongoing';
                                else if (hasApprovalSPK) cat = 'Approval SPK';
                                else if (isRabDisetujui) cat = 'Proses PJU';
                                else cat = 'Approval RAB';

                                if (cat !== detailModal.subContext) return false;

                                if (detailModal.context === 'ATTENTION') {
                                    const createdAt = new Date(p.toko?.created_at || Date.now());
                                    const diffDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                                    
                                    let isPerhatian = false;
                                    if (cat === 'Ongoing') {
                                        const spkArr = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                                        const approvedSpk = spkArr.find((s: any) => {
                                            const st = (s.status || '').toUpperCase();
                                            return ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes(st);
                                        });
                                        if (approvedSpk) {
                                            const waktuMulai = new Date(approvedSpk.waktu_mulai || approvedSpk.created_at || Date.now());
                                            const durasiSPK = Number(approvedSpk.durasi || 0);
                                            const pertambahanArr = Array.isArray(approvedSpk.pertambahan_spk) ? approvedSpk.pertambahan_spk : [];
                                            const totalPertambahan = pertambahanArr
                                                .filter((pt: any) => (pt.status_persetujuan || '').toUpperCase() === 'APPROVED')
                                                .reduce((sum: number, pt: any) => sum + Number(pt.pertambahan_hari || 0), 0);
                                            const totalAllowedDays = durasiSPK + totalPertambahan;
                                            const elapsedDays = Math.floor((Date.now() - waktuMulai.getTime()) / (1000 * 60 * 60 * 24));
                                            if (elapsedDays > totalAllowedDays) {
                                                isPerhatian = true;
                                            }
                                        }
                                    }
                                    else if (cat === 'Approval SPK') {
                                        const spkArray = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                                        const spkData = spkArray[0];
                                        if (spkData) {
                                            const spkCreatedAt = new Date(spkData.created_at || p.toko?.created_at || Date.now());
                                            const spkDiffDays = Math.floor((Date.now() - spkCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                                            if (spkDiffDays > 2) {
                                                isPerhatian = true;
                                            }
                                        } else {
                                            if (diffDays > 7) isPerhatian = true;
                                        }
                                    }
                                    else if (cat === 'Approval RAB') {
                                        const rabData = p.rab?.[0];
                                        if (rabData) {
                                            const rabCreatedAt = new Date(rabData.created_at || p.toko?.created_at || Date.now());
                                            const rabDiffDays = Math.floor((Date.now() - rabCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                                            const isDisetujui = (rabData.status || '').toUpperCase() === 'DISETUJUI';
                                            
                                            if (rabDiffDays > 2 && !isDisetujui) {
                                                isPerhatian = true;
                                            }
                                        }
                                    }
                                    else if (cat === 'Proses PJU') {
                                        const rabData = p.rab?.[0];
                                        if (rabData && (rabData.status || '').toUpperCase() === 'DISETUJUI') {
                                            const rabApprovedAt = new Date(rabData.waktu_persetujuan_manager || rabData.updated_at || rabData.created_at || p.toko?.created_at || Date.now());
                                            const pjuDiffDays = Math.floor((Date.now() - rabApprovedAt.getTime()) / (1000 * 60 * 60 * 24));
                                            
                                            if (pjuDiffDays > 10) {
                                                isPerhatian = true;
                                            }
                                        }
                                    }
                                    else if (cat === 'Kerja Tambah Kurang') {
                                        const opnameArr = Array.isArray(p.opname_final) ? p.opname_final : (p.opname_final ? [p.opname_final] : []);
                                        const opnameData = opnameArr[0];
                                        if (opnameData) {
                                            const opnameCreatedAt = new Date(opnameData.created_at || Date.now());
                                            const opnameDiffDays = Math.floor((Date.now() - opnameCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                                            const isDisetujui = (opnameData.status_opname_final || '').toUpperCase() === 'DISETUJUI';
                                            
                                            if (opnameDiffDays > 14 && !isDisetujui) {
                                                isPerhatian = true;
                                            }
                                        }
                                    }

                                    return isPerhatian && cat !== 'Done';
                                }

                                return true;
                            });

                            const totalPages = Math.ceil(modalData.length / itemsPerPage);
                            const paginatedData = modalData.slice((modalPage - 1) * itemsPerPage, modalPage * itemsPerPage);

                            return (
                                <div className="space-y-3">
                                    {detailModal.subContext && (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="mb-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 -ml-2"
                                            onClick={() => setDetailModal(prev => ({ ...prev, subContext: '' }))}
                                        >
                                            <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Kembali ke Ringkasan
                                        </Button>
                                    )}
                                    
                                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                <tr>
                                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Toko / Ulok</th>
                                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cabang</th>
                                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Informasi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {paginatedData.map((p, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                                        <td className="px-4 py-3">
                                                            <div className="font-bold text-slate-700 text-xs truncate max-w-37.5">{p.toko?.nama_toko}</div>
                                                            <div className="text-[10px] font-mono text-red-500 bg-red-50 px-1 rounded inline-block mt-0.5">{p.toko?.nomor_ulok}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-[10px] font-semibold text-slate-500">{p.toko?.cabang}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="text-[11px] font-black text-slate-700">
                                                                {detailModal.context === 'PENAWARAN' 
                                                                    ? formatRupiah(parseCurrency(p.rab?.[0]?.grand_total_final))
                                                                    : detailModal.context === 'SPK' 
                                                                        ? formatRupiah((Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : [])).filter((s: any) => s.status && !['REJECTED', 'REJECT', 'CANCELLED', 'CANCEL'].includes(s.status.toUpperCase())).reduce((acc: number, s: any) => acc + parseCurrency(s.grand_total || s.total_harga), 0))
                                                                        : detailModal.context === 'JHK' 
                                                                            ? (() => {
                                                                                const spkArr = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                                                                                const validSpk = spkArr.find((s: any) => ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes((s.status || '').toUpperCase())) || spkArr[0];
                                                                                if (!validSpk) return '-';
                                                                                const durasi = Number(validSpk.durasi || 0);
                                                                                const pertambahanArr = Array.isArray(validSpk.pertambahan_spk) ? validSpk.pertambahan_spk : [];
                                                                                const totalPertambahan = pertambahanArr.filter((pt: any) => (pt.status_persetujuan || '').toUpperCase() === 'APPROVED').reduce((sum: number, pt: any) => sum + Number(pt.pertambahan_hari || 0), 0);
                                                                                const totalAllowedDays = durasi + totalPertambahan;
                                                                                const deadlineMs = new Date(validSpk.created_at || Date.now()).getTime() + (totalAllowedDays * 24 * 60 * 60 * 1000);
                                                                                const stArr = Array.isArray(p.berkas_serah_terima) ? p.berkas_serah_terima : (p.berkas_serah_terima ? [p.berkas_serah_terima] : []);
                                                                                let keterlambatan = 0;
                                                                                const compareDateMs = stArr[0] ? new Date(stArr[0].created_at).getTime() : Date.now();
                                                                                if (compareDateMs > deadlineMs) keterlambatan = Math.floor((compareDateMs - deadlineMs) / (1000 * 60 * 60 * 24));
                                                                                return `${totalAllowedDays + keterlambatan} Hari (Durasi SPK : ${durasi}, Tambah SPK: ${totalPertambahan}, Terlambat: ${keterlambatan})`;
                                                                            })()
                                                                            : detailModal.context === 'DELAY'
                                                                                ? (() => {
                                                                                    const spkArr = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                                                                                    const validSpk = spkArr.find((s: any) => ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes((s.status || '').toUpperCase())) || spkArr[0];
                                                                                    if (!validSpk) return '0 Hari';
                                                                                    const durasi = Number(validSpk.durasi || 0);
                                                                                    const pertambahanArr = Array.isArray(validSpk.pertambahan_spk) ? validSpk.pertambahan_spk : [];
                                                                                    const totalPertambahan = pertambahanArr.filter((pt: any) => (pt.status_persetujuan || '').toUpperCase() === 'APPROVED').reduce((sum: number, pt: any) => sum + Number(pt.pertambahan_hari || 0), 0);
                                                                                    const totalAllowedDays = durasi + totalPertambahan;
                                                                                    const deadlineMs = new Date(validSpk.created_at || Date.now()).getTime() + (totalAllowedDays * 24 * 60 * 60 * 1000);
                                                                                    const stArr = Array.isArray(p.berkas_serah_terima) ? p.berkas_serah_terima : (p.berkas_serah_terima ? [p.berkas_serah_terima] : []);
                                                                                    let keterlambatan = 0;
                                                                                    const compareDateMs = stArr[0] ? new Date(stArr[0].created_at).getTime() : Date.now();
                                                                                    if (compareDateMs > deadlineMs) keterlambatan = Math.floor((compareDateMs - deadlineMs) / (1000 * 60 * 60 * 24));
                                                                                    return `${keterlambatan} Hari`;
                                                                                })()
                                                                            : detailModal.context === 'DENDA'
                                                                                ? (() => {
                                                                                    const spkArr = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                                                                                    const validSpk = spkArr.find((s: any) => ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes((s.status || '').toUpperCase())) || spkArr[0];
                                                                                    if (!validSpk) return 'Rp 0';
                                                                                    const durasi = Number(validSpk.durasi || 0);
                                                                                    const pertambahanArr = Array.isArray(validSpk.pertambahan_spk) ? validSpk.pertambahan_spk : [];
                                                                                    const totalPertambahan = pertambahanArr.filter((pt: any) => (pt.status_persetujuan || '').toUpperCase() === 'APPROVED').reduce((sum: number, pt: any) => sum + Number(pt.pertambahan_hari || 0), 0);
                                                                                    const totalAllowedDays = durasi + totalPertambahan;
                                                                                    const deadlineMs = new Date(validSpk.created_at || Date.now()).getTime() + (totalAllowedDays * 24 * 60 * 60 * 1000);
                                                                                    const stArr = Array.isArray(p.berkas_serah_terima) ? p.berkas_serah_terima : (p.berkas_serah_terima ? [p.berkas_serah_terima] : []);
                                                                                    let keterlambatan = 0;
                                                                                    const compareDateMs = stArr[0] ? new Date(stArr[0].created_at).getTime() : Date.now();
                                                                                    if (compareDateMs > deadlineMs) keterlambatan = Math.floor((compareDateMs - deadlineMs) / (1000 * 60 * 60 * 24));
                                                                                    
                                                                                    let denda = 0;
                                                                                    if (keterlambatan > 0) {
                                                                                        const hariPertama = Math.min(keterlambatan, 5);
                                                                                        const hariBerikutnya = Math.max(0, Math.min(keterlambatan - 5, 10));
                                                                                        denda = (hariPertama * 1000000) + (hariBerikutnya * 500000);
                                                                                        denda = Math.min(denda, 10000000);
                                                                                    }
                                                                                    return formatRupiah(denda);
                                                                                })()
                                                                            : detailModal.context === 'NILAI_TOKO'
                                                                                ? `${p.toko?.nilai_toko || 0}`
                                                                                : p.toko?.proyek
                                                                }
                                                            </div>
                                                            <div className="text-[9px] text-slate-400 italic">{p.toko?.lingkup_pekerjaan}</div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {paginatedData.length === 0 && (
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-12 text-center text-xs text-slate-400 italic">
                                                            Tidak ada data untuk ditampilkan
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Controls */}
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                                        <p className="text-[11px] text-slate-400 font-medium">
                                            Menampilkan <span className="text-slate-700 font-bold">{Math.min(modalData.length, (modalPage - 1) * itemsPerPage + 1)} - {Math.min(modalData.length, modalPage * itemsPerPage)}</span> dari <span className="text-slate-700 font-bold">{modalData.length}</span> data
                                        </p>
                                        {totalPages > 1 && (
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 px-3 text-[10px] font-bold border-slate-200"
                                                    onClick={() => setModalPage(p => Math.max(1, p - 1))}
                                                    disabled={modalPage === 1}
                                                >
                                                    Sebelumnya
                                                </Button>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] font-bold text-slate-400">Halaman</span>
                                                    <span className="text-[10px] font-black text-blue-600 px-2 py-1 bg-blue-50 rounded-md border border-blue-100">{modalPage}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">dari {totalPages}</span>
                                                </div>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 px-3 text-[10px] font-bold border-slate-200"
                                                    onClick={() => setModalPage(p => Math.min(totalPages, p + 1))}
                                                    disabled={modalPage === totalPages}
                                                >
                                                    Selanjutnya
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    <div className="px-6 py-4 bg-white border-t border-slate-100 shrink-0">
                        <p className="text-[11px] text-slate-400 font-medium italic">* Data diperbarui secara real-time berdasarkan filter yang aktif</p>
                    </div>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatCard({ 
    title, 
    value, 
    icon, 
    bgColor, 
    textColor, 
    subLabel, 
    valueColor,
    className,
    renderExtra,
    onClick,
    isLoading = false
}: { 
    title: string, 
    value: string | number, 
    icon: React.ReactNode, 
    bgColor: string, 
    textColor: string, 
    subLabel?: string,
    valueColor?: string,
    className?: string,
    renderExtra?: React.ReactNode,
    onClick?: () => void,
    isLoading?: boolean
}) {
    if (isLoading) {
        return (
            <Card className={`overflow-hidden border-none shadow-md bg-white ${className}`}>
                <CardContent className="px-3.5 py-2 flex flex-col md:flex-row md:items-center gap-4 h-23">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-2 w-16 bg-slate-100 animate-pulse rounded" />
                            <div className="h-5 w-24 bg-slate-100 animate-pulse rounded" />
                            <div className="h-2 w-20 bg-slate-100 animate-pulse rounded" />
                        </div>
                    </div>
                    {renderExtra && (
                        <div className="hidden md:block shrink-0 border-l border-slate-100 pl-4">
                            <div className="grid grid-cols-3 gap-1">
                                {[1,2,3,4,5,6].map(i => (
                                    <div key={i} className="w-16 h-8 bg-slate-50 animate-pulse rounded-lg" />
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card 
            onClick={onClick}
            className={`overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer bg-white active:scale-[0.98] ${className}`}
        >
            <CardContent className="px-3.5 py-2 flex flex-col md:flex-row md:items-center gap-4 h-full">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: bgColor, color: textColor }}>
                        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-5.5 h-5.5" }) : icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{title}</p>
                        <h3 className="text-lg font-black text-slate-800 truncate" style={{ color: valueColor }}>
                            <AnimatedNumber value={value} isLoading={isLoading} />
                        </h3>
                        {subLabel && <p className="text-[9px] font-medium text-slate-500 leading-tight mt-0.5 line-clamp-1">{subLabel}</p>}
                    </div>
                </div>
                {renderExtra && (
                    <div className="shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-1.5 md:pt-0 md:pl-4">
                        {renderExtra}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * A component that animates a numeric value from 0 to the target value.
 */
function AnimatedNumber({ value, isLoading }: { value: string | number, isLoading: boolean }) {
    const numericValue = useMemo(() => {
        if (typeof value === 'number') return value;
        if (!value) return 0;
        // Clean currency prefix before parsing
        const cleaned = typeof value === 'string' ? value.replace(/Rp\s?/g, '') : value;
        return parseCurrency(cleaned);
    }, [value]);

    const [displayValue, setDisplayValue] = useState(0);
    
    const isRupiah = typeof value === 'string' && value.includes('Rp');
    const isHari = typeof value === 'string' && value.includes('Hari');
    const hasDecimals = typeof value === 'string' && value.includes('.') && !isRupiah;
    const decimalPlaces = hasDecimals ? (value.toString().split('.')[1] || '').length : 0;

    useEffect(() => {
        if (isLoading) {
            setDisplayValue(0);
            return;
        }

        const start = 0;
        const end = numericValue;
        const duration = 1200; 
        const startTime = performance.now();

        let animationFrame: number;

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Cubic ease out
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            const current = easeProgress * (end - start) + start;
            setDisplayValue(current);

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            }
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [numericValue, isLoading]);

    if (isLoading) return null;

    if (isRupiah) return <>{formatRupiah(Math.floor(displayValue))}</>;
    if (isHari) return <>{Math.floor(displayValue)} Hari</>;
    if (hasDecimals) return <>{displayValue.toFixed(decimalPlaces)}</>;

    return <>{Math.floor(displayValue)}</>;
}