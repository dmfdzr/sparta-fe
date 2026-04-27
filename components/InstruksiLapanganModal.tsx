"use client"

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import LoadingOverlay from '@/components/LoadingOverlay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, Loader2, Upload, X, FileText } from 'lucide-react';
import { fetchTokoList, fetchTokoDetail, fetchPricesData, submitInstruksiLapangan, fetchInstruksiLapanganList, fetchInstruksiLapanganDetail } from '@/lib/api';

const toRupiah = (num: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num || 0);
const formatAngka = (num: number) => (num || num === 0) ? num.toLocaleString('id-ID') : '0';

export default function InstruksiLapanganModal({ onClose, onSuccess, initialTokoId }: { onClose: () => void, onSuccess: () => void, initialTokoId?: number }) {
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
    const [isTokoLoading, setIsTokoLoading] = useState(false);
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
            const filtered = res.data.filter((t: any) => (t.cabang || "").toUpperCase() === userCabang);
            setTokoList(filtered);
        }).catch(err => {
            console.error(err);
            showAlert("Error", "Gagal memuat daftar toko", "error");
        });
    }, [router]);

    useEffect(() => {
        if (initialTokoId && tokoList.length > 0 && !selectedToko) {
            handleTokoChange(String(initialTokoId));
        }
    }, [initialTokoId, tokoList]);

    const handleTokoChange = async (tokoIdStr: string) => {
        const tokoId = Number(tokoIdStr);
        const tokoItem = tokoList.find(t => t.id === tokoId);
        if (!tokoItem) return;

        setIsTokoLoading(true);
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
                            isKondisional: isMatCond || isUpahCond,
                            catatan: it.catatan || '',
                        };
                    });
                    
                    setTableRows(newTableRows);
                    
                    if (detailRes.data?.link_lampiran) {
                        setLampiranFileName("File Lampiran (dari revisi)");
                    }
                    
                    showAlert("Info", "Memuat data Instruksi Lapangan yang ditolak sebelumnya untuk revisi.", "info");
                }
            }
        } catch (error: any) {
            showAlert("Error", error.message, "error");
        } finally {
            setIsTokoLoading(false);
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
        setTableRows(prev => [...prev, { id: Date.now() + Math.random(), category, jenisPekerjaan: '', satuan: '', volume: 0, hargaMaterial: 0, hargaUpah: 0, isKondisional: false, catatan: '' }]);
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
                        
                        updatedRow.isKondisional = isMatCond || isUpahCond;
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

    const { totalEstimasi, pembulatan, ppn, grandTotal, isBatamBranch } = React.useMemo(() => {
        let total = 0;
        tableRows.forEach(row => {
            const v = Number(row.volume) || 0;
            const m = Number(row.hargaMaterial) || 0;
            const u = Number(row.hargaUpah) || 0;
            total += v * (m + u);
        });
        const isBatam = (cabang || "").toUpperCase() === "BATAM";
        const rounded = Math.floor(total / 10000) * 10000;
        const tax = isBatam ? 0 : rounded * 0.11;
        const grand = rounded + tax;
        return { totalEstimasi: total, pembulatan: rounded, ppn: tax, grandTotal: grand, isBatamBranch: isBatam };
    }, [tableRows, cabang]);

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
                harga_upah: Number(row.hargaUpah),
                catatan: row.catatan || ''
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
            setTimeout(() => { onSuccess(); }, 1500);
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-6">
            <div className="bg-slate-50 flex flex-col rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden animate-in zoom-in-95">
                {/* Modal Header */}
                <div className="p-4 md:p-5 border-b flex justify-between items-center bg-white shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-xl text-slate-800 leading-tight">Instruksi Lapangan</h2>
                            <p className="text-sm text-slate-500 font-medium">Buat pengajuan instruksi lapangan baru</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Modal Content (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                    <LoadingOverlay isVisible={isTokoLoading} title="Memuat Data Toko..." subtitle="Menyiapkan detail & item pekerjaan" />
                    <form onSubmit={handleSubmit}>
                        <Card className="mb-8 shadow-sm">
                            <CardHeader className="border-b bg-slate-50/50 pb-4">
                                <CardTitle className="text-red-700">Identitas Toko</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Pilih Toko <span className="text-red-500">*</span></Label>
                                        <Select onValueChange={handleTokoChange} value={selectedToko ? String(selectedToko.id) : undefined} disabled={!!initialTokoId} required>
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder="-- Pilih Toko Berdasarkan Cabang --" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {tokoList.map((toko: any) => (
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
                                    const subTotal = itemsInCategory.reduce((acc, row) => acc + (row.volume * (row.hargaMaterial + row.hargaUpah)), 0);
                                    const selectedJobs = itemsInCategory.map(r => r.jenisPekerjaan).filter(Boolean);

                                    return (
                                        <Card key={category} className="overflow-hidden border-slate-200 shadow-sm">
                                            <div className="bg-slate-100 p-4 border-b flex justify-between items-center">
                                                <h3 className="font-bold text-red-700">{category}</h3>
                                            </div>
                                            {itemsInCategory.length > 0 && (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm text-left border-collapse min-w-[1000px]">
                                                        <thead className="bg-red-50 text-red-700 text-xs text-center border-b border-red-200">
                                                            <tr>
                                                                <th rowSpan={2} className="p-2 border border-red-100 w-10">No</th>
                                                                <th rowSpan={2} className="p-2 border border-red-100 min-w-50">Jenis Pekerjaan</th>
                                                                <th rowSpan={2} className="p-2 border border-red-100 w-16">Satuan</th>
                                                                <th rowSpan={2} className="p-2 border border-red-100 w-24">Volume (a)</th>
                                                                <th colSpan={2} className="p-2 border border-red-100">Harga Satuan (Rp)</th>
                                                                <th colSpan={2} className="p-2 border border-red-100">Total Harga Satuan (Rp)</th>
                                                                <th rowSpan={2} className="p-2 border border-red-100 w-36">Total Harga (Rp)<br/><span className="font-normal">(f=d+e)</span></th>
                                                                <th rowSpan={2} className="p-2 border border-red-100 w-48">Catatan Tambahan<br/><span className="font-normal">(Opsional)</span></th>
                                                                <th rowSpan={2} className="p-2 border border-red-100 w-16">Aksi</th>
                                                            </tr>
                                                            <tr>
                                                                <th className="p-2 border border-red-100 w-32 bg-red-50/50">Material (b)</th>
                                                                <th className="p-2 border border-red-100 w-32 bg-red-50/50">Upah (c)</th>
                                                                <th className="p-2 border border-red-100 w-32 bg-red-50/50">Material (d=a×b)</th>
                                                                <th className="p-2 border border-red-100 w-32 bg-red-50/50">Upah (e=a×c)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {itemsInCategory.map((row, index) => (
                                                                <tr key={row.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                                                                    <td className="p-2 border-r border-slate-100 text-center font-medium text-slate-500">{index + 1}</td>
                                                                    <td className="p-2 border-r border-slate-100">
                                                                        <select className="w-full p-2 border border-slate-300 rounded-md bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-xs" value={row.jenisPekerjaan} onChange={(e) => updateRow(row.id, 'jenisPekerjaan', e.target.value)}>
                                                                            <option value="">-- Pilih --</option>
                                                                            {prices[category]?.map((p: any) => {
                                                                                const jobName = p["Jenis Pekerjaan"];
                                                                                const isSelectedElsewhere = selectedJobs.includes(jobName) && row.jenisPekerjaan !== jobName;
                                                                                return <option key={jobName} value={jobName} title={jobName} disabled={isSelectedElsewhere} className={isSelectedElsewhere ? "text-slate-300 bg-slate-50" : ""}>{jobName}</option>;
                                                                            })}
                                                                        </select>
                                                                    </td>
                                                                    <td className="p-2 border-r border-slate-100 text-center text-slate-600 font-medium">{row.satuan}</td>
                                                                    <td className="p-2 border-r border-slate-100">
                                                                        <Input type="number" min="0" step="any" className={`h-9 px-2 text-center transition-colors text-xs ${row.satuan === 'Ls' ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-white border-slate-300 focus-visible:ring-blue-500 font-medium text-slate-800'}`} value={row.volume === 0 ? 0 : row.volume} onChange={(e) => updateRow(row.id, 'volume', Math.max(0, parseFloat(e.target.value) || 0))} readOnly={row.satuan === 'Ls'} />
                                                                    </td>
                                                                    <td className="p-2 border-r border-slate-100">
                                                                        <Input type="text" className="h-9 px-2 text-right transition-colors text-xs bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200" value={formatAngka(row.hargaMaterial)} readOnly tabIndex={-1} />
                                                                    </td>
                                                                    <td className="p-2 border-r border-slate-100">
                                                                        <Input type="text" className={`h-9 px-2 text-right transition-colors text-xs ${!row.isKondisional ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-yellow-50 border-yellow-300 focus-visible:ring-yellow-500 text-yellow-900 font-bold'}`} value={formatAngka(row.hargaUpah)} onChange={(e) => updateRow(row.id, 'hargaUpah', parseFloat(e.target.value.replace(/\./g, '')) || 0)} readOnly={!row.isKondisional} />
                                                                    </td>
                                                                    <td className="p-2 border-r border-slate-100 bg-slate-50 text-right text-slate-600 font-medium text-xs">{toRupiah(row.volume * row.hargaMaterial)}</td>
                                                                    <td className="p-2 border-r border-slate-100 bg-slate-50 text-right text-slate-600 font-medium text-xs">{toRupiah(row.volume * row.hargaUpah)}</td>
                                                                    <td className="p-2 border-r border-slate-100 text-right font-bold text-slate-800 bg-slate-100 text-xs">{toRupiah(row.volume * (row.hargaMaterial + row.hargaUpah))}</td>
                                                                    <td className="p-2 border-r border-slate-100">
                                                                        <Input type="text" placeholder="Catatan..." className="h-9 px-2 text-xs bg-white border-slate-300 focus-visible:ring-blue-500" value={row.catatan || ''} onChange={(e) => updateRow(row.id, 'catatan', e.target.value)} />
                                                                    </td>
                                                                    <td className="p-2 text-center">
                                                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeRow(row.id)}>
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </Button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                                            <tr>
                                                                <td colSpan={11} className="p-3 text-center bg-white border-b border-slate-200">
                                                                    <Button type="button" size="sm" variant="outline" className="h-8 bg-white border-dashed border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 w-full max-w-sm" onClick={() => addRow(category)}>
                                                                        <Plus className="w-4 h-4 mr-1" /> Tambah Item Pekerjaan
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td colSpan={8} className="p-3 text-right font-bold text-slate-600">Sub Total {category}:</td>
                                                                <td className="p-3 text-right font-bold text-red-700 whitespace-nowrap">{toRupiah(subTotal)}</td>
                                                                <td colSpan={2}></td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            )}
                                            {itemsInCategory.length === 0 && (
                                                <div className="p-6 text-center">
                                                    <Button type="button" size="sm" variant="outline" className="h-8 bg-white border-dashed border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400" onClick={() => addRow(category)}>
                                                        <Plus className="w-4 h-4 mr-1" /> Tambah Item Pekerjaan
                                                    </Button>
                                                </div>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                        )}

                        {selectedToko && tableRows.length > 0 && (
                            <div className="bg-yellow-50/50 border border-yellow-200 rounded-xl p-6 mb-8 mt-4 shadow-sm">
                                <div className="space-y-3 text-sm text-slate-600">
                                    <div className="flex justify-between items-center">
                                        <span>Total Estimasi :</span>
                                        <span className="font-semibold text-slate-800">{toRupiah(totalEstimasi)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Pembulatan :</span>
                                        <span className="font-semibold text-slate-800">{toRupiah(pembulatan)}</span>
                                    </div>
                                    {!isBatamBranch && (
                                        <div className="flex justify-between items-center">
                                            <span>PPN (11%) :</span>
                                            <span className="font-semibold text-slate-800">{toRupiah(ppn)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 pt-4 border-t border-yellow-300 flex justify-between items-center">
                                    <span className="font-bold text-slate-800 text-lg">GRAND TOTAL</span>
                                    <span className="text-2xl font-black text-red-600">{toRupiah(grandTotal)}</span>
                                </div>
                            </div>
                        )}

                        {/* Modal Footer / Actions */}
                        <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-slate-100">
                            <Button type="button" variant="outline" onClick={onClose} className="min-w-30">
                                Batal
                            </Button>
                            <Button type="submit" disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white min-w-35 shadow-md">
                                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : <><Save className="mr-2 h-4 w-4" /> Simpan</>}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Alert Dialog (relative to the modal) */}
                <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
                    <AlertDialogContent className="z-[210]">
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
        </div>
    );
}
