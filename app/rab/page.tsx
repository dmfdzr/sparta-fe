"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
// Import AppNavbar
import AppNavbar from '@/components/AppNavbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ChevronLeft dihapus dari sini karena sudah ada di AppNavbar
import { Plus, Trash2, Save, Loader2, Info, AlertTriangle, Bell, Upload, X, Image as ImageIcon } from 'lucide-react';

import { SIPIL_CATEGORIES, ME_CATEGORIES, BRANCH_GROUPS, BRANCH_TO_ULOK } from '@/lib/constants';
import { checkRevisionStatus, fetchPricesData, submitRABData, fetchRABDetail, fetchTokoDetail } from '@/lib/api';

const toRupiah = (num: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num || 0);
const formatAngka = (num: number) => num ? num.toLocaleString('id-ID') : '';

export default function RABPage() {
  const router = useRouter();
  
  // --- STATE FORM DASAR ---
  const [formData, setFormData] = useState({
    namaToko: '', lokasiCabang: '', lokasiTanggal: '', lokasiManual: '', isRenovasi: false,
    proyek: '', alamat: '', cabang: '', lingkupPekerjaan: '', kategoriLokasi: '', durasiPekerjaan: '',
    luasAreaParkir: '', luasAreaSales: '', luasGudang: '', luasBangunan: '', luasAreaTerbuka: '',
    logo: '' // Base64 logo string
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [availableCabang, setAvailableCabang] = useState<string[]>([]);
  const [prices, setPrices] = useState<any>({});
  const [tableRows, setTableRows] = useState<any[]>([]);
  
  const [rejectedList, setRejectedList] = useState<any[]>([]);
  const [revisionDataToLoad, setRevisionDataToLoad] = useState<any>(null);
  const [hasPromptedRevisionFor, setHasPromptedRevisionFor] = useState<string>(''); 
  
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRevisionLoading, setIsRevisionLoading] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{title: string, desc: string, type: 'info' | 'error' | 'success' | 'warning'}>({ title: "", desc: "", type: "info" });
  
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [revisionListDialogOpen, setRevisionListDialogOpen] = useState(false);
  
  // State untuk melacak perubahan pada form revisi
  const [initialFormState, setInitialFormState] = useState<string | null>(null);

  useEffect(() => {
     if (initialFormState === "TRACKING_PENDING" && !isLoading) {
         setInitialFormState(JSON.stringify({ formData, tableRows }));
     }
  }, [isLoading, formData, tableRows, initialFormState]);

  const isFormModified = initialFormState && initialFormState !== "TRACKING_PENDING" 
      ? JSON.stringify({ formData, tableRows }) !== initialFormState 
      : true;

  // --- 1. INISIALISASI SESI & CEK STATUS REVISI ---
  useEffect(() => {
    const userCabang = sessionStorage.getItem('loggedInUserCabang')?.toUpperCase();
    const userEmail = sessionStorage.getItem('loggedInUserEmail');

    if (!userCabang) {
      router.push('/auth');
      return;
    }
    
    setAvailableCabang(BRANCH_GROUPS[userCabang] || [userCabang]);
    let defaultLokasiCabang = userCabang === 'CIKOKOL' ? "KZ01" : (BRANCH_TO_ULOK[userCabang] || "KODE");

    setFormData(prev => ({ ...prev, cabang: userCabang, lokasiCabang: defaultLokasiCabang }));

    if (userEmail && userCabang) {
        checkRevisionStatus(userEmail, userCabang).then(result => {
            if (result.rejected_submissions && result.rejected_submissions.length > 0) {
                setRejectedList(result.rejected_submissions);
                setRevisionListDialogOpen(true); // Membuka modal notification lonceng secara otomatis ketika data ditolak terdeteksi
            }
        }).catch(err => console.log("Gagal periksa revisi", err));
    }
  }, [router]);

  // --- 2. FETCH HARGA OTOMATIS ---
  useEffect(() => {
    if (formData.cabang && formData.lingkupPekerjaan) {
        fetchPricesData(formData.cabang, formData.lingkupPekerjaan)
            .then(data => {
                setPrices(data);
                // Dihapus reset table dari sini karena menyebabkan data auto-load terhapus
            })
            .catch(err => showAlert("Error", err.message, "error"));
    }
  }, [formData.cabang, formData.lingkupPekerjaan]);

  // --- 3. DETEKSI OTOMATIS DATA REVISI ---
  const getUlokString = () => `${formData.lokasiCabang}-${formData.lokasiTanggal}-${formData.lokasiManual}${formData.isRenovasi ? '-R' : ''}`;

  useEffect(() => {
    const ulokWithStrip = getUlokString();
    // Hilangkan strip hanya untuk kebutuhan komparasi data revisi agar lebih aman
    const ulokNoStrip = ulokWithStrip.replace(/-/g, '');
    const scope = formData.lingkupPekerjaan;

    if (ulokNoStrip.length >= 12 && scope && rejectedList.length > 0) {
        const match = rejectedList.find(item => {
            const itemUlok = (item['Nomor Ulok'] || '').replace(/-/g, '');
            const itemScope = item['Lingkup_Pekerjaan'] || item['Lingkup Pekerjaan'];
            return itemUlok === ulokNoStrip && itemScope === scope;
        });

        const promptKey = `${ulokNoStrip}-${scope}`;
        if (match && hasPromptedRevisionFor !== promptKey && !revisionDataToLoad) {
            setRevisionDataToLoad(match);
            setHasPromptedRevisionFor(promptKey); 
        }
    }
  }, [formData.lokasiCabang, formData.lokasiTanggal, formData.lokasiManual, formData.isRenovasi, formData.lingkupPekerjaan, rejectedList, hasPromptedRevisionFor]);

  // --- 4. EKSEKUSI AUTO-FILL DATA REVISI ---
  const handleLoadRevision = async (directItem?: any) => {
      const data = directItem || revisionDataToLoad;
      if (!data) return;
      
      const scope = data['Lingkup_Pekerjaan'] || data['Lingkup Pekerjaan'] || formData.lingkupPekerjaan;
      
      setRevisionDataToLoad(null);
      setIsRevisionLoading(true);

      // Ekstrak komponen ULOK jika di-load dari "Revisi Sekarang"
      const ulokStr = data['Nomor Ulok'] || '';
      const parts = ulokStr.split('-');
      const lokasiCabang = parts[0] || formData.lokasiCabang;
      const lokasiTanggal = parts[1] || formData.lokasiTanggal;
      const lokasiManual = parts[2] || formData.lokasiManual;
      const isRenovasi = parts.length > 3 && parts[3] === 'R';

      try {
          // 1. Fetch detail spesifik RAB revisi ini jika ada ID (Lazy Load dari klik lonceng)
          let fetchedDetailData: any = {};
          let itemsData = typeof data["Item_Details_JSON"] === 'string' ? JSON.parse(data["Item_Details_JSON"]) : (data["Item_Details_JSON"] || []);
          
          if (data.id && (!itemsData || itemsData.length === 0)) {
              try {
                  const detailRes = await fetchRABDetail(data.id);
                  fetchedDetailData = detailRes.data;
                  itemsData = fetchedDetailData.items || [];
              } catch (err) {
                  console.error("Gagal mengambil detail RAB:", err);
              }
          }

          const tokoRef = fetchedDetailData?.toko || data;
          const rabRef = fetchedDetailData?.rab || data;
          
          let fetchedTokoAlamat = "";
          if (rabRef.id_toko || tokoRef.id) {
              try {
                  const idToFetch = rabRef.id_toko || tokoRef.id;
                  const tokoRes = await fetchTokoDetail(idToFetch);
                  fetchedTokoAlamat = tokoRes.data?.alamat || "";
              } catch (e) {
                  console.log("Bypass fetch toko detail error");
              }
          }

          // Lingkup pekerjaan asli akan didapatkan dari detail toko
          let resolvedScope = tokoRef.lingkup_pekerjaan || scope;
          if (resolvedScope?.toUpperCase() === 'SIPIL') resolvedScope = 'Sipil';
          else if (resolvedScope?.toUpperCase() === 'ME') resolvedScope = 'ME';

          // 2. Fetch harga master sesuai lingkup pekerjaan yang benar
          const fetchedPrices = await fetchPricesData(formData.cabang, resolvedScope);
          setPrices(fetchedPrices);

          // Normalisasi Dropdown
          let finalProyek = rabRef.proyek || data["Proyek"] || formData.proyek;
          if (finalProyek?.toUpperCase() === 'REGULER') finalProyek = 'Alfamart Reguler';
          else if (finalProyek?.toUpperCase() === 'RENOVASI') finalProyek = 'Renovasi';

          let finalKategori = rabRef.kategori_lokasi || data["Kategori_Lokasi"] || formData.kategoriLokasi;
          if (finalKategori?.toUpperCase() === 'RUKO') finalKategori = 'Ruko';
          else if (finalKategori?.toUpperCase() === 'NON RUKO' || finalKategori?.toUpperCase() === 'NON_RUKO') finalKategori = 'Non Ruko';

          let finalDurasi = rabRef.durasi_pekerjaan || data["Durasi_Pekerjaan"] || formData.durasiPekerjaan;
          if (finalDurasi) finalDurasi = finalDurasi.toString().replace(/[^0-9]/g, ''); // Ambil digit saja ("30 Hari" -> "30")

          setFormData(prev => ({
              ...prev,
              lokasiCabang,
              lokasiTanggal,
              lokasiManual,
              isRenovasi,
              lingkupPekerjaan: resolvedScope,
              proyek: finalProyek,
              namaToko: tokoRef.nama_toko || data["nama_toko"] || data["Nama_Toko"] || prev.namaToko,
              alamat: fetchedTokoAlamat || tokoRef.alamat || data["Alamat"] || prev.alamat,
              kategoriLokasi: finalKategori,
              durasiPekerjaan: finalDurasi,
              luasAreaParkir: rabRef.luas_area_parkir?.toString() || data["Luas Area Parkir"]?.toString() || prev.luasAreaParkir,
              luasAreaSales: rabRef.luas_area_sales?.toString() || data["Luas Area Sales"]?.toString() || prev.luasAreaSales,
              luasGudang: rabRef.luas_gudang?.toString() || data["Luas Gudang"]?.toString() || prev.luasGudang,
              luasBangunan: rabRef.luas_bangunan?.toString() || data["Luas Bangunan"]?.toString() || prev.luasBangunan,
              luasAreaTerbuka: rabRef.luas_area_terbuka?.toString() || data["Luas Area Terbuka"]?.toString() || prev.luasAreaTerbuka,
          }));

          const newRows: any[] = [];
          if (Array.isArray(itemsData) && itemsData.length > 0) {
              // Format dari backend baru
              itemsData.forEach((item: any, i: number) => {
                  const category = item.kategori_pekerjaan;
                  const jobName = item.jenis_pekerjaan;
                  
                  const itemPriceRef = fetchedPrices[category]?.find((x: any) => x["Jenis Pekerjaan"] === jobName);
                  const isMatCond = itemPriceRef ? itemPriceRef["Harga Material"] === "Kondisional" : false;
                  const isUpahCond = itemPriceRef ? itemPriceRef["Harga Upah"] === "Kondisional" : false;

                  newRows.push({
                      id: Date.now() + i + Math.random(),
                      category: category,
                      jenisPekerjaan: jobName,
                      satuan: item.satuan || itemPriceRef?.["Satuan"],
                      volume: parseFloat(item.volume) || 0,
                      hargaMaterial: parseFloat(item.harga_material) || 0,
                      hargaUpah: parseFloat(item.harga_upah) || 0,
                      isKondisional: isMatCond || isUpahCond,
                      catatan: item.catatan || ''
                  });
              });
          } else {
              // Fallback format API lama (kolom 1-200)
              const details = itemsData;
              for (let i = 1; i <= 200; i++) {
                  if (details[`Jenis_Pekerjaan_${i}`]) {
                      const category = details[`Kategori_Pekerjaan_${i}`];
                      const jobName = details[`Jenis_Pekerjaan_${i}`];
                      
                      const itemPriceRef = fetchedPrices[category]?.find((x: any) => x["Jenis Pekerjaan"] === jobName);
                      const isMatCond = itemPriceRef ? itemPriceRef["Harga Material"] === "Kondisional" : false;
                      const isUpahCond = itemPriceRef ? itemPriceRef["Harga Upah"] === "Kondisional" : false;

                      newRows.push({
                          id: Date.now() + i + Math.random(),
                          category: category,
                          jenisPekerjaan: jobName,
                          satuan: details[`Satuan_Item_${i}`] || itemPriceRef?.["Satuan"],
                          volume: parseFloat(details[`Volume_Item_${i}`]) || 0,
                          hargaMaterial: parseFloat(details[`Harga_Material_Item_${i}`]) || 0,
                          hargaUpah: parseFloat(details[`Harga_Upah_Item_${i}`]) || 0,
                          isKondisional: isMatCond || isUpahCond,
                          catatan: details[`Catatan_Item_${i}`] || ''
                      });
                  }
              }
          }
          setTableRows(newRows);
          setInitialFormState("TRACKING_PENDING");
          showAlert("Berhasil", "Data revisi berhasil dimuat ke dalam form.", "success");
      } catch (err) {
          showAlert("Error", "Terjadi kesalahan saat memuat data revisi.", "error");
      } finally {
          setIsRevisionLoading(false);
      }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showAlert("Peringatan", "Ukuran logo maksimal 2MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setLogoPreview(base64);
      setFormData(prev => ({ ...prev, logo: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoPreview(null);
    setFormData(prev => ({ ...prev, logo: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset internal value so same file can be re-uploaded
    }
  };

  // --- 5. KALKULASI REAKTIF ---
  const luasTerbangun = useMemo(() => {
    return (parseFloat(formData.luasBangunan) || 0) + ((parseFloat(formData.luasAreaTerbuka) || 0) / 2);
  }, [formData.luasBangunan, formData.luasAreaTerbuka]);

  const totalEstimasi = useMemo(() => {
    return tableRows.reduce((acc, row) => acc + (row.volume * (row.hargaMaterial + row.hargaUpah)), 0);
  }, [tableRows]);
  
  const pembulatan = Math.floor(totalEstimasi / 10000) * 10000;
  const ppn = pembulatan * 0.11;
  const grandTotal = pembulatan + ppn;

  // --- 6. HANDLER INPUT NORMAL ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === 'checkbox' ? checked : value;
    if (name === 'lokasiManual') {
        finalValue = formData.isRenovasi ? String(finalValue).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : String(finalValue).replace(/[^0-9]/g, '');
    }
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSelectChange = (name: string, value: string) => {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (name === 'lingkupPekerjaan') {
          // Hanya reset tabel jika user manual mengganti dropdown scope dari form
          setTableRows([]);
      }
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

  // --- 7. SUBMIT DATA MENGGUNAKAN API SERVICE ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (luasTerbangun <= 0) return showAlert("Peringatan", "Luas Terbangun tidak boleh kosong.", "error");
    if (formData.lokasiCabang.length < 4 || formData.lokasiTanggal.length !== 4 || formData.lokasiManual.length !== 4) return showAlert("Peringatan", "Format Nomor Ulok belum lengkap.", "error");

    setIsLoading(true);

    // Filter dan petakan baris tabel menjadi array detail_items
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
      setIsLoading(false);
      return showAlert("Peringatan", "Minimal harus ada 1 item pekerjaan dengan volume.", "warning");
    }

    const payloadData = {
      nomor_ulok: getUlokString(),
      nama_toko: formData.namaToko,
      proyek: formData.proyek,
      cabang: formData.cabang,
      alamat: formData.alamat,
      nama_kontraktor: sessionStorage.getItem("nama_pt") || "-",
      lingkup_pekerjaan: formData.lingkupPekerjaan.toUpperCase(),
      email_pembuat: sessionStorage.getItem("loggedInUserEmail") || "",
      nama_pt: sessionStorage.getItem("nama_pt") || "-",
      durasi_pekerjaan: formData.durasiPekerjaan,
      kategori_lokasi: formData.kategoriLokasi.toUpperCase(),
      luas_bangunan: String(formData.luasBangunan || "0"),
      luas_terbangun: String(luasTerbangun.toFixed(2)),
      luas_area_terbuka: String(formData.luasAreaTerbuka || "0"),
      luas_area_parkir: String(formData.luasAreaParkir || "0"),
      luas_area_sales: String(formData.luasAreaSales || "0"),
      luas_gudang: String(formData.luasGudang || "0"),
      logo: formData.logo,
      detail_items: detailItems
    };

    // ==========================================
    // CONSOLE LOG UNTUK DEBUGGING PAYLOAD
    // ==========================================
    console.log("🚀 PAYLOAD SUBMIT RAB:", JSON.stringify(payloadData, null, 2));

    try {
        // Simpan response API ke dalam variabel submitRes
        const submitRes = await submitRABData(payloadData);
        
        // Tangkap id_toko dari data response API
        const idToko = submitRes.data?.id_toko;

        // Tambahkan id_toko ke dalam parameter URL!
        const params = new URLSearchParams({ 
            id_toko: idToko ? String(idToko) : '', 
            ulok: getUlokString(), 
            lingkup: formData.lingkupPekerjaan, 
            locked: 'true' 
        });
        
        showAlert("Berhasil", "Pengajuan RAB berhasil disimpan dan PDF sedang diproses.", "success");
        setTimeout(() => { router.push(`/gantt?${params.toString()}`); }, 1500);
    } catch (err: any) {
        setIsLoading(false);
        showAlert("Error", err.message, "error");
    }
  };

  const showAlert = (title: string, desc: string, type: "info" | "error" | "success" | "warning") => {
    setAlertMessage({ title, desc, type }); setAlertOpen(true);
  };

  const getAlertStyle = () => {
    if (alertMessage.type === 'error') return { bgIcon: 'bg-red-100 text-red-600', btn: 'bg-red-600 hover:bg-red-700' };
    if (alertMessage.type === 'warning') return { bgIcon: 'bg-amber-100 text-amber-600', btn: 'bg-amber-500 hover:bg-amber-600' };
    if (alertMessage.type === 'success') return { bgIcon: 'bg-green-100 text-green-600', btn: 'bg-green-600 hover:bg-green-700' };
    return { bgIcon: 'bg-blue-100 text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700' };
  };

  const activeCategories = formData.lingkupPekerjaan === 'Sipil' ? SIPIL_CATEGORIES : formData.lingkupPekerjaan === 'ME' ? ME_CATEGORIES : [];

  const isFormComplete = 
    formData.namaToko.trim() !== '' &&
    formData.lokasiTanggal.trim() !== '' &&
    formData.lokasiManual.trim() !== '' &&
    formData.proyek !== '' &&
    formData.alamat.trim() !== '' &&
    formData.lingkupPekerjaan !== '' &&
    formData.kategoriLokasi !== '' &&
    formData.durasiPekerjaan !== '' &&
    formData.luasBangunan !== '' &&
    formData.luasAreaTerbuka !== '' &&
    formData.luasAreaSales !== '' &&
    formData.luasGudang !== '' &&
    formData.luasAreaParkir !== '';

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      
      {/* Menggunakan AppNavbar, dengan memasukkan tombol Lonceng ke prop rightActions */}
      <AppNavbar 
        title="Rencana Anggaran Biaya"
        showBackButton={true}
        backHref="/dashboard"
        rightActions={
          <button 
            onClick={() => setRevisionListDialogOpen(true)} 
            className="relative p-2 rounded-full hover:bg-white/20 transition-colors focus:outline-none" 
            title="Lihat Daftar Revisi"
          >
            <Bell className="w-6 h-6 drop-shadow-md text-white" />
            {rejectedList.length > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-yellow-500 border-2 border-red-700 rounded-full">
                {rejectedList.length}
              </span>
            )}
          </button>
        }
      />

      <main className="max-w-350 mx-auto p-4 md:p-8 mt-4">
        {isRevisionLoading && (
          <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm transition-all duration-300">
            <div className="bg-white p-5 rounded-2xl shadow-xl flex items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
              <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 text-lg">Memuat Data Revisi...</span>
                <span className="text-sm text-slate-500">Mempersiapkan rincian form Anda</span>
              </div>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <Card className="mb-8 shadow-sm">
            <CardHeader className="border-b bg-slate-50/50 pb-4"><CardTitle className="text-red-700">Data & Identitas Proyek</CardTitle></CardHeader>
            <CardContent className="pt-6">
              {/* --- BAGIAN LOGO PERUSAHAAN --- */}
              <div className="mb-8 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col md:flex-row items-center gap-8 transition-all hover:border-slate-300">
                <div className="relative group shrink-0">
                  <div className={`w-32 h-32 rounded-2xl overflow-hidden shadow-md border-2 border-white flex items-center justify-center bg-white ${!logoPreview ? 'bg-slate-50' : ''}`}>
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-300">
                        <ImageIcon className="w-10 h-10" />
                        <span className="text-[10px] font-bold mt-1 uppercase tracking-tight">Logo</span>
                      </div>
                    )}
                  </div>
                  {logoPreview && (
                    <button 
                      type="button" 
                      onClick={removeLogo}
                      className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-transform hover:scale-110 active:scale-95"
                      title="Hapus Logo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center md:text-left">
                  <h3 className="font-extrabold text-slate-800 text-lg tracking-tight">Logo Perusahaan</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Unggah logo perusahaan anda untuk dicetak pada dokumen SPH. <br className="hidden md:block" />
                    Format yang didukung: <b>PNG, JPG, JPEG</b>.
                  </p>
                  <div className="pt-2">
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm text-sm font-bold text-slate-700 cursor-pointer transition-all hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 group">
                      <Upload className="w-4 h-4 text-red-500 transition-transform group-hover:-translate-y-0.5" />
                      {logoPreview ? 'Ganti Logo' : 'Pilih Logo'}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleLogoChange} 
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* --- GRID FORM IDENTITAS --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2"><Label>Nama Toko <span className="text-red-500">*</span></Label><Input name="namaToko" value={formData.namaToko} onChange={handleInputChange} placeholder="Masukkan nama toko" className="bg-white" required /></div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 mb-2">
                    <Checkbox id="isRenovasi" checked={formData.isRenovasi} onCheckedChange={(c) => setFormData(prev => ({...prev, isRenovasi: !!c, proyek: !!c ? 'Renovasi' : prev.proyek}))}/>
                    <Label htmlFor="isRenovasi" className="font-normal cursor-pointer">Proyek Renovasi (Format Baru)</Label>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input name="lokasiCabang" placeholder="Kode" className="w-[30%] bg-slate-100 text-slate-500 font-bold cursor-not-allowed border-slate-200" value={formData.lokasiCabang} readOnly tabIndex={-1} />
                    <span className="font-bold text-slate-400">-</span>
                    <Input name="lokasiTanggal" placeholder="YYMM" className="w-[30%] bg-white" maxLength={4} value={formData.lokasiTanggal} onChange={handleInputChange} required />
                    <span className="font-bold text-slate-400">-</span>
                    <Input name="lokasiManual" placeholder={formData.isRenovasi ? "C0B4" : "0001"} className="w-[40%] bg-white uppercase" maxLength={4} value={formData.lokasiManual} onChange={handleInputChange} required />
                    {formData.isRenovasi && (<><span className="font-bold text-slate-400">-</span><Input readOnly value="R" className="w-12 bg-slate-100 text-center font-bold text-slate-500 cursor-not-allowed border-slate-200" tabIndex={-1} /></>)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Proyek <span className="text-red-500">*</span></Label>
                  <Select 
                    onValueChange={(val) => handleSelectChange('proyek', val)} 
                    value={formData.proyek} 
                    disabled={formData.isRenovasi} 
                    required
                  >
                    <SelectTrigger className={formData.isRenovasi ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200" : "bg-white"}>
                      <SelectValue placeholder="-- Pilih Jenis Proyek --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alfamart Reguler">Reguler</SelectItem>
                      <SelectItem value="Renovasi">Renovasi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 lg:col-span-3"><Label>Alamat Lengkap <span className="text-red-500">*</span></Label><Input name="alamat" value={formData.alamat} onChange={handleInputChange} placeholder="Masukkan alamat lengkap proyek" className="bg-white" required /></div>
                
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2"><Label>Cabang <span className="text-red-500">*</span></Label><Input value={formData.cabang} readOnly className="bg-slate-100 text-slate-600 font-semibold cursor-not-allowed border-slate-200" tabIndex={-1} /></div>
                  <div className="space-y-2"><Label>Lingkup Pekerjaan <span className="text-red-500">*</span></Label><Select onValueChange={(val) => handleSelectChange('lingkupPekerjaan', val)} value={formData.lingkupPekerjaan} required><SelectTrigger className="bg-white"><SelectValue placeholder="-- Pilih Lingkup Pekerjaan --" /></SelectTrigger><SelectContent><SelectItem value="Sipil">Sipil</SelectItem><SelectItem value="ME">ME</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Kategori Lokasi <span className="text-red-500">*</span></Label><Select onValueChange={(val) => handleSelectChange('kategoriLokasi', val)} value={formData.kategoriLokasi} required><SelectTrigger className="bg-white"><SelectValue placeholder="-- Pilih Kategori Lokasi --" /></SelectTrigger><SelectContent><SelectItem value="Ruko">Ruko</SelectItem><SelectItem value="Non Ruko">Non Ruko</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Durasi Pekerjaan (Hari) <span className="text-red-500">*</span></Label><Input type="number" min="1" step="1" name="durasiPekerjaan" value={formData.durasiPekerjaan} onChange={handleInputChange} placeholder="Masukkan jumlah hari" className="bg-white" required /></div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="mb-8 shadow-sm">
            <CardHeader className="border-b bg-slate-50/50 pb-4"><CardTitle className="text-red-700">Dimensi & Ukuran Proyek</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-6">
              <div className="space-y-2"><Label>Luas Bangunan (m²) <span className="text-red-500">*</span></Label><Input type="number" step="any" name="luasBangunan" value={formData.luasBangunan} onChange={handleInputChange} placeholder="0.00" className="bg-white" required /></div>
              <div className="space-y-2"><Label>Luas Area Terbuka (m²) <span className="text-red-500">*</span></Label><Input type="number" step="any" name="luasAreaTerbuka" value={formData.luasAreaTerbuka} onChange={handleInputChange} placeholder="0.00" className="bg-white" required /></div>
              <div className="space-y-2"><Label>Luas Area Sales (m²) <span className="text-red-500">*</span></Label><Input type="number" step="any" name="luasAreaSales" value={formData.luasAreaSales} onChange={handleInputChange} placeholder="0.00" className="bg-white" required /></div>
              <div className="space-y-2"><Label>Luas Gudang (m²) <span className="text-red-500">*</span></Label><Input type="number" step="any" name="luasGudang" value={formData.luasGudang} onChange={handleInputChange} placeholder="0.00" className="bg-white" required /></div>
              <div className="space-y-2"><Label>Luas Area Parkir (m²) <span className="text-red-500">*</span></Label><Input type="number" step="any" name="luasAreaParkir" value={formData.luasAreaParkir} onChange={handleInputChange} placeholder="0.00" className="bg-white" required /></div>
              <div className="space-y-2"><Label className="text-blue-700 font-bold">Luas Terbangun (m²) <span className="text-xs font-normal text-slate-400">(Auto)</span></Label><Input readOnly value={luasTerbangun > 0 ? luasTerbangun.toFixed(2) : ''} className="bg-blue-50 border-blue-200 font-bold text-blue-800 cursor-not-allowed" placeholder="0.00" tabIndex={-1} /></div>
            </CardContent>
          </Card>

          {activeCategories.length > 0 && (
            <div className="space-y-6 mb-8">
              <h2 className="text-xl font-bold text-slate-800 border-b-2 border-red-500 pb-2 inline-block">Detail Bill of Quantities (BoQ)</h2>
              {activeCategories.map((category) => {
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
                        <table className="w-full text-sm text-left border-collapse min-w-275">
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
                              <th className="p-2 border border-red-100 w-32 bg-red-50/50">Material (b)</th><th className="p-2 border border-red-100 w-32 bg-red-50/50">Upah (c)</th>
                              <th className="p-2 border border-red-100 w-32 bg-red-50/50">Material (d=a×b)</th><th className="p-2 border border-red-100 w-32 bg-red-50/50">Upah (e=a×c)</th>
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
                                <td className="p-2 border-r border-slate-100"><Input type="number" min="0" step="any" className={`h-9 px-2 text-center transition-colors text-xs ${row.satuan === 'Ls' ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-white border-slate-300 focus-visible:ring-blue-500 font-medium text-slate-800'}`} value={row.volume || ''} onChange={(e) => updateRow(row.id, 'volume', Math.max(0, parseFloat(e.target.value) || 0))} readOnly={row.satuan === 'Ls'} /></td>
                                <td className="p-2 border-r border-slate-100"><Input type="text" className="h-9 px-2 text-right transition-colors text-xs bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200" value={row.hargaMaterial === 0 ? '' : formatAngka(row.hargaMaterial)} readOnly tabIndex={-1} /></td>
                                <td className="p-2 border-r border-slate-100"><Input type="text" className={`h-9 px-2 text-right transition-colors text-xs ${!row.isKondisional ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-yellow-50 border-yellow-300 focus-visible:ring-yellow-500 text-yellow-900 font-bold'}`} value={row.hargaUpah === 0 ? '' : formatAngka(row.hargaUpah)} onChange={(e) => updateRow(row.id, 'hargaUpah', parseFloat(e.target.value.replace(/\./g, '')) || 0)} readOnly={!row.isKondisional} /></td>
                                <td className="p-2 border-r border-slate-100 bg-slate-50 text-right text-slate-600 font-medium text-xs">{toRupiah(row.volume * row.hargaMaterial)}</td>
                                <td className="p-2 border-r border-slate-100 bg-slate-50 text-right text-slate-600 font-medium text-xs">{toRupiah(row.volume * row.hargaUpah)}</td>
                                <td className="p-2 border-r border-slate-100 text-right font-bold text-slate-800 bg-slate-100 text-xs">{toRupiah(row.volume * (row.hargaMaterial + row.hargaUpah))}</td>
                                <td className="p-2 border-r border-slate-100"><Input type="text" placeholder="Catatan..." className="h-9 px-2 text-xs bg-white border-slate-300 focus-visible:ring-blue-500" value={row.catatan || ''} onChange={(e) => updateRow(row.id, 'catatan', e.target.value)} /></td>
                                <td className="p-2 text-center"><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeRow(row.id)}><Trash2 className="w-4 h-4" /></Button></td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                            <tr>
                              <td colSpan={11} className="p-3 text-center bg-white border-b border-slate-200">
                                <Button type="button" size="sm" variant="outline" className="h-8 bg-white border-dashed border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 w-full max-w-sm" onClick={() => addRow(category)}><Plus className="w-4 h-4 mr-1" /> Tambah Item Pekerjaan</Button>
                              </td>
                            </tr>
                            <tr><td colSpan={8} className="p-3 text-right font-bold text-slate-600">Sub Total {category}:</td><td className="p-3 text-right font-bold text-red-700 whitespace-nowrap">{toRupiah(subTotal)}</td><td colSpan={2}></td></tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                    {itemsInCategory.length === 0 && (
                        <div className="p-6 text-center">
                            <Button type="button" size="sm" variant="outline" className="h-8 bg-white border-dashed border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400" onClick={() => addRow(category)}><Plus className="w-4 h-4 mr-1" /> Tambah Item Pekerjaan</Button>
                        </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}

          <div className="bg-[#fff9e6] border-2 border-[#ffc107] p-6 md:p-8 rounded-2xl shadow-sm mb-8">
              <div className="flex justify-between items-center mb-3"><span className="text-slate-600 font-medium">Total Estimasi :</span><span className="font-semibold text-lg text-slate-800">{toRupiah(totalEstimasi)}</span></div>
              <div className="flex justify-between items-center mb-3"><span className="text-slate-600 font-medium">Pembulatan :</span><span className="font-semibold text-lg text-slate-800">{toRupiah(pembulatan)}</span></div>
              <div className="flex justify-between items-center mb-6"><span className="text-slate-600 font-medium">PPN (11%) :</span><span className="font-semibold text-lg text-slate-800">{toRupiah(ppn)}</span></div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-t border-yellow-300 pt-6 gap-4"><span className="text-xl md:text-2xl font-bold text-slate-800">GRAND TOTAL</span><span className="text-3xl md:text-4xl font-extrabold text-red-600">{toRupiah(grandTotal)}</span></div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 sticky bottom-4 z-10 p-4 bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200">
            <Button type="submit" disabled={isLoading || !isFormComplete || !isFormModified} title={!isFormModified ? "Silakan buat perubahan pada form terlebih dahulu" : ""} className="w-full md:flex-1 h-14 text-lg font-bold bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-500 shadow-md transition-all">
              {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sedang Mengirim Data...</> : <><Save className="w-5 h-5 mr-2" /> Simpan & Lanjut ke Gantt Chart</>}
            </Button>
            <Button type="button" variant="outline" className="w-full md:w-1/3 h-14 text-lg font-semibold bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-red-600" onClick={() => setResetDialogOpen(true)}>
              Reset Ulang Form
            </Button>
          </div>
        </form>
      </main>

      <AlertDialog open={revisionListDialogOpen} onOpenChange={setRevisionListDialogOpen}>
        <AlertDialogContent className="rounded-2xl max-w-md max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 border-b pb-3 mb-3">
              <div className="bg-amber-100 text-amber-600 p-2 rounded-full">
                  <Bell className="w-6 h-6" />
              </div>
              <AlertDialogTitle className="text-lg">Daftar Pekerjaan Revisi</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left text-slate-600">
              {rejectedList.length > 0 ? (
                  <span className="block space-y-4">
                      <span className="block text-sm">Berikut adalah daftar Nomor Ulok yang dikembalikan dan perlu Anda revisi/ajukan ulang:</span>
                      <span className="flex flex-col space-y-3">
                          {rejectedList.map((item, idx) => (
                              <span key={idx} className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex flex-col gap-3">
                                  <span className="block">
                                      <span className="font-bold text-slate-800 text-base">{item['Nomor Ulok']}</span>
                                      <span className="text-sm text-slate-500 block">Lingkup: {item['Lingkup_Pekerjaan'] || item['Lingkup Pekerjaan']}</span>
                                  </span>
                                  <Button 
                                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold"
                                      onClick={() => {
                                          setRevisionListDialogOpen(false);
                                          handleLoadRevision(item);
                                      }}
                                  >
                                      Revisi Sekarang
                                  </Button>
                              </span>
                          ))}
                      </span>
                  </span>
              ) : (
                  <span className="block text-center py-6 text-slate-500">Hebat! Tidak ada data pekerjaan yang perlu direvisi saat ini.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogAction className="w-full bg-slate-800 hover:bg-slate-900" onClick={() => setRevisionListDialogOpen(false)}>Tutup Notifikasi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL ALERT UMUM */}
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent className="rounded-2xl max-w-sm text-center">
          <AlertDialogHeader>
            <div className={`mx-auto w-16 h-16 flex items-center justify-center rounded-full mb-4 ${getAlertStyle().bgIcon}`}>
              {alertMessage.type === 'warning' ? <AlertTriangle className="w-8 h-8" /> : <Info className="w-8 h-8" />}
            </div>
            <AlertDialogTitle className="text-center">{alertMessage.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-center">{alertMessage.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction className={`w-full ${getAlertStyle().btn}`} onClick={() => setAlertOpen(false)}>Mengerti</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL KONFIRMASI LOAD REVISI SAAT NGETIK ULOK */}
      <AlertDialog open={!!revisionDataToLoad} onOpenChange={(open) => { if (!open) setRevisionDataToLoad(null); }}>
        <AlertDialogContent className="rounded-2xl max-w-sm text-center">
          <AlertDialogHeader>
            <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full mb-4 bg-amber-100 text-amber-600"><AlertTriangle className="w-8 h-8" /></div>
            <AlertDialogTitle className="text-center">Data Revisi Ditemukan</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Ditemukan data REVISI untuk No. Ulok <strong>{revisionDataToLoad?.['Nomor Ulok']}</strong> ({formData.lingkupPekerjaan}). <br/><br/>Apakah Anda ingin memuat data ini?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:space-x-2">
            <AlertDialogCancel className="w-full sm:w-1/2 mt-0" onClick={() => setRevisionDataToLoad(null)}>Abaikan</AlertDialogCancel>
            <AlertDialogAction onClick={handleLoadRevision} className="w-full sm:w-1/2 bg-amber-500 hover:bg-amber-600">Ya, Muat Data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL KONFIRMASI RESET FORM */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Reset Form</AlertDialogTitle>
            <AlertDialogDescription>Apakah Anda yakin ingin mereset seluruh data form ini?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetDialogOpen(false)}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700 text-white">Ya, Reset Form</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}