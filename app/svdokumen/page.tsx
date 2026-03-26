"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Search, FileDown, FolderOpen, Plus, UploadCloud, Edit, Trash2, CheckCircle, XCircle, ArrowLeft, ExternalLink, FileText } from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';

import { fetchDokumenToko, submitDokumenToko, updateDokumenToko, deleteDokumenToko } from '@/lib/api';

// Tambahan Import jsPDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const UPLOAD_CATEGORIES = [
    { key: "fotoExisting", label: "Foto Toko Existing" },
    { key: "fotoRenovasi", label: "Foto Proses Renovasi" },
    { key: "me", label: "Gambar ME" },
    { key: "sipil", label: "Gambar Sipil" },
    { key: "sketsaAwal", label: "Sketsa Awal (Layout)" },
    { key: "spk", label: "Dokumen SPK" },
    { key: "rab", label: "Dokumen RAB & Penawaran" },
    { key: "instruksiLapangan", label: "Instruksi Lapangan" },
    { key: "pengawasan", label: "Berkas Pengawasan" },
    { key: "aanwijzing", label: "Aanwijzing / BAST" },
    { key: "kerjaTambahKurang", label: "Kerja Tambah Kurang" },
    { key: "pendukung", label: "Dokumen Pendukung (NIDI, SLO, dll)" }
];

type ExistingFile = { category: string, name: string, url: string, originalEntry: string };

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export default function DokumenPage() {
    const router = useRouter();

    const [userInfo, setUserInfo] = useState({ name: '', role: '', cabang: '', email: '' });
    const [activeView, setActiveView] = useState<'list' | 'form'>('list');
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [documents, setDocuments] = useState<any[]>([]);
    
    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCabang, setFilterCabang] = useState('');
    const [filterStatus, setFilterStatus] = useState(''); 
    
    // State Form & File Upload
    const [isEditing, setIsEditing] = useState(false);
    const [currentEditId, setCurrentEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ 
        kodeToko: '', namaToko: '', cabang: '',
        luasSales: '', luasParkir: '', luasGudang: '', 
        luasLantai1: '', luasLantai2: '', luasLantai3: '', 
        totalLuas: '', luasAreaTerbuka: '', tinggiPlafon: ''
    });
    
    const [fileBuffer, setFileBuffer] = useState<Record<string, File[]>>({});
    const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([]);
    const [deletedFiles, setDeletedFiles] = useState<ExistingFile[]>([]);

    useEffect(() => {
        const isAuth = sessionStorage.getItem("authenticated");
        const role = sessionStorage.getItem("userRole");
        const email = sessionStorage.getItem("loggedInUserEmail") || '';
        const cabang = sessionStorage.getItem("loggedInUserCabang") || '';

        if (isAuth !== "true" || !role) { router.push('/auth'); return; }

        setUserInfo({ name: email.split('@')[0].toUpperCase(), role, cabang, email });
        setForm(prev => ({ ...prev, cabang: cabang }));

        loadDocuments(cabang);
    }, [router]);

    const loadDocuments = async (cabang: string) => {
        setIsLoading(true);
        try {
            const rawData = await fetchDokumenToko(cabang);
            let parsedData = [];
            if (Array.isArray(rawData)) parsedData = rawData;
            else if (rawData.items && Array.isArray(rawData.items)) parsedData = rawData.items;
            else if (rawData.data && Array.isArray(rawData.data)) parsedData = rawData.data;
            
            setDocuments(parsedData);
        } catch (error: any) {
            console.error(error);
            alert("Gagal memuat dokumen: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto sum Luas Bangunan
    useEffect(() => {
        const parseNum = (val: string) => {
            if (!val) return 0;
            return parseFloat(val.toString().replace(/\./g, '').replace(',', '.')) || 0;
        };
        const total = parseNum(form.luasLantai1) + parseNum(form.luasLantai2) + parseNum(form.luasLantai3);
        setForm(prev => ({ ...prev, totalLuas: total > 0 ? total.toFixed(2).replace('.', ',') : '' }));
    }, [form.luasLantai1, form.luasLantai2, form.luasLantai3]);

    // Parsing data file lama
    const parseExistingFiles = (fileLinksString: string | null) => {
        if (!fileLinksString) return [];
        return fileLinksString.split(',').map(s => s.trim()).filter(Boolean).map(entry => {
            const parts = entry.split('|');
            if (parts.length === 3) return { category: parts[0].trim(), name: parts[1].trim(), url: parts[2].trim(), originalEntry: entry };
            if (parts.length === 2) return { category: 'pendukung', name: parts[0].trim(), url: parts[1].trim(), originalEntry: entry };
            return { category: 'pendukung', name: 'File', url: entry.trim(), originalEntry: entry };
        });
    };

    const openCreateForm = () => {
        setIsEditing(false); setCurrentEditId(null);
        setForm({ kodeToko: '', namaToko: '', cabang: userInfo.cabang, luasSales: '', luasParkir: '', luasGudang: '', luasLantai1: '', luasLantai2: '', luasLantai3: '', totalLuas: '', luasAreaTerbuka: '', tinggiPlafon: '' });
        setFileBuffer({}); setExistingFiles([]); setDeletedFiles([]); 
        setActiveView('form');
    };

    const openEditForm = (doc: any) => {
        setIsEditing(true); setCurrentEditId(doc._id || doc.id || doc.kode_toko);
        setForm({ 
            kodeToko: doc.kode_toko || '', namaToko: doc.nama_toko || '', cabang: doc.cabang || userInfo.cabang,
            luasSales: doc.luas_sales || '', luasParkir: doc.luas_parkir || '', luasGudang: doc.luas_gudang || '',
            luasLantai1: doc.luas_bangunan_lantai_1 || '', luasLantai2: doc.luas_bangunan_lantai_2 || '', luasLantai3: doc.luas_bangunan_lantai_3 || '',
            totalLuas: doc.total_luas_bangunan || '', luasAreaTerbuka: doc.luas_area_terbuka || '', tinggiPlafon: doc.tinggi_plafon || ''
        });
        
        setExistingFiles(parseExistingFiles(doc.file_links));
        setFileBuffer({}); setDeletedFiles([]); 
        setActiveView('form');
    };

    const handleFileChange = (categoryKey: string, files: FileList | null) => {
        if (!files) return;
        setFileBuffer(prev => ({ ...prev, [categoryKey]: [...(prev[categoryKey] || []), ...Array.from(files)] }));
    };

    const handleDeleteExistingFile = (fileObj: ExistingFile) => {
        if (!confirm(`Hapus file ${fileObj.name}?`)) return;
        setDeletedFiles(prev => [...prev, fileObj]);
        setExistingFiles(prev => prev.filter(f => f.originalEntry !== fileObj.originalEntry));
    };

    const handleDelete = async (kode_toko: string) => {
        if (!confirm(`Hapus data toko ${kode_toko} permanen?`)) return;
        setIsLoading(true);
        try {
            await deleteDokumenToko(kode_toko);
            alert("Berhasil dihapus!");
            loadDocuments(userInfo.cabang);
        } catch (err: any) { alert(err.message); setIsLoading(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload: any = {
                kode_toko: form.kodeToko, nama_toko: form.namaToko, cabang: form.cabang,
                luas_sales: form.luasSales, luas_parkir: form.luasParkir, luas_gudang: form.luasGudang,
                luas_bangunan_lantai_1: form.luasLantai1, luas_bangunan_lantai_2: form.luasLantai2, luas_bangunan_lantai_3: form.luasLantai3,
                total_luas_bangunan: form.totalLuas, luas_area_terbuka: form.luasAreaTerbuka, tinggi_plafon: form.tinggiPlafon,
                email: userInfo.email, pic_name: userInfo.name, files: []
            };

            deletedFiles.forEach(f => {
                payload.files.push({ category: f.category, filename: f.name, deleted: true });
            });

            const filePromises: Promise<void>[] = [];
            Object.keys(fileBuffer).forEach(catKey => {
                fileBuffer[catKey].forEach(file => {
                    const promise = fileToBase64(file).then(base64Str => {
                        payload.files.push({ category: catKey, filename: file.name, type: file.type, data: base64Str });
                    });
                    filePromises.push(promise);
                });
            });

            await Promise.all(filePromises);

            if (isEditing && currentEditId) {
                await updateDokumenToko(currentEditId, payload);
                alert("Data & Lampiran berhasil diupdate!");
            } else {
                await submitDokumenToko(payload);
                alert("Data berhasil ditambahkan!");
            }
            
            loadDocuments(userInfo.cabang);
            setActiveView('list');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getMissingDocuments = (fileLinksString: string | null) => {
        if (!fileLinksString) return UPLOAD_CATEGORIES.map(c => c.label);
        const uploadedLower = fileLinksString.toLowerCase();
        return UPLOAD_CATEGORIES.filter(c => !uploadedLower.includes(c.key.toLowerCase())).map(c => c.label);
    };

    const isHeadOffice = userInfo.cabang.toLowerCase() === 'head office';
    
    const uniqueCabangs = useMemo(() => {
        const set = new Set(documents.map(d => d.cabang).filter(Boolean));
        return Array.from(set).sort();
    }, [documents]);

    const filteredDocuments = documents.filter(doc => {
        const textMatch = String(doc.kode_toko || '').toLowerCase().includes(searchQuery.toLowerCase()) || String(doc.nama_toko || '').toLowerCase().includes(searchQuery.toLowerCase());
        const cabangMatch = filterCabang === '' || doc.cabang === filterCabang;
        
        const missing = getMissingDocuments(doc.file_links);
        const isComplete = missing.length === 0;
        
        let statusMatch = true;
        if (filterStatus === 'lengkap') statusMatch = isComplete;
        if (filterStatus === 'kurang') statusMatch = !isComplete;

        return textMatch && cabangMatch && statusMatch;
    });

    const stats = useMemo(() => {
        let complete = 0; let incomplete = 0;
        documents.forEach(doc => {
            getMissingDocuments(doc.file_links).length === 0 ? complete++ : incomplete++;
        });
        return { total: documents.length, complete, incomplete };
    }, [documents]);

    // ==========================================
    // EXPORT PDF (DIKEMBALIKAN & DISEMPURNAKAN)
    // ==========================================
    const handleExportPDF = () => {
        if (!filteredDocuments.length) return alert("Tidak ada data untuk diexport");

        const doc = new jsPDF('l', 'mm', 'a4');
        const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        let completeCount = 0;
        let incompleteCount = 0;

        const tableRows = filteredDocuments.map((docItem, index) => {
            const missingList = getMissingDocuments(docItem.file_links);
            const isComplete = missingList.length === 0;

            if (isComplete) completeCount++; else incompleteCount++;

            const statusText = isComplete ? "Sudah Lengkap" : "Belum Lengkap";
            const missingText = isComplete ? "-" : missingList.join(', ');
            const waktuUpdate = docItem.timestamp || docItem.updated_at || "-";
            const editor = docItem.last_edit || docItem.pic_name || "-";

            return [
                index + 1,
                docItem.kode_toko || "-",
                docItem.nama_toko || "-",
                docItem.cabang || "-",
                statusText,
                missingText,
                waktuUpdate,
                editor
            ];
        });

        // 1. HEADER PDF
        doc.setFontSize(16);
        doc.text("Laporan Status Dokumen Toko", 14, 15);

        doc.setFontSize(10);
        doc.text(`Tanggal Cetak: ${today}`, 14, 22);
        
        const activeCabangLabel = filterCabang || (isHeadOffice ? 'Semua Cabang' : userInfo.cabang);
        doc.text(`Filter Cabang: ${activeCabangLabel}`, 14, 27);

        // 2. KOTAK SUMMARY (TOTAL)
        doc.setDrawColor(0);
        doc.setFillColor(240, 240, 240);
        doc.rect(14, 32, 100, 20, 'F');

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total Toko: ${filteredDocuments.length}`, 18, 38);

        doc.setTextColor(0, 100, 0); // Hijau
        doc.text(`Sudah Lengkap: ${completeCount}`, 18, 43);

        doc.setTextColor(200, 0, 0); // Merah
        doc.text(`Belum Lengkap: ${incompleteCount}`, 18, 48);

        doc.setTextColor(0, 0, 0); // Reset ke hitam

        // 3. RENDER TABEL
        autoTable(doc, {
            startY: 55,
            head: [['No', 'Kode', 'Nama Toko', 'Cabang', 'Status', 'Detail Kekurangan', 'Update Terakhir', 'Editor']],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], valign: 'middle', halign: 'center' },
            styles: { fontSize: 8, valign: 'top' },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' }, 
                1: { cellWidth: 15 }, 
                2: { cellWidth: 40 }, 
                3: { cellWidth: 20 }, 
                4: { cellWidth: 25 }, 
                5: { cellWidth: 80 }, 
                6: { cellWidth: 35 }, 
                7: { cellWidth: 'auto' } 
            },
            didParseCell: function (data) {
                // Mewarnai Teks Kolom Status
                if (data.section === 'body' && data.column.index === 4) {
                    if (data.cell.raw === 'Belum Lengkap') {
                        data.cell.styles.textColor = [200, 0, 0];
                        data.cell.styles.fontStyle = 'bold';
                    } else {
                        data.cell.styles.textColor = [0, 100, 0];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        const dateStr = new Date().toISOString().slice(0, 10);
        doc.save(`Laporan_Dokumen_${activeCabangLabel.replace(/\s+/g, '_')}_${dateStr}.pdf`);
    };

    // ==========================================
    // EXPORT CSV
    // ==========================================
    const handleExportCSV = () => {
        if (!filteredDocuments.length) return alert("Tidak ada data untuk diexport");
        const headers = ['No', 'Kode Toko', 'Nama Toko', 'Cabang', 'Status Kelengkapan', 'Jumlah Kekurangan', 'Waktu Update', 'Terakhir Diedit', 'Link Folder'];
        
        const rows = filteredDocuments.map((doc, i) => {
            const missing = getMissingDocuments(doc.file_links);
            const status = missing.length === 0 ? 'Sudah Lengkap' : 'Belum Lengkap';
            const folderUrl = doc.folder_link || doc.folder_drive || doc.folder_url || "-";
            return [
                i + 1, `"${String(doc.kode_toko || "")}"`, `"${String(doc.nama_toko || "")}"`, `"${String(doc.cabang || "")}"`,
                `"${status}"`, `"${missing.length} Item"`, `"${doc.timestamp || "-"}"`, `"${doc.last_edit || doc.pic_name || "-"}"`, `"${folderUrl}"`
            ];
        });

        const csvContent = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `Data_Dokumen_${filterCabang || userInfo.cabang}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">
            <AppNavbar
                title="PENYIMPANAN DOKUMEN TOKO"
                showBackButton
                backHref="/dashboard"
            />

            <main className="max-w-350 mx-auto p-4 md:p-8 mt-4">
                
                {/* VIEW 1: LIST DATA */}
                {activeView === 'list' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <Card className="border-l-4 border-l-blue-500 shadow-sm"><CardContent className="p-6">
                                <p className="text-sm font-bold text-slate-500 uppercase">Total Data Toko</p>
                                <p className="text-3xl font-extrabold text-slate-800">{stats.total}</p>
                            </CardContent></Card>
                            <Card className="border-l-4 border-l-green-500 shadow-sm"><CardContent className="p-6">
                                <p className="text-sm font-bold text-slate-500 uppercase">Sudah Lengkap</p>
                                <p className="text-3xl font-extrabold text-green-600">{stats.complete}</p>
                            </CardContent></Card>
                            <Card className="border-l-4 border-l-red-500 shadow-sm"><CardContent className="p-6">
                                <p className="text-sm font-bold text-slate-500 uppercase">Belum Lengkap</p>
                                <p className="text-3xl font-extrabold text-red-600">{stats.incomplete}</p>
                            </CardContent></Card>
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                                <div className="relative w-full md:w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" placeholder="Cari Kode / Nama Toko..." className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                </div>
                                
                                <select className="w-full md:w-48 p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium text-slate-700 cursor-pointer" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                    <option value="">Semua Status</option>
                                    <option value="lengkap">Sudah Lengkap</option>
                                    <option value="kurang">Belum Lengkap</option>
                                </select>

                                {isHeadOffice && (
                                    <select className="w-full md:w-56 p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium text-slate-700 cursor-pointer" value={filterCabang} onChange={(e) => setFilterCabang(e.target.value)}>
                                        <option value="">Semua Cabang (Nasional)</option>
                                        {uniqueCabangs.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                )}
                            </div>
                            
                            <div className="flex gap-3 w-full md:w-auto">
                                {/* TOMBOL BARU: EXPORT PDF */}
                                <Button onClick={handleExportPDF} variant="outline" className="flex-1 md:flex-none border-red-600 text-red-700 hover:bg-red-50 font-bold"><FileText className="w-4 h-4 mr-2"/> Export PDF</Button>
                                <Button onClick={handleExportCSV} variant="outline" className="flex-1 md:flex-none border-green-600 text-green-700 hover:bg-green-50 font-bold"><FileDown className="w-4 h-4 mr-2"/> Export CSV</Button>
                                
                                {!isHeadOffice && (
                                    <Button onClick={openCreateForm} className="flex-1 md:flex-none bg-red-600 hover:bg-red-700 font-bold shadow-md"><Plus className="w-4 h-4 mr-2"/> Tambah Dokumen</Button>
                                )}
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-red-600 mb-4" /><p className="text-slate-500">Mencari data dokumen...</p></div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-800 text-white">
                                            <tr>
                                                <th className="p-4 w-16 text-center">No</th>
                                                <th className="p-4 text-center">Toko (Kode & Nama)</th>
                                                <th className="p-4 text-center">Status</th>
                                                <th className="p-4 text-center">Detail Kekurangan</th>
                                                <th className="p-4 text-center w-32">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredDocuments.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500 italic">Belum ada data dokumen tersimpan.</td></tr> : filteredDocuments.map((doc, idx) => {
                                                const missing = getMissingDocuments(doc.file_links);
                                                const isComplete = missing.length === 0;
                                                const folderUrl = doc.folder_link || doc.folder_drive || doc.folder_url || "";
                                                return (
                                                    <tr key={doc._id || doc.id || `${doc.kode_toko}-${idx}`} className="hover:bg-slate-50">
                                                        <td className="p-4 text-center font-medium text-slate-500">{idx + 1}</td>
                                                        <td className="p-4">
                                                            <div className="font-bold text-slate-800 text-base">{doc.nama_toko}</div>
                                                            <div className="text-slate-500 font-medium">{doc.kode_toko} • {doc.cabang}</div>
                                                            {folderUrl && <a href={folderUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-xs mt-1 block font-semibold hover:underline">Buka Folder GDrive</a>}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            {isComplete 
                                                                ? <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1"/> Lengkap</Badge>
                                                                : <Badge className="bg-red-100 text-red-700 border-red-200 tooltip" title={missing.join(', ')}><XCircle className="w-3 h-3 mr-1"/> Kurang ({missing.length})</Badge>
                                                            }
                                                        </td>
                                                        <td className="p-4">
                                                            {isComplete ? <span className="text-slate-400 italic text-xs block text-center">-</span> : (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {missing.map((m, i) => <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded border border-slate-200">{m}</span>)}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className="flex flex-col gap-1.5">
                                                                <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 h-7 text-xs" onClick={() => openEditForm(doc)}><Edit className="w-3 h-3 mr-1"/> {isHeadOffice ? 'Lihat' : 'Edit'}</Button>
                                                                {!isHeadOffice && <Button size="sm" variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 h-7 text-xs" onClick={() => handleDelete(doc.kode_toko)}><Trash2 className="w-3 h-3 mr-1"/> Hapus</Button>}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* VIEW 2: FORM TAMBAH / EDIT DOKUMEN & LIHAT FILE */}
                {activeView === 'form' && (
                    <div className="animate-in fade-in zoom-in-95 duration-300 max-w-5xl mx-auto">
                        <Button variant="ghost" className="mb-4 text-slate-500 hover:text-slate-800 px-0" onClick={() => setActiveView('list')}>
                            <ArrowLeft className="w-4 h-4 mr-2" /> Batal & Kembali
                        </Button>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <Card className="shadow-sm border-slate-200">
                                <div className="p-6 border-b border-slate-100 bg-white rounded-t-xl flex items-center gap-3">
                                    <div className="p-2 bg-red-50 text-red-600 rounded-lg"><FolderOpen className="w-6 h-6"/></div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">{isEditing ? (isHeadOffice ? 'Detail Arsip Dokumen Toko' : 'Update & Tambah Dokumen') : 'Buat Arsip Toko Baru'}</h2>
                                    </div>
                                </div>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700">Kode Toko *</label>
                                            <input type="text" required disabled={isEditing || isHeadOffice} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500 font-bold uppercase disabled:bg-slate-100 disabled:text-slate-500" value={form.kodeToko} onChange={(e) => setForm({...form, kodeToko: e.target.value.toUpperCase()})} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700">Nama Toko *</label>
                                            <input type="text" required disabled={isEditing || isHeadOffice} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500 font-bold uppercase disabled:bg-slate-100 disabled:text-slate-500" value={form.namaToko} onChange={(e) => setForm({...form, namaToko: e.target.value.toUpperCase()})} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700">Cabang</label>
                                            <input type="text" required readOnly className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-100 font-semibold text-slate-500" value={form.cabang} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500">Luas Sales</label><input type="text" disabled={isHeadOffice} className="w-full p-2 border rounded text-sm disabled:bg-slate-100" value={form.luasSales} onChange={e=>setForm({...form, luasSales: e.target.value})} /></div>
                                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500">Luas Gudang</label><input type="text" disabled={isHeadOffice} className="w-full p-2 border rounded text-sm disabled:bg-slate-100" value={form.luasGudang} onChange={e=>setForm({...form, luasGudang: e.target.value})} /></div>
                                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500">Luas Parkir</label><input type="text" disabled={isHeadOffice} className="w-full p-2 border rounded text-sm disabled:bg-slate-100" value={form.luasParkir} onChange={e=>setForm({...form, luasParkir: e.target.value})} /></div>
                                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500">Tinggi Plafon</label><input type="text" disabled={isHeadOffice} className="w-full p-2 border rounded text-sm disabled:bg-slate-100" value={form.tinggiPlafon} onChange={e=>setForm({...form, tinggiPlafon: e.target.value})} /></div>
                                        
                                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500">Luas LT. 1</label><input type="text" disabled={isHeadOffice} className="w-full p-2 border rounded text-sm disabled:bg-slate-100" value={form.luasLantai1} onChange={e=>setForm({...form, luasLantai1: e.target.value})} /></div>
                                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500">Luas LT. 2</label><input type="text" disabled={isHeadOffice} className="w-full p-2 border rounded text-sm disabled:bg-slate-100" value={form.luasLantai2} onChange={e=>setForm({...form, luasLantai2: e.target.value})} /></div>
                                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500">Luas LT. 3</label><input type="text" disabled={isHeadOffice} className="w-full p-2 border rounded text-sm disabled:bg-slate-100" value={form.luasLantai3} onChange={e=>setForm({...form, luasLantai3: e.target.value})} /></div>
                                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500">Total Luas</label><input type="text" readOnly className="w-full p-2 border rounded text-sm bg-blue-50 font-bold text-blue-800" value={form.totalLuas} /></div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm border-slate-200 bg-slate-50/50">
                                <CardContent className="p-6">
                                    <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Status & Kelengkapan Dokumen</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {UPLOAD_CATEGORIES.map((cat) => {
                                            const catFiles = existingFiles.filter(f => f.category === cat.key);
                                            
                                            return (
                                                <div key={cat.key} className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between hover:border-red-300 transition-colors">
                                                    <label className="text-sm font-bold text-slate-700 mb-2 leading-tight block">
                                                        {cat.label}
                                                    </label>

                                                    {catFiles.length > 0 && (
                                                        <div className="mb-3 space-y-2">
                                                            {catFiles.map((f, i) => (
                                                                <div key={i} className="flex justify-between items-center bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                                                                    <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-700 text-xs font-semibold truncate hover:underline flex items-center">
                                                                        <ExternalLink className="w-3 h-3 mr-1 shrink-0" />
                                                                        {f.name}
                                                                    </a>
                                                                    {!isHeadOffice && (
                                                                        <button type="button" onClick={() => handleDeleteExistingFile(f)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded" title="Hapus File Ini">
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {!isHeadOffice && (
                                                        <div className="relative mt-auto">
                                                            <input 
                                                                type="file" multiple accept="image/*,application/pdf"
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                                onChange={(e) => handleFileChange(cat.key, e.target.files)}
                                                            />
                                                            <div className={`w-full p-2.5 border-2 border-dashed rounded-lg flex items-center justify-center text-xs font-semibold ${fileBuffer[cat.key]?.length ? 'border-green-400 bg-green-50 text-green-700' : 'border-slate-300 text-slate-500 bg-slate-50 hover:bg-slate-100'}`}>
                                                                <UploadCloud className={`w-4 h-4 mr-2 ${fileBuffer[cat.key]?.length ? 'text-green-600' : 'text-slate-400'}`} />
                                                                {fileBuffer[cat.key]?.length ? `${fileBuffer[cat.key].length} File Baru Siap Upload` : '+ Tambah File'}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>

                            {!isHeadOffice && (
                                <Button type="submit" disabled={isSubmitting} className="w-full h-14 bg-red-600 hover:bg-red-700 text-lg font-bold shadow-lg">
                                    {isSubmitting ? <><Loader2 className="w-6 h-6 mr-2 animate-spin"/> Sedang Menyimpan ke Server...</> : <><Save className="w-6 h-6 mr-2"/> Simpan Data & Upload Lampiran</>}
                                </Button>
                            )}
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}