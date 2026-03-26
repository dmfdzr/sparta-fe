"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, FolderOpen, Loader2, UploadCloud, Eye, Download, Link as LinkIcon } from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';

// --- KONFIGURASI API (GOOGLE APPS SCRIPT) ---
const SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyUpg_II5NKNw1YFSyWiTiVBLKuNdnawunFRJJCJeCs4sWwjX3fB7sKi-tefj8-lSn8mQ/exec";

// --- UTILS ---
const fileToBase64 = (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = (reader.result as string).split(",")[1];
            resolve({
                name: file.name,
                mimeType: file.type,
                size: file.size,
                base64: base64String,
                extension: file.name.split(".").pop(),
            });
        };
        reader.onerror = (error) => reject(error);
    });
};

export default function MateraiPage() {
    const router = useRouter();
    
    // State User Session
    const [user, setUser] = useState<any>(null);
    
    // State Navigasi View
    const [activeView, setActiveView] = useState<'menu' | 'buat' | 'hasil'>('menu');

    // State Data Dropdown
    const [cabangOpts, setCabangOpts] = useState<string[]>([]);
    const [ulokOpts, setUlokOpts] = useState<string[]>([]);
    const [lingkupOpts, setLingkupOpts] = useState<string[]>([]);
    
    // State Form Buat Dokumen
    const [formCabang, setFormCabang] = useState('');
    const [formUlok, setFormUlok] = useState('');
    const [formLingkup, setFormLingkup] = useState('');
    const [filePdf, setFilePdf] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // State Form Hasil Dokumen
    const [filterUlok, setFilterUlok] = useState('');
    const [filterLingkup, setFilterLingkup] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isLoadingResults, setIsLoadingResults] = useState(false);

    useEffect(() => {
        const isAuth = sessionStorage.getItem("authenticated");
        if (isAuth !== "true") {
            alert("Sesi Anda telah habis. Silakan login kembali.");
            router.push('/auth');
            return;
        }

        const sessionUser = {
            email: sessionStorage.getItem("loggedInUserEmail") || "",
            cabang: sessionStorage.getItem("loggedInUserCabang") || "",
            role: sessionStorage.getItem("userRole") || "",
            name: (sessionStorage.getItem("loggedInUserEmail") || "").split('@')[0]
        };
        setUser(sessionUser);
        
        // Init Cabang & Ulok
        setCabangOpts([sessionUser.cabang]);
        setFormCabang(sessionUser.cabang);
        fetchOptions('ulok', sessionUser.cabang).then(setUlokOpts);
    }, [router]);

    // --- FUNGSI API ---
    const fetchOptions = async (mode: string, cabang: string, extraUlok?: string) => {
        try {
            const url = new URL(SHEETS_WEB_APP_URL);
            url.searchParams.set("action", "options");
            url.searchParams.set("mode", mode);
            url.searchParams.set("cabang", cabang);
            if (extraUlok) url.searchParams.set("ulok", extraUlok);

            const res = await fetch(url.toString());
            const json = await res.json();
            if (!json.ok) throw new Error(json.message);
            return json.data || [];
        } catch (error) {
            console.error(`Error fetch options ${mode}:`, error);
            return [];
        }
    };

    const handleFetchLingkup = async (ulokValue: string) => {
        setLingkupOpts([]);
        if (!ulokValue) return;
        const opts = await fetchOptions('lingkup', user.cabang, ulokValue);
        setLingkupOpts(opts);
    };

    // --- HANDLER SUBMIT DOKUMEN ---
    const handleSubmitDokumen = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!filePdf) return alert("Pilih file PDF termaterai terlebih dahulu.");
        
        setIsSubmitting(true);
        try {
            const base64Data = await fileToBase64(filePdf);
            const payload = {
                cabang: formCabang,
                ulok: formUlok,
                lingkup: formLingkup,
                docKind: "RAB",
                file: base64Data
            };

            const res = await fetch(SHEETS_WEB_APP_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "create", data: payload }),
            });

            const json = await res.json();
            if (!json.ok) throw new Error(json.message || "Gagal menyimpan data");
            
            alert("Dokumen berhasil diunggah dan disimpan!");
            setFilePdf(null);
            setFormUlok('');
            setFormLingkup('');
            setActiveView('menu');

        } catch (err: any) {
            alert(err.message || "Terjadi kesalahan saat mengunggah.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- HANDLER CARI HASIL ---
    const handleCariHasil = async () => {
        setIsLoadingResults(true);
        setResults([]);
        try {
            const url = new URL(SHEETS_WEB_APP_URL);
            url.searchParams.set("action", "list");
            url.searchParams.set("cabang", user.cabang);
            if (filterUlok) url.searchParams.set("ulok", filterUlok);
            if (filterLingkup) url.searchParams.set("lingkup", filterLingkup);

            const res = await fetch(url.toString());
            const json = await res.json();
            if (!json.ok) throw new Error(json.message || "Gagal memuat dokumen");
            
            setResults(json.data || []);
        } catch (err: any) {
            alert(err.message || "Terjadi kesalahan memuat data.");
        } finally {
            setIsLoadingResults(false);
        }
    };

    if (!user) return null; // Wait for session

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">
            <AppNavbar
                title="Dokumen Termaterai"
                showBackButton
                backHref="/dashboard"
            />

            <main className="max-w-4xl mx-auto px-4">
                
                {/* ================= VIEW: MENU UTAMA ================= */}
                {activeView === 'menu' && (
                    <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Card 
                            className="cursor-pointer hover:border-red-500 hover:shadow-md transition-all group"
                            onClick={() => setActiveView('buat')}
                        >
                            <CardContent className="p-8 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-red-600 group-hover:text-white transition-colors">
                                    <FileText className="w-8 h-8" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-800 mb-2">Buat Dokumen</h2>
                                <p className="text-slate-500 text-sm">Unggah RAB & SPH yang telah digabung dan termaterai.</p>
                            </CardContent>
                        </Card>

                        <Card 
                            className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group"
                            onClick={() => setActiveView('hasil')}
                        >
                            <CardContent className="p-8 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <FolderOpen className="w-8 h-8" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-800 mb-2">Hasil Dokumen</h2>
                                <p className="text-slate-500 text-sm">Lihat dan unduh dokumen tersimpan berdasarkan Ulok.</p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ================= VIEW: BUAT DOKUMEN ================= */}
                {activeView === 'buat' && (
                    <Card className="m-10 animate-in fade-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">Form Upload Dokumen</h2>
                            <Button variant="outline" onClick={() => setActiveView('menu')}>Kembali</Button>
                        </div>
                        <CardContent className="p-6 relative">
                            {/* Loading Overlay */}
                            {isSubmitting && (
                                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-b-xl">
                                    <Loader2 className="w-10 h-10 animate-spin text-red-600 mb-2" />
                                    <p className="font-semibold text-slate-700">Mengunggah ke Server Google...</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmitDokumen} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Cabang</label>
                                        <select disabled className="w-full p-2.5 border rounded-lg bg-slate-50 text-slate-600 font-medium">
                                            <option>{user.cabang}</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Nomor Ulok</label>
                                        <select 
                                            required className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-red-500 outline-none"
                                            value={formUlok} 
                                            onChange={(e) => {
                                                setFormUlok(e.target.value);
                                                handleFetchLingkup(e.target.value);
                                            }}
                                        >
                                            <option value="">Pilih nomor ulok...</option>
                                            {ulokOpts.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Lingkup Kerja</label>
                                        <select 
                                            required className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-red-500 outline-none disabled:bg-slate-50"
                                            value={formLingkup} onChange={(e) => setFormLingkup(e.target.value)} disabled={!formUlok}
                                        >
                                            <option value="">Pilih lingkup...</option>
                                            {lingkupOpts.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-orange-800">Butuh menggabungkan PDF?</p>
                                        <p className="text-sm text-orange-600">Gabungkan RAB & SPH menjadi 1 file PDF sebelum diunggah.</p>
                                    </div>
                                    <a href="https://pdf-combine-beta.vercel.app/" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors">
                                        <LinkIcon className="w-4 h-4" /> Buka Tools
                                    </a>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Upload File Termaterai (PDF)</label>
                                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative">
                                        <input 
                                            type="file" accept="application/pdf" required
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if(f && f.type === "application/pdf") setFilePdf(f);
                                                else { alert("File harus PDF!"); setFilePdf(null); }
                                            }}
                                        />
                                        <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                                        <p className="font-medium text-slate-700">
                                            {filePdf ? filePdf.name : "Klik atau seret file PDF ke sini"}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">Pastikan dokumen sudah digabung dan termeterai e-materai.</p>
                                    </div>
                                </div>

                                <Button type="submit" disabled={isSubmitting || !filePdf} className="w-full h-12 bg-red-600 hover:bg-red-700 text-lg font-bold">
                                    Simpan Dokumen
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* ================= VIEW: HASIL DOKUMEN ================= */}
                {activeView === 'hasil' && (
                    <Card className="animate-in fade-in zoom-in-95 duration-300">
                         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <h2 className="text-xl font-bold text-slate-800">Arsip Dokumen Tersimpan</h2>
                            <Button variant="outline" onClick={() => setActiveView('menu')}>Kembali</Button>
                        </div>
                        <CardContent className="p-6">
                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Nomor Ulok</label>
                                    <select 
                                        className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={filterUlok} 
                                        onChange={(e) => {
                                            setFilterUlok(e.target.value);
                                            handleFetchLingkup(e.target.value);
                                            setFilterLingkup('');
                                        }}
                                    >
                                        <option value="">Semua Ulok</option>
                                        {ulokOpts.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Lingkup Kerja</label>
                                    <select 
                                        className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                                        value={filterLingkup} onChange={(e) => setFilterLingkup(e.target.value)} disabled={!filterUlok}
                                    >
                                        <option value="">Semua Lingkup</option>
                                        {lingkupOpts.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-end gap-2">
                                    <Button onClick={handleCariHasil} disabled={isLoadingResults} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
                                        {isLoadingResults ? <Loader2 className="w-4 h-4 animate-spin" /> : "Terapkan Filter"}
                                    </Button>
                                    <Button variant="outline" onClick={() => { setFilterUlok(''); setFilterLingkup(''); setResults([]); }} className="h-11">
                                        Reset
                                    </Button>
                                </div>
                            </div>

                            {/* Table Results */}
                            {isLoadingResults ? (
                                <div className="py-12 flex flex-col items-center justify-center">
                                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-2" />
                                    <p className="text-slate-500">Mencari data dokumen...</p>
                                </div>
                            ) : results.length > 0 ? (
                                <div className="overflow-x-auto border rounded-xl shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 text-slate-700 border-b">
                                            <tr>
                                                <th className="p-4 font-semibold w-1/3">Nomor Ulok</th>
                                                <th className="p-4 font-semibold w-1/3">Lingkup Kerja</th>
                                                <th className="p-4 font-semibold text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {results.map((it, idx) => {
                                                const viewUrl = it.driveViewUrl || it.previewUrl;
                                                const downloadUrl = it.driveDownloadUrl || it.downloadUrl || viewUrl;
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-4 font-medium text-slate-800 break-all">{it.ulok}</td>
                                                        <td className="p-4 text-slate-600">{it.lingkup}</td>
                                                        <td className="p-4">
                                                            <div className="flex justify-center gap-2">
                                                                {viewUrl ? (
                                                                    <>
                                                                        <a href={viewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-colors">
                                                                            <Eye className="w-4 h-4"/> Lihat
                                                                        </a>
                                                                        <a href={downloadUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg text-xs font-bold transition-colors">
                                                                            <Download className="w-4 h-4"/> Unduh
                                                                        </a>
                                                                    </>
                                                                ) : <span className="text-slate-400 italic">Link tidak tersedia</span>}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl text-center">
                                    <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500 font-medium">Belum ada data dokumen yang ditampilkan.</p>
                                    <p className="text-sm text-slate-400">Silakan terapkan filter untuk mencari dokumen.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

            </main>
        </div>
    );
}