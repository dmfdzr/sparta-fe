// app/ubah-rab-item/page.tsx
"use client"

import React, { useEffect, useMemo, useRef, useState } from "react";
import AppNavbar from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Plus, Save, Trash2, Upload, Info, FileSpreadsheet, Search } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { BRANCH_GROUPS, ME_CATEGORIES, SIPIL_CATEGORIES, BRANCH_TO_ULOK } from "@/lib/constants";
import {
  fetchPricesData,
  fetchRABDetail,
  fetchRABList,
  replaceRabItems,
  updateRabItemsBulk,
  type RABDetailResponse,
} from "@/lib/api";

const toRupiah = (num: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num || 0);

type RabOption = {
  id: number;
  nomor_ulok: string;
  nama_toko?: string | null;
  cabang?: string | null;
};

type RowItem = {
  tempId: string;
  id?: number;
  category: string;
  jenisPekerjaan: string;
  satuan: string;
  volume: number;
  hargaMaterial: number;
  hargaUpah: number;
  totalMaterial?: number;
  totalUpah?: number;
  totalHarga?: number;
  isKondisional: boolean;
  catatan: string;
};

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  rows.push(row);

  return rows.filter(r => r.some(cell => cell.trim() !== ""));
};

export default function UbahRabItemPage() {
  const { user } = useSession();

  const [cabangOptions, setCabangOptions] = useState<string[]>([]);
  const [selectedCabang, setSelectedCabang] = useState<string>("");
  const [rabOptions, setRabOptions] = useState<RabOption[]>([]);
  const [selectedRabId, setSelectedRabId] = useState<number | null>(null);
  const [searchUlok, setSearchUlok] = useState("");

  const filteredRabOptions = useMemo(() => {
    if (!searchUlok) return rabOptions;
    const lowerSearch = searchUlok.toLowerCase();
    return rabOptions.filter(item => 
      item.nomor_ulok.toLowerCase().includes(lowerSearch) || 
      (item.nama_toko && item.nama_toko.toLowerCase().includes(lowerSearch))
    );
  }, [rabOptions, searchUlok]);
  const [rabDetail, setRabDetail] = useState<RABDetailResponse | null>(null);

  const [prices, setPrices] = useState<Record<string, any[]>>({});
  const [tableRows, setTableRows] = useState<RowItem[]>([]);
  const [replaceMode, setReplaceMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [grandTotal, setGrandTotal] = useState<number | null>(null);
  const [grandTotalNonSbo, setGrandTotalNonSbo] = useState<number | null>(null);
  const [grandTotalFinal, setGrandTotalFinal] = useState<number | null>(null);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ title: string; desc: string; type: "info" | "error" | "success" | "warning" }>({
    title: "",
    desc: "",
    type: "info"
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showAlert = (title: string, desc: string, type: "info" | "error" | "success" | "warning") => {
    setAlertMessage({ title, desc, type });
    setAlertOpen(true);
  };

  const getAlertStyle = () => {
    if (alertMessage.type === "error") return { bgIcon: "bg-red-100 text-red-600", btn: "bg-red-600 hover:bg-red-700 focus:ring-red-600" };
    if (alertMessage.type === "warning") return { bgIcon: "bg-amber-100 text-amber-600", btn: "bg-amber-500 hover:bg-amber-600 focus:ring-amber-500" };
    if (alertMessage.type === "success") return { bgIcon: "bg-green-100 text-green-600", btn: "bg-green-600 hover:bg-green-700 focus:ring-green-600" };
    return { bgIcon: "bg-blue-100 text-blue-600", btn: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-600" };
  };

  useEffect(() => {
    if (!user) return;

    const userCabang = user.cabang.toUpperCase();
    if (user.isHO) {
      const allCabang = Array.from(new Set([
        "HEAD OFFICE",
        ...Object.keys(BRANCH_TO_ULOK)
      ])).sort();
      setCabangOptions(allCabang);
    } else {
      const group = Object.values(BRANCH_GROUPS).find(g => g.includes(userCabang));
      const allowed = group ? group : [userCabang];
      setCabangOptions(allowed);
      setSelectedCabang(userCabang);
    }
  }, [user]);

  useEffect(() => {
    if (!selectedCabang) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchRABList({ cabang: selectedCabang });
        const data = (res.data || []).sort((a, b) => (b.id || 0) - (a.id || 0));
        setRabOptions(data.map(item => ({
          id: item.id,
          nomor_ulok: item.nomor_ulok,
          nama_toko: item.nama_toko,
          cabang: item.cabang
        })));
        setSelectedRabId(null);
        setRabDetail(null);
        setTableRows([]);
        setPrices({});
        setReplaceMode(false);
        setSearchUlok("");
        setGrandTotal(null);
        setGrandTotalNonSbo(null);
        setGrandTotalFinal(null);
      } catch (err: any) {
        showAlert("Error", err.message || "Gagal memuat daftar RAB.", "error");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [selectedCabang]);

  useEffect(() => {
    if (!selectedRabId) return;

    const loadDetail = async () => {
      setLoading(true);
      try {
        const detailRes = await fetchRABDetail(selectedRabId);
        setRabDetail(detailRes.data);
        setGrandTotal(Number(detailRes.data?.rab?.grand_total ?? 0));
        setGrandTotalNonSbo(Number(detailRes.data?.rab?.grand_total_non_sbo ?? 0));
        setGrandTotalFinal(Number(detailRes.data?.rab?.grand_total_final ?? 0));

        const rawScope = detailRes.data?.toko?.lingkup_pekerjaan || "";
        const scope = rawScope.toUpperCase() === "SIPIL" ? "Sipil" : (rawScope.toUpperCase() === "ME" ? "ME" : rawScope);
        if (detailRes.data?.toko?.cabang && scope) {
          const priceData = await fetchPricesData(detailRes.data.toko.cabang, scope);
          setPrices(priceData || {});
        } else {
          setPrices({});
        }

        const rows: RowItem[] = (detailRes.data.items || []).map((item) => {
          const tempId = `id-${item.id}`;
          return {
            tempId,
            id: item.id,
            category: item.kategori_pekerjaan,
            jenisPekerjaan: item.jenis_pekerjaan,
            satuan: item.satuan,
            volume: Number(item.volume) || 0,
            hargaMaterial: Number(item.harga_material) || 0,
            hargaUpah: Number(item.harga_upah) || 0,
            totalMaterial: Number(item.total_material) || 0,
            totalUpah: Number(item.total_upah) || 0,
            totalHarga: Number(item.total_harga) || 0,
            isKondisional: false,
            catatan: item.catatan || ""
          };
        });

        setTableRows(rows);
        setReplaceMode(false);
      } catch (err: any) {
        showAlert("Error", err.message || "Gagal memuat detail RAB.", "error");
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [selectedRabId]);

  const activeCategories = useMemo(() => {
    const scope = rabDetail?.toko?.lingkup_pekerjaan?.toUpperCase();
    if (scope === "SIPIL") return SIPIL_CATEGORIES;
    if (scope === "ME") return ME_CATEGORIES;
    return [] as string[];
  }, [rabDetail]);

  const updateRow = (tempId: string, field: keyof RowItem, value: any) => {
    setTableRows(prev => prev.map(row => {
      if (row.tempId !== tempId) return row;
      let updatedRow = { ...row, [field]: value } as RowItem;

      if (field === "volume" || field === "hargaMaterial" || field === "hargaUpah") {
        updatedRow.totalMaterial = undefined;
        updatedRow.totalUpah = undefined;
        updatedRow.totalHarga = undefined;
      }

      if (field === "category") {
        updatedRow.jenisPekerjaan = "";
        updatedRow.satuan = "";
        updatedRow.hargaMaterial = 0;
        updatedRow.hargaUpah = 0;
        updatedRow.totalMaterial = undefined;
        updatedRow.totalUpah = undefined;
        updatedRow.totalHarga = undefined;
        updatedRow.isKondisional = false;
      }

      if (field === "jenisPekerjaan" && value) {
        const itemData = prices[updatedRow.category]?.find((item: any) => item["Jenis Pekerjaan"] === value);
        if (itemData) {
          updatedRow.satuan = itemData["Satuan"] || "";
          const isMatCond = itemData["Harga Material"] === "Kondisional";
          const isUpahCond = itemData["Harga Upah"] === "Kondisional";
          updatedRow.isKondisional = isMatCond || isUpahCond;
          updatedRow.hargaMaterial = isMatCond ? 0 : Number(itemData["Harga Material"]) || 0;
          updatedRow.hargaUpah = (isMatCond || isUpahCond) ? 0 : Number(itemData["Harga Upah"]) || 0;
          if (updatedRow.satuan === "Ls") updatedRow.volume = 1;
          updatedRow.totalMaterial = undefined;
          updatedRow.totalUpah = undefined;
          updatedRow.totalHarga = undefined;
        }
      }

      return updatedRow;
    }));
  };

  const addRow = () => {
    const tempId = `tmp-${Date.now()}-${Math.random()}`;
    setTableRows(prev => ([
      ...prev,
      {
        tempId,
        category: activeCategories[0] || "",
        jenisPekerjaan: "",
        satuan: "",
        volume: 0,
        hargaMaterial: 0,
        hargaUpah: 0,
        isKondisional: false,
        catatan: ""
      }
    ]));
    setReplaceMode(true);
  };

  const removeRow = (tempId: string) => {
    setTableRows(prev => prev.filter(row => row.tempId !== tempId));
    setReplaceMode(true);
  };

  const downloadTemplate = () => {
    const header = ["kategori_pekerjaan", "jenis_pekerjaan", "satuan", "volume", "harga_material", "harga_upah", "total_material", "total_upah", "total_harga", "catatan"];
    const sample = ["PEKERJAAN PERSIAPAN", "Contoh Item", "Ls", "1", "0", "0", "0", "0", "0", ""];
    const csv = `${header.join(",")}\n${sample.join(",")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template-rab-item.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCsvFile = async (file: File) => {
    if (!selectedRabId) {
      showAlert("Peringatan", "Pilih nomor ULOK terlebih dahulu.", "warning");
      return;
    }

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      showAlert("Peringatan", "CSV harus berisi header dan minimal 1 baris data.", "warning");
      return;
    }

    const headers = rows[0].map(normalizeHeader);
    const dataRows = rows.slice(1);
    const parsed: RowItem[] = [];

    dataRows.forEach((cells, idx) => {
      const row: Record<string, string> = {};
      headers.forEach((header, i) => { row[header] = cells[i] ? cells[i].trim() : ""; });

      const kategori = row.kategori_pekerjaan || "";
      const jenis = row.jenis_pekerjaan || "";
      if (!kategori || !jenis) return;

      const tempId = `csv-${Date.now()}-${idx}-${Math.random()}`;
      const baseRow: RowItem = {
        tempId,
        category: kategori,
        jenisPekerjaan: jenis,
        satuan: row.satuan || "",
        volume: Number(row.volume || 0),
        hargaMaterial: Number(row.harga_material || 0),
        hargaUpah: Number(row.harga_upah || 0),
        totalMaterial: row.total_material ? Number(row.total_material) : undefined,
        totalUpah: row.total_upah ? Number(row.total_upah) : undefined,
        totalHarga: row.total_harga ? Number(row.total_harga) : undefined,
        isKondisional: false,
        catatan: row.catatan || ""
      };

      const itemData = prices[kategori]?.find((item: any) => item["Jenis Pekerjaan"] === jenis);
      if (itemData) {
        const isMatCond = itemData["Harga Material"] === "Kondisional";
        const isUpahCond = itemData["Harga Upah"] === "Kondisional";
        baseRow.isKondisional = isMatCond || isUpahCond;

        if (!row.satuan) baseRow.satuan = itemData["Satuan"] || baseRow.satuan;
        if (!row.harga_material) baseRow.hargaMaterial = isMatCond ? 0 : Number(itemData["Harga Material"]) || 0;
        if (!row.harga_upah) baseRow.hargaUpah = (isMatCond || isUpahCond) ? 0 : Number(itemData["Harga Upah"]) || 0;
        if (baseRow.satuan === "Ls" && !row.volume) baseRow.volume = 1;
      }
      parsed.push(baseRow);
    });

    if (parsed.length === 0) {
      showAlert("Peringatan", "Tidak ada baris CSV yang valid.", "warning");
      return;
    }
    setTableRows(parsed);
    setReplaceMode(true);
  };

  const handleSave = async () => {
    if (!selectedRabId) {
      showAlert("Peringatan", "Pilih nomor ULOK terlebih dahulu.", "warning");
      return;
    }

    const itemsPayload = tableRows
      .filter(row => row.jenisPekerjaan && Number(row.volume) > 0)
      .map(row => ({
        id: row.id,
        kategori_pekerjaan: row.category,
        jenis_pekerjaan: row.jenisPekerjaan,
        satuan: row.satuan,
        volume: Number(row.volume),
        harga_material: Number(row.hargaMaterial),
        harga_upah: Number(row.hargaUpah),
        total_material: row.totalMaterial ?? (Number(row.volume) * Number(row.hargaMaterial)),
        total_upah: row.totalUpah ?? (Number(row.volume) * Number(row.hargaUpah)),
        total_harga: row.totalHarga ?? (Number(row.volume) * (Number(row.hargaMaterial) + Number(row.hargaUpah))),
        catatan: row.catatan || ""
      }));

    if (itemsPayload.length === 0) {
      showAlert("Peringatan", "Minimal harus ada 1 item dengan volume > 0.", "warning");
      return;
    }

    const manualTotalsProvided =
      grandTotal !== null || grandTotalNonSbo !== null || grandTotalFinal !== null;

    if (manualTotalsProvided) {
      if (grandTotal === null || grandTotalNonSbo === null || grandTotalFinal === null) {
        showAlert("Peringatan", "Semua grand total harus diisi lengkap.", "warning");
        return;
      }
    }

    setLoading(true);
    try {
      const totalsPayload = manualTotalsProvided
        ? {
            grand_total: Number(grandTotal),
            grand_total_non_sbo: Number(grandTotalNonSbo),
            grand_total_final: Number(grandTotalFinal)
          }
        : undefined;

      if (replaceMode) {
        await replaceRabItems(
          selectedRabId,
          itemsPayload.map(({ id, ...rest }) => rest),
          totalsPayload
        );
      } else {
        const missingId = itemsPayload.some(item => !item.id);
        if (missingId) {
          showAlert("Peringatan", "Ada item baru tanpa ID. Gunakan mode replace untuk menyimpan secara menyeluruh.", "warning");
          setLoading(false);
          return;
        }
        await updateRabItemsBulk(selectedRabId, itemsPayload as any, totalsPayload);
      }

      showAlert("Berhasil", "Item RAB berhasil disimpan.", "success");

      const detailRes = await fetchRABDetail(selectedRabId);
      setRabDetail(detailRes.data);
      setGrandTotal(Number(detailRes.data?.rab?.grand_total ?? 0));
      setGrandTotalNonSbo(Number(detailRes.data?.rab?.grand_total_non_sbo ?? 0));
      setGrandTotalFinal(Number(detailRes.data?.rab?.grand_total_final ?? 0));
      setTableRows((detailRes.data.items || []).map((item) => ({
        tempId: `id-${item.id}`,
        id: item.id,
        category: item.kategori_pekerjaan,
        jenisPekerjaan: item.jenis_pekerjaan,
        satuan: item.satuan,
        volume: Number(item.volume) || 0,
        hargaMaterial: Number(item.harga_material) || 0,
        hargaUpah: Number(item.harga_upah) || 0,
        totalMaterial: Number(item.total_material) || 0,
        totalUpah: Number(item.total_upah) || 0,
        totalHarga: Number(item.total_harga) || 0,
        isKondisional: false,
        catatan: item.catatan || ""
      })));
      setReplaceMode(false);
    } catch (err: any) {
      showAlert("Error", err.message || "Gagal menyimpan item RAB.", "error");
    } finally {
      setLoading(false);
    }
  };

  const alertStyle = getAlertStyle();

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans text-slate-800 pb-10">
      <AppNavbar title="Ubah RAB Item" showBackButton backHref="/dashboard" />

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* SECTION: FILTER & SELECTION */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4 border-b border-slate-100">
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-red-600" />
              Pemilihan ULOK
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-4 space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Cabang</Label>
                <Select value={selectedCabang} onValueChange={setSelectedCabang}>
                  <SelectTrigger className="h-10 focus:ring-red-500">
                    <SelectValue placeholder="Pilih Cabang" />
                  </SelectTrigger>
                  <SelectContent>
                    {cabangOptions.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-8 space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Nomor ULOK / Pekerjaan</Label>
                <Select
                  value={selectedRabId ? String(selectedRabId) : ""}
                  onValueChange={(val) => setSelectedRabId(val ? Number(val) : null)}
                  disabled={!selectedCabang || loading}
                >
                  <SelectTrigger className="h-10 focus:ring-red-500">
                    <SelectValue placeholder="Pilih Nomor ULOK" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <div className="px-2 pb-2 pt-2 sticky top-0 bg-white z-10 border-b border-slate-100 mb-1">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
                        <Input
                          placeholder="Cari Nomor / Toko..."
                          className="pl-8 h-8 text-sm focus-visible:ring-red-500"
                          value={searchUlok}
                          onChange={(e) => setSearchUlok(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {filteredRabOptions.length > 0 ? (
                      filteredRabOptions.map(item => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          <span className="font-medium">{item.nomor_ulok}</span>
                          {item.nama_toko && <span className="text-slate-500 ml-1">- {item.nama_toko}</span>}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-4 text-center text-sm text-slate-500">
                        Pencarian tidak ditemukan
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* INFO BOX TOKO */}
              {rabDetail?.toko && (
                <div className="md:col-span-12 mt-2 bg-blue-50/50 border border-blue-100 rounded-lg p-3.5 flex items-start md:items-center flex-col md:flex-row gap-2 md:gap-4 text-sm text-slate-700">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 md:mt-0" />
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <p><span className="text-slate-500">Toko:</span> <span className="font-medium text-slate-900">{rabDetail.toko.nama_toko || "-"}</span></p>
                    <p><span className="text-slate-500">Cabang:</span> <span className="font-medium text-slate-900">{rabDetail.toko.cabang || "-"}</span></p>
                    <p><span className="text-slate-500">Lingkup:</span> <span className="font-medium text-slate-900">{rabDetail.toko.lingkup_pekerjaan || "-"}</span></p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SECTION: TABLE RAB */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-100">
            <CardTitle className="text-lg font-semibold text-slate-800">Detail Item Pekerjaan</CardTitle>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="outline" className="gap-2 h-9 text-sm border-slate-300 hover:bg-slate-50" onClick={downloadTemplate}>
                <Download className="w-4 h-4 text-slate-500" /> Unduh Template CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvFile(file);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <Button
                variant="outline"
                className="gap-2 h-9 text-sm border-slate-300 hover:bg-slate-50"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedRabId}
              >
                <Upload className="w-4 h-4 text-slate-500" /> Replace CSV
              </Button>
              <Button className="gap-2 h-9 text-sm bg-red-600 hover:bg-red-700 shadow-sm" onClick={addRow} disabled={!selectedRabId}>
                <Plus className="w-4 h-4" /> Tambah Item
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-5 p-0 sm:p-6">
            {replaceMode && (
              <div className="mb-4 text-sm text-amber-800 bg-amber-50/80 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2 mx-4 sm:mx-0">
                <Info className="w-4 h-4 text-amber-600" />
                <span><strong>Mode Replace Aktif:</strong> Data lama akan ditimpa seluruhnya dengan susunan baris ini saat disimpan.</span>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-slate-200 mx-4 sm:mx-0">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-100/80 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 w-[15%]">Kategori</th>
                    <th className="px-3 py-3 w-[25%]">Jenis Pekerjaan</th>
                    <th className="px-3 py-3 w-[8%]">Satuan</th>
                    <th className="px-3 py-3 w-[10%]">Volume</th>
                    <th className="px-3 py-3 w-[12%]">Harga Material</th>
                    <th className="px-3 py-3 w-[12%]">Harga Upah</th>
                    <th className="px-3 py-3 w-[12%]">Catatan</th>
                    <th className="px-3 py-3 w-[15%] text-right">Total Harga</th>
                    <th className="px-3 py-3 w-[5%] text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {tableRows.map(row => (
                    <tr key={row.tempId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-2.5">
                        <Select value={row.category} onValueChange={(val) => updateRow(row.tempId, "category", val)}>
                          <SelectTrigger className="h-9 w-full min-w-35 focus:ring-red-500">
                            <SelectValue placeholder="Pilih Kategori" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeCategories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5">
                        <Select value={row.jenisPekerjaan} onValueChange={(val) => updateRow(row.tempId, "jenisPekerjaan", val)}>
                          <SelectTrigger className="h-9 w-full min-w-50 focus:ring-red-500">
                            <SelectValue placeholder="Pilih Pekerjaan" />
                          </SelectTrigger>
                          <SelectContent>
                            {(prices[row.category] || []).map((item: any) => (
                              <SelectItem key={item["Jenis Pekerjaan"]} value={item["Jenis Pekerjaan"]}>
                                {item["Jenis Pekerjaan"]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          value={row.satuan}
                          onChange={(e) => updateRow(row.tempId, "satuan", e.target.value)}
                          className="h-9 w-full min-w-17.5 focus-visible:ring-red-500"
                          placeholder="Satuan"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.volume || ""}
                          onChange={(e) => updateRow(row.tempId, "volume", e.target.valueAsNumber || 0)}
                          className="h-9 w-full min-w-20 focus-visible:ring-red-500"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          type="number"
                          min="0"
                          value={row.hargaMaterial || ""}
                          onChange={(e) => updateRow(row.tempId, "hargaMaterial", e.target.valueAsNumber || 0)}
                          disabled={row.isKondisional}
                          className="h-9 w-full min-w-27.5 focus-visible:ring-red-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          type="number"
                          min="0"
                          value={row.hargaUpah || ""}
                          onChange={(e) => updateRow(row.tempId, "hargaUpah", e.target.valueAsNumber || 0)}
                          disabled={row.isKondisional}
                          className="h-9 w-full min-w-27.5 focus-visible:ring-red-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          value={row.catatan}
                          onChange={(e) => updateRow(row.tempId, "catatan", e.target.value)}
                          className="h-9 w-full min-w-35 focus-visible:ring-red-500"
                          placeholder="Catatan..."
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-700">
                        {toRupiah(row.volume * (row.hargaMaterial + row.hargaUpah))}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" 
                          onClick={() => removeRow(row.tempId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {/* EMPTY STATE */}
                  {tableRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 bg-slate-50/50">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FileSpreadsheet className="w-10 h-10 text-slate-300" />
                          <p className="text-sm font-medium">Belum ada item untuk ditampilkan</p>
                          <p className="text-xs text-slate-400">Pilih ULOK terlebih dahulu atau Tambah Item secara manual.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ACTION FOOTER */}
            <div className="mt-6 border-t border-slate-100 pt-5 mx-4 sm:mx-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Grand Total</Label>
                  <Input
                    type="number"
                    min="0"
                    value={grandTotal ?? ""}
                    onChange={(e) => setGrandTotal(Number.isNaN(e.target.valueAsNumber) ? null : e.target.valueAsNumber)}
                    className="h-10 focus-visible:ring-red-500"
                    placeholder="Isi grand total"
                    disabled={!selectedRabId}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Grand Total Non SBO</Label>
                  <Input
                    type="number"
                    min="0"
                    value={grandTotalNonSbo ?? ""}
                    onChange={(e) => setGrandTotalNonSbo(Number.isNaN(e.target.valueAsNumber) ? null : e.target.valueAsNumber)}
                    className="h-10 focus-visible:ring-red-500"
                    placeholder="Isi grand total non SBO"
                    disabled={!selectedRabId}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Grand Total Final</Label>
                  <Input
                    type="number"
                    min="0"
                    value={grandTotalFinal ?? ""}
                    onChange={(e) => setGrandTotalFinal(Number.isNaN(e.target.valueAsNumber) ? null : e.target.valueAsNumber)}
                    className="h-10 focus-visible:ring-red-500"
                    placeholder="Isi grand total final"
                    disabled={!selectedRabId}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  size="lg"
                  className="gap-2 bg-red-600 hover:bg-red-700 text-white shadow-md font-medium px-8 transition-all active:scale-95" 
                  onClick={handleSave} 
                  disabled={!selectedRabId || loading || tableRows.length === 0}
                >
                  <Save className="w-4 h-4" /> 
                  {loading ? "Menyimpan Data..." : "Simpan Perubahan"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* ALERT DIALOG */}
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader className="gap-3">
            <div className="flex items-center gap-3">
              <span className={`w-10 h-10 inline-flex items-center justify-center rounded-full shrink-0 ${alertStyle.bgIcon}`}>
                <Info className="w-5 h-5" />
              </span>
              <AlertDialogTitle className="text-lg">{alertMessage.title}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-slate-600 pl-13">
              {alertMessage.desc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            {alertMessage.type !== "error" && alertMessage.type !== "success" && (
              <AlertDialogCancel className="h-9">Tutup</AlertDialogCancel>
            )}
            <AlertDialogAction className={`h-9 px-6 ${alertStyle.btn}`}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}