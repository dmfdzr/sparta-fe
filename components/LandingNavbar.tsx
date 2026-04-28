// components/LandingNavbar.tsx
import React from 'react';

export default function LandingNavbar() {
  return (
    <header className="flex h-16 md:h-24 items-center justify-center p-3 md:p-6 bg-linear-to-br from-red-600 to-red-800 text-white border-b border-red-900 shadow-md relative overflow-hidden">
      <div className="flex items-center justify-between md:justify-center w-full max-w-6xl px-2 md:px-0 relative">
        <img 
          src="/assets/Alfamart-Emblem.png" 
          alt="Alfamart Logo" 
          className="h-10 md:h-20 object-contain animate-in slide-in-from-left-12 duration-1000 md:absolute md:left-0" 
        />
        
        <h1 className="text-xl md:text-4xl font-black text-center tracking-tighter animate-in fade-in zoom-in duration-700 delay-300 drop-shadow-lg">
          SPARTA Building
        </h1>
        
        <img 
          src="/assets/Building-Logo.png" 
          alt="Building Logo" 
          className="h-10 md:h-20 object-contain animate-in zoom-in-50 duration-1000 delay-150 md:absolute md:right-0" 
        />
      </div>
    </header>
  );
}