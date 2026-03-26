"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Search, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';

import { fetchApprovedRabs, fetchKontraktorList, checkSpkStatus, submitSPKData } from '@/lib/api';

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

export default function SPKPage() {
    const router = useRouter();

    const [userInfo, setUserInfo] = useState({ name: '', role: '', cabang: '', email: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // State untuk memunculkan Modal Sukses
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    
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
        nama_toko: '', // Statis
        kode_toko: '', // Input manual
        
        // SPK Penomoran
        spk_bulan: '', spk_tahun: new Date().getFullYear().toString().slice(-2),
        
        // PAR Penomoran
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
            alert("Hanya PIC yang dapat membuat SPK."); router.push('/dashboard'); return;
        }

        const name = email.split('@')[0].toUpperCase();
        setUserInfo({ name, role, cabang, email });
        setForm(prev => ({ ...prev, kode_cabang: getCabangCode(cabang) }));

        loadApprovedRabs(cabang);
    }, [router]);

    const loadApprovedRabs = async (cabang: string) => {
        setIsLoading(true);
        try {
            const data = await fetchApprovedRabs(cabang);
            setApprovedRabs(data || []);
        } catch (error: any) {
            alert("Gagal memuat data RAB: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUlokSelect = async (ulokStr: string) => {
        setSpkMsg({ text: '', type: '' });
        setIsLocked(false);
        setRevisiData({ isRevisi: false, sequence: '', rowIndex: null });

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
                const kList = await fetchKontraktorList(selected.Cabang);
                setKontraktorList(kList || []);
            } catch (e) { setKontraktorList([]); }

            // Check Status SPK (Cek Revisi)
            if (selectedUlok && selectedLingkup) {
                const spkStatus = await checkSpkStatus(selectedUlok, selectedLingkup);
                if (spkStatus && spkStatus.Status) {
                    const status = spkStatus.Status;
                    if (status === "SPK Ditolak") {
                        setSpkMsg({ text: "SPK sebelumnya DITOLAK. Data lama telah dimuat untuk revisi.", type: "error" });
                        
                        const dataReject = spkStatus.Data || {};
                        let sequenceLama = ''; let bLama = ''; let tLama = '';
                        
                        const spkFull = dataReject["Nomor SPK"] || "";
                        const spkParts = spkFull.split("/");
                        if(spkParts.length >= 4) { sequenceLama = spkParts[0]; bLama = spkParts[2]; tLama = spkParts[3]; }

                        let pNo = ''; let pB = ''; let pT = '';
                        const parFull = dataReject["PAR"] || "";
                        const parPartsSlash = parFull.split("/");
                        if(parPartsSlash.length >= 2) {
                            pNo = parPartsSlash[0];
                            const sParts = parPartsSlash[1].split("-");
                            if(sParts.length >= 4) { pB = sParts[sParts.length - 2]; pT = sParts[sParts.length - 1]; }
                        }

                        setRevisiData({ isRevisi: true, sequence: sequenceLama, rowIndex: spkStatus.RowIndex });
                        setForm(prev => ({
                            ...prev,
                            waktu_mulai: dataReject["Waktu Mulai"] ? dataReject["Waktu Mulai"].split("T")[0] : '',
                            durasi: dataReject["Durasi"] || '',
                            nama_kontraktor: dataReject["Nama Kontraktor"] || dataReject["Nama_Kontraktor"] || '',
                            nama_toko: dataReject["Nama Toko"] || dataReject["Nama_Toko"] || prev.nama_toko,
                            kode_toko: dataReject["Kode Toko"] || dataReject["Kode_Toko"] || prev.kode_toko,
                            spk_bulan: bLama, spk_tahun: tLama || new Date().getFullYear().toString().slice(-2),
                            par_no: pNo, par_bulan: pB, par_tahun: pT || new Date().getFullYear().toString()
                        }));

                    } else if (status === "Menunggu Persetujuan Branch Manager") {
                        setSpkMsg({ text: "SPK sedang dalam proses persetujuan. Tidak bisa disubmit ulang.", type: "warning" });
                        setIsLocked(true);
                    } else if (status === "SPK Disetujui") {
                        setSpkMsg({ text: "SPK sudah disetujui!", type: "success" });
                        setIsLocked(true);
                    }
                } else {
                    setSpkMsg({ text: "Silakan lengkapi form untuk pengajuan SPK baru.", type: "info" });
                }
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRabObj) return;

        let finalNomorSPK = `(Otomatis)/PROPNDEV-${form.kode_cabang}/${form.spk_bulan}/${form.spk_tahun}`;
        if (revisiData.isRevisi && revisiData.sequence) {
            finalNomorSPK = `${revisiData.sequence}/PROPNDEV-${form.kode_cabang}/${form.spk_bulan}/${form.spk_tahun}`;
        }
        
        const fullPAR = `${form.par_no}/PROPNDEV-${form.kode_cabang}-${form.par_bulan}-${form.par_tahun}`;

        const payload: any = {
            "Nama_Toko": form.nama_toko || "N/A",
            "Tanggal_RAB": selectedRabObj["Timestamp"] ? selectedRabObj["Timestamp"].split('T')[0] : '',
            "PIC": userInfo.name,
            "Nomor Ulok": selectedRabObj["Nomor Ulok"],
            "Cabang": selectedRabObj.Cabang,
            "Kode_Toko": form.kode_toko || "N/A",
            "Lingkup_Pekerjaan": selectedRabObj["Lingkup_Pekerjaan"],
            "Proyek": selectedRabObj["Proyek"] || "N/A",
            "Alamat": selectedRabObj["Alamat"] || "N/A",
            "Grand Total": selectedRabObj["Grand Total Final"] || 0,
            "Nama Kontraktor": form.nama_kontraktor,
            "Nomor SPK": finalNomorSPK,
            "PAR": fullPAR,
            "Waktu Mulai": form.waktu_mulai,
            "Durasi": form.durasi,
            "Email_Pembuat": userInfo.email,
            "Dibuat Oleh": userInfo.email
        };

        if (revisiData.isRevisi) {
            payload["Revisi"] = "YES";
            payload["RowIndex"] = revisiData.rowIndex;
        }

        setIsSubmitting(true);
        try {
            await submitSPKData(payload);
            // Munculkan Modal Sukses
            setShowSuccessModal(true);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredRabs = approvedRabs.filter(r => 
        (r["Nomor Ulok"] || "").toLowerCase().includes(searchUlok.toLowerCase()) || 
        (r["Nama_Toko"] || "").toLowerCase().includes(searchUlok.toLowerCase())
    );

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
                                <h3 className="font-bold text-slate-700 border-b pb-2 mb-4">1. Data Referensi RAB & Identitas Toko</h3>
                                
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Cari & Pilih Nomor Ulok *</label>
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

                                {spkMsg.text && (
                                    <div className={`p-4 rounded-lg flex items-start gap-3 mt-4 font-medium text-sm ${spkMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : (spkMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-blue-50 text-blue-700 border border-blue-200')}`}>
                                        <AlertCircle className="w-5 h-5 shrink-0" /> <p>{spkMsg.text}</p>
                                    </div>
                                )}

                                {selectedRabObj && (
                                    <div className="pt-4 border-t mt-4 border-slate-100">
                                        <div className="mb-4 space-y-2 md:w-1/2">
                                            <label className="text-sm font-bold text-slate-700">Kode Toko *</label>
                                            <input type="text" required className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500" value={form.kode_toko} onChange={e => setForm({...form, kode_toko: e.target.value})} placeholder="Masukkan Kode Toko (Misal: T123)..." />
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
                                <h3 className="font-bold text-slate-700 border-b pb-2">2. Data Kontraktor & Dokumen</h3>

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
                                        <select required className="w-full p-2.5 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium" value={form.durasi} onChange={e => setForm({...form, durasi: e.target.value})}>
                                            <option value="">-- Pilih Durasi --</option>
                                            <option value="10">10 Hari Kalender</option><option value="14">14 Hari Kalender</option>
                                            <option value="20">20 Hari Kalender</option><option value="30">30 Hari Kalender</option>
                                            <option value="35">35 Hari Kalender</option><option value="40">40 Hari Kalender</option>
                                            <option value="48">48 Hari Kalender</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* TOMBOL SUBMIT */}
                            <div className="pt-4 pb-4">
                                <Button type="submit" disabled={isSubmitting || !form.nomor_ulok || isLocked} className="w-full h-14 bg-red-600 hover:bg-red-700 text-lg font-bold shadow-lg transition-all">
                                    {isSubmitting ? <><Loader2 className="w-6 h-6 mr-2 animate-spin"/> Menyimpan Data...</> : <><Save className="w-6 h-6 mr-2"/> {revisiData.isRevisi ? 'Kirim Revisi SPK' : 'Kirim SPK Baru'}</>}
                                </Button>
                            </div>
                        </form>
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