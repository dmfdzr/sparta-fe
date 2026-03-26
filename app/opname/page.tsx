"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, Save, ArrowLeft, Search, FileDown } from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';

import { 
    fetchOpnameStoreList, fetchOpnameItems, fetchOpnamePending, 
    fetchOpnamePenalty, submitOpnameItem, actionOpnameItem,
    checkStatusItemOpname, processSummaryOpname, lockOpnameFinal, uploadOpnameImage,
    fetchOpnameHistory, fetchOpnameRabData, fetchPicList, fetchPicKontraktorData, fetchPicKontraktorOpnameData
} from '@/lib/api';

import { API_URL } from '@/lib/constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- UTILS FORMATTING & PDF HELPER ---
const formatRupiah = (num: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num || 0);
const toNumInput = (v: any) => { if (v === null || v === undefined) return 0; const s = String(v).trim().replace(",", "."); const n = Number(s); return Number.isFinite(n) ? n : 0; };
const toNumID = (v: any) => { if (v === null || v === undefined) return 0; const s = String(v).trim().replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."); const n = Number(s); return Number.isFinite(n) ? n : 0; };
const calculateLatePenalty = (days: number) => {
    if (!days || days <= 0) return 0;
    let totalDenda = 0; const tier1Days = Math.min(days, 5); totalDenda += tier1Days * 1000000;
    if (days > 5) { const remainingDays = days - 5; const tier2Days = Math.min(remainingDays, 10); totalDenda += tier2Days * 500000; }
    return totalDenda;
};

// --- PDF SPECIFIC UTILS ---
const toNumberID_PDF = (v: any) => {
    if (v === null || v === undefined) return 0;
    const s = String(v).trim(); if (!s) return 0;
    const cleaned = s.replace(/[^\d,.-]/g, "");
    const n = Number(cleaned.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
};
const toNumberVol_PDF = (v: any) => {
    if (v === null || v === undefined) return 0;
    let s = String(v).trim(); if (!s) return 0;
    if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
    else if (s.includes(",")) s = s.replace(",", ".");
    const n = Number(s.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
};
const groupDataByCategory = (data: any[]) => {
    const categories: any = {};
    data.forEach((item) => {
        const categoryName = (item.kategori_pekerjaan || "LAINNYA").toUpperCase();
        if (!categories[categoryName]) categories[categoryName] = [];
        categories[categoryName].push(item);
    });
    return categories;
};
const wrapText = (doc: any, text: string, maxWidth: number) => {
    const words = text.split(" "); const lines = []; let currentLine = "";
    for (let word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word;
        if (doc.getTextWidth(testLine) > maxWidth && currentLine) { lines.push(currentLine); currentLine = word; } 
        else { currentLine = testLine; }
    }
    if (currentLine) lines.push(currentLine); return lines;
};
const toBase64 = async (url: string) => {
    try {
        if (!url) return null;
        if (url.startsWith("data:image")) return url;
        if (url.startsWith("/")) {
            const res = await fetch(url); const blob = await res.blob();
            return new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(blob); });
        }
        const cleanUrl = API_URL.replace(/\/$/, "");
        const proxyUrl = `${cleanUrl}/api/image-proxy?url=${encodeURIComponent(url)}`;
        try {
            const response = await fetch(proxyUrl); if (!response.ok) throw new Error('Proxy failed');
            const blob = await response.blob();
            return new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(blob); });
        } catch (e) {
            const response = await fetch(url); const blob = await response.blob();
            return new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(blob); });
        }
    } catch (error) { return null; }
};

export default function OpnamePage() {
    const router = useRouter();
    
    const [userInfo, setUserInfo] = useState({ name: '', role: '', cabang: '', email: '' });
    const [appMode, setAppMode] = useState<'pic' | 'kontraktor' | null>(null); 
    
    const [activeView, setActiveView] = useState<'menu' | 'list' | 'detail' | 'history'>('menu');
    const [menuType, setMenuType] = useState<'input' | 'history'>('input');
    const [isLoading, setIsLoading] = useState(true);
    const [listData, setListData] = useState<any[]>([]); 
    const [searchQuery, setSearchQuery] = useState('');

    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [selectedLingkup, setSelectedLingkup] = useState('SIPIL');
    const [opnameItems, setOpnameItems] = useState<any[]>([]);
    const [historyItems, setHistoryItems] = useState<any[]>([]);
    const [penaltyData, setPenaltyData] = useState({ isLate: false, days: 0, amount: 0 });
    const [processingId, setProcessingId] = useState<number | string | null>(null);
    const [finalStatus, setFinalStatus] = useState({ isFinalized: false, canFinalize: false, message: "Menunggu Approval" });

    // --- 1. AUTHENTICATION & ROLE INIT ---
    useEffect(() => {
        const isAuth = sessionStorage.getItem("authenticated");
        const role = sessionStorage.getItem("userRole");
        const email = sessionStorage.getItem("loggedInUserEmail") || '';
        const cabang = sessionStorage.getItem("loggedInUserCabang") || '';
        const namaLengkap = sessionStorage.getItem("nama_lengkap") || email.split('@')[0];

        if (isAuth !== "true" || !role) { router.push('/auth'); return; }

        setUserInfo({ name: namaLengkap.toUpperCase(), role, cabang, email });
        const picRoles = ['BRANCH BUILDING & MAINTENANCE MANAGER', 'BRANCH BUILDING COORDINATOR', 'BRANCH BUILDING SUPPORT'];
        
        if (role === 'KONTRAKTOR') {
            setAppMode('kontraktor'); 
            loadStoreList(email, 'kontraktor');
        } else if (picRoles.includes(role.toUpperCase())) {
            setAppMode('pic');
            loadStoreList(email, 'pic');
        } else {
            alert("Role tidak memiliki akses ke Opname."); router.push('/dashboard');
        }
    }, [router]);

    // --- 2. FITUR ANTI-REFRESH: SIMPAN JEJAK STATE KE SESSION STORAGE ---
    useEffect(() => {
        if (activeView === 'menu') {
            sessionStorage.removeItem('opname_lastView');
            sessionStorage.removeItem('opname_selectedProject');
        } else {
            sessionStorage.setItem('opname_lastView', activeView);
            sessionStorage.setItem('opname_menuType', menuType);
            sessionStorage.setItem('opname_selectedLingkup', selectedLingkup);
            if (selectedProject) {
                sessionStorage.setItem('opname_selectedProject', JSON.stringify(selectedProject));
            }
        }
    }, [activeView, menuType, selectedProject, selectedLingkup]);

    // ==========================================
    // PEMUATAN DATA API
    // ==========================================
    const loadStoreList = async (email: string, roleMode: 'pic'|'kontraktor') => {
        setIsLoading(true);
        try {
            const stores = await fetchOpnameStoreList(email, roleMode);
            const combinedList: any[] = [];
            if (Array.isArray(stores)) {
                stores.forEach(store => {
                    if (store.no_uloks && Array.isArray(store.no_uloks)) {
                        store.no_uloks.forEach((ulokNo: string) => combinedList.push({ store, ulok: ulokNo }));
                    }
                });
            }
            setListData(combinedList);

            const lastView = sessionStorage.getItem('opname_lastView');
            const savedProjStr = sessionStorage.getItem('opname_selectedProject');
            
            if (lastView && savedProjStr) {
                const savedProj = JSON.parse(savedProjStr);
                const savedLingkup = sessionStorage.getItem('opname_selectedLingkup') || 'SIPIL';
                setMenuType((sessionStorage.getItem('opname_menuType') as any) || 'input');
                
                if (lastView === 'detail') loadOpnameDetail(savedProj, savedLingkup);
                else if (lastView === 'history') loadOpnameHistory(savedProj, savedLingkup);
                else setActiveView('list');
            }

        } catch (error: any) { 
            alert(error.message); 
        } finally { 
            setIsLoading(false); 
        }
    };

    const loadOpnameDetail = async (project: any, lingkup: string) => {
        setSelectedProject(project); setSelectedLingkup(lingkup); setActiveView('detail'); setIsLoading(true);
        try {
            const penRes = await fetchOpnamePenalty(project.ulok, lingkup);
            if (penRes.terlambat) setPenaltyData({ isLate: true, days: penRes.hari_terlambat, amount: calculateLatePenalty(penRes.hari_terlambat) });
            else setPenaltyData({ isLate: false, days: 0, amount: 0 });

            let data = appMode === 'pic' 
                ? await fetchOpnameItems(project.store.kode_toko, project.ulok, lingkup)
                : await fetchOpnamePending(project.store.kode_toko, project.ulok, lingkup);

            const statusData = await checkStatusItemOpname(project.ulok, lingkup);
            let isFinal = !!statusData.tanggal_opname_final;
            
            const mappedItems = data.map((task: any, index: number) => {
                const volRab = toNumInput(task.vol_rab);
                const volAkhirNum = toNumInput(task.volume_akhir);
                const hMat = toNumID(task.harga_material);
                const hUp = toNumID(task.harga_upah);
                const selisihNum = volAkhirNum - volRab;
                const isSub = task.isSubmitted === true || !!task.item_id || ["PENDING", "APPROVED", "REJECTED"].includes(String(task.approval_status || "").toUpperCase());
                let cleanCatatan = (task.catatan || "").replace(/\[.*?\]/g, "").trim();

                return {
                    ...task, ui_id: task.item_id || index + 1, harga_material: hMat, harga_upah: hUp, vol_rab: volRab,
                    volume_akhir: appMode === 'pic' ? (isSub ? String(volAkhirNum) : "") : String(volAkhirNum),
                    selisih: (Math.round((selisihNum + Number.EPSILON) * 100) / 100).toFixed(2),
                    total_harga: selisihNum * (hMat + hUp), isSubmitted: isSub,
                    desain: task.desain || '-', kualitas: task.kualitas || '-', spesifikasi: task.spesifikasi || '-', catatan: cleanCatatan
                };
            });
            
            setOpnameItems(mappedItems);
            if(appMode === 'pic') {
                const totalItems = mappedItems.length;
                const approvedCount = mappedItems.filter((i:any) => String(i.approval_status).toUpperCase() === "APPROVED").length;
                setFinalStatus({
                    isFinalized: isFinal, canFinalize: !isFinal && totalItems > 0 && totalItems === approvedCount,
                    message: isFinal ? "Opname Selesai (Final)" : (totalItems === approvedCount ? "Finalisasi Opname" : `Menunggu Approval (${approvedCount}/${totalItems})`)
                });
            }
        } catch (error: any) { alert("Gagal memuat detail: " + error.message); } finally { setIsLoading(false); }
    };

    const loadOpnameHistory = async (project: any, lingkup: string) => {
        setSelectedProject(project); setSelectedLingkup(lingkup); setActiveView('history'); setIsLoading(true);
        try {
            const rawData = await fetchOpnameHistory(project.store.kode_toko, project.ulok, lingkup);
            const submissions = Array.isArray(rawData) ? rawData : [];
            const items = submissions.map((task: any) => {
                const volAkhirNum = toNumInput(task.volume_akhir);
                const hargaMaterial = toNumID(task.harga_material);
                const hargaUpah = toNumID(task.harga_upah);
                return { ...task, total_harga: volAkhirNum * (hargaMaterial + hargaUpah), desain: task.desain || '-', kualitas: task.kualitas || '-', spesifikasi: task.spesifikasi || '-' };
            });
            setHistoryItems(items);
            const penRes = await fetchOpnamePenalty(project.ulok, lingkup);
            if (penRes.terlambat) setPenaltyData({ isLate: true, days: penRes.hari_terlambat, amount: calculateLatePenalty(penRes.hari_terlambat) });
            else setPenaltyData({ isLate: false, days: 0, amount: 0 });
        } catch(e: any) { alert(e.message); } finally { setIsLoading(false); }
    };

    // ==========================================
    // HANDLER AKSI ROW (SUBMIT / APPROVE)
    // ==========================================
    const handlePICInputChange = (id: any, field: string, value: string) => {
        setOpnameItems(prev => prev.map(item => {
            if(item.ui_id !== id) return item;
            const updated = { ...item, [field]: value };
            if(field === 'volume_akhir') {
                const selisihNum = toNumInput(value) - updated.vol_rab;
                updated.selisih = selisihNum.toFixed(2);
                updated.total_harga = selisihNum * (updated.harga_material + updated.harga_upah);
            }
            return updated;
        }));
    };

    const handleUploadFoto = async (id: any, file: File) => {
        setProcessingId(`img-${id}`);
        try {
            const formData = new FormData(); formData.append("file", file);
            const res = await uploadOpnameImage(formData);
            handlePICInputChange(id, 'foto_url', res.link);
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const handlePICSubmitItem = async (item: any) => {
        if(!item.volume_akhir) return alert("Isi volume akhir terlebih dahulu!");
        setProcessingId(item.ui_id);
        try {
            await submitOpnameItem({
                kode_toko: selectedProject.store.kode_toko, nama_toko: selectedProject.store.nama_toko,
                pic_username: userInfo.email, no_ulok: selectedProject.ulok,
                kategori_pekerjaan: item.kategori_pekerjaan, jenis_pekerjaan: item.jenis_pekerjaan,
                vol_rab: item.vol_rab, satuan: item.satuan, volume_akhir: item.volume_akhir, selisih: item.selisih,
                harga_material: item.harga_material, harga_upah: item.harga_upah, total_harga_akhir: item.total_harga, 
                lingkup_pekerjaan: selectedLingkup, is_il: item.is_il, desain: item.desain, kualitas: item.kualitas, 
                spesifikasi: item.spesifikasi, foto_url: item.foto_url || null, catatan: '-'
            });
            alert("Item berhasil disubmit!"); loadOpnameDetail(selectedProject, selectedLingkup);
        } catch(e: any) { alert(e.message); } finally { setProcessingId(null); }
    };

    const handleKontraktorAction = async (itemId: string, jenisPekerjaan: string, action: 'approve'|'reject', catatan: string) => {
        if(action === 'reject' && !confirm("Yakin menolak item ini?")) return;
        setProcessingId(itemId);
        try {
            await actionOpnameItem(action, { item_id: itemId, kontraktor_username: userInfo.email, catatan: catatan || "-" });
            if(action === 'approve') { try { await processSummaryOpname({ no_ulok: selectedProject.ulok, lingkup_pekerjaan: selectedLingkup, jenis_pekerjaan: jenisPekerjaan }); } catch(warn) {} }
            alert(`Berhasil ${action}!`); loadOpnameDetail(selectedProject, selectedLingkup);
        } catch(e: any) { alert(e.message); } finally { setProcessingId(null); }
    };

    const handleFinalizeOpname = async () => {
        if(!confirm("Yakin finalisasi? Ini akan mengunci seluruh data dan tidak bisa dibatalkan.")) return;
        setProcessingId('final');
        try {
            await lockOpnameFinal({ status: "locked", ulok: selectedProject.ulok, lingkup_pekerjaan: selectedLingkup });
            alert("Opname berhasil difinalisasi!"); loadOpnameDetail(selectedProject, selectedLingkup);
        } catch(e:any) { alert(e.message); } finally { setProcessingId(null); }
    };

    const handleCetakBA_PDF = async () => {
        setProcessingId('pdf');
        try {
            const doc = new jsPDF(); const pageWidth = doc.internal.pageSize.getWidth(); const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 14; const currentDate = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
            const lingkupFix = (selectedLingkup || "").toUpperCase();
            let logoData: any = null; try { logoData = await toBase64('/assets/Alfamart-Emblem.png'); } catch(e) {}

            const rabData = await fetchOpnameRabData(selectedProject.store.kode_toko, selectedProject.ulok, lingkupFix);
            const picKontraktorData = await fetchPicKontraktorData(selectedProject.ulok);
            const fromOpname = await fetchPicKontraktorOpnameData(selectedProject.ulok);
            const picList = await fetchPicList(selectedProject.ulok, lingkupFix, selectedProject.store.kode_toko);

            if (fromOpname?.name && String(fromOpname.name).trim()) picKontraktorData.name = String(fromOpname.name).trim();
            if (!picKontraktorData.pic_username || picKontraktorData.pic_username === "N/A") { if (fromOpname?.pic_username) picKontraktorData.pic_username = String(fromOpname.pic_username).trim(); }
            if (!picKontraktorData.kontraktor_username || picKontraktorData.kontraktor_username === "N/A") { if (fromOpname?.kontraktor_username) picKontraktorData.kontraktor_username = String(fromOpname.kontraktor_username).trim(); }

            const printHeader = () => {
                let currentY = 12; const logoW = 48; const logoH = 20;
                if (logoData) doc.addImage(logoData, "PNG", (pageWidth - logoW) / 2, currentY, logoW, logoH);
                currentY += logoH + 6; doc.setTextColor(0, 0, 0); doc.setFontSize(9).setFont("helvetica", "bold"); doc.text("PT. SUMBER ALFARIA TRIJAYA, Tbk", margin, currentY); 
                currentY += 5; doc.setFont("helvetica", "normal"); doc.text("BUILDING & MAINTENANCE DEPT", margin, currentY); 
                const cabangTxt = selectedProject.store.cabang || selectedProject.store.nama_cabang || selectedProject.store.kota || "";
                if (cabangTxt) { currentY += 5; doc.text(`CABANG: ${cabangTxt}`, margin, currentY); }
                currentY += 6; doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(margin, currentY, pageWidth - margin, currentY); return currentY + 8; 
            };

            const addFooter = (pageNum: number) => {
                doc.setFontSize(8); doc.setTextColor(128, 128, 128);
                doc.text(`Halaman ${pageNum} - Dicetak pada: ${new Date().toLocaleString("id-ID")}`, pageWidth / 2, pageHeight - 10, { align: "center" });
                doc.setTextColor(0, 0, 0);
            };

            const printSummaryBox = (label: string, totalReal: number, startY: number) => {
                const totalPembulatan = Math.floor(totalReal / 10000) * 10000;
                const ppn = totalPembulatan * 0.11; const grandTotal = totalPembulatan + ppn;
                autoTable(doc, {
                    body: [ [label, formatRupiah(totalReal)], ["PEMBULATAN", formatRupiah(totalPembulatan)], ["PPN 11%", formatRupiah(ppn)], [`GRAND TOTAL ${label.replace("TOTAL ", "")}`, formatRupiah(grandTotal)] ],
                    startY: startY, margin: { left: pageWidth - 95, right: 14 }, tableWidth: 85, theme: "grid",
                    styles: { fontSize: 9, halign: "right", cellPadding: 3 }, columnStyles: { 0: { fontStyle: "bold", cellWidth: 35, halign: "left" } },
                    didParseCell: (data) => { if (data.row.index === 3) { data.cell.styles.fillColor = [144, 238, 144] as any; data.cell.styles.fontStyle = "bold"; } }
                });
                return { finalY: (doc as any).lastAutoTable.finalY + 15, grandTotal: grandTotal };
            };

            let lastY = printHeader();
            doc.setFont("helvetica", "bold").setFontSize(14); doc.text("BERITA ACARA OPNAME PEKERJAAN", pageWidth / 2, lastY + 5, { align: "center" }); lastY += 15;

            doc.setFont("helvetica", "normal").setFontSize(10);
            const dataOpname = historyItems.length > 0 ? historyItems[0] : {};
            const finalNamaToko = dataOpname.nama_toko || selectedProject.store.nama_toko || "-";
            const finalAlamat = dataOpname.alamat || selectedProject.store.alamat || "-";
            const picLine = picList && picList.length > 0 ? picList.join(", ") : (picKontraktorData.name || picKontraktorData.pic_username || "N/A");

            doc.text(`NOMOR ULOK : ${selectedProject.ulok || "-"}`, margin, lastY); lastY += 6;
            doc.text(`LINGKUP PEKERJAAN : ${lingkupFix}`, margin, lastY); lastY += 6;
            doc.text(`NAMA TOKO : ${finalNamaToko}`, margin, lastY); lastY += 6;
            doc.text(`ALAMAT : ${finalAlamat}`, margin, lastY); lastY += 6;
            doc.text(`TANGGAL OPNAME : ${currentDate}`, margin, lastY); lastY += 6;
            doc.text(`NAMA PIC : ${picLine}`, margin, lastY); lastY += 6;
            doc.text(`NAMA KONTRAKTOR : ${picKontraktorData.kontraktor_username || "N/A"}`, margin, lastY); lastY += 12;

            const rabPure = rabData.filter((item:any) => !item.is_il); const rabIL = rabData.filter((item:any) => item.is_il);
            let totalRealRAB = 0; let grandTotalRAB = 0; let totalRealIL = 0; let grandTotalIL = 0;

            doc.setFontSize(12).setFont("helvetica", "bold"); doc.text("RAB FINAL", margin, lastY);
            doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.3); doc.line(margin, lastY + 2, pageWidth - margin, lastY + 2); lastY += 10;

            if (rabPure.length === 0) {
                doc.setFontSize(10).setFont("helvetica", "italic"); doc.text("Tidak ada data RAB awal.", margin, lastY); lastY += 10;
            } else {
                const rabCategories = groupDataByCategory(rabPure); let catNumber = 1;
                for (const categoryName of Object.keys(rabCategories)) {
                    if (lastY + 40 > pageHeight - 20) { addFooter(doc.getNumberOfPages()); doc.addPage(); lastY = margin + 10; }
                    doc.setFontSize(11).setFont("helvetica", "bold"); doc.text(`${catNumber}. ${categoryName}`, margin, lastY); lastY += 10; catNumber++;
                    let catMat = 0; let catUpah = 0;
                    const cBody = rabCategories[categoryName].map((it:any, idx:number) => {
                        const vol = toNumberVol_PDF(it.volume); const hm = toNumberID_PDF(it.harga_material); const hu = toNumberID_PDF(it.harga_upah); const tot = vol * (hm + hu);
                        catMat += (vol * hm); catUpah += (vol * hu); totalRealRAB += tot;
                        return [idx + 1, it.jenis_pekerjaan, it.satuan, vol.toFixed(2), formatRupiah(hm), formatRupiah(hu), formatRupiah(vol * hm), formatRupiah(vol * hu), formatRupiah(tot)];
                    });
                    cBody.push(["", "", "", "", "", "SUB TOTAL", formatRupiah(catMat), formatRupiah(catUpah), formatRupiah(catMat + catUpah)]);
                    autoTable(doc, {
                        head: [["NO.", "JENIS PEKERJAAN", "SATUAN", "VOLUME", { content: "HARGA SATUAN (Rp)", colSpan: 2, styles: { halign: "center" } }, { content: "TOTAL HARGA (Rp)", colSpan: 3, styles: { halign: "center" } }], ["", "", "", "", "Material", "Upah", "Material", "Upah", "TOTAL HARGA (Rp)"]],
                        body: cBody, startY: lastY, margin: { left: margin, right: margin }, theme: "grid", styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1 }, 
                        headStyles: { fillColor: [205, 234, 242] as any, textColor: [0, 0, 0], fontSize: 8, fontStyle: "bold", halign: "center" }, columnStyles: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 40 }, 8: { fontStyle: "bold", halign: "right" } },
                        didParseCell: (data) => { if(data.section === 'body' && data.row.index === data.table.body.length - 1) { data.cell.styles.fillColor = [242, 242, 242] as any; if(data.column.index >= 5) data.cell.styles.fontStyle = 'bold'; } if(data.column.index > 2) data.cell.styles.halign = 'right'; }
                    });
                    lastY = (doc as any).lastAutoTable.finalY + 10;
                }
            }
            if (lastY + 40 > pageHeight - 20) { addFooter(doc.getNumberOfPages()); doc.addPage(); lastY = margin + 10; }
            const summaryRAB = printSummaryBox("TOTAL RAB", totalRealRAB, lastY); lastY = summaryRAB.finalY; grandTotalRAB = summaryRAB.grandTotal;

            if (rabIL.length > 0) {
                addFooter(doc.getNumberOfPages()); doc.addPage(); lastY = margin + 10;
                doc.setFontSize(12).setFont("helvetica", "bold"); doc.text("INSTRUKSI LAPANGAN (IL)", margin, lastY);
                doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.3); doc.line(margin, lastY + 2, pageWidth - margin, lastY + 2); lastY += 10;
                const ilCats = groupDataByCategory(rabIL); let ilNum = 1;
                for (const categoryName of Object.keys(ilCats)) {
                    if (lastY + 40 > pageHeight - 20) { addFooter(doc.getNumberOfPages()); doc.addPage(); lastY = margin + 10; }
                    doc.setFontSize(11).setFont("helvetica", "bold"); doc.text(`${ilNum}. ${categoryName}`, margin, lastY); lastY += 10; ilNum++;
                    let cM = 0; let cU = 0;
                    const cB = ilCats[categoryName].map((it:any, idx:number) => {
                        const v = toNumberVol_PDF(it.volume); const m = toNumberID_PDF(it.harga_material); const u = toNumberID_PDF(it.harga_upah); const t = v * (m + u);
                        cM += (v * m); cU += (v * u); totalRealIL += t;
                        return [idx + 1, it.jenis_pekerjaan, it.satuan, v.toFixed(2), formatRupiah(m), formatRupiah(u), formatRupiah(v * m), formatRupiah(v * u), formatRupiah(t)];
                    });
                    cB.push(["", "", "", "", "", "SUB TOTAL", formatRupiah(cM), formatRupiah(cU), formatRupiah(cM + cU)]);
                    autoTable(doc, {
                        head: [["NO.", "JENIS PEKERJAAN", "SATUAN", "VOLUME", { content: "HARGA SATUAN (Rp)", colSpan: 2, styles: { halign: "center" } }, { content: "TOTAL HARGA (Rp)", colSpan: 3, styles: { halign: "center" } }], ["", "", "", "", "Material", "Upah", "Material", "Upah", "TOTAL HARGA (Rp)"]],
                        body: cB, startY: lastY, margin: { left: margin, right: margin }, theme: "grid", styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1 }, 
                        headStyles: { fillColor: [255, 245, 157] as any, textColor: [0, 0, 0], fontSize: 8, fontStyle: "bold", halign: "center" }, columnStyles: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 40 }, 8: { fontStyle: "bold", halign: "right" } },
                        didParseCell: (data) => { if(data.section === 'body' && data.row.index === data.table.body.length - 1) { data.cell.styles.fillColor = [255, 249, 196] as any; if(data.column.index >= 5) data.cell.styles.fontStyle = 'bold'; } if(data.column.index > 2) data.cell.styles.halign = 'right'; }
                    });
                    lastY = (doc as any).lastAutoTable.finalY + 10;
                }
                if (lastY + 40 > pageHeight - 20) { addFooter(doc.getNumberOfPages()); doc.addPage(); lastY = margin + 10; }
                const summaryIL = printSummaryBox("TOTAL IL", totalRealIL, lastY); lastY = summaryIL.finalY; grandTotalIL = summaryIL.grandTotal;
            }

            if (historyItems && historyItems.length > 0) {
                const groupsByType: any = { "PEKERJAAN TAMBAH": [], "PEKERJAAN KURANG": [] };
                historyItems.forEach(it => {
                    const vAkhir = toNumberVol_PDF(it.volume_akhir);
                    let rawVolAwal = it.vol_rab; if (rawVolAwal === undefined || rawVolAwal === null || rawVolAwal === "") rawVolAwal = it.volume_awal;
                    const vAwal = toNumberVol_PDF(rawVolAwal); 
                    let sel = Math.round(((vAkhir - vAwal) + Number.EPSILON) * 100) / 100;
                    if (sel !== 0) {
                        it.selisih = String(sel).replace('.', ','); 
                        groupsByType[sel < 0 ? "PEKERJAAN KURANG" : "PEKERJAAN TAMBAH"].push(it);
                    }
                });

                for (const [sectionName, itemsArr] of Object.entries(groupsByType)) {
                    if ((itemsArr as any[]).length === 0) continue;
                    addFooter(doc.getNumberOfPages()); doc.addPage(); lastY = margin + 10;
                    doc.setFontSize(12).setFont("helvetica", "bold"); doc.text(sectionName, margin, lastY);
                    doc.setDrawColor(180, 180, 180); doc.line(margin, lastY+2, pageWidth-margin, lastY+2); lastY += 10;

                    const catGroups = groupDataByCategory(itemsArr as any[]); let kIdx = 1;
                    for (const [kategori, kItems] of Object.entries(catGroups)) {
                        if (lastY + 20 > pageHeight - 20) { addFooter(doc.getNumberOfPages()); doc.addPage(); lastY = margin + 10; }
                        doc.setFontSize(11).setFont("helvetica", "bold"); doc.text(`${kIdx}. ${kategori}`, margin, lastY); lastY += 10; kIdx++;

                        const rows = (kItems as any[]).map((item, idx) => {
                            const sel = toNumberVol_PDF(item.selisih); const hM = toNumberID_PDF(item.harga_material); const hU = toNumberID_PDF(item.harga_upah);
                            let dVa = item.vol_rab; if (dVa === undefined || dVa === null || dVa === "") dVa = "0";
                            return [idx + 1, item.jenis_pekerjaan + (item.is_il ? " (IL)" : ""), dVa, item.satuan, item.volume_akhir, `${item.selisih} ${item.satuan}`, formatRupiah(sel * (hM + hU))];
                        });
                        autoTable(doc, {
                            head: [["NO.", "JENIS PEKERJAAN", "VOL AWAL", "SATUAN", "VOL AKHIR", "SELISIH", "NILAI SELISIH (Rp)"]],
                            body: rows, startY: lastY, margin: { left: margin, right: margin }, theme: "grid",
                            styles: { fontSize: 8, cellPadding: 3, lineWidth: 0.1 }, headStyles: { fillColor: [205, 234, 242] as any, textColor: [0,0,0], fontSize: 8.5, fontStyle: "bold", halign: "center" },
                            columnStyles: { 6: { halign: "right", fontStyle: "bold" }, 2: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center", fontStyle: "bold" } },
                            didParseCell: (data) => { if(data.section === 'body') { const orig = (kItems as any[])[data.row.index]; if (orig && orig.is_il) data.cell.styles.fillColor = [255, 249, 196] as any; } }
                        });
                        lastY = (doc as any).lastAutoTable.finalY + 10;
                    }
                    const tBlock = (itemsArr as any[]).reduce((sum, item) => sum + (toNumberVol_PDF(item.selisih) * (toNumberID_PDF(item.harga_material) + toNumberID_PDF(item.harga_upah))), 0);
                    if (lastY + 40 > pageHeight - 20) { addFooter(doc.getNumberOfPages()); doc.addPage(); lastY = margin + 10; }
                    const summaryBlock = printSummaryBox("TOTAL " + sectionName, tBlock, lastY); lastY = summaryBlock.finalY;
                }
            }

            addFooter(doc.getNumberOfPages()); doc.addPage(); lastY = margin + 10;
            let totalTambah = 0; let totalKurang = 0;
            historyItems.forEach(item => {
                const sel = toNumberVol_PDF(item.selisih); const unit = toNumberID_PDF(item.harga_material) + toNumberID_PDF(item.harga_upah); const delta = sel * unit;
                if (delta > 0) totalTambah += delta; else if (delta < 0) totalKurang += delta;
            });
            const tTB = Math.floor(totalTambah / 10000) * 10000; const tKB = Math.floor(totalKurang / 10000) * 10000;
            const tTPPN = tTB + (tTB * 0.11); const tKPPN = tKB + (tKB * 0.11);
            const totAwal = grandTotalRAB + grandTotalIL; const tOpname = totAwal + (tTPPN + tKPPN); const finPayment = tOpname - penaltyData.amount;
            const dNom = tOpname - totAwal; let statTxt = "Sesuai Target"; if (dNom > 0) statTxt = "Pekerjaan Tambah"; if (dNom < 0) statTxt = "Pekerjaan Kurang";

            doc.setFontSize(12).setFont("helvetica", "bold"); doc.text("STATUS PEKERJAAN", margin, lastY); doc.line(margin, lastY+2, pageWidth-margin, lastY+2); lastY += 10;
            let sBody: any[] = [
                [{ content: `STATUS: ${statTxt}`, colSpan: 2, styles: { fillColor: [245, 245, 245], fontStyle: "bold", fontSize: 12 } }],
                ["Total Awal (RAB + IL) incl. PPN", formatRupiah(totAwal)], ["Pekerjaan Tambah (incl. PPN)", formatRupiah(tTPPN)],
                ["Pekerjaan Kurang (incl. PPN)", formatRupiah(tKPPN)], ["Selisih Pekerjaan Tambah dan Kurang", `${dNom >= 0 ? "+" : ""}${formatRupiah(dNom)}`],
                ["Total Opname Final (incl. PPN)", formatRupiah(tOpname)]
            ];
            if (penaltyData.isLate && penaltyData.amount > 0) {
                sBody.push([{ content: `Denda Keterlambatan (${penaltyData.days} Hari)`, styles: { textColor: [220, 38, 38], fontStyle: "bold" } }, { content: `- ${formatRupiah(penaltyData.amount)}`, styles: { textColor: [220, 38, 38], fontStyle: "bold" } }]);
                sBody.push(["Grand Total", formatRupiah(finPayment)]);
            }
            autoTable(doc, {
                body: sBody, startY: lastY, margin: { left: margin, right: margin }, theme: "grid", styles: { fontSize: 11, halign: "left", cellPadding: 4 }, columnStyles: { 1: { halign: "right", cellWidth: 80 } },
                didParseCell: (data) => { if (data.row.index === sBody.length - 1) { data.cell.styles.fillColor = [144, 238, 144] as any; data.cell.styles.fontStyle = "bold"; } }
            });

            const itemsWithPhotos = historyItems.filter(item => item.foto_url);
            if (itemsWithPhotos.length > 0) {
                addFooter(doc.getNumberOfPages()); doc.addPage(); let pageNum = doc.getNumberOfPages(); let photoY = margin + 10;
                doc.setFontSize(12).setFont("helvetica", "bold"); doc.text("LAMPIRAN FOTO BUKTI", pageWidth / 2, photoY + 5, { align: "center" }); doc.line(margin, photoY + 8, pageWidth - margin, photoY + 8); photoY += 15; 
                let colIdx = 0; const colW = (pageWidth - margin * 3) / 2; const lX = margin; const rX = margin + colW + margin;
                const base64Photos = await Promise.all(itemsWithPhotos.map(it => toBase64(it.foto_url)));
                
                itemsWithPhotos.forEach((item, index) => {
                    const imgData = base64Photos[index];
                    if (imgData) {
                        const imgProps = doc.getImageProperties(imgData as string); const mWH = colW - 10; const mHT = 80;
                        let iW = mWH; let iH = (imgProps.height * iW) / imgProps.width; if (iH > mHT) { iH = mHT; iW = (imgProps.width * iH) / imgProps.height; }
                        if (photoY + iH + 35 > pageHeight - 20) { addFooter(pageNum); doc.addPage(); pageNum++; photoY = margin + 15; colIdx = 0; }
                        const cX = colIdx === 0 ? lX : rX; doc.setFontSize(9).setFont("helvetica", "bold");
                        const titleLines = wrapText(doc, `${index+1}. ${item.jenis_pekerjaan}` + (item.is_il ? " (IL)" : ""), mWH);
                        let tY = photoY; titleLines.forEach(line => { doc.text(line, cX, tY); tY += 5; });
                        const imgY = photoY + (titleLines.length * 5) + 2; doc.setDrawColor(200); doc.rect(cX, imgY, iW + 4, iH + 4);
                        doc.addImage(imgData as string, cX + 2, imgY + 2, iW, iH);
                        if (colIdx === 0) colIdx = 1; else { colIdx = 0; photoY = imgY + iH + 25; }
                    }
                });
                addFooter(pageNum);
            } else { addFooter(doc.getNumberOfPages()); }

            const totalPages = doc.getNumberOfPages(); for (let i = 1; i < totalPages; i++) { doc.setPage(i); }
            doc.save(`BA_Opname_${selectedProject.store.kode_toko}_${selectedProject.ulok}.pdf`);
        } catch (error: any) { alert("Gagal mencetak PDF: " + error.message); } finally { setProcessingId(null); }
    };

    // ==========================================
    // FILTER & KALKULASI RINGKASAN
    // ==========================================
    const filteredList = listData.filter(item => `${item.store.nama_toko} ${item.ulok} ${item.store.kode_toko}`.toLowerCase().includes(searchQuery.toLowerCase()));

    const calculations = useMemo(() => {
        if(appMode !== 'pic' || activeView !== 'detail') return null;
        const totalVal = opnameItems.reduce((sum, i) => sum + (i.total_harga || 0), 0);
        const ppn = totalVal * 0.11;
        return { totalVal, ppn, grandTotal: (totalVal + ppn) - penaltyData.amount };
    }, [opnameItems, penaltyData, appMode, activeView]);

    const getILLink = () => {
        if (!selectedProject) return '#';
        const currentUlok = encodeURIComponent(selectedProject.ulok || "");
        const currentToko = encodeURIComponent(selectedProject.store?.nama_toko || "");
        return `/il?ulok=${currentUlok}&toko=${currentToko}`;
    };

    const historyTotalEstimasi = useMemo(() => historyItems.reduce((sum, i) => sum + (i.total_harga || 0), 0), [historyItems]);

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">
            <AppNavbar
                title="Opname"
                showBackButton
                backHref="/dashboard"
                rightActions={
                    <Badge variant="outline" className="bg-black/10 text-white border-white/30 px-3 py-1 md:py-1.5 shadow-sm backdrop-blur-sm text-[10px] md:text-xs font-semibold">
                        {appMode === 'pic' ? 'MODE PIC' : 'MODE KONTRAKTOR'}
                    </Badge>
                }
            />

            <main className="max-w-375 mx-auto p-4 md:p-8 mt-4">

                {/* VIEW 0: MENU DASHBOARD UTAMA (TANPA INFO USER/SELAMAT DATANG) */}
                {activeView === 'menu' && (
                    <div className="flex flex-col items-center mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl px-4 mt-8">
                            <Card className="hover:border-blue-500 hover:shadow-lg cursor-pointer transition-all border-2 border-transparent" 
                                  onClick={() => { setMenuType('input'); setActiveView('list'); }}>
                                <CardContent className="p-10 flex flex-col items-center text-center gap-4">
                                    <div className="text-5xl">{appMode === 'pic' ? '📝' : '🔔'}</div>
                                    <h3 className="font-bold text-xl text-slate-800">{appMode === 'pic' ? 'Input Opname Harian' : 'Persetujuan Opname'}</h3>
                                    <p className="text-sm text-slate-500">{appMode === 'pic' ? 'Isi volume aktual lapangan.' : 'Review pengajuan volume dari PIC.'}</p>
                                </CardContent>
                            </Card>

                            <Card className="hover:border-green-500 hover:shadow-lg cursor-pointer transition-all border-2 border-transparent" 
                                onClick={() => { setMenuType('history'); setActiveView('list'); }}>
                                <CardContent className="p-10 flex flex-col items-center text-center gap-4">
                                    <div className="text-5xl">{appMode === 'pic' ? '✅' : '📂'}</div>
                                    <h3 className="font-bold text-xl text-slate-800">{appMode === 'pic' ? 'Lihat Opname Final' : 'Histori Opname'}</h3>
                                    <p className="text-sm text-slate-500">{appMode === 'pic' ? 'Lihat data opname yang sudah disetujui.' : 'Lihat riwayat opname yang sudah final.'}</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
                
                {/* VIEW 1: LIST PROYEK */}
                {activeView === 'list' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                            <div className="flex items-center gap-4">
                                <Button variant="outline" className="h-10" onClick={() => setActiveView('menu')}><ArrowLeft className="w-4 h-4 mr-2" /> Menu Utama</Button>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">
                                        {menuType === 'history' 
                                            ? (appMode === 'pic' ? 'Pilih Pekerjaan (Opname Final)' : 'Pilih Pekerjaan (Histori Opname)') 
                                            : (appMode === 'pic' ? 'Pilih Pekerjaan (Input Lapangan)' : 'Pilih Pekerjaan (Persetujuan)')}
                                    </h2>
                                </div>
                            </div>
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" placeholder="Cari Toko / No. Ulok..." className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-red-600 mb-4" /><p className="text-slate-500">Menarik data dari server...</p></div>
                        ) : filteredList.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredList.map((item, idx) => (
                                    <Card key={idx} className={`hover:border-blue-400 hover:shadow-md transition-all cursor-pointer border-l-4 ${menuType === 'history' ? 'border-l-green-400' : 'border-l-yellow-400'}`}
                                        onClick={() => menuType === 'history' ? loadOpnameHistory(item, 'SIPIL') : loadOpnameDetail(item, 'SIPIL')}>
                                        <CardContent className="p-5 flex flex-col items-start text-left">
                                            <div className="font-bold text-lg text-slate-800 mb-1 leading-tight">{item.store.nama_toko}</div>
                                            <div className="text-sm text-slate-500 mb-3">Kode: <b>{item.store.kode_toko}</b></div>
                                            <Badge className="bg-sky-100 text-sky-700 border border-sky-200">📄 ULOK: {item.ulok}</Badge>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 border-2 border-dashed rounded-xl border-slate-200 bg-white">
                                <div className="text-5xl mb-3">📭</div>
                                <p className="text-slate-500 font-medium">Tidak ada data pekerjaan yang sesuai.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* VIEW 2: DETAIL INPUT / APPROVAL */}
                {activeView === 'detail' && selectedProject && (
                    <div className="animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <Button variant="ghost" className="text-slate-500 hover:text-slate-800 px-0" onClick={() => setActiveView('list')}><ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Daftar</Button>
                            <div className="flex bg-slate-200 p-1 rounded-lg">
                                <button onClick={() => loadOpnameDetail(selectedProject, 'SIPIL')} className={`px-6 py-1.5 rounded-md text-sm font-bold transition-all ${selectedLingkup === 'SIPIL' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-600 hover:bg-slate-300'}`}>SIPIL</button>
                                <button onClick={() => loadOpnameDetail(selectedProject, 'ME')} className={`px-6 py-1.5 rounded-md text-sm font-bold transition-all ${selectedLingkup === 'ME' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-600 hover:bg-slate-300'}`}>ME</button>
                            </div>
                        </div>

                        <Card className="mb-6 shadow-sm border-slate-200">
                            <CardContent className="p-6 bg-slate-50 rounded-xl flex flex-wrap justify-between items-center gap-4">
                                <div><h2 className="text-xl font-bold text-slate-800">{selectedProject.store.nama_toko}</h2><p className="text-slate-600">ULOK: {selectedProject.ulok} • Lingkup: <b>{selectedLingkup}</b></p></div>
                                {penaltyData.isLate && <Badge className="bg-red-100 text-red-700 border-red-200 px-4 py-2 text-sm">Terlambat {penaltyData.days} Hari</Badge>}
                            </CardContent>
                        </Card>

                        {isLoading ? (
                            <div className="py-20 text-center text-slate-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500"/>Memuat detail baris...</div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left border-collapse min-w-350">
                                        <thead className="bg-slate-800 text-white text-xs border-b">
                                            <tr>
                                                <th className="p-3 border-r border-slate-700">Kategori</th>
                                                <th className="p-3 border-r border-slate-700 min-w-50">Jenis Pekerjaan</th>
                                                {appMode === 'pic' && <><th className="p-3 text-center border-r border-slate-700">Vol RAB</th><th className="p-3 text-center border-r border-slate-700">Sat</th><th className="p-3 text-right border-r border-slate-700">Hrg Material</th><th className="p-3 text-right border-r border-slate-700">Hrg Upah</th></>}
                                                <th className="p-3 text-center bg-blue-900 border-l border-blue-800">Vol Akhir</th>
                                                {appMode === 'kontraktor' && <th className="p-3 text-center border-r border-slate-700">Sat</th>}
                                                {appMode === 'pic' && <><th className="p-3 text-center bg-blue-900 border-l border-blue-800">Selisih</th><th className="p-3 text-right bg-blue-900 border-l border-blue-800">Total Selisih (Rp)</th></>}
                                                <th className="p-3 text-center border-l border-slate-700 w-24">Desain</th><th className="p-3 text-center border-l border-slate-700 w-24">Kualitas</th><th className="p-3 text-center border-l border-slate-700 w-24">Spesifikasi</th><th className="p-3 text-center border-l border-slate-700">Foto</th>
                                                {appMode === 'kontraktor' && <><th className="p-3 border-l border-slate-700 text-center">PIC</th><th className="p-3 border-l border-slate-700 text-center">Waktu Submit</th></>}
                                                <th className="p-3 border-l border-slate-700 min-w-50">Catatan</th>
                                                {appMode === 'pic' && <th className="p-3 text-center bg-slate-700">Status</th>}
                                                <th className="p-3 text-center bg-slate-900 w-32">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {opnameItems.length === 0 ? <tr><td colSpan={16} className="p-8 text-center text-slate-500">Tidak ada data item.</td></tr> : opnameItems.map((item) => {
                                                const bg = item.is_il ? 'bg-yellow-50/50' : (item.isSubmitted ? 'bg-green-50/30' : 'hover:bg-slate-50');
                                                const isSubmitted = item.isSubmitted; const status = String(item.approval_status || '').toLowerCase(); const isRejected = status === 'rejected';
                                                const canEdit = appMode === 'pic' && (!isSubmitted || isRejected) && !finalStatus.isFinalized;
                                                const selisihNum = parseFloat(item.selisih) || 0;
                                                return (
                                                    <tr key={item.ui_id} className={bg}>
                                                        <td className="p-3 text-slate-600 font-semibold border-r">{item.kategori_pekerjaan}</td>
                                                        <td className="p-3 border-r text-slate-800">{item.jenis_pekerjaan}{item.is_il && <Badge className="ml-2 bg-yellow-200 text-yellow-800 text-[9px] px-1">IL</Badge>}</td>
                                                        {appMode === 'pic' && <><td className="p-3 text-center border-r bg-slate-50 font-medium">{item.vol_rab}</td><td className="p-3 text-center border-r text-slate-500">{item.satuan}</td><td className="p-3 text-right border-r text-slate-500">{formatRupiah(item.harga_material)}</td><td className="p-3 text-right border-r text-slate-500">{formatRupiah(item.harga_upah)}</td></>}
                                                        <td className="p-3 border-r bg-blue-50/30 text-center">
                                                            {canEdit ? <input type="number" step="any" className="w-20 p-1.5 border border-blue-300 rounded text-center text-sm font-bold text-blue-800 bg-white" value={item.volume_akhir} onChange={(e) => handlePICInputChange(item.ui_id, 'volume_akhir', e.target.value)} placeholder="0" />
                                                            : <span className="font-bold text-blue-800 text-base">{item.volume_akhir}</span>}
                                                        </td>
                                                        {appMode === 'kontraktor' && <td className="p-3 text-center border-r text-slate-500">{item.satuan}</td>}
                                                        {appMode === 'pic' && <><td className={`p-3 text-center font-bold border-r ${selisihNum < 0 ? 'text-red-600' : (selisihNum > 0 ? 'text-green-600' : 'text-slate-800')}`}>{selisihNum > 0 ? '+' : ''}{item.selisih}</td><td className={`p-3 text-right font-bold border-r ${item.total_harga < 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatRupiah(item.total_harga)}</td></>}
                                                        <td className="p-3 text-center border-r">
                                                            {canEdit ? <select className="border p-1.5 rounded text-xs w-full bg-white" value={item.desain} onChange={(e) => handlePICInputChange(item.ui_id, 'desain', e.target.value)}><option value="-">-</option><option value="Sesuai">Sesuai</option><option value="Tidak Sesuai">Tidak Sesuai</option></select>
                                                            : <span className={`badge ${item.desain === 'Sesuai' ? 'text-green-700 bg-green-100' : (item.desain === 'Tidak Sesuai' ? 'text-red-700 bg-red-100' : '')}`}>{item.desain}</span>}
                                                        </td>
                                                        <td className="p-3 text-center border-r">
                                                            {canEdit ? <select className="border p-1.5 rounded text-xs w-full bg-white" value={item.kualitas} onChange={(e) => handlePICInputChange(item.ui_id, 'kualitas', e.target.value)}><option value="-">-</option><option value="Baik">Baik</option><option value="Tidak Baik">Tidak Baik</option></select>
                                                            : <span className={`badge ${item.kualitas === 'Baik' ? 'text-green-700 bg-green-100' : (item.kualitas === 'Tidak Baik' ? 'text-red-700 bg-red-100' : '')}`}>{item.kualitas}</span>}
                                                        </td>
                                                        <td className="p-3 text-center border-r">
                                                            {canEdit ? <select className="border p-1.5 rounded text-xs w-full bg-white" value={item.spesifikasi} onChange={(e) => handlePICInputChange(item.ui_id, 'spesifikasi', e.target.value)}><option value="-">-</option><option value="Sesuai">Sesuai</option><option value="Tidak Sesuai">Tidak Sesuai</option></select>
                                                            : <span className={`badge ${item.spesifikasi === 'Sesuai' ? 'text-green-700 bg-green-100' : (item.spesifikasi === 'Tidak Sesuai' ? 'text-red-700 bg-red-100' : '')}`}>{item.spesifikasi}</span>}
                                                        </td>
                                                        <td className="p-3 text-center border-r">
                                                            {item.foto_url ? <a href={item.foto_url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs font-semibold px-2 py-1 border border-blue-200 rounded bg-blue-50">Lihat</a>
                                                            : (canEdit ? <label className="cursor-pointer text-xs font-semibold bg-slate-100 border border-slate-300 px-2 py-1.5 rounded hover:bg-slate-200 transition-colors">Upload<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadFoto(item.ui_id, e.target.files[0])} /></label> : <span className="text-xs text-slate-400">-</span>)}
                                                            {processingId === `img-${item.ui_id}` && <Loader2 className="w-3 h-3 animate-spin mx-auto mt-1" />}
                                                        </td>
                                                        {appMode === 'kontraktor' && <><td className="p-3 text-center border-r text-xs">{item.name || item.pic_username || '-'}</td><td className="p-3 text-center border-r text-xs text-slate-500">{item.tanggal_submit || '-'}</td></>}
                                                        <td className="p-3 border-r bg-slate-50/50">
                                                            {appMode === 'kontraktor' ? <textarea id={`note-${item.ui_id}`} className="w-full text-xs p-2 border rounded resize-none focus:ring-1 focus:ring-blue-500 outline-none" rows={2} placeholder="Catatan (opsional)..."></textarea>
                                                            : <div className="text-xs max-h-15 overflow-y-auto text-slate-600 p-2 bg-white border border-slate-200 rounded leading-relaxed">{item.catatan || '-'}</div>}
                                                        </td>
                                                        {appMode === 'pic' && <td className="p-3 text-center border-r"><Badge className={status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : (status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600')}>{item.approval_status || 'Draft'}</Badge></td>}
                                                        <td className="p-3 text-center bg-slate-50">
                                                            {appMode === 'pic' ? (canEdit ? <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 h-8 text-xs" disabled={processingId === item.ui_id} onClick={() => handlePICSubmitItem(item)}>{processingId === item.ui_id ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Simpan'}</Button>
                                                                : (isRejected && !finalStatus.isFinalized ? <Button size="sm" className="w-full bg-slate-600 hover:bg-slate-700 h-8 text-xs" onClick={() => handlePICInputChange(item.ui_id, 'isSubmitted', 'false')}>Perbaiki</Button> : <span className="text-slate-400 text-xs font-semibold">{finalStatus.isFinalized ? 'Final' : '-'}</span>)
                                                            ) : (
                                                                <div className="flex flex-col gap-1.5">
                                                                    <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 h-7 text-[11px]" disabled={processingId === item.ui_id} onClick={() => handleKontraktorAction(item.ui_id, item.jenis_pekerjaan, 'approve', (document.getElementById(`note-${item.ui_id}`) as HTMLInputElement)?.value)}>Approve</Button>
                                                                    <Button size="sm" variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 h-7 text-[11px]" disabled={processingId === item.ui_id} onClick={() => handleKontraktorAction(item.ui_id, item.jenis_pekerjaan, 'reject', (document.getElementById(`note-${item.ui_id}`) as HTMLInputElement)?.value)}>Reject</Button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* TOMBOL IL */}
                        {!isLoading && appMode === 'pic' && !finalStatus.isFinalized && (
                            <Link href={getILLink()} className="flex items-center justify-center w-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-extrabold p-3 rounded-lg shadow-sm transition-colors mb-6 cursor-pointer uppercase tracking-wide">
                                💡 Buat Instruksi Lapangan (IL)
                            </Link>
                        )}

                        {!isLoading && appMode === 'pic' && calculations && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                <Card className="bg-slate-50 border-slate-200">
                                    <CardContent className="p-6 space-y-3">
                                        <div className="flex justify-between text-slate-600"><span>Total Selisih Estimasi:</span><span className="font-semibold">{formatRupiah(calculations.totalVal)}</span></div>
                                        <div className="flex justify-between text-slate-600 border-b pb-3"><span>PPN (11% Aktual):</span><span className="font-semibold">{formatRupiah(calculations.ppn)}</span></div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-white border-blue-200 shadow-lg">
                                    <CardContent className="p-6 flex flex-col justify-between h-full">
                                        <div className="flex justify-between text-red-700 mb-2"><span className="font-semibold flex items-center"><XCircle className="w-4 h-4 mr-1"/> Denda Keterlambatan:</span><span className="font-bold">- {formatRupiah(penaltyData.amount)}</span></div>
                                        <div className="mt-auto border-t border-blue-200 pt-4 flex justify-between items-end mb-4"><span className="text-blue-900 font-bold text-lg">GRAND TOTAL</span><span className="text-3xl font-extrabold text-blue-700">{formatRupiah(calculations.grandTotal)}</span></div>
                                        <Button className={`w-full h-12 text-lg font-bold ${finalStatus.canFinalize ? 'bg-blue-600 hover:bg-blue-700' : (finalStatus.isFinalized ? 'bg-green-600 cursor-not-allowed opacity-90' : 'bg-slate-300 text-slate-500 cursor-not-allowed')}`} disabled={!finalStatus.canFinalize || processingId === 'final'} onClick={handleFinalizeOpname}>
                                            {processingId === 'final' ? <Loader2 className="animate-spin w-5 h-5"/> : (finalStatus.isFinalized ? <><CheckCircle className="w-5 h-5 mr-2"/> {finalStatus.message}</> : finalStatus.message)}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>
                )}

                {/* VIEW 3: HISTORI / FINAL OPNAME */}
                {activeView === 'history' && selectedProject && (
                    <div className="animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <Button variant="ghost" className="text-slate-500 hover:text-slate-800 px-0" onClick={() => setActiveView('list')}>
                                <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Daftar Histori
                            </Button>
                            <div className="flex items-center gap-3">
                                <Button variant="outline" className="border-blue-600 text-blue-700 hover:bg-blue-50 font-bold" disabled={processingId === 'pdf'} onClick={handleCetakBA_PDF}>
                                    {processingId === 'pdf' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />} 
                                    {processingId === 'pdf' ? 'Mempersiapkan PDF...' : 'Download B.A Opname (PDF)'}
                                </Button>
                                <div className="flex bg-slate-200 p-1 rounded-lg">
                                    <button onClick={() => loadOpnameHistory(selectedProject, 'SIPIL')} className={`px-6 py-1.5 rounded-md text-sm font-bold transition-all ${selectedLingkup === 'SIPIL' ? 'bg-white shadow-sm text-green-700' : 'text-slate-600 hover:bg-slate-300'}`}>SIPIL</button>
                                    <button onClick={() => loadOpnameHistory(selectedProject, 'ME')} className={`px-6 py-1.5 rounded-md text-sm font-bold transition-all ${selectedLingkup === 'ME' ? 'bg-white shadow-sm text-green-700' : 'text-slate-600 hover:bg-slate-300'}`}>ME</button>
                                </div>
                            </div>
                        </div>

                        <Card className="mb-6 shadow-sm border-slate-200 bg-slate-50">
                            <CardContent className="p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Riwayat Opname Final</h2>
                                    <p className="text-slate-600">{selectedProject.store.nama_toko} • ULOK: {selectedProject.ulok} • Lingkup: <b>{selectedLingkup}</b></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-slate-500">Total Estimasi Akhir:</p>
                                    <p className="text-2xl font-bold text-slate-800">{formatRupiah(historyTotalEstimasi)}</p>
                                </div>
                            </CardContent>
                        </Card>

                        {isLoading ? (
                            <div className="py-20 text-center text-slate-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-green-500"/>Memuat riwayat opname...</div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
                                {historyItems.length === 0 ? (
                                    <div className="p-20 text-center">
                                        <div className="text-5xl mb-3">📭</div>
                                        <h3 className="text-slate-500 font-medium">Belum ada data opname FINAL untuk lingkup ini.</h3>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left border-collapse min-w-300">
                                            <thead className="bg-slate-100 text-slate-700 border-b">
                                                <tr>
                                                    <th className="p-3 border-r">Kategori</th>
                                                    <th className="p-3 border-r min-w-50">Jenis Pekerjaan</th>
                                                    <th className="p-3 text-center border-r">Vol Akhir</th>
                                                    <th className="p-3 text-center border-r">Desain</th>
                                                    <th className="p-3 text-center border-r">Kualitas</th>
                                                    <th className="p-3 text-center border-r">Spesifikasi</th>
                                                    <th className="p-3 text-center border-r">Status</th>
                                                    <th className="p-3 text-center border-r">Tgl Submit</th>
                                                    <th className="p-3 text-center border-r">PIC</th>
                                                    <th className="p-3 text-center">Kontraktor</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {historyItems.map((item, idx) => (
                                                    <tr key={idx} className={item.is_il ? 'bg-yellow-50/50 hover:bg-yellow-100/50' : 'hover:bg-slate-50'}>
                                                        <td className="p-3 font-semibold text-slate-600 border-r">{item.kategori_pekerjaan}{item.is_il && <Badge className="ml-2 bg-yellow-200 text-yellow-800 text-[9px] px-1">IL</Badge>}</td>
                                                        <td className="p-3 text-slate-800 border-r">{item.jenis_pekerjaan}</td>
                                                        <td className="p-3 text-center font-bold border-r">{item.volume_akhir} {item.satuan}</td>
                                                        <td className="p-3 text-center border-r"><span className={`badge ${item.desain === 'Sesuai' ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>{item.desain}</span></td>
                                                        <td className="p-3 text-center border-r"><span className={`badge ${item.kualitas === 'Baik' ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>{item.kualitas}</span></td>
                                                        <td className="p-3 text-center border-r"><span className={`badge ${item.spesifikasi === 'Sesuai' ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>{item.spesifikasi}</span></td>
                                                        <td className="p-3 text-center border-r"><Badge className="bg-green-100 text-green-700 border-green-200">{item.approval_status || 'Approved'}</Badge></td>
                                                        <td className="p-3 text-center text-xs text-slate-500 border-r">{item.tanggal_submit || '-'}</td>
                                                        <td className="p-3 text-center text-xs border-r">{item.pic_name || item.pic_username || '-'}</td>
                                                        <td className="p-3 text-center text-xs">{item.kontraktor_name || item.display_kontraktor || item.kontraktor_username || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}