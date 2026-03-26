// components/LandingNavbar.tsx
import React from 'react';

export default function LandingNavbar() {
  return (
    <header className="flex flex-col md:flex-row items-center justify-center p-4 md:p-6 bg-linear-to-br from-red-600 to-red-800 text-white border-b border-red-900 shadow-md relative overflow-hidden">
      <div className="flex items-center justify-center w-full max-w-6xl relative">
        <div className="hidden md:block absolute left-0 animate-in slide-in-from-left-12 duration-1000">
          <img src="/assets/Alfamart-Emblem.png" alt="Alfamart Logo" className="h-16 md:h-20 object-contain" />
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-center tracking-tight animate-in fade-in zoom-in duration-700 delay-300">
          SPARTA
        </h1>
        
        <div className="hidden md:block absolute right-0 animate-in zoom-in-50 duration-1000 delay-150">
          <img src="/assets/Building-Logo.png" alt="Building & Maintenance Logo" className="h-16 md:h-20 object-contain" />
        </div>
      </div>
    </header>
  );
}