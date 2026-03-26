"use client"

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchPricesData, submitILData } from '@/lib/api';
import AppNavbar from '@/components/AppNavbar';

const SIPIL_CATEGORIES = [
    "PEKERJAAN PERSIAPAN", "PEKERJAAN BOBOKAN / BONGKARAN", "PEKERJAAN TANAH",
    "PEKERJAAN PONDASI & BETON", "PEKERJAAN PASANGAN", "PEKERJAAN BESI",
    "PEKERJAAN KERAMIK", "PEKERJAAN PLUMBING", "PEKERJAAN SANITARY & ACECORIES",
    "PEKERJAAN JANITOR", "PEKERJAAN ATAP", "PEKERJAAN KUSEN, PINTU & KACA",
    "PEKERJAAN FINISHING", "PEKERJAAN BEANSPOT", "PEKERJAAN AREA TERBUKA",
    "PEKERJAAN TAMBAHAN", "PEKERJAAN SBO"
];

const ME_CATEGORIES = [
    "INSTALASI", "FIXTURE", "PEKERJAAN TAMBAHAN", "PEKERJAAN SBO"
];

const formatRupiah = (num: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num || 0);

function ILForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const urlUlok = searchParams.get('ulok') || '';
    const urlToko = searchParams.get('toko') || '';

    const [formState, setFormState] = useState({
        nama_toko: urlToko,
        ulok: urlUlok,
        proyek: '',
        alamat: '',
        cabang: '',
        lingkup: ''
    });

    const [filePdf, setFilePdf] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Data Harga dari DB
    const [priceData, setPriceData] = useState<any>({});
    
    // Baris Pekerjaan
    const [boqItems, setBoqItems] = useState<any[]>([]);

    useEffect(() => {
        const cabang = sessionStorage.getItem("loggedInUserCabang") || '';
        setFormState(prev => ({ ...prev, cabang }));
    }, []);

    useEffect(() => {
        if (formState.cabang && formState.lingkup) {
            fetchPricesData(formState.cabang, formState.lingkup)
                .then(data => { setPriceData(data); setBoqItems([]); })
                .catch(err => alert("Gagal memuat harga: " + err.message));
        }
    }, [formState.cabang, formState.lingkup]);

    const activeCategories = formState.lingkup === 'ME' ? ME_CATEGORIES : SIPIL_CATEGORIES;

    const addBoqItem = () => {
        setBoqItems(prev => [...prev, {
            id: Date.now(), category: '', jenis: '', satuan: '', volume: 0,
            harga_material: 0, harga_upah: 0, isMaterialKondisional: false, isUpahKondisional: false
        }]);
    };

    const handleItemChange = (id: number, field: string, value: any) => {
        setBoqItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, [field]: value };
            
            if (field === 'category') {
                updated.jenis = ''; updated.satuan = ''; updated.volume = 0;
                updated.harga_material = 0; updated.harga_upah = 0;
            } else if (field === 'jenis') {
                const found = priceData[updated.category]?.find((x: any) => x["Jenis Pekerjaan"] === value);
                if (found) {
                    updated.satuan = found["Satuan"];
                    updated.volume = found["Satuan"] === "Ls" ? 1 : 0;
                    updated.isMaterialKondisional = found["Harga Material"] === "Kondisional";
                    updated.isUpahKondisional = found["Harga Upah"] === "Kondisional";
                    updated.harga_material = updated.isMaterialKondisional ? 0 : Number(found["Harga Material"] || 0);
                    updated.harga_upah = updated.isUpahKondisional ? 0 : Number(found["Harga Upah"] || 0);
                }
            }
            return updated;
        }));
    };

    const calculations = useMemo(() => {
        let total = 0;
        boqItems.forEach(item => { total += item.volume * (item.harga_material + item.harga_upah); });
        const pembulatan = Math.floor(total / 10000) * 10000;
        const ppn = pembulatan * 0.11;
        return { total, pembulatan, ppn, finalTotal: pembulatan + ppn };
    }, [boqItems]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!filePdf) return alert("Pilih file Lampiran PDF terlebih dahulu.");
        if (boqItems.length === 0) return alert("Masukkan minimal 1 item pekerjaan.");

        setIsSubmitting(true);
        try {
            const fd = new FormData();
            fd.append("Nama_Toko", formState.nama_toko);
            fd.append("nama_toko", formState.nama_toko);
            fd.append("Nomor Ulok", formState.ulok);
            fd.append("Proyek", formState.proyek);
            fd.append("Alamat", formState.alamat);
            fd.append("Cabang", formState.cabang);
            fd.append("Lingkup_Pekerjaan", formState.lingkup);
            fd.append("Email_Pembuat", sessionStorage.getItem("loggedInUserEmail") || "");
            fd.append("Grand Total", calculations.finalTotal.toString());
            fd.append("file_pdf", filePdf);

            let itemIndex = 1;
            boqItems.forEach(item => {
                if (item.jenis && item.volume > 0) {
                    fd.append(`Kategori_Pekerjaan_${itemIndex}`, item.category);
                    fd.append(`Jenis_Pekerjaan_${itemIndex}`, item.jenis);
                    fd.append(`Satuan_Item_${itemIndex}`, item.satuan);
                    fd.append(`Volume_Item_${itemIndex}`, item.volume.toString());
                    fd.append(`Harga_Material_Item_${itemIndex}`, item.harga_material.toString());
                    fd.append(`Harga_Upah_Item_${itemIndex}`, item.harga_upah.toString());
                    fd.append(`Total_Material_Item_${itemIndex}`, (item.volume * item.harga_material).toString());
                    fd.append(`Total_Upah_Item_${itemIndex}`, (item.volume * item.harga_upah).toString());
                    fd.append(`Total_Harga_Item_${itemIndex}`, (item.volume * (item.harga_material + item.harga_upah)).toString());
                    itemIndex++;
                }
            });

            await submitILData(fd);
            alert("Instruksi Lapangan berhasil dikirim!");
            router.push(`/opname?ulok=${formState.ulok}`);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">
            <AppNavbar
                title="Form Instruksi Lapangan"
                showBackButton
                backHref="/opname"
            />

            <main className="max-w-5xl mx-auto p-4 md:p-8 mt-4">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Card className="shadow-sm border-slate-200">
                        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Nama Toko *</label>
                                <input type="text" required className="w-full p-2.5 border rounded-lg bg-slate-50 outline-none font-semibold text-slate-600" value={formState.nama_toko} onChange={e => setFormState({...formState, nama_toko: e.target.value})} readOnly={!!urlToko} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Nomor Ulok *</label>
                                <input type="text" required className="w-full p-2.5 border rounded-lg bg-slate-50 outline-none font-semibold text-slate-600" value={formState.ulok} onChange={e => setFormState({...formState, ulok: e.target.value})} readOnly={!!urlUlok} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Proyek *</label>
                                <select required className="w-full p-2.5 border rounded-lg bg-white outline-none" value={formState.proyek} onChange={e => setFormState({...formState, proyek: e.target.value})}>
                                    <option value="">-- Pilih Jenis Proyek --</option><option value="Alfamart Reguler">Reguler</option><option value="Franchise">Franchise</option><option value="Renovasi">Renovasi</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Lingkup Pekerjaan *</label>
                                <select required className="w-full p-2.5 border rounded-lg bg-white outline-none" value={formState.lingkup} onChange={e => setFormState({...formState, lingkup: e.target.value})}>
                                    <option value="">-- Pilih Lingkup Pekerjaan --</option><option value="Sipil">Sipil</option><option value="ME">ME</option>
                                </select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-bold text-slate-700">Alamat Toko *</label>
                                <input type="text" required className="w-full p-2.5 border rounded-lg bg-white outline-none" value={formState.alamat} onChange={e => setFormState({...formState, alamat: e.target.value})} placeholder="Masukkan alamat lengkap..." />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-bold text-slate-700">Lampiran Bukti IL (PDF Max 1 File) *</label>
                                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors relative bg-white">
                                    <input type="file" accept=".pdf" required className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => setFilePdf(e.target.files?.[0] || null)} />
                                    <p className="font-medium text-slate-700">{filePdf ? filePdf.name : "Klik atau seret file PDF ke sini"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {formState.lingkup && (
                        <Card className="shadow-sm border-slate-200">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-bold text-slate-800">Daftar Pekerjaan Tambah (BoQ)</h2>
                                    <Button type="button" onClick={addBoqItem} variant="outline" className="border-blue-600 text-blue-700 hover:bg-blue-50"><Plus className="w-4 h-4 mr-2"/> Tambah Item</Button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left border-collapse min-w-250">
                                        <thead className="bg-slate-800 text-white text-xs border-b">
                                            <tr>
                                                <th className="p-3 border-r border-slate-700">Kategori</th>
                                                <th className="p-3 border-r border-slate-700">Jenis Pekerjaan</th>
                                                <th className="p-3 border-r border-slate-700 w-24">Vol</th>
                                                <th className="p-3 border-r border-slate-700 w-24">Satuan</th>
                                                <th className="p-3 border-r border-slate-700 text-right">Harga Material</th>
                                                <th className="p-3 border-r border-slate-700 text-right">Harga Upah</th>
                                                <th className="p-3 border-r border-slate-700 text-right">Total Harga</th>
                                                <th className="p-3 bg-slate-900 text-center w-16">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 bg-white">
                                            {boqItems.map(item => (
                                                <tr key={item.id} className="hover:bg-slate-50">
                                                    <td className="p-2 border-r">
                                                        <select className="w-full p-2 border rounded" value={item.category} onChange={e => handleItemChange(item.id, 'category', e.target.value)}>
                                                            <option value="">- Kategori -</option>{activeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="p-2 border-r">
                                                        <select className="w-full p-2 border rounded" value={item.jenis} onChange={e => handleItemChange(item.id, 'jenis', e.target.value)} disabled={!item.category}>
                                                            <option value="">- Jenis -</option>{(priceData[item.category] || []).map((x:any) => <option key={x["Jenis Pekerjaan"]} value={x["Jenis Pekerjaan"]}>{x["Jenis Pekerjaan"]}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="p-2 border-r"><input type="number" step="any" className="w-full p-2 border rounded text-center" value={item.volume} onChange={e => handleItemChange(item.id, 'volume', parseFloat(e.target.value)||0)} readOnly={item.satuan === 'Ls'} /></td>
                                                    <td className="p-2 border-r"><input type="text" className="w-full p-2 border rounded bg-slate-100 text-center" value={item.satuan} readOnly /></td>
                                                    <td className="p-2 border-r">
                                                        <input type="number" className={`w-full p-2 border rounded text-right ${item.isMaterialKondisional ? 'bg-white border-amber-500' : 'bg-slate-100'}`} value={item.harga_material} onChange={e => handleItemChange(item.id, 'harga_material', parseFloat(e.target.value)||0)} readOnly={!item.isMaterialKondisional} />
                                                    </td>
                                                    <td className="p-2 border-r">
                                                        <input type="number" className={`w-full p-2 border rounded text-right ${item.isUpahKondisional ? 'bg-white border-amber-500' : 'bg-slate-100'}`} value={item.harga_upah} onChange={e => handleItemChange(item.id, 'harga_upah', parseFloat(e.target.value)||0)} readOnly={!item.isUpahKondisional} />
                                                    </td>
                                                    <td className="p-2 border-r bg-slate-50 text-right font-bold text-slate-800">{formatRupiah(item.volume * (item.harga_material + item.harga_upah))}</td>
                                                    <td className="p-2 text-center bg-slate-50"><Button type="button" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2" onClick={() => setBoqItems(prev => prev.filter(x => x.id !== item.id))}><Trash2 className="w-5 h-5"/></Button></td>
                                                </tr>
                                            ))}
                                            {boqItems.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400 italic">Belum ada item ditambahkan.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="bg-slate-50 border-slate-200 shadow-inner">
                        <CardContent className="p-6 space-y-3">
                            <div className="flex justify-between text-slate-600"><span>Total Pekerjaan:</span><span className="font-semibold">{formatRupiah(calculations.total)}</span></div>
                            <div className="flex justify-between text-slate-600"><span>Pembulatan:</span><span className="font-semibold">{formatRupiah(calculations.pembulatan)}</span></div>
                            <div className="flex justify-between text-slate-600 border-b pb-3"><span>PPN 11%:</span><span className="font-semibold">{formatRupiah(calculations.ppn)}</span></div>
                            <div className="flex justify-between text-blue-900 pt-1 text-xl font-bold"><span>Grand Total:</span><span>{formatRupiah(calculations.finalTotal)}</span></div>
                        </CardContent>
                    </Card>

                    <Button type="submit" disabled={isSubmitting} className="w-full h-14 bg-red-600 hover:bg-red-700 text-lg font-bold shadow-lg">
                        {isSubmitting ? <><Loader2 className="w-6 h-6 mr-2 animate-spin"/> Mengirim...</> : <><Save className="w-6 h-6 mr-2"/> Kirim Instruksi Lapangan (IL)</>}
                    </Button>
                </form>
            </main>
        </div>
    );
}

export default function ILPage() {
    return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-12 h-12 text-red-600 animate-spin"/></div>}><ILForm /></Suspense>;
}