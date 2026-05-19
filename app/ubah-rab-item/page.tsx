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
import { Download, Plus, Save, Trash2, Upload } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { BRANCH_GROUPS, ME_CATEGORIES, SIPIL_CATEGORIES } from "@/lib/constants";
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
  const [rabDetail, setRabDetail] = useState<RABDetailResponse | null>(null);

  const [prices, setPrices] = useState<Record<string, any[]>>({});
  const [tableRows, setTableRows] = useState<RowItem[]>([]);
  const [replaceMode, setReplaceMode] = useState(false);
  const [loading, setLoading] = useState(false);

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
    if (alertMessage.type === "error") return { bgIcon: "bg-red-100 text-red-600", btn: "bg-red-600 hover:bg-red-700" };
    if (alertMessage.type === "warning") return { bgIcon: "bg-amber-100 text-amber-600", btn: "bg-amber-500 hover:bg-amber-600" };
    if (alertMessage.type === "success") return { bgIcon: "bg-green-100 text-green-600", btn: "bg-green-600 hover:bg-green-700" };
    return { bgIcon: "bg-blue-100 text-blue-600", btn: "bg-blue-600 hover:bg-blue-700" };
  };

  useEffect(() => {
    if (!user) return;

    const userCabang = user.cabang.toUpperCase();
    if (user.isHO) {
      const allCabang = Array.from(new Set([
        "HEAD OFFICE",
        ...Object.values(BRANCH_GROUPS).flat()
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
          const isMatCond = false;
          const isUpahCond = false;
          return {
            tempId,
            id: item.id,
            category: item.kategori_pekerjaan,
            jenisPekerjaan: item.jenis_pekerjaan,
            satuan: item.satuan,
            volume: Number(item.volume) || 0,
            hargaMaterial: Number(item.harga_material) || 0,
            hargaUpah: Number(item.harga_upah) || 0,
            isKondisional: isMatCond || isUpahCond,
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

      if (field === "category") {
        updatedRow.jenisPekerjaan = "";
        updatedRow.satuan = "";
        updatedRow.hargaMaterial = 0;
        updatedRow.hargaUpah = 0;
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
    const header = ["kategori_pekerjaan", "jenis_pekerjaan", "satuan", "volume", "harga_material", "harga_upah", "catatan"];
    const sample = ["PEKERJAAN PERSIAPAN", "Contoh Item", "Ls", "1", "0", "0", ""];
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
      headers.forEach((header, i) => {
        row[header] = cells[i] ? cells[i].trim() : "";
      });

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
        catatan: row.catatan || ""
      }));

    if (itemsPayload.length === 0) {
      showAlert("Peringatan", "Minimal harus ada 1 item dengan volume.", "warning");
      return;
    }

    setLoading(true);
    try {
      if (replaceMode) {
        await replaceRabItems(selectedRabId, itemsPayload.map(({ id, ...rest }) => rest));
      } else {
        const missingId = itemsPayload.some(item => !item.id);
        if (missingId) {
          showAlert("Peringatan", "Ada item baru tanpa ID. Gunakan replace untuk menyimpan.", "warning");
          setLoading(false);
          return;
        }
        await updateRabItemsBulk(selectedRabId, itemsPayload as any);
      }

      showAlert("Berhasil", "Item RAB berhasil disimpan.", "success");

      const detailRes = await fetchRABDetail(selectedRabId);
      setRabDetail(detailRes.data);
      setTableRows((detailRes.data.items || []).map((item) => ({
        tempId: `id-${item.id}`,
        id: item.id,
        category: item.kategori_pekerjaan,
        jenisPekerjaan: item.jenis_pekerjaan,
        satuan: item.satuan,
        volume: Number(item.volume) || 0,
        hargaMaterial: Number(item.harga_material) || 0,
        hargaUpah: Number(item.harga_upah) || 0,
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <AppNavbar title="Ubah RAB Item" showBackButton backHref="/dashboard" />

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pilih ULOK</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Cabang</Label>
              <Select value={selectedCabang} onValueChange={setSelectedCabang}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Pilih Cabang" />
                </SelectTrigger>
                <SelectContent>
                  {cabangOptions.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Nomor ULOK</Label>
              <Select
                value={selectedRabId ? String(selectedRabId) : ""}
                onValueChange={(val) => setSelectedRabId(val ? Number(val) : null)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Pilih ULOK" />
                </SelectTrigger>
                <SelectContent>
                  {rabOptions.map(item => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.nomor_ulok} {item.nama_toko ? `- ${item.nama_toko}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {rabDetail?.toko && (
              <div className="md:col-span-3 text-xs text-slate-500">
                {rabDetail.toko.nama_toko || "-"} | {rabDetail.toko.cabang || "-"} | Lingkup: {rabDetail.toko.lingkup_pekerjaan || "-"}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">Item RAB</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-1.5 h-8 text-xs" onClick={downloadTemplate}>
                <Download className="w-3.5 h-3.5" /> Download Template CSV
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
                className="gap-1.5 h-8 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedRabId}
              >
                <Upload className="w-3.5 h-3.5" /> Replace via CSV
              </Button>
              <Button className="gap-1.5 h-8 text-xs bg-red-600 hover:bg-red-700" onClick={addRow} disabled={!selectedRabId}>
                <Plus className="w-3.5 h-3.5" /> Tambah Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {replaceMode && (
              <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Mode replace aktif: item baru akan mengganti seluruh item RAB.
              </div>
            )}

            <div className="overflow-x-auto border rounded-lg bg-white">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-2.5 py-2 font-semibold">Kategori</th>
                    <th className="text-left px-2.5 py-2 font-semibold">Item</th>
                    <th className="text-left px-2.5 py-2 font-semibold">Satuan</th>
                    <th className="text-left px-2.5 py-2 font-semibold">Volume</th>
                    <th className="text-left px-2.5 py-2 font-semibold">Harga Material</th>
                    <th className="text-left px-2.5 py-2 font-semibold">Harga Upah</th>
                    <th className="text-left px-2.5 py-2 font-semibold">Catatan</th>
                    <th className="text-right px-2.5 py-2 font-semibold">Total</th>
                    <th className="text-center px-2.5 py-2 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(row => (
                    <tr key={row.tempId} className="border-b last:border-b-0">
                      <td className="px-2.5 py-2 min-w-48">
                        <Select value={row.category} onValueChange={(val) => updateRow(row.tempId, "category", val)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Kategori" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeCategories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2.5 py-2 min-w-60">
                        <Select value={row.jenisPekerjaan} onValueChange={(val) => updateRow(row.tempId, "jenisPekerjaan", val)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Pilih item" />
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
                      <td className="px-2.5 py-2 min-w-20">
                        <Input
                          value={row.satuan}
                          onChange={(e) => updateRow(row.tempId, "satuan", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-2.5 py-2 min-w-24">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.volume}
                          onChange={(e) => updateRow(row.tempId, "volume", Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-2.5 py-2 min-w-28">
                        <Input
                          type="number"
                          min="0"
                          value={row.hargaMaterial}
                          onChange={(e) => updateRow(row.tempId, "hargaMaterial", Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-2.5 py-2 min-w-28">
                        <Input
                          type="number"
                          min="0"
                          value={row.hargaUpah}
                          onChange={(e) => updateRow(row.tempId, "hargaUpah", Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-2.5 py-2 min-w-32">
                        <Input
                          value={row.catatan}
                          onChange={(e) => updateRow(row.tempId, "catatan", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-2.5 py-2 text-right text-xs font-semibold">
                        {toRupiah(row.volume * (row.hargaMaterial + row.hargaUpah))}
                      </td>
                      <td className="px-2.5 py-2 text-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(row.tempId)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {tableRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center text-slate-400 py-6">
                        Pilih ULOK untuk menampilkan item.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-4">
              <Button className="gap-2 bg-red-600 hover:bg-red-700" onClick={handleSave} disabled={!selectedRabId || loading}>
                <Save className="w-4 h-4" /> {loading ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className={`w-8 h-8 inline-flex items-center justify-center rounded-full ${alertStyle.bgIcon}`}>
                !
              </span>
              {alertMessage.title}
            </AlertDialogTitle>
            <AlertDialogDescription>{alertMessage.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tutup</AlertDialogCancel>
            <AlertDialogAction className={alertStyle.btn}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
