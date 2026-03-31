"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// LogOut, Menu, dan X dihapus dari import ini karena sudah pindah ke AppNavbar
import { AlertTriangle, ChevronRight } from 'lucide-react';

import AppNavbar from '@/components/AppNavbar'; // Import AppNavbar
import { ALL_MENUS, ROLE_CONFIG } from '@/lib/constants';
import { formatRupiah, parseCurrency } from '@/lib/utils';

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

                {/* ===================== MAIN — Home Portal ===================== */}
                <main className="flex-1 flex flex-col overflow-hidden p-3 gap-2 min-w-0">

                    {/* === TOP BAR: info user (1 baris kompak) + judul === */}
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

                        {/* Kanan: judul */}
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-slate-700 leading-tight">Live Dashboard</p>
                                <p className="text-[10px] text-slate-400 leading-tight">Selamat datang di portal SPARTA</p>
                            </div>
                        </div>
                    </div>

                    {/* === WELCOME AREA === */}
                    <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200">
                        <div className="text-center text-slate-400 max-w-md px-6">
                            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-10 h-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 mb-2">Selamat Datang di SPARTA</h2>
                            <p className="text-sm font-medium text-slate-500 mb-4">Sistem Pemantauan dan Administrasi Real-time Toko Alfamart</p>
                            <div className="h-px bg-slate-100 w-full mb-4" />
                            <p className="text-sm font-semibold text-red-600 italic">Pilih menu dari sidebar untuk mulai mengakses fitur</p>
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