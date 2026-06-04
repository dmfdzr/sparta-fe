"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import AppNavbar from "@/components/AppNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSession } from "@/context/SessionContext";
import {
    fetchActivityLogs,
    fetchGanttDetail,
    fetchGanttList,
    fetchProjekPlanningDetail,
    fetchProjekPlanningList,
    fetchProjekPlanningLogs,
    fetchRABDetail,
    fetchRABList,
    fetchSPKDetail,
    fetchSPKList,
    interveneGanttStatus,
    interveneProjekPlanningStatus,
    interveneSPKStatus,
    updateRABStatus,
    type ActivityLog,
    type GanttDetailData,
    type GanttListItem,
    type ProjectPlanningInterventionPayload,
    type ProjekPlanningItem,
    type ProjekPlanningLog,
    type RABListItem,
    type SPKApprovalLog,
    type SPKListItem,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    Clock3,
    FileSignature,
    FileText,
    GitBranch,
    History,
    Loader2,
    MapPinned,
    RefreshCw,
    Search,
    ShieldAlert,
    SlidersHorizontal,
    Store,
    UserRound,
    XCircle,
} from "lucide-react";

type InterventionDocType = "RAB" | "SPK" | "PROJECT_PLANNING" | "GANTT";
type StatusCategory = "ALL" | "PENDING" | "APPROVED" | "REJECTED";
type SpkTargetStatus = "WAITING_FOR_BM_APPROVAL" | "SPK_APPROVED" | "SPK_REJECTED";
type GanttTargetStatus = "active" | "terkunci";

type StatusOption = {
    value: string;
    label: string;
    description: string;
    tone: "danger" | "warning" | "success";
};

type InterventionLog = {
    id: string;
    actor: string;
    action: string;
    reason?: string | null;
    statusBefore?: string | null;
    statusAfter?: string | null;
    createdAt?: string | null;
};

type InterventionDocument = {
    id: number;
    type: InterventionDocType;
    id_toko?: number | null;
    nomor_ulok?: string | null;
    kode_toko?: string | null;
    nama_toko?: string | null;
    cabang?: string | null;
    nama_pt?: string | null;
    contractor?: string | null;
    project?: string | null;
    status: string;
    total?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
    email_pembuat?: string | null;
    logs?: InterventionLog[];
    raw: RABListItem | SPKListItem | ProjekPlanningItem | GanttListItem | GanttDetailData | Record<string, unknown>;
};

type InterventionAdapter = {
    type: InterventionDocType;
    label: string;
    accentClass: string;
    icon: React.ReactNode;
    fetchList: () => Promise<InterventionDocument[]>;
    fetchDetail: (doc: InterventionDocument) => Promise<InterventionDocument>;
    getStatusOptions: (doc: InterventionDocument) => StatusOption[];
    submit: (doc: InterventionDocument, targetStatus: string, reason: string, user: { email: string; role: string }) => Promise<void>;
};

const RAB_STATUS_OPTIONS: StatusOption[] = [
    {
        value: "Menunggu Gantt Chart",
        label: "Menunggu Gantt Chart",
        description: "Kembalikan RAB ke tahap sebelum approval, menunggu Gantt dibuat.",
        tone: "warning",
    },
    {
        value: "Ditolak oleh Koordinator",
        label: "Ditolak oleh Koordinator",
        description: "Tandai RAB perlu revisi dari level koordinator.",
        tone: "danger",
    },
    {
        value: "Ditolak oleh Manajer",
        label: "Ditolak oleh Manajer",
        description: "Tandai RAB perlu revisi dari level manajer.",
        tone: "danger",
    },
    {
        value: "Ditolak oleh Direktur Kontraktor",
        label: "Ditolak oleh Direktur Kontraktor",
        description: "Tandai RAB perlu revisi dari level direktur kontraktor.",
        tone: "danger",
    },
    {
        value: "Ditolak oleh Direktur",
        label: "Ditolak oleh Direktur (legacy)",
        description: "Status lama untuk kompatibilitas data historis.",
        tone: "danger",
    },
];

const SPK_STATUS_OPTIONS: StatusOption[] = [
    {
        value: "SPK_REJECTED",
        label: "Ditolak untuk Revisi",
        description: "Kembalikan SPK ke pembuat agar bisa diperbaiki.",
        tone: "danger",
    },
    {
        value: "WAITING_FOR_BM_APPROVAL",
        label: "Menunggu Approval BM",
        description: "Buka kembali SPK ke antrean Branch Manager.",
        tone: "warning",
    },
    {
        value: "SPK_APPROVED",
        label: "Disetujui",
        description: "Tandai SPK sebagai sudah disetujui.",
        tone: "success",
    },
];

const PROJECT_PLANNING_STATUS_OPTIONS: StatusOption[] = [
    {
        value: "DRAFT",
        label: "Draft",
        description: "Kembalikan FPD ke pembuat agar dapat diajukan ulang.",
        tone: "warning",
    },
    {
        value: "WAITING_BM_APPROVAL",
        label: "Menunggu BM",
        description: "Arahkan kembali ke approval B&M Manager tahap awal.",
        tone: "warning",
    },
    {
        value: "WAITING_PP_APPROVAL_1",
        label: "Menunggu PP 1",
        description: "Arahkan ke approval PP Specialist tahap desain.",
        tone: "warning",
    },
    {
        value: "PP_DESIGN_3D_REQUIRED",
        label: "Butuh Desain 3D",
        description: "Tandai perlu upload desain 3D dari PP Specialist.",
        tone: "warning",
    },
    {
        value: "WAITING_RAB_UPLOAD",
        label: "Menunggu Upload RAB",
        description: "Buka tahap upload RAB dan gambar kerja dari cabang.",
        tone: "warning",
    },
    {
        value: "WAITING_BM_APPROVAL_2",
        label: "Menunggu BM 2",
        description: "Arahkan ke approval B&M Manager tahap final dokumen.",
        tone: "warning",
    },
    {
        value: "WAITING_PP_MANAGER_APPROVAL",
        label: "Menunggu PP Manager",
        description: "Arahkan ke approval final PP Manager.",
        tone: "warning",
    },
    {
        value: "WAITING_PP_APPROVAL_2",
        label: "Menunggu PP 2",
        description: "Arahkan ke review final PP Specialist setelah RAB.",
        tone: "warning",
    },
    {
        value: "COMPLETED",
        label: "Selesai",
        description: "Tandai Project Planning selesai.",
        tone: "success",
    },
    {
        value: "REJECTED",
        label: "Ditolak",
        description: "Tandai Project Planning ditolak untuk revisi.",
        tone: "danger",
    },
];

const GANTT_STATUS_OPTIONS: StatusOption[] = [
    {
        value: "active",
        label: "Aktif",
        description: "Buka kembali Gantt agar masih dapat diperbarui.",
        tone: "warning",
    },
    {
        value: "terkunci",
        label: "Terkunci",
        description: "Kunci Gantt dan lepaskan antrean RAB yang menunggu Gantt.",
        tone: "success",
    },
];

const TYPE_FILTERS: Array<{ value: InterventionDocType | "ALL"; label: string }> = [
    { value: "ALL", label: "Semua Tipe" },
    { value: "RAB", label: "RAB" },
    { value: "SPK", label: "SPK" },
    { value: "PROJECT_PLANNING", label: "Project Planning" },
    { value: "GANTT", label: "Gantt" },
];

const STATUS_FILTERS: Array<{ value: StatusCategory; label: string }> = [
    { value: "ALL", label: "Semua Status" },
    { value: "PENDING", label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
];

const parseMoney = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const normalized = String(value).replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

const getStatusLabel = (status: string) => {
    const upper = status.toUpperCase();
    if (upper === "SPK_APPROVED") return "SPK Approved";
    if (upper === "SPK_REJECTED") return "SPK Rejected";
    if (upper === "WAITING_FOR_BM_APPROVAL") return "Pending BM";
    if (upper === "ACTIVE") return "Aktif";
    if (upper === "TERKUNCI") return "Terkunci";
    if (upper === "DRAFT") return "Draft";
    if (upper === "COMPLETED") return "Selesai";
    if (upper === "REJECTED") return "Rejected";
    if (upper.startsWith("WAITING_")) return upper.replaceAll("_", " ");
    if (upper === "PP_DESIGN_3D_REQUIRED") return "Butuh Desain 3D";
    if (upper.includes("DISETUJUI") || upper === "APPROVED") return "Approved";
    if (upper.includes("TOLAK") || upper.includes("REJECTED")) return "Rejected";
    if (upper.includes("MENUNGGU") || upper.includes("PENDING") || upper.includes("WAITING")) return "Pending";
    return status;
};

const getStatusBadgeClass = (status: string) => {
    const upper = status.toUpperCase();
    if (upper.includes("TOLAK") || upper.includes("REJECTED")) {
        return "border-red-200 bg-red-50 text-red-700";
    }
    if (upper.includes("DISETUJUI") || upper.includes("APPROVED") || upper === "COMPLETED" || upper === "TERKUNCI") {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (upper.includes("MENUNGGU") || upper.includes("PENDING") || upper.includes("WAITING") || upper === "DRAFT" || upper === "ACTIVE" || upper === "PP_DESIGN_3D_REQUIRED") {
        return "border-amber-200 bg-amber-50 text-amber-700";
    }
    return "border-slate-200 bg-slate-100 text-slate-700";
};

const getStatusCategory = (status: string): Exclude<StatusCategory, "ALL"> => {
    const upper = status.toUpperCase();
    if (upper.includes("TOLAK") || upper.includes("REJECTED")) return "REJECTED";
    if (upper.includes("DISETUJUI") || upper.includes("APPROVED") || upper === "COMPLETED" || upper === "TERKUNCI") return "APPROVED";
    return "PENDING";
};

const optionToneClass = (tone: StatusOption["tone"], selected: boolean) => {
    if (tone === "success") return selected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-emerald-200";
    if (tone === "warning") return selected ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:border-amber-200";
    return selected ? "border-red-400 bg-red-50" : "border-slate-200 hover:border-red-200";
};

const normalizeRab = (rab: RABListItem): InterventionDocument => ({
    id: rab.id,
    type: "RAB",
    id_toko: rab.id_toko,
    nomor_ulok: rab.nomor_ulok || rab.toko?.nomor_ulok,
    nama_toko: rab.nama_toko || rab.toko?.nama_toko,
    cabang: rab.cabang || rab.toko?.cabang,
    nama_pt: rab.nama_pt,
    project: rab.proyek || rab.toko?.proyek,
    status: rab.status,
    total: parseMoney(rab.grand_total_final || rab.grand_total),
    created_at: rab.created_at,
    email_pembuat: rab.email_pembuat,
    raw: rab,
});

const normalizeSpk = (spk: SPKListItem): InterventionDocument => ({
    id: spk.id,
    type: "SPK",
    id_toko: spk.id_toko || spk.toko?.id,
    nomor_ulok: spk.nomor_ulok || spk.toko?.nomor_ulok,
    kode_toko: spk.kode_toko || spk.toko?.kode_toko,
    nama_toko: spk.toko?.nama_toko,
    cabang: spk.toko?.cabang,
    contractor: spk.nama_kontraktor,
    project: spk.proyek,
    status: spk.status,
    total: parseMoney(spk.grand_total),
    created_at: spk.created_at,
    updated_at: spk.waktu_persetujuan,
    email_pembuat: spk.email_pembuat,
    raw: spk,
});

const normalizeProjectPlanning = (projek: ProjekPlanningItem): InterventionDocument => ({
    id: projek.id,
    type: "PROJECT_PLANNING",
    id_toko: projek.id_toko,
    nomor_ulok: projek.nomor_ulok,
    kode_toko: projek.kode_toko,
    nama_toko: projek.nama_toko || projek.nama_lokasi,
    cabang: projek.cabang,
    project: projek.jenis_proyek || projek.proyek || projek.jenis_pengajuan,
    status: projek.status,
    total: parseMoney(projek.estimasi_biaya),
    created_at: projek.created_at,
    updated_at: projek.updated_at,
    email_pembuat: projek.email_pembuat,
    raw: projek,
});

const normalizeGantt = (gantt: GanttListItem): InterventionDocument => ({
    id: gantt.id,
    type: "GANTT",
    id_toko: gantt.id_toko,
    nomor_ulok: gantt.nomor_ulok,
    nama_toko: gantt.nama_toko,
    cabang: gantt.cabang,
    project: gantt.proyek || gantt.lingkup_pekerjaan,
    status: gantt.status,
    created_at: gantt.timestamp,
    email_pembuat: gantt.email_pembuat,
    raw: gantt,
});

const mapActivityLogs = (logs: ActivityLog[]): InterventionLog[] =>
    logs.map((log) => ({
        id: `activity-${log.id}`,
        actor: log.actor_email || log.actor_role || "-",
        action: log.action,
        reason: log.reason,
        statusBefore: log.status_before,
        statusAfter: log.status_after,
        createdAt: log.created_at,
    }));

const mapSpkLogs = (logs: SPKApprovalLog[]): InterventionLog[] =>
    logs.map((log) => ({
        id: `spk-${log.id}`,
        actor: log.approver_email,
        action: log.tindakan,
        reason: log.alasan_penolakan,
        createdAt: log.waktu_tindakan,
    }));

const mapProjectPlanningLogs = (logs: ProjekPlanningLog[]): InterventionLog[] =>
    logs.map((log) => ({
        id: `pp-${log.id}`,
        actor: log.actor_email || log.role || "-",
        action: log.aksi,
        reason: log.alasan_penolakan || log.keterangan,
        statusBefore: log.status_sebelum,
        statusAfter: log.status_sesudah,
        createdAt: log.created_at,
    }));

const interventionAdapters: Record<InterventionDocType, InterventionAdapter> = {
    RAB: {
        type: "RAB",
        label: "RAB",
        accentClass: "border-blue-200 bg-blue-50 text-blue-700",
        icon: <FileText className="h-4 w-4" />,
        fetchList: async () => {
            const response = await fetchRABList();
            return (response.data || []).map(normalizeRab);
        },
        fetchDetail: async (doc) => {
            const [detail, logs] = await Promise.all([
                fetchRABDetail(doc.id).catch(() => null),
                fetchActivityLogs("RAB", doc.id).then((res) => res.data).catch(() => []),
            ]);
            if (!detail?.data) return { ...doc, logs: mapActivityLogs(logs) };

            const rab = detail.data.rab;
            const toko = detail.data.toko;
            return {
                ...doc,
                id_toko: rab.id_toko || doc.id_toko,
                nomor_ulok: toko.nomor_ulok || doc.nomor_ulok,
                kode_toko: toko.kode_toko,
                nama_toko: toko.nama_toko || doc.nama_toko,
                cabang: toko.cabang || doc.cabang,
                contractor: toko.nama_kontraktor,
                project: toko.proyek || doc.project,
                status: rab.status || doc.status,
                total: parseMoney(rab.grand_total_final || rab.grand_total || doc.total),
                created_at: rab.created_at || doc.created_at,
                logs: mapActivityLogs(logs),
                raw: detail.data.rab,
            };
        },
        getStatusOptions: () => RAB_STATUS_OPTIONS,
        submit: async (doc, targetStatus, reason, user) => {
            if (!doc.id_toko) throw new Error("ID toko RAB tidak tersedia.");
            await updateRABStatus({
                id_toko: doc.id_toko,
                id_rab: doc.id,
                status: targetStatus,
                actor_email: user.email,
                actor_role: user.role,
                alasan_intervensi: reason,
            });
        },
    },
    SPK: {
        type: "SPK",
        label: "SPK",
        accentClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
        icon: <FileSignature className="h-4 w-4" />,
        fetchList: async () => {
            const response = await fetchSPKList();
            return (response.data || []).map(normalizeSpk);
        },
        fetchDetail: async (doc) => {
            const detail = await fetchSPKDetail(doc.id).catch(() => null);
            if (!detail?.data) return doc;
            return {
                ...normalizeSpk(detail.data.pengajuan),
                logs: mapSpkLogs(detail.data.approvalLogs || []),
            };
        },
        getStatusOptions: () => SPK_STATUS_OPTIONS,
        submit: async (doc, targetStatus, reason, user) => {
            await interveneSPKStatus(doc.id, {
                actor_email: user.email,
                actor_role: user.role,
                target_status: targetStatus as SpkTargetStatus,
                alasan_intervensi: reason,
            });
        },
    },
    PROJECT_PLANNING: {
        type: "PROJECT_PLANNING",
        label: "Project Planning",
        accentClass: "border-cyan-200 bg-cyan-50 text-cyan-700",
        icon: <MapPinned className="h-4 w-4" />,
        fetchList: async () => {
            const response = await fetchProjekPlanningList();
            return (response.data || []).map(normalizeProjectPlanning);
        },
        fetchDetail: async (doc) => {
            const [detail, logs] = await Promise.all([
                fetchProjekPlanningDetail(doc.id).catch(() => null),
                fetchProjekPlanningLogs(doc.id).then((res) => res.data).catch(() => []),
            ]);
            if (!detail?.data) return { ...doc, logs: mapProjectPlanningLogs(logs) };
            return {
                ...normalizeProjectPlanning(detail.data.projek),
                logs: mapProjectPlanningLogs(detail.data.logs || logs),
            };
        },
        getStatusOptions: () => PROJECT_PLANNING_STATUS_OPTIONS,
        submit: async (doc, targetStatus, reason, user) => {
            await interveneProjekPlanningStatus(doc.id, {
                actor_email: user.email,
                actor_role: user.role,
                target_status: targetStatus as ProjectPlanningInterventionPayload["target_status"],
                alasan_intervensi: reason,
            });
        },
    },
    GANTT: {
        type: "GANTT",
        label: "Gantt",
        accentClass: "border-teal-200 bg-teal-50 text-teal-700",
        icon: <GitBranch className="h-4 w-4" />,
        fetchList: async () => {
            const response = await fetchGanttList();
            return (response.data || []).map(normalizeGantt);
        },
        fetchDetail: async (doc) => {
            const [detail, logs] = await Promise.all([
                fetchGanttDetail(doc.id).catch(() => null),
                fetchActivityLogs("GANTT", doc.id).then((res) => res.data).catch(() => []),
            ]);
            if (!detail?.data) return { ...doc, logs: mapActivityLogs(logs) };
            return {
                ...doc,
                id_toko: detail.data.gantt.id_toko,
                nomor_ulok: detail.data.toko.nomor_ulok || doc.nomor_ulok,
                kode_toko: detail.data.toko.kode_toko,
                nama_toko: detail.data.toko.nama_toko || doc.nama_toko,
                cabang: detail.data.toko.cabang || doc.cabang,
                contractor: detail.data.toko.nama_kontraktor,
                project: detail.data.toko.proyek || doc.project,
                status: detail.data.gantt.status || doc.status,
                created_at: detail.data.gantt.timestamp || doc.created_at,
                email_pembuat: detail.data.gantt.email_pembuat || doc.email_pembuat,
                logs: mapActivityLogs(logs),
                raw: detail.data,
            };
        },
        getStatusOptions: () => GANTT_STATUS_OPTIONS,
        submit: async (doc, targetStatus, reason, user) => {
            await interveneGanttStatus(doc.id, {
                actor_email: user.email,
                actor_role: user.role,
                target_status: targetStatus as GanttTargetStatus,
                alasan_intervensi: reason,
            });
        },
    },
};

export default function IntervensiPage() {
    const { user, isLoading, logout } = useSession();
    const [documents, setDocuments] = useState<InterventionDocument[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedDetail, setSelectedDetail] = useState<InterventionDocument | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [typeFilter, setTypeFilter] = useState<InterventionDocType | "ALL">("ALL");
    const [statusFilter, setStatusFilter] = useState<StatusCategory>("ALL");
    const [branchFilter, setBranchFilter] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [targetStatus, setTargetStatus] = useState("");
    const [reason, setReason] = useState("");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const showToast = useCallback((message: string, type: "success" | "error") => {
        setToast({ message, type });
        window.setTimeout(() => setToast(null), 3500);
    }, []);

    const isSuperHuman = !!user?.isSuperHuman;
    const canSubmit = isSuperHuman && !!user && !isSubmitting;

    const loadDocuments = useCallback(async () => {
        if (!isSuperHuman) return;
        setIsFetching(true);
        try {
            const results = await Promise.all(Object.values(interventionAdapters).map((adapter) => adapter.fetchList()));
            const merged = results.flat().sort((a, b) => {
                const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
                const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
                return bTime - aTime;
            });
            setDocuments(merged);
            setSelectedId((current) => current ?? (merged[0] ? `${merged[0].type}-${merged[0].id}` : null));
        } catch (error: unknown) {
            showToast(getErrorMessage(error, "Gagal memuat daftar intervensi."), "error");
        } finally {
            setIsFetching(false);
        }
    }, [isSuperHuman, showToast]);

    useEffect(() => {
        if (!isLoading && isSuperHuman) {
            loadDocuments();
        }
    }, [isLoading, isSuperHuman, loadDocuments]);

    const selectedDoc = useMemo(() => {
        if (!selectedId) return null;
        return documents.find((doc) => `${doc.type}-${doc.id}` === selectedId) ?? null;
    }, [documents, selectedId]);

    useEffect(() => {
        if (!selectedDoc) {
            setSelectedDetail(null);
            return;
        }
        let cancelled = false;
        const loadDetail = async () => {
            setIsDetailLoading(true);
            setTargetStatus("");
            setReason("");
            try {
                const detail = await interventionAdapters[selectedDoc.type].fetchDetail(selectedDoc);
                if (!cancelled) setSelectedDetail(detail);
            } catch (error: unknown) {
                if (!cancelled) {
                    setSelectedDetail(selectedDoc);
                    showToast(getErrorMessage(error, "Gagal memuat detail dokumen."), "error");
                }
            } finally {
                if (!cancelled) setIsDetailLoading(false);
            }
        };
        loadDetail();
        return () => {
            cancelled = true;
        };
    }, [selectedDoc, showToast]);

    const branches = useMemo(() => {
        const values = new Set<string>();
        documents.forEach((doc) => {
            if (doc.cabang) values.add(doc.cabang);
        });
        return Array.from(values).sort((a, b) => a.localeCompare(b));
    }, [documents]);

    const filteredDocuments = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return documents.filter((doc) => {
            if (typeFilter !== "ALL" && doc.type !== typeFilter) return false;
            if (statusFilter !== "ALL" && getStatusCategory(doc.status) !== statusFilter) return false;
            if (branchFilter !== "ALL" && (doc.cabang || "-").toUpperCase() !== branchFilter.toUpperCase()) return false;
            if (!query) return true;
            return [
                doc.nomor_ulok,
                doc.kode_toko,
                doc.nama_toko,
                doc.cabang,
                doc.nama_pt,
                doc.contractor,
                doc.project,
                doc.status,
            ].some((value) => String(value || "").toLowerCase().includes(query));
        });
    }, [branchFilter, documents, searchQuery, statusFilter, typeFilter]);

    const activeDoc = selectedDetail ?? selectedDoc;
    const activeAdapter = activeDoc ? interventionAdapters[activeDoc.type] : null;
    const statusOptions = activeDoc && activeAdapter ? activeAdapter.getStatusOptions(activeDoc) : [];
    const selectedOption = statusOptions.find((option) => option.value === targetStatus);
    const trimmedReason = reason.trim();
    const reasonIsValid = trimmedReason.length >= 5;
    const targetIsValid = !!targetStatus && targetStatus !== activeDoc?.status;
    const submitDisabled = !canSubmit || !activeDoc || !targetIsValid || !reasonIsValid;

    const submitIntervention = async () => {
        if (!activeDoc || !activeAdapter || !user || submitDisabled) return;
        setIsSubmitting(true);
        try {
            await activeAdapter.submit(activeDoc, targetStatus, trimmedReason, {
                email: user.email,
                role: user.role,
            });
            showToast(`Intervensi ${activeDoc.type} berhasil diproses.`, "success");
            setConfirmOpen(false);
            setReason("");
            setTargetStatus("");
            await loadDocuments();
            const refreshed = await activeAdapter.fetchDetail({ ...activeDoc, status: targetStatus });
            setSelectedDetail(refreshed);
        } catch (error: unknown) {
            showToast(getErrorMessage(error, "Gagal memproses intervensi."), "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-100">
                <AppNavbar title="INTERVENSI" showBackButton backHref="/dashboard" showLogout onLogout={logout} />
                <main className="flex min-h-[70vh] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-red-600" />
                </main>
            </div>
        );
    }

    if (!isSuperHuman) {
        return (
            <div className="min-h-screen bg-slate-100">
                <AppNavbar title="INTERVENSI" showBackButton backHref="/dashboard" showLogout onLogout={logout} />
                <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-6">
                    <Card className="w-full rounded-2xl border-red-100 bg-white shadow-sm">
                        <CardContent className="p-8 text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                                <ShieldAlert className="h-7 w-7" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-900">Akses khusus Super Human</h1>
                            <p className="mt-2 text-sm text-slate-500">
                                Halaman ini berisi tindakan perubahan status sensitif dan hanya tersedia untuk akun Super Human.
                            </p>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900">
            <AppNavbar title="INTERVENSI" showBackButton backHref="/dashboard" showLogout onLogout={logout} />

            <main className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-6 lg:px-8">
                <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-700">
                                <ShieldAlert className="h-3.5 w-3.5" />
                                Super Human Workspace
                            </div>
                            <h1 className="text-2xl font-extrabold tracking-normal text-slate-950 md:text-3xl">
                                Pusat Intervensi Dokumen
                            </h1>
                            <p className="mt-1 max-w-3xl text-sm text-slate-500">
                                Satu tempat untuk intervensi RAB dan SPK yang sudah didukung sistem. Modul lain bisa ditambahkan lewat adapter saat endpoint-nya tersedia.
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
                            <Metric label="Dokumen" value={documents.length} />
                            <Metric label="Pending" value={documents.filter((doc) => getStatusCategory(doc.status) === "PENDING").length} />
                            <Metric label="Tipe Aktif" value={Object.keys(interventionAdapters).length} />
                        </div>
                    </div>
                </section>

                <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_160px_180px_180px_auto]">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Cari ULOK, toko, cabang, kontraktor..."
                                className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9"
                            />
                        </div>
                        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as InterventionDocType | "ALL")}>
                            <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white">
                                <SelectValue placeholder="Tipe" />
                            </SelectTrigger>
                            <SelectContent>
                                {TYPE_FILTERS.map((filter) => (
                                    <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusCategory)}>
                            <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_FILTERS.map((filter) => (
                                    <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={branchFilter} onValueChange={setBranchFilter}>
                            <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white">
                                <SelectValue placeholder="Cabang" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Semua Cabang</SelectItem>
                                {branches.map((branch) => (
                                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-xl border-slate-200 bg-white"
                            onClick={loadDocuments}
                            disabled={isFetching}
                        >
                            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refresh
                        </Button>
                    </div>
                </section>

                <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_430px]">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                                {filteredDocuments.length} dokumen
                            </div>
                            {isFetching && <span className="text-xs font-medium text-slate-400">Memuat ulang...</span>}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[780px] text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-bold">Dokumen</th>
                                        <th className="px-4 py-3 text-left font-bold">Toko</th>
                                        <th className="px-4 py-3 text-left font-bold">Cabang</th>
                                        <th className="px-4 py-3 text-left font-bold">PT / Kontraktor</th>
                                        <th className="px-4 py-3 text-left font-bold">Status</th>
                                        <th className="px-4 py-3 text-right font-bold">Nilai</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredDocuments.map((doc) => {
                                        const adapter = interventionAdapters[doc.type];
                                        const active = selectedId === `${doc.type}-${doc.id}`;
                                        return (
                                            <tr
                                                key={`${doc.type}-${doc.id}`}
                                                className={`cursor-pointer transition ${active ? "bg-red-50/70" : "hover:bg-slate-50"}`}
                                                onClick={() => setSelectedId(`${doc.type}-${doc.id}`)}
                                            >
                                                <td className="px-4 py-3">
                                                    <Badge className={`${adapter.accentClass} border font-bold`}>
                                                        <span className="mr-1">{adapter.icon}</span>
                                                        {adapter.label}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-800">{doc.nama_toko || "-"}</div>
                                                    <div className="text-xs text-slate-400">ULOK {doc.nomor_ulok || "-"}</div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">{doc.cabang || "-"}</td>
                                                <td className="px-4 py-3">
                                                    <div className="max-w-[220px] truncate font-medium text-slate-700">
                                                        {doc.nama_pt || doc.contractor || "-"}
                                                    </div>
                                                    <div className="max-w-[220px] truncate text-xs text-slate-400">{doc.project || "-"}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge className={`${getStatusBadgeClass(doc.status)} border font-semibold`}>
                                                        {getStatusLabel(doc.status)}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-700">
                                                    {doc.total ? formatRupiah(doc.total) : "-"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredDocuments.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                                                Tidak ada dokumen yang cocok dengan filter.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <aside className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            {!activeDoc ? (
                                <div className="py-16 text-center text-sm text-slate-400">Pilih dokumen untuk intervensi.</div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <Badge className={`${activeAdapter?.accentClass} mb-3 border font-bold`}>
                                                {activeAdapter?.icon}
                                                <span className="ml-1">{activeAdapter?.label}</span>
                                            </Badge>
                                            <h2 className="text-lg font-extrabold text-slate-950">{activeDoc.nama_toko || "-"}</h2>
                                            <p className="text-sm text-slate-500">ULOK {activeDoc.nomor_ulok || "-"} - {activeDoc.cabang || "-"}</p>
                                        </div>
                                        {isDetailLoading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <InfoTile icon={<Store className="h-4 w-4" />} label="Project" value={activeDoc.project || "-"} />
                                        <InfoTile icon={<UserRound className="h-4 w-4" />} label="Pembuat" value={activeDoc.email_pembuat || "-"} />
                                        <InfoTile icon={<Clock3 className="h-4 w-4" />} label="Dibuat" value={formatDate(activeDoc.created_at)} />
                                        <InfoTile icon={<History className="h-4 w-4" />} label="Log" value={`${activeDoc.logs?.length || 0} catatan`} />
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="mb-2 text-xs font-bold uppercase text-slate-500">Status saat ini</p>
                                        <Badge className={`${getStatusBadgeClass(activeDoc.status)} border px-3 py-1 text-sm font-bold`}>
                                            {activeDoc.status}
                                        </Badge>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <Label className="mb-2 block text-xs font-bold uppercase text-slate-500">Target Status</Label>
                                            <div className="space-y-2">
                                                {statusOptions.map((option) => {
                                                    const selected = targetStatus === option.value;
                                                    const sameAsCurrent = activeDoc.status === option.value;
                                                    return (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            disabled={sameAsCurrent || isSubmitting}
                                                            onClick={() => setTargetStatus(option.value)}
                                                            className={`w-full rounded-xl border-2 p-3 text-left transition ${optionToneClass(option.tone, selected)} ${sameAsCurrent ? "cursor-not-allowed opacity-50" : ""}`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-sm font-bold text-slate-800">{option.label}</span>
                                                                {selected && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                                                            </div>
                                                            <p className="mt-1 text-xs leading-relaxed text-slate-500">{option.description}</p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div>
                                            <Label className="mb-2 block text-xs font-bold uppercase text-slate-500">Alasan Intervensi</Label>
                                            <Textarea
                                                value={reason}
                                                onChange={(event) => setReason(event.target.value)}
                                                placeholder="Tuliskan alasan yang jelas untuk audit..."
                                                rows={4}
                                                className="resize-none rounded-xl border-slate-200 bg-white text-sm"
                                            />
                                            <p className={`mt-1 text-xs ${reasonIsValid || !reason ? "text-slate-400" : "text-red-500"}`}>
                                                Minimal 5 karakter. Alasan akan tersimpan di log backend.
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                                            <p className="mb-2 text-xs font-bold uppercase text-slate-500">Preview</p>
                                            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-700">
                                                <Badge className={`${getStatusBadgeClass(activeDoc.status)} border`}>{getStatusLabel(activeDoc.status)}</Badge>
                                                <ArrowRight className="h-4 w-4 text-slate-400" />
                                                <Badge className={`${targetStatus ? getStatusBadgeClass(targetStatus) : "border-slate-200 bg-slate-100 text-slate-500"} border`}>
                                                    {selectedOption?.label || "Pilih target"}
                                                </Badge>
                                            </div>
                                        </div>

                                        <Button
                                            type="button"
                                            className="h-11 w-full rounded-xl bg-red-600 font-bold text-white hover:bg-red-700"
                                            disabled={submitDisabled}
                                            onClick={() => setConfirmOpen(true)}
                                        >
                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                                            Proses Intervensi
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {activeDoc && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-800">
                                    <History className="h-4 w-4 text-slate-400" />
                                    Riwayat Terbaru
                                </h3>
                                <div className="space-y-2">
                                    {(activeDoc.logs || []).slice(0, 6).map((log) => (
                                        <div key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-bold text-slate-700">{log.action}</span>
                                                <span className="text-[11px] text-slate-400">{formatDate(log.createdAt)}</span>
                                            </div>
                                            <p className="mt-1 truncate text-xs text-slate-500">{log.actor}</p>
                                            {(log.statusBefore || log.statusAfter) && (
                                                <p className="mt-1 text-xs font-semibold text-slate-600">
                                                    {log.statusBefore || "-"} -&gt; {log.statusAfter || "-"}
                                                </p>
                                            )}
                                            {log.reason && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{log.reason}</p>}
                                        </div>
                                    ))}
                                    {(!activeDoc.logs || activeDoc.logs.length === 0) && (
                                        <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                                            Belum ada riwayat yang bisa ditampilkan.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </aside>
                </section>
            </main>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-red-50 text-red-600">
                            <AlertTriangle className="h-8 w-8" />
                        </AlertDialogMedia>
                        <AlertDialogTitle>Konfirmasi intervensi</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini akan mengubah status {activeDoc?.type} dan mencatat alasan intervensi pada audit backend.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                        <div className="font-bold text-slate-900">{activeDoc?.nama_toko || "-"}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge className={`${activeDoc ? getStatusBadgeClass(activeDoc.status) : ""} border`}>
                                {activeDoc ? getStatusLabel(activeDoc.status) : "-"}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <Badge className={`${targetStatus ? getStatusBadgeClass(targetStatus) : ""} border`}>
                                {selectedOption?.label || "-"}
                            </Badge>
                        </div>
                        <p className="mt-3 text-xs text-slate-500">{trimmedReason}</p>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 text-white hover:bg-red-700"
                            disabled={isSubmitting}
                            onClick={(event) => {
                                event.preventDefault();
                                submitIntervention();
                            }}
                        >
                            {isSubmitting ? "Memproses..." : "Ya, proses"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {toast && (
                <div className={`fixed right-5 top-5 z-[10000] flex max-w-md items-center gap-3 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-xl ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
                    {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                    {toast.message}
                </div>
            )}
        </div>
    );
}

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-lg font-extrabold text-slate-950">{value}</div>
            <div className="text-[11px] font-bold uppercase text-slate-400">{label}</div>
        </div>
    );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase text-slate-400">
                {icon}
                {label}
            </div>
            <div className="truncate text-sm font-bold text-slate-800">{value}</div>
        </div>
    );
}
