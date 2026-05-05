// =============================================================================
// lib/constants.ts
// Konstanta global: URL API, konfigurasi menu, role, dan kategori pekerjaan.
// =============================================================================

import {
    FileText, Stamp, FileSignature, Users, CheckSquare,
    Camera, FilePlus, FolderArchive, BarChartHorizontal,
    AlertTriangle, Activity, PieChart, ClipboardCheck,
    FileStack,
} from "lucide-react";

// -----------------------------------------------------------------------------
// BASE URL API
// -----------------------------------------------------------------------------

/** Server utama (Sparta Backend) */
export const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "https://sparta-be.onrender.com";

// -----------------------------------------------------------------------------
// KONFIGURASI MENU APLIKASI
// Setiap menu memiliki id unik yang digunakan di ROLE_CONFIG untuk access control.
// -----------------------------------------------------------------------------

export const ALL_MENUS = [
    {
        id: "menu-rab",
        title: "Penawaran Final Kontraktor",
        desc: "Buat penawaran final.",
        href: "/rab",
        icon: FileText,
    },
    {
        id: "menu-spk",
        title: "Surat Perintah Kerja",
        desc: "Form surat perintah kerja untuk kontraktor.",
        href: "/spk",
        icon: FileSignature,
    },
    {
        id: "menu-inputpic",
        title: "PIC Pengawasan",
        desc: "Form input PIC pengawasan pekerjaan proyek.",
        href: "/inputpic",
        icon: Users,
    },
    {
        id: "menu-opname",
        title: "Opname",
        desc: "Form opname proyek toko.",
        href: "/opname",
        icon: CheckSquare,
    },
    {
        id: "menu-dokumentasi",
        title: "Dokumentasi Bangunan Toko Baru",
        desc: "Form dokumentasi foto bangunan.",
        href: "/ftdokumen",
        icon: Camera,
    },
    {
        id: "menu-tambahspk",
        title: "Tambah Surat Perintah Kerja",
        desc: "Form pertambahan hari surat perintah kerja.",
        href: "/tambahspk",
        icon: FilePlus,
    },
    {
        id: "menu-svdokumen",
        title: "Penyimpanan Dokumen Toko",
        desc: "Form penyimpanan dokumen.",
        href: "/svdokumen",
        icon: FolderArchive,
    },
    {
        id: "menu-gantt",
        title: "Gantt Chart",
        desc: "Progress pekerjaan toko.",
        href: "/gantt",
        icon: BarChartHorizontal,
    },
    {
        id: "menu-sp",
        title: "Surat Peringatan",
        desc: "Form surat peringatan.",
        href: "#",
        icon: AlertTriangle,
        isAlert: true,
    },
    {
        id: "menu-monitoring",
        title: "Monitoring Dashboard",
        desc: "Pantau grafik progres dan status proyek real-time.",
        href: "/monitoring",
        icon: PieChart,
    },
    {
        id: "menu-approval",
        title: "Approval Dokumen",
        desc: "Persetujuan RAB, SPK, IL, dan Pertambahan SPK.",
        href: "/approval",
        icon: ClipboardCheck,
    },
    {
        id: "menu-daftardokumen",
        title: "Daftar Dokumen",
        desc: "Lihat daftar dokumen RAB, SPK, dan lainnya.",
        href: "/list",
        icon: FileStack,
    },
    {
        id: "menu-il",
        title: "Instruksi Lapangan",
        desc: "Form Instruksi Lapangan.",
        href: "/instruksi-lapangan",
        icon: FileText,
    },
    {
        id: "menu-users",
        title: "Manajemen User",
        desc: "Kelola data PIC dan akses aplikasi setiap cabang.",
        href: "/users",
        icon: Users,
    },
];

// -----------------------------------------------------------------------------
// KONFIGURASI AKSES MENU PER ROLE
// Setiap role hanya dapat mengakses menu yang id-nya terdaftar di bawah ini.
// -----------------------------------------------------------------------------

export const ROLE_CONFIG: Record<string, string[]> = {
    "BRANCH MANAGER": [
        "menu-approval", "menu-daftardokumen"
    ],

    "BRANCH BUILDING & MAINTENANCE MANAGER": [
        "menu-spk", "menu-opname", "menu-tambahspk",
        "menu-gantt", "menu-dokumentasi", "menu-svdokumen", "menu-sp",
        "menu-approval", "menu-daftardokumen"
    ],

    "BRANCH BUILDING SUPPORT DOKUMENTASI": [
        "menu-spk", "menu-opname", "menu-tambahspk",
        "menu-gantt", "menu-dokumentasi", "menu-svdokumen", "menu-sp",
        "menu-daftardokumen"
    ],

    "BRANCH BUILDING COORDINATOR": [
        "menu-dokumentasi", "menu-svdokumen", "menu-gantt",
        "menu-opname", "menu-sp", "menu-approval", "menu-daftardokumen", "menu-inputpic"
    ],

    "BRANCH BUILDING SUPPORT": [
        "menu-dokumentasi", "menu-opname", "menu-gantt",
        "menu-svdokumen", "menu-sp", "menu-daftardokumen", "menu-il"
    ],

    "DIREKTUR": [
        "menu-approval", "menu-daftardokumen",
    ],

    "KONTRAKTOR": [
        "menu-rab", "menu-opname", "menu-gantt", "menu-daftardokumen"
    ],
};

// -----------------------------------------------------------------------------
// KATEGORI PEKERJAAN
// Digunakan untuk validasi dan tampilan form RAB / Opname.
// -----------------------------------------------------------------------------

/** Kategori pekerjaan lingkup SIPIL */
export const SIPIL_CATEGORIES = [
    "PEKERJAAN PERSIAPAN",
    "PEKERJAAN BOBOKAN / BONGKARAN",
    "PEKERJAAN TANAH",
    "PEKERJAAN PONDASI & BETON",
    "PEKERJAAN PASANGAN",
    "PEKERJAAN BESI",
    "PEKERJAAN KERAMIK",
    "PEKERJAAN PLUMBING",
    "PEKERJAAN SANITARY & ACECORIES",
    "PEKERJAAN JANITOR",
    "PEKERJAAN ATAP",
    "PEKERJAAN KUSEN, PINTU & KACA",
    "PEKERJAAN FINISHING",
    "PEKERJAAN BEANSPOT",
    "PEKERJAAN AREA TERBUKA",
    "PEKERJAAN TAMBAHAN",
    "PEKERJAAN SBO",
];

/** Kategori pekerjaan lingkup ME (Mekanikal & Elektrikal) */
export const ME_CATEGORIES = [
    "INSTALASI",
    "FIXTURE",
    "PEKERJAAN TAMBAHAN",
    "PEKERJAAN SBO",
];

// -----------------------------------------------------------------------------
// MAPPING CABANG
// -----------------------------------------------------------------------------

/**
 * Pengelompokan cabang — beberapa cabang kecil berada di bawah satu cabang induk.
 * Digunakan untuk filter dan tampilan dashboard.
 */
export const BRANCH_GROUPS: Record<string, string[]> = {
    LOMBOK:    ["LOMBOK", "SUMBAWA"],
    CIKOKOL:   ["CIKOKOL", "BINTAN"],
    MEDAN:     ["MEDAN", "ACEH"],
    LAMPUNG:   ["LAMPUNG", "KOTABUMI"],
    PALEMBANG: ["PALEMBANG", "BENGKULU", "BANGKA", "BELITUNG"],
    SIDOARJO:  ["SIDOARJO", "SIDOARJO BPN_SMD", "MANOKWARI", "NTT", "SORONG"],
};

/**
 * Mapping nama cabang ke kode ULOK-nya.
 * Digunakan untuk keperluan API yang membutuhkan kode ULOK cabang.
 */
export const BRANCH_TO_ULOK: Record<string, string> = {
    "LUWU":            "2VZ1",
    "KARAWANG":        "1JZ1",
    "REMBANG":         "2AZ1",
    "BANJARMASIN":     "1GZ1",
    "PARUNG":          "1MZ1",
    "TEGAL":           "2PZ1",
    "GORONTALO":       "2SZ1",
    "PONTIANAK":       "1PZ1",
    "LOMBOK":          "1SZ1",
    "SUMBAWA":         "1SZ1",
    "KOTABUMI":        "LZ01",
    "SERANG":          "2GZ1",
    "CIANJUR":         "2JZ1",
    "BALARAJA":        "TZ01",
    "SIDOARJO":        "UZ01",
    "SIDOARJO BPN_SMD":"UZ01",
    "MANOKWARI":       "UZ01",
    "NTT":             "UZ01",
    "SORONG":          "UZ01",
    "MEDAN":           "WZ01",
    "ACEH":            "WZ01",
    "BOGOR":           "XZ01",
    "JEMBER":          "YZ01",
    "BALI":            "QZ01",
    "PALEMBANG":       "PZ01",
    "BENGKULU":        "PZ01",
    "BANGKA":          "PZ01",
    "BELITUNG":        "PZ01",
    "KLATEN":          "OZ01",
    "MAKASSAR":        "RZ01",
    "PLUMBON":         "VZ01",
    "PEKANBARU":       "1AZ1",
    "JAMBI":           "1DZ1",
    "HEAD OFFICE":     "Z001",
    "BANDUNG RAYA":    "BZ01",
    "BEKASI":          "CZ01",
    "CILACAP":         "IZ01",
    "CILEUNGSI":       "JZ01",
    "SEMARANG":        "HZ01",
    "CIKOKOL":         "KZ01",
    "LAMPUNG":         "LZ01",
    "MALANG":          "MZ01",
    "MANADO":          "1YZ1",
    "BATAM":           "2DZ1",
    "MADIUN":          "2MZ1",
    "BINTAN":          "KZ01",
};