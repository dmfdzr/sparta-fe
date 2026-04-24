"use client"

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppNavbar from '@/components/AppNavbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, Loader2, Upload, X } from 'lucide-react';
import { fetchTokoList, fetchTokoDetail, fetchPricesData, submitInstruksiLapangan, fetchInstruksiLapanganList, fetchInstruksiLapanganDetail } from '@/lib/api';

const toRupiah = (num: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num || 0);

export default function InstruksiLapanganPage() {
    const router = useRouter();

    const [cabang, setCabang] = useState('');
    const [tokoList, setTokoList] = useState<any[]>([]);
    const [selectedToko, setSelectedToko] = useState<any>(null);
    const [prices, setPrices] = useState<any>({});
    const [tableRows, setTableRows] = useState<any[]>([]);

    const [lampiranFile, setLampiranFile] = useState<File | null>(null);
    const [lampiranFileName, setLampiranFileName] = useState<string | null>(null);
    const lampiranFileRef = useRef<HTMLInputElement>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [alertOpen, setAlertOpen] = useState(false);
    const [alertMessage, setAlertMessage] = useState<{title: string, desc: string, type: 'info' | 'error' | 'success' | 'warning'}>({ title: "", desc: "", type: "info" });

    useEffect(() => {
        const userCabang = sessionStorage.getItem('loggedInUserCabang')?.toUpperCase();
        if (!userCabang) {
            router.push('/auth');
            return;
        }
        setCabang(userCabang);

        fetchTokoList().then(res => {
            const filtered = res.data.filter(t => (t.cabang || "").toUpperCase() === userCabang);
            setTokoList(filtered);
        }).catch(err => {
            console.error(err);
            showAlert("Error", "Gagal memuat daftar toko", "error");
        });
    }, [router]);

    const handleTokoChange = async (tokoIdStr: string) => {
        const tokoId = Number(tokoIdStr);
        const tokoItem = tokoList.find(t => t.id === tokoId);
        if (!tokoItem) return;

        try {
            // Fetch toko detail based on ID
            const resDetail = await fetchTokoDetail(tokoId);
            const toko = resDetail.data;

            setSelectedToko(toko || null);
            setTableRows([]);
            
            if (toko && toko.lingkup_pekerjaan) {
                let scope = toko.lingkup_pekerjaan;
                if (scope.toUpperCase() === 'SIPIL') scope = 'Sipil';
                if (scope.toUpperCase() === 'ME') scope = 'ME';
                const priceData = await fetchPricesData(cabang, scope);
                setPrices(priceData);

                // Cek apakah ada IL yang ditolak untuk revisi
                const listRes = await fetchInstruksiLapanganList({ nomor_ulok: toko.nomor_ulok });
                const rejectedIL = listRes.data?.find((il: any) => il.status.toUpperCase().includes('DITOLAK'));
                
                if (rejectedIL) {
                    const detailRes = await fetchInstruksiLapanganDetail(rejectedIL.id);
                    const items = detailRes.data?.items || [];
                    
                    const newTableRows = items.map((it: any) => {
                        const itemPriceData = priceData[it.kategori_pekerjaan]?.find((p: any) => p["Jenis Pekerjaan"] === it.jenis_pekerjaan);
                        let isMatCond = false, isUpahCond = false;
                        if (itemPriceData) {
                            isMatCond = itemPriceData["Harga Material"] === "Kondisional";
                            isUpahCond = itemPriceData["Harga Upah"] === "Kondisional";
                        }
                        
                        return {
                            id: Date.now() + Math.random(),
                            category: it.kategori_pekerjaan,
                            jenisPekerjaan: it.jenis_pekerjaan,
                            satuan: it.satuan,
                            volume: Number(it.volume),
                            hargaMaterial: isMatCond ? 0 : Number(it.harga_material),
                            hargaUpah: (isMatCond || isUpahCond) ? 0 : Number(it.harga_upah),
                        };
                    });
                    
                    setTableRows(newTableRows);
                    
                    if (detailRes.data?.link_lampiran) {
                        setLampiranFileName("File Lampiran (dari revisi)");
                    }
                    
                    showAlert("Info", "Memuat data Instruksi Lapangan yang ditolak sebelumnya untuk revisi.", "info");
                }
                }
            }
        } catch (error: any) {
            showAlert("Error", error.message, "error");
        }
    };

    const handleLampiranChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            showAlert("Peringatan", "Ukuran lampiran maksimal 10MB.", "error");
            return;
        }
        setLampiranFile(file);
        setLampiranFileName(file.name);
    };

    const removeLampiran = () => {
        setLampiranFile(null);
        setLampiranFileName(null);
        if (lampiranFileRef.current) lampiranFileRef.current.value = "";
    };

    const addRow = (category: string) => {
        setTableRows(prev => [...prev, { id: Date.now() + Math.random(), category, jenisPekerjaan: '', satuan: '', volume: 0, hargaMaterial: 0, hargaUpah: 0 }]);
    };

    const removeRow = (id: number) => setTableRows(prev => prev.filter(row => row.id !== id));

    const updateRow = (id: number, field: string, value: any) => {
        setTableRows(prev => prev.map(row => {
            if (row.id === id) {
                let updatedRow = { ...row, [field]: value };
                if (field === 'jenisPekerjaan' && value) {
                    const itemData = prices[row.category]?.find((item: any) => item["Jenis Pekerjaan"] === value);
                    if (itemData) {
                        updatedRow.satuan = itemData["Satuan"];
                        const isMatCond = itemData["Harga Material"] === "Kondisional";
                        const isUpahCond = itemData["Harga Upah"] === "Kondisional";
                        
                        updatedRow.hargaMaterial = isMatCond ? 0 : parseFloat(itemData["Harga Material"]) || 0;
                        updatedRow.hargaUpah = (isMatCond || isUpahCond) ? 0 : parseFloat(itemData["Harga Upah"]) || 0;
                        if (updatedRow.satuan === 'Ls') updatedRow.volume = 1;
                    }
                }
                return updatedRow;
            }
            return row;
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedToko) return showAlert("Peringatan", "Silakan pilih Toko terlebih dahulu.", "error");

        const detailItems = tableRows
            .filter(row => row.jenisPekerjaan && row.volume > 0)
            .map(row => ({
                kategori_pekerjaan: row.category,
                jenis_pekerjaan: row.jenisPekerjaan,
                satuan: row.satuan,
                volume: Number(row.volume),
                harga_material: Number(row.hargaMaterial),
                harga_upah: Number(row.hargaUpah)
            }));

        if (detailItems.length === 0) {
            return showAlert("Peringatan", "Minimal harus ada 1 item pekerjaan dengan volume.", "warning");
        }

        setIsLoading(true);

        const fields = {
            nomor_ulok: selectedToko.nomor_ulok,
            email_pembuat: sessionStorage.getItem("loggedInUserEmail") || "",
        };

        try {
            await submitInstruksiLapangan(fields, detailItems, lampiranFile);
            showAlert("Berhasil", "Pengajuan Instruksi Lapangan berhasil disimpan.", "success");
            setTimeout(() => { router.push(`/dashboard`); }, 1500);
        } catch (err: any) {
            setIsLoading(false);
            showAlert("Error", err.message, "error");
        }
    };

    const showAlert = (title: string, desc: string, type: "info" | "error" | "success" | "warning") => {
        setAlertMessage({ title, desc, type }); setAlertOpen(true);
    };

    const categories = Object.keys(prices);

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">
            <AppNavbar 
                title="Instruksi Lapangan"
                showBackButton={true}
                backHref="/dashboard"
            />

            <main className="max-w-7xl mx-auto p-4 md:p-8 mt-4">
                <form onSubmit={handleSubmit}>
                    <Card className="mb-8 shadow-sm">
                        <CardHeader className="border-b bg-slate-50/50 pb-4">
                            <CardTitle className="text-red-700">Identitas Toko</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Pilih Toko <span className="text-red-500">*</span></Label>
                                    <Select onValueChange={handleTokoChange} required>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="-- Pilih Toko Berdasarkan Cabang --" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {tokoList.map(toko => (
                                                <SelectItem key={toko.id} value={String(toko.id)}>
                                                    {toko.nomor_ulok} - {toko.nama_toko} ({toko.lingkup_pekerjaan})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Lampiran Pendukung (Opsional)</Label>
                                    {lampiranFileName ? (
                                        <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                                            <p className="text-sm font-semibold text-green-700 truncate flex-1">{lampiranFileName}</p>
                                            <button type="button" onClick={removeLampiran} className="p-1.5 bg-red-100 text-red-500 rounded-full hover:bg-red-200 transition-colors" title="Hapus file">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-bold text-slate-700 cursor-pointer hover:bg-slate-50 transition-all">
                                            <Upload className="w-4 h-4 text-red-500" />
                                            Pilih File
                                            <input
                                                type="file"
                                                ref={lampiranFileRef}
                                                className="hidden"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={handleLampiranChange}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {selectedToko && categories.length > 0 && (
                        <div className="space-y-6 mb-8">
                            <h2 className="text-xl font-bold text-slate-800 border-b-2 border-red-500 pb-2 inline-block">Detail Instruksi Lapangan</h2>
                            {categories.map((category) => {
                                const itemsInCategory = tableRows.filter(r => r.category === category);
                                const selectedJobs = itemsInCategory.map(r => r.jenisPekerjaan).filter(Boolean);

                                return (
                                    <Card key={category} className="overflow-hidden border-slate-200 shadow-sm">
                                        <div className="bg-slate-100 p-4 border-b flex justify-between items-center">
                                            <h3 className="font-bold text-red-700">{category}</h3>
                                        </div>
                                        {itemsInCategory.length > 0 && (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left border-collapse min-w-max">
                                                    <thead className="bg-red-50 text-red-700 text-xs text-center border-b border-red-200">
                                                        <tr>
                                                            <th className="p-2 border border-red-100">Jenis Pekerjaan</th>
                                                            <th className="p-2 border border-red-100 w-24">Volume</th>
                                                            <th className="p-2 border border-red-100 w-32">Satuan</th>
                                                            <th className="p-2 border border-red-100 w-32">Harga Material</th>
                                                            <th className="p-2 border border-red-100 w-32">Harga Upah</th>
                                                            <th className="p-2 border border-red-100 w-16">Aksi</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {itemsInCategory.map((row) => (
                                                            <tr key={row.id} className="hover:bg-slate-50 border-b border-slate-100">
                                                                <td className="p-2 border-r border-slate-100">
                                                                    <select className="w-full p-2 border border-slate-300 rounded-md bg-white outline-none" value={row.jenisPekerjaan} onChange={(e) => updateRow(row.id, 'jenisPekerjaan', e.target.value)}>
                                                                        <option value="">-- Pilih --</option>
                                                                        {prices[category]?.map((p: any) => {
                                                                            const jobName = p["Jenis Pekerjaan"];
                                                                            const isSelectedElsewhere = selectedJobs.includes(jobName) && row.jenisPekerjaan !== jobName;
                                                                            return <option key={jobName} value={jobName} disabled={isSelectedElsewhere}>{jobName}</option>;
                                                                        })}
                                                                    </select>
                                                                </td>
                                                                <td className="p-2 border-r border-slate-100">
                                                                    <Input type="number" min="0" step="any" className="h-9 px-2 text-center" value={row.volume || ''} onChange={(e) => updateRow(row.id, 'volume', parseFloat(e.target.value) || 0)} readOnly={row.satuan === 'Ls'} />
                                                                </td>
                                                                <td className="p-2 border-r border-slate-100 text-center font-medium">{row.satuan}</td>
                                                                <td className="p-2 border-r border-slate-100 text-right">{toRupiah(row.hargaMaterial)}</td>
                                                                <td className="p-2 border-r border-slate-100 text-right">{toRupiah(row.hargaUpah)}</td>
                                                                <td className="p-2 text-center">
                                                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                        <div className="p-4 bg-white border-t border-slate-100">
                                            <Button type="button" variant="outline" onClick={() => addRow(category)} className="w-full md:w-auto text-blue-600 border-blue-200 hover:bg-blue-50">
                                                <Plus className="w-4 h-4 mr-2" /> Tambah Item {category}
                                            </Button>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex justify-end gap-4 mt-8">
                        <Button type="button" variant="outline" onClick={() => router.push('/dashboard')} className="min-w-[120px]">
                            Batal
                        </Button>
                        <Button type="submit" disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white min-w-[140px]">
                            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : <><Save className="mr-2 h-4 w-4" /> Simpan</>}
                        </Button>
                    </div>
                </form>
            </main>

            <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertMessage.title}</AlertDialogTitle>
                        <AlertDialogDescription>{alertMessage.desc}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setAlertOpen(false)}>OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
