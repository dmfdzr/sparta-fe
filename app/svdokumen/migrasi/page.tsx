"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";

import AppNavbar from "@/components/AppNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSession } from "@/context/SessionContext";
import {
  commitPenyimpananDokumenMigration,
  previewPenyimpananDokumenMigration,
  type PenyimpananDokumenMigrationResult,
} from "@/lib/api";

const formatNumber = (value?: number) => new Intl.NumberFormat("id-ID").format(value ?? 0);

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

export default function MigrasiPenyimpananDokumenPage() {
  const router = useRouter();
  const { user } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PenyimpananDokumenMigrationResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const actorRole = useMemo(() => {
    const roles = user?.roles?.length ? user.roles.join(",") : user?.role;
    return roles || "";
  }, [user?.role, user?.roles]);

  if (user && !user.isSuperHuman) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppNavbar title="Migrasi Penyimpanan Dokumen" showBackButton backHref="/dashboard" />
        <main className="mx-auto max-w-3xl p-6">
          <Card>
            <CardContent className="p-8 text-center">
              <XCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
              <h1 className="text-lg font-bold text-slate-900">Akses ditolak</h1>
              <p className="mt-1 text-sm text-slate-500">Fitur migrasi dokumen hanya untuk Super Human.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const handlePreview = async () => {
    if (!file) {
      setMessage({ type: "error", text: "Pilih file Excel terlebih dahulu." });
      return;
    }

    setIsPreviewing(true);
    setMessage(null);
    try {
      const res = await previewPenyimpananDokumenMigration(file, actorRole);
      setResult(res.data);
      setMessage({ type: "success", text: "Preview berhasil dibuat. Cek ringkasan sebelum proses migrasi." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: getErrorMessage(err, "Gagal membuat preview migrasi.") });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    const confirmed = window.confirm("Proses migrasi akan menyimpan dokumen ke database dan melewati data yang sudah ada. Lanjutkan?");
    if (!confirmed) return;

    setIsCommitting(true);
    setMessage(null);
    try {
      const res = await commitPenyimpananDokumenMigration(file, actorRole);
      setResult(res.data);
      setMessage({ type: "success", text: "Migrasi selesai diproses." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: getErrorMessage(err, "Gagal memproses migrasi.") });
    } finally {
      setIsCommitting(false);
    }
  };

  const categoryRows = Object.entries(result?.categoryCounts ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNavbar title="Migrasi Penyimpanan Dokumen" showBackButton backHref="/dashboard" />

      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Upload Excel Penyimpanan Dokumen</h1>
            <p className="text-sm text-slate-500">File akan dipecah menjadi satu baris database untuk setiap link dokumen.</p>
          </div>
          <Button variant="outline" className="w-fit gap-2 rounded-xl" onClick={() => router.push("/svdokumen")}>
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> File Migrasi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setResult(null);
                  setMessage(null);
                }}
                className="h-11 rounded-xl bg-white"
              />
              <Button variant="outline" className="h-11 rounded-xl" disabled={!file || isPreviewing || isCommitting} onClick={handlePreview}>
                {isPreviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                Preview
              </Button>
              <Button className="h-11 rounded-xl bg-red-600 text-white hover:bg-red-700" disabled={!file || !result || isCommitting || isPreviewing} onClick={handleCommit}>
                {isCommitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Proses Migrasi
              </Button>
            </div>
            {message && (
              <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                message.type === "error" ? "border-red-200 bg-red-50 text-red-700" :
                "border-slate-200 bg-white text-slate-600"
              }`}>
                {message.text}
              </div>
            )}
          </CardContent>
        </Card>

        {result && (
          <>
            <div className="grid gap-3 md:grid-cols-5">
              {[
                ["Baris Excel", result.totalRows],
                ["Baris Ada File", result.rowsWithFiles],
                ["Baris Kosong", result.emptyFileRows],
                ["Dokumen Terbaca", result.parsedDocuments],
                ["Tersimpan Baru", result.inserted],
              ].map(([label, value]) => (
                <Card key={String(label)} className="border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-950">{formatNumber(Number(value ?? 0))}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {typeof result.skippedDuplicates === "number" && (
              <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
                <CardContent className="flex items-center gap-3 p-4 text-sm font-semibold text-emerald-700">
                  <CheckCircle className="h-5 w-5" />
                  {formatNumber(result.skippedDuplicates)} dokumen dilewati karena sudah ada dari migrasi sebelumnya.
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Kategori Dokumen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {categoryRows.map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2">
                      <span className="text-sm font-semibold text-slate-700">{category}</span>
                      <Badge className="bg-red-50 text-red-600">{formatNumber(count)}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Sample Hasil Pecah Link</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-3">Kode</th>
                          <th className="px-3 py-3">Cabang</th>
                          <th className="px-3 py-3">Kategori</th>
                          <th className="px-3 py-3">Nama Dokumen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.sample.map((item, index) => (
                          <tr key={`${item.kode_toko}-${item.nama_dokumen}-${index}`} className="bg-white">
                            <td className="px-3 py-3 font-semibold text-slate-900">{item.kode_toko || "-"}</td>
                            <td className="px-3 py-3 text-slate-600">{item.cabang || "-"}</td>
                            <td className="px-3 py-3 text-slate-600">{item.kategori_dokumen}</td>
                            <td className="px-3 py-3 text-slate-700">{item.nama_dokumen}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {result.unparsedRows.length > 0 && (
              <Card className="border-amber-200 bg-amber-50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-amber-800">Baris Belum Terbaca</CardTitle>
                </CardHeader>
                <CardContent className="max-h-56 overflow-y-auto text-sm text-amber-800">
                  {result.unparsedRows.slice(0, 50).map((row) => (
                    <div key={`${row.rowNumber}-${row.kode_toko}`} className="py-1">
                      Baris {row.rowNumber} {row.kode_toko ? `(${row.kode_toko})` : ""}: {row.reason}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
