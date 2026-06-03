"use client"

import React, { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2, XCircle, Clock, FileText, ClipboardList,
  User, Building2, Droplets, Wind, Zap, History, Loader2, Send, Eye, Download, AlertTriangle,
} from "lucide-react";
import {
  fetchProjekPlanningDetail, processBmApproval, processPpApproval1,
  uploadDesain3d, uploadRabGambarKerja, processPpManagerApproval, processPpApproval2,
  downloadProjekPlanningPdf, proxyProjekPlanningFile, fetchRABList,
  type ProjekPlanningItem, type ProjekPlanningLog,
} from "@/lib/api";
import { getPpRoles, canAccessProjectPlanningByCabang, canViewAllBranches } from "@/lib/constants";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-slate-100 text-slate-700" },
  WAITING_BM_APPROVAL: { label: "Menunggu B&M", color: "bg-amber-100 text-amber-800" },
  WAITING_PP_APPROVAL_1: { label: "Menunggu PP (1)", color: "bg-blue-100 text-blue-800" },
  PP_DESIGN_3D_REQUIRED: { label: "Desain 3D", color: "bg-purple-100 text-purple-800" },
  WAITING_RAB_UPLOAD: { label: "Input Tahap 2", color: "bg-orange-100 text-orange-800" },
  WAITING_BM_APPROVAL_2: { label: "Menunggu B&M (2)", color: "bg-amber-100 text-amber-800" },
  WAITING_PP_APPROVAL_2: { label: "Menunggu PP (2)", color: "bg-cyan-100 text-cyan-800" },
  WAITING_PP_MANAGER_APPROVAL: { label: "Menunggu PP Mgr (Final)", color: "bg-indigo-100 text-indigo-800" },
  COMPLETED: { label: "Selesai", color: "bg-green-100 text-green-800" },
  REJECTED: { label: "Ditolak", color: "bg-red-100 text-red-800" },
};

type FacilityInput = {
  jenis_fasilitas: string;
  nama_fasilitas_lainnya?: string;
  is_tersedia: boolean;
  keterangan?: string;
};

const FACILITY_META: Record<string, { label: string; units: string[]; placeholder: string }> = {
  AIR_BERSIH: { label: "Sumber Air Bersih", units: ["titik", "sumber"], placeholder: "Jumlah titik" },
  DRAINASE: { label: "Drain Pembuangan Air Kotor", units: ["titik", "jalur"], placeholder: "Jumlah titik" },
  AC: { label: "AC", units: ["unit", "PK"], placeholder: "Jumlah AC" },
  LISTRIK: { label: "Listrik", units: ["VA", "kVA", "Watt", "Volt"], placeholder: "Daya listrik" },
};

const DEFAULT_FASILITAS_TAHAP2: FacilityInput[] = [
  { jenis_fasilitas: "AIR_BERSIH", is_tersedia: false, keterangan: "" },
  { jenis_fasilitas: "DRAINASE", is_tersedia: false, keterangan: "" },
  { jenis_fasilitas: "AC", is_tersedia: false, keterangan: "" },
  { jenis_fasilitas: "LISTRIK", is_tersedia: false, keterangan: "" },
  { jenis_fasilitas: "LAINNYA", nama_fasilitas_lainnya: "", is_tersedia: false, keterangan: "" },
];

const parseFacilityMeasurement = (text: string | undefined, defaultUnit: string) => {
  const value = String(text ?? "").trim();
  if (!value) return { amount: "", unit: defaultUnit };
  if (value === defaultUnit) return { amount: "", unit: defaultUnit };
  const match = value.match(/^(.+?)\s+([A-Za-z]+)$/);
  if (!match) return { amount: value, unit: defaultUnit };
  if (!/^\d+([.,]\d+)?$/.test(match[1].trim())) return { amount: "", unit: match[2] };
  return { amount: match[1], unit: match[2] };
};

const FPD_STEPS = [
  { id: "WAITING_BM_APPROVAL", label: "B&M Manager" },
  { id: "WAITING_PP_APPROVAL_1", label: "PP Tahap 1" },
  { id: "WAITING_RAB_UPLOAD", label: "Input Tahap 2" },
  { id: "WAITING_BM_APPROVAL_2", label: "B&M Tahap 2" },
  { id: "WAITING_PP_APPROVAL_2", label: "PP Tahap 2" },
  { id: "WAITING_PP_MANAGER_APPROVAL", label: "PP Manager" },
  { id: "COMPLETED", label: "Selesai" },
];

const firstFileUrl = (url?: string | null) =>
  String(url || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean)[0] || "";

const shouldUseDriveProxy = (url?: string | null) => {
  const first = firstFileUrl(url).toLowerCase();
  return (
    first.includes("drive.google.com/file/d/") ||
    first.includes("drive.google.com/open?id=") ||
    first.includes("drive.google.com/uc?id=") ||
    first.includes("drive.google.com/thumbnail?id=")
  );
};

const isDirectUserLink = (url?: string | null) => {
  const first = firstFileUrl(url);
  return !!first && !shouldUseDriveProxy(first);
};

const shouldOpenFileDirectly = (field: string, url?: string | null) => {
  if (field === "rab_sipil_final" || field === "rab_me_final") return true;
  return isDirectUserLink(url);
};

function FpdTimeline({ currentStatus }: { currentStatus: string }) {
  const isRejected = currentStatus === "REJECTED";

  let activeIndex = -1;
  if (currentStatus === "WAITING_BM_APPROVAL") activeIndex = 0;
  if (currentStatus === "WAITING_PP_APPROVAL_1") activeIndex = 1;
  if (currentStatus === "PP_DESIGN_3D_REQUIRED" || currentStatus === "WAITING_RAB_UPLOAD") activeIndex = 2;
  if (currentStatus === "WAITING_BM_APPROVAL_2") activeIndex = 3;
  if (currentStatus === "WAITING_PP_APPROVAL_2") activeIndex = 4;
  if (currentStatus === "WAITING_PP_MANAGER_APPROVAL") activeIndex = 5;
  if (currentStatus === "COMPLETED") activeIndex = 6;

  return (
    <div className="mb-10 mt-2 w-full relative">
      <div className="relative flex justify-between items-center w-full px-2 sm:px-6">
        <div className="absolute left-4 right-4 sm:left-10 sm:right-10 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0"></div>
        <div className="absolute left-4 sm:left-10 top-1/2 -translate-y-1/2 h-1 bg-green-500 z-0 transition-all duration-500" style={{ width: `calc(${Math.max(0, (activeIndex / (FPD_STEPS.length - 1)) * 100)}% - 2rem)` }}></div>
        {FPD_STEPS.map((step, idx) => {
          const isCompleted = activeIndex > idx || currentStatus === "COMPLETED";
          const isActive = activeIndex === idx;
          const isError = isRejected;

          let color = "bg-slate-200 text-slate-400";
          if (isCompleted) color = "bg-green-500 text-white";
          if (isActive && !isError) color = "bg-blue-500 text-white shadow-md";
          if (isActive && isError) color = "bg-red-500 text-white shadow-md";

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all duration-300 ${color}`}>
                {isCompleted ? <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" /> : (isActive && isError) ? <XCircle className="w-3 h-3 sm:w-4 sm:h-4" /> : idx + 1}
              </div>
              <div className="absolute top-7 sm:top-10 w-14 sm:w-20 text-center -ml-7 sm:-ml-10 left-1/2">
                <p className={`text-[8px] sm:text-[10px] font-bold leading-tight ${isActive ? (isError ? 'text-red-600' : 'text-blue-700') : isCompleted ? 'text-green-700' : 'text-slate-400'}`}>
                  {step.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs font-semibold text-slate-500 sm:w-48 shrink-0">{String(label)}</span>
      <span className="text-sm text-slate-800">{value}</span>
    </div>
  );
}

function FileProxyRow({
  label, hasFile, projektId, field, onViewed, onUnviewed, fileUrl
}: {
  label: string; hasFile: boolean; projektId: number; field: string; onViewed: (field: string) => void; onUnviewed: (field: string) => void; fileUrl?: string | null;
}) {
  const [loading, setLoading] = React.useState<"view" | "download" | null>(null);
  const [viewed, setViewed] = React.useState(false);
  const openDirectly = shouldOpenFileDirectly(field, fileUrl);
  const showDownload = !openDirectly;

  React.useEffect(() => {
    const userEmail = sessionStorage.getItem('loggedInUserEmail') || 'unknown';
    const storageKey = `pp_viewed_${userEmail}_${projektId}_${field}`;
    const stored = localStorage.getItem(storageKey);
    if (!hasFile || !stored) {
      setViewed(false);
      onUnviewed(field);
      return;
    }

    if (hasFile && stored) {
      let storedUrl: string | null = null;
      try {
        const parsed = JSON.parse(stored);
        storedUrl = parsed.url || null;
      } catch {
        // Legacy entry "1" — no URL stored, treat as needs re-open if fileUrl exists
        storedUrl = null;
      }

      // Jika URL file berubah (upload baru) → wajib buka ulang
      if (fileUrl && storedUrl && storedUrl !== fileUrl) {
        localStorage.removeItem(storageKey);
        setViewed(false);
        onUnviewed(field);
        return;
      }
      // URL sama atau tidak ada perubahan → tetap viewed
      if (!fileUrl || storedUrl === fileUrl || storedUrl) {
        setViewed(true);
        onViewed(field);
      }
    }
  }, [hasFile, projektId, field, fileUrl]); // Intentional omission of onViewed

  if (!hasFile) return null;

  const handle = async (mode: "view" | "download") => {
    setLoading(mode);
    try {
      const directUrl = firstFileUrl(fileUrl);
      if (directUrl && openDirectly) {
        window.open(directUrl, "_blank", "noopener,noreferrer");
      } else {
        await proxyProjekPlanningFile(projektId, field, mode);
      }
      setViewed(true);
      onViewed(field);
      const userEmail = sessionStorage.getItem('loggedInUserEmail') || 'unknown';
      const storageKey = `pp_viewed_${userEmail}_${projektId}_${field}`;
      // Lihat atau unduh sama-sama dihitung sudah membuka dokumen untuk approval.
      localStorage.setItem(storageKey, JSON.stringify({ url: fileUrl || 'no-url' }));
    } catch (e: any) { alert(`Gagal: ${e.message}`); }
    setLoading(null);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 py-2 border-b border-slate-50 last:border-0">
      <span className={`text-xs font-semibold sm:w-48 shrink-0 ${viewed ? "text-green-600" : "text-orange-500"}`}>
        {viewed ? "✓ " : "⚠ Belum dibuka — "}{label}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => handle("view")}
          disabled={!!loading}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
            viewed
              ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
              : "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-300 animate-pulse"
          }`}
        >
          {loading === "view" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
          Lihat
        </button>
        {showDownload && (
          <button
            onClick={() => handle("download")}
            disabled={!!loading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
          >
            {loading === "download" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Unduh
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewSelect({
  label, value, onChange,
}: {
  label: string;
  value: "APPROVE" | "REJECT";
  onChange: (value: "APPROVE" | "REJECT") => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange("APPROVE")}
          className={`h-9 rounded-md border text-sm font-semibold ${value === "APPROVE" ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-600 border-slate-200"}`}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => onChange("REJECT")}
          className={`h-9 rounded-md border text-sm font-semibold ${value === "REJECT" ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-600 border-slate-200"}`}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

export default function DetailProjekPlanning() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Number(params.id);

  const [data, setData] = useState<ProjekPlanningItem | null>(null);
  const [logs, setLogs] = useState<ProjekPlanningLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ title: "", desc: "" });
  const [need3d, setNeed3d] = useState(false);
  const [link3d, setLink3d] = useState("");
  const [file3d, setFile3d] = useState<File | null>(null);
  const [linkGambarSipil, setLinkGambarSipil] = useState("");
  const [fileGambarSipil, setFileGambarSipil] = useState<File[]>([]);
  const [linkGambarMe, setLinkGambarMe] = useState("");
  const [fileGambarMe, setFileGambarMe] = useState<File[]>([]);
  const [openedLinks, setOpenedLinks] = useState<Set<string>>(new Set());
  const [approvedRabs, setApprovedRabs] = useState<any[]>([]);
  const [fasilitasTahap2, setFasilitasTahap2] = useState<FacilityInput[]>(DEFAULT_FASILITAS_TAHAP2);
  const [approvalNote, setApprovalNote] = useState("");
  const [rabReviewAction, setRabReviewAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [gambarReviewAction, setGambarReviewAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [rabRejectedItemIds, setRabRejectedItemIds] = useState("");
  const [rabRejectedItemNotes, setRabRejectedItemNotes] = useState("");

  const markFieldViewed = React.useCallback((field: string) => {
    setOpenedLinks(prev => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }, []);

  const markFieldUnviewed = React.useCallback((field: string) => {
    setOpenedLinks(prev => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }, []);

  const clearViewedFields = React.useCallback((fields: string[]) => {
    const storageEmail = sessionStorage.getItem('loggedInUserEmail') || userEmail || 'unknown';
    fields.forEach(field => localStorage.removeItem(`pp_viewed_${storageEmail}_${id}_${field}`));
    setOpenedLinks(prev => {
      const next = new Set(prev);
      fields.forEach(field => next.delete(field));
      return next;
    });
  }, [id, userEmail]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchProjekPlanningDetail(id);
      const projek = res.data.projek;

      // Normalize flat fields into arrays if not already present as arrays
      if (!projek.fasilitas) {
        projek.fasilitas = [
          { jenis_fasilitas: 'AIR_BERSIH', is_tersedia: projek.fasilitas_air_bersih, keterangan: projek.fasilitas_air_bersih_keterangan ?? undefined },
          { jenis_fasilitas: 'DRAINASE', is_tersedia: projek.fasilitas_drain, keterangan: projek.fasilitas_drain_keterangan ?? undefined },
          { jenis_fasilitas: 'AC', is_tersedia: projek.fasilitas_ac, keterangan: projek.fasilitas_ac_keterangan ?? undefined },
          { jenis_fasilitas: 'LAINNYA', is_tersedia: !!projek.fasilitas_lainnya, nama_fasilitas_lainnya: projek.fasilitas_lainnya ?? undefined, keterangan: projek.fasilitas_lainnya_keterangan ?? undefined },
        ].filter(f => f.is_tersedia || f.keterangan);
      }

      if (!projek.ketentuan) {
        projek.ketentuan = [
          projek.ketentuan_1, projek.ketentuan_2, projek.ketentuan_3, projek.ketentuan_4, projek.ketentuan_5
        ].filter(Boolean).map(isi => ({ isi_ketentuan: isi as string }));
      }

      if (!projek.catatan_design) {
        projek.catatan_design = [
          projek.catatan_design_1, projek.catatan_design_2, projek.catatan_design_3, projek.catatan_design_4, projek.catatan_design_5
        ].filter(Boolean).map(isi => ({ isi_catatan: isi as string }));
      }

      setData(projek);
      setLogs(res.data.logs);
      if (projek.status === "WAITING_RAB_UPLOAD") {
        try {
          const rabRes = await fetchRABList({ nomor_ulok: projek.nomor_ulok, status: "Disetujui" }, { suppressGlobalError: true });
          setApprovedRabs(rabRes.data || []);
        } catch {
          setApprovedRabs([]);
        }
      } else {
        setApprovedRabs([]);
      }
      if (projek.fasilitas && projek.fasilitas.length > 0) {
        setFasilitasTahap2(() => {
          const next = DEFAULT_FASILITAS_TAHAP2.map(item => ({ ...item }));
          projek.fasilitas?.forEach((item: any) => {
            const isLainnya = item.jenis_fasilitas === "LAINNYA";
            const idx = isLainnya
              ? next.findIndex(f => f.jenis_fasilitas === "LAINNYA" && !f.nama_fasilitas_lainnya)
              : next.findIndex(f => f.jenis_fasilitas === item.jenis_fasilitas);
            if (idx >= 0) next[idx] = { ...next[idx], ...item, keterangan: item.keterangan || "" };
            else next.push({ ...item, keterangan: item.keterangan || "" });
          });
          return next;
        });
      }

      const isRabReupload = projek.status === "WAITING_RAB_UPLOAD" && (projek.pp2_alasan_penolakan || projek.pp_manager_alasan_penolakan);
      if (isRabReupload) {
        setLinkGambarSipil(projek.link_gambar_kerja_final_sipil || "");
        setLinkGambarMe(projek.link_gambar_kerja_final_me || "");
        setFileGambarSipil([]);
        setFileGambarMe([]);
      }
    } catch (e: any) {
      setAlertMsg({ title: "Error", desc: e.message }); setAlertOpen(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    const email = sessionStorage.getItem("loggedInUserEmail") || "";
    const role = sessionStorage.getItem("userRole") || "";
    if (!email) { router.push("/auth"); return; }
    const cabang = sessionStorage.getItem("loggedInUserCabang") || "";
    if (!canAccessProjectPlanningByCabang(cabang) && !canViewAllBranches(role)) { router.replace("/dashboard"); return; }
    setUserEmail(email); setUserRole(role.toUpperCase());
    load();
  }, [id]);

  const showAlert = (title: string, desc: string) => { setAlertMsg({ title, desc }); setAlertOpen(true); };

  const openApproveDialog = (type: string) => {
    setPendingAction(type);
    setApprovalNote("");
    setShowApproveDialog(true);
  };

  const handleApprove = async (type: string) => {
    setActionLoading(true);
    try {
      if (type === "bm") await processBmApproval(id, { approver_email: userEmail, tindakan: "APPROVE", catatan: approvalNote });
      else if (type === "pp1") await processPpApproval1(id, { approver_email: userEmail, tindakan: "APPROVE", butuh_desain_3d: need3d, catatan: approvalNote });
      else if (type === "pp_mgr") await handleFinalReview("pp_mgr");
      else if (type === "pp2") await handleFinalReview("pp2");
      setShowApproveDialog(false);
      setApprovalNote("");
      showAlert("Berhasil", "Pengajuan berhasil disetujui.");
      await load();
    } catch (e: any) { showAlert("Gagal", e.message); }
    setActionLoading(false);
  };

  const handleFinalReview = async (type: "pp2" | "pp_mgr") => {
    const rejectedIds = rabRejectedItemIds
      .split(/[,\s]+/)
      .map(item => Number(item.trim()))
      .filter(item => Number.isFinite(item) && item > 0);
    const payload = {
      approver_email: userEmail,
      rab_tindakan: rabReviewAction,
      gambar_tindakan: gambarReviewAction,
      catatan: approvalNote,
      alasan_penolakan: rabReviewAction === "REJECT" || gambarReviewAction === "REJECT" ? rejectReason || approvalNote : undefined,
      rab_rejected_item_ids: rejectedIds,
      rab_rejected_item_notes: rabRejectedItemNotes,
    };
    if (type === "pp2") await processPpApproval2(id, payload);
    else await processPpManagerApproval(id, payload);
    setRabRejectedItemIds("");
    setRabRejectedItemNotes("");
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      const payload = { approver_email: userEmail, tindakan: "REJECT" as const, alasan_penolakan: rejectReason };
      if (pendingAction === "bm") await processBmApproval(id, payload);
      else if (pendingAction === "pp1") await processPpApproval1(id, { ...payload, butuh_desain_3d: false });
      else if (pendingAction === "pp_mgr" || pendingAction === "pp2") {
        setRabReviewAction("REJECT");
        setGambarReviewAction("REJECT");
        await (pendingAction === "pp2"
          ? processPpApproval2(id, { approver_email: userEmail, rab_tindakan: "REJECT", gambar_tindakan: "REJECT", alasan_penolakan: rejectReason })
          : processPpManagerApproval(id, { approver_email: userEmail, rab_tindakan: "REJECT", gambar_tindakan: "REJECT", alasan_penolakan: rejectReason }));
      }
      setShowRejectDialog(false); setRejectReason("");

      const rejectMsg = (pendingAction === "pp_mgr" || pendingAction === "pp2")
        ? "Pengajuan dikembalikan ke Cabang untuk Upload Ulang RAB & Gambar Kerja."
        : "Pengajuan telah ditolak dan dikembalikan ke pengaju dari awal.";

      showAlert("Ditolak", rejectMsg);
      await load();
    } catch (e: any) { showAlert("Gagal", e.message); }
    setActionLoading(false);
  };

  const handleUpload3d = async () => {
    if (!link3d.trim() && !file3d) return;
    setActionLoading(true);
    try {
      await uploadDesain3d(id, { uploader_email: userEmail, link_desain_3d: link3d }, file3d ?? undefined);
      showAlert("Berhasil", "Desain 3D berhasil diupload."); setLink3d(""); setFile3d(null); await load();
    } catch (e: any) { showAlert("Gagal", e.message); }
    setActionLoading(false);
  };

  const handleUploadRab = async () => {
    const selectedRabSipil = approvedRabs.find(r => String(r.toko?.lingkup_pekerjaan || r.lingkup_pekerjaan || "").toUpperCase().includes("SIPIL"));
    const selectedRabMe = approvedRabs.find(r => String(r.toko?.lingkup_pekerjaan || r.lingkup_pekerjaan || "").toUpperCase().includes("ME"));
    if (approvedRabs.length === 0) {
      showAlert("RAB Belum Tersedia", "RAB untuk ULOK ini belum diinput kontraktor atau belum selesai approval. Input dan approve RAB terlebih dahulu sebelum melanjutkan FPD.");
      return;
    }
    if (!selectedRabSipil && !selectedRabMe) {
      showAlert("RAB Belum Sesuai", "RAB approved tersedia, tetapi belum ada RAB dengan lingkup Sipil atau ME untuk ULOK ini.");
      return;
    }
    if (!linkGambarSipil.trim() && fileGambarSipil.length === 0 && !linkGambarMe.trim() && fileGambarMe.length === 0) return;
    
    // Wajib buka desain 3D jika ada
    if (data?.link_desain_3d && !openedLinks.has("desain_3d")) {
      showAlert("Peringatan", "Anda harus membuka dan melihat file Desain 3D terlebih dahulu sebelum mengupload RAB.");
      return;
    }
    
    // Validasi re-upload saat ditolak
    if (data?.pp2_alasan_penolakan || data?.pp_manager_alasan_penolakan) {
      const noChange = fileGambarSipil.length === 0 && fileGambarMe.length === 0
        && (selectedRabSipil?.id ?? null) === ((data as any).id_rab_sipil ?? null)
        && (selectedRabMe?.id ?? null) === ((data as any).id_rab_me ?? null)
        && linkGambarSipil.trim() === (((data as any).link_gambar_kerja_final_sipil || "")).trim()
        && linkGambarMe.trim() === ((data as any).link_gambar_kerja_final_me || "").trim();
      if (noChange) {
        showAlert("Peringatan", "Minimal harus melakukan satu perubahan pada gambar final atau fasilitas.");
        return;
      }
    }

    const changedRabFields = [
      ((selectedRabSipil?.id ?? null) !== ((data as any).id_rab_sipil ?? null)) ? "rab_sipil_final" : null,
      ((selectedRabMe?.id ?? null) !== ((data as any).id_rab_me ?? null)) ? "rab_me_final" : null,
      (fileGambarSipil.length > 0 || linkGambarSipil.trim() !== (((data as any).link_gambar_kerja_final_sipil || "")).trim()) ? "gambar_kerja_final_sipil" : null,
      (fileGambarMe.length > 0 || linkGambarMe.trim() !== ((data as any).link_gambar_kerja_final_me || "").trim()) ? "gambar_kerja_final_me" : null,
    ].filter(Boolean) as string[];

    setActionLoading(true);
    try {
      await uploadRabGambarKerja(
        id,
        {
          uploader_email: userEmail,
          id_rab_sipil: selectedRabSipil?.id,
          id_rab_me: selectedRabMe?.id,
          fasilitas: fasilitasTahap2.filter(f => f.is_tersedia || (f as any).nama_fasilitas_lainnya?.trim()),
          link_gambar_kerja_final_sipil: linkGambarSipil,
          link_gambar_kerja_final_me: linkGambarMe,
        } as any,
        fileGambarSipil,
        fileGambarMe
      );
      clearViewedFields(changedRabFields);
      showAlert("Berhasil", "Input tahap kedua berhasil dikirim ke B&M Manager.");
      setLinkGambarSipil(""); setFileGambarSipil([]);
      setLinkGambarMe(""); setFileGambarMe([]);
      await load();
    } catch (e: any) { showAlert("Gagal", e.message); }
    setActionLoading(false);
  };

  const handleFileChange = (setLink: React.Dispatch<React.SetStateAction<string>>, setFile: React.Dispatch<React.SetStateAction<File | null>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
      setLink(""); // clear link if file selected
    } else {
      setFile(null);
    }
  };

  const handleMultiFileChange = (setLink: React.Dispatch<React.SetStateAction<string>>, setFiles: React.Dispatch<React.SetStateAction<File[]>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 2);
    setFiles(files);
    if (files.length > 0) setLink("");
  };

  const fmt = (d: string | null) => {
    if (!d) return "-";
    try { return new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return d; }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <AppNavbar title="Detail" showBackButton backHref="/projek-planning" />
      <div className="text-center py-20 text-slate-400">Data tidak ditemukan</div>
    </div>
  );

  const st = STATUS_MAP[data.status] || { label: data.status, color: "bg-slate-100" };
  const backHref = searchParams.get("from") === "approval" ? "/approval" : "/projek-planning";
  const { isCoor, isBM, isPP, isPPMgr } = getPpRoles(userRole, userEmail);
  const isBBMM = userRole.includes("MAINTENANCE MANAGER") || userRole.includes("BBMM");
  const isBogorBm = (isBM || isBBMM) && (data.cabang || "").toUpperCase() === "BOGOR";
  const canActAsSubmitter = isCoor || isBogorBm;

  const coordinatorFields = [
    data.link_fpd ? "fpd" : null,
    (data as any).link_siteplan ? "siteplan" : null,
    data.link_gambar_kerja ? "gambar_kerja_awal" : null,
    data.link_gambar_kompetitor ? "gambar_kompetitor" : null,
  ].filter(Boolean) as string[];
  const ppSpecialistFields = [
    data.link_desain_3d && !isPP ? "desain_3d" : null,
    data.link_fpd_approved ? "fpd_approved" : null,
  ].filter(Boolean) as string[];
  const rabFinalFields = [
    data.link_rab_sipil ? "rab_sipil_final" : null,
    data.link_rab_me ? "rab_me_final" : null,
    data.link_gambar_kerja_final_sipil ? "gambar_kerja_final_sipil" : null,
    data.link_gambar_kerja_final_me ? "gambar_kerja_final_me" : null,
  ].filter(Boolean) as string[];
  const requiredFields = isPPMgr && data.status === "WAITING_PP_MANAGER_APPROVAL"
    ? [...ppSpecialistFields, ...rabFinalFields]
    : [...coordinatorFields, ...ppSpecialistFields, ...rabFinalFields];
  const allLinksOpened = requiredFields.length === 0 || requiredFields.every(f => openedLinks.has(f));
  const isRabReupload = !!(data.pp2_alasan_penolakan || data.pp_manager_alasan_penolakan);
  const hasRabUploadInput = approvedRabs.length > 0 && !!(linkGambarSipil.trim() || fileGambarSipil.length > 0 || linkGambarMe.trim() || fileGambarMe.length > 0);
  const hasRabUploadChange = !!(
    fileGambarSipil.length > 0 ||
    fileGambarMe.length > 0 ||
    linkGambarSipil.trim() !== (((data as any).link_gambar_kerja_final_sipil || "")).trim() ||
    linkGambarMe.trim() !== ((data as any).link_gambar_kerja_final_me || "").trim()
  );
  const latestRevisionSummary = [...logs]
    .reverse()
    .find(log =>
      log.aksi === "SUBMIT" &&
      log.status_sebelum === "DRAFT" &&
      ["WAITING_BM_APPROVAL", "WAITING_PP_APPROVAL_1"].includes(log.status_sesudah || "") &&
      log.keterangan?.includes("Perubahan revisi:")
    )
    ?.keterangan
    ?.split("Perubahan revisi:")[1]
    ?.trim();
  const revisionItems = latestRevisionSummary
    ? latestRevisionSummary.replace(/\.$/, "").split(",").map(item => item.trim()).filter(Boolean)
    : [];

  const getApprovalNote = (roleTarget: string) => {
    const approveLog = [...logs].reverse().find(l => l.aksi === "APPROVE" && (l.role === roleTarget || (roleTarget === 'BM_MANAGER' && l.role === 'BM')));
    if (!approveLog || !approveLog.keterangan) return null;
    const match = approveLog.keterangan.match(/Catatan:\s*(.+)$/i);
    return match ? match[1] : null;
  };

  const bmNote = getApprovalNote('BM_MANAGER');
  const pp1Note = getApprovalNote('PP_SPECIALIST');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <AppNavbar title="Detail FPD" showBackButton backHref={backHref} />
      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">

        <FpdTimeline currentStatus={data.status} />

        {/* Status Banner */}
        <div className={`px-4 py-3 rounded-xl ${st.color} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            {data.status === "COMPLETED" ? <CheckCircle2 className="w-5 h-5" /> : data.status === "REJECTED" ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            <span className="font-bold text-sm">{st.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-75">ID: {data.id}</span>
            <Button size="sm" variant="outline" className="h-7 text-xs bg-white text-slate-700 border-slate-300"
              onClick={async () => {
                try { await downloadProjekPlanningPdf(data.id); }
                catch (e: any) { showAlert("Gagal", e.message); }
              }}>
              <FileText className="w-3 h-3 mr-1" /> PDF
            </Button>
          </div>
        </div>

        {/* Info Toko */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Building2 className="w-4 h-4 text-red-600" /> Informasi Toko</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            <InfoRow label="Nomor ULOK" value={data.nomor_ulok} />
            <InfoRow label="Nama Toko / Lokasi" value={data.nama_lokasi || data.nama_toko} />
            <InfoRow label="Cabang" value={data.cabang} />
            <InfoRow label="Proyek" value={data.proyek || data.jenis_proyek} />
            <InfoRow label="Tipe Bangunan" value={`${data.is_ruko ? 'Ruko' : 'Non-Ruko'}${data.jumlah_lantai ? ` — ${data.jumlah_lantai} Lantai` : ''}`} />
            <InfoRow label="Kategori Toko" value={(data.jenis_pengajuan || '').includes('DARK STORE') ? '-' : ((data as any).is_dark_store ? 'B2B' : 'Reguler')} />
            <InfoRow label="Lingkup Pekerjaan" value={data.lingkup_pekerjaan} />
            <InfoRow label="Pengaju" value={data.nama_pengaju} />
            <InfoRow label="Email Pembuat" value={data.email_pembuat} />
            <InfoRow label="Link Google Maps" value={(data as any).link_google_maps} />
            <InfoRow
              label="Jenis Pengajuan"
              value={(() => {
                const items = (data.jenis_pengajuan || '').split(',').map((j: string) => j.trim()).filter(Boolean);
                const lainnya = items.includes('LAINNYA') && data.jenis_pengajuan_lainnya ? ` (${data.jenis_pengajuan_lainnya})` : '';
                return items.join(', ') + lainnya || data.jenis_pengajuan;
              })()}
            />
            {(data as any).beanspot_tipe && <InfoRow label="Tipe Bean Spot" value={(data as any).beanspot_tipe === "Basic" ? "RTD ONLY" : (data as any).beanspot_tipe} />}
            <InfoRow label="Head to Head" value={(data.jenis_pengajuan || '').includes('DARK STORE') ? '-' : ((data as any).is_head_to_head ? `✓ Ya${(data as any).jarak_head_to_head ? ` (${(data as any).jarak_head_to_head} m)` : ''}` : 'Tidak')} />
            <InfoRow label="Seating Area" value={(data.jenis_pengajuan || '').includes('DARK STORE') ? '-' : ((data as any).is_seating_area ? '✓ Ya' : 'Tidak')} />
            <InfoRow label="Luas Bangunan" value={(data as any).luas_bangunan ? `${(data as any).luas_bangunan} m²` : null} />
            <InfoRow label="Luas Area Terbuka" value={(data as any).luas_area_terbuka ? `${(data as any).luas_area_terbuka} m²` : null} />
            <InfoRow label="Luas Area Terbangun" value={(data as any).luas_area_terbangun ? `${(data as any).luas_area_terbangun} m²` : null} />
            <InfoRow label="Luas Gudang" value={(data as any).luas_gudang ? `${(data as any).luas_gudang} m²` : null} />
            <InfoRow label="Luas Area Parkir" value={(data as any).luas_area_parkir ? `${(data as any).luas_area_parkir} m²` : null} />
            <InfoRow label="Luas Area Sales" value={(data as any).luas_area_sales ? `${(data as any).luas_area_sales} m²` : null} />
            <InfoRow label="P x L Bangunan" value={(data as any).pxl_bangunan || null} />
            <InfoRow label="P x L Area Parkir" value={(data as any).pxl_area_parkir || null} />
            <InfoRow label="Estimasi Biaya" value={data.estimasi_biaya ? `Rp ${Number(data.estimasi_biaya).toLocaleString('id-ID')}` : null} />
          </CardContent>
        </Card>

        {/* Fasilitas */}
        {data.fasilitas && data.fasilitas.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Droplets className="w-4 h-4 text-blue-600" /> Fasilitas Yang Disediakan</CardTitle></CardHeader>
            <CardContent className="space-y-0">
              {data.fasilitas.map((f: any, idx: number) => {
                let label = f.jenis_fasilitas;
                if (label === 'AIR_BERSIH') label = "Sumber Air Bersih";
                else if (label === 'DRAINASE') label = "Drain Air Kotor";
                else if (label === 'LAINNYA') label = f.nama_fasilitas_lainnya || "Lainnya";
                
                return <InfoRow key={idx} label={label} value={f.is_tersedia ? `Ya — ${f.keterangan || ""}` : "Tidak"} />;
              })}
            </CardContent>
          </Card>
        )}

        {/* Ketentuan & Catatan */}
        {data.ketentuan && data.ketentuan.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Ketentuan Pengelola / Landlord</CardTitle></CardHeader>
            <CardContent className="space-y-0">
              {data.ketentuan.map((k: any, idx: number) => <InfoRow key={idx} label={`Ketentuan ${idx + 1}`} value={k.isi_ketentuan} />)}
            </CardContent>
          </Card>
        )}
        {data.catatan_design && data.catatan_design.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Catatan Desain</CardTitle></CardHeader>
            <CardContent className="space-y-0">
              {data.catatan_design.map((c: any, idx: number) => <InfoRow key={idx} label={`Catatan ${idx + 1}`} value={c.isi_catatan} />)}
            </CardContent>
          </Card>
        )}

        {/* Links */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex justify-between items-center">
              <span>Dokumen & File</span>
              {!allLinksOpened && <span className="text-xs text-red-500 font-normal">Harap lihat/unduh semua dokumen untuk melakukan persetujuan</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            
            {/* Kategori 1: Dokumen Pengajuan Awal */}
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b pb-1">Dokumen Pengajuan ({(data.cabang || "").toUpperCase() === "BOGOR" ? "B&M Manager" : "Koordinator"})</h3>
              <FileProxyRow label="Gambar Kerja Sipil (FPD)" hasFile={!!data.link_fpd} projektId={id} field="fpd" onViewed={markFieldViewed} onUnviewed={markFieldUnviewed} fileUrl={data.link_fpd} />
              <FileProxyRow label="Siteplan" hasFile={!!(data as any).link_siteplan} projektId={id} field="siteplan" onViewed={markFieldViewed} onUnviewed={markFieldUnviewed} fileUrl={(data as any).link_siteplan} />
              <FileProxyRow label="Gambar Kerja ME" hasFile={!!data.link_gambar_kerja} projektId={id} field="gambar_kerja_awal" onViewed={markFieldViewed} onUnviewed={markFieldUnviewed} fileUrl={data.link_gambar_kerja} />
              <FileProxyRow label="Gambar Kompetitor" hasFile={!!data.link_gambar_kompetitor} projektId={id} field="gambar_kompetitor" onViewed={markFieldViewed} onUnviewed={markFieldUnviewed} fileUrl={data.link_gambar_kompetitor} />
            </div>

            {/* Kategori 2: Dokumen PP Specialist */}
            {(data.link_desain_3d || data.link_fpd_approved) && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b pb-1">Dokumen PP Specialist</h3>
                <FileProxyRow label="Desain 3D" hasFile={!!data.link_desain_3d} projektId={id} field="desain_3d" onViewed={markFieldViewed} onUnviewed={markFieldUnviewed} fileUrl={data.link_desain_3d} />
                <FileProxyRow label="Gambar Kerja Disetujui" hasFile={!!data.link_fpd_approved} projektId={id} field="fpd_approved" onViewed={markFieldViewed} onUnviewed={markFieldUnviewed} fileUrl={data.link_fpd_approved} />
              </div>
            )}

            {/* Kategori 3: Dokumen RAB & Gambar Final (Coordinator) */}
            {(data.link_rab_sipil || data.link_rab_me || data.link_gambar_kerja_final_sipil || data.link_gambar_kerja_final_me) && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b pb-1">Dokumen RAB & Final (Koordinator)</h3>
                <FileProxyRow label="RAB Sipil Final" hasFile={!!data.link_rab_sipil} projektId={id} field="rab_sipil_final" onViewed={markFieldViewed} onUnviewed={markFieldUnviewed} fileUrl={data.link_rab_sipil} />
                <FileProxyRow label="RAB ME Final" hasFile={!!data.link_rab_me} projektId={id} field="rab_me_final" onViewed={markFieldViewed} onUnviewed={markFieldUnviewed} fileUrl={data.link_rab_me} />
                <FileProxyRow label="Gambar Kerja Final Sipil" hasFile={!!data.link_gambar_kerja_final_sipil} projektId={id} field="gambar_kerja_final_sipil" onViewed={markFieldViewed} onUnviewed={markFieldUnviewed} fileUrl={data.link_gambar_kerja_final_sipil} />
                <FileProxyRow label="Gambar Kerja Final ME" hasFile={!!data.link_gambar_kerja_final_me} projektId={id} field="gambar_kerja_final_me" onViewed={markFieldViewed} onUnviewed={markFieldUnviewed} fileUrl={data.link_gambar_kerja_final_me} />
              </div>
            )}



            {requiredFields.length === 0 && (
              <p className="text-xs text-slate-400 italic py-2">Belum ada dokumen yang diupload.</p>
            )}
          </CardContent>
        </Card>

        {/* ACTION PANELS */}
        
        {/* DRAFT (Ditolak) -> Revisi Form */}
        {data.status === "DRAFT" && canActAsSubmitter && (data.bm_alasan_penolakan || data.pp1_alasan_penolakan) && (
          <Card className="border-red-300 bg-red-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-red-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Pengajuan Ditolak</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="text-sm text-red-700 bg-red-100/50 p-3 rounded-lg border border-red-200">
                <span className="font-semibold block mb-1">Alasan Penolakan ({data.pp1_alasan_penolakan ? 'PP Specialist' : 'B&M Manager'}):</span>
                {data.pp1_alasan_penolakan || data.bm_alasan_penolakan}
              </div>
              <Button onClick={() => router.push(`/projek-planning/form?resubmit=${id}`)} className="w-full bg-red-600 hover:bg-red-700 text-white shadow-sm">
                <FileText className="w-4 h-4 mr-1.5" /> Revisi Pengajuan
              </Button>
            </CardContent>
          </Card>
        )}

        {/* BM Approval */}
        {(data.status === "WAITING_BM_APPROVAL" || data.status === "WAITING_BM_APPROVAL_2") && (isBM || isBBMM) && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-amber-800">Approval B&M Manager{data.status === "WAITING_BM_APPROVAL_2" ? " Tahap 2" : ""}</CardTitle></CardHeader>
            <CardContent className="p-4 flex gap-3 flex-col">
              {data.bm_alasan_penolakan && (
                <div className="text-sm text-amber-800 bg-amber-100/50 p-3 rounded-lg border border-amber-200 mb-2">
                  <span className="font-semibold block mb-1"><AlertTriangle className="w-4 h-4 inline mr-1" /> Revisi Pengajuan:</span>
                  Koordinator telah memperbaiki form ini berdasarkan alasan penolakan Anda sebelumnya:<br/>
                  <span className="italic">"{data.bm_alasan_penolakan}"</span>
                </div>
              )}
              {data.pp1_alasan_penolakan && (
                <div className="text-sm text-amber-800 bg-amber-100/50 p-3 rounded-lg border border-amber-200 mb-2">
                  <span className="font-semibold block mb-1"><AlertTriangle className="w-4 h-4 inline mr-1" /> Catatan PP Specialist:</span>
                  Pengajuan ini pernah ditolak oleh PP Specialist tahap 1. Pastikan revisi berikut sudah menjawab catatan ini sebelum disetujui kembali:<br/>
                  <span className="italic">"{data.pp1_alasan_penolakan}"</span>
                </div>
              )}
              {latestRevisionSummary && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200 mb-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-green-800">Ringkasan Revisi Koordinator</p>
                      <p className="text-xs text-green-700 mt-0.5">
                        Bagian berikut berubah setelah penolakan PP Specialist dan perlu dicek ulang B&M Manager.
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {revisionItems.map(item => (
                          <span key={item} className="inline-flex items-center rounded-full border border-green-200 bg-white px-2.5 py-1 text-xs font-semibold text-green-700">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <Button onClick={() => { setPendingAction("bm"); setShowRejectDialog(true); }} className="flex-1 bg-white hover:bg-slate-50 text-red-600 border border-red-200 shadow-sm" disabled={actionLoading || !allLinksOpened}>
                  <XCircle className="w-4 h-4 mr-1.5" /> Tolak
                </Button>
                <Button onClick={() => openApproveDialog("bm")} className="flex-1 bg-green-600 hover:bg-green-700 shadow-sm" disabled={actionLoading || !allLinksOpened}>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Setujui
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PP Specialist 1 */}
        {data.status === "WAITING_PP_APPROVAL_1" && isPP && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-blue-800">Approval PP Specialist (Tahap 1)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.pp1_alasan_penolakan && (
                <div className="text-sm text-blue-800 bg-blue-100/50 p-3 rounded-lg border border-blue-200 mb-2">
                  <span className="font-semibold block mb-1"><AlertTriangle className="w-4 h-4 inline mr-1" /> Revisi Pengajuan:</span>
                  Koordinator telah memperbaiki form ini berdasarkan alasan penolakan Anda sebelumnya:<br/>
                  <span className="italic">"{data.pp1_alasan_penolakan}"</span>
                </div>
              )}
              {bmNote && (
                <div className="text-sm text-blue-800 bg-blue-100/50 p-3 rounded-lg border border-blue-200 mb-2">
                  <span className="font-semibold block mb-1"><ClipboardList className="w-4 h-4 inline mr-1" /> Catatan B&M Manager:</span>
                  <span className="italic">"{bmNote}"</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="need3d" checked={need3d} onChange={e => setNeed3d(e.target.checked)} className="rounded" />
                <label htmlFor="need3d" className="text-sm">Butuh Desain 3D</label>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => { setPendingAction("pp1"); setShowRejectDialog(true); }} className="flex-1 bg-white hover:bg-slate-50 text-red-600 border border-red-200 shadow-sm" disabled={actionLoading || !allLinksOpened}>
                  <XCircle className="w-4 h-4 mr-1.5" /> Tolak
                </Button>
                <Button onClick={() => openApproveDialog("pp1")} className="flex-1 bg-green-600 hover:bg-green-700 shadow-sm" disabled={actionLoading || !allLinksOpened}>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Setujui (Lanjut ke RAB)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload 3D */}
        {data.status === "PP_DESIGN_3D_REQUIRED" && isPP && (
          <Card className="border-purple-200 bg-purple-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-purple-800">Upload Desain 3D</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1 block">Link Desain 3D GDrive</Label>
                  <Input placeholder="https://drive.google.com/..." value={link3d} onChange={e => { setLink3d(e.target.value); setFile3d(null); }} className="bg-white" disabled={!!file3d} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Atau Upload File ke Drive</Label>
                  <Input type="file" onChange={handleFileChange(setLink3d, setFile3d)} className="bg-white file:bg-purple-50 file:text-purple-700 file:border-0 file:rounded file:px-2 file:mr-2 cursor-pointer" />
                  {file3d && <p className="text-[10px] text-purple-600 mt-1">File siap diupload: {file3d.name}</p>}
                </div>
              </div>
              <Button onClick={handleUpload3d} className="w-full bg-purple-400 hover:bg-purple-500 text-white" disabled={actionLoading || (!link3d.trim() && !file3d)}>
                <Send className="w-4 h-4 mr-1.5" /> Upload Desain 3D
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upload RAB */}
        {data.status === "WAITING_RAB_UPLOAD" && canActAsSubmitter && (
          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-orange-800">Upload RAB & Gambar Kerja Final</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-4">
              {(data.pp2_alasan_penolakan || data.pp_manager_alasan_penolakan) && (
                <div className="text-sm text-red-700 bg-red-100/50 p-3 rounded-lg border border-red-200 mb-2">
                  <span className="font-semibold block mb-1"><AlertTriangle className="w-4 h-4 inline mr-1" /> Alasan Penolakan ({data.pp_manager_alasan_penolakan ? 'PP Manager' : 'PP Specialist'}):</span>
                  {data.pp_manager_alasan_penolakan || data.pp2_alasan_penolakan}
                  <p className="text-xs text-red-600 mt-2">
                    Data upload sebelumnya sudah dimuat. Ubah minimal satu link atau pilih file baru sebelum submit ulang.
                  </p>
                </div>
              )}
              {bmNote && (
                <div className="text-sm text-blue-800 bg-blue-100/50 p-3 rounded-lg border border-blue-200 mb-2">
                  <span className="font-semibold block mb-1"><ClipboardList className="w-4 h-4 inline mr-1" /> Catatan B&M Manager:</span>
                  <span className="italic">"{bmNote}"</span>
                </div>
              )}
              {pp1Note && (
                <div className="text-sm text-blue-800 bg-blue-100/50 p-3 rounded-lg border border-blue-200 mb-2">
                  <span className="font-semibold block mb-1"><ClipboardList className="w-4 h-4 inline mr-1" /> Catatan PP Specialist (Tahap 1):</span>
                  <span className="italic">"{pp1Note}"</span>
                </div>
              )}
              {data.link_desain_3d && !openedLinks.has("desain_3d") && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Anda harus <strong>melihat atau mengunduh Desain 3D</strong> terlebih dahulu sebelum bisa mengupload RAB. Buka dokumen di bagian Dokumen PP Specialist di atas.</span>
                </div>
              )}

              <div className={`text-sm p-3 rounded-lg border ${approvedRabs.length > 0 ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                <span className="font-semibold block mb-1">RAB Sparta Approved</span>
                {approvedRabs.length > 0 ? (
                  <div className="space-y-1">
                    {approvedRabs.map((rab: any) => (
                      <div key={rab.id} className="flex items-center justify-between gap-2">
                        <span>#{rab.id} - {rab.toko?.lingkup_pekerjaan || rab.lingkup_pekerjaan || "RAB"} - {rab.nama_pt || "Kontraktor"}</span>
                        <span className="text-xs font-bold">{rab.grand_total_final ? `Rp ${Number(rab.grand_total_final).toLocaleString("id-ID")}` : "Approved"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span>RAB untuk ULOK ini belum diinput kontraktor atau belum selesai approval. Input dan approve RAB terlebih dahulu sebelum melanjutkan FPD.</span>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-orange-800">Fasilitas Yang Disediakan</Label>
                <div className="grid grid-cols-1 gap-3">
                  {fasilitasTahap2.map((fac, idx) => {
                    const meta = FACILITY_META[fac.jenis_fasilitas];
                    if (fac.jenis_fasilitas === "LAINNYA") {
                      return (
                        <div key={`lainnya-${idx}`} className="p-3 border border-orange-100 rounded-lg space-y-2 bg-white">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-sm font-semibold text-slate-700">Fasilitas Lainnya</Label>
                            {fasilitasTahap2.filter(item => item.jenis_fasilitas === "LAINNYA").length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setFasilitasTahap2(prev => prev.filter((_, itemIdx) => itemIdx !== idx))}
                                className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                Hapus
                              </Button>
                            )}
                          </div>
                          <Input
                            value={fac.nama_fasilitas_lainnya || ""}
                            onChange={e => setFasilitasTahap2(prev => prev.map((item, i) => i === idx ? {
                              ...item,
                              nama_fasilitas_lainnya: e.target.value,
                              is_tersedia: !!e.target.value.trim(),
                            } : item))}
                            placeholder="Nama fasilitas lainnya..."
                            className="bg-white"
                          />
                          {!!fac.nama_fasilitas_lainnya && (
                            <Input
                              value={fac.keterangan || ""}
                              onChange={e => setFasilitasTahap2(prev => prev.map((item, i) => i === idx ? { ...item, keterangan: e.target.value } : item))}
                              placeholder="Keterangan fasilitas lainnya..."
                              className="bg-white"
                            />
                          )}
                        </div>
                      );
                    }

                    const unitOptions = meta?.units ?? ["unit"];
                    const measurement = parseFacilityMeasurement(fac.keterangan, unitOptions[0]);
                    const icon = fac.jenis_fasilitas === "AIR_BERSIH"
                      ? <Droplets className="w-3.5 h-3.5" />
                      : fac.jenis_fasilitas === "DRAINASE"
                        ? <Wind className="w-3.5 h-3.5" />
                        : <Zap className={`w-3.5 h-3.5 ${fac.jenis_fasilitas === "LISTRIK" ? "text-yellow-500" : ""}`} />;

                    return (
                      <div key={`${fac.jenis_fasilitas}-${idx}`} className="p-3 border border-orange-100 rounded-lg space-y-2 bg-white">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={!!fac.is_tersedia}
                            onChange={e => setFasilitasTahap2(prev => prev.map((item, i) => i === idx ? { ...item, is_tersedia: e.target.checked } : item))}
                          />
                          <span className="flex items-center gap-1.5">{icon} {meta?.label || fac.jenis_fasilitas}</span>
                        </label>
                        {fac.is_tersedia && (
                          <div className="grid grid-cols-[1fr_104px] gap-2">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={measurement.amount}
                              onChange={e => setFasilitasTahap2(prev => prev.map((item, i) => i === idx ? {
                                ...item,
                                keterangan: e.target.value ? `${e.target.value} ${measurement.unit}` : "",
                              } : item))}
                              placeholder={meta?.placeholder || "Jumlah"}
                              className="bg-white"
                            />
                            <select
                              value={measurement.unit}
                              onChange={e => setFasilitasTahap2(prev => prev.map((item, i) => i === idx ? {
                                ...item,
                                keterangan: measurement.amount ? `${measurement.amount} ${e.target.value}` : "",
                              } : item))}
                              className="h-10 rounded-md border border-input bg-white px-3 text-sm text-slate-700"
                            >
                              {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFasilitasTahap2(prev => [...prev, { jenis_fasilitas: "LAINNYA", nama_fasilitas_lainnya: "", is_tersedia: false, keterangan: "" }])}
                  className="mt-1 text-xs bg-white"
                >
                  + Tambah Fasilitas Lainnya
                </Button>
              </div>

              {/* Gambar Kerja Final Sipil */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-orange-800 flex items-center gap-1">Gambar Kerja Final Sipil</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input placeholder="Link Gambar Kerja Final Sipil (GDrive)..." value={linkGambarSipil} onChange={e => { setLinkGambarSipil(e.target.value); setFileGambarSipil([]); }} className="bg-white" disabled={fileGambarSipil.length > 0} />
                  <div>
                    <Input type="file" accept="image/*,.pdf,.dwg" multiple onChange={handleMultiFileChange(setLinkGambarSipil, setFileGambarSipil)} className="bg-white file:bg-orange-50 file:text-orange-700 file:border-0 file:rounded file:px-2 file:mr-2 cursor-pointer" />
                    {fileGambarSipil.length > 0 && <p className="text-[10px] text-orange-600 mt-1">File siap: {fileGambarSipil.map(file => file.name).join(", ")}</p>}
                  </div>
                </div>
              </div>

              {/* Gambar Kerja Final ME */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-orange-800 flex items-center gap-1">Gambar Kerja Final ME</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input placeholder="Link Gambar Kerja Final ME (GDrive)..." value={linkGambarMe} onChange={e => { setLinkGambarMe(e.target.value); setFileGambarMe([]); }} className="bg-white" disabled={fileGambarMe.length > 0} />
                  <div>
                    <Input type="file" accept="image/*,.pdf,.dwg" multiple onChange={handleMultiFileChange(setLinkGambarMe, setFileGambarMe)} className="bg-white file:bg-orange-50 file:text-orange-700 file:border-0 file:rounded file:px-2 file:mr-2 cursor-pointer" />
                    {fileGambarMe.length > 0 && <p className="text-[10px] text-orange-600 mt-1">File siap: {fileGambarMe.map(file => file.name).join(", ")}</p>}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleUploadRab}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                disabled={actionLoading || (data.link_desain_3d ? !openedLinks.has("desain_3d") : false) || !hasRabUploadInput || (isRabReupload && !hasRabUploadChange)}
              >
                <Send className="w-4 h-4 mr-1.5" /> Submit RAB & Gambar Kerja Final
              </Button>
              {isRabReupload && !hasRabUploadChange && (
                <p className="text-xs text-orange-700 text-center font-medium">
                  Belum ada perubahan dari upload sebelumnya.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* PP Specialist 2 */}
        {data.status === "WAITING_PP_APPROVAL_2" && isPP && (
          <Card className="border-cyan-200 bg-cyan-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-cyan-800">Approval PP Specialist</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ReviewSelect label="Review RAB" value={rabReviewAction} onChange={setRabReviewAction} />
                <ReviewSelect label="Review Gambar Final" value={gambarReviewAction} onChange={setGambarReviewAction} />
              </div>
              {rabReviewAction === "REJECT" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input value={rabRejectedItemIds} onChange={e => setRabRejectedItemIds(e.target.value)} placeholder="ID item RAB salah, pisahkan koma" />
                  <Input value={rabRejectedItemNotes} onChange={e => setRabRejectedItemNotes(e.target.value)} placeholder="Catatan item RAB" />
                </div>
              )}
              {(rabReviewAction === "REJECT" || gambarReviewAction === "REJECT") && (
                <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Alasan penolakan..." rows={2} />
              )}
              <Textarea value={approvalNote} onChange={e => setApprovalNote(e.target.value)} placeholder="Catatan approval/review..." rows={2} />
              <Button onClick={() => handleApprove("pp2")} className="flex-1 bg-cyan-600 hover:bg-cyan-700 shadow-sm" disabled={actionLoading || !allLinksOpened}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Simpan Review
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PP Manager Final */}
        {data.status === "WAITING_PP_MANAGER_APPROVAL" && isPPMgr && (
          <Card className="border-indigo-200 bg-indigo-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-indigo-800">Approval PP Manager (Final)</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ReviewSelect label="Review RAB" value={rabReviewAction} onChange={setRabReviewAction} />
                <ReviewSelect label="Review Gambar Final" value={gambarReviewAction} onChange={setGambarReviewAction} />
              </div>
              {rabReviewAction === "REJECT" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input value={rabRejectedItemIds} onChange={e => setRabRejectedItemIds(e.target.value)} placeholder="ID item RAB salah, pisahkan koma" />
                  <Input value={rabRejectedItemNotes} onChange={e => setRabRejectedItemNotes(e.target.value)} placeholder="Catatan item RAB" />
                </div>
              )}
              {(rabReviewAction === "REJECT" || gambarReviewAction === "REJECT") && (
                <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Alasan penolakan..." rows={2} />
              )}
              <Textarea value={approvalNote} onChange={e => setApprovalNote(e.target.value)} placeholder="Catatan approval/review..." rows={2} />
              <Button onClick={() => handleApprove("pp_mgr")} className="flex-1 bg-indigo-600 hover:bg-indigo-700 shadow-sm" disabled={actionLoading || !allLinksOpened}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Simpan Review Final
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Approval History */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><History className="w-4 h-4 text-slate-600" /> Riwayat Approval</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            <InfoRow label="B&M Manager" value={data.bm_approver_email ? `${data.bm_approver_email} — ${fmt(data.bm_waktu_persetujuan)}` : null} />
            <InfoRow label="B&M Manager (2)" value={(data as any).bm2_approver_email ? `${(data as any).bm2_approver_email} — ${fmt((data as any).bm2_waktu_persetujuan)}` : null} />
            <InfoRow label="PP Specialist (1)" value={data.pp1_approver_email ? `${data.pp1_approver_email} — ${fmt(data.pp1_waktu_persetujuan)}` : null} />
            <InfoRow label="PP Manager" value={data.pp_manager_approver_email ? `${data.pp_manager_approver_email} — ${fmt(data.pp_manager_waktu_persetujuan)}` : null} />
            <InfoRow label="PP Specialist (2)" value={data.pp2_approver_email ? `${data.pp2_approver_email} — ${fmt(data.pp2_waktu_persetujuan)}` : null} />
            <InfoRow label="Review PP Specialist" value={(data as any).pp2_rab_status ? `RAB: ${(data as any).pp2_rab_status}, Gambar: ${(data as any).pp2_gambar_status || "-"}` : null} />
            <InfoRow label="Review PP Manager" value={(data as any).pp_manager_rab_status ? `RAB: ${(data as any).pp_manager_rab_status}, Gambar: ${(data as any).pp_manager_gambar_status || "-"}` : null} />
          </CardContent>
        </Card>

        {/* Audit Log */}
        {logs.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><History className="w-4 h-4" /> Log Aktivitas</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex gap-3 text-xs border-b border-slate-50 pb-2 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-700">{log.aksi} oleh {log.actor_email} <span className="text-slate-400">({log.role})</span></p>
                      {log.keterangan && <p className="text-slate-500 mt-0.5">{log.keterangan}</p>}
                      <p className="text-slate-400 mt-0.5">{fmt(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Tolak Pengajuan</AlertDialogTitle>
            <AlertDialogDescription>Berikan alasan penolakan. Pengajuan akan dikembalikan ke Coordinator.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Alasan penolakan..." rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={!rejectReason.trim() || actionLoading}
              className="bg-red-600 hover:bg-red-700">
              {actionLoading ? "Memproses..." : "Tolak"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Setujui Pengajuan</AlertDialogTitle>
            <AlertDialogDescription>Catatan approval bersifat opsional. Kosongkan jika tidak ada catatan tambahan.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={approvalNote} onChange={e => setApprovalNote(e.target.value)} placeholder="Catatan approval (opsional)..." rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleApprove(pendingAction)} disabled={actionLoading || !pendingAction}
              className="bg-green-600 hover:bg-green-700">
              {actionLoading ? "Memproses..." : "Setujui"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert */}
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">{alertMsg.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-center">{alertMsg.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 w-full rounded-lg">Tutup</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
