// =============================================================================
// lib/api.ts
// Seluruh fungsi komunikasi ke backend API.
//
// STRUKTUR FILE:
//   1.  GLOBAL  safeFetchJSON
//   2.  RAB     Types, CRUD, Download PDF, Approval
//   3.  GANTT   Types, Submit, List, Detail, Update, Lock, Delete,
//               Day Items, Keterlambatan, Kecepatan, Pengawasan
//   4.  SPK     Submit, Cek Status, Types, List, Detail, Approval
//   5.  TAMBAH SPK      Submit, Fetch Approved SPK, Types, List, Detail, Approva
//   6.  PIC PENGAWASAN  Submit, Fetch List, Fetch Detail, Update
//   7.  INSTRUKSI LAPANGAN  Submit, Fetch List
// =============================================================================

import { API_URL } from "./constants";

export type ApiErrorContext = {
    url?: string;
    status?: number;
    responseBody?: unknown;
    contentType?: string | null;
};

export type ApiErrorHandler = (error: Error, context?: ApiErrorContext) => void;
export type ApiRequestOptions = RequestInit & {
    suppressGlobalError?: boolean;
};

let apiErrorHandler: ApiErrorHandler | null = null;

export const setApiErrorHandler = (handler: ApiErrorHandler | null) => {
    apiErrorHandler = handler;
};

const reportApiError = (error: Error, context?: ApiErrorContext) => {
    if (apiErrorHandler) {
        apiErrorHandler(error, context);
    }
};

const buildApiErrorMessage = (data: any, fallback: string): string => {
    const baseMessage = data?.message || fallback;
    const issues = Array.isArray(data?.issues) ? data.issues : [];
    if (issues.length === 0) return baseMessage;

    const issueMessages = issues.slice(0, 3).map((issue: any) => {
        const path = Array.isArray(issue?.path) && issue.path.length > 0
            ? issue.path.join(".")
            : "payload";
        return `${path}: ${issue?.message || "nilai tidak valid"}`;
    });

    return `${baseMessage}: ${issueMessages.join("; ")}`;
};

// =============================================================================
// 1. GLOBAL  FETCH HELPER
// =============================================================================

/**
 * Wrapper fetch yang secara otomatis:
 * - Memvalidasi Content-Type respons (harus JSON)
 * - Melempar error yang informatif jika respons gagal
 * - Menghindari crash saat server mengembalikan HTML (misalnya halaman error nginx)
 */
export const safeFetchJSON = async (url: string, options?: ApiRequestOptions) => {
    const { suppressGlobalError, ...fetchOptions } = options ?? {};
    let reported = false;
    try {
        const res = await fetch(url, fetchOptions);
        const contentType = res.headers.get("content-type");

        if (contentType?.includes("application/json")) {
            const data = await res.json();
            if (!res.ok) {
                const err = new Error(buildApiErrorMessage(data, `Error Server (${res.status})`));
                if (!suppressGlobalError) {
                    reportApiError(err, { url, status: res.status, responseBody: data, contentType });
                }
                reported = true;
                throw err;
            }
            return data;
        }

        const text = await res.text();
        console.error("Server mengembalikan non-JSON:", text);
        const err = new Error(`Endpoint salah atau tidak ditemukan (Status ${res.status}).`);
        if (!suppressGlobalError) {
            reportApiError(err, { url, status: res.status, responseBody: text, contentType });
        }
        reported = true;
        throw err;
    } catch (error) {
        if (!reported && !suppressGlobalError) {
            const err = error instanceof Error ? error : new Error("Terjadi kesalahan pada API.");
            reportApiError(err, { url });
        }
        throw error;
    }
};

// =============================================================================
// DC DEVELOPMENT
// =============================================================================

export type DcProject = {
    id: number;
    project_code: string;
    project_name: string;
    location_name: string | null;
    branch_name: string | null;
    address: string | null;
    area_size: string | null;
    status: string;
    current_stage: string;
    created_by_email: string | null;
    created_by_role: string | null;
    created_at: string;
    updated_at: string;
};

export type DcArchiveProject = {
    id: number;
    project_id: number;
    archive_code: string;
    archive_name: string;
    branch_name: string;
    location_name: string | null;
    project_type: string;
    address: string | null;
    notes: string | null;
    created_by_email: string | null;
    created_by_role: string | null;
    created_at: string;
    updated_at: string;
    jumlah_dokumen: number;
    kategori_counts?: Record<string, number>;
};

export type CreateDcArchiveProjectPayload = {
    archive_code: string;
    archive_name: string;
    branch_name: string;
    location_name?: string;
    project_type: string;
    address?: string;
    notes?: string;
    actor_email: string;
    actor_role: string;
};

export type DcVendor = {
    id: number;
    company_name: string;
    npwp: string | null;
    address: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    status: string;
    service_types?: string[];
};

export type CreateDcVendorPayload = {
    company_name: string;
    npwp?: string;
    address?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    service_types?: string[];
    created_by_email?: string;
};

export type CreateDcProjectPayload = {
    project_code: string;
    project_name: string;
    location_name?: string;
    branch_name?: string;
    address?: string;
    area_size?: number;
    created_by_email?: string;
    created_by_role?: string;
};

export const fetchDcProjects = async (
    filters?: { status?: string; current_stage?: string; branch_name?: string; search?: string; actor_email?: string; actor_role?: string },
    options?: ApiRequestOptions
): Promise<{ status: string; data: DcProject[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.current_stage) params.append("current_stage", filters.current_stage);
    if (filters?.branch_name) params.append("branch_name", filters.branch_name);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.actor_email) params.append("actor_email", filters.actor_email);
    if (filters?.actor_role) params.append("actor_role", filters.actor_role);
    return safeFetchJSON(`${base}/api/dc-development/projects${params.toString() ? `?${params}` : ""}`, options);
};

export const createDcProject = async (payload: CreateDcProjectPayload): Promise<{ status: string; data: DcProject }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export const fetchDcArchiveProjects = async (
    filters: {
        actor_email: string;
        actor_role: string;
        search?: string;
        branch_name?: string;
        status?: "all" | "lengkap" | "belum";
    },
    options?: ApiRequestOptions
): Promise<{ status: string; data: DcArchiveProject[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    params.append("actor_email", filters.actor_email);
    params.append("actor_role", filters.actor_role);
    if (filters.search) params.append("search", filters.search);
    if (filters.branch_name && filters.branch_name !== "all") params.append("branch_name", filters.branch_name);
    if (filters.status && filters.status !== "all") params.append("status", filters.status);
    return safeFetchJSON(`${base}/api/dc-development/archive-projects?${params}`, options);
};

export const createDcArchiveProject = async (
    payload: CreateDcArchiveProjectPayload
): Promise<{ status: string; message: string; data: DcArchiveProject }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/archive-projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export const fetchDcVendors = async (
    options?: ApiRequestOptions
): Promise<{ status: string; data: DcVendor[] }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/vendors`, options);
};

export const createDcVendor = async (payload: CreateDcVendorPayload): Promise<{ status: string; data: DcVendor }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export const fetchDcApprovals = async (
    filters?: { status?: string; required_role?: string; project_id?: number },
    options?: ApiRequestOptions
): Promise<{ status: string; data: unknown[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.required_role) params.append("required_role", filters.required_role);
    if (filters?.project_id) params.append("project_id", String(filters.project_id));
    return safeFetchJSON(`${base}/api/dc-development/approvals${params.toString() ? `?${params}` : ""}`, options);
};

export type DcDocument = {
    id: number;
    project_id: number | null;
    tender_id: number | null;
    participant_id: number | null;
    entity_type: string;
    entity_id: number | null;
    document_type: string;
    stage: string | null;
    status: string;
    created_by_email: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    current_version_id: number | null;
    version_no: number | null;
    drive_file_id: string | null;
    drive_folder_id: string | null;
    link_dokumen: string | null;
    link_folder: string | null;
    file_name: string | null;
    mime_type: string | null;
    size_bytes: string | null;
    notes: string | null;
    uploaded_by_email: string | null;
    uploaded_by_role: string | null;
    version_created_at: string | null;
    project_code: string | null;
    project_name: string | null;
};

export type DcDocumentActor = {
    actor_email: string;
    actor_role: string;
};

export const fetchDcDocuments = async (
    filters: DcDocumentActor & {
        project_id?: number;
        tender_id?: number;
        participant_id?: number;
        document_type?: string;
        entity_type?: string;
        stage?: string;
    },
    options?: ApiRequestOptions
): Promise<{ status: string; data: DcDocument[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    params.append("actor_email", filters.actor_email);
    params.append("actor_role", filters.actor_role);
    if (filters.project_id) params.append("project_id", String(filters.project_id));
    if (filters.tender_id) params.append("tender_id", String(filters.tender_id));
    if (filters.participant_id) params.append("participant_id", String(filters.participant_id));
    if (filters.document_type) params.append("document_type", filters.document_type);
    if (filters.entity_type) params.append("entity_type", filters.entity_type);
    if (filters.stage) params.append("stage", filters.stage);
    return safeFetchJSON(`${base}/api/dc-development/documents?${params}`, options);
};

export const uploadDcDocuments = async (
    payload: DcDocumentActor & {
        project_id: number;
        tender_id?: number;
        participant_id?: number;
        entity_type?: string;
        entity_id?: number;
        document_type: string;
        stage?: string;
        notes?: string;
    },
    files: File[]
): Promise<{ status: string; message: string; data: { folder: { id: string | null; link: string | null } | null; items: DcDocument[] } }> => {
    const form = new FormData();
    form.append("project_id", String(payload.project_id));
    if (payload.tender_id) form.append("tender_id", String(payload.tender_id));
    if (payload.participant_id) form.append("participant_id", String(payload.participant_id));
    form.append("entity_type", payload.entity_type || "DC_PROJECT");
    if (payload.entity_id) form.append("entity_id", String(payload.entity_id));
    form.append("document_type", payload.document_type);
    if (payload.stage) form.append("stage", payload.stage);
    if (payload.notes) form.append("notes", payload.notes);
    form.append("actor_email", payload.actor_email);
    form.append("actor_role", payload.actor_role);
    files.forEach((file, index) => form.append(`dokumen_${index + 1}`, file));

    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/dc-development/documents`, {
        method: "POST",
        body: form,
    });
    const result = await res.json();
    if (res.status === 403) throw new Error(result.message || "Anda tidak memiliki akses ke dokumen DC ini.");
    if (res.status === 400) throw new Error(result.message || "Dokumen wajib diupload.");
    if (res.status === 404) throw new Error(result.message || "Project DC tidak ditemukan.");
    if (!res.ok) throw new Error(result.message || "Gagal mengupload dokumen DC.");
    return result;
};

export const updateDcDocument = async (
    id: number,
    payload: DcDocumentActor & { document_type?: string; stage?: string; notes?: string },
    file?: File | null
): Promise<{ status: string; message: string; data: DcDocument }> => {
    const form = new FormData();
    form.append("actor_email", payload.actor_email);
    form.append("actor_role", payload.actor_role);
    if (payload.document_type) form.append("document_type", payload.document_type);
    if (payload.stage) form.append("stage", payload.stage);
    if (payload.notes) form.append("notes", payload.notes);
    if (file) form.append("dokumen", file);

    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/dc-development/documents/${id}`, {
        method: "PUT",
        body: form,
    });
    const result = await res.json();
    if (res.status === 403) throw new Error(result.message || "Anda tidak memiliki akses mengubah dokumen DC.");
    if (res.status === 404) throw new Error(result.message || "Dokumen DC tidak ditemukan.");
    if (!res.ok) throw new Error(result.message || "Gagal memperbarui dokumen DC.");
    return result;
};

export const deleteDcDocument = async (
    id: number,
    actor: DcDocumentActor
): Promise<{ status: string; message: string; data: DcDocument }> => {
    const params = new URLSearchParams({
        actor_email: actor.actor_email,
        actor_role: actor.actor_role,
    });
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/dc-development/documents/${id}?${params}`, {
        method: "DELETE",
    });
    const result = await res.json();
    if (res.status === 403) throw new Error(result.message || "Anda tidak memiliki akses menghapus dokumen DC.");
    if (res.status === 404) throw new Error(result.message || "Dokumen DC tidak ditemukan.");
    if (!res.ok) throw new Error(result.message || "Gagal menghapus dokumen DC.");
    return result;
};

export const buildDcDocumentViewUrl = (id: number, actor: DcDocumentActor, mode: "view" | "download" = "view") => {
    const params = new URLSearchParams({
        actor_email: actor.actor_email,
        actor_role: actor.actor_role,
    });
    return `${API_URL.replace(/\/$/, "")}/api/dc-development/documents/${id}/${mode}?${params}`;
};

// DC Tender Types
export type DcTender = {
    id: number;
    project_id: number;
    tender_type: string;
    status: string;
    title: string;
    owner_estimate_amount: string | null;
    oe_tolerance_percent: string;
    winner_participant_id: number | null;
    created_by_email: string | null;
    created_at: string;
    updated_at: string;
    project_code?: string;
    project_name?: string;
};

export type DcTenderParticipant = {
    id: number;
    tender_id: number;
    vendor_company_id: number;
    status: string;
    invited_by_email: string | null;
    invited_at: string;
    last_note: string | null;
    company_name?: string;
    submissions?: DcTenderSubmission[];
};

export type DcTenderSubmission = {
    id: number;
    participant_id: number;
    submission_type: string;
    status: string;
    submitted_offer_amount: string | null;
    offer_vs_oe_percent: string | null;
    oe_review_required: boolean;
    oe_review_status: string | null;
    notes: string | null;
    submitted_by_email: string | null;
    submitted_at: string;
};

export type CreateDcTenderPayload = {
    tender_type: string;
    title: string;
    owner_estimate_amount?: number;
    oe_tolerance_percent?: number;
    created_by_email?: string;
};

export const fetchDcTenders = async (
    filters?: { project_id?: number; tender_type?: string; status?: string },
    options?: ApiRequestOptions
): Promise<{ status: string; data: DcTender[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.project_id) params.append("project_id", String(filters.project_id));
    if (filters?.tender_type) params.append("tender_type", filters.tender_type);
    if (filters?.status) params.append("status", filters.status);
    return safeFetchJSON(`${base}/api/dc-development/tenders${params.toString() ? `?${params}` : ""}`, options);
};

export const fetchDcTenderById = async (
    id: number,
    options?: ApiRequestOptions
): Promise<{ status: string; data: { tender: DcTender; participants: DcTenderParticipant[] } }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/tenders/${id}`, options);
};

export const createDcTenderForProject = async (
    projectId: number,
    payload: CreateDcTenderPayload
): Promise<{ status: string; message: string; data: DcTender }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/projects/${projectId}/tenders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export const inviteDcTenderParticipant = async (
    tenderId: number,
    payload: { vendor_company_id: number; invited_by_email?: string }
): Promise<{ status: string; message: string; data: DcTenderParticipant }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/tenders/${tenderId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export const submitDcTenderSubmission = async (
    tenderId: number,
    payload: {
        submission_type: string;
        submitted_offer_amount?: number;
        notes?: string;
        submitted_by_email?: string;
        participant_id?: number;
    }
): Promise<{ status: string; message: string; data: DcTenderSubmission }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/tenders/${tenderId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export const setDcTenderWinner = async (
    tenderId: number,
    payload: { participant_id: number; actor_email: string; actor_role: string }
): Promise<{ status: string; message: string; data: DcTender }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/tenders/${tenderId}/winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export const fetchDcProjectById = async (
    id: number,
    options?: ApiRequestOptions
): Promise<{ status: string; data: { project: DcProject; stage_sequence: string[] } }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/projects/${id}`, options);
};

export const advanceDcProjectStage = async (
    projectId: number,
    payload: {
        actor_email: string;
        actor_role: string;
        reason?: string;
        target_stage?: string;
        is_intervention?: boolean;
    }
): Promise<{ status: string; message: string; data: DcProject }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/projects/${projectId}/advance-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export type DcProjectTimeline = {
    id: number;
    project_id: number;
    task_name: string;
    start_date: string;
    end_date: string;
    progress_percent: string;
    status: string;
    assigned_to_email: string | null;
    created_at: string;
    updated_at: string;
};

export type DcIssue = {
    id: number;
    project_id: number;
    issue_type: string;
    title: string;
    description: string;
    status: string;
    severity: string;
    reported_by_email: string | null;
    assigned_to_email: string | null;
    resolved_at: string | null;
    resolution_notes: string | null;
    created_at: string;
    updated_at: string;
};

export const fetchDcProjectTimelines = async (
    projectId: number,
    options?: ApiRequestOptions
): Promise<{ status: string; data: DcProjectTimeline[] }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/projects/${projectId}/timeline`, options);
};

export const addDcProjectTimeline = async (
    projectId: number,
    payload: {
        task_name: string;
        start_date: string;
        end_date: string;
        assigned_to_email?: string;
        actor_email?: string;
    }
): Promise<{ status: string; message: string; data: DcProjectTimeline }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/projects/${projectId}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export const updateDcProjectTimeline = async (
    projectId: number,
    taskId: number,
    payload: {
        progress_percent?: number;
        status?: string;
        actor_email?: string;
    }
): Promise<{ status: string; message: string; data: DcProjectTimeline }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/projects/${projectId}/timeline/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export const fetchDcProjectIssues = async (
    projectId: number,
    options?: ApiRequestOptions
): Promise<{ status: string; data: DcIssue[] }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/projects/${projectId}/issues`, options);
};

export const addDcProjectIssue = async (
    projectId: number,
    payload: {
        issue_type: string;
        title: string;
        description: string;
        severity: string;
        assigned_to_email?: string;
        actor_email?: string;
    }
): Promise<{ status: string; message: string; data: DcIssue }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/projects/${projectId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export const updateDcProjectIssue = async (
    projectId: number,
    issueId: number,
    payload: {
        status: string;
        resolution_notes?: string;
        actor_email?: string;
    }
): Promise<{ status: string; message: string; data: DcIssue }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/projects/${projectId}/issues/${issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export type DcBast = {
    id: number;
    project_id: number;
    participant_id: number | null;
    bast_type: string;
    status: string;
    checklist: any | null;
    notes: string | null;
    submitted_by_email: string | null;
    approved_by_email: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    created_at: string;
    updated_at: string;
};

export type DcTermSchedule = {
    id: number;
    participant_id: number;
    term_no: number;
    percentage: string;
    amount: string;
    requirements: string | null;
    status: string;
    approved_by_email: string | null;
    approved_at: string | null;
    created_at: string;
};

export type DcTermClaim = {
    id: number;
    term_schedule_id: number;
    claimed_amount: string;
    status: string;
    submitted_by_email: string | null;
    review_notes: string | null;
    submitted_at: string;
    updated_at: string;
};

export const fetchDcProjectBast = async (
    projectId: number,
    options?: ApiRequestOptions
): Promise<{ status: string; data: DcBast[] }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/projects/${projectId}/bast`, options);
};

export const createDcProjectBast = async (
    projectId: number,
    payload: {
        bast_type: string;
        participant_id?: number;
        notes?: string;
        actor_email?: string;
    }
): Promise<{ status: string; message: string; data: DcBast }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/projects/${projectId}/bast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export const updateDcProjectBast = async (
    projectId: number,
    bastId: number,
    payload: {
        status: string;
        checklist?: any;
        notes?: string;
        actor_email?: string;
    }
): Promise<{ status: string; message: string; data: DcBast }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/projects/${projectId}/bast/${bastId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export const fetchDcParticipantTerms = async (
    participantId: number,
    options?: ApiRequestOptions
): Promise<{ status: string; data: { schedules: DcTermSchedule[], claims: DcTermClaim[] } }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/tenders/participants/${participantId}/terms`, options);
};

export const addDcTermSchedule = async (
    participantId: number,
    payload: {
        term_no: number;
        percentage: number;
        amount: number;
        requirements?: string;
        actor_email?: string;
    }
): Promise<{ status: string; message: string; data: DcTermSchedule }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/tenders/participants/${participantId}/terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

export const submitDcTermClaim = async (
    termId: number,
    payload: {
        claimed_amount: number;
        actor_email?: string;
    }
): Promise<{ status: string; message: string; data: DcTermClaim }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dc-development/tenders/participants/terms/${termId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
};

// =============================================================================
// 2. RAB  Rencana Anggaran Biaya
// =============================================================================

// --- Types ---

export type RABTokoDetail = {
    nomor_ulok: string;
    nama_toko:  string;
    cabang:     string;
    proyek:     string;
};

export type RABListItem = {
    id:                   number;
    id_toko:              number;
    status:               string;
    nama_pt:              string;
    email_pembuat:        string;
    grand_total:          string;
    grand_total_non_sbo:  string;
    grand_total_final:    string;
    link_pdf_gabungan:    string;
    link_pdf_non_sbo:     string;
    link_pdf_rekapitulasi:string;
    link_pdf_materai?:    string | null;
    link_lampiran_pendukung?:string | null;
    created_at:           string;
    nomor_ulok:           string;
    nama_toko:            string;
    cabang:               string;
    proyek:               string;
    alasan_penolakan?:    string | null;
    toko?:                RABTokoDetail;
};

export type RABListFilters = {
    status?:     string;
    nomor_ulok?: string;
    cabang?:     string;
    nama_pt?:    string;
    email_pembuat?: string;
};

export type RABDetailToko = {
    id:               number;
    nomor_ulok:       string;
    lingkup_pekerjaan:string;
    nama_toko:        string;
    kode_toko:        string;
    proyek:           string;
    cabang:           string;
    alamat:           string;
    nama_kontraktor:  string;
};

export type RABDetailData = {
    id:                              number;
    id_toko:                         number;
    status:                          string;
    nama_pt:                         string;
    email_pembuat:                   string;
    logo:                            string | null;
    link_pdf_gabungan:               string | null;
    link_pdf_non_sbo:                string | null;
    link_pdf_rekapitulasi:           string | null;
    link_pdf_materai:                string | null;
    pemberi_persetujuan_koordinator: string | null;
    waktu_persetujuan_koordinator:   string | null;
    pemberi_persetujuan_manager:     string | null;
    waktu_persetujuan_manager:       string | null;
    pemberi_persetujuan_direktur:    string | null;
    waktu_persetujuan_direktur:      string | null;
    alasan_penolakan:                string | null;
    durasi_pekerjaan:                string;
    kategori_lokasi:                 string;
    luas_bangunan:                   string;
    luas_terbangun:                  string;
    luas_area_terbuka:               string;
    luas_area_parkir:                string;
    luas_area_sales:                 string;
    luas_gudang:                     string;
    grand_total:                     string;
    grand_total_non_sbo:             string;
    grand_total_final:               string;
    created_at:                      string;
    no_polis?:                       string | null;
    berlaku_polis?:                  string | null;
    file_asuransi?:                  string | null;
    link_lampiran_pendukung:         string | null;
};

export type RABDetailItem = {
    id:                number;
    id_rab:            number;
    source_type?:      'RAB' | 'IL';
    id_instruksi_lapangan_item?: number;
    kategori_pekerjaan:string;
    jenis_pekerjaan:   string;
    satuan:            string;
    volume:            number;
    harga_material:    number;
    harga_upah:        number;
    total_material:    number;
    total_upah:        number;
    total_harga:       number;
    catatan?:          string | null;
};

export type RABRevisionItem = {
    id:             number;
    id_rab:         number;
    id_rab_item:    number | null;
    approver_email: string | null;
    approver_role:  string | null;
    catatan_item:   string | null;
    created_at:     string;
};

export type RABDetailResponse = {
    rab:          RABDetailData;
    toko:         RABDetailToko;
    items:        RABDetailItem[];
    revisi_items?: RABRevisionItem[];
};

export type RABApprovalPayload = {
    approver_email:   string;
    nama_lengkap?:    string;
    jabatan:          "KOORDINATOR" | "MANAGER" | "DIREKTUR" | "DIREKTUR_KONTRAKTOR" | string;
    next_jabatan?:    "KOORDINATOR" | "MANAGER" | "DIREKTUR" | "DIREKTUR_KONTRAKTOR" | string;
    next_status?:     string;
    tindakan:         "APPROVE" | "REJECT" | string;
    alasan_penolakan?: string | null;
    catatan_approval?: string | null;
    revisi_item_ids?: number[];
    revisi_item_notes?: Record<string, string | null | undefined>;
};

export type RABApprovalResponse = {
    status:  string;
    message: string;
    data: {
        id:         number;
        old_status: string;
        new_status: string;
    };
};

// --- Fungsi ---

/** Cek status revisi RAB berdasarkan email pembuat dan cabang. */
export const checkRevisionStatus = async (email: string, cabang: string) => {
    try {
        // Ambil dari API List RAB baru
        const res = await fetchRABList();
        
        // Filter RAB yang dimiliki user ini dan ditolak/dikembalikan
        const rejected = res.data.filter(rab => {
            if (!rab.status) return false;
            const s = rab.status.toUpperCase();
            const isRejected = s.includes('TOLAK') || s === 'REJECTED';
            const isMine = (rab.email_pembuat || '').toLowerCase() === (email || '').toLowerCase();
            return isMine && isRejected;
        });

        if (rejected.length === 0) return { rejected_submissions: [] };

        const formatted = rejected.map(r => ({
            id: r.id,
            "Nomor Ulok": r.nomor_ulok,
            "lingkup_pekerjaan": (r as any).lingkup_pekerjaan || (r.toko as any)?.lingkup_pekerjaan,
            "nama_toko": r.nama_toko || r.toko?.nama_toko,
            "Proyek": r.proyek || r.toko?.proyek,
            "alasan_penolakan": r.alasan_penolakan,
            // Sisa field detail akan diambil saat tombol 'Revisi Sekarang' diklik
        }));

        return { rejected_submissions: formatted };
    } catch (err) {
        console.error("Error checkRevisionStatus:", err);
        return { rejected_submissions: [] };
    }
};

/** Ambil data harga material/upah berdasarkan cabang dan lingkup pekerjaan. */
export const fetchPricesData = async (cabang: string, lingkup: string) => {
    const base = API_URL.replace(/\/$/, "");
    const url = `${base}/get-data?cabang=${encodeURIComponent(cabang)}&lingkup=${encodeURIComponent(lingkup)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gagal mengambil data harga (${res.status}).`);
    const data = await res.json();

    return Object.entries(data || {}).reduce((acc: Record<string, any[]>, [category, items]) => {
        const normalizedCategory = String(category).trim().replace(/\s+/g, " ");
        if (!normalizedCategory) return acc;

        acc[normalizedCategory] = [
            ...(acc[normalizedCategory] || []),
            ...(Array.isArray(items) ? items : [])
        ];

        return acc;
    }, {});
};

/** Ambil daftar User Cabang (PIC) */
export const fetchUserCabangList = async (
    filters?: { cabang?: string; jabatan?: string; search?: string; email_sat?: string; nama_pt?: string }
): Promise<{ status: string; data: any[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.cabang) params.append("cabang", filters.cabang);
    if (filters?.jabatan) params.append("jabatan", filters.jabatan);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.email_sat) params.append("email_sat", filters.email_sat);
    if (filters?.nama_pt) params.append("nama_pt", filters.nama_pt);
    const url = `${base}/api/user_cabang${params.toString() ? `?${params}` : ""}`;
    const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
    if (!res.ok) throw new Error("Gagal mengambil data user cabang");
    return res.json();
};

/** Detail user cabang berdasarkan ID */
export const fetchUserCabangDetail = async (id: number): Promise<{ status: string; data: any }> => {
    const url = `${API_URL.replace(/\/$/, "")}/api/user_cabang/${id}`;
    const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
    if (res.status === 404) throw new Error("Data user_cabang tidak ditemukan");
    if (!res.ok) throw new Error("Gagal mengambil detail user cabang");
    return res.json();
};

export const createUserCabang = async (data: any) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/user_cabang`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    const result = await res.json();
    if (res.status === 409) throw new Error(result.message || "Kombinasi email_sat + cabang sudah terdaftar");
    if (res.status === 422) throw new Error(result.message || "Validasi request gagal");
    if (!res.ok) throw new Error(result.message || "Gagal membuat user cabang");
    return result;
};

export const updateUserCabang = async (id: number, data: any) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/user_cabang/${id}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    const result = await res.json();
    if (res.status === 404) throw new Error(result.message || "Data user_cabang tidak ditemukan");
    if (res.status === 409) throw new Error(result.message || "Kombinasi email_sat + cabang bentrok dengan data lain");
    if (res.status === 422) throw new Error(result.message || "Validasi request gagal");
    if (!res.ok) throw new Error(result.message || "Gagal mengupdate user cabang");
    return result;
};

export const deleteUserCabang = async (id: number) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/user_cabang/${id}`;
    const res = await fetch(url, {
        method: 'DELETE',
        headers: { "Content-Type": "application/json" }
    });
    const result = await res.json();
    if (res.status === 404) throw new Error(result.message || "Data user_cabang tidak ditemukan");
    if (!res.ok) throw new Error(result.message || "Gagal menghapus user cabang");
    return result;
};

/** Submit / buat RAB baru.
 *  - Jika `asuransiFile` ada  kirim sebagai multipart/form-data (backend upload ke Drive).
 *  - Jika tidak ada file    kirim sebagai JSON (backward compatible).
 */
export const submitRABData = async (
    fields: Record<string, string>,
    detailItems: any[],
    asuransiFile?: File | null
) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/rab/submit`;

    let res: Response;

    if (asuransiFile) {
        // --- MODE MULTIPART: file_asuransi dikirim sebagai file ---
        const form = new FormData();
        Object.entries(fields).forEach(([key, value]) => {
            if (value !== undefined && value !== null) form.append(key, value);
        });
        form.append("detail_items", JSON.stringify(detailItems));
        const isRevision = fields.is_revisi === "true";
        form.append(isRevision ? "rev_file_asuransi" : "file_asuransi", asuransiFile);

        res = await fetch(url, { method: "POST", body: form });
    } else {
        // --- MODE JSON: backward compatible ---
        const jsonPayload = { ...fields, detail_items: detailItems };
        res = await fetch(url, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(jsonPayload),
        });
    }

    const result = await res.json();
    if (res.status === 409) throw new Error(result.message || "RAB aktif untuk ULOK ini sudah ada.");
    if (res.status === 422) throw new Error("Validasi gagal. Pastikan seluruh form dan tabel terisi.");
    if (!res.ok || result.status !== "success") throw new Error(result.message || "Server error saat menyimpan.");
    return result;
};

/** Ambil daftar RAB dengan filter opsional. */
export const fetchRABList = async (
    filters?: RABListFilters,
    options?: ApiRequestOptions
): Promise<{ status: string; data: RABListItem[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status)     params.append("status",     filters.status);
    if (filters?.nomor_ulok) params.append("nomor_ulok", filters.nomor_ulok);
    if (filters?.cabang)     params.append("cabang",     filters.cabang);
    if (filters?.nama_pt)    params.append("nama_pt",    filters.nama_pt);
    if (filters?.email_pembuat) params.append("email_pembuat", filters.email_pembuat);
    const url = `${base}/api/rab${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url, options);
};

/** Ambil detail lengkap RAB berdasarkan ID. */
export const fetchRABDetail = async (
    id: number
): Promise<{ status: string; data: RABDetailResponse }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/rab/${id}`);
    if (res.status === 404) throw new Error(`RAB dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal memuat detail RAB (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
};

/** Update RAB items secara bulk (harus pakai id item). */
export const updateRabItemsBulk = async (
    id: number,
    items: Array<{
        id: number;
        kategori_pekerjaan: string;
        jenis_pekerjaan: string;
        satuan: string;
        volume: number;
        harga_material: number;
        harga_upah: number;
        total_material?: number;
        total_upah?: number;
        total_harga?: number;
        catatan?: string;
    }>,
    totals?: {
        grand_total?: number;
        grand_total_non_sbo?: number;
        grand_total_final?: number;
    }
): Promise<any> => {
    const url = `${API_URL.replace(/\/$/, "")}/api/rab/${id}/items`;
    const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, ...totals })
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal update item RAB (${res.status}): ${text.substring(0, 120)}`);
    }
    return res.json();
};

/** Replace seluruh RAB items (tanpa id). */
export const replaceRabItems = async (
    id: number,
    items: Array<{
        kategori_pekerjaan: string;
        jenis_pekerjaan: string;
        satuan: string;
        volume: number;
        harga_material: number;
        harga_upah: number;
        total_material?: number;
        total_upah?: number;
        total_harga?: number;
        catatan?: string;
    }>,
    totals?: {
        grand_total?: number;
        grand_total_non_sbo?: number;
        grand_total_final?: number;
    }
): Promise<any> => {
    const url = `${API_URL.replace(/\/$/, "")}/api/rab/${id}/items/replace`;
    const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, ...totals })
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal replace item RAB (${res.status}): ${text.substring(0, 120)}`);
    }
    return res.json();
};

export type RabMigrationAction =
    | "insert"
    | "skip"
    | "update_created_at"
    | "replace_rab_items"
    | "replace_toko_rab_items"
    | "replace_items";

export type RabMigrationPreviewDetail = {
    source_rab_id: number;
    source_toko_id: number;
    nomor_ulok: string;
    lingkup_pekerjaan: string;
    nama_toko: string;
    cabang: string;
    status_rab: string;
    item_count: number;
    grand_total: string;
    db_state: "ready" | "conflict" | "missing_created_at" | "invalid";
    existing_toko_id: number | null;
    existing_rab_id: number | null;
    existing_created_at: string | null;
    existing_item_count: number;
    existing_match_count: number;
    has_materai_pdf: boolean;
    issues: string[];
    warnings: string[];
};

export type RabMigrationPreviewResult = {
    total_rab: number;
    total_items: number;
    ready_count: number;
    conflict_count: number;
    missing_created_at_count: number;
    invalid_count: number;
    materai_count: number;
    materai_ambiguous_count: number;
    source_format: "legacy_tables" | "data_form_form2";
    ignored_sheets: string[];
    details: RabMigrationPreviewDetail[];
};

export type RabMigrationCommitSelection = {
    source_rab_id: number;
    action: RabMigrationAction;
};

export type RabMigrationCommitResult = {
    total_selected: number;
    inserted: number;
    replaced: number;
    updated_created_at: number;
    skipped: number;
    migrated_items: number;
    details: Array<{
        action: RabMigrationAction;
        source_rab_id: number;
        target_rab_id: number | null;
        item_count: number;
        status: string;
    }>;
};

const postRabMigration = async <T>(
    endpoint: "preview" | "commit",
    file: File,
    actorRole: string,
    actorEmail?: string,
    selections?: RabMigrationCommitSelection[],
    materaiFile?: File | null
): Promise<{ status: string; message: string; data: T }> => {
    const form = new FormData();
    form.append("file", file);
    if (materaiFile) form.append("materai_file", materaiFile);
    form.append("actor_role", actorRole);
    if (actorEmail) form.append("actor_email", actorEmail);
    if (selections) form.append("selections", JSON.stringify(selections));

    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/rab/migration/${endpoint}`, {
        method: "POST",
        body: form
    });

    const result = await res.json();
    if (res.status === 403) throw new Error(result.message || "Hanya Super Human yang dapat melakukan migrasi RAB.");
    if (!res.ok) throw new Error(result.message || "Gagal memproses migrasi RAB.");
    return result;
};

export const previewRabMigration = (file: File, actorRole: string, actorEmail?: string, materaiFile?: File | null) =>
    postRabMigration<RabMigrationPreviewResult>("preview", file, actorRole, actorEmail, undefined, materaiFile);

export const commitRabMigration = (
    file: File,
    actorRole: string,
    actorEmail: string | undefined,
    selections: RabMigrationCommitSelection[],
    materaiFile?: File | null
) => postRabMigration<RabMigrationCommitResult>("commit", file, actorRole, actorEmail, selections, materaiFile);

/** Ambil detail Toko berdasarkan ID untuk menarik kolom alamat yang kosong pada revisi. */
export const fetchTokoDetail = async (id: number) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/toko/detail?id=${id}`);
    if (!res.ok) {
        if (res.status === 404) throw new Error("Data toko tidak ditemukan.");
        throw new Error(`Gagal memuat detail Toko (${res.status})`);
    }
    return res.json();
};

/** Ambil daftar seluruh Toko. */
export const fetchTokoList = async (): Promise<{ status: string; data: RABDetailToko[] }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/toko`);
};

/** URL endpoint untuk download logo RAB. */
export const getRABLogoDownloadUrl = (id: number) => {
    return `${API_URL.replace(/\/$/, "")}/api/rab/${id}/logo`;
};

/** URL endpoint untuk download file asuransi RAB. */
export const getRABInsuranceDownloadUrl = (id: number) => {
    return `${API_URL.replace(/\/$/, "")}/api/rab/${id}/file-asuransi`;
};

/**
 * Download PDF RAB ke browser.
 * Nama file diambil dari header Content-Disposition jika tersedia.
 */
export const downloadRABPdf = async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/rab/${id}/pdf`);
    if (res.status === 404) throw new Error(`Data RAB/Toko dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal mengunduh PDF (${res.status}): ${text.substring(0, 100)}`);
    }

    // Parsing nama file dari Content-Disposition header
    const disposition = res.headers.get("Content-Disposition");
    let filename = `RAB_GABUNGAN_${id}.pdf`;
    if (disposition?.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
    }

    // Trigger download di browser
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    return true;
};

export const regenerateRABPdf = async (id: number): Promise<{
    status: string;
    message: string;
    data: {
        link_pdf_gabungan: string;
        link_pdf_non_sbo: string;
        link_pdf_rekapitulasi: string;
        link_pdf_sph?: string;
        has_materai_pdf: boolean;
    };
}> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/rab/${id}/pdf/regenerate`, { method: "POST" });
    const result = await res.json();
    if (!res.ok || result.status !== "success") {
        throw new Error(result.message || "Gagal generate ulang PDF RAB.");
    }
    return result;
};

export const regenerateAndDownloadRABPdf = async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/rab/${id}/pdf/regenerate-download`, { method: "POST" });
    if (!res.ok) {
        const text = await res.text();
        let message = "";
        try {
            const parsed = JSON.parse(text);
            message = parsed.message || "";
        } catch {
            message = "";
        }
        throw new Error(message || `Gagal generate dan mengunduh PDF (${res.status}): ${text.substring(0, 100)}`);
    }

    const disposition = res.headers.get("Content-Disposition");
    let filename = `RAB_GABUNGAN_${id}.pdf`;
    if (disposition?.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    return true;
};

/** Sinkronkan ulang harga item RAB dari master harga cabang dan regenerate PDF. */
export const syncRABBranchPrices = async (
    id: number
): Promise<{
    status: string;
    message: string;
    data: {
        id_rab: number;
        cabang: string;
        lingkup_pekerjaan: string | null;
        updated_items: number;
        totals: {
            grandTotal: number;
            totalNonSbo: number;
            finalGrandTotal: number;
        };
        links?: {
            link_pdf_gabungan: string;
            link_pdf_non_sbo: string;
            link_pdf_rekapitulasi: string;
            link_pdf_sph?: string;
        } | null;
    };
}> => {
    const url = `${API_URL.replace(/\/$/, "")}/api/rab/${id}/sync-branch-prices`;
    const res = await fetch(url, { method: "POST" });
    const result = await res.json();
    if (!res.ok || result.status !== "success") {
        throw new Error(result.message || "Gagal sinkron harga cabang RAB.");
    }
    return result;
};

/** Update status RAB (penolakan otomatis oleh HEAD OFFICE). */
export const updateRABStatus = async (payload: {
    id_toko: number;
    id_rab: number;
    status: string;
    actor_email?: string;
    actor_role?: string;
    alasan_intervensi?: string;
}): Promise<any> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/rab/update-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 400) throw new Error(result.message || "Status yang dikirim bukan status penolakan yang valid.");
    if (res.status === 404) throw new Error(result.message || "RAB atau data user tidak ditemukan.");
    if (res.status === 409) throw new Error(result.message || "id_toko tidak cocok dengan data RAB.");
    if (!res.ok) throw new Error(result.message || "Gagal memperbarui status RAB.");
    return result;
};

export type ActivityLog = {
    id: number;
    entity_type: string;
    entity_id: number;
    actor_email: string | null;
    actor_role: string | null;
    action: string;
    status_before: string | null;
    status_after: string | null;
    reason: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
};

export const fetchActivityLogs = async (
    entityType: string,
    entityId: number
): Promise<{ status: string; data: ActivityLog[] }> => {
    const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: String(entityId)
    });
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/activity-log?${params}`);
};
/** Proses approval atau reject RAB. */
export const processRABApproval = async (
    id: number,
    payload: RABApprovalPayload
): Promise<RABApprovalResponse> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/rab/${id}/approval`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Data RAB tidak ditemukan.");
    if (res.status === 409) throw new Error(result.message || "Status tidak valid. Mungkin sudah diproses.");
    if (res.status === 422) throw new Error(result.message || "Validasi gagal. Isi alasan penolakan.");
    if (!res.ok) throw new Error(result.message || `Gagal memproses approval (${res.status}).`);
    return result;
};

// =============================================================================
// 3. GANTT CHART
// =============================================================================

// --- Types ---

export type GanttDayItem = {
    kategori_pekerjaan: string;
    h_awal:             string; // angka hari (misal: "1")
    h_akhir:            string; // angka hari (misal: "10")
    keterlambatan?:     string;
    kecepatan?:         string;
};

export type GanttDependency = {
    kategori_pekerjaan:        string;
    kategori_pekerjaan_terikat:string;
};

export type GanttPengawasan = {
    kategori_pekerjaan?: string;
    tanggal_pengawasan?: string;
};

export type GanttSubmitPayload = {
    nomor_ulok:         string;
    nama_toko?:         string;
    kode_toko?:         string;
    proyek?:            string;
    cabang?:            string;
    alamat?:            string;
    nama_kontraktor?:   string;
    lingkup_pekerjaan?: string;
    email_pembuat:      string;
    kategori_pekerjaan: string[];
    day_items:          GanttDayItem[];
    pengawasan?:        GanttPengawasan[];
    dependencies?:      GanttDependency[];
};

export type GanttListItem = {
    id:           number;
    id_toko:      number;
    status:       "active" | "terkunci" | string;
    email_pembuat:string;
    timestamp:    string;
    nomor_ulok:   string;
    lingkup_pekerjaan?: string | null;
    nama_toko:    string;
    cabang:       string;
    proyek:       string;
};

export type GanttListFilters = {
    status?:        "active" | "terkunci" | string;
    nomor_ulok?:    string;
    email_pembuat?: string;
};

export type GanttInterventionPayload = {
    actor_email: string;
    actor_role: string;
    target_status: "active" | "terkunci";
    alasan_intervensi: string;
};

export type GanttDetailToko = {
    id:               number;
    nomor_ulok:       string;
    lingkup_pekerjaan:string;
    nama_toko:        string;
    kode_toko:        string;
    proyek:           string;
    cabang:           string;
    alamat:           string;
    nama_kontraktor:  string;
};

export type GanttDetailKategori = {
    id:                 number;
    id_gantt:           number;
    kategori_pekerjaan: string;
};

export type GanttDetailDayItem = {
    id:                         number;
    id_gantt:                   number;
    id_kategori_pekerjaan_gantt:number;
    h_awal:                     string; // angka hari (misal: "1")
    h_akhir:                    string; // angka hari (misal: "10")
    keterlambatan:              string | null;
    kecepatan:                  string | null;
    kategori_pekerjaan:         string;
};

export type GanttDetailPengawasan = {
    id:                 number;
    id_gantt:           number;
    kategori_pekerjaan?: string;
    tanggal_pengawasan?: string;
};

export type GanttDetailDependency = {
    id:                        number;
    id_gantt:                  number;
    id_kategori:               number;
    id_kategori_terikat:       number;
    kategori_pekerjaan:        string;
    kategori_pekerjaan_terikat:string;
};

export type GanttDetailData = {
    gantt: {
        id:           number;
        id_toko:      number;
        status:       string;
        email_pembuat:string;
        timestamp:    string;
    };
    toko:               GanttDetailToko;
    kategori_pekerjaan: GanttDetailKategori[];
    day_items:          GanttDetailDayItem[];
    pengawasan:         GanttDetailPengawasan[];
    dependencies:       GanttDetailDependency[];
    instruksi_lapangan_items?: any[];
};

export type GanttNoteItem = {
    id:           number;
    id_gantt:     number;
    author_email: string;
    author_name:  string;
    author_role:  string;
    note:         string;
    created_at:   string;
};

export type CreateGanttNotePayload = {
    author_email: string;
    author_name:  string;
    author_role:  string;
    note:         string;
};

export type GanttUpdatePayload = {
    kategori_pekerjaan: string[];
    day_items:          GanttDayItem[];
    dependencies?:      GanttDependency[];
    pengawasan?:        GanttPengawasan[];
    status?:            string;
};

export type GanttTokoDetailResponse = {
    status:              string;
    rab:                 { id: number; status: string } | null;
    filtered_categories: string[];
    gantt_data:          GanttDetailData["gantt"] | null;
    day_gantt_data:      GanttDetailDayItem[];
    dependency_data:     GanttDetailDependency[];
    pengawasan_data:     GanttDetailPengawasan[];
    kategori_pekerjaan:  GanttDetailKategori[];
    instruksi_lapangan_items?: any[];
    toko:                GanttDetailToko;
};

// --- Fungsi ---

/** Submit / upsert Gantt Chart (transaksi penuh). */
export const submitGanttChart = async (payload: GanttSubmitPayload) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/submit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 409) throw new Error(result.message || "Gantt aktif untuk ULOK ini sudah ada.");
    if (!res.ok) throw new Error(result.message || `Gagal menyimpan Gantt Chart (${res.status}).`);
    return result;
};

/** Ambil daftar Gantt Chart dengan filter opsional. */
export const fetchGanttList = async (
    filters?: GanttListFilters
): Promise<{ status: string; data: GanttListItem[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status)        params.append("status",        filters.status);
    if (filters?.nomor_ulok)    params.append("nomor_ulok",    filters.nomor_ulok);
    if (filters?.email_pembuat) params.append("email_pembuat", filters.email_pembuat);
    const url = `${base}/api/gantt${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url);
};

/** Ambil data Gantt legacy (endpoint lama). */
export const fetchGanttData = async (ulok: string, lingkup: string) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/get_gantt_data?nomor_ulok=${encodeURIComponent(ulok)}&lingkup_pekerjaan=${encodeURIComponent(lingkup)}`;
    const res = await fetch(url);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
};

/** Ambil detail Gantt Chart berdasarkan ID. */
export const fetchGanttDetail = async (
    id: number
): Promise<{ status: string; data: GanttDetailData }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/${id}`);
    if (res.status === 404) throw new Error(`Gantt Chart dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal memuat Gantt Chart (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
};

export const fetchGanttNotes = async (
    id: number
): Promise<{ status: string; data: GanttNoteItem[] }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/${id}/notes`);
    if (res.status === 404) throw new Error(`Gantt Chart dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal memuat catatan pengawasan (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
};

export const createGanttNote = async (
    id: number,
    payload: CreateGanttNotePayload
): Promise<{ status: string; message: string; data: GanttNoteItem }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Gantt Chart tidak ditemukan.");
    if (res.status === 422) throw new Error(result.message || "Catatan wajib diisi.");
    if (!res.ok) throw new Error(result.message || "Gagal mengirim catatan pengawasan.");
    return result;
};

export const interveneGanttStatus = async (
    id: number,
    payload: GanttInterventionPayload
): Promise<{ status: string; message: string; data: { id: string; old_status: string; new_status: string } }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/${id}/intervention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error(result.message || "Gantt Chart tidak ditemukan.");
    if (res.status === 409) throw new Error(result.message || "Status Gantt sudah sama.");
    if (res.status === 422) throw new Error(result.message || "Validasi intervensi Gantt gagal.");
    if (!res.ok) throw new Error(result.message || `Gagal melakukan intervensi Gantt (${res.status}).`);
    return result;
};

/** Ambil detail Gantt Chart berdasarkan ID Toko. */
export const fetchGanttDetailByToko = async (
    id_toko: number
): Promise<GanttTokoDetailResponse> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/detail/${id_toko}`);
    if (res.status === 404) throw new Error(`Toko dengan ID ${id_toko} tidak ditemukan.`);
    if (res.status === 422) throw new Error("Parameter ID Toko tidak valid.");
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal memuat Gantt Chart (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
};

/** Update Gantt Chart berdasarkan ID. */
export const updateGanttChart = async (id: number, payload: GanttUpdatePayload) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/${id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Gantt Chart tidak ditemukan.");
    if (res.status === 409) throw new Error("Gantt Chart sudah terkunci dan tidak dapat diubah.");
    if (!res.ok) {
        const errorDetails = result.errors ? JSON.stringify(result.errors) : "";
        throw new Error(`${result.message || 'Gagal memperbarui'} ${errorDetails}`.trim());
    }
    return result;
};

/** Kunci (lock) Gantt Chart agar tidak bisa diubah lagi. */
export const lockGanttChart = async (id: number, email: string) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/${id}/lock`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Gantt Chart tidak ditemukan.");
    if (res.status === 409) throw new Error("Gantt Chart sudah terkunci.");
    if (!res.ok) throw new Error(result.message || "Gagal mengunci Gantt Chart.");
    return result;
};

/** Submit Hari Pengawasan ke Gantt */
export const submitGanttPengawasan = async (id: number, tanggal_pengawasan: string[]) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/${id}/pengawasan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tanggal_pengawasan }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal menyimpan tanggal pengawasan Gantt.");
    return result;
};

/** Hapus Gantt Chart. */
export const deleteGanttChart = async (id: number) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/${id}`, {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Gantt Chart tidak ditemukan.");
    if (res.status === 409) throw new Error("Gantt Chart sudah terkunci dan tidak dapat dihapus.");
    if (!res.ok) throw new Error(result.message || "Gagal menghapus.");
    return result;
};

/** Tambah day items (periode) ke Gantt Chart. */
export const addGanttDayItems = async (id: number, dayItems: GanttDayItem[]) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/${id}/day`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ day_items: dayItems }),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Gantt Chart tidak ditemukan.");
    if (res.status === 409) throw new Error("Gantt Chart sudah terkunci.");
    if (res.status === 422) throw new Error("Validasi gagal. Pastikan format tanggal DD/MM/YYYY.");
    if (!res.ok) throw new Error(result.message || "Gagal menambahkan day items.");
    return result;
};

/** Update data keterlambatan pada periode tertentu. */
export const updateGanttDelay = async (
    id: number,
    payload: { kategori_pekerjaan: string; keterlambatan: string } | { updates: { kategori_pekerjaan: string; keterlambatan: string }[] }
) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/${id}/day/keterlambatan`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Gantt Chart atau periode tidak ditemukan.");
    if (res.status === 422) throw new Error("Validasi gagal. Periksa data keterlambatan.");
    if (!res.ok) throw new Error(result.message || "Gagal update keterlambatan.");
    return result;
};

/** Update data kecepatan pada periode tertentu. */
export const updateGanttSpeed = async (
    id: number,
    payload: { kategori_pekerjaan: string; h_awal: string; h_akhir: string; kecepatan: string }
) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/${id}/day/kecepatan`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Gantt Chart atau periode tidak ditemukan.");
    if (res.status === 422) throw new Error("Validasi gagal. Periksa data kecepatan.");
    if (!res.ok) throw new Error(result.message || "Gagal update kecepatan.");
    return result;
};

export const previewGanttMigration = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/migration/preview`, {
        method: 'POST',
        body: formData,
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal membuat preview migrasi Gantt Chart.");
    return result;
};

export const commitGanttMigration = async (file: File, emailPembuat: string, limit?: number) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("email_pembuat", emailPembuat);
    if (limit !== undefined) formData.append("limit", String(limit));

    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/migration/commit`, {
        method: 'POST',
        body: formData,
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal memproses migrasi Gantt Chart.");
    return result;
};

/** Tambah atau hapus kategori dari daftar pengawasan Gantt Chart. */
export const manageGanttPengawasan = async (
    id: number,
    payload: { kategori_pekerjaan?: string; remove_kategori?: string }
) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/gantt/${id}/pengawasan`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Gantt Chart tidak ditemukan.");
    if (res.status === 422) throw new Error("Kirim salah satu dari kategori_pekerjaan atau remove_kategori.");
    if (!res.ok) throw new Error(result.message || "Gagal update pengawasan.");
    return result;
};

/** Submit Bulk Pengawasan (Items Pekerjaan dari Memo) */
export const submitPengawasanBulk = async (payload: FormData | { items: any[] }) => {
    const isFormData = payload instanceof FormData;
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/pengawasan/bulk`, {
        method: "POST",
        headers: isFormData ? undefined : { "Content-Type": "application/json" },
        body: isFormData ? payload : JSON.stringify(payload),
    });
};

/** Update Bulk Pengawasan (Items Pekerjaan dari Memo) */
export const updatePengawasanBulk = async (payload: FormData | { items: any[] }) => {
    const isFormData = payload instanceof FormData;
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/pengawasan/bulk`, {
        method: "PUT",
        headers: isFormData ? undefined : { "Content-Type": "application/json" },
        body: isFormData ? payload : JSON.stringify(payload),
    });
};

/** Ambil daftar pengawasan selesai/seluruhnya */
export const fetchPengawasanList = async (filters?: { 
    id_gantt?: number; 
    status?: string; 
    tanggal?: string;
    kategori_pekerjaan?: string;
    jenis_pekerjaan?: string;
}) => {
    const params = new URLSearchParams();
    if (filters?.id_gantt) params.append("id_gantt", filters.id_gantt.toString());
    if (filters?.status) params.append("status", filters.status);
    if (filters?.tanggal) params.append("tanggal", filters.tanggal);
    if (filters?.kategori_pekerjaan) params.append("kategori_pekerjaan", filters.kategori_pekerjaan);
    if (filters?.jenis_pekerjaan) params.append("jenis_pekerjaan", filters.jenis_pekerjaan);
    
    const url = `${API_URL.replace(/\/$/, "")}/api/pengawasan${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url);
};

/** Ambil detail pengawasan berdasarkan ID */
export const fetchPengawasanDetail = async (id: number): Promise<any> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/pengawasan/${id}`);
    if (res.status === 404) throw new Error(`Data Pengawasan dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal memuat detail Pengawasan (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
};

// =============================================================================
// INSTRUKSI LAPANGAN
// =============================================================================

export const submitInstruksiLapangan = async (
    fields: Record<string, string | number | undefined>,
    detailItems: any[],
    lampiranFile?: File | null
) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/instruksi-lapangan/submit`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);

    let res: Response;

    try {
        if (lampiranFile) {
            const form = new FormData();
            Object.entries(fields).forEach(([key, value]) => {
                if (value !== undefined && value !== null) form.append(key, String(value));
            });
            form.append("detail_items", JSON.stringify(detailItems));
            form.append("lampiran", lampiranFile);

            res = await fetch(url, { method: "POST", body: form, signal: controller.signal });
        } else {
            const jsonPayload = { ...fields, detail_items: detailItems };
            res = await fetch(url, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify(jsonPayload),
                signal:  controller.signal,
            });
        }
    } catch (error: any) {
        if (error?.name === "AbortError") {
            throw new Error("Timeout saat menyimpan Instruksi Lapangan. Cek koneksi atau coba lagi; jika data belum masuk DB, hubungi admin.");
        }
        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }

    const text = await res.text();
    let result: any = {};
    try {
        result = text ? JSON.parse(text) : {};
    } catch {
        result = { message: text || "Response server tidak valid saat menyimpan Instruksi Lapangan." };
    }
    if (!res.ok) throw new Error(result.message || "Server error saat menyimpan Instruksi Lapangan.");
    return result;
};

// =============================================================================
// OPNAME
// =============================================================================

// --- Types ---

export type OpnameItem = {
    id:              number;
    id_toko:         number;
    id_opname_final: number;
    id_rab_item:     number | null;
    id_instruksi_lapangan_item?: number | null;
    status:          'pending' | 'disetujui' | 'ditolak' | string;
    volume_akhir:    number;
    selisih_volume:  number;
    total_selisih:   number;
    total_harga_opname: number;
    desain:          string | null;
    kualitas:        string | null;
    spesifikasi:     string | null;
    foto:            string | null;
    catatan:         string | null;
    created_at:      string;
    // Joined from rab_item relation
    rab_item?: {
        id:                 number;
        id_rab:             number;
        kategori_pekerjaan: string;
        jenis_pekerjaan:    string;
        satuan:             string;
        volume:             number;
        harga_material:     number;
        harga_upah:         number;
        total_material:     number;
        total_upah:         number;
        total_harga:        number;
    };
    // Joined from toko relation
    toko?: {
        id:            number;
        nomor_ulok:    string;
        nama_toko:     string;
        cabang:        string;
        proyek:        string;
        nama_kontraktor: string;
    };
};

export type OpnameListFilters = {
    id_toko?:         number;
    id_opname_final?: number;
    id_rab_item?:     number;
    id_instruksi_lapangan_item?: number;
    status?:          string;
    tipe_opname?:     "OPNAME" | "OPNAME_FINAL";
};

// --- Fungsi ---

/** Single Submit Opname (POST /api/opname) */
export const submitOpnameSingle = async (payload: FormData | Record<string, any>) => {
    const isFormData = payload instanceof FormData;
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/opname`, {
        method: "POST",
        headers: isFormData ? {} : { "Content-Type": "application/json" },
        body: isFormData ? payload : JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal menyimpan opname.");
    return result;
};

/** Bulk Submit Opname */
export const submitOpnameBulk = async (
    payload: FormData | {
        id_toko: number;
        email_pembuat: string;
        tipe_opname?: string;
        grand_total_opname: string;
        grand_total_rab: string;
        items: any[];
    }
) => {
    const isFormData = payload instanceof FormData;
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/opname/bulk`, {
        method: "POST",
        headers: isFormData ? {} : { "Content-Type": "application/json" },
        body: isFormData ? payload : JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(buildApiErrorMessage(result, "Gagal menyimpan opname bulk."));
    return result;
};

/** Ambil daftar Opname dengan filter opsional. */
export const fetchOpnameList = async (
    filters?: OpnameListFilters
): Promise<{ status: string; data: OpnameItem[]; instruksi_lapangan_items?: any[]; toko?: { id: number; nomor_ulok: string; lingkup_pekerjaan: string; nama_toko: string; kode_toko: string; proyek: string; cabang: string; alamat: string; nama_kontraktor: string } }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.id_toko)         params.append("id_toko", filters.id_toko.toString());
    if (filters?.id_opname_final) params.append("id_opname_final", filters.id_opname_final.toString());
    if (filters?.id_rab_item)     params.append("id_rab_item", filters.id_rab_item.toString());
    if (filters?.id_instruksi_lapangan_item) params.append("id_instruksi_lapangan_item", filters.id_instruksi_lapangan_item.toString());
    if (filters?.status)          params.append("status", filters.status);
    if (filters?.tipe_opname)     params.append("tipe_opname", filters.tipe_opname);
    const url = `${base}/api/opname${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url);
};

/** Ambil detail Opname berdasarkan ID. */
export const fetchOpnameDetail = async (
    id: number
): Promise<{ status: string; data: OpnameItem }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/opname/${id}`);
    if (res.status === 404) throw new Error(`Data opname dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal memuat detail opname (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
};

/** Download foto opname item berdasarkan ID opname item. */
export const downloadOpnameFoto = async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/opname/${id}/foto`);
    if (res.status === 404) throw new Error(`Foto opname dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal mengunduh foto opname (${res.status}): ${text.substring(0, 100)}`);
    }

    const disposition = res.headers.get("Content-Disposition");
    let filename = `OPNAME_FOTO_${id}`;
    if (disposition?.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    return true;
};

/** Update data Opname (untuk approval/rejection kontraktor atau revisi PIC). */
export const updateOpname = async (
    id: number,
    payload: Partial<{
        status: string;
        volume_akhir: number;
        selisih_volume: number;
        total_selisih: number;
        desain: string;
        kualitas: string;
        spesifikasi: string;
        catatan: string;
    }>,
    fotoFile?: File | null
): Promise<{ status: string; message: string; data: OpnameItem }> => {
    const url = `${API_URL.replace(/\/$/, "")}/api/opname/${id}`;
    let res: Response;

    if (fotoFile) {
        const form = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
            if (value !== undefined && value !== null) form.append(key, String(value));
        });
        form.append("rev_file_foto_opname", fotoFile);
        res = await fetch(url, { method: "PUT", body: form });
    } else {
        res = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    }

    const result = await res.json();
    if (res.status === 404) throw new Error("Data opname tidak ditemukan.");
    if (res.status === 422) throw new Error(result.message || "Validasi gagal.");
    if (!res.ok) throw new Error(result.message || `Gagal memperbarui opname (${res.status}).`);
    return result;
};

/** Hapus data Opname. */
export const deleteOpname = async (id: number) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/opname/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Data opname tidak ditemukan.");
    if (!res.ok) throw new Error(result.message || "Gagal menghapus data opname.");
    return result;
};

// =============================================================================
// 3b. OPNAME FINAL
// =============================================================================

/** List Opname headers */
export const fetchOpnameFinalList = async (filters?: {
    status?: string;
    aksi?: "active" | "terkunci";
    id_toko?: number;
    nomor_ulok?: string;
    cabang?: string;
    nama_kontraktor?: string;
    tipe_opname?: "OPNAME" | "OPNAME_FINAL";
}, options?: ApiRequestOptions) => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.aksi) params.append("aksi", filters.aksi);
    if (filters?.id_toko) params.append("id_toko", filters.id_toko.toString());
    if (filters?.nomor_ulok) params.append("nomor_ulok", filters.nomor_ulok);
    if (filters?.cabang) params.append("cabang", filters.cabang);
    if (filters?.nama_kontraktor) params.append("nama_kontraktor", filters.nama_kontraktor);
    if (filters?.tipe_opname) params.append("tipe_opname", filters.tipe_opname);
    const url = `${base}/api/final_opname${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url, options);
};

/** Detail Opname */
export const fetchOpnameFinalDetail = async (id: number) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/final_opname/${id}`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal memuat detail opname final (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
};

/** Kunci Opname  POST /api/final_opname/:id/kunci_opname_final */
export const kunciOpnameFinal = async (id: number, payload: {
    id_toko: number;
    email_pembuat: string;
    aksi: "terkunci";
    grand_total_opname: string;
    grand_total_rab: string;
    opname_item: any[];
}) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/final_opname/${id}/kunci_opname_final`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal mengunci opname final.");
    return result;
};

/** Approval Opname  POST /api/final_opname/:id/approval */
export const approveOpnameFinal = async (id: number, payload: {
    approver_email: string;
    jabatan: string;
    tindakan: 'APPROVE' | 'REJECT';
    alasan_penolakan?: string | null;
    catatan_approval?: string | null;
}) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/final_opname/${id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal memproses approval opname final.");
    return result;
};

/** Download PDF Opname */
export const downloadOpnameFinalPdf = async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/final_opname/${id}/pdf`);
    if (res.status === 404) throw new Error(`Data Opname dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal mengunduh PDF (${res.status}): ${text.substring(0, 100)}`);
    }

    const disposition = res.headers.get("Content-Disposition");
    let filename = `OPNAME_${id}.pdf`;
    if (disposition?.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    return true;
};


// =============================================================================
// 4. SPK  Surat Perintah Kerja
// =============================================================================

// --- Types ---

export type SPKSubmitPayload = {
    id_toko: number;
    nomor_ulok: string;
    email_pembuat: string;
    lingkup_pekerjaan: string;
    nama_kontraktor: string;
    proyek: string;
    kode_toko?: string;
    waktu_mulai: string;
    durasi: number;
    grand_total: number;
    par?: string;
    spk_manual_1?: string;
    spk_manual_2?: string;
};

export type SPKListItem = {
    id: number;
    id_toko: number;
    nomor_ulok: string;
    email_pembuat: string;
    lingkup_pekerjaan: string;
    nama_kontraktor: string;
    proyek: string;
    kode_toko?: string;
    toko?: { id?: number | null; nomor_ulok?: string; kode_toko?: string; nama_toko?: string; cabang?: string; alamat?: string };
    waktu_mulai: string;
    durasi: number;
    waktu_selesai: string;
    grand_total: number;
    terbilang: string;
    nomor_spk: string;
    par: string;
    spk_manual_1: string;
    spk_manual_2: string;
    status: string;
    link_pdf: string | null;
    approver_email: string | null;
    waktu_persetujuan: string | null;
    alasan_penolakan: string | null;
    created_at: string;
};

export type SPKApprovalLog = {
    id: number;
    pengajuan_spk_id: number;
    approver_email: string;
    tindakan: string;
    alasan_penolakan: string | null;
    waktu_tindakan: string;
};

export type SPKDetailResponse = {
    pengajuan: SPKListItem;
    approvalLogs: SPKApprovalLog[];
};

export type SPKApprovalPayload = {
    approver_email: string;
    tindakan: "APPROVE" | "REJECT";
    alasan_penolakan?: string | null;
    catatan_approval?: string | null;
};

export type SPKInterventionPayload = {
    actor_email: string;
    actor_role: string;
    target_status: "WAITING_FOR_BM_APPROVAL" | "SPK_APPROVED" | "SPK_REJECTED";
    alasan_intervensi?: string;
};

// --- Fungsi ---

/** Submit SPK baru. (Backend akan otomatis handle revisi jika ada status REJECTED sebelumnya) */
export const submitSPK = async (payload: SPKSubmitPayload) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/spk/submit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok || result.status !== "success") {
        throw new Error(result.message || "Gagal menyimpan data SPK.");
    }
    return result;
};

/** Ambil daftar SPK dengan filter opsional (Status, Nomor ULOK). */
export const fetchSPKList = async (filters?: {
    status?: string;
    nomor_ulok?: string;
    nama_kontraktor?: string;
    cabang?: string;
}, options?: ApiRequestOptions): Promise<{ status: string; data: SPKListItem[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status)     params.append("status", filters.status);
    if (filters?.nomor_ulok) params.append("nomor_ulok", filters.nomor_ulok);
    if (filters?.nama_kontraktor) params.append("nama_kontraktor", filters.nama_kontraktor);
    if (filters?.cabang) params.append("cabang", filters.cabang);
    const url = `${base}/api/spk${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url, options);
};

/** Ambil detail pengajuan SPK beserta histori log approval. */
export const fetchSPKDetail = async (
    id: number
): Promise<{ status: string; data: SPKDetailResponse }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/spk/${id}`);
    if (res.status === 404) throw new Error(`SPK dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal memuat detail SPK (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
};

/** Download PDF SPK. */
export const downloadSPKPdf = async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/spk/${id}/pdf`);
    if (res.status === 404) throw new Error(`Pengajuan SPK dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal mengunduh PDF (${res.status}): ${text.substring(0, 100)}`);
    }

    const disposition = res.headers.get("Content-Disposition");
    let filename = `SPK_${id}.pdf`;
    if (disposition?.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    return true;
};

/** Ambil daftar kontraktor untuk SPK (filter per Cabang). */
export const fetchKontraktorList = async (cabang?: string): Promise<string[]> => {
    const url = `${API_URL.replace(/\/$/, "")}/api/get_kontraktor${cabang ? `?cabang=${encodeURIComponent(cabang)}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gagal mengambil daftar kontraktor (${res.status}).`);
    return res.json(); // Returns string[] directly
};

/** Proses approval atau reject SPK (Branch Manager). */
export const processSPKApproval = async (
    id: number,
    payload: SPKApprovalPayload
): Promise<{ status: string; message: string; data: { id: number; old_status: string; new_status: string } }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/spk/${id}/approval`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Data SPK tidak ditemukan.");
    if (res.status === 409) throw new Error(result.message || "Status tidak valid untuk tindakan ini.");
    if (res.status === 422) throw new Error(result.message || "Validasi gagal. Isi alasan penolakan.");
    if (!res.ok) throw new Error(result.message || `Gagal approval SPK (${res.status}).`);
    return result;
};

/** Intervensi status SPK oleh Super Human. */
export const interveneSPKStatus = async (
    id: number,
    payload: SPKInterventionPayload
): Promise<{ status: string; message: string; data: { id: number; old_status: string; new_status: string } }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/spk/${id}/intervention`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 403) throw new Error(result.message || "Akses intervensi hanya untuk Super Human.");
    if (res.status === 404) throw new Error("Data SPK tidak ditemukan.");
    if (res.status === 409) throw new Error(result.message || "Status SPK sudah sama.");
    if (res.status === 422) throw new Error(result.message || "Validasi intervensi SPK gagal.");
    if (!res.ok) throw new Error(result.message || `Gagal melakukan intervensi SPK (${res.status}).`);
    return result;
};

// =============================================================================
// 5. PERTAMBAHAN SPK
// =============================================================================

// --- Types ---

export type PertambahanSPKPayload = {
    id_spk: number;
    pertambahan_hari: string;
    tanggal_spk_akhir: string;
    tanggal_spk_akhir_setelah_perpanjangan: string;
    alasan_perpanjangan: string;
    status_persetujuan?: string;
    dibuat_oleh: string;
    file_lampiran_pendukung?: File;
};

export type PertambahanSPKListItem = {
    id: number;
    id_spk: number;
    pertambahan_hari: string;
    tanggal_spk_akhir: string;
    tanggal_spk_akhir_setelah_perpanjangan: string;
    alasan_perpanjangan: string;
    dibuat_oleh: string;
    status_persetujuan: string;
    disetujui_oleh: string | null;
    waktu_persetujuan: string | null;
    alasan_penolakan: string | null;
    link_pdf: string | null;
    link_lampiran_pendukung: string | null;
    created_at: string;
    nomor_spk: string;
    // Optional nested data for list join
    toko?: {
        nama_toko: string;
        cabang: string;
        nomor_ulok: string;
        proyek?: string;
    };
    spk?: {
        nomor_ulok: string;
        nama_kontraktor: string;
        proyek?: string;
        nama_toko?: string;
        cabang?: string;
    };
};

export type PertambahanSPKListFilters = {
    id_spk?: number;
    status_persetujuan?: string;
};

export type PertambahanSPKDetailResponse = PertambahanSPKListItem & {
    spk?: {
        id: number;
        nomor_ulok: string;
        email_pembuat: string;
        lingkup_pekerjaan: string;
        nama_kontraktor: string;
        proyek: string;
        waktu_mulai: string;
        durasi: number;
        waktu_selesai: string;
        grand_total: number;
        terbilang: string;
        nomor_spk: string;
        par: string;
        spk_manual_1: string;
        spk_manual_2: string;
        status: string;
        link_pdf: string | null;
        approver_email: string | null;
        waktu_persetujuan: string | null;
        alasan_penolakan: string | null;
        created_at: string;
    };
    toko?: {
        id: number;
        nomor_ulok: string;
        lingkup_pekerjaan: string;
        nama_toko: string;
        kode_toko: string;
        proyek: string;
        cabang: string;
        alamat: string;
        nama_kontraktor: string;
    };
};

export type PertambahanSPKApprovalPayload = {
    approver_email: string;
    tindakan: "APPROVE" | "REJECT";
    alasan_penolakan?: string;
    catatan_approval?: string | null;
};

export type PertambahanSPKInterventionPayload = {
    actor_email: string;
    actor_role: string;
    target_status: "WAITING_FOR_BM_APPROVAL" | "APPROVED_BY_BM" | "REJECTED_BY_BM" | "Menunggu Persetujuan" | "Disetujui BM" | "Ditolak BM";
    alasan_intervensi?: string;
};

// --- Fungsi ---

/** Submit data pertambahan SPK baru.
 *  - Jika `file_lampiran_pendukung` ada  kirim sebagai multipart/form-data.
 *  - Jika tidak ada file  kirim sebagai JSON.
 */
export const submitPertambahanSPK = async (payload: PertambahanSPKPayload) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/pertambahan-spk`;
    const { file_lampiran_pendukung, ...fields } = payload;

    let res: Response;

    if (file_lampiran_pendukung) {
        // --- MODE MULTIPART: file dikirim sebagai file ---
        const form = new FormData();
        form.append("id_spk", fields.id_spk.toString());
        form.append("pertambahan_hari", fields.pertambahan_hari);
        form.append("tanggal_spk_akhir", fields.tanggal_spk_akhir);
        form.append("tanggal_spk_akhir_setelah_perpanjangan", fields.tanggal_spk_akhir_setelah_perpanjangan);
        form.append("alasan_perpanjangan", fields.alasan_perpanjangan);
        form.append("dibuat_oleh", fields.dibuat_oleh);
        form.append("file_lampiran_pendukung", file_lampiran_pendukung);

        res = await fetch(url, { method: "POST", body: form });
    } else {
        // --- MODE JSON: tanpa file ---
        res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
        });
    }

    const result = await res.json();
    if (res.status === 404) throw new Error(result.message || "SPK tidak ditemukan.");
    if (res.status === 422) throw new Error(result.message || "Validasi gagal. Pastikan semua field terisi.");
    if (!res.ok || result.status !== "success") {
        throw new Error(result.message || "Gagal menyimpan data pertambahan SPK.");
    }
    return result;
};

/** Ambil daftar pertambahan SPK dengan filter opsional. */
export const fetchPertambahanSPKList = async (
    filters?: PertambahanSPKListFilters,
    options?: ApiRequestOptions
): Promise<{ status: string; data: PertambahanSPKListItem[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.id_spk)              params.append("id_spk", filters.id_spk.toString());
    if (filters?.status_persetujuan)  params.append("status_persetujuan", filters.status_persetujuan);
    const url = `${base}/api/pertambahan-spk${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url, options);
};

/** Ambil detail pertambahan SPK berdasarkan ID. */
export const fetchPertambahanSPKDetail = async (
    id: number
): Promise<{ status: string; data: PertambahanSPKDetailResponse }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/pertambahan-spk/${id}`);
    if (res.status === 404) throw new Error(`Data pertambahan SPK dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal memuat detail pertambahan SPK (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
};

/** Update data pertambahan SPK. */
export const updatePertambahanSPK = async (
    id: number,
    payload: Partial<PertambahanSPKPayload>
) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/pertambahan-spk/${id}`;
    const { file_lampiran_pendukung, ...fields } = payload;

    let res: Response;

    // Jika user mengunggah file baru saat revisi
    if (file_lampiran_pendukung) {
        const form = new FormData();
        Object.entries(fields).forEach(([key, value]) => {
            if (value !== undefined && value !== null) form.append(key, String(value));
        });
        form.append("file_lampiran_pendukung", file_lampiran_pendukung);

        res = await fetch(url, { method: "PUT", body: form });
    } else {
        res = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
        });
    }

    const result = await res.json();
    if (res.status === 404) throw new Error("Data pertambahan SPK tidak ditemukan.");
    if (res.status === 422) throw new Error(result.message || "Validasi gagal.");
    if (!res.ok) throw new Error(result.message || `Gagal memperbarui pertambahan SPK (${res.status}).`);
    return result;
};

/** Proses approval atau reject pertambahan SPK (Branch Manager). */
export const processPertambahanSPKApproval = async (
    id: number,
    payload: PertambahanSPKApprovalPayload
): Promise<{ status: string; message: string; data: any }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/pertambahan-spk/${id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Data pertambahan SPK tidak ditemukan.");
    if (res.status === 409) throw new Error(result.message || "Data sudah pernah diproses.");
    if (res.status === 422) throw new Error(result.message || "Validasi gagal. Isi alasan penolakan.");
    if (!res.ok) throw new Error(result.message || `Gagal memproses approval (${res.status}).`);
    return result;
};

/** Intervensi status pertambahan SPK oleh Super Human. */
export const intervenePertambahanSPKStatus = async (
    id: number,
    payload: PertambahanSPKInterventionPayload
): Promise<{ status: string; message: string; data: any }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/pertambahan-spk/${id}/intervensi`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 403) throw new Error(result.message || "Akses intervensi hanya untuk Super Human.");
    if (res.status === 404) throw new Error("Data pertambahan SPK tidak ditemukan.");
    if (res.status === 409) throw new Error(result.message || "Status pertambahan SPK sudah sama.");
    if (res.status === 422) throw new Error(result.message || "Validasi intervensi pertambahan SPK gagal.");
    if (!res.ok) throw new Error(result.message || `Gagal melakukan intervensi pertambahan SPK (${res.status}).`);
    return result;
};

/** Download file lampiran pendukung dari pertambahan SPK. */
export const downloadPertambahanSPKLampiran = async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/pertambahan-spk/${id}/lampiran-pendukung`);
    if (res.status === 404) throw new Error(`Data Pertambahan SPK atau lampiran tidak ditemukan.`);
    if (res.status === 502) throw new Error(`Gagal mengambil file dari penyimpanan.`);
    if (!res.ok) {
        throw new Error(`Gagal mengunduh lampiran (${res.status}).`);
    }

    const disposition = res.headers.get("Content-Disposition");
    let filename = `Lampiran_Pertambahan_SPK_${id}`;
    if (disposition?.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
    } else {
        const contentType = res.headers.get("Content-Type");
        if (contentType?.includes("pdf")) filename += ".pdf";
        else if (contentType?.includes("png")) filename += ".png";
        else if (contentType?.includes("jpeg") || contentType?.includes("jpg")) filename += ".jpg";
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    return true;
};

/** Download PDF pertambahan SPK. */
export const downloadPertambahanSPKPdf = async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/pertambahan-spk/${id}/pdf`);
    if (res.status === 404) throw new Error("Data Pertambahan SPK atau PDF tidak ditemukan.");
    if (res.status === 502) throw new Error("Gagal mengambil PDF dari penyimpanan.");
    if (!res.ok) throw new Error(`Gagal mengunduh PDF Pertambahan SPK (${res.status}).`);

    const disposition = res.headers.get("Content-Disposition");
    let filename = `PERTAMBAHAN_SPK_${id}.pdf`;
    if (disposition?.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    return true;
};

/** Hapus data pertambahan SPK. */
export const deletePertambahanSPK = async (id: number) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/pertambahan-spk/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Data pertambahan SPK tidak ditemukan.");
    if (!res.ok) throw new Error(result.message || "Gagal menghapus pertambahan SPK.");
    return result;
};

// =============================================================================
// 6. PIC PENGAWASAN
// =============================================================================

// --- Types ---

export type PICPengawasanPayload = {
    id_toko: number;
    nomor_ulok: string;
    id_rab: number;
    id_spk: number;
    kategori_lokasi: string;
    durasi: string;
    tanggal_mulai_spk: string;
    plc_building_support: string;
    hari_pengawasan: number[];
};

export type PICPengawasanListItem = {
    id: number;
    id_toko: number;
    nomor_ulok: string;
    id_rab: number;
    id_spk: number;
    kategori_lokasi: string;
    durasi: string;
    tanggal_mulai_spk: string;
    plc_building_support: string;
    hari_pengawasan: number[];
    created_at: string;
};

export type PICPengawasanListFilters = {
    nomor_ulok?: string;
    id_rab?: number;
    id_spk?: number;
};

// --- Fungsi ---

/** Submit data PIC Pengawasan baru. */
export const submitPICPengawasan = async (payload: PICPengawasanPayload) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/pic_pengawasan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error(result.message || "Data referensi tidak ditemukan.");
    if (res.status === 409) throw new Error(result.message || "Data PIC Pengawasan untuk ULOK/RAB/SPK ini sudah ada.");
    if (res.status === 422) throw new Error(result.message || "Validasi gagal. Pastikan semua field terisi.");
    if (!res.ok || result.status !== "success") throw new Error(result.message || "Gagal menyimpan data PIC Pengawasan.");
    return result;
};

/** Ambil daftar PIC Pengawasan dengan filter opsional. */
export const fetchPICPengawasanList = async (
    filters?: PICPengawasanListFilters
): Promise<{ status: string; data: PICPengawasanListItem[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.nomor_ulok) params.append("nomor_ulok", filters.nomor_ulok);
    if (filters?.id_rab)     params.append("id_rab", filters.id_rab.toString());
    if (filters?.id_spk)     params.append("id_spk", filters.id_spk.toString());
    const url = `${base}/api/pic_pengawasan${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url);
};

// =============================================================================
// 7. INSTRUKSI LAPANGAN
// =============================================================================

export type InstruksiLapanganFilters = {
    status?: string;
    nomor_ulok?: string;
    cabang?: string;
    email_pembuat?: string;
    id_toko?: number;
};

export const fetchInstruksiLapanganList = async (
    filters?: InstruksiLapanganFilters,
    options?: ApiRequestOptions
): Promise<any> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.nomor_ulok) params.append("nomor_ulok", filters.nomor_ulok);
    if (filters?.cabang) params.append("cabang", filters.cabang);
    if (filters?.email_pembuat) params.append("email_pembuat", filters.email_pembuat);
    if (filters?.id_toko) params.append("id_toko", filters.id_toko.toString());
    const url = `${base}/api/instruksi-lapangan/list${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url, options);
};

export const fetchInstruksiLapanganDetail = async (id: number): Promise<any> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/instruksi-lapangan/${id}`);
    if (res.status === 404) throw new Error(`Data Instruksi Lapangan dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal memuat detail Instruksi Lapangan (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
};

export type InstruksiLapanganApprovalPayload = {
    approver_email: string;
    jabatan: 'KOORDINATOR' | 'MANAGER' | 'DIREKTUR' | 'DIREKTUR_KONTRAKTOR' | 'KONTRAKTOR' | string;
    tindakan: 'APPROVE' | 'REJECT';
    alasan_penolakan?: string | null;
    catatan_approval?: string | null;
};

export const processInstruksiLapanganApproval = async (
    id: number,
    payload: InstruksiLapanganApprovalPayload
): Promise<any> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/instruksi-lapangan/${id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal memproses approval Instruksi Lapangan.");
    return result;
};

export const downloadInstruksiLapanganPdf = async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/instruksi-lapangan/${id}/pdf`);
    if (!res.ok) throw new Error(`Gagal download PDF Instruksi Lapangan (${res.status})`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = `Instruksi_Lapangan_${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return true;
};

// =============================================================================
// 8. BERKAS SERAH TERIMA
// =============================================================================

export type BerkasSerahTerimaItem = {
    id: number;
    id_toko: number;
    link_pdf: string;
    created_at: string;
    toko: {
        id: number;
        nomor_ulok: string;
        lingkup_pekerjaan: string;
        nama_toko: string;
        kode_toko: string;
        proyek: string;
        cabang: string;
        alamat: string;
        nama_kontraktor: string;
    };
};

export const fetchBerkasSerahTerimaList = async (filters?: { id_toko?: number }): Promise<{ status: string; data: BerkasSerahTerimaItem[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.id_toko) params.append("id_toko", filters.id_toko.toString());
    const url = `${base}/api/berkas_serah_terima${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url);
};

/**
 * Trigger pemuatan/pembuatan PDF Berita Acara Serah Terima.
 */
export const createPdfSerahTerima = async (id_toko: number, tanggal_aktual?: string): Promise<any> => {
    const url = `${API_URL.replace(/\/$/, "")}/api/create_pdf_serah_terima`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_toko, tanggal_aktual }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal membuat PDF Serah Terima.");
    return result;
};

export const downloadSerahTerimaPdf = async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/berkas_serah_terima/${id}/pdf`);
    if (res.status === 404) throw new Error(`Berkas Serah Terima dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal mengunduh PDF (${res.status}): ${text.substring(0, 100)}`);
    }

    const disposition = res.headers.get("Content-Disposition");
    let filename = `SERAH_TERIMA_${id}.pdf`;
    if (disposition?.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    return true;
};

export const downloadPengawasanPdf = async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/pengawasan/${id}/pdf`);
    if (res.status === 404) throw new Error("Data Pengawasan atau itemnya tidak ditemukan.");
    if (!res.ok) throw new Error(`Gagal mengunduh PDF Pengawasan (${res.status}).`);

    const disposition = res.headers.get("Content-Disposition");
    let filename = `PENGAWASAN_${id}.pdf`;
    if (disposition?.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    return true;
};

export const downloadDokumentasiBangunanPdf = async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/dok/bangunan/${id}/pdf/download`);
    if (res.status === 404) throw new Error("Data Dokumentasi Bangunan tidak ditemukan.");
    if (!res.ok) throw new Error(`Gagal mengunduh PDF Dokumentasi Bangunan (${res.status}).`);

    const disposition = res.headers.get("Content-Disposition");
    let filename = `DOKUMENTASI_BANGUNAN_${id}.pdf`;
    if (disposition?.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    return true;
};

export const viewGeneratedPdfOnline = async (
    id: number,
    tipe: "OPNAME" | "OPNAME_FINAL" | "INSTRUKSI_LAPANGAN" | "PROJECT_PLANNING" | "BERKAS_SERAH_TERIMA" | "DOKUMENTASI_BANGUNAN" | "PENGAWASAN" | "PERTAMBAHAN_SPK"
): Promise<boolean> => {
    const popup = window.open("about:blank", "_blank");
    if (!popup) throw new Error("Browser memblokir tab baru. Izinkan popup untuk membuka PDF online.");

    const base = API_URL.replace(/\/$/, "");

    if (tipe === "DOKUMENTASI_BANGUNAN") {
        const res = await fetch(`${base}/api/dok/bangunan/${id}/pdf`, { method: "POST" });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || "Gagal membuat PDF Dokumentasi Bangunan.");
        const linkPdf = result?.data?.link_pdf;
        if (!linkPdf) throw new Error("Link PDF Dokumentasi Bangunan tidak tersedia.");
        popup.location.href = linkPdf;
        return true;
    }

    const endpointByType = {
        OPNAME: `/api/final_opname/${id}/pdf`,
        OPNAME_FINAL: `/api/final_opname/${id}/pdf`,
        INSTRUKSI_LAPANGAN: `/api/instruksi-lapangan/${id}/pdf`,
        PROJECT_PLANNING: `/api/projek-planning/${id}/pdf`,
        BERKAS_SERAH_TERIMA: `/api/berkas_serah_terima/${id}/pdf`,
        PENGAWASAN: `/api/pengawasan/${id}/pdf`,
        PERTAMBAHAN_SPK: `/api/pertambahan-spk/${id}/pdf`,
    } as const;

    const endpoint = endpointByType[tipe];
    const res = await fetch(`${base}${endpoint}`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal membuka PDF (${res.status}): ${text.substring(0, 100)}`);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    popup.location.href = blobUrl;
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    return true;
};

// =============================================================================
// 9. DOKUMENTASI BANGUNAN
// =============================================================================

export type DokumentasiBangunanItem = {
    id: number;
    id_dokumentasi_bangunan: number;
    link_foto: string;
    created_at: string;
};

export type DokumentasiBangunanData = {
    id: number;
    jenis_toko: "REGULAR" | "FRANCHISE";
    nomor_ulok: string;
    nama_toko: string;
    kode_toko: string;
    cabang: string;
    tanggal_go: string;
    tanggal_serah_terima: string;
    tanggal_ambil_foto: string;
    spk_awal: string;
    spk_akhir: string;
    kontraktor_sipil: string;
    kontraktor_me: string;
    link_pdf: string;
    email_pengirim: string;
    status_validasi: string;
    alasan_revisi: string;
    pic_dokumentasi: string;
    created_at: string;
};

export type DokumentasiBangunanResponse = {
    dokumentasi: DokumentasiBangunanData;
    items: DokumentasiBangunanItem[];
    pdf?: {
        link_pdf: string;
        filename: string;
        item_count: number;
    };
};

export const fetchDokumentasiBangunanList = async (filters?: {
    cabang?: string;
    kode_toko?: string;
    nomor_ulok?: string;
}): Promise<{ status: string; data: DokumentasiBangunanData[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.cabang) params.append("cabang", filters.cabang);
    if (filters?.kode_toko) params.append("kode_toko", filters.kode_toko);
    if (filters?.nomor_ulok) params.append("nomor_ulok", filters.nomor_ulok);
    
    const url = `${base}/api/dok/bangunan${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url);
};

export const fetchDokumentasiBangunanDetail = async (id: number): Promise<{ status: string; data: DokumentasiBangunanResponse }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/dok/bangunan/${id}`);
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
    new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Gagal memproses gambar."));
        }, type, quality);
    });

const compressImageUrlToBlob = async (
    url: string,
    options: { maxWidth?: number; quality?: number } = {}
): Promise<Blob> => {
    const maxWidth = options.maxWidth ?? 1280;
    const quality = options.quality ?? 0.68;

    const response = await fetch(url);
    const originalBlob = await response.blob();

    if (!originalBlob.type.startsWith("image/")) {
        return originalBlob;
    }

    const objectUrl = URL.createObjectURL(originalBlob);
    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Gagal membaca gambar."));
            img.src = objectUrl;
        });

        const ratio = image.width > maxWidth ? maxWidth / image.width : 1;
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return originalBlob;
        ctx.drawImage(image, 0, 0, width, height);

        return canvasToBlob(canvas, "image/jpeg", quality);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};

export const submitDokumentasiBangunan = async (
    fields: Record<string, string>,
    photos: Record<number, { url: string; note: string | null; timestamp: string }>
) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/dok/bangunan`;
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) form.append(key, value);
    });

    // Convert photos dataUrl to Blob/File
    for (const [idStr, data] of Object.entries(photos)) {
        if (data.url.startsWith('data:') || data.url.startsWith('/')) {
            const blob = await compressImageUrlToBlob(data.url);
            // Documentation requires foto_items_1, foto_items_2, etc.
            form.append(`foto_items_${idStr}`, blob, `photo_${idStr}.jpg`);
        }
    }

    let res: Response;
    try {
        res = await fetch(url, { method: "POST", body: form });
    } catch {
        throw new Error("Gagal mengirim dokumentasi. Periksa koneksi internet atau coba ulang dengan jaringan yang lebih stabil.");
    }

    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || "Gagal menyimpan Dokumentasi Bangunan.");
    return result;
};

export const updateDokumentasiBangunan = async (
    id: number,
    fields: Record<string, string>,
    photos?: Record<number, { url: string; note: string | null; timestamp: string }>
) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/dok/bangunan/${id}`;
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) form.append(key, value);
    });

    if (photos) {
        for (const [idStr, data] of Object.entries(photos)) {
            if (data.url.startsWith('data:')) {
                const res = await fetch(data.url);
                const blob = await res.blob();
                form.append("foto", blob, `photo_${idStr}.jpg`);
            }
        }
    }

    const res = await fetch(url, { method: "PUT", body: form });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal memperbarui Dokumentasi Bangunan.");
    return result;
};

export const deleteDokumentasiBangunan = async (id: number) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/dok/bangunan/${id}`;
    const res = await fetch(url, { method: "DELETE" });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal menghapus Dokumentasi Bangunan.");
    return result;
};

export const addDokumentasiBangunanItems = async (
    id: number,
    photos: Record<number, { url: string; note: string | null; timestamp: string }>
) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/dok/bangunan/${id}/items`;
    const form = new FormData();
    
    for (const [idStr, data] of Object.entries(photos)) {
        if (data.url.startsWith('data:')) {
            const res = await fetch(data.url);
            const blob = await res.blob();
            form.append("foto", blob, `photo_${idStr}.jpg`);
        }
    }

    const res = await fetch(url, { method: "POST", body: form });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal menambah foto Dokumentasi Bangunan.");
    return result;
};

export const deleteDokumentasiBangunanItem = async (itemId: number) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/dok/bangunan/items/${itemId}`;
    const res = await fetch(url, { method: "DELETE" });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal menghapus foto Dokumentasi Bangunan.");
    return result;
};

export const generateDokumentasiBangunanPdf = async (id: number) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/dok/bangunan/${id}/pdf`;
    const res = await fetch(url, { method: "POST" });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal membuat ulang PDF Dokumentasi Bangunan.");
    return result;
};

// =============================================================================
// DASHBOARD  â€” Monitoring Transaksi ULOK
// =============================================================================

/**
 * GET /api/dashboard?search=...&id=...
 * Mengambil satu data toko + seluruh relasi turunan (RAB, Gantt, SPK, dll).
 */
export const fetchDashboardSingle = async (params: { search?: string; id?: number }) => {
    const query = new URLSearchParams();
    if (params.id) query.append("id", String(params.id));
    else if (params.search) query.append("search", params.search);
    
    const url = `${API_URL.replace(/\/$/, "")}/api/dashboard?${query.toString()}`;
    return safeFetchJSON(url);
};

/**
 * GET /api/dashboard/all?search=...
 * Mengambil semua data toko + seluruh relasi turunan.
 */
export const fetchDashboardAll = async (search?: string) => {
    let url = `${API_URL.replace(/\/$/, "")}/api/dashboard/all`;
    if (search) url += `?search=${encodeURIComponent(search)}`;
    return safeFetchJSON(url);
};

export type DashboardExportFormat = "xlsx" | "csv" | "pdf";

export const downloadDashboardExport = async (params: {
    format: DashboardExportFormat;
    actorRole: string;
    actorCabang: string;
    cabang?: string;
    search?: string;
}): Promise<boolean> => {
    const query = new URLSearchParams();
    query.set("format", params.format);
    query.set("actor_role", params.actorRole);
    query.set("actor_cabang", params.actorCabang);
    if (params.cabang && params.cabang !== "ALL") query.set("cabang", params.cabang);
    if (params.search?.trim()) query.set("search", params.search.trim());

    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/dashboard/export?${query.toString()}`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal mengunduh export (${res.status}): ${text.substring(0, 160)}`);
    }

    const disposition = res.headers.get("Content-Disposition");
    const fallbackExt = params.format === "xlsx" ? "xlsx" : params.format;
    let filename = `SPARTA_DASHBOARD_EXPORT.${fallbackExt}`;
    if (disposition?.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    return true;
};

// =============================================================================
// PENYIMPANAN DOKUMEN TOKO
// =============================================================================

// --- Types ---

export type PenyimpananDokumenItem = {
    id:              number;
    id_toko?:        number | null;
    kode_toko?:      string | null;
    nama_dokumen:    string;
    drive_file_id:   string | null;
    drive_folder_id: string | null;
    link_dokumen:    string | null;
    link_folder:     string | null;
    nama_toko?:      string | null;
    cabang?:         string | null;
    kategori_dokumen?: string | null;
    source_timestamp?: string | null;
    source_last_edit?: string | null;
    migrated_at?:    string | null;
    created_at:      string;
};

export type PenyimpananDokumenListFilters = {
    nama_dokumen?:  string;
    kode_toko?:     string;
    nama_toko?:     string;
    cabang?:        string;
};

export type PenyimpananDokumenMigrationResult = {
    totalRows: number;
    rowsWithFiles: number;
    emptyFileRows: number;
    parsedStores?: number;
    parsedDocuments: number;
    insertedStores?: number;
    skippedStoreDuplicates?: number;
    inserted?: number;
    skippedDuplicates?: number;
    unparsedRows: Array<{ rowNumber: number; kode_toko: string | null; reason: string }>;
    categoryCounts: Record<string, number>;
    sourceCategoryCounts: Record<string, number>;
    sample: Array<Partial<PenyimpananDokumenItem> & {
        kategori_dokumen: string;
        nama_dokumen: string;
        link_dokumen: string;
    }>;
};

export type PenyimpananDokumenArchiveStore = {
    nomor_ulok?: string | null;
    kode_toko: string | null;
    nama_toko: string | null;
    cabang: string | null;
    proyek?: string | null;
    jumlah_dokumen: number;
    kategori_counts?: Record<string, number>;
    last_created_at: string | null;
};

// --- Fungsi ---

/** List dokumen penyimpanan (GET /api/doc/penyimpanan-dokumen) */
export const fetchPenyimpananDokumenList = async (
    filters?: PenyimpananDokumenListFilters,
    options?: ApiRequestOptions
): Promise<{ status: string; data: PenyimpananDokumenItem[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.nama_dokumen) params.append("nama_dokumen", filters.nama_dokumen);
    if (filters?.kode_toko) params.append("kode_toko", filters.kode_toko);
    if (filters?.nama_toko) params.append("nama_toko", filters.nama_toko);
    if (filters?.cabang) params.append("cabang", filters.cabang);
    const url = `${base}/api/doc/penyimpanan-dokumen${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url, options);
};

export const fetchPenyimpananDokumenArchiveStores = async (search: string): Promise<{ status: string; data: PenyimpananDokumenArchiveStore[] }> => {
    const params = new URLSearchParams();
    if (search.trim()) params.append("search", search.trim());
    const suffix = params.toString() ? `?${params}` : "";
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/doc/penyimpanan-dokumen/archive-stores${suffix}`);
};

export const createPenyimpananDokumenArchiveStore = async (payload: {
    nomor_ulok?: string;
    kode_toko: string;
    nama_toko: string;
    cabang: string;
    proyek?: string;
    folder_link?: string;
}): Promise<{ status: string; message: string; data: PenyimpananDokumenArchiveStore }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/doc/penyimpanan-dokumen/archive-stores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 422) throw new Error(result.message || "Validasi request gagal.");
    if (!res.ok) throw new Error(result.message || "Gagal menyimpan data toko.");
    return result;
};

const postPenyimpananDokumenMigration = async (
    endpoint: "migration-preview" | "migration-commit",
    file: File,
    actorRole: string,
    actorEmail?: string
): Promise<{ status: string; message: string; data: PenyimpananDokumenMigrationResult }> => {
    const form = new FormData();
    form.append("actor_role", actorRole);
    if (actorEmail) form.append("actor_email", actorEmail);
    form.append("excel", file);

    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/doc/penyimpanan-dokumen/${endpoint}`, {
        method: "POST",
        body: form,
    });
    const result = await res.json();
    if (res.status === 403) throw new Error(result.message || "Hanya Super Human yang bisa migrasi dokumen.");
    if (res.status === 400) throw new Error(result.message || "File Excel tidak valid.");
    if (!res.ok) throw new Error(result.message || "Gagal memproses migrasi dokumen.");
    return result;
};

export const previewPenyimpananDokumenMigration = async (file: File, actorRole: string, actorEmail?: string) =>
    postPenyimpananDokumenMigration("migration-preview", file, actorRole, actorEmail);

export const commitPenyimpananDokumenMigration = async (file: File, actorRole: string, actorEmail?: string) =>
    postPenyimpananDokumenMigration("migration-commit", file, actorRole, actorEmail);

/** Detail dokumen penyimpanan (GET /api/doc/penyimpanan-dokumen/:id) */
export const fetchPenyimpananDokumenDetail = async (
    id: number
): Promise<{ status: string; data: PenyimpananDokumenItem }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/doc/penyimpanan-dokumen/${id}`);
};

/** Upload dokumen penyimpanan â€” bulk (POST /api/doc/penyimpanan-dokumen) */
export const uploadPenyimpananDokumen = async (
    payload: {
        id_toko?: number;
        kode_toko?: string;
        nama_toko?: string;
        cabang?: string;
        nama_dokumen: string;
        folder_name?: string;
    },
    files: File[]
): Promise<any> => {
    const form = new FormData();
    if (payload.id_toko) form.append("id_toko", payload.id_toko.toString());
    if (payload.kode_toko) form.append("kode_toko", payload.kode_toko);
    if (payload.nama_toko) form.append("nama_toko", payload.nama_toko);
    if (payload.cabang) form.append("cabang", payload.cabang);
    form.append("nama_dokumen", payload.nama_dokumen);
    if (payload.folder_name) form.append("folder_name", payload.folder_name);
    files.forEach((file, i) => form.append(`dokumen_${i + 1}`, file));

    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/doc/penyimpanan-dokumen`, {
        method: "POST", body: form,
    });
    const result = await res.json();
    if (res.status === 400) throw new Error(result.message || "Dokumen wajib diupload.");
    if (res.status === 404) throw new Error(result.message || "Toko tidak ditemukan.");
    if (res.status === 422) throw new Error(result.message || "Validasi request gagal.");
    if (!res.ok) throw new Error(result.message || "Gagal mengupload dokumen.");
    return result;
};

/** Update dokumen penyimpanan (PUT /api/doc/penyimpanan-dokumen/:id) */
export const updatePenyimpananDokumen = async (
    id: number,
    payload: { nama_dokumen?: string },
    file?: File | null
): Promise<any> => {
    const form = new FormData();
    if (payload.nama_dokumen) form.append("nama_dokumen", payload.nama_dokumen);
    if (file) form.append("dokumen", file);

    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/doc/penyimpanan-dokumen/${id}`, {
        method: "PUT", body: form,
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Dokumen tidak ditemukan.");
    if (!res.ok) throw new Error(result.message || "Gagal memperbarui dokumen.");
    return result;
};

/** Hapus dokumen penyimpanan (DELETE /api/doc/penyimpanan-dokumen/:id) */
export const deletePenyimpananDokumen = async (id: number): Promise<any> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/doc/penyimpanan-dokumen/${id}`, {
        method: "DELETE",
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Dokumen tidak ditemukan.");
    if (!res.ok) throw new Error(result.message || "Gagal menghapus dokumen.");
    return result;
};

// =============================================================================
// EMAIL NOTIFICATION
// =============================================================================

/**
 * Mengirim email notifikasi
 * @param payload - Data notifikasi (cabang dan flag)
 */
export const sendEmailNotification = async (payload: {
    cabang: string;
    id_toko?: number | string;
    id_spk?: number | string;
    flag: string;
}) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/send-email-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok || result.status !== "success") {
        throw new Error(result.message || "Gagal mengirim email notifikasi.");
    }
    return result;
};

// =============================================================================
// PROJECT PLANNING (FPD — Form Permintaan Desain)
// =============================================================================

// --- Types ---

export type ProjekPlanningItem = {
    id: number;
    id_toko: number;
    nomor_ulok: string;
    email_pembuat: string;
    nama_toko: string | null;
    kode_toko: string | null;
    cabang: string | null;
    proyek: string | null;
    lingkup_pekerjaan: string | null;
    jenis_proyek: string | null;
    estimasi_biaya: string | null;
    keterangan: string | null;
    nama_pengaju: string | null;
    nama_lokasi: string | null;
    jenis_pengajuan: string | null;
    jenis_pengajuan_lainnya: string | null;
    fasilitas_air_bersih: boolean;
    fasilitas_air_bersih_keterangan: string | null;
    fasilitas_drain: boolean;
    fasilitas_drain_keterangan: string | null;
    fasilitas_ac: boolean;
    fasilitas_ac_keterangan: string | null;
    fasilitas_lainnya: string | null;
    fasilitas_lainnya_keterangan: string | null;
    ketentuan_1: string | null;
    ketentuan_2: string | null;
    ketentuan_3: string | null;
    ketentuan_4: string | null;
    ketentuan_5: string | null;
    catatan_design_1: string | null;
    catatan_design_2: string | null;
    catatan_design_3: string | null;
    catatan_design_4: string | null;
    catatan_design_5: string | null;
    link_fpd: string | null;
    link_rab: string | null;
    link_gambar_kerja: string | null;
    link_desain_3d: string | null;
    link_fpd_approved: string | null;
    link_gambar_kompetitor: string | null;
    link_google_maps: string | null;
    link_siteplan?: string | null;
    link_rab_sipil: string | null;
    link_rab_me: string | null;
    link_gambar_kerja_final_sipil?: string | null;
    link_gambar_kerja_final_me?: string | null;
    link_pdf: string | null;
    is_ruko: boolean;
    jumlah_lantai: number | null;
    status: string;
    butuh_desain_3d: boolean;
    is_head_to_head: boolean;
    jarak_head_to_head?: string | number | null;
    is_seating_area: boolean;
    is_dark_store: boolean;
    beanspot_tipe: string | null;
    bm_approver_email: string | null;
    bm_waktu_persetujuan: string | null;
    bm_alasan_penolakan: string | null;
    bm2_approver_email?: string | null;
    bm2_waktu_persetujuan?: string | null;
    bm2_alasan_penolakan?: string | null;
    pp1_approver_email: string | null;
    pp1_waktu_persetujuan: string | null;
    pp1_alasan_penolakan: string | null;
    pp_manager_approver_email: string | null;
    pp_manager_waktu_persetujuan: string | null;
    pp_manager_alasan_penolakan: string | null;
    pp2_approver_email: string | null;
    pp2_waktu_persetujuan: string | null;
    pp2_alasan_penolakan: string | null;
    id_rab_sipil?: number | null;
    id_rab_me?: number | null;
    luas_bangunan?: string | null;
    luas_area_terbuka?: string | null;
    luas_area_terbangun?: string | null;
    luas_gudang?: string | null;
    luas_area_parkir?: string | null;
    luas_area_sales?: string | null;
    pxl_bangunan?: string | null;
    pxl_area_parkir?: string | null;
    pp2_rab_status?: string | null;
    pp2_gambar_status?: string | null;
    pp2_rab_rejected_item_ids?: number[] | null;
    pp2_rab_rejected_item_notes?: string | null;
    pp_manager_rab_status?: string | null;
    pp_manager_gambar_status?: string | null;
    pp_manager_rab_rejected_item_ids?: number[] | null;
    pp_manager_rab_rejected_item_notes?: string | null;
    fasilitas?: {
        id?: number;
        jenis_fasilitas: string;
        nama_fasilitas_lainnya?: string;
        is_tersedia: boolean;
        keterangan?: string;
    }[];
    ketentuan?: { id?: number; isi_ketentuan: string }[];
    catatan_design?: { id?: number; isi_catatan: string }[];
    // Additional fields returned by detail endpoint
    alamat_toko?: string | null;
    foto_items?: { id?: number; item_index: number; link_foto: string }[];
    created_at: string;
    updated_at: string;
};

export type ProjekPlanningLog = {
    id: number;
    projek_planning_id: number;
    actor_email: string;
    role: string;
    aksi: string;
    status_sebelum: string | null;
    status_sesudah: string | null;
    alasan_penolakan: string | null;
    keterangan: string | null;
    created_at: string;
};

export type ProjekPlanningDetail = {
    projek: ProjekPlanningItem;
    logs: ProjekPlanningLog[];
};

export type ProjekPlanningListFilters = {
    status?: string;
    nomor_ulok?: string;
    cabang?: string;
    email_pembuat?: string;
    id_toko?: number;
};

export type ProjekPlanningTaskCounts = {
    approval: number;
    projectPlanning: number;
    total: number;
};

export type ProjectPlanningInterventionPayload = {
    actor_email: string;
    actor_role: string;
    target_status:
        | "DRAFT"
        | "WAITING_BM_APPROVAL"
        | "WAITING_PP_APPROVAL_1"
        | "PP_DESIGN_3D_REQUIRED"
        | "WAITING_RAB_UPLOAD"
        | "WAITING_BM_APPROVAL_2"
        | "WAITING_PP_MANAGER_APPROVAL"
        | "WAITING_PP_APPROVAL_2"
        | "COMPLETED"
        | "REJECTED";
    alasan_intervensi: string;
};

// --- Fungsi ---

/** Submit FPD baru (Coordinator/Cabang). */
export const submitProjekPlanning = async (
    payload: Record<string, unknown>, 
    fileFpd?: File | File[], 
    fileGambarKerjaMe?: File | File[],
    fileGambarKompetitor?: File | File[],
    fileSiteplan?: File | File[],
    fotoFiles?: { [key: number]: File }
) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/projek-planning/submit`;

    let body: BodyInit;
    const headers: Record<string, string> = {};

    const hasPhotos = fotoFiles && Object.keys(fotoFiles).length > 0;

    const appendFiles = (formData: FormData, field: string, fileOrFiles?: File | File[]) => {
        const files = Array.isArray(fileOrFiles) ? fileOrFiles : fileOrFiles ? [fileOrFiles] : [];
        files.slice(0, 2).forEach(file => formData.append(field, file));
    };

    if ((Array.isArray(fileFpd) ? fileFpd.length > 0 : !!fileFpd) || (Array.isArray(fileGambarKerjaMe) ? fileGambarKerjaMe.length > 0 : !!fileGambarKerjaMe) || (Array.isArray(fileGambarKompetitor) ? fileGambarKompetitor.length > 0 : !!fileGambarKompetitor) || (Array.isArray(fileSiteplan) ? fileSiteplan.length > 0 : !!fileSiteplan) || hasPhotos) {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
            if (value !== undefined && value !== null) formData.append(key, String(value));
        });
        appendFiles(formData, "file_fpd", fileFpd);
        appendFiles(formData, "file_gambar_kerja_me", fileGambarKerjaMe);
        appendFiles(formData, "file_gambar_kompetitor", fileGambarKompetitor);
        appendFiles(formData, "file_siteplan", fileSiteplan);
        
        if (fotoFiles) {
            Object.entries(fotoFiles).forEach(([index, file]) => {
                if (file) formData.append(`foto_items_${index}`, file);
            });
        }
        
        body = formData;
    } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(payload);
    }

    const res = await fetch(url, {
        method: "POST",
        headers,
        body,
    });
    const result = await res.json();
    if (res.status === 409) throw new Error(result.message || "Project planning aktif sudah ada untuk toko ini.");
    if (res.status === 422) {
        const issuesMsg = result.issues ? result.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join(", ") : "";
        throw new Error((result.message || "Validasi gagal. Pastikan seluruh form terisi.") + (issuesMsg ? ` (${issuesMsg})` : ""));
    }
    if (!res.ok) throw new Error(result.message || "Gagal menyimpan pengajuan.");
    return result;
};

/** Resubmit FPD (Coordinator — update record DRAFT). */
export const resubmitProjekPlanning = async (
    id: number, 
    payload: Record<string, unknown>, 
    fileFpd?: File | File[], 
    fileGambarKerjaMe?: File | File[],
    fileGambarKompetitor?: File | File[],
    fileSiteplan?: File | File[],
    fotoFiles?: { [key: number]: File }
) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/projek-planning/${id}/resubmit`;

    let body: BodyInit;
    const headers: Record<string, string> = {};

    const hasPhotos = fotoFiles && Object.keys(fotoFiles).length > 0;

    const appendFiles = (formData: FormData, field: string, fileOrFiles?: File | File[]) => {
        const files = Array.isArray(fileOrFiles) ? fileOrFiles : fileOrFiles ? [fileOrFiles] : [];
        files.slice(0, 2).forEach(file => formData.append(field, file));
    };

    if ((Array.isArray(fileFpd) ? fileFpd.length > 0 : !!fileFpd) || (Array.isArray(fileGambarKerjaMe) ? fileGambarKerjaMe.length > 0 : !!fileGambarKerjaMe) || (Array.isArray(fileGambarKompetitor) ? fileGambarKompetitor.length > 0 : !!fileGambarKompetitor) || (Array.isArray(fileSiteplan) ? fileSiteplan.length > 0 : !!fileSiteplan) || hasPhotos) {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
            if (value !== undefined && value !== null) formData.append(key, String(value));
        });
        appendFiles(formData, "file_fpd", fileFpd);
        appendFiles(formData, "file_gambar_kerja_me", fileGambarKerjaMe);
        appendFiles(formData, "file_gambar_kompetitor", fileGambarKompetitor);
        appendFiles(formData, "file_siteplan", fileSiteplan);
        
        if (fotoFiles) {
            Object.entries(fotoFiles).forEach(([index, file]) => {
                if (file) formData.append(`foto_items_${index}`, file);
            });
        }
        
        body = formData;
    } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(payload);
    }

    const res = await fetch(url, {
        method: "POST",
        headers,
        body,
    });
    const result = await res.json();
    if (res.status === 409) throw new Error(result.message || "Hanya DRAFT yang bisa di-resubmit.");
    if (res.status === 422) {
        const issuesMsg = result.issues ? result.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join(", ") : "";
        throw new Error((result.message || "Validasi gagal.") + (issuesMsg ? ` (${issuesMsg})` : ""));
    }
    if (!res.ok) throw new Error(result.message || "Gagal mengajukan ulang.");
    return result;
};

/** Ambil daftar Project Planning. */
export const fetchProjekPlanningList = async (
    filters?: ProjekPlanningListFilters,
    options?: ApiRequestOptions
): Promise<{ status: string; data: ProjekPlanningItem[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.nomor_ulok) params.append("nomor_ulok", filters.nomor_ulok);
    if (filters?.cabang) params.append("cabang", filters.cabang);
    if (filters?.email_pembuat) params.append("email_pembuat", filters.email_pembuat);
    if (filters?.id_toko) params.append("id_toko", filters.id_toko.toString());
    const url = `${base}/api/projek-planning${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url, options);
};

export const fetchProjekPlanningTaskCounts = async (params: {
    roles: string[];
    cabang?: string;
    email?: string;
}): Promise<{ status: string; data: ProjekPlanningTaskCounts }> => {
    const base = API_URL.replace(/\/$/, "");
    const query = new URLSearchParams();
    if (params.roles.length > 0) query.append("roles", params.roles.join(","));
    if (params.cabang) query.append("cabang", params.cabang);
    if (params.email) query.append("email", params.email);

    const res = await fetch(`${base}/api/projek-planning/task-counts?${query.toString()}`);
    if (!res.ok) {
        return {
            status: "error",
            data: { approval: 0, projectPlanning: 0, total: 0 },
        };
    }

    return res.json();
};

/** Ambil detail Project Planning berdasarkan ID. */
export const fetchProjekPlanningDetail = async (
    id: number
): Promise<{ status: string; data: ProjekPlanningDetail }> => {
    const url = `${API_URL.replace(/\/$/, "")}/api/projek-planning/${id}`;
    const res = await fetch(url);
    if (res.status === 404) throw new Error("Project planning tidak ditemukan.");
    if (!res.ok) throw new Error(`Gagal memuat detail (${res.status})`);
    return res.json();
};

/** Ambil logs / audit trail Project Planning. */
export const fetchProjekPlanningLogs = async (
    id: number
): Promise<{ status: string; data: ProjekPlanningLog[] }> => {
    return safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/projek-planning/${id}/logs`);
};

export const interveneProjekPlanningStatus = async (
    id: number,
    payload: ProjectPlanningInterventionPayload
): Promise<{ status: string; message: string; data: { id: number; old_status: string; new_status: string } }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/projek-planning/${id}/intervention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error(result.message || "Project Planning tidak ditemukan.");
    if (res.status === 409) throw new Error(result.message || "Status Project Planning sudah sama.");
    if (res.status === 422) throw new Error(result.message || "Validasi intervensi Project Planning gagal.");
    if (!res.ok) throw new Error(result.message || `Gagal melakukan intervensi Project Planning (${res.status}).`);
    return result;
};

/**
 * Download PDF Project Planning ke browser.
 * Nama file diambil dari header Content-Disposition jika tersedia.
 */
export const downloadProjekPlanningPdf = async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/projek-planning/${id}/pdf`);
    if (res.status === 404) throw new Error(`Project Planning dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal mengunduh PDF (${res.status}): ${text.substring(0, 100)}`);
    }

    const disposition = res.headers.get("Content-Disposition");
    let filename = `Project_Planning_${id}.pdf`;
    if (disposition?.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    return true;
};

/**
 * Proxy file dari GDrive melalui backend OAuth.
 * mode: "view" = buka di tab baru (inline), "download" = download langsung
 */
export const proxyProjekPlanningFile = async (
    id: number,
    field: string,
    mode: "view" | "download" = "view",
    itemIndex?: number
): Promise<void> => {
    let url = `${API_URL.replace(/\/$/, "")}/api/projek-planning/${id}/proxy-file?field=${field}&mode=${mode}`;
    if (itemIndex !== undefined) url += `&item_index=${itemIndex}`;

    const res = await fetch(url);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal mengambil file (${res.status}): ${text.substring(0, 100)}`);
    }

    const contentType = res.headers.get("Content-Type") || "application/octet-stream";
    const disposition = res.headers.get("Content-Disposition") || "";
    let filename = `file_${field}_${id}`;
    const fnMatch = disposition.match(/filename="?([^";\n]+)"?/);
    if (fnMatch?.[1]) filename = decodeURIComponent(fnMatch[1]);

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    if (mode === "view" && (contentType.startsWith("image/") || contentType === "application/pdf")) {
        window.open(blobUrl, "_blank");
    } else {
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
};

/** Proses approval BM Manager. */
export const processBmApproval = async (id: number, payload: {
    approver_email: string;
    tindakan: "APPROVE" | "REJECT";
    catatan?: string;
    alasan_penolakan?: string;
}) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/projek-planning/${id}/bm-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal memproses approval BM.");
    return result;
};

/** Proses approval PP Specialist (Stage 1). */
export const processPpApproval1 = async (id: number, payload: {
    approver_email: string;
    tindakan: "APPROVE" | "REJECT";
    butuh_desain_3d?: boolean;
    catatan?: string;
    alasan_penolakan?: string;
}) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/projek-planning/${id}/pp-approval-1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal memproses approval PP.");
    return result;
};

/** Upload desain 3D (PP Specialist). */
export const uploadDesain3d = async (id: number, payload: {
    uploader_email: string;
    link_desain_3d?: string;
    keterangan?: string;
}, file?: File) => {
    let body: BodyInit;
    const headers: Record<string, string> = {};

    if (file) {
        const formData = new FormData();
        formData.append("uploader_email", payload.uploader_email);
        if (payload.link_desain_3d) formData.append("link_desain_3d", payload.link_desain_3d);
        if (payload.keterangan) formData.append("keterangan", payload.keterangan);
        formData.append("file_desain_3d", file);
        body = formData;
    } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(payload);
    }

    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/projek-planning/${id}/upload-3d`, {
        method: "POST",
        headers,
        body,
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal upload desain 3D.");
    return result;
};

/** Upload RAB Sipil, RAB ME & Gambar Kerja (Coordinator/Cabang). */
export const uploadRabGambarKerja = async (id: number, payload: {
    uploader_email: string;
    link_rab_sipil?: string;
    link_rab_me?: string;
    link_gambar_kerja?: string;
    link_gambar_kerja_final_sipil?: string;
    link_gambar_kerja_final_me?: string;
    id_rab_sipil?: number;
    id_rab_me?: number;
    fasilitas?: {
        jenis_fasilitas: string;
        nama_fasilitas_lainnya?: string;
        is_tersedia: boolean;
        keterangan?: string;
    }[];
    keterangan?: string;
}, fileGambarSipil?: File | File[], fileGambarMe?: File | File[]) => {
    let body: BodyInit;
    const headers: Record<string, string> = {};

    const appendFiles = (formData: FormData, field: string, fileOrFiles?: File | File[]) => {
        const files = Array.isArray(fileOrFiles) ? fileOrFiles : fileOrFiles ? [fileOrFiles] : [];
        files.slice(0, 2).forEach(file => formData.append(field, file));
    };
    const hasFiles = [fileGambarSipil, fileGambarMe].some(fileOrFiles => Array.isArray(fileOrFiles) ? fileOrFiles.length > 0 : !!fileOrFiles);

    if (hasFiles) {
        const formData = new FormData();
        formData.append("uploader_email", payload.uploader_email);
        if (payload.link_rab_sipil) formData.append("link_rab_sipil", payload.link_rab_sipil);
        if (payload.link_rab_me) formData.append("link_rab_me", payload.link_rab_me);
        if (payload.id_rab_sipil) formData.append("id_rab_sipil", String(payload.id_rab_sipil));
        if (payload.id_rab_me) formData.append("id_rab_me", String(payload.id_rab_me));
        if (payload.link_gambar_kerja) formData.append("link_gambar_kerja", payload.link_gambar_kerja);
        if (payload.link_gambar_kerja_final_sipil) formData.append("link_gambar_kerja_final_sipil", payload.link_gambar_kerja_final_sipil);
        if (payload.link_gambar_kerja_final_me) formData.append("link_gambar_kerja_final_me", payload.link_gambar_kerja_final_me);
        if (payload.fasilitas) formData.append("fasilitas", JSON.stringify(payload.fasilitas));
        if (payload.keterangan) formData.append("keterangan", payload.keterangan);
        appendFiles(formData, "file_gambar_kerja_final_sipil", fileGambarSipil);
        appendFiles(formData, "file_gambar_kerja_final_me", fileGambarMe);
        body = formData;
    } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(payload);
    }

    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/projek-planning/${id}/upload-rab`, {
        method: "POST",
        headers,
        body,
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal upload RAB.");
    return result;
};

/** Proses approval PP Manager. */
export const processPpManagerApproval = async (id: number, payload: {
    approver_email: string;
    rab_tindakan: "APPROVE" | "REJECT";
    gambar_tindakan: "APPROVE" | "REJECT";
    catatan?: string;
    alasan_penolakan?: string;
    rab_rejected_item_ids?: number[];
    rab_rejected_item_notes?: string;
}) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/projek-planning/${id}/pp-manager-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal memproses approval PP Manager.");
    return result;
};

/** Proses approval PP Specialist (Stage 2 / Final). */
export const processPpApproval2 = async (id: number, payload: {
    approver_email: string;
    rab_tindakan: "APPROVE" | "REJECT";
    gambar_tindakan: "APPROVE" | "REJECT";
    catatan?: string;
    alasan_penolakan?: string;
    rab_rejected_item_ids?: number[];
    rab_rejected_item_notes?: string;
}) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/projek-planning/${id}/pp-approval-2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal memproses approval final PP.");
    return result;
};
