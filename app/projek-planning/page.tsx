"use client"

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft, Plus, Search, Eye, Clock, CheckCircle2, XCircle,
  FileText, AlertTriangle, Filter, RefreshCw, ClipboardList,
} from "lucide-react";
import Link from "next/link";
import {
  fetchProjekPlanningList, type ProjekPlanningItem,
} from "@/lib/api";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { label: "Draft", color: "bg-slate-100 text-slate-700 border-slate-300", icon: <FileText className="w-3 h-3" /> },
  WAITING_BM_APPROVAL: { label: "Menunggu BM", color: "bg-amber-50 text-amber-700 border-amber-300", icon: <Clock className="w-3 h-3" /> },
  WAITING_PP_APPROVAL_1: { label: "Menunggu PP (1)", color: "bg-blue-50 text-blue-700 border-blue-300", icon: <Clock className="w-3 h-3" /> },
  PP_DESIGN_3D_REQUIRED: { label: "Design 3D", color: "bg-purple-50 text-purple-700 border-purple-300", icon: <Clock className="w-3 h-3" /> },
  WAITING_RAB_UPLOAD: { label: "Upload RAB", color: "bg-orange-50 text-orange-700 border-orange-300", icon: <Clock className="w-3 h-3" /> },
  WAITING_PP_APPROVAL_2: { label: "Menunggu PP (2)", color: "bg-cyan-50 text-cyan-700 border-cyan-300", icon: <Clock className="w-3 h-3" /> },
  WAITING_PP_MANAGER_APPROVAL: { label: "Menunggu PP Mgr (Final)", color: "bg-indigo-50 text-indigo-700 border-indigo-300", icon: <Clock className="w-3 h-3" /> },
  COMPLETED: { label: "Selesai", color: "bg-green-50 text-green-700 border-green-300", icon: <CheckCircle2 className="w-3 h-3" /> },
  REJECTED: { label: "Ditolak", color: "bg-red-50 text-red-700 border-red-300", icon: <XCircle className="w-3 h-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "bg-slate-100 text-slate-600 border-slate-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

export default function ProjekPlanningPage() {
  const router = useRouter();
  const [items, setItems] = useState<ProjekPlanningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userCabang, setUserCabang] = useState("");
  const [userRole, setUserRole] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (statusFilter) filters.status = statusFilter;
      
      const isHO = userCabang.toUpperCase() === "HEAD OFFICE";
      if (search.trim()) {
        filters.cabang = search.trim();
      } else if (!isHO && userCabang) {
        filters.cabang = userCabang;
      }
      
      const isCoor = userRole.includes("COORDINATOR") || userRole.includes("KOORDINATOR");
      const isBM = userRole.includes("BRANCH MANAGER") || userRole.includes("BM ");
      const isPPMgr = userRole.includes("PROJECT PLANNING MANAGER") || userRole.includes("PP MANAGER") || userEmail === "charderrabagas@gmail.com";
      const isPP = userRole.includes("PROJECT PLANNING") || userRole.includes("PP SPECIALIST") || userEmail === "lina.yuliyanti@sat.co.id" || isPPMgr;

      const isOnlyCoor = isCoor && !isBM && !isPP && !isPPMgr;
      if (isOnlyCoor && userEmail) {
        filters.email_pembuat = userEmail;
      }

      const res = await fetchProjekPlanningList(filters);
      const isHO = userCabang.toUpperCase() === "HEAD OFFICE";

      let data = res.data || [];
      
      data = data.filter((d: any) => {
        if (isHO && !isCoor && !isBM && !isPP && !isPPMgr) return true; // Admin/Direktur
        
        let visible = false;
        if (isCoor && d.email_pembuat === userEmail) visible = true;
        if (isBM && d.status !== "DRAFT") visible = true;
        if (isPP && !["DRAFT", "WAITING_BM_APPROVAL"].includes(d.status)) visible = true;
        if (isPPMgr && ["WAITING_PP_MANAGER_APPROVAL", "COMPLETED"].includes(d.status)) visible = true;
        
        return visible;
      });

      setItems(data);
      localStorage.setItem("last_checked_fpd", new Date().toISOString());
    } catch (e: any) { console.error(e); }
    setLoading(false);
  }, [statusFilter, search, userRole, userEmail, userCabang]);

  useEffect(() => {
    const email = sessionStorage.getItem("loggedInUserEmail") || "";
    const cabang = sessionStorage.getItem("loggedInUserCabang") || "";
    const role = sessionStorage.getItem("userRole") || "";
    if (!email) { router.push("/auth"); return; }
    setUserEmail(email);
    setUserCabang(cabang);
    setUserRole(role.toUpperCase());
  }, [router]);

  useEffect(() => { if (userEmail) load(); }, [userEmail, load]);

  const fmt = (d: string) => {
    try { return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  const isCoor = userRole.includes("COORDINATOR");

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <AppNavbar title="Project Planning" showBackButton backHref="/dashboard" />

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-red-600" /> Project Planning
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Form Pengajuan Data (FPD) — Pengajuan Design Toko</p>
          </div>
          {isCoor && (
            <Link href="/projek-planning/form">
              <Button className="bg-red-600 hover:bg-red-700 text-white gap-1.5 text-sm">
                <Plus className="w-4 h-4" /> Buat Pengajuan Baru
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Cari cabang..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm" onKeyDown={e => e.key === "Enter" && load()} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-9 px-3 border rounded-md text-sm bg-white text-slate-700 min-w-[160px]">
            <option value="">Semua Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={load} className="h-9 gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <Card className="py-16">
            <CardContent className="text-center text-slate-400">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-semibold">Belum ada data project planning</p>
              <p className="text-sm mt-1">Klik &quot;Buat Pengajuan Baru&quot; untuk memulai</p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">No</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">ULOK</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Nama Toko</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Cabang</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Pengaju</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Jenis</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Status</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Tanggal</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold">{item.nomor_ulok}</td>
                      <td className="px-4 py-2.5 font-medium max-w-[180px] truncate">{item.nama_toko || "-"}</td>
                      <td className="px-4 py-2.5">{item.cabang || "-"}</td>
                      <td className="px-4 py-2.5 text-xs">{item.nama_pengaju || item.email_pembuat}</td>
                      <td className="px-4 py-2.5 text-xs">{item.jenis_pengajuan || "-"}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{fmt(item.created_at)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Link href={`/projek-planning/${item.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                            <Eye className="w-3 h-3" /> Detail
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-slate-50 border-t text-xs text-slate-500">
              Total: {items.length} pengajuan
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
