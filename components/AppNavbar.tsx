"use client"

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, X, ChevronLeft } from 'lucide-react';

interface AppNavbarProps {
  title?: string;
  showBackButton?: boolean;
  backHref?: string;
  showMenuToggle?: boolean;
  isMenuOpen?: boolean;
  onMenuToggle?: () => void;
  showLogout?: boolean;
  onLogout?: () => void;
  showBuildingLogo?: boolean;
  rightActions?: React.ReactNode; // <--- Tambahkan ini
}

export default function AppNavbar({
  title = "SPARTA",
  showBackButton = false,
  backHref = "/dashboard",
  showMenuToggle = false,
  isMenuOpen = false,
  onMenuToggle,
  showLogout = false,
  onLogout,
  showBuildingLogo = false,
  rightActions // <--- Tambahkan ini
}: AppNavbarProps) {
  return (
    <header className="flex items-center justify-between p-3 md:px-8 bg-linear-to-r from-red-700 via-red-600 to-red-800 text-white shadow-md border-b border-red-900 sticky top-0 z-50 shrink-0 gap-2">
      <div className="flex items-center gap-2 md:gap-5 min-w-0">
        {showMenuToggle && onMenuToggle && (
          <button onClick={onMenuToggle} className="p-1.5 md:p-2 rounded-lg bg-white/15 hover:bg-white/30 border border-white/20 transition-all duration-200 shrink-0" aria-label="Toggle sidebar">
            {isMenuOpen ? <X className="w-4 h-4 md:w-5 md:h-5" /> : <Menu className="w-4 h-4 md:w-5 md:h-5" />}
          </button>
        )}
        {showBackButton && (
          <Link href={backHref} className="mr-1 hover:bg-white/20 p-1.5 rounded-full transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Link>
        )}
        <img src="/assets/Alfamart-Emblem.png" alt="Logo" className="h-7 md:h-12 object-contain drop-shadow-md shrink-0" />
        <div className="h-6 md:h-8 w-px bg-white/30 hidden md:block shrink-0" />
        <h1 className="text-base sm:text-lg md:text-2xl font-bold md:font-extrabold tracking-widest drop-shadow-md truncate">{title}</h1>
        {showBuildingLogo && (
          <img src="/assets/Building-Logo.png" alt="BM Logo" className="h-7 md:h-12 hidden sm:block object-contain drop-shadow-md shrink-0" />
        )}
      </div>

      <div className="flex items-center gap-1.5 md:gap-3 relative z-10 shrink-0">
        {/* Render custom action di sini (seperti icon lonceng) */}
        {rightActions}
        
        {showLogout && onLogout && (
          <Button variant="outline" onClick={onLogout} className="bg-black/10 hover:bg-white hover:text-red-700 text-white border-white/30 transition-all shadow-sm backdrop-blur-sm h-8 md:h-9 px-2.5 md:px-4">
            <LogOut className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline text-xs md:text-sm">Logout</span>
          </Button>
        )}
      </div>
    </header>
  );
}