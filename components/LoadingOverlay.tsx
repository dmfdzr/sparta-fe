"use client";

import { Loader2 } from "lucide-react";

type LoadingOverlayProps = {
    isVisible: boolean;
    title?: string;
    subtitle?: string;
};

export default function LoadingOverlay({
    isVisible,
    title = "Memproses...",
    subtitle,
}: LoadingOverlayProps) {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div className="w-[92%] max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-red-600" />
                <h3 className="mt-4 text-lg font-bold text-slate-800">{title}</h3>
                {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
            </div>
        </div>
    );
}
