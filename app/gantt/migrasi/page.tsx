"use client";

import React, { useState } from "react";
import { useSession } from "@/context/SessionContext";
import AppNavbar from "@/components/AppNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    FileSpreadsheet,
    Info,
    Loader2,
    Search,
    ShieldAlert,
    Upload,
    XCircle,
} from "lucide-react";
import Link from "next/link";
import { previewGanttMigration, commitGanttMigration } from "@/lib/api";

type PreviewDetail = {
    nomor_ulok: string;
    lingkup_pekerjaan: string;
    status: string;
    sheet_count?: number;
};

type PreviewResult = {
    total_rows: number;
    total_groups: number;
    ready_count: number;
    skipped_count: number;
    details: PreviewDetail[];
};

type CommitResult = {
    inserted_count: number;
    skipped_count: number;
    total_groups: number;
    limit_applied?: number;
};

const formatNumber = (v?: number) => new Intl.NumberFormat("id-ID").format(v ?? 0);

export default function GanttMigrasiPage() {
    const { user } = useSession();

    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<PreviewResult | null>(null);
    const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [limitInput, setLimitInput] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [message, setMessage] = useState<{ type: "success" | "error" | "info" | "warning"; text: string } | null>(null);

    // --- Super Human Guard ---
    if (user && !user.isSuperHuman) {
        return (
            <div className="min-h-screen bg-slate-50">
                <AppNavbar title="Migrasi Gantt Chart" showBackButton backHref="/gantt" />
                <main className="mx-auto max-w-xl p-8">
                    <Card className="border-red-200 shadow-md">
                        <CardContent className="p-10 text-center flex flex-col items-center gap-4">
                            <ShieldAlert className="w-14 h-14 text-red-400" />
                            <h1 className="text-xl font-bold text-slate-900">Akses Ditolak</h1>
                            <p className="text-sm text-slate-500">
                                Fitur <strong>Migrasi Gantt Chart</strong> hanya dapat diakses oleh <span className="font-semibold text-red-600">Super Human</span>.
                            </p>
                            <Link href="/gantt">
                                <Button variant="outline" className="mt-2 gap-2">
                                    <ArrowLeft className="w-4 h-4" /> Kembali ke Gantt
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    // --- Handlers ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFile(e.target.files?.[0] ?? null);
        setPreview(null);
        setCommitResult(null);
        setMessage(null);
    };

    const handlePreview = async () => {
        if (!file) {
            setMessage({ type: "error", text: "Pilih file Excel terlebih dahulu." });
            return;
        }
        setIsPreviewing(true);
        setPreview(null);
        setCommitResult(null);
        setMessage(null);
        try {
            const res = await previewGanttMigration(file);
            setPreview(res.data);
            setMessage({ type: "info", text: "Preview berhasil. Periksa hasil analisis sebelum melakukan migrasi." });
        } catch (err: any) {
            setMessage({ type: "error", text: err.message || "Gagal membuat preview." });
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleCommit = async () => {
        if (!file || !preview) return;

        const limit = limitInput.trim() !== "" ? Number(limitInput) : undefined;
        if (limit !== undefined && (isNaN(limit) || limit <= 0)) {
            setMessage({ type: "warning", text: "Jumlah insert harus berupa angka positif." });
            return;
        }

        const confirmMsg = limit
            ? `Akan memasukkan ${limit} Gantt Chart pertama yang siap insert. Lanjutkan?`
            : `Akan memasukkan SEMUA ${formatNumber(preview.ready_count)} Gantt Chart yang siap insert. Lanjutkan?`;

        if (!window.confirm(confirmMsg)) return;

        setIsCommitting(true);
        setMessage(null);
        try {
            const emailPembuat = user?.email || "system@migrasi.com";
            const res = await commitGanttMigration(file, emailPembuat, limit);
            setCommitResult(res.data);
            setMessage({ type: "success", text: "Migrasi berhasil diproses." });
        } catch (err: any) {
            setMessage({ type: "error", text: err.message || "Gagal memproses migrasi." });
        } finally {
            setIsCommitting(false);
        }
    };

    // --- Filtered Details ---
    const filteredDetails = (preview?.details ?? []).filter(
        (d) =>
            d.nomor_ulok.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.lingkup_pekerjaan.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.status.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const readyCount = preview?.ready_count ?? 0;
    const effectiveLimit = limitInput.trim() !== "" && !isNaN(Number(limitInput)) ? Number(limitInput) : undefined;
    const willInsert = effectiveLimit !== undefined ? Math.min(effectiveLimit, readyCount) : readyCount;

    return (
        <div className="min-h-screen bg-slate-50">
            <AppNavbar
                title="Migrasi Gantt Chart"
                showBackButton
                backHref="/gantt"
                rightActions={
                    <Badge className="bg-violet-600 text-white border-none px-3 py-1 text-xs font-bold tracking-wider shadow">
                        SUPER HUMAN ONLY
                    </Badge>
                }
            />

            <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
                {/* Header */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-extrabold text-slate-900">Upload Excel Gantt Chart DB</h1>
                    <p className="text-sm text-slate-500">
                        Data yang sudah memiliki Gantt Chart aktif akan di-skip secara otomatis. Data yang siap masuk akan terhubung dengan RAB yang sesuai.
                    </p>
                </div>

                {/* Upload Card */}
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-violet-600" />
                            File Migrasi
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                            <Input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                className="h-11 rounded-xl bg-white"
                            />
                            <Button
                                variant="outline"
                                className="h-11 rounded-xl border-violet-300 text-violet-700 hover:bg-violet-50"
                                disabled={!file || isPreviewing || isCommitting}
                                onClick={handlePreview}
                            >
                                {isPreviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                                Analisis File
                            </Button>
                            <Button
                                className="h-11 rounded-xl bg-violet-700 text-white hover:bg-violet-800 font-bold shadow-md"
                                disabled={!file || !preview || isCommitting || isPreviewing || preview.ready_count === 0}
                                onClick={handleCommit}
                            >
                                {isCommitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Proses Migrasi
                            </Button>
                        </div>

                        {/* Limit Input */}
                        {preview && preview.ready_count > 0 && !commitResult && (
                            <div className="flex items-center gap-3 pt-1">
                                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex-1">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    <span>
                                        <strong>{formatNumber(preview.ready_count)}</strong> Gantt Chart siap masuk.
                                        Atur jumlah insert di bawah ini (kosongkan = masukkan semua).
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Batasi Insert:</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={preview.ready_count}
                                        placeholder={`Max ${preview.ready_count}`}
                                        value={limitInput}
                                        onChange={(e) => setLimitInput(e.target.value)}
                                        className="w-32 h-9 text-sm rounded-lg text-center font-bold"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Message */}
                        {message && (
                            <div className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                                message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                                message.type === "error" ? "border-red-200 bg-red-50 text-red-700" :
                                message.type === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" :
                                "border-blue-200 bg-blue-50 text-blue-700"
                            }`}>
                                {message.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                                {message.type === "error" && <XCircle className="h-4 w-4 shrink-0" />}
                                {message.type === "info" && <Info className="h-4 w-4 shrink-0" />}
                                {message.type === "warning" && <AlertTriangle className="h-4 w-4 shrink-0" />}
                                {message.text}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Commit Result */}
                {commitResult && (
                    <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                                <h2 className="font-bold text-emerald-800 text-base">Migrasi Selesai</h2>
                                {commitResult.limit_applied && (
                                    <Badge className="bg-amber-100 text-amber-700 border-none text-xs">
                                        Limit: {formatNumber(commitResult.limit_applied)}
                                    </Badge>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    ["Total Group", commitResult.total_groups, "text-slate-800"],
                                    ["Berhasil Masuk", commitResult.inserted_count, "text-emerald-700"],
                                    ["Di-skip", commitResult.skipped_count, "text-slate-500"],
                                ].map(([label, value, cls]) => (
                                    <div key={String(label)} className="bg-white rounded-xl border border-emerald-100 p-4 text-center shadow-sm">
                                        <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</div>
                                        <div className={`text-3xl font-extrabold ${cls}`}>{formatNumber(Number(value ?? 0))}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Preview Summary Cards */}
                {preview && (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {[
                                { label: "Total Baris Day", value: preview.total_rows, color: "border-slate-200", textColor: "text-slate-900", icon: <FileSpreadsheet className="h-5 w-5 text-slate-400" /> },
                                { label: "Total Proyek (Header)", value: preview.total_groups, color: "border-blue-200 bg-blue-50", textColor: "text-blue-700", icon: <Info className="h-5 w-5 text-blue-400" /> },
                                { label: "Siap Insert", value: preview.ready_count, color: "border-emerald-200 bg-emerald-50", textColor: "text-emerald-700", icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
                                { label: "Di-skip (Sudah Ada)", value: preview.skipped_count, color: "border-amber-200 bg-amber-50", textColor: "text-amber-700", icon: <AlertTriangle className="h-5 w-5 text-amber-400" /> },
                            ].map(({ label, value, color, textColor, icon }) => (
                                <Card key={label} className={`${color} shadow-sm`}>
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className="shrink-0">{icon}</div>
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
                                            <div className={`text-2xl font-extrabold ${textColor}`}>{formatNumber(value)}</div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Will Insert Info */}
                        {preview.ready_count > 0 && !commitResult && (
                            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-50 border border-violet-200 text-sm text-violet-800">
                                <Info className="h-4 w-4 shrink-0" />
                                <span>
                                    Dengan pengaturan saat ini, tombol <strong>Proses Migrasi</strong> akan memasukkan{" "}
                                    <strong>{formatNumber(willInsert)}</strong> Gantt Chart ke dalam database.
                                </span>
                            </div>
                        )}

                        {/* Detail Table */}
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <CardTitle className="text-base">Detail Analisis Per Nomor Ulok</CardTitle>
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            placeholder="Cari nomor ulok / lingkup..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 h-9 text-sm rounded-xl"
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="px-0 pb-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-t bg-slate-50 text-xs uppercase text-slate-500">
                                            <tr>
                                                <th className="px-5 py-3 w-10">#</th>
                                                <th className="px-5 py-3">Nomor Ulok</th>
                                                <th className="px-5 py-3">Lingkup Pekerjaan</th>
                                                <th className="px-5 py-3 text-right">Baris Day</th>
                                                <th className="px-5 py-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredDetails.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                                                        Tidak ada data yang cocok dengan pencarian.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredDetails.map((item, idx) => {
                                                    const isReady = item.status === "Siap Insert";
                                                    return (
                                                        <tr key={`${item.nomor_ulok}-${item.lingkup_pekerjaan}`} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-5 py-3 text-slate-400 text-xs font-mono">{idx + 1}</td>
                                                            <td className="px-5 py-3">
                                                                <span className="font-bold text-slate-800 font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                                                                    {item.nomor_ulok}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-3 text-slate-600">{item.lingkup_pekerjaan || <span className="text-slate-300 italic">—</span>}</td>
                                                            <td className="px-5 py-3 text-right">
                                                                <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                                                                    {item.sheet_count ?? 0}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-3">
                                                                <Badge className={isReady
                                                                    ? "bg-emerald-100 text-emerald-700 border-none text-xs font-semibold"
                                                                    : "bg-amber-100 text-amber-700 border-none text-xs font-semibold"
                                                                }>
                                                                    {isReady ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : <AlertTriangle className="h-3 w-3 mr-1 inline" />}
                                                                    {item.status}
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                        {filteredDetails.length > 0 && (
                                            <tfoot className="border-t bg-slate-50">
                                                <tr>
                                                    <td colSpan={5} className="px-5 py-3 text-xs text-slate-400">
                                                        Menampilkan <strong>{filteredDetails.length}</strong> dari <strong>{preview.details.length}</strong> data
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </main>
        </div>
    );
}
