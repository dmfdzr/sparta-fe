// =============================================================================
// lib/api.ts
// Seluruh fungsi komunikasi ke backend API.
//
// STRUKTUR FILE:
//   1.  GLOBAL — safeFetchJSON
//   2.  RAB    — Types, CRUD, Download PDF, Approval
//   3.  GANTT  — Types, Submit, List, Detail, Update, Lock, Delete,
//               Day Items, Keterlambatan, Kecepatan, Pengawasan
//   4.  OPNAME (Server opname)  — Toko, Items, Pending, History, Penalty,
//               Upload, Submit, Action
//   5.  OPNAME (Server sparta)  — Status item, Summary, Lock final,
//               RAB data, PIC list
//   6.  SPK    — Submit, Cek Status, Types, List, Detail, Approval
//   7.  IL     — Submit, Fetch Approved RAB, Types, List, Detail, Approval
//   8.  PENGAWASAN — Ulok, PIC, Toko, SPK Details, SPK URLs, RAB URLs, Submit
//   9.  DOKUMEN TOKO — List, Submit, Update, Delete
//   10. MONITORING — Summary data
// =============================================================================

import { API_URL, OPNAME_API_URL } from "./constants";

// =============================================================================
// 1. GLOBAL — FETCH HELPER
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
// 2. RAB — Rencana Anggaran Biaya
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
    created_at:           string;
    nomor_ulok:           string;
    nama_toko:            string;
    cabang:               string;
    proyek:               string;
    toko?:                RABTokoDetail;
};

export type RABListFilters = {
    status?:     string;
    nomor_ulok?: string;
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

        // Ambil detail RAB yang ditolak agar formatnya sama dengan yang diharapkan halaman RAB
        const formatted = await Promise.all(rejected.map(async r => {
            try {
                const detail = await fetchRABDetail(r.id);
                return {
                    "Nomor Ulok": r.nomor_ulok,
                    "Lingkup_Pekerjaan": detail.data.toko?.lingkup_pekerjaan || '-',
                    "nama_toko": r.nama_toko,
                    "Proyek": r.proyek,
                    "Alamat": detail.data.toko?.alamat || '',
                    "Kategori_Lokasi": detail.data.rab?.kategori_lokasi || '',
                    "Durasi_Pekerjaan": detail.data.rab?.durasi_pekerjaan || '',
                    "Luas Area Parkir": detail.data.rab?.luas_area_parkir || '',
                    "Luas Area Sales": detail.data.rab?.luas_area_sales || '',
                    "Luas Gudang": detail.data.rab?.luas_gudang || '',
                    "Luas Bangunan": detail.data.rab?.luas_bangunan || '',
                    "Luas Area Terbuka": detail.data.rab?.luas_area_terbuka || '',
                    "Item_Details_JSON": detail.data.items || [] // format array dari backend baru
                };
            } catch (err) {
                return null;
            }
        }));

        return { rejected_submissions: formatted.filter(Boolean) };
    } catch (err) {
        console.error("Error checkRevisionStatus:", err);
        return { rejected_submissions: [] };
    }
};

/** Ambil data harga material/upah berdasarkan cabang dan lingkup pekerjaan. */
export const fetchPricesData = async (cabang: string, lingkup: string) => {
    const url = `https://sparta-backend-5hdj.onrender.com/get-data?cabang=${encodeURIComponent(cabang)}&lingkup=${encodeURIComponent(lingkup)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gagal mengambil data harga (${res.status}).`);
    return res.json();
};

/** Submit / buat RAB baru. */
export const submitRABData = async (payload: any) => {
    const url = `${API_URL.replace(/\/$/, "")}/api/rab/submit`;
    const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
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
    h_awal:             string; // format DD/MM/YYYY
    h_akhir:            string; // format DD/MM/YYYY
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
    h_awal:                     string; // format DD/MM/YYYY
    h_akhir:                    string; // format DD/MM/YYYY
    keterlambatan:              string | null;
    kecepatan:                  string | null;
    kategori_pekerjaan:         string;
};

export type GanttDetailPengawasan = {
    id:                 number;
    id_gantt:           number;
    kategori_pekerjaan: string;
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
    if (!res.ok) throw new Error(result.message || `Gagal memperbarui (${res.status}).`);
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
    payload: { kategori_pekerjaan: string; h_awal: string; h_akhir: string; keterlambatan: string }
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

// =============================================================================
// 4. OPNAME — Server Opname (OPNAME_API_URL)
// =============================================================================

/** Ambil daftar toko untuk opname berdasarkan role pengguna. */
export const fetchOpnameStoreList = async (
    email: string,
    roleMode: "pic" | "kontraktor"
) => {
    const base = OPNAME_API_URL.replace(/\/$/, "");
    const endpoint = roleMode === "pic" ? "/api/toko" : "/api/toko_kontraktor";
    return safeFetchJSON(`${base}${endpoint}?username=${encodeURIComponent(email)}`);
};

/** Ambil semua item opname untuk PIC (termasuk yang belum disubmit). */
export const fetchOpnameItems = async (
    kodeToko: string,
    ulok: string,
    lingkup: string
) => {
    const base = OPNAME_API_URL.replace(/\/$/, "");
    return safeFetchJSON(
        `${base}/api/opname?kode_toko=${encodeURIComponent(kodeToko)}&no_ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`
    );
};

/** Ambil item opname yang sedang pending approval (untuk kontraktor). */
export const fetchOpnamePending = async (
    kodeToko: string,
    ulok: string,
    lingkup: string
) => {
    const base = OPNAME_API_URL.replace(/\/$/, "");
    return safeFetchJSON(
        `${base}/api/opname/pending?kode_toko=${encodeURIComponent(kodeToko)}&no_ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`
    );
};

/** Ambil histori opname yang sudah final. */
export const fetchOpnameHistory = async (
    kodeToko: string,
    ulok: string,
    lingkup: string
) => {
    const base = OPNAME_API_URL.replace(/\/$/, "");
    return safeFetchJSON(
        `${base}/api/opname/final?kode_toko=${encodeURIComponent(kodeToko)}&no_ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`
    );
};

/**
 * Cek apakah ada denda keterlambatan untuk ULOK dan lingkup tertentu.
 * Mengembalikan { terlambat: false } jika endpoint 404 / error.
 */
export const fetchOpnamePenalty = async (ulok: string, lingkup: string) => {
    try {
        const base = OPNAME_API_URL.replace(/\/$/, "");
        return await safeFetchJSON(
            `${base}/api/cek_keterlambatan?no_ulok=${encodeURIComponent(ulok)}&lingkup_pekerjaan=${encodeURIComponent(lingkup)}`
        );
    } catch {
        return { terlambat: false, hari_terlambat: 0 };
    }
};

/** Upload foto bukti opname. */
export const uploadOpnameImage = async (formData: FormData) => {
    const res = await fetch(`${OPNAME_API_URL.replace(/\/$/, "")}/api/upload`, {
        method: "POST",
        body:   formData,
    });
    if (!res.ok) throw new Error("Gagal mengunggah foto.");
    return res.json();
};

/** Submit satu item opname (oleh PIC). */
export const submitOpnameItem = async (payload: any) => {
    const base = OPNAME_API_URL.replace(/\/$/, "");
    return safeFetchJSON(`${base}/api/opname/item/submit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
};

/** Approve atau reject item opname (oleh kontraktor). */
export const actionOpnameItem = async (
    action: "approve" | "reject",
    payload: any
) => {
    const base = OPNAME_API_URL.replace(/\/$/, "");
    return safeFetchJSON(`${base}/api/opname/${action}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
};

// =============================================================================
// 5. OPNAME — Server Sparta (API_URL)
// =============================================================================

/**
 * Cek apakah opname untuk ULOK dan lingkup tertentu sudah final.
 * Mengembalikan { tanggal_opname_final: null } jika error.
 */
export const checkStatusItemOpname = async (ulok: string, lingkup: string) => {
    try {
        return await safeFetchJSON(
            `${API_URL.replace(/\/$/, "")}/api/check_status_item_opname?no_ulok=${encodeURIComponent(ulok)}&lingkup_pekerjaan=${encodeURIComponent(lingkup)}`
        );
    } catch {
        return { tanggal_opname_final: null };
    }
};

/** Proses kalkulasi summary opname (sebelum finalisasi). */
export const processSummaryOpname = async (payload: any) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/process_summary_opname`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Gagal memproses kalkulasi opname.");
    }
    return res.json();
};

/** Kunci / finalisasi opname. */
export const lockOpnameFinal = async (payload: any) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/opname_locked`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Gagal memfinalisasi opname.");
    return data;
};

/** Ambil data RAB untuk keperluan cetak berita acara opname. */
export const fetchOpnameRabData = async (
    kodeToko: string,
    noUlok: string,
    lingkup: string
) => {
    const base = OPNAME_API_URL.replace(/\/$/, "");
    return safeFetchJSON(
        `${base}/api/rab?kode_toko=${encodeURIComponent(kodeToko)}&no_ulok=${encodeURIComponent(noUlok)}&lingkup=${encodeURIComponent(lingkup)}`
    );
};

/** Ambil daftar nama PIC yang terlibat dalam opname ULOK tertentu. */
export const fetchPicList = async (
    noUlok: string,
    lingkup: string,
    kodeToko: string
): Promise<string[]> => {
    try {
        const base = OPNAME_API_URL.replace(/\/$/, "");
        const res = await fetch(
            `${base}/api/pic-list?no_ulok=${encodeURIComponent(noUlok)}&lingkup=${encodeURIComponent(lingkup)}&kode_toko=${encodeURIComponent(kodeToko)}`
        );
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json.pic_list) ? json.pic_list : [];
    } catch {
        return [];
    }
};

/** Ambil data PIC dan kontraktor dari ULOK. */
export const fetchPicKontraktorData = async (noUlok: string) => {
    try {
        const base = OPNAME_API_URL.replace(/\/$/, "");
        const res = await fetch(`${base}/api/pic-kontraktor?no_ulok=${encodeURIComponent(noUlok)}`);
        if (!res.ok) return { pic_username: "N/A", kontraktor_username: "N/A" };
        return res.json();
    } catch {
        return { pic_username: "N/A", kontraktor_username: "N/A" };
    }
};

/** Ambil data PIC dan kontraktor khusus konteks berita acara opname. */
export const fetchPicKontraktorOpnameData = async (noUlok: string) => {
    try {
        const base = OPNAME_API_URL.replace(/\/$/, "");
        const res = await fetch(`${base}/api/pic-kontraktor-opname?no_ulok=${encodeURIComponent(noUlok)}`);
        if (!res.ok) return { pic_username: "N/A", kontraktor_username: "N/A", name: "" };
        return res.json();
    } catch {
        return { pic_username: "N/A", kontraktor_username: "N/A", name: "" };
    }
};

// =============================================================================
// 6. SPK — Surat Perintah Kerja
// =============================================================================

// --- Types ---

export type SPKListItem = {
    id:                 number;
    nomor_ulok:         string;
    nama_toko:          string;
    kode_toko?:         string;
    cabang:             string;
    lingkup_pekerjaan:  string;
    nama_kontraktor:    string;
    nilai_kontrak:      number | string;
    masa_berlaku?:      string;
    tanggal_mulai?:     string;
    status:             string;
    email_pembuat:      string;
    created_at:         string;
    alasan_penolakan?:  string | null;
    pemberi_persetujuan?:string | null;
    waktu_persetujuan?: string | null;
};

export type SPKDetailItem = {
    id:                number;
    kategori_pekerjaan:string;
    jenis_pekerjaan:   string;
    satuan:            string;
    volume:            number;
    harga_material:    number;
    harga_upah:        number;
    total_harga:       number;
};

export type SPKDetailResponse = {
    spk:    SPKListItem;
    items?: SPKDetailItem[];
};

export type SPKApprovalPayload = {
    approver_email:   string;
    tindakan:         "APPROVE" | "REJECT";
    alasan_penolakan?: string | null;
};

// --- Fungsi ---

/** Submit SPK baru. */
export const submitSPKData = async (payload: any) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/submit_spk`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok || result.status !== "success")
        throw new Error(result.message || "Gagal menyimpan data SPK.");
    return result;
};

/** Cek status SPK berdasarkan ULOK dan lingkup. Mengembalikan null jika belum ada. */
export const checkSpkStatus = async (ulok: string, lingkup: string) => {
    try {
        return await safeFetchJSON(
            `${API_URL.replace(/\/$/, "")}/api/get_spk_status?ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`
        );
    } catch {
        return null;
    }
};

/** Ambil daftar SPK dengan filter opsional. */
export const fetchSPKList = async (filters?: {
    status?: string;
    cabang?: string;
    nomor_ulok?: string;
}): Promise<{ status: string; data: SPKListItem[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status)     params.append("status",     filters.status);
    if (filters?.cabang)     params.append("cabang",     filters.cabang);
    if (filters?.nomor_ulok) params.append("nomor_ulok", filters.nomor_ulok);
    const url = `${base}/api/spk${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url);
};

/** Ambil detail SPK berdasarkan ID. */
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

/** Proses approval atau reject SPK. */
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
// 7. IL — Instruksi Lapangan
// =============================================================================

// --- Types ---

export type ILListItem = {
    id:                              number;
    nomor_ulok:                      string;
    nama_toko:                       string;
    kode_toko?:                      string;
    cabang:                          string;
    lingkup_pekerjaan:               string;
    email_pembuat:                   string;
    status:                          string;
    grand_total?:                    string | number;
    grand_total_final?:              string | number;
    created_at:                      string;
    alasan_penolakan?:               string | null;
    pemberi_persetujuan_koordinator?:string | null;
    waktu_persetujuan_koordinator?:  string | null;
    pemberi_persetujuan_manager?:    string | null;
    waktu_persetujuan_manager?:      string | null;
};

export type ILDetailItem = {
    id:                number;
    kategori_pekerjaan:string;
    jenis_pekerjaan:   string;
    satuan:            string;
    volume:            number;
    harga_material:    number;
    harga_upah:        number;
    total_material?:   number;
    total_upah?:       number;
    total_harga:       number;
};

export type ILDetailResponse = {
    il:     ILListItem;
    items?: ILDetailItem[];
};

export type ILApprovalPayload = {
    approver_email:   string;
    jabatan:          "KOORDINATOR" | "MANAGER";
    tindakan:         "APPROVE" | "REJECT";
    alasan_penolakan?: string | null;
};

// --- Fungsi ---

/** Submit Instruksi Lapangan baru (multipart/form-data). */
export const submitILData = async (formData: FormData) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/submit_rab_kedua`, {
        method: "POST",
        body:   formData,
    });
    const result = await res.json();
    if (!res.ok || result.status !== "success")
        throw new Error(result.message || "Gagal mengirim data Instruksi Lapangan.");
    return result;
};

/** Ambil daftar RAB yang sudah APPROVED (untuk form SPK/IL). */
export const fetchApprovedRabs = async (cabang: string) => {
    return safeFetchJSON(
        `${API_URL.replace(/\/$/, "")}/api/get_approved_rab?cabang=${encodeURIComponent(cabang)}`
    );
};

/** Ambil daftar kontraktor berdasarkan cabang. */
export const fetchKontraktorList = async (cabang: string) => {
    return safeFetchJSON(
        `${API_URL.replace(/\/$/, "")}/api/get_kontraktor?cabang=${encodeURIComponent(cabang)}`
    );
};

/** Ambil daftar IL dengan filter opsional. */
export const fetchILList = async (filters?: {
    status?: string;
    cabang?: string;
    nomor_ulok?: string;
}): Promise<{ status: string; data: ILListItem[] }> => {
    const base = API_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (filters?.status)     params.append("status",     filters.status);
    if (filters?.cabang)     params.append("cabang",     filters.cabang);
    if (filters?.nomor_ulok) params.append("nomor_ulok", filters.nomor_ulok);
    const url = `${base}/api/il${params.toString() ? `?${params}` : ""}`;
    return safeFetchJSON(url);
};

/** Ambil detail IL berdasarkan ID. */
export const fetchILDetail = async (
    id: number
): Promise<{ status: string; data: ILDetailResponse }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/il/${id}`);
    if (res.status === 404) throw new Error(`IL dengan ID ${id} tidak ditemukan.`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal memuat detail IL (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
};

/** Proses approval atau reject Instruksi Lapangan. */
export const processILApproval = async (
    id: number,
    payload: ILApprovalPayload
): Promise<{ status: string; message: string; data: { id: number; old_status: string; new_status: string } }> => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/il/${id}/approval`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (res.status === 404) throw new Error("Data IL tidak ditemukan.");
    if (res.status === 409) throw new Error(result.message || "Status tidak valid untuk tindakan ini.");
    if (res.status === 422) throw new Error(result.message || "Validasi gagal. Isi alasan penolakan.");
    if (!res.ok) throw new Error(result.message || `Gagal approval IL (${res.status}).`);
    return result;
};

// =============================================================================
// 8. PENGAWASAN — PIC Pengawasan Proyek
// =============================================================================

const PENGAWASAN_API_URL = "https://pengawasan-tambahspk.onrender.com/api/form";

/** Ambil daftar kode ULOK berdasarkan cabang (untuk dropdown). */
export const fetchPengawasanUlok = async (cabang: string) =>
    safeFetchJSON(`${PENGAWASAN_API_URL}?form=input-pic&getKodeUlokByCabang=true&cabang=${encodeURIComponent(cabang)}`);

/** Ambil daftar PIC yang tersedia untuk cabang tertentu. */
export const fetchPengawasanPic = async (cabang: string) =>
    safeFetchJSON(`${PENGAWASAN_API_URL}?form=input-pic&cabang=${encodeURIComponent(cabang)}`);

/** Ambil nama toko berdasarkan kode ULOK. */
export const fetchPengawasanToko = async (ulok: string) =>
    safeFetchJSON(`${PENGAWASAN_API_URL}?form=input-pic&getNamaToko=true&kode_ulok=${encodeURIComponent(ulok)}`);

/** Ambil detail SPK (jadwal, kontraktor, dll.) berdasarkan kode ULOK. */
export const fetchPengawasanSpkDetails = async (ulok: string) =>
    safeFetchJSON(`${PENGAWASAN_API_URL}?form=input-pic&getSpkDetails=true&kode_ulok=${encodeURIComponent(ulok)}`);

/** Ambil semua URL dokumen SPK berdasarkan kode ULOK. */
export const fetchPengawasanSpkUrls = async (ulok: string) =>
    safeFetchJSON(`${PENGAWASAN_API_URL}?form=input-pic&getAllSpkUrls=true&kode_ulok=${encodeURIComponent(ulok)}`);

/** Ambil semua URL dokumen RAB berdasarkan kode ULOK. */
export const fetchPengawasanRabUrls = async (ulok: string) =>
    safeFetchJSON(`${PENGAWASAN_API_URL}?form=input-pic&getAllRabUrls=true&kode_ulok=${encodeURIComponent(ulok)}`);

/** Submit data PIC pengawasan. */
export const submitPengawasanData = async (payload: any) => {
    const res = await fetch(PENGAWASAN_API_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (result.status !== "success")
        throw new Error(result.message || "Gagal menyimpan data pengawasan.");
    return result;
};

// =============================================================================
// 9. DOKUMEN TOKO — Penyimpanan Dokumen
// =============================================================================

/** Ambil daftar dokumen toko. Jika bukan Head Office, filter per cabang. */
export const fetchDokumenToko = async (cabang: string) => {
    const base = API_URL.replace(/\/$/, "");
    const url =
        cabang && cabang.toLowerCase() !== "head office"
            ? `${base}/api/doc/list?cabang=${encodeURIComponent(cabang)}`
            : `${base}/api/doc/list`;
    return safeFetchJSON(url);
};

/** Simpan dokumen toko baru. */
export const submitDokumenToko = async (payload: any) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/doc/save`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || result.message || "Gagal menyimpan dokumen.");
    return result;
};

/** Update dokumen toko berdasarkan ID. */
export const updateDokumenToko = async (id: string | number, payload: any) => {
    const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/doc/update/${id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || result.message || "Gagal mengupdate dokumen.");
    return result;
};

/** Hapus dokumen toko berdasarkan kode toko. */
export const deleteDokumenToko = async (kode_toko: string) => {
    const res = await fetch(
        `${API_URL.replace(/\/$/, "")}/api/doc/delete/${encodeURIComponent(kode_toko)}`,
        { method: "DELETE", headers: { "Content-Type": "application/json" } }
    );
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || result.message || "Gagal menghapus dokumen.");
    return result;
};

// =============================================================================
// 10. MONITORING DASHBOARD
// =============================================================================

/** Ambil data ringkasan untuk dashboard monitoring (grafik progres & status). */
export const fetchMonitoringData = async () =>
    safeFetchJSON(`${API_URL.replace(/\/$/, "")}/api/opname/summary-data`);