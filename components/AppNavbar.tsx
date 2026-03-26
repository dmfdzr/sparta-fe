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
    <header className="flex items-center justify-between p-4 md:px-8 bg-linear-to-r from-red-700 via-red-600 to-red-800 text-white shadow-md border-b border-red-900 sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-3 md:gap-5">
        {showMenuToggle && onMenuToggle && (
          <button onClick={onMenuToggle} className="p-2 rounded-lg bg-white/15 hover:bg-white/30 border border-white/20 transition-all duration-200 shrink-0" aria-label="Toggle sidebar">
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
        {showBackButton && (
          <Link href={backHref} className="mr-2 hover:bg-white/20 p-2 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
        )}
        <img src="/assets/Alfamart-Emblem.png" alt="Logo" className="h-8 md:h-12 object-contain drop-shadow-md" />
        <div className="h-6 md:h-8 w-px bg-white/30 hidden md:block" />
        <h1 className="text-lg md:text-2xl font-bold md:font-extrabold tracking-widest drop-shadow-md whitespace-nowrap">{title}</h1>
        {showBuildingLogo && (
          <img src="/assets/Building-Logo.png" alt="BM Logo" className="h-8 md:h-12 hidden sm:block object-contain drop-shadow-md" />
        )}
      </div>

      <div className="flex items-center gap-2 relative z-10">
        {/* Render custom action di sini (seperti icon lonceng) */}
        {rightActions}
        
        {showLogout && onLogout && (
          <Button variant="outline" onClick={onLogout} className="bg-black/10 hover:bg-white hover:text-red-700 text-white border-white/30 transition-all shadow-sm backdrop-blur-sm h-9 px-3 md:px-4">
            <LogOut className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Logout</span>
          </Button>
        )}
      </div>
    </header>
  );
}