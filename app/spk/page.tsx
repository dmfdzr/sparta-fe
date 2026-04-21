"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Search, FileText, AlertCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';
import { useGlobalAlert } from '@/context/GlobalAlertContext';
import { fetchKontraktorList, fetchSPKList, submitSPK, fetchRABList } from '@/lib/api';

const getCabangCode = (cabangName: string) => {
    const map: Record<string, string> = {
        "WHC IMAM BONJOL": "7AZ1", "LUWU": "2VZ1", "KARAWANG": "1JZ1", "REMBANG": "2AZ1",
        "BANJARMASIN": "1GZ1", "PARUNG": "1MZ1", "TEGAL": "2PZ1", "GORONTALO": "2SZ1",
        "PONTIANAK": "1PZ1", "LOMBOK": "1SZ1", "KOTABUMI": "1VZ1", "SERANG": "2GZ1",
        "CIANJUR": "2JZ1", "BALARAJA": "TZ01", "SIDOARJO": "UZ01", "MEDAN": "WZ01",
        "BOGOR": "XZ01", "JEMBER": "YZ01", "BALI": "QZ01", "PALEMBANG": "PZ01",
        "KLATEN": "OZ01", "MAKASSAR": "RZ01", "PLUMBON": "VZ01", "PEKANBARU": "1AZ1",
        "JAMBI": "1DZ1", "HEAD OFFICE": "Z001", "BANDUNG 1": "BZ01", "BANDUNG 2": "NZ01",
        "BEKASI": "CZ01", "CILACAP": "IZ01", "CILEUNGSI": "JZ01", "SEMARANG": "HZ01",
        "CIKOKOL": "KZ01", "LAMPUNG": "LZ01", "MALANG": "MZ01", "MANADO": "1YZ1",
        "BATAM": "2DZ1", "MADIUN": "2MZ1",
    };
    return map[cabangName.toUpperCase()] || cabangName.substring(0, 3).toUpperCase();
};

const formatRupiah = (number: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(number);

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Tipe untuk data form yang dibandingkan saat revisi
type RevisiFormSnapshot = {
    kode_toko: string;
    nama_kontraktor: string;
    waktu_mulai: string;
    durasi: string;
    spk_bulan: string;
    spk_tahun: string;
    par_no: string;
    par_bulan: string;
    par_tahun: string;
};

export default function SPKPage() {
    const router = useRouter();
    const { showAlert } = useGlobalAlert();

    const [userInfo, setUserInfo] = useState({ name: '', role: '', cabang: '', email: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Modal Sukses
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Modal Notifikasi SPK Ditolak
    const [rejectedModal, setRejectedModal] = useState<{
        isOpen: boolean;
        alasanPenolakan: string;
        namaKontraktor: string;
    }>({ isOpen: false, alasanPenolakan: '', namaKontraktor: '' });

    // Snapshot form dari SPK yang ditolak (untuk deteksi perubahan)
    const [originalRejectedForm, setOriginalRejectedForm] = useState<RevisiFormSnapshot | null>(null);
    
    // Data API
    const [approvedRabs, setApprovedRabs] = useState<any[]>([]);
    const [kontraktorList, setKontraktorList] = useState<string[]>([]);
    const [searchUlok, setSearchUlok] = useState('');
    
    // Status Info
    const [spkMsg, setSpkMsg] = useState({ text: '', type: '' });
    const [isLocked, setIsLocked] = useState(false);

    // State Form & Revisi
    const [selectedRabObj, setSelectedRabObj] = useState<any>(null);
    const [revisiData, setRevisiData] = useState({ isRevisi: false, sequence: '', rowIndex: null });

    const [form, setForm] = useState({
        nomor_ulok: '',
        kode_cabang: '',
        nama_kontraktor: '',
        waktu_mulai: '',
        durasi: '',
        nama_toko: '',
        kode_toko: '',
        spk_bulan: '', spk_tahun: new Date().getFullYear().toString().slice(-2),
        par_no: '', par_bulan: '', par_tahun: new Date().getFullYear().toString()
    });

    useEffect(() => {
        const isAuth = sessionStorage.getItem("authenticated");
        const role = sessionStorage.getItem("userRole");
        const email = sessionStorage.getItem("loggedInUserEmail") || '';
        const cabang = sessionStorage.getItem("loggedInUserCabang") || '';

        if (isAuth !== "true" || !role) { router.push('/auth'); return; }

        const picRoles = ['BRANCH BUILDING & MAINTENANCE MANAGER', 'BRANCH BUILDING COORDINATOR', 'BRANCH BUILDING SUPPORT'];
        if (!picRoles.includes(role.toUpperCase())) {
            showAlert({ message: "Hanya PIC yang dapat membuat SPK.", type: "warning", onConfirm: () => router.push('/dashboard') });
            return;
        }

        const name = email.split('@')[0].toUpperCase();
        setUserInfo({ name, role, cabang, email });
        setForm(prev => ({ ...prev, kode_cabang: getCabangCode(cabang) }));

        loadApprovedRabs(cabang);
    }, [router]);

    const loadApprovedRabs = async (cabang: string) => {
        setIsLoading(true);
        try {
            const res = await fetchRABList({ status: "Disetujui" });
            const listRab = res.data || [];
            
            const filteredRabs = listRab.filter((r: any) => r.cabang?.toUpperCase() === cabang.toUpperCase());
            
            const mappedData = filteredRabs.map((r: any) => ({
                "id_toko": r.id_toko || r.toko?.id,
                "Nomor Ulok": r.nomor_ulok,
                "Lingkup_Pekerjaan": r.lingkup_pekerjaan || "-",
                "Cabang": r.cabang,
                "Nama_Toko": r.toko?.nama_toko || r.nama_toko,
                "Kode_Toko": r.toko?.kode_toko || "-", 
                "Proyek": r.proyek || "-",
                "Alamat": r.toko?.alamat || "-",
                "Grand Total Final": r.grand_total_final || r.grand_total || 0,
            }));
            
            setApprovedRabs(mappedData);
        } catch (error: any) {
            showAlert({ message: "Gagal memuat data RAB: " + error.message, type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUlokSelect = async (ulokStr: string) => {
        setSpkMsg({ text: '', type: '' });
        setIsLocked(false);
        setRevisiData({ isRevisi: false, sequence: '', rowIndex: null });
        setOriginalRejectedForm(null);

        if (!ulokStr) {
            setSelectedRabObj(null); 
            setForm(prev => ({ 
                ...prev, nomor_ulok: '', nama_kontraktor: '', waktu_mulai: '', durasi: '', 
                spk_bulan: '', par_no: '', par_bulan: '', nama_toko: '', kode_toko: '' 
            })); 
            return;
        }

        const selectedUlok = ulokStr.split(" (")[0];
        const selectedLingkup = ulokStr.includes("(") ? ulokStr.split("(")[1].replace(")", "") : null;
        
        const selected = approvedRabs.find(r => r["Nomor Ulok"] === selectedUlok && r["Lingkup_Pekerjaan"] === selectedLingkup);
        
        if (selected) {
            setSelectedRabObj(selected);
            setForm(prev => ({ 
                ...prev, 
                nomor_ulok: ulokStr, 
                kode_cabang: getCabangCode(selected.Cabang),
                nama_toko: selected["Nama_Toko"] || selected["nama_toko"] || '',
                kode_toko: selected["Kode_Toko"] || selected["kode_toko"] || ''
            }));
            
            setSpkMsg({ text: "Memuat Kontraktor dan Status SPK...", type: "info" });
            
            // Fetch Kontraktor
            try {
                const names = await fetchKontraktorList(selected.Cabang);
                setKontraktorList(names || []);
            } catch (e) {
                setKontraktorList([]); 
            }

            // Check Status SPK
            if (selectedUlok && selectedLingkup) {
                try {
                    const spkRes = await fetchSPKList({ nomor_ulok: selectedUlok });
                    const existingSpks = spkRes.data.filter(s => s.lingkup_pekerjaan === selectedLingkup);
                    
                    if (existingSpks.length > 0) {
                        const latestSpk = existingSpks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                        const status = latestSpk.status;
                        
                        if (status === "SPK_REJECTED") {
                            // Parse nomor PAR lama
                            let pNo = '', pB = '', pT = '';
                            if (latestSpk.par) {
                                const parPartsSlash = latestSpk.par.split("/");
                                if (parPartsSlash.length >= 2) {
                                    pNo = parPartsSlash[0];
                                    const sParts = parPartsSlash[1].split("-");
                                    if (sParts.length >= 3) {
                                        pB = sParts[sParts.length - 2];
                                        pT = sParts[sParts.length - 1];
                                    }
                                }
                            }

                            const autofilledForm: RevisiFormSnapshot = {
                                kode_toko: latestSpk.toko?.kode_toko || selected["Kode_Toko"] || selected["kode_toko"] || '',
                                nama_kontraktor: latestSpk.nama_kontraktor || '',
                                waktu_mulai: latestSpk.waktu_mulai ? latestSpk.waktu_mulai.split("T")[0] : '',
                                durasi: latestSpk.durasi?.toString() || '',
                                spk_bulan: latestSpk.spk_manual_1 || '',
                                spk_tahun: latestSpk.spk_manual_2 || new Date().getFullYear().toString().slice(-2),
                                par_no: pNo,
                                par_bulan: pB,
                                par_tahun: pT || new Date().getFullYear().toString(),
                            };

                            // Simpan snapshot untuk deteksi perubahan
                            setOriginalRejectedForm(autofilledForm);

                            // Autofill form
                            setRevisiData({ isRevisi: true, sequence: latestSpk.nomor_spk?.split('/')[0] || '', rowIndex: null });
                            setForm(prev => ({ ...prev, ...autofilledForm }));

                            // Tampilkan pesan inline minimal
                            setSpkMsg({ text: "Data SPK yang ditolak telah dimuat. Ubah minimal 1 field lalu kirim ulang.", type: "warning" });

                            // Tampilkan popup modal notifikasi penolakan
                            setRejectedModal({
                                isOpen: true,
                                alasanPenolakan: latestSpk.alasan_penolakan || 'Tidak ada alasan yang diberikan.',
                                namaKontraktor: latestSpk.nama_kontraktor || '-',
                            });

                        } else if (status === "WAITING_FOR_BM_APPROVAL") {
                            setSpkMsg({ text: "SPK sedang dalam proses persetujuan (Menunggu Branch Manager). Tidak bisa disubmit ulang.", type: "warning" });
                            setIsLocked(true);
                        } else if (status === "SPK_APPROVED") {
                            setSpkMsg({ text: "SPK sudah disetujui!", type: "success" });
                            setIsLocked(true);
                        }
                    } else {
                        setSpkMsg({ text: "Silakan lengkapi form untuk pengajuan SPK baru.", type: "info" });
                    }
                } catch (error) {
                    setSpkMsg({ text: "Gagal mengecek status SPK.", type: "error" });
                }
            }
        }
    };

    // Cek apakah minimal 1 field berubah dari snapshot SPK yang ditolak
    const hasFormChangedFromOriginal = (): boolean => {
        if (!originalRejectedForm) return true; // Bukan revisi, selalu boleh submit
        const current: RevisiFormSnapshot = {
            kode_toko: form.kode_toko,
            nama_kontraktor: form.nama_kontraktor,
            waktu_mulai: form.waktu_mulai,
            durasi: form.durasi,
            spk_bulan: form.spk_bulan,
            spk_tahun: form.spk_tahun,
            par_no: form.par_no,
            par_bulan: form.par_bulan,
            par_tahun: form.par_tahun,
        };
        return (Object.keys(current) as (keyof RevisiFormSnapshot)[]).some(
            key => current[key] !== originalRejectedForm[key]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRabObj) return;

        // Validasi perubahan untuk SPK_REJECTED
        if (revisiData.isRevisi && !hasFormChangedFromOriginal()) {
            showAlert({ message: "Harap ubah minimal 1 field sebelum mengirim revisi SPK. Data tidak boleh sama persis dengan SPK yang ditolak.", type: "warning" });
            return;
        }

        const fullPAR = `${form.par_no}/PROPNDEV-${form.kode_cabang}-${form.par_bulan}-${form.par_tahun}`;

        const payload = {
            id_toko: parseInt(selectedRabObj["id_toko"], 10),
            nomor_ulok: selectedRabObj["Nomor Ulok"],
            email_pembuat: userInfo.email,
            lingkup_pekerjaan: selectedRabObj["Lingkup_Pekerjaan"],
            nama_kontraktor: form.nama_kontraktor,
            proyek: selectedRabObj["Proyek"] || "N/A",
            kode_toko: form.kode_toko,
            waktu_mulai: form.waktu_mulai,
            durasi: parseInt(form.durasi),
            grand_total: parseFloat(selectedRabObj["Grand Total Final"]) || 0,
            par: fullPAR,
            spk_manual_1: form.spk_bulan,
            spk_manual_2: form.spk_tahun
        };

        setIsSubmitting(true);
        try {
            await submitSPK(payload);
            setShowSuccessModal(true);
        } catch (err: any) {
            showAlert({ message: err.message || "Gagal menyimpan SPK.", type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredRabs = approvedRabs.filter(r => 
        (r["Nomor Ulok"] || "").toLowerCase().includes(searchUlok.toLowerCase()) || 
        (r["Nama_Toko"] || "").toLowerCase().includes(searchUlok.toLowerCase())
    );

    // Cek apakah ada perubahan (untuk disable tombol submit revisi)
    const isRevisiUnchanged = revisiData.isRevisi && !hasFormChangedFromOriginal();

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12 relative">
            <AppNavbar
                title="SURAT PERINTAH KERJA"
                showBackButton
                backHref="/dashboard"
            />

            <main className="max-w-5xl mx-auto p-4 md:p-8 mt-4">
                <Card className="shadow-sm border-slate-200 relative z-10">
                    <div className="p-6 border-b border-slate-100 bg-white rounded-t-xl flex items-center gap-3">
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg"><FileText className="w-6 h-6"/></div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Surat Perintah Kerja (SPK)</h2>
                            <p className="text-sm text-slate-500">Pilih Nomor Ulok dari RAB yang telah disetujui.</p>
                        </div>
                    </div>

                    <CardContent className="p-6 md:p-8 bg-slate-50/50">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            
                            {/* SECTION 1: PEMILIHAN ULOK & IDENTITAS TOKO */}
                            <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-700 border-b pb-2 mb-4">1. Data Referensi RAB &amp; Identitas Toko</h3>
                                
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Cari &amp; Pilih Nomor Ulok *</label>
                                    <div className="relative mb-2">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input type="text" placeholder="Ketik No Ulok / Nama Toko..." className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm" value={searchUlok} onChange={(e) => setSearchUlok(e.target.value)} />
                                    </div>
                                    {isLoading ? (
                                        <div className="p-3 text-center text-slate-500 bg-slate-100 rounded-lg text-sm"><Loader2 className="w-4 h-4 animate-spin inline mr-2"/> Memuat data RAB...</div>
                                    ) : (
                                        <select required className="w-full p-3 border rounded-lg bg-slate-50 outline-none font-semibold text-slate-700 cursor-pointer focus:bg-white focus:ring-2 focus:ring-red-500" value={form.nomor_ulok} onChange={(e) => handleUlokSelect(e.target.value)}>
                                            <option value="">-- Klik untuk Pilih Ulok --</option>
                                            {filteredRabs.map((r, i) => <option key={i} value={`${r["Nomor Ulok"]} (${r["Lingkup_Pekerjaan"]})`}>{r["Nomor Ulok"]} ({r["Lingkup_Pekerjaan"]}) - {r["Proyek"]} - {r["Nama_Toko"]}</option>)}
                                        </select>
                                    )}
                                </div>

                                {/* Pesan Status SPK */}
                                {spkMsg.text && (
                                    <div className={`p-4 rounded-lg flex items-start gap-3 mt-4 font-medium text-sm ${
                                        spkMsg.type === 'error'   ? 'bg-red-50 text-red-700 border border-red-200' :
                                        spkMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                                        spkMsg.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                        'bg-blue-50 text-blue-700 border border-blue-200'
                                    }`}>
                                        <AlertCircle className="w-5 h-5 shrink-0" /> <p>{spkMsg.text}</p>
                                    </div>
                                )}

                                {/* Banner perubahan wajib saat revisi */}
                                {revisiData.isRevisi && (
                                    <div className={`p-3 rounded-lg flex items-center gap-2 text-xs font-semibold border ${
                                        isRevisiUnchanged
                                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                                            : 'bg-green-50 text-green-700 border-green-200'
                                    }`}>
                                        {isRevisiUnchanged
                                            ? <><AlertTriangle className="w-4 h-4 shrink-0"/> Belum ada perubahan dari data SPK yang ditolak. Ubah minimal 1 field untuk mengaktifkan tombol kirim.</>
                                            : <><CheckCircle className="w-4 h-4 shrink-0"/> Perubahan terdeteksi. Anda bisa mengirim revisi SPK.</>
                                        }
                                    </div>
                                )}

                                {selectedRabObj && (
                                    <div className="pt-4 border-t mt-4 border-slate-100">
                                        <div className="mb-4 space-y-2 md:w-1/2">
                                            <label className="text-sm font-bold text-slate-700">Kode Toko *</label>
                                            <input type="text" required className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 uppercase" value={form.kode_toko} onChange={e => setForm({...form, kode_toko: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()})} placeholder="Masukkan Kode Toko (Misal: T123)..." />
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg">
                                            <div><p className="text-[11px] font-bold text-slate-500 uppercase">Nama Toko</p><p className="font-semibold text-slate-800">{form.nama_toko || '-'}</p></div>
                                            <div><p className="text-[11px] font-bold text-slate-500 uppercase">Proyek</p><p className="font-semibold text-slate-800">{selectedRabObj.Proyek}</p></div>
                                            <div><p className="text-[11px] font-bold text-slate-500 uppercase">Lingkup</p><p className="font-semibold text-slate-800">{selectedRabObj.Lingkup_Pekerjaan}</p></div>
                                            <div><p className="text-[11px] font-bold text-slate-500 uppercase">Grand Total Final</p><p className="font-bold text-red-600">{formatRupiah(selectedRabObj["Grand Total Final"])}</p></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SECTION 2: PENOMORAN DOKUMEN & KONTRAKTOR */}
                            <div className={`space-y-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                                <h3 className="font-bold text-slate-700 border-b pb-2">2. Data Kontraktor &amp; Dokumen</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Nama Kontraktor *</label>
                                        <select required className="w-full p-2.5 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500" value={form.nama_kontraktor} onChange={e => setForm({...form, nama_kontraktor: e.target.value})}>
                                            <option value="">-- Pilih Kontraktor --</option>
                                            {kontraktorList.map(k => <option key={k} value={k}>{k}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Kode Cabang Penomoran</label>
                                        <input type="text" required readOnly className="w-full p-2.5 border bg-slate-100 rounded-lg text-slate-600 font-bold uppercase" value={form.kode_cabang} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Nomor SPK *</label>
                                        <div className="flex items-center gap-2 bg-slate-50 p-2 border border-slate-300 rounded-lg overflow-x-auto text-sm">
                                            <span className="font-bold text-slate-500 whitespace-nowrap bg-slate-200 px-2 py-1.5 rounded">{revisiData.isRevisi ? revisiData.sequence : '(Otomatis)'}</span>
                                            <span className="font-bold text-slate-400">/</span>
                                            <span className="font-bold text-slate-600 whitespace-nowrap">PROPNDEV-{form.kode_cabang || '...'}</span>
                                            <span className="font-bold text-slate-400">/</span>
                                            <input type="text" required placeholder="Bulan (X)" className="w-16 p-1.5 text-center border rounded font-bold outline-none uppercase" value={form.spk_bulan} onChange={e => setForm({...form, spk_bulan: e.target.value.toUpperCase()})} />
                                            <span className="font-bold text-slate-400">/</span>
                                            <input type="text" required placeholder="Thn (25)" maxLength={2} className="w-14 p-1.5 text-center border rounded font-bold outline-none" value={form.spk_tahun} onChange={e => setForm({...form, spk_tahun: e.target.value})} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Nomor PAR *</label>
                                        <div className="flex items-center gap-2 bg-slate-50 p-2 border border-slate-300 rounded-lg overflow-x-auto text-sm">
                                            <input type="text" required placeholder="No" className="w-16 p-1.5 text-center border rounded font-bold outline-none uppercase" value={form.par_no} onChange={e => setForm({...form, par_no: e.target.value.toUpperCase()})} />
                                            <span className="font-bold text-slate-400">/</span>
                                            <span className="font-bold text-slate-600 whitespace-nowrap">PROPNDEV-{form.kode_cabang || '...'}</span>
                                            <span className="font-bold text-slate-400">-</span>
                                            <input type="text" required placeholder="Bulan (X)" className="w-16 p-1.5 text-center border rounded font-bold outline-none uppercase" value={form.par_bulan} onChange={e => setForm({...form, par_bulan: e.target.value.toUpperCase()})} />
                                            <span className="font-bold text-slate-400">-</span>
                                            <input type="text" required placeholder="Thn" maxLength={4} className="w-16 p-1.5 text-center border rounded font-bold outline-none" value={form.par_tahun} onChange={e => setForm({...form, par_tahun: e.target.value})} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: JADWAL */}
                            <div className={`space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                                <h3 className="font-bold text-slate-700 border-b pb-2 mb-4">3. Jadwal Pelaksanaan</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Tgl Mulai Pelaksanaan *</label>
                                        <input 
                                            type="date" 
                                            required 
                                            min={getTodayDateString()} 
                                            className="w-full p-2.5 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500" 
                                            value={form.waktu_mulai} 
                                            onChange={e => setForm({...form, waktu_mulai: e.target.value})} 
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Tanggal sebelum hari ini tidak bisa dipilih.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Durasi (Hari) *</label>
                                        <input
                                            type="number"
                                            required
                                            min={1}
                                            max={365}
                                            placeholder="Masukkan jumlah hari..."
                                            className="w-full p-2.5 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                            value={form.durasi}
                                            onChange={e => setForm({...form, durasi: e.target.value})}
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Masukkan jumlah hari kalender pelaksanaan.</p>
                                    </div>
                                </div>
                            </div>

                            {/* TOMBOL SUBMIT */}
                            <div className="pt-4 pb-4">
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || !form.nomor_ulok || isLocked || isRevisiUnchanged}
                                    className={`w-full h-14 text-lg font-bold shadow-lg transition-all ${
                                        isRevisiUnchanged
                                            ? 'bg-slate-400 cursor-not-allowed'
                                            : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                >
                                    {isSubmitting
                                        ? <><Loader2 className="w-6 h-6 mr-2 animate-spin"/> Menyimpan Data...</>
                                        : <><Save className="w-6 h-6 mr-2"/> {revisiData.isRevisi ? 'Kirim Revisi SPK' : 'Kirim SPK Baru'}</>
                                    }
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </main>

            {/* ========================================================
                MODAL: NOTIFIKASI SPK DITOLAK
            ======================================================== */}
            {rejectedModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-in zoom-in-95 duration-300">
                        {/* Icon */}
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                            <XCircle className="w-12 h-12 text-red-600" />
                        </div>

                        {/* Judul */}
                        <h2 className="text-2xl font-bold text-slate-800 mb-1">SPK Ditolak</h2>
                        <p className="text-sm text-slate-500 mb-5">
                            Pengajuan SPK untuk ULOK ini sebelumnya ditolak oleh Branch Manager.
                        </p>

                        {/* Alasan Penolakan */}
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
                            <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Alasan Penolakan</p>
                            <p className="text-sm font-semibold text-red-800 leading-relaxed">
                                &ldquo;{rejectedModal.alasanPenolakan}&rdquo;
                            </p>
                        </div>

                        {/* Info */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-start gap-2 text-left">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 font-medium leading-relaxed">
                                Data SPK lama telah dimuat secara otomatis. Anda <strong>wajib mengubah minimal 1 field</strong> sebelum bisa mengirim revisi.
                            </p>
                        </div>

                        {/* Tombol */}
                        <Button
                            onClick={() => setRejectedModal(prev => ({ ...prev, isOpen: false }))}
                            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold text-base rounded-xl"
                        >
                            Tutup &amp; Mulai Revisi
                        </Button>
                    </div>
                </div>
            )}

            {/* ========================================================
                MODAL: SUKSES SUBMIT SPK
            ======================================================== */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center transform scale-100 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Berhasil!</h2>
                        <p className="text-slate-600 mb-8 leading-relaxed">
                            Surat Perintah Kerja (SPK) untuk toko <b>{form.nama_toko}</b> berhasil disimpan dan dikirim untuk proses approval.
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