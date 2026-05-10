"use client"

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
  CheckCircle2, XCircle, Clock, FileText, ExternalLink, ClipboardList,
  User, Building2, Droplets, Wind, Zap, History, Loader2, Send,
} from "lucide-react";
import {
  fetchProjekPlanningDetail, processBmApproval, processPpApproval1,
  uploadDesain3d, uploadRabGambarKerja, processPpManagerApproval, processPpApproval2,
  type ProjekPlanningItem, type ProjekPlanningLog,
} from "@/lib/api";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-slate-100 text-slate-700" },
  WAITING_BM_APPROVAL: { label: "Menunggu B&M Manager", color: "bg-amber-100 text-amber-800" },
  WAITING_PP_APPROVAL_1: { label: "Menunggu PP (Tahap 1)", color: "bg-blue-100 text-blue-800" },
  PP_DESIGN_3D_REQUIRED: { label: "Perlu Design 3D", color: "bg-purple-100 text-purple-800" },
  WAITING_RAB_UPLOAD: { label: "Upload RAB & Gambar Kerja", color: "bg-orange-100 text-orange-800" },
  WAITING_PP_MANAGER_APPROVAL: { label: "Menunggu PP Manager", color: "bg-indigo-100 text-indigo-800" },
  WAITING_PP_APPROVAL_2: { label: "Menunggu PP Final", color: "bg-cyan-100 text-cyan-800" },
  COMPLETED: { label: "Selesai", color: "bg-green-100 text-green-800" },
  REJECTED: { label: "Ditolak", color: "bg-red-100 text-red-700" },
};

function InfoRow({ label, value, link }: { label: string; value: string | null; link?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs font-semibold text-slate-500 sm:w-48 shrink-0">{label}</span>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 break-all">
          <ExternalLink className="w-3 h-3 shrink-0" /> {value.length > 60 ? value.slice(0, 60) + "..." : value}
        </a>
      ) : <span className="text-sm text-slate-800">{value}</span>}
    </div>
  );
}

export default function DetailProjekPlanning() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [data, setData] = useState<ProjekPlanningItem | null>(null);
  const [logs, setLogs] = useState<ProjekPlanningLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ title: "", desc: "" });
  const [need3d, setNeed3d] = useState(false);
  const [link3d, setLink3d] = useState("");
  const [linkRab, setLinkRab] = useState("");
  const [linkGambar, setLinkGambar] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchProjekPlanningDetail(id);
      setData(res.data.projek);
      setLogs(res.data.logs);
    } catch (e: any) {
      setAlertMsg({ title: "Error", desc: e.message }); setAlertOpen(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    const email = sessionStorage.getItem("loggedInUserEmail") || "";
    const role = sessionStorage.getItem("userRole") || "";
    if (!email) { router.push("/auth"); return; }
    setUserEmail(email); setUserRole(role.toUpperCase());
    load();
  }, [id]);

  const showAlert = (title: string, desc: string) => { setAlertMsg({ title, desc }); setAlertOpen(true); };

  const handleApprove = async (type: string) => {
    setActionLoading(true);
    try {
      if (type === "bm") await processBmApproval(id, { approver_email: userEmail, tindakan: "APPROVE" });
      else if (type === "pp1") await processPpApproval1(id, { approver_email: userEmail, tindakan: "APPROVE", butuh_desain_3d: need3d });
      else if (type === "pp_mgr") await processPpManagerApproval(id, { approver_email: userEmail, tindakan: "APPROVE" });
      else if (type === "pp2") await processPpApproval2(id, { approver_email: userEmail, tindakan: "APPROVE" });
      showAlert("Berhasil", "Pengajuan berhasil disetujui.");
      await load();
    } catch (e: any) { showAlert("Gagal", e.message); }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      const payload = { approver_email: userEmail, tindakan: "REJECT" as const, alasan_penolakan: rejectReason };
      if (pendingAction === "bm") await processBmApproval(id, payload);
      else if (pendingAction === "pp1") await processPpApproval1(id, { ...payload, butuh_desain_3d: false });
      else if (pendingAction === "pp_mgr") await processPpManagerApproval(id, payload);
      else if (pendingAction === "pp2") await processPpApproval2(id, payload);
      setShowRejectDialog(false); setRejectReason("");
      showAlert("Ditolak", "Pengajuan telah ditolak dan dikembalikan ke Coordinator.");
      await load();
    } catch (e: any) { showAlert("Gagal", e.message); }
    setActionLoading(false);
  };

  const handleUpload3d = async () => {
    if (!link3d.trim()) return;
    setActionLoading(true);
    try {
      await uploadDesain3d(id, { uploader_email: userEmail, link_desain_3d: link3d });
      showAlert("Berhasil", "Desain 3D berhasil diupload."); setLink3d(""); await load();
    } catch (e: any) { showAlert("Gagal", e.message); }
    setActionLoading(false);
  };

  const handleUploadRab = async () => {
    if (!linkRab.trim() && !linkGambar.trim()) return;
    setActionLoading(true);
    try {
      await uploadRabGambarKerja(id, { uploader_email: userEmail, link_rab: linkRab, link_gambar_kerja: linkGambar });
      showAlert("Berhasil", "RAB & Gambar Kerja berhasil diupload."); await load();
    } catch (e: any) { showAlert("Gagal", e.message); }
    setActionLoading(false);
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
  const isBM = userRole.includes("MANAGER") && !userRole.includes("BUILDING");
  const isBBMM = userRole.includes("BUILDING") && userRole.includes("MAINTENANCE") && userRole.includes("MANAGER");
  const isCoor = userRole.includes("COORDINATOR");

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <AppNavbar title="Detail FPD" showBackButton backHref="/projek-planning" />
      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">

        {/* Status Banner */}
        <div className={`px-4 py-3 rounded-xl ${st.color} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            {data.status === "COMPLETED" ? <CheckCircle2 className="w-5 h-5" /> : data.status === "REJECTED" ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            <span className="font-bold text-sm">{st.label}</span>
          </div>
          <span className="text-xs opacity-75">ID: {data.id}</span>
        </div>

        {/* Info Toko */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Building2 className="w-4 h-4 text-red-600" /> Informasi Toko</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            <InfoRow label="Nomor ULOK" value={data.nomor_ulok} />
            <InfoRow label="Nama Toko / Lokasi" value={data.nama_lokasi || data.nama_toko} />
            <InfoRow label="Cabang" value={data.cabang} />
            <InfoRow label="Proyek" value={data.proyek || data.jenis_proyek} />
            <InfoRow label="Lingkup Pekerjaan" value={data.lingkup_pekerjaan} />
            <InfoRow label="Pengaju" value={data.nama_pengaju} />
            <InfoRow label="Email Pembuat" value={data.email_pembuat} />
            <InfoRow label="Jenis Pengajuan" value={data.jenis_pengajuan === "LAINNYA" ? `Lainnya: ${data.jenis_pengajuan_lainnya}` : data.jenis_pengajuan} />
            <InfoRow label="Estimasi Biaya" value={data.estimasi_biaya ? `Rp ${Number(data.estimasi_biaya).toLocaleString("id-ID")}` : null} />
          </CardContent>
        </Card>

        {/* Fasilitas */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Droplets className="w-4 h-4 text-blue-600" /> Fasilitas Yang Disediakan</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            <InfoRow label="Sumber Air Bersih" value={data.fasilitas_air_bersih ? `Ya — ${data.fasilitas_air_bersih_keterangan || ""}` : "Tidak"} />
            <InfoRow label="Drain Air Kotor" value={data.fasilitas_drain ? `Ya — ${data.fasilitas_drain_keterangan || ""}` : "Tidak"} />
            <InfoRow label="AC" value={data.fasilitas_ac ? `Ya — ${data.fasilitas_ac_keterangan || ""}` : "Tidak"} />
            {data.fasilitas_lainnya && <InfoRow label="Fasilitas Lainnya" value={`${data.fasilitas_lainnya} — ${data.fasilitas_lainnya_keterangan || ""}`} />}
          </CardContent>
        </Card>

        {/* Ketentuan & Catatan */}
        {(data.ketentuan_1 || data.ketentuan_2 || data.ketentuan_3) && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Ketentuan Pengelola / Landlord</CardTitle></CardHeader>
            <CardContent className="space-y-0">
              {[1,2,3,4,5].map(n => <InfoRow key={n} label={`Ketentuan ${n}`} value={(data as any)[`ketentuan_${n}`]} />)}
            </CardContent>
          </Card>
        )}
        {(data.catatan_design_1 || data.catatan_design_2) && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Catatan Design</CardTitle></CardHeader>
            <CardContent className="space-y-0">
              {[1,2,3,4,5].map(n => <InfoRow key={n} label={`Catatan ${n}`} value={(data as any)[`catatan_design_${n}`]} />)}
            </CardContent>
          </Card>
        )}

        {/* Links */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Dokumen & File</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            <InfoRow label="RAB Sipil + Foto" value={data.link_gambar_rab_sipil} link />
            <InfoRow label="RAB ME" value={data.link_gambar_rab_me} link />
            <InfoRow label="FPD" value={data.link_fpd} link />
            <InfoRow label="Desain 3D" value={data.link_desain_3d} link />
            <InfoRow label="RAB" value={data.link_rab} link />
            <InfoRow label="Gambar Kerja" value={data.link_gambar_kerja} link />
            <InfoRow label="FPD Approved" value={data.link_fpd_approved} link />
          </CardContent>
        </Card>

        {/* ACTION PANELS */}
        {/* BM Approval */}
        {data.status === "WAITING_BM_APPROVAL" && (isBM || isBBMM) && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-amber-800">Approval B&M Manager</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={() => handleApprove("bm")} disabled={actionLoading} className="bg-green-600 hover:bg-green-700 text-white gap-1 flex-1">
                <CheckCircle2 className="w-4 h-4" /> Setujui
              </Button>
              <Button variant="outline" onClick={() => { setPendingAction("bm"); setShowRejectDialog(true); }} disabled={actionLoading}
                className="border-red-300 text-red-600 hover:bg-red-50 gap-1 flex-1">
                <XCircle className="w-4 h-4" /> Tolak
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PP Approval 1 */}
        {data.status === "WAITING_PP_APPROVAL_1" && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-blue-800">Approval PP Specialist (Tahap 1)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="need3d" checked={need3d} onChange={e => setNeed3d(e.target.checked)} className="rounded" />
                <label htmlFor="need3d" className="text-sm">Butuh Desain 3D</label>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleApprove("pp1")} disabled={actionLoading} className="bg-green-600 hover:bg-green-700 text-white gap-1 flex-1">
                  <CheckCircle2 className="w-4 h-4" /> Setujui
                </Button>
                <Button variant="outline" onClick={() => { setPendingAction("pp1"); setShowRejectDialog(true); }} disabled={actionLoading}
                  className="border-red-300 text-red-600 hover:bg-red-50 gap-1 flex-1">
                  <XCircle className="w-4 h-4" /> Tolak
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload 3D */}
        {data.status === "PP_DESIGN_3D_REQUIRED" && (
          <Card className="border-purple-200 bg-purple-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-purple-800">Upload Desain 3D</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input value={link3d} onChange={e => setLink3d(e.target.value)} placeholder="Link desain 3D..." />
              <Button onClick={handleUpload3d} disabled={actionLoading || !link3d.trim()} className="bg-purple-600 hover:bg-purple-700 text-white gap-1 w-full">
                <Send className="w-4 h-4" /> Upload Desain 3D
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upload RAB */}
        {data.status === "WAITING_RAB_UPLOAD" && isCoor && (
          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-orange-800">Upload RAB & Gambar Kerja</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input value={linkRab} onChange={e => setLinkRab(e.target.value)} placeholder="Link RAB..." />
              <Input value={linkGambar} onChange={e => setLinkGambar(e.target.value)} placeholder="Link Gambar Kerja..." />
              <Button onClick={handleUploadRab} disabled={actionLoading || (!linkRab.trim() && !linkGambar.trim())} className="bg-orange-600 hover:bg-orange-700 text-white gap-1 w-full">
                <Send className="w-4 h-4" /> Upload
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PP Manager */}
        {data.status === "WAITING_PP_MANAGER_APPROVAL" && (
          <Card className="border-indigo-200 bg-indigo-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-indigo-800">Approval PP Manager</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={() => handleApprove("pp_mgr")} disabled={actionLoading} className="bg-green-600 hover:bg-green-700 text-white gap-1 flex-1">
                <CheckCircle2 className="w-4 h-4" /> Setujui
              </Button>
              <Button variant="outline" onClick={() => { setPendingAction("pp_mgr"); setShowRejectDialog(true); }} disabled={actionLoading}
                className="border-red-300 text-red-600 hover:bg-red-50 gap-1 flex-1">
                <XCircle className="w-4 h-4" /> Tolak
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PP Final */}
        {data.status === "WAITING_PP_APPROVAL_2" && (
          <Card className="border-cyan-200 bg-cyan-50/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-cyan-800">Approval PP Specialist (Final)</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={() => handleApprove("pp2")} disabled={actionLoading} className="bg-green-600 hover:bg-green-700 text-white gap-1 flex-1">
                <CheckCircle2 className="w-4 h-4" /> Setujui (Selesai)
              </Button>
              <Button variant="outline" onClick={() => { setPendingAction("pp2"); setShowRejectDialog(true); }} disabled={actionLoading}
                className="border-red-300 text-red-600 hover:bg-red-50 gap-1 flex-1">
                <XCircle className="w-4 h-4" /> Tolak
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Approval History */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><History className="w-4 h-4 text-slate-600" /> Riwayat Approval</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            <InfoRow label="BM Manager" value={data.bm_approver_email ? `${data.bm_approver_email} — ${fmt(data.bm_waktu_persetujuan)}` : null} />
            <InfoRow label="PP Specialist (1)" value={data.pp1_approver_email ? `${data.pp1_approver_email} — ${fmt(data.pp1_waktu_persetujuan)}` : null} />
            <InfoRow label="PP Manager" value={data.pp_manager_approver_email ? `${data.pp_manager_approver_email} — ${fmt(data.pp_manager_waktu_persetujuan)}` : null} />
            <InfoRow label="PP Specialist (2)" value={data.pp2_approver_email ? `${data.pp2_approver_email} — ${fmt(data.pp2_waktu_persetujuan)}` : null} />
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
