"use client"

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  isVisible: boolean;
  title?: string;
  subtitle?: string;
}

/**
 * Komponen Loading Overlay yang seragam untuk seluruh fitur.
 * Menampilkan overlay fullscreen dengan backdrop blur, spinner, judul, dan subjudul.
 */
export default function LoadingOverlay({ isVisible, title = "Memuat Data...", subtitle = "Mohon tunggu sebentar" }: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white p-6 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-200 max-w-xs w-full mx-4">
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
          </div>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-slate-800 text-base leading-snug">{title}</span>
          <span className="text-sm text-slate-400 mt-0.5">{subtitle}</span>
        </div>
      </div>
    </div>
  );
}
