// --- GABUNGKAN IMPORT DI SINI (PALING ATAS) ---
import { API_URL, OPNAME_API_URL } from './constants';

// --- FUNGSI KEAMANAN FETCH GLOBAL ---
export const safeFetchJSON = async (url: string, options?: any) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type");
    
    if (contentType && contentType.includes("application/json")) {
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || `Error Server (${res.status})`);
        }
        return res.json();
    } else {
        const text = await res.text();
        console.error("Server mengembalikan HTML/Teks:", text);
        throw new Error(`Endpoint salah atau tidak ditemukan (Status ${res.status}).`);
    }
};

// =========================================================
// 1. ENDPOINT RAB
// =========================================================

// 1. Cek Status Revisi
export const checkRevisionStatus = async (email: string, cabang: string) => {
    try {
        const cleanBaseUrl = "https://sparta-backend-5hdj.onrender.com".replace(/\/$/, "");
        const endpoint = cleanBaseUrl.endsWith('/api') 
            ? `${cleanBaseUrl}/check_status` 
            : `${cleanBaseUrl}/api/check_status`;

        const res = await fetch(`${endpoint}?email=${encodeURIComponent(email)}&cabang=${encodeURIComponent(cabang)}`);
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gagal merespon dari server (Status ${res.status}): ${errText.substring(0, 100)}`);
        }
        
        return await res.json();
    } catch (error) {
        console.error("Error fetching revision status:", error);
        throw error;
    }
};

// 2. Ambil Data Harga Material/Upah
export const fetchPricesData = async (cabang: string, lingkup: string) => {
    try {
        const cleanBaseUrl = API_URL.replace(/\/$/, "");
        const url = `https://sparta-backend-5hdj.onrender.com/get-data?cabang=${encodeURIComponent(cabang)}&lingkup=${encodeURIComponent(lingkup)}`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error(`Gagal mengambil data harga dari server (Status: ${res.status}).`);
        return await res.json();
    } catch (error) {
        console.error("API Error (fetchPricesData):", error);
        throw error;
    }
};

// 3. Submit Data RAB
export const submitRABData = async (payloadData: any) => {
    try {
        const cleanBaseUrl = API_URL.replace(/\/$/, "");
        const res = await fetch(`${cleanBaseUrl}/api/rab/submit`, {
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(payloadData),
        });
        
        const result = await res.json();
        
        if (res.status === 409) {
            throw new Error(result.message || "RAB aktif untuk ULOK yang sama sudah ada.");
        }
        if (res.status === 422) {
            throw new Error("Validasi gagal. Pastikan seluruh form dan tabel terisi dengan benar.");
        }
        if (!res.ok || result.status !== "success") {
            throw new Error(result.message || "Server error saat menyimpan data.");
        }
        
        return result;
    } catch (error) {
        console.error("API Error (submitRABData):", error);
        throw error;
    }
};

// --- TYPE DEFINITIONS UNTUK LIST RAB ---
export type RABTokoDetail = {
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    proyek: string;
};

export type RABListItem = {
    id: number;
    id_toko: number;
    status: string;
    nama_pt: string;
    email_pembuat: string;
    grand_total: string;
    grand_total_non_sbo: string;
    grand_total_final: string;
    link_pdf_gabungan: string;
    link_pdf_non_sbo: string;
    link_pdf_rekapitulasi: string;
    created_at: string;
    toko: RABTokoDetail;
};

export type RABListFilters = {
    status?: string;
    nomor_ulok?: string;
};

// 4. Ambil Daftar RAB (GET /api/rab)
export const fetchRABList = async (filters?: RABListFilters): Promise<{ status: string; data: RABListItem[] }> => {
    try {
        const cleanBaseUrl = API_URL.replace(/\/$/, "");
        let url = `${cleanBaseUrl}/api/rab`;

        // Susun query parameters jika filter dikirimkan
        const queryParams: string[] = [];
        if (filters?.status) queryParams.push(`status=${encodeURIComponent(filters.status)}`);
        if (filters?.nomor_ulok) queryParams.push(`nomor_ulok=${encodeURIComponent(filters.nomor_ulok)}`);

        if (queryParams.length > 0) {
            url += `?${queryParams.join('&')}`;
        }

        return await safeFetchJSON(url);
    } catch (error) {
        console.error("API Error (fetchRABList):", error);
        throw error;
    }
};

// --- TYPE DEFINITIONS UNTUK DETAIL RAB ---
export type RABDetailToko = {
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

export type RABDetailData = {
    id: number;
    id_toko: number;
    status: string;
    nama_pt: string;
    email_pembuat: string;
    logo: string | null;
    link_pdf_gabungan: string | null;
    link_pdf_non_sbo: string | null;
    link_pdf_rekapitulasi: string | null;
    pemberi_persetujuan_koordinator: string | null;
    waktu_persetujuan_koordinator: string | null;
    pemberi_persetujuan_manager: string | null;
    waktu_persetujuan_manager: string | null;
    pemberi_persetujuan_direktur: string | null;
    waktu_persetujuan_direktur: string | null;
    alasan_penolakan: string | null;
    durasi_pekerjaan: string;
    kategori_lokasi: string;
    luas_bangunan: string;
    luas_terbangun: string;
    luas_area_terbuka: string;
    luas_area_parkir: string;
    luas_area_sales: string;
    luas_gudang: string;
    grand_total: string;
    grand_total_non_sbo: string;
    grand_total_final: string;
    created_at: string;
};

export type RABDetailItem = {
    id: number;
    id_rab: number;
    kategori_pekerjaan: string;
    jenis_pekerjaan: string;
    satuan: string;
    volume: number;
    harga_material: number;
    harga_upah: number;
    total_material: number;
    total_upah: number;
    total_harga: number;
};

export type RABDetailResponse = {
    rab: RABDetailData;
    toko: RABDetailToko;
    items: RABDetailItem[];
};

// 5. Detail Lengkap RAB (GET /api/rab/:id)
export const fetchRABDetail = async (id: number): Promise<{ status: string; data: RABDetailResponse }> => {
    try {
        const cleanBaseUrl = API_URL.replace(/\/$/, "");
        const res = await fetch(`${cleanBaseUrl}/api/rab/${id}`);

        // Penanganan error 404 spesifik sesuai dokumentasi
        if (res.status === 404) {
            throw new Error(`Pengajuan RAB dengan ID ${id} tidak ditemukan.`);
        }
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gagal memuat detail RAB (Status ${res.status}): ${errText.substring(0, 100)}`);
        }

        return await res.json();
    } catch (error) {
        console.error("API Error (fetchRABDetail):", error);
        throw error;
    }
};

// 6. Download PDF RAB (GET /api/rab/:id/pdf)
export const downloadRABPdf = async (id: number): Promise<boolean> => {
    try {
        const cleanBaseUrl = API_URL.replace(/\/$/, "");
        const res = await fetch(`${cleanBaseUrl}/api/rab/${id}/pdf`, {
            method: "GET"
        });

        // Penanganan error 404 spesifik
        if (res.status === 404) {
            throw new Error(`Data RAB atau Toko dengan ID ${id} tidak ditemukan.`);
        }
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gagal mengunduh PDF (Status ${res.status}): ${errText.substring(0, 100)}`);
        }

        // Mencoba mendapatkan nama file dari header Content-Disposition (jika dikirim oleh backend)
        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = `RAB_GABUNGAN_${id}.pdf`; // Nama fallback
        
        if (contentDisposition && contentDisposition.includes('filename=')) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch.length === 2) {
                filename = filenameMatch[1];
            }
        }

        // Konversi response ke bentuk Blob (Binary Large Object)
        const blob = await res.blob();
        
        // Buat URL sementara untuk Blob tersebut
        const url = window.URL.createObjectURL(blob);

        // Buat elemen <a> bayangan untuk memicu proses download di browser
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click(); // Klik secara programatik
        
        // Bersihkan DOM dan memori (Cleanup)
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        return true;
    } catch (error) {
        console.error("API Error (downloadRABPdf):", error);
        throw error;
    }
};

// --- TYPE DEFINITIONS UNTUK APPROVAL RAB ---
export type RABApprovalPayload = {
    approver_email: string;
    jabatan: 'KOORDINATOR' | 'MANAGER' | 'DIREKTUR' | string;
    tindakan: 'APPROVE' | 'REJECT' | string;
    alasan_penolakan?: string | null;
};

export type RABApprovalResponse = {
    status: string;
    message: string;
    data: {
        id: number;
        old_status: string;
        new_status: string;
    };
};

// 7. Approval / Reject RAB (POST /api/rab/:id/approval)
export const processRABApproval = async (id: number, payload: RABApprovalPayload): Promise<RABApprovalResponse> => {
    try {
        const cleanBaseUrl = API_URL.replace(/\/$/, "");
        const res = await fetch(`${cleanBaseUrl}/api/rab/${id}/approval`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const result = await res.json();

        // Penanganan error spesifik sesuai dokumentasi
        if (res.status === 404) {
            throw new Error("Data RAB tidak ditemukan.");
        }
        if (res.status === 409) {
            throw new Error(result.message || "Status saat ini tidak valid untuk tindakan tersebut. Mungkin sudah diproses sebelumnya.");
        }
        if (res.status === 422) {
            throw new Error(result.message || "Validasi gagal. Pastikan alasan penolakan diisi jika Anda menolak pengajuan ini.");
        }
        if (!res.ok) {
            throw new Error(result.message || `Gagal memproses persetujuan (Status ${res.status}).`);
        }

        return result;
    } catch (error) {
        console.error("API Error (processRABApproval):", error);
        throw error;
    }
};

// =========================================================
// 2. ENDPOINT GANTT CHART
// =========================================================

// --- TYPE DEFINITIONS ---
export type GanttDayItem = {
    kategori_pekerjaan: string;
    h_awal: string;   // format DD/MM/YYYY
    h_akhir: string;  // format DD/MM/YYYY
    keterlambatan?: string;
    kecepatan?: string;
};

export type GanttDependency = {
    kategori_pekerjaan: string;
    kategori_pekerjaan_terikat: string;
};

export type GanttPengawasan = {
    kategori_pekerjaan: string;
};

export type GanttSubmitPayload = {
    nomor_ulok: string;
    nama_toko?: string;
    kode_toko?: string;
    proyek?: string;
    cabang?: string;
    alamat?: string;
    nama_kontraktor?: string;
    lingkup_pekerjaan?: string;
    email_pembuat: string;
    kategori_pekerjaan: string[];
    day_items: GanttDayItem[];
    pengawasan?: GanttPengawasan[];
    dependencies?: GanttDependency[];
};

// No. 1: Submit Gantt Chart (Upsert & Transaksi)
export const submitGanttChart = async (payload: GanttSubmitPayload) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/gantt/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (res.status === 409) {
        throw new Error(
            result.message ||
            "Gantt Chart aktif untuk ULOK ini sudah ada. Harap hubungi admin untuk menonaktifkan data lama terlebih dahulu."
        );
    }

    if (!res.ok) {
        throw new Error(result.message || `Gagal menyimpan Gantt Chart (Status ${res.status}).`);
    }

    return result;
};

// No. 2: List Gantt Chart
export type GanttListItem = {
    id: number;
    id_toko: number;
    status: 'active' | 'terkunci' | string;
    email_pembuat: string;
    timestamp: string;
    nomor_ulok: string;
    nama_toko: string;
    cabang: string;
    proyek: string;
};

export type GanttListFilters = {
    status?: 'active' | 'terkunci' | string;
    nomor_ulok?: string;
    email_pembuat?: string;
};

export const fetchGanttList = async (filters?: GanttListFilters): Promise<{ status: string; data: GanttListItem[] }> => {
    const cleanBaseUrl = API_URL.replace(/\/$/, "");
    let url = `${cleanBaseUrl}/api/gantt`;

    const queryParams: string[] = [];
    if (filters?.status)        queryParams.push(`status=${encodeURIComponent(filters.status)}`);
    if (filters?.nomor_ulok)    queryParams.push(`nomor_ulok=${encodeURIComponent(filters.nomor_ulok)}`);
    if (filters?.email_pembuat) queryParams.push(`email_pembuat=${encodeURIComponent(filters.email_pembuat)}`);

    if (queryParams.length > 0) url += `?${queryParams.join('&')}`;

    return await safeFetchJSON(url);
};

export const fetchGanttData = async (ulok: string, lingkup: string) => {
    const cleanBaseUrl = API_URL.replace(/\/$/, "");
    const url = `${cleanBaseUrl}/api/get_gantt_data?nomor_ulok=${encodeURIComponent(ulok)}&lingkup_pekerjaan=${encodeURIComponent(lingkup)}`;
    
    console.log("🔗 Fetching Gantt Data:", url);
    
    const res = await fetch(url);
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gagal (Status ${res.status}): ${errText.substring(0, 100)}`);
    }
    
    return res.json();
};

// No. 3: Detail Gantt Chart
export type GanttDetailToko = {
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

export type GanttDetailKategori = {
    id: number;
    id_gantt: number;
    kategori_pekerjaan: string;
};

export type GanttDetailDayItem = {
    id: number;
    id_gantt: number;
    id_kategori_pekerjaan_gantt: number;
    h_awal: string;   // format DD/MM/YYYY
    h_akhir: string;  // format DD/MM/YYYY
    keterlambatan: string | null;
    kecepatan: string | null;
    kategori_pekerjaan: string;
};

export type GanttDetailPengawasan = {
    id: number;
    id_gantt: number;
    kategori_pekerjaan: string;
};

export type GanttDetailDependency = {
    id: number;
    id_gantt: number;
    id_kategori: number;
    id_kategori_terikat: number;
    kategori_pekerjaan: string;
    kategori_pekerjaan_terikat: string;
};

export type GanttDetailData = {
    gantt: {
        id: number;
        id_toko: number;
        status: string;
        email_pembuat: string;
        timestamp: string;
    };
    toko: GanttDetailToko;
    kategori_pekerjaan: GanttDetailKategori[];
    day_items: GanttDetailDayItem[];
    pengawasan: GanttDetailPengawasan[];
    dependencies: GanttDetailDependency[];
};

export const fetchGanttDetail = async (id: number): Promise<{ status: string; data: GanttDetailData }> => {
    const cleanBaseUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanBaseUrl}/api/gantt/${id}`);

    if (res.status === 404) {
        throw new Error(`Gantt Chart dengan ID ${id} tidak ditemukan.`);
    }
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gagal memuat detail Gantt Chart (Status ${res.status}): ${errText.substring(0, 100)}`);
    }

    return res.json();
};

export type GanttUpdatePayload = {
    kategori_pekerjaan: string[];
    day_items: GanttDayItem[];
    dependencies?: GanttDependency[];
    pengawasan?: GanttPengawasan[];
    status?: string; // Disiapkan jika lock project menggunakan endpoint ini
};

export const updateGanttChart = async (id: number, payload: GanttUpdatePayload) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/gantt/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (res.status === 404) {
        throw new Error("Gantt Chart tidak ditemukan.");
    }
    if (res.status === 409) {
        throw new Error("Gantt Chart sudah terkunci (Locked) dan tidak dapat diubah.");
    }
    if (!res.ok) {
        throw new Error(result.message || `Gagal memperbarui Gantt Chart (Status ${res.status}).`);
    }

    return result;
};

export type GanttTokoDetailResponse = {
    status: string;
    rab: { id: number; status: string } | null;
    filtered_categories: string[];
    gantt_data: GanttDetailData["gantt"] | null;
    day_gantt_data: GanttDetailDayItem[];
    dependency_data: GanttDetailDependency[];
    pengawasan_data: GanttDetailPengawasan[];
    kategori_pekerjaan: GanttDetailKategori[];
    toko: GanttDetailToko;
};

export const fetchGanttDetailByToko = async (id_toko: number): Promise<GanttTokoDetailResponse> => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/gantt/detail/${id_toko}`);

    if (res.status === 404) {
        throw new Error(`Toko dengan ID ${id_toko} tidak ditemukan.`);
    }
    if (res.status === 422) {
        throw new Error(`Parameter ID Toko tidak valid.`);
    }
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gagal memuat detail Gantt Chart (Status ${res.status}): ${errText.substring(0,100)}`);
    }

    return res.json();
};

// No. 5: Lock (Kunci) Gantt Chart
export const lockGanttChart = async (id: number, email: string) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/gantt/${id}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    });
    
    const result = await res.json();

    if (res.status === 404) {
        throw new Error("Gantt Chart tidak ditemukan.");
    }
    if (res.status === 409) {
        throw new Error("Gantt Chart sudah terkunci dan tidak bisa diubah lagi.");
    }
    if (!res.ok) {
        throw new Error(result.message || "Gagal mengunci Gantt Chart.");
    }

    return result;
};

// No. 6: Hapus Gantt Chart (DELETE /api/gantt/:id)
export const deleteGanttChart = async (id: number) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/gantt/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
    });

    const result = await res.json();

    if (res.status === 404) {
        throw new Error("Gantt Chart tidak ditemukan.");
    }
    if (res.status === 409) {
        throw new Error("Gantt Chart sudah terkunci dan tidak dapat dihapus.");
    }
    if (!res.ok) {
        throw new Error(result.message || "Gagal menghapus Gantt Chart.");
    }

    return result;
};

// No. 7: Tambah Day Items
export const addGanttDayItems = async (id: number, dayItems: GanttDayItem[]) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/gantt/${id}/day`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day_items: dayItems })
    });

    const result = await res.json();

    // Penanganan Error Sesuai Spesifikasi
    if (res.status === 404) {
        throw new Error("Gantt Chart tidak ditemukan.");
    }
    if (res.status === 409) {
        throw new Error("Gantt Chart sudah terkunci dan tidak dapat ditambah periodenya.");
    }
    if (res.status === 422) {
        throw new Error("Validasi gagal. Pastikan kategori sesuai dan format tanggal adalah DD/MM/YYYY.");
    }
    if (!res.ok) {
        throw new Error(result.message || "Gagal menambahkan periode / day items.");
    }

    return result;
};

// No. 8: Update Keterlambatan
export const updateGanttDelay = async (
    id: number, 
    payload: { kategori_pekerjaan: string; h_awal: string; h_akhir: string; keterlambatan: string }
) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/gantt/${id}/day/keterlambatan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const result = await res.json();

    // Penanganan Error Sesuai Spesifikasi
    if (res.status === 404) {
        throw new Error("Gantt Chart atau tahapan periode tersebut tidak ditemukan.");
    }
    if (res.status === 422) {
        throw new Error("Validasi gagal. Pastikan form data keterlambatan terisi dengan benar.");
    }
    if (!res.ok) {
        throw new Error(result.message || "Gagal memperbarui data keterlambatan.");
    }

    return result;
};

// No. 9: Update Kecepatan
export const updateGanttSpeed = async (
    id: number, 
    payload: { kategori_pekerjaan: string; h_awal: string; h_akhir: string; kecepatan: string }
) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/gantt/${id}/day/kecepatan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (res.status === 404) {
        throw new Error("Gantt Chart atau tahapan periode tersebut tidak ditemukan.");
    }
    if (res.status === 422) {
        throw new Error("Validasi gagal. Pastikan form data kecepatan terisi dengan benar.");
    }
    if (!res.ok) {
        throw new Error(result.message || "Gagal memperbarui data kecepatan.");
    }

    return result;
};

// No. 10: Manage Pengawasan (Tambah / Hapus)
export const manageGanttPengawasan = async (
    id: number,
    payload: { kategori_pekerjaan?: string; remove_kategori?: string }
) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/gantt/${id}/pengawasan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const result = await res.json();

    // Penanganan Error Sesuai Spesifikasi
    if (res.status === 404) {
        throw new Error("Gantt Chart tidak ditemukan.");
    }
    if (res.status === 422) {
        throw new Error("Validasi gagal. Pastikan salah satu field (kategori_pekerjaan atau remove_kategori) dikirim.");
    }
    if (!res.ok) {
        throw new Error(result.message || "Gagal memperbarui data pengawasan.");
    }

    return result;
};

// =========================================================
// ENDPOINT SERVER OPNAME (Sesuai OPNAME_API_URL)
// =========================================================

export const fetchOpnameStoreList = async (email: string, roleMode: 'pic' | 'kontraktor') => {
    const cleanUrl = OPNAME_API_URL.replace(/\/$/, "");
    const endpoint = roleMode === 'pic' ? '/api/toko' : '/api/toko_kontraktor';
    return safeFetchJSON(`${cleanUrl}${endpoint}?username=${encodeURIComponent(email)}`);
};

export const fetchOpnameItems = async (kodeToko: string, ulok: string, lingkup: string) => {
    const cleanUrl = OPNAME_API_URL.replace(/\/$/, "");
    return safeFetchJSON(`${cleanUrl}/api/opname?kode_toko=${encodeURIComponent(kodeToko)}&no_ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`);
};

export const fetchOpnamePending = async (kodeToko: string, ulok: string, lingkup: string) => {
    const cleanUrl = OPNAME_API_URL.replace(/\/$/, "");
    return safeFetchJSON(`${cleanUrl}/api/opname/pending?kode_toko=${encodeURIComponent(kodeToko)}&no_ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`);
};

export const fetchOpnameHistory = async (kodeToko: string, ulok: string, lingkup: string) => {
    const cleanUrl = OPNAME_API_URL.replace(/\/$/, "");
    return safeFetchJSON(`${cleanUrl}/api/opname/final?kode_toko=${encodeURIComponent(kodeToko)}&no_ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`);
};

export const fetchOpnamePenalty = async (ulok: string, lingkup: string) => {
    try {
        const cleanUrl = OPNAME_API_URL.replace(/\/$/, "");
        return await safeFetchJSON(`${cleanUrl}/api/cek_keterlambatan?no_ulok=${encodeURIComponent(ulok)}&lingkup_pekerjaan=${encodeURIComponent(lingkup)}`);
    } catch (err) {
        console.warn("Data denda kosong atau 404. Mengabaikan denda...", err);
        return { terlambat: false, hari_terlambat: 0 }; 
    }
};

export const uploadOpnameImage = async (formData: FormData) => {
    const cleanUrl = OPNAME_API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error("Gagal mengunggah foto.");
    return res.json();
};

export const submitOpnameItem = async (payload: any) => {
    const cleanUrl = OPNAME_API_URL.replace(/\/$/, "");
    return safeFetchJSON(`${cleanUrl}/api/opname/item/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
};

export const actionOpnameItem = async (action: 'approve' | 'reject', payload: any) => {
    const cleanUrl = OPNAME_API_URL.replace(/\/$/, "");
    return safeFetchJSON(`${cleanUrl}/api/opname/${action}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
};

// =========================================================
// ENDPOINT SPARTA UTAMA (OPNAME & PDF)
// =========================================================

export const checkStatusItemOpname = async (ulok: string, lingkup: string) => {
    try {
        const cleanUrl = API_URL.replace(/\/$/, "");
        return await safeFetchJSON(`${cleanUrl}/api/check_status_item_opname?no_ulok=${encodeURIComponent(ulok)}&lingkup_pekerjaan=${encodeURIComponent(lingkup)}`);
    } catch (err) {
        return { tanggal_opname_final: null };
    }
};

export const processSummaryOpname = async (payload: any) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/process_summary_opname`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Gagal memproses kalkulasi approval");
    }
    return res.json();
};

export const lockOpnameFinal = async (payload: any) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/opname_locked`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Gagal memfinalisasi jadwal.");
    return data;
};

export const fetchOpnameRabData = async (kodeToko: string, noUlok: string, lingkup: string) => {
    const cleanUrl = OPNAME_API_URL.replace(/\/$/, "");
    return safeFetchJSON(`${cleanUrl}/api/rab?kode_toko=${encodeURIComponent(kodeToko)}&no_ulok=${encodeURIComponent(noUlok)}&lingkup=${encodeURIComponent(lingkup)}`);
};

export const fetchPicList = async (noUlok: string, lingkup: string, kodeToko: string) => {
    try {
        const cleanUrl = OPNAME_API_URL.replace(/\/$/, "");
        const res = await fetch(`${cleanUrl}/api/pic-list?no_ulok=${encodeURIComponent(noUlok)}&lingkup=${encodeURIComponent(lingkup)}&kode_toko=${encodeURIComponent(kodeToko)}`);
        if(!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json.pic_list) ? json.pic_list : [];
    } catch(e) { return []; }
};

export const fetchPicKontraktorData = async (noUlok: string) => {
    try {
        const cleanUrl = OPNAME_API_URL.replace(/\/$/, "");
        const res = await fetch(`${cleanUrl}/api/pic-kontraktor?no_ulok=${encodeURIComponent(noUlok)}`);
        if(!res.ok) return { pic_username: "N/A", kontraktor_username: "N/A" };
        return await res.json();
    } catch(e) { return { pic_username: "N/A", kontraktor_username: "N/A" }; }
};

export const fetchPicKontraktorOpnameData = async (noUlok: string) => {
    try {
        const cleanUrl = OPNAME_API_URL.replace(/\/$/, "");
        const res = await fetch(`${cleanUrl}/api/pic-kontraktor-opname?no_ulok=${encodeURIComponent(noUlok)}`);
        if(!res.ok) return { pic_username: "N/A", kontraktor_username: "N/A", name: "" };
        return await res.json();
    } catch(e) { return { pic_username: "N/A", kontraktor_username: "N/A", name: "" }; }
};

// =========================================================
// INSTRUKSI LAPANGAN (IL) & SPK
// =========================================================

export const submitILData = async (formData: FormData) => {
    const cleanUrl = API_URL.replace(/\/$/, ""); 
    const res = await fetch(`${cleanUrl}/api/submit_rab_kedua`, { method: "POST", body: formData });
    const result = await res.json();
    if (!res.ok || result.status !== "success") throw new Error(result.message || "Gagal mengirim data Instruksi Lapangan.");
    return result;
};

export const fetchApprovedRabs = async (cabang: string) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    return safeFetchJSON(`${cleanUrl}/api/get_approved_rab?cabang=${encodeURIComponent(cabang)}`);
};

export const fetchKontraktorList = async (cabang: string) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    return safeFetchJSON(`${cleanUrl}/api/get_kontraktor?cabang=${encodeURIComponent(cabang)}`);
};

export const checkSpkStatus = async (ulok: string, lingkup: string) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    try {
        return await safeFetchJSON(`${cleanUrl}/api/get_spk_status?ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`);
    } catch (e) { return null; }
};

export const submitSPKData = async (payload: any) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/submit_spk`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok || result.status !== "success") throw new Error(result.message || "Gagal menyimpan data SPK.");
    return result;
};

// =========================================================
// PIC PENGAWASAN
// =========================================================
const PENGAWASAN_API_URL = "https://pengawasan-tambahspk.onrender.com/api/form";

export const fetchPengawasanUlok = async (cabang: string) => {
    return safeFetchJSON(`${PENGAWASAN_API_URL}?form=input-pic&getKodeUlokByCabang=true&cabang=${encodeURIComponent(cabang)}`);
};

export const fetchPengawasanPic = async (cabang: string) => {
    return safeFetchJSON(`${PENGAWASAN_API_URL}?form=input-pic&cabang=${encodeURIComponent(cabang)}`);
};

export const fetchPengawasanToko = async (ulok: string) => {
    return safeFetchJSON(`${PENGAWASAN_API_URL}?form=input-pic&getNamaToko=true&kode_ulok=${encodeURIComponent(ulok)}`);
};

export const fetchPengawasanSpkDetails = async (ulok: string) => {
    return safeFetchJSON(`${PENGAWASAN_API_URL}?form=input-pic&getSpkDetails=true&kode_ulok=${encodeURIComponent(ulok)}`);
};

export const fetchPengawasanSpkUrls = async (ulok: string) => {
    return safeFetchJSON(`${PENGAWASAN_API_URL}?form=input-pic&getAllSpkUrls=true&kode_ulok=${encodeURIComponent(ulok)}`);
};

export const fetchPengawasanRabUrls = async (ulok: string) => {
    return safeFetchJSON(`${PENGAWASAN_API_URL}?form=input-pic&getAllRabUrls=true&kode_ulok=${encodeURIComponent(ulok)}`);
};

export const submitPengawasanData = async (payload: any) => {
    const res = await fetch(PENGAWASAN_API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (result.status !== "success") throw new Error(result.message || "Gagal menyimpan data pengawasan.");
    return result;
};

// =========================================================
// PENYIMPANAN DOKUMEN TOKO
// =========================================================

export const fetchDokumenToko = async (cabang: string) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    let url = `${cleanUrl}/api/doc/list`;
    if (cabang && cabang.toLowerCase() !== "head office") url += `?cabang=${encodeURIComponent(cabang)}`;
    return safeFetchJSON(url);
};

export const submitDokumenToko = async (payload: any) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/doc/save`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || result.message || "Gagal menyimpan dokumen.");
    return result;
};

export const updateDokumenToko = async (id: string | number, payload: any) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/doc/update/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || result.message || "Gagal mengupdate dokumen.");
    return result;
};

export const deleteDokumenToko = async (kode_toko: string) => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/doc/delete/${encodeURIComponent(kode_toko)}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || result.message || "Gagal menghapus dokumen.");
    return result;
};

// =========================================================
// MONITORING DASHBOARD
// =========================================================
export const fetchMonitoringData = async () => {
    const cleanUrl = API_URL.replace(/\/$/, "");
    return safeFetchJSON(`${cleanUrl}/api/opname/summary-data`);
};