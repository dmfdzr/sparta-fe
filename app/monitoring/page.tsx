"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    ChevronLeft, Loader2, X, ArrowLeft, Search, Filter, 
    FolderKanban, Wallet, CalendarClock, ClockAlert, Calculator, TrendingUp, Building2, MapPin
} from 'lucide-react';

import { fetchMonitoringData } from '@/lib/api';

// ==========================================
// HELPER FUNCTIONS 
// ==========================================
const formatRupiah = (num: number) => "Rp " + new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(num || 0);

const formatScore = (num: number) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num || 0);

const parseCurrency = (value: any) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        if (value.includes('#REF!') || value.includes('Error')) return 0;
        const cleanStr = value.replace(/\./g, '').replace(/,/g, '.');
        const floatVal = parseFloat(cleanStr);
        return isNaN(floatVal) ? 0 : floatVal;
    }
    return 0;
};

const parseScore = (value: any) => {
    if (value === null || value === undefined || value === '') return 0;
    let num = 0;
    if (typeof value === 'number') {
        num = value;
    } else if (typeof value === 'string') {
        if (value.includes('#REF!') || value.includes('Error')) return 0;
        let cleanStr = value.replace(/,/g, '.');
        num = parseFloat(cleanStr);
    }
    if (isNaN(num)) return 0;
    if (num > 100) num = num / 100;
    return num;
};

const getYearFromDate = (dateStr: string) => {
    if (!dateStr) return null;
    const match = dateStr.match(/\d{4}/);
    return match ? match[0] : null;
};

// ==========================================
// KOMPONEN ANIMASI ANGKA (COUNT UP)
// ==========================================
const AnimatedNumber = ({ value, duration = 1500, formatter = (v: number) => v.toString(), isFloat = false }: { value: number, duration?: number, formatter?: (val: number) => React.ReactNode, isFloat?: boolean }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let startTimestamp: number | null = null;
        let animationFrame: number;

        // Fungsi easing untuk membuat animasi melambat di akhir
        const easeOutExpo = (x: number) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x));

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easedProgress = easeOutExpo(progress);
            
            let currentVal = easedProgress * value;
            if (!isFloat) currentVal = Math.floor(currentVal);

            setDisplayValue(currentVal);

            if (progress < 1) {
                animationFrame = requestAnimationFrame(step);
            } else {
                setDisplayValue(value);
            }
        };

        animationFrame = requestAnimationFrame(step);

        return () => cancelAnimationFrame(animationFrame);
    }, [value, duration, isFloat]);

    return <>{formatter(displayValue)}</>;
};


export default function MonitoringPage() {
    const router = useRouter();

    const [userInfo, setUserInfo] = useState({ name: '', role: '', cabang: '', email: '' });
    const [isLoading, setIsLoading] = useState(true);
    
    const [rawData, setRawData] = useState<any[]>([]);
    
    // Filter State (Input & Applied)
    const [inputCabang, setInputCabang] = useState('ALL');
    const [inputTahun, setInputTahun] = useState('ALL');
    const [appliedFilters, setAppliedFilters] = useState({ cabang: 'ALL', tahun: 'ALL' });

    // Modal State
    const [modal, setModal] = useState<{
        isOpen: boolean;
        title: string;
        context: 'PROJECT' | 'SPK' | 'JHK' | 'COST_M2' | 'KETERLAMBATAN' | 'NILAI_TOKO' | '';
        view: 'summary' | 'list' | 'detail';
        dataList: any[];
        selectedItem: any | null;
        groupedProjects?: Record<string, any[]>;
    }>({ 
        isOpen: false, title: '', context: '', view: 'list', 
        dataList: [], selectedItem: null, groupedProjects: {} 
    });

    useEffect(() => {
        const isAuth = sessionStorage.getItem("authenticated");
        const role = sessionStorage.getItem("userRole");
        const email = sessionStorage.getItem("loggedInUserEmail") || '';
        const cabang = sessionStorage.getItem("loggedInUserCabang") || '';

        if (isAuth !== "true" || !role) { router.push('/auth'); return; }

        setUserInfo({ name: email.split('@')[0].toUpperCase(), role, cabang, email });
        
        if (cabang.toUpperCase() !== 'HEAD OFFICE') {
            setInputCabang(cabang);
            setAppliedFilters({ cabang, tahun: 'ALL' });
        }

        loadData();
    }, [router]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await fetchMonitoringData();
            setRawData(Array.isArray(data) ? data : (data.data || []));
        } catch (error: any) {
            alert("Gagal memuat data monitoring: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const isHO = userInfo.cabang.toUpperCase() === 'HEAD OFFICE';

    // ==========================================
    // FILTER LOGIC
    // ==========================================
    const uniqueFilterOptions = useMemo(() => {
        const cabangs = Array.from(new Set(rawData.map(i => i.Cabang).filter(c => c && String(c).trim() !== ""))).sort();
        const tahuns = Array.from(new Set(rawData.map(i => getYearFromDate(i.Awal_SPK) || getYearFromDate(i.tanggal_opname_final)).filter(y => y))).sort((a, b) => Number(b) - Number(a));
        return { cabangs, tahuns };
    }, [rawData]);

    // Set Default Tahun jika tersedia
    useEffect(() => {
        if (uniqueFilterOptions.tahuns.length > 0 && inputTahun === 'ALL' && appliedFilters.tahun === 'ALL') {
            setInputTahun(uniqueFilterOptions.tahuns[0] as string);
            setAppliedFilters(prev => ({ ...prev, tahun: uniqueFilterOptions.tahuns[0] as string }));
        }
    }, [uniqueFilterOptions]);

    const applyFilter = () => {
        setAppliedFilters({ cabang: inputCabang, tahun: inputTahun });
    };

    const filteredData = useMemo(() => {
        return rawData.filter(item => {
            const matchCabang = (appliedFilters.cabang === 'ALL') || (item.Cabang === appliedFilters.cabang);
            const itemYear = getYearFromDate(item.Awal_SPK) || getYearFromDate(item.tanggal_opname_final);
            const matchTahun = (appliedFilters.tahun === 'ALL') || (itemYear == appliedFilters.tahun);
            return matchCabang && matchTahun;
        });
    }, [rawData, appliedFilters]);

    // ==========================================
    // KPI CALCULATION
    // ==========================================
    const stats = useMemo(() => {
        let totalProyek = filteredData.length;
        let totalSPK = 0; let totalJHK = 0;
        let totalKeterlambatan = 0; let totalDenda = 0;
        let totalOpname = 0; let totalLuasTerbangun = 0;
        let sumNilaiToko = 0; let countNilaiToko = 0; let countKeterlambatan = 0;

        const uniqueUlokLuas: any = {};

        filteredData.forEach(item => {
            totalSPK += parseCurrency(item["Nominal SPK"]);
            
            const nt = parseScore(item["Nilai Toko"]);
            if (nt > 0) { sumNilaiToko += nt; countNilaiToko++; }
            
            const durasiSpk = parseFloat(item["Durasi SPK"]) || 0;
            const tambahSpk = parseFloat(item["tambah_spk"]) || 0;
            const keterlambatan = parseFloat(item["Keterlambatan"]) || 0;
            
            if (keterlambatan > 0) countKeterlambatan++;
            
            totalJHK += (durasiSpk + tambahSpk + keterlambatan);
            totalKeterlambatan += keterlambatan;
            totalDenda += parseCurrency(item["Denda"]);
            totalOpname += parseCurrency(item["Grand Total Opname Final"]);
            
            const ulok = item["Nomor Ulok"] || 'Tanpa Ulok-' + Math.random();
            const luas = parseFloat(item["Luas Terbangunan"]) || 0;
            if (!uniqueUlokLuas[ulok] && luas > 0) {
                uniqueUlokLuas[ulok] = luas;
                totalLuasTerbangun += luas; 
            }
        });

        return {
            totalProyek, totalSPK, totalDenda,
            avgJHK: totalProyek > 0 ? Math.round(totalJHK / totalProyek) : 0,
            avgKeterlambatan: countKeterlambatan > 0 ? Math.round(totalKeterlambatan / countKeterlambatan) : 0,
            avgCostM2: totalLuasTerbangun > 0 ? (totalOpname / totalLuasTerbangun) : 0,
            avgNilaiToko: countNilaiToko > 0 ? (sumNilaiToko / countNilaiToko) : 0
        };
    }, [filteredData]);

    // ==========================================
    // MODAL DRILL DOWN HANDLERS
    // ==========================================
    const openProjectDetails = () => {
        const grouped = { 'Approval RAB': [], 'Proses PJU': [], 'Approval SPK': [], 'Ongoing': [], 'Kerja Tambah Kurang': [], 'Done': [] };

        filteredData.forEach(item => {
            const hasStatusRab = item["Status_Rab"] && String(item["Status_Rab"]).trim() !== "";
            const hasPenawaranFinal = item["Total Penawaran Final"] && String(item["Total Penawaran Final"]).trim() !== "";
            const hasStatus = item["Status"] && String(item["Status"]).trim() !== "";
            const hasSPK = item["Nominal SPK"] && String(item["Nominal SPK"]).trim() !== "";
            const hasSerahTerima = (item["tanggal_serah_terima"] && String(item["tanggal_serah_terima"]).trim() !== "") || (item["Tgl Serah Terima"] && String(item["Tgl Serah Terima"]).trim() !== "");
            const hasOpnameFinal = item["tanggal_opname_final"] && String(item["tanggal_opname_final"]).trim() !== "";

            if (hasOpnameFinal) grouped['Done'].push(item as never);
            else if (hasSerahTerima && !hasOpnameFinal) grouped['Kerja Tambah Kurang'].push(item as never);
            else if (hasSPK && !hasSerahTerima) grouped['Ongoing'].push(item as never);
            else if (hasStatus && !hasSPK) grouped['Approval SPK'].push(item as never);
            else if (hasPenawaranFinal && !hasSPK) grouped['Proses PJU'].push(item as never);
            else if (hasStatusRab && !hasPenawaranFinal) grouped['Approval RAB'].push(item as never);
        });

        setModal({ isOpen: true, title: "Detail Status Proyek", context: 'PROJECT', view: 'summary', dataList: [], selectedItem: null, groupedProjects: grouped });
    };

    const openSpkDetails = () => {
        const groupedSPK: any = {};
        filteredData.forEach(item => {
            const spkVal = parseCurrency(item["Nominal SPK"]);
            if (spkVal > 0) {
                const ulok = item["Nomor Ulok"] || 'Tanpa Ulok';
                if (!groupedSPK[ulok]) {
                    groupedSPK[ulok] = { ulok, namaToko: item.Nama_Toko || 'Tanpa Nama', cabang: item.Cabang || '-', totalSPK: 0, items: [] };
                }
                groupedSPK[ulok].totalSPK += spkVal;
                groupedSPK[ulok].items.push(item);
            }
        });

        const list = Object.values(groupedSPK).sort((a: any, b: any) => b.totalSPK - a.totalSPK);
        setModal({ isOpen: true, title: `Daftar Lokasi & Total SPK (${list.length} Lokasi)`, context: 'SPK', view: 'list', dataList: list, selectedItem: null });
    };

    const openJhkDetails = () => {
        const list = filteredData.filter(item => {
            return (parseFloat(item["Durasi SPK"]) || 0) + (parseFloat(item["tambah_spk"]) || 0) + (parseFloat(item["Keterlambatan"]) || 0) > 0;
        }).sort((a, b) => {
            const jhkA = (parseFloat(a["Durasi SPK"]) || 0) + (parseFloat(a["tambah_spk"]) || 0) + (parseFloat(a["Keterlambatan"]) || 0);
            const jhkB = (parseFloat(b["Durasi SPK"]) || 0) + (parseFloat(b["tambah_spk"]) || 0) + (parseFloat(b["Keterlambatan"]) || 0);
            return jhkB - jhkA;
        });
        setModal({ isOpen: true, title: `Daftar Proyek & Total JHK (${list.length})`, context: 'JHK', view: 'list', dataList: list, selectedItem: null });
    };

    const openAvgCostM2Details = () => {
        const groupedCost: any = {};
        filteredData.forEach(item => {
            const opname = parseCurrency(item["Grand Total Opname Final"]);
            const luas = parseFloat(item["Luas Terbangunan"]) || 0;
            const ulok = item["Nomor Ulok"] || 'Tanpa Ulok';

            if (!groupedCost[ulok]) {
                groupedCost[ulok] = { ulok, namaToko: item.Nama_Toko || 'Tanpa Nama', cabang: item.Cabang || '-', totalOpname: 0, luasTerbangun: luas > 0 ? luas : 0, items: [] };
            }
            groupedCost[ulok].totalOpname += opname;
            groupedCost[ulok].items.push(item);
            
            if (groupedCost[ulok].luasTerbangun === 0 && luas > 0) groupedCost[ulok].luasTerbangun = luas;
        });

        const list = Object.values(groupedCost)
            .filter((g: any) => g.totalOpname > 0 && g.luasTerbangun > 0)
            .map((g: any) => ({ ...g, costPerM2: g.totalOpname / g.luasTerbangun }))
            .sort((a: any, b: any) => b.costPerM2 - a.costPerM2);

        setModal({ isOpen: true, title: `Daftar Lokasi & Cost/m² (${list.length} Lokasi)`, context: 'COST_M2', view: 'list', dataList: list, selectedItem: null });
    };

    const openKeterlambatanDetails = () => {
        const list = filteredData.filter(item => (parseFloat(item["Keterlambatan"]) || 0) > 0)
            .sort((a, b) => (parseFloat(b["Keterlambatan"]) || 0) - (parseFloat(a["Keterlambatan"]) || 0));
        setModal({ isOpen: true, title: `Daftar Proyek Terlambat (${list.length})`, context: 'KETERLAMBATAN', view: 'list', dataList: list, selectedItem: null });
    };

    const openNilaiTokoDetails = () => {
        const list = filteredData.filter(item => {
            const val = parseFloat(item["Nilai Toko"]);
            return !isNaN(val) && val > 0;
        }).sort((a, b) => (parseFloat(b["Nilai Toko"]) || 0) - (parseFloat(a["Nilai Toko"]) || 0));
        setModal({ isOpen: true, title: `Daftar Proyek & Nilai Toko (${list.length})`, context: 'NILAI_TOKO', view: 'list', dataList: list, selectedItem: null });
    };

    // ==========================================
    // RENDER MODAL CONTENTS
    // ==========================================
    const InfoBox = ({ label, value, highlight = false, colorClass = "text-slate-800" }: { label: string, value: React.ReactNode, highlight?: boolean, colorClass?: string }) => (
        <div className={`p-4 rounded-xl border ${highlight ? 'bg-white shadow-sm border-slate-200' : 'bg-slate-50 border-slate-100'} flex flex-col justify-center`}>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">{label}</span>
            <span className={`font-bold ${highlight ? 'text-xl md:text-2xl' : 'text-base md:text-lg'} ${colorClass}`}>{value}</span>
        </div>
    );

    const renderModalDetailContent = () => {
        const item = modal.selectedItem;
        if(!item) return null;

        if (modal.context === 'SPK') {
            const itemSipil = item.items.find((i:any) => i.Lingkup_Pekerjaan?.toLowerCase().includes('sipil'));
            const itemME = item.items.find((i:any) => i.Lingkup_Pekerjaan?.toLowerCase().includes('me'));
            const refItem = itemSipil || itemME || item.items[0];

            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                        <InfoBox label="Total Akumulasi SPK" value={formatRupiah(item.totalSPK)} highlight colorClass="text-emerald-600" />
                        <InfoBox label="Rincian Per Lingkup" value={
                            <div className="flex justify-between items-center text-sm md:text-base w-full">
                                <span>Sipil: <span className="text-slate-800">{formatRupiah(itemSipil ? parseCurrency(itemSipil["Nominal SPK"]) : 0)}</span></span>
                                <span>ME: <span className="text-slate-800">{formatRupiah(itemME ? parseCurrency(itemME["Nominal SPK"]) : 0)}</span></span>
                            </div>
                        } highlight />
                    </div>
                    <InfoBox label="Cabang" value={item.cabang} />
                    <InfoBox label="Kode Toko / Ulok" value={`${refItem.Kode_Toko || '-'} / ${item.ulok}`} />
                    <InfoBox label="Kontraktor Sipil" value={itemSipil?.Kontraktor || '-'} />
                    <InfoBox label="Kontraktor ME" value={itemME?.Kontraktor || '-'} />
                </div>
            );
        }
        
        if (modal.context === 'COST_M2') {
            const itemSipil = item.items.find((i:any) => i.Lingkup_Pekerjaan?.toLowerCase().includes('sipil'));
            const itemME = item.items.find((i:any) => i.Lingkup_Pekerjaan?.toLowerCase().includes('me'));
            const refItem = itemSipil || itemME || item.items[0];

            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                        <InfoBox label="Grand Total Opname" value={formatRupiah(item.totalOpname)} highlight colorClass="text-green-600" />
                        <InfoBox label="Cost /m² (Terbangun)" value={formatRupiah(Math.round(item.costPerM2))} highlight colorClass="text-indigo-600" />
                    </div>
                    
                    <InfoBox label="Rincian Opname" value={
                        <div className="text-sm md:text-base">
                            Sipil: {formatRupiah(itemSipil ? parseCurrency(itemSipil["Grand Total Opname Final"]) : 0)} <br/>
                            ME: {formatRupiah(itemME ? parseCurrency(itemME["Grand Total Opname Final"]) : 0)}
                        </div>
                    } />
                    <InfoBox label="Cabang" value={item.cabang} />
                    <InfoBox label="Luas Bangunan" value={`${refItem["Luas Bangunan"] || 0} m²`} />
                    <InfoBox label="Luas Terbangunan" value={`${item.luasTerbangun} m²`} />
                    <InfoBox label="Luas Area Terbuka" value={`${refItem["Luas Area Terbuka"] || 0} m²`} />
                    <InfoBox label="Luas Area Parkir" value={`${refItem["Luas Area Parkir"] || 0} m²`} />
                    <InfoBox label="Luas Area Sales" value={`${refItem["Luas Area Sales"] || 0} m²`} />
                    <InfoBox label="Luas Gudang" value={`${refItem["Luas Gudang"] || 0} m²`} />
                </div>
            );
        }

        if (modal.context === 'JHK') {
            const durasi = parseFloat(item["Durasi SPK"]) || 0;
            const tambah = parseFloat(item["tambah_spk"]) || 0;
            const telat = parseFloat(item["Keterlambatan"]) || 0;
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoBox label="Total Hari Kerja (JHK)" value={`${durasi + tambah + telat} Hari`} highlight colorClass="text-green-600" />
                    <InfoBox label="Rincian Waktu" value={
                        <div className="text-sm md:text-base">
                            Durasi SPK: {durasi} Hari | Tambah: {tambah} Hari <br/>
                            <span className="text-red-500">Keterlambatan: {telat} Hari</span>
                        </div>
                    } highlight />
                    <InfoBox label="Cabang" value={item.Cabang || '-'} />
                    <InfoBox label="Kode Toko / Ulok" value={`${item.Kode_Toko || '-'} / ${item["Nomor Ulok"] || '-'}`} />
                </div>
            );
        }

        if (modal.context === 'KETERLAMBATAN') {
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 lg:col-span-3">
                        <InfoBox label="Total Keterlambatan" value={`${parseFloat(item["Keterlambatan"]) || 0} Hari`} highlight colorClass="text-red-600" />
                    </div>
                    <InfoBox label="Kode Toko / Ulok" value={`${item.Kode_Toko || '-'} / ${item["Nomor Ulok"] || '-'}`} />
                    <InfoBox label="Cabang" value={item.Cabang || '-'} />
                    <InfoBox label="Akhir SPK" value={item["Akhir_SPK"] || '-'} />
                    <InfoBox label="Tambah SPK" value={`${item["tambah_spk"] || '0'} Hari`} />
                    <InfoBox label="Tgl Serah Terima" value={item["tanggal_serah_terima"] || item["Tgl Serah Terima"] || '-'} colorClass="text-green-600" />
                </div>
            );
        }

        if (modal.context === 'NILAI_TOKO') {
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InfoBox label="Nilai Toko" value={item["Nilai Toko"] || '-'} highlight colorClass="text-amber-600" />
                        <InfoBox label="Grand Total Opname" value={formatRupiah(parseCurrency(item["Grand Total Opname Final"]))} highlight colorClass="text-green-600" />
                    </div>
                    <InfoBox label="Kode Toko / Ulok" value={`${item.Kode_Toko || '-'} / ${item["Nomor Ulok"] || '-'}`} />
                    <InfoBox label="Cabang" value={item.Cabang || '-'} />
                    <div className="sm:col-span-2 lg:col-span-1">
                        <InfoBox label="Kontraktor" value={item["Kontraktor"] || '-'} />
                    </div>
                </div>
            );
        }

        // Default / PROJECT
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                    <InfoBox label="Nominal SPK" value={formatRupiah(parseCurrency(item["Nominal SPK"]))} highlight />
                    <InfoBox label="Opname Final" value={formatRupiah(parseCurrency(item["Grand Total Opname Final"]))} highlight colorClass="text-green-600" />
                </div>
                <InfoBox label="Cabang" value={item.Cabang || '-'} />
                <InfoBox label="Kode Toko / Ulok" value={`${item.Kode_Toko || '-'} / ${item["Nomor Ulok"] || '-'}`} />
                <InfoBox label="Kategori" value={item.Kategori || '-'} />
                <InfoBox label="Kontraktor" value={item.Kontraktor || '-'} />
                <InfoBox label="Awal & Akhir SPK" value={`${item.Awal_SPK || '-'} s/d ${item.Akhir_SPK || '-'}`} />
                <InfoBox label="Tgl Serah Terima" value={item.tanggal_serah_terima || item["Tgl Serah Terima"] || '-'} />
                
                <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <InfoBox label="Kerja Tambah / Kurang" value={
                        <div className="flex flex-col">
                            <span className="text-green-600">+ {formatRupiah(parseCurrency(item.Kerja_Tambah))}</span>
                            <span className="text-red-600">- {formatRupiah(parseCurrency(item.Kerja_Kurang))}</span>
                        </div>
                    } />
                    <InfoBox label="Denda Keterlambatan" value={formatRupiah(parseCurrency(item.Denda))} colorClass="text-red-600" />
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans pb-12">
            <header className="flex items-center justify-between p-4 md:px-8 bg-linear-to-r from-red-700 via-red-600 to-red-800 text-white shadow-md sticky top-0 z-20">
                <div className="flex items-center gap-3 md:gap-5">
                    <Link href="/dashboard" className="mr-2 hover:bg-white/20 p-2 rounded-full transition-colors"><ChevronLeft className="w-6 h-6" /></Link>
                    <img src="/assets/Alfamart-Emblem.png" alt="Logo" className="h-8 md:h-12 object-contain drop-shadow-md" />
                    <div className="h-6 md:h-8 w-px bg-white/30 hidden md:block"></div>
                    <h1 className="text-lg md:text-2xl font-bold tracking-widest drop-shadow-md">MONITORING</h1>
                </div>
                
                <div className="relative z-10">
                    <Badge variant="outline" className="bg-black/20 text-white border-white/30 px-3 py-1 shadow-sm">
                        DASHBOARD
                    </Badge>
                </div>
            </header>

            <main className="max-w-350 mx-auto p-4 md:p-8 mt-2">
                
                {/* 2. FILTER CONTROLS */}
                <div className="mb-8 p-1 bg-white rounded-2xl shadow-sm border border-slate-200">
                    <div className="p-5 md:p-6 flex flex-col md:flex-row gap-4 items-end bg-slate-50/50 rounded-xl">
                        <div className="w-full space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Cabang Area</label>
                            {isHO ? (
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select className="w-full pl-9 pr-4 py-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-red-500 outline-none font-semibold text-slate-700 transition-shadow appearance-none" value={inputCabang} onChange={e => setInputCabang(e.target.value)}>
                                        <option value="ALL">Nasional (Semua Cabang)</option>
                                        {uniqueFilterOptions.cabangs.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" readOnly className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-100 font-bold text-slate-600 outline-none" value={inputCabang} />
                                </div>
                            )}
                        </div>
                        <div className="w-full space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Tahun Proyek</label>
                            <div className="relative">
                                <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select className="w-full pl-9 pr-4 py-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-red-500 outline-none font-semibold text-slate-700 transition-shadow appearance-none" value={inputTahun} onChange={e => setInputTahun(e.target.value)}>
                                    <option value="ALL">Semua Tahun</option>
                                    {uniqueFilterOptions.tahuns.map(y => <option key={y as string} value={y as string}>{y as string}</option>)}
                                </select>
                            </div>
                        </div>
                        <Button onClick={applyFilter} className="w-full md:w-auto h-12.5 rounded-xl bg-red-600 hover:bg-red-700 px-8 font-bold shadow-md transition-transform active:scale-95 text-base">
                            <Filter className="w-4 h-4 mr-2"/> Terapkan
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32">
                        <Loader2 className="w-12 h-12 animate-spin text-red-600 mb-4" />
                        <p className="text-slate-500 font-medium">Menganalisis & Memuat Data Master...</p>
                    </div>
                ) : (
                    /* 3. STATISTIK KARTU UTAMA (Dengan Animasi Count-Up) */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        
                        <Card onClick={openProjectDetails} className="cursor-pointer hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 border-0 ring-1 ring-slate-200 overflow-hidden group bg-linear-to-br from-white to-blue-50/80">
                            <CardContent className="p-6 relative">
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl shadow-inner"><FolderKanban className="w-6 h-6" /></div>
                                    <Badge variant="outline" className="bg-white/60 text-blue-700 border-blue-200 shadow-sm backdrop-blur-sm">Total Proyek</Badge>
                                </div>
                                <div className="relative z-10 mt-6">
                                    <p className="text-4xl font-extrabold text-slate-800">
                                        <AnimatedNumber value={stats.totalProyek} />
                                    </p>
                                </div>
                                <Search className="absolute -right-5 -bottom-5 w-32 h-32 text-blue-500/10 group-hover:scale-110 transition-transform duration-500"/>
                            </CardContent>
                        </Card>
                        
                        <Card onClick={openSpkDetails} className="cursor-pointer hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 border-0 ring-1 ring-slate-200 overflow-hidden group bg-linear-to-br from-white to-emerald-50/80">
                            <CardContent className="p-6 relative">
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl shadow-inner"><Wallet className="w-6 h-6" /></div>
                                    <Badge variant="outline" className="bg-white/60 text-emerald-700 border-emerald-200 shadow-sm backdrop-blur-sm">Total Nilai SPK</Badge>
                                </div>
                                <div className="relative z-10 mt-6">
                                    <p className="text-3xl font-extrabold text-slate-800">
                                        <AnimatedNumber value={stats.totalSPK} formatter={formatRupiah} />
                                    </p>
                                </div>
                                <Search className="absolute -right-5 -bottom-5 w-32 h-32 text-emerald-500/10 group-hover:scale-110 transition-transform duration-500"/>
                            </CardContent>
                        </Card>

                        <Card onClick={openJhkDetails} className="cursor-pointer hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 border-0 ring-1 ring-slate-200 overflow-hidden group bg-linear-to-br from-white to-amber-50/80">
                            <CardContent className="p-6 relative">
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="p-3 bg-amber-100 text-amber-600 rounded-xl shadow-inner"><CalendarClock className="w-6 h-6" /></div>
                                    <Badge variant="outline" className="bg-white/60 text-amber-700 border-amber-200 shadow-sm backdrop-blur-sm">JHK Rata-rata</Badge>
                                </div>
                                <div className="relative z-10 mt-6">
                                    <p className="text-4xl font-extrabold text-slate-800">
                                        <AnimatedNumber value={stats.avgJHK} /> <span className="text-lg text-slate-500 font-semibold">Hari</span>
                                    </p>
                                </div>
                                <Search className="absolute -right-5 -bottom-5 w-32 h-32 text-amber-500/10 group-hover:scale-110 transition-transform duration-500"/>
                            </CardContent>
                        </Card>

                        <Card onClick={openKeterlambatanDetails} className="cursor-pointer hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 border-0 ring-1 ring-slate-200 overflow-hidden group bg-linear-to-br from-white to-red-50/80">
                            <CardContent className="p-6 relative">
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="p-3 bg-red-100 text-red-600 rounded-xl shadow-inner"><ClockAlert className="w-6 h-6" /></div>
                                    <Badge variant="outline" className="bg-white/60 text-red-700 border-red-200 shadow-sm backdrop-blur-sm">Rata-rata Keterlambatan</Badge>
                                </div>
                                <div className="relative z-10 mt-6">
                                    <p className="text-4xl font-extrabold text-slate-800">
                                        <AnimatedNumber value={stats.avgKeterlambatan} /> <span className="text-lg text-slate-500 font-semibold">Hari</span>
                                    </p>
                                </div>
                                <Search className="absolute -right-5 -bottom-5 w-32 h-32 text-red-500/10 group-hover:scale-110 transition-transform duration-500"/>
                            </CardContent>
                        </Card>

                        <Card onClick={openAvgCostM2Details} className="cursor-pointer hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 border-0 ring-1 ring-slate-200 overflow-hidden group bg-linear-to-br from-white to-indigo-50/80">
                            <CardContent className="p-6 relative">
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl shadow-inner"><Calculator className="w-6 h-6" /></div>
                                    <Badge variant="outline" className="bg-white/60 text-indigo-700 border-indigo-200 shadow-sm backdrop-blur-sm">Cost Per M² (Rata-rata)</Badge>
                                </div>
                                <div className="relative z-10 mt-6">
                                    <p className="text-3xl font-extrabold text-slate-800">
                                        <AnimatedNumber value={stats.avgCostM2} formatter={formatRupiah} />
                                    </p>
                                </div>
                                <Search className="absolute -right-5 -bottom-5 w-32 h-32 text-indigo-500/10 group-hover:scale-110 transition-transform duration-500"/>
                            </CardContent>
                        </Card>

                        <Card onClick={openNilaiTokoDetails} className="cursor-pointer hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 border-0 ring-1 ring-slate-200 overflow-hidden group bg-linear-to-br from-white to-orange-50/80">
                            <CardContent className="p-6 relative">
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="p-3 bg-orange-100 text-orange-600 rounded-xl shadow-inner"><TrendingUp className="w-6 h-6" /></div>
                                    <Badge variant="outline" className="bg-white/60 text-orange-700 border-orange-200 shadow-sm backdrop-blur-sm">Nilai Toko (Rata-rata)</Badge>
                                </div>
                                <div className="relative z-10 mt-6">
                                    <p className="text-3xl font-extrabold text-slate-800">
                                        <AnimatedNumber value={stats.avgNilaiToko} formatter={formatScore} isFloat={true} />
                                    </p>
                                </div>
                                <Search className="absolute -right-5 -bottom-5 w-32 h-32 text-orange-500/10 group-hover:scale-110 transition-transform duration-500"/>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </main>

            {/* 4. MODAL FULLSCREEN UNTUK DRILL DOWN */}
            {modal.isOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex flex-col md:p-6 lg:p-10 animate-in fade-in duration-300">
                    <div className="flex-1 bg-slate-50 flex flex-col md:rounded-3xl shadow-2xl overflow-hidden border border-slate-200/50 animate-in slide-in-from-bottom-8 duration-500">
                        
                        {/* Header Modal */}
                        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                {modal.view === 'detail' ? (
                                    <Button variant="ghost" onClick={() => setModal(p => ({...p, view: 'list', selectedItem: null}))} className="hover:bg-slate-100 text-slate-600 font-semibold px-4 rounded-xl"><ArrowLeft className="w-5 h-5 mr-2"/> Kembali ke Daftar</Button>
                                ) : modal.view === 'list' && modal.context === 'PROJECT' ? (
                                    <Button variant="ghost" onClick={() => setModal(p => ({...p, view: 'summary', title: 'Detail Status Proyek'}))} className="hover:bg-slate-100 text-slate-600 font-semibold px-4 rounded-xl"><ArrowLeft className="w-5 h-5 mr-2"/> Kembali ke Ringkasan</Button>
                                ) : (
                                    <h2 className="font-bold text-xl text-slate-800">{modal.title}</h2>
                                )}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setModal(p => ({...p, isOpen: false}))} className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"><X className="w-6 h-6"/></Button>
                        </div>

                        {/* Body Modal */}
                        <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50/50">
                            {modal.view === 'summary' && modal.context === 'PROJECT' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                                    {Object.entries(modal.groupedProjects || {}).map(([label, items], idx) => (
                                        <Card key={label} onClick={() => setModal(p => ({...p, view: 'list', dataList: items, title: `Daftar Toko: ${label} (${items.length})`}))} className="cursor-pointer hover:border-red-400 hover:shadow-xl transition-all duration-300 border-0 ring-1 ring-slate-200 group bg-white animate-in zoom-in-95" style={{animationDelay: `${idx * 50}ms`}}>
                                            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                                                <div className="w-16 h-16 rounded-2xl bg-slate-50 group-hover:bg-red-50 text-slate-400 group-hover:text-red-600 flex items-center justify-center transition-colors">
                                                    <Building2 className="w-8 h-8" />
                                                </div>
                                                <div>
                                                    <span className="block font-bold text-slate-800 text-lg mb-1">{label}</span>
                                                    <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-1 text-sm border-0">{items.length} Toko</Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {modal.view === 'list' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-350 mx-auto">
                                    {modal.dataList.length === 0 ? (
                                        <div className="col-span-full text-center py-20 text-slate-500 font-medium">Tidak ada data untuk ditampilkan.</div>
                                    ) : modal.dataList.map((item, i) => {
                                        
                                        // Render Khusus jika tipe datanya Grouped (SPK / COST_M2)
                                        if (modal.context === 'SPK' || modal.context === 'COST_M2') {
                                            const lingkupText = item.items ? item.items.map((it:any) => it.Lingkup_Pekerjaan).filter(Boolean).join(' & ') || '-' : '-';
                                            return (
                                                <Card key={i} className="cursor-pointer hover:border-blue-400 hover:shadow-md transition-all border-l-4 border-l-blue-500 bg-white" onClick={() => setModal(p => ({...p, view: 'detail', selectedItem: item}))}>
                                                    <CardContent className="p-5 flex justify-between items-center gap-4">
                                                        <div>
                                                            <h3 className="font-bold text-base text-slate-800 mb-1">{item.namaToko} <span className="font-medium text-blue-500">({lingkupText})</span></h3>
                                                            <div className="text-xs text-slate-500 font-medium">{item.cabang} • Ulok: {item.ulok}</div>
                                                        </div>
                                                        <Badge className={`px-3 py-1.5 shrink-0 text-center border-0 ${modal.context === 'SPK' ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"}`}>
                                                            {modal.context === 'SPK' ? formatRupiah(item.totalSPK) : `${formatRupiah(Math.round(item.costPerM2))}/m²`}
                                                        </Badge>
                                                    </CardContent>
                                                </Card>
                                            );
                                        }

                                        // Render Item Standar (PROJECT, JHK, KETERLAMBATAN, NILAI_TOKO)
                                        const lingkup = item.Lingkup_Pekerjaan || '-';
                                        let badgeText = item.Kategori || '-';
                                        let badgeColor = "bg-slate-100 text-slate-700";

                                        if (modal.context === 'JHK') {
                                            const dur = parseFloat(item["Durasi SPK"]) || 0; const tmb = parseFloat(item["tambah_spk"]) || 0; const tel = parseFloat(item["Keterlambatan"]) || 0;
                                            badgeText = `${dur + tmb + tel} Hari`; badgeColor = "bg-amber-100 text-amber-800";
                                        } else if (modal.context === 'KETERLAMBATAN') {
                                            badgeText = `${parseFloat(item["Keterlambatan"]) || 0} Hari`; badgeColor = "bg-red-100 text-red-800";
                                        } else if (modal.context === 'NILAI_TOKO') {
                                            badgeText = `Skor: ${item["Nilai Toko"] || '-'}`; badgeColor = "bg-orange-100 text-orange-800";
                                        }

                                        let extraInfo = '';
                                        if (modal.context === 'PROJECT' && item["Awal_SPK"]) extraInfo = ` • SPK: ${item["Awal_SPK"]}`;

                                        return (
                                            <Card key={i} className="cursor-pointer hover:border-blue-400 hover:shadow-md transition-all border-l-4 border-l-blue-500 bg-white" onClick={() => setModal(p => ({...p, view: 'detail', selectedItem: item}))}>
                                                <CardContent className="p-5 flex justify-between items-center gap-4">
                                                    <div>
                                                        <h3 className="font-bold text-base text-slate-800 mb-1 leading-tight">{item.Nama_Toko || 'Tanpa Nama'} <span className="font-medium text-blue-500">({lingkup})</span></h3>
                                                        <div className="text-xs text-slate-500 font-medium">{item.Cabang || '-'} • {item.Kode_Toko || '-'}{extraInfo}</div>
                                                    </div>
                                                    <Badge className={`px-3 py-1.5 shrink-0 text-center border-0 ${badgeColor}`}>{badgeText}</Badge>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}

                            {modal.view === 'detail' && (
                                <div className="max-w-5xl mx-auto animate-in zoom-in-95 duration-300">
                                    <div className="p-6 md:p-8 bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden relative">
                                        {/* Ornamen Latar */}
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-bl from-blue-100/50 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none"></div>
                                        
                                        <div className="flex items-center gap-4 md:gap-6 mb-8 relative z-10 border-b border-slate-100 pb-6">
                                            <div className="w-16 h-16 bg-linear-to-br from-blue-500 to-blue-700 text-white rounded-2xl shadow-lg flex items-center justify-center font-bold text-2xl shrink-0">
                                                <Building2 className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">{modal.selectedItem?.Nama_Toko || modal.selectedItem?.namaToko || 'Detail Info'}</h2>
                                                <Badge className="mt-2 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 text-sm font-semibold">{modal.selectedItem?.Lingkup_Pekerjaan ? `Lingkup: ${modal.selectedItem.Lingkup_Pekerjaan}` : 'Data Proyek'}</Badge>
                                            </div>
                                        </div>
                                        
                                        <div className="relative z-10">
                                            {renderModalDetailContent()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}