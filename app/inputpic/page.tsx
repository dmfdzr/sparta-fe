"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, UserCheck, Link as LinkIcon, AlertCircle, CheckCircle } from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';

import { 
    fetchPengawasanUlok, fetchPengawasanPic, fetchPengawasanToko, 
    fetchPengawasanSpkDetails, fetchPengawasanSpkUrls, 
    fetchPengawasanRabUrls, submitPengawasanData 
} from '@/lib/api';

export default function PengawasanPage() {
    const router = useRouter();
    
    // Status Loading
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Data Pilihan Dropdown
    const [ulokList, setUlokList] = useState<string[]>([]);
    const [picList, setPicList] = useState<any[]>([]);

    // Status Validasi Link (SPK & RAB)
    const [spkStatus, setSpkStatus] = useState({ text: '', type: '' });
    const [rabStatus, setRabStatus] = useState({ text: '', type: '' });

    // State Form Input
    const [form, setForm] = useState({
        cabang: '',
        kode_ulok: '',
        nama_toko: '',
        kategori_lokasi: '',
        tanggal_spk: '',
        pic_building_support: '',
        spk_url: '',
        rab_url: ''
    });

    useEffect(() => {
        const isAuth = sessionStorage.getItem("authenticated");
        const role = sessionStorage.getItem("userRole");
        const email = sessionStorage.getItem("loggedInUserEmail") || '';
        const cabang = sessionStorage.getItem("loggedInUserCabang") || '';

        if (isAuth !== "true" || !role) { router.push('/auth'); return; }

        const name = email.split('@')[0].toUpperCase();
        setForm(prev => ({ ...prev, cabang }));

        loadInitialData(cabang);
    }, [router]);

    const loadInitialData = async (cabang: string) => {
        setIsLoadingInitial(true);
        try {
            // Ambil daftar Ulok dan daftar PIC secara bersamaan (Paralel)
            const [ulokRes, picRes] = await Promise.all([
                fetchPengawasanUlok(cabang).catch(() => ({ status: 'error', kodeUlokList: [] })),
                fetchPengawasanPic(cabang).catch(() => ({ status: 'error', picList: [] }))
            ]);

            if (ulokRes.status === 'success' && ulokRes.kodeUlokList) {
                setUlokList(ulokRes.kodeUlokList);
            }
            if (picRes.status === 'success' && picRes.picList) {
                setPicList(picRes.picList);
            }
        } catch (error) {
            console.error("Gagal memuat data awal:", error);
        } finally {
            setIsLoadingInitial(false);
        }
    };

    const handleUlokChange = async (selectedUlok: string) => {
        // Reset form details
        setForm(prev => ({ 
            ...prev, kode_ulok: selectedUlok, nama_toko: '', 
            kategori_lokasi: '', tanggal_spk: '', spk_url: '', rab_url: '' 
        }));
        setSpkStatus({ text: '', type: '' });
        setRabStatus({ text: '', type: '' });

        if (!selectedUlok) return;

        setIsFetchingDetails(true);
        try {
            // Menarik 4 data referensi sekaligus dari backend pengawasan
            const [tokoRes, spkDetailsRes, spkUrlRes, rabUrlRes] = await Promise.all([
                fetchPengawasanToko(selectedUlok).catch(() => ({ status: 'error' })),
                fetchPengawasanSpkDetails(selectedUlok).catch(() => ({ status: 'error' })),
                fetchPengawasanSpkUrls(selectedUlok).catch(() => ({ status: 'error' })),
                fetchPengawasanRabUrls(selectedUlok).catch(() => ({ status: 'error' }))
            ]);

            setForm(prev => {
                const updated = { ...prev };
                
                // 1. Set Nama Toko
                if (tokoRes.status === 'success' && tokoRes.namaToko) updated.nama_toko = tokoRes.namaToko.toUpperCase();
                else updated.nama_toko = "Nama Toko Tidak Ditemukan";

                // 2. Set Detail SPK (Durasi & Waktu Mulai)
                if (spkDetailsRes.status === 'success') {
                    if (spkDetailsRes.durasi) updated.kategori_lokasi = spkDetailsRes.durasi;
                    if (spkDetailsRes.waktuMulai) updated.tanggal_spk = spkDetailsRes.waktuMulai;
                }

                // 3. Set Link SPK
                if (spkUrlRes.status === 'success' && spkUrlRes.spkUrls && spkUrlRes.spkUrls.length > 0) {
                    updated.spk_url = spkUrlRes.spkUrls.join(', ');
                    setSpkStatus({ text: `✓ ${spkUrlRes.spkUrls.length} link SPK ditemukan`, type: 'success' });
                } else {
                    setSpkStatus({ text: `✗ SPK tidak ditemukan untuk kode ulok ini`, type: 'error' });
                }

                // 4. Set Link RAB
                if (rabUrlRes.status === 'success' && rabUrlRes.rabUrls && rabUrlRes.rabUrls.length > 0) {
                    updated.rab_url = rabUrlRes.rabUrls.join(', ');
                    setRabStatus({ text: `✓ ${rabUrlRes.rabUrls.length} link RAB ditemukan`, type: 'success' });
                } else {
                    setRabStatus({ text: `✗ RAB tidak ditemukan untuk kode ulok ini`, type: 'error' });
                }

                return updated;
            });
        } catch (error) {
            console.error("Gagal menarik detail Ulok:", error);
        } finally {
            setIsFetchingDetails(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validasi Manual
        if (!form.spk_url) return alert("SPK tidak ditemukan. Pastikan SPK sudah terdata.");
        if (!form.rab_url) return alert("RAB tidak ditemukan. Pastikan RAB sudah terdata.");
        if (!form.pic_building_support) return alert("Pilih PIC Building Support.");

        setIsSubmitting(true);
        try {
            // Parse data PIC yang disimpan dalam bentuk string JSON
            const picData = JSON.parse(form.pic_building_support);

            const payload = {
                form: "input-pic",
                cabang: form.cabang,
                kode_ulok: form.kode_ulok,
                nama_toko: form.nama_toko,
                kategori_lokasi: form.kategori_lokasi,
                tanggal_spk: form.tanggal_spk,
                pic_building_support: picData.email,
                pic_nama: picData.nama,
                spk_url: form.spk_url,
                rab_url: form.rab_url,
            };

            await submitPengawasanData(payload);
            setShowSuccessModal(true);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12 relative">
            <AppNavbar
                title="INPUT PIC PENGAWASAN"
                showBackButton
                backHref="/dashboard"
            />

            <main className="max-w-4xl mx-auto p-4 md:p-8 mt-4">
                <Card className="shadow-sm border-slate-200">
                    <div className="p-6 border-b border-slate-100 bg-white rounded-t-xl flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><UserCheck className="w-6 h-6"/></div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Form Input PIC Pengawasan</h2>
                            <p className="text-sm text-slate-500">Tentukan PIC Building Support yang bertanggung jawab di lapangan.</p>
                        </div>
                    </div>

                    <CardContent className="p-6 md:p-8 bg-slate-50/50">
                        {isLoadingInitial ? (
                            <div className="py-20 text-center text-slate-500 flex flex-col items-center">
                                <Loader2 className="w-10 h-10 animate-spin text-red-600 mb-4"/>
                                <p>Mempersiapkan Data Cabang & PIC...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                
                                {/* 1. INFORMASI UTAMA */}
                                <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700">Cabang</label>
                                            <input type="text" readOnly className="w-full p-2.5 bg-slate-100 border rounded-lg text-slate-600 font-bold" value={form.cabang} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700">Kode Ulok *</label>
                                            <select 
                                                required className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-red-500 outline-none font-medium"
                                                value={form.kode_ulok} onChange={(e) => handleUlokChange(e.target.value)}
                                            >
                                                <option value="">-- Pilih Kode Ulok --</option>
                                                {ulokList.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Area Read-Only / Auto-Fill */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                                        <div className="space-y-1 md:col-span-3">
                                            <label className="text-xs font-bold text-slate-500 flex items-center gap-2">Nama Toko {isFetchingDetails && <Loader2 className="w-3 h-3 animate-spin"/>}</label>
                                            <input type="text" readOnly className="w-full p-2.5 bg-slate-100 border rounded-lg text-slate-800 font-semibold" value={form.nama_toko} placeholder="Otomatis terisi..." />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500">Durasi (Lokasi)</label>
                                            <input type="text" readOnly className="w-full p-2.5 bg-slate-100 border rounded-lg text-slate-600" value={form.kategori_lokasi} placeholder="Otomatis terisi..." />
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-xs font-bold text-slate-500">Tanggal Waktu Mulai SPK</label>
                                            <input type="text" readOnly className="w-full p-2.5 bg-slate-100 border rounded-lg text-slate-600" value={form.tanggal_spk} placeholder="Otomatis terisi..." />
                                        </div>
                                    </div>
                                </div>

                                {/* 2. PENGECEKAN LINK DOKUMEN */}
                                <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-700 border-b pb-2 flex items-center gap-2"><LinkIcon className="w-4 h-4"/> Validasi Tautan Dokumen</h3>
                                    
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-slate-700">Tautan File SPK</label>
                                        <input type="text" readOnly className="w-full p-2.5 bg-slate-100 border rounded-lg text-slate-500 text-sm overflow-hidden text-ellipsis whitespace-nowrap" value={form.spk_url} placeholder="Tautan SPK akan muncul di sini..." />
                                        {isFetchingDetails ? <span className="text-xs text-blue-600 animate-pulse">Memeriksa link SPK...</span> : spkStatus.text && (
                                            <span className={`text-xs font-semibold ${spkStatus.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{spkStatus.text}</span>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-slate-700">Tautan File RAB</label>
                                        <input type="text" readOnly className="w-full p-2.5 bg-slate-100 border rounded-lg text-slate-500 text-sm overflow-hidden text-ellipsis whitespace-nowrap" value={form.rab_url} placeholder="Tautan RAB akan muncul di sini..." />
                                        {isFetchingDetails ? <span className="text-xs text-blue-600 animate-pulse">Memeriksa link RAB...</span> : rabStatus.text && (
                                            <span className={`text-xs font-semibold ${rabStatus.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{rabStatus.text}</span>
                                        )}
                                    </div>
                                </div>

                                {/* 3. PEMILIHAN PIC */}
                                <div className="space-y-2 bg-blue-50 p-5 rounded-xl border border-blue-200 shadow-sm">
                                    <label className="text-sm font-bold text-blue-900">PIC Building Support (Pengawas Lapangan) *</label>
                                    <select 
                                        required className="w-full p-3 border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                                        value={form.pic_building_support} onChange={(e) => setForm({...form, pic_building_support: e.target.value})}
                                    >
                                        <option value="">-- Pilih Nama PIC --</option>
                                        {picList.map((pic, idx) => (
                                            <option key={idx} value={JSON.stringify({ email: pic.email, nama: pic.nama, jabatan: pic.jabatan })}>
                                                {pic.nama.toUpperCase()}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* TOMBOL SUBMIT */}
                                <div className="pt-4 pb-2">
                                    <Button type="submit" disabled={isSubmitting || !form.kode_ulok || isFetchingDetails} className="w-full h-14 bg-red-600 hover:bg-red-700 text-lg font-bold shadow-lg transition-all">
                                        {isSubmitting ? <><Loader2 className="w-6 h-6 mr-2 animate-spin"/> Menyimpan Data PIC...</> : <><Save className="w-6 h-6 mr-2"/> Simpan Penugasan Pengawasan</>}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </main>

            {/* MODAL SUCCESS OVERLAY */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center transform scale-100 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Berhasil!</h2>
                        <p className="text-slate-600 mb-8 leading-relaxed">
                            Data PIC Pengawasan untuk Ulok <b>{form.kode_ulok}</b> berhasil disimpan dan ditugaskan.
                        </p>
                        <Button 
                            onClick={() => router.push('/dashboard')} 
                            className="w-full h-12 bg-slate-800 hover:bg-slate-900 text-white font-bold text-lg rounded-xl"
                        >
                            Kembali ke Dashboard
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}