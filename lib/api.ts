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

// =============================================================================
// 1. GLOBAL  FETCH HELPER
// =============================================================================

/**
 * Wrapper fetch yang secara otomatis:
 * - Memvalidasi Content-Type respons (harus JSON)
 * - Melempar error yang informatif jika respons gagal
 * - Menghindari crash saat server mengembalikan HTML (misalnya halaman error nginx)
 */
export const safeFetchJSON = async (url: string, options?: RequestInit) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type");

    if (contentType?.includes("application/json")) {
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || `Error Server (${res.status})`);
        }
        return res.json();
    }

    const text = await res.text();
    console.error("Server mengembalikan non-JSON:", text);
    throw new Error(`Endpoint salah atau tidak ditemukan (Status ${res.status}).`);
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

export type RABDetailResponse = {
    rab:   RABDetailData;
    toko:  RABDetailToko;
    items: RABDetailItem[];
};

export type RABApprovalPayload = {
    approver_email:   string;
    jabatan:          "KOORDINATOR" | "MANAGER" | "DIREKTUR" | string;
    tindakan:         "APPROVE" | "REJECT" | string;
    alasan_penolakan?: string | null;
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
    return res.json();
};

/** Ambil daftar User Cabang (PIC) */
export const fetchUserCabangList = async (
    filters?: { cabang?: string; jabatan?: string; search?: string }
): Promise<{ status: string; data: any[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.cabang) params.append("cabang", filters.cabang);
    if (filters?.jabatan) params.append("jabatan", filters.jabatan);
    if (filters?.search) params.append("search", filters.search);
    const url = `${base}/api/user_cabang${params.toString() ? `?${params}` : ""}`;
    const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
    if (!res.ok) throw new Error("Gagal mengambil data user cabang");
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
    if (!res.ok) throw new Error(result.message || "Gagal membuat user cabang");
    return result;
};

export const updateUserCabang = async (cabang: string, emailSat: string, data: any) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/user_cabang/${encodeURIComponent(cabang)}/${encodeURIComponent(emailSat)}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Gagal mengupdate user cabang");
    return result;
};

export const deleteUserCabang = async (cabang: string, emailSat: string) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/user_cabang/${encodeURIComponent(cabang)}/${encodeURIComponent(emailSat)}`;
    const res = await fetch(url, {
        method: 'DELETE',
        headers: { "Content-Type": "application/json" }
    });
    const result = await res.json();
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
    filters?: RABListFilters
): Promise<{ status: string; data: RABListItem[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status)     params.append("status",     filters.status);
    if (filters?.nomor_ulok) params.append("nomor_ulok", filters.nomor_ulok);
    if (filters?.cabang)     params.append("cabang",     filters.cabang);
    if (filters?.nama_pt)    params.append("nama_pt",    filters.nama_pt);
    if (filters?.email_pembuat) params.append("email_pembuat", filters.email_pembuat);
    const url = `${base}/api/rab${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url);
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

/** Update status RAB (penolakan otomatis oleh HEAD OFFICE). */
export const updateRABStatus = async (payload: {
    id_toko: number;
    id_rab: number;
    status: string;
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
    kategori_pekerjaan: string;
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
    nama_toko:    string;
    cabang:       string;
    proyek:       string;
};

export type GanttListFilters = {
    status?:        "active" | "terkunci" | string;
    nomor_ulok?:    string;
    email_pembuat?: string;
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
    fields: Record<string, string>,
    detailItems: any[],
    lampiranFile?: File | null
) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/instruksi-lapangan/submit`;

    let res: Response;

    if (lampiranFile) {
        const form = new FormData();
        Object.entries(fields).forEach(([key, value]) => {
            if (value !== undefined && value !== null) form.append(key, value);
        });
        form.append("detail_items", JSON.stringify(detailItems));
        form.append("lampiran", lampiranFile);

        res = await fetch(url, { method: "POST", body: form });
    } else {
        const jsonPayload = { ...fields, detail_items: detailItems };
        res = await fetch(url, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(jsonPayload),
        });
    }

    const result = await res.json();
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
    id_rab_item:     number;
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
    status?:          string;
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
    if (!res.ok) throw new Error(result.message || "Gagal menyimpan opname bulk.");
    return result;
};

/** Ambil daftar Opname dengan filter opsional. */
export const fetchOpnameList = async (
    filters?: OpnameListFilters
): Promise<{ status: string; data: OpnameItem[]; toko?: { id: number; nomor_ulok: string; lingkup_pekerjaan: string; nama_toko: string; kode_toko: string; proyek: string; cabang: string; alamat: string; nama_kontraktor: string } }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.id_toko)         params.append("id_toko", filters.id_toko.toString());
    if (filters?.id_opname_final) params.append("id_opname_final", filters.id_opname_final.toString());
    if (filters?.id_rab_item)     params.append("id_rab_item", filters.id_rab_item.toString());
    if (filters?.status)          params.append("status", filters.status);
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

/** List Opname Final headers */
export const fetchOpnameFinalList = async (filters?: {
    status?: string;
    aksi?: "active" | "terkunci";
    id_toko?: number;
    nomor_ulok?: string;
    cabang?: string;
}) => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.aksi) params.append("aksi", filters.aksi);
    if (filters?.id_toko) params.append("id_toko", filters.id_toko.toString());
    if (filters?.nomor_ulok) params.append("nomor_ulok", filters.nomor_ulok);
    if (filters?.cabang) params.append("cabang", filters.cabang);
    const url = `${base}/api/final_opname${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url);
};

/** Detail Opname Final */
export const fetchOpnameFinalDetail = async (id: number) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/final_opname/${id}`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal memuat detail opname final (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
};

/** Kunci Opname Final  POST /api/final_opname/:id/kunci_opname_final */
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

/** Approval Opname Final  POST /api/final_opname/:id/approval */
export const approveOpnameFinal = async (id: number, payload: {
    approver_email: string;
    jabatan: string;
    tindakan: 'APPROVE' | 'REJECT';
    alasan_penolakan?: string | null;
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

/** Download PDF Opname Final */
export const downloadOpnameFinalPdf = async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/final_opname/${id}/pdf`);
    if (res.status === 404) throw new Error(`Data Opname Final dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal mengunduh PDF (${res.status}): ${text.substring(0, 100)}`);
    }

    const disposition = res.headers.get("Content-Disposition");
    let filename = `OPNAME_FINAL_${id}.pdf`;
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
}): Promise<{ status: string; data: SPKListItem[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status)     params.append("status", filters.status);
    if (filters?.nomor_ulok) params.append("nomor_ulok", filters.nomor_ulok);
    const url = `${base}/api/spk${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url);
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
    filters?: PertambahanSPKListFilters
): Promise<{ status: string; data: PertambahanSPKListItem[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.id_spk)              params.append("id_spk", filters.id_spk.toString());
    if (filters?.status_persetujuan)  params.append("status_persetujuan", filters.status_persetujuan);
    const url = `${base}/api/pertambahan-spk${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url);
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
};

export const fetchInstruksiLapanganList = async (
    filters?: InstruksiLapanganFilters
): Promise<any> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.nomor_ulok) params.append("nomor_ulok", filters.nomor_ulok);
    if (filters?.cabang) params.append("cabang", filters.cabang);
    if (filters?.email_pembuat) params.append("email_pembuat", filters.email_pembuat);
    const url = `${base}/api/instruksi-lapangan/list${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url);
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
    jabatan: 'KOORDINATOR' | 'MANAGER' | 'DIREKTUR' | 'KONTRAKTOR' | string;
    tindakan: 'APPROVE' | 'REJECT';
    alasan_penolakan?: string | null;
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
        if (data.url.startsWith('data:')) {
            const res = await fetch(data.url);
            const blob = await res.blob();
            form.append("foto", blob, `photo_${idStr}.jpg`);
        }
    }

    const res = await fetch(url, { method: "POST", body: form });
    const result = await res.json();
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
// DASHBOARD  — Monitoring Transaksi ULOK
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