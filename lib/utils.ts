// =============================================================================
// lib/utils.ts
// Kumpulan helper / utility function yang digunakan di seluruh aplikasi.
// =============================================================================

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// -----------------------------------------------------------------------------
// TAILWIND MERGE
// -----------------------------------------------------------------------------

/** Menggabungkan class Tailwind secara aman (menghindari konflik class). */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// -----------------------------------------------------------------------------
// FORMAT ANGKA & MATA UANG
// -----------------------------------------------------------------------------

/**
 * Memformat angka menjadi format Rupiah Indonesia.
 * Contoh: 1500000 → "Rp 1.500.000"
 */
export const formatRupiah = (num: number): string => {
    return (
        "Rp " +
        new Intl.NumberFormat("id-ID", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(num)
    );
};

/**
 * Memformat angka menjadi format skor (desimal 2 angka, locale Indonesia).
 * Contoh: 98.5 → "98,50"
 */
export const formatScore = (num: number): string => {
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(num);
};

// -----------------------------------------------------------------------------
// PARSING NILAI
// -----------------------------------------------------------------------------

/**
 * Mengubah berbagai format nilai mata uang (string/number) menjadi number.
 * - Mendukung format "1.500.000,50" (ID locale)
 * - Mengembalikan 0 jika input tidak valid atau error (#REF!, Error, dll.)
 */
export const parseCurrency = (value: any): number => {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        if (value.includes("#REF!") || value.includes("Error")) return 0;
        
        // Handle standard numeric strings (e.g. "12500000.00" or "12500000")
        // This prevents the "extra zero" bug where .00 is treated as thousands
        if (/^\d+(\.\d+)?$/.test(value)) return parseFloat(value);
        
        const cleaned = value.replace(/\./g, "").replace(/,/g, ".");
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

/**
 * Mengubah nilai skor (0–100 atau 0–1) menjadi angka desimal 0–1.
 * Jika nilai > 100, diasumsikan sudah dalam skala 100 dan akan dibagi 100.
 */
export const parseScore = (value: any): number => {
    if (!value) return 0;
    const num =
        typeof value === "number"
            ? value
            : parseFloat(String(value).replace(/,/g, "."));
    if (isNaN(num)) return 0;
    return num > 100 ? num / 100 : num;
};

// -----------------------------------------------------------------------------
// PARSING TANGGAL
// -----------------------------------------------------------------------------

/**
 * Mengekstrak tahun (4 digit) dari string tanggal dalam format apapun.
 * Contoh: "15 Januari 2024" → "2024"
 * Mengembalikan null jika tidak ditemukan.
 */
export const getYearFromDate = (dateStr: string): string | null => {
    if (!dateStr) return null;
    const match = dateStr.match(/\d{4}/);
    return match ? match[0] : null;
};
import imageCompression from 'browser-image-compression';

/**
 * Mengkompres ukuran gambar sebelum diupload.
 * Default max size: ~1MB, max dimension: 1920px.
 */
export const compressImage = async (file: File): Promise<File> => {
    // Hanya proses file gambar
    if (!file.type.startsWith('image/')) return file;
    
    // Jangan compress SVG atau GIF
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;

    const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/jpeg'
    };

    try {
        const compressedBlob = await imageCompression(file, options);
        // Pertahankan nama file asli, namun extensi mungkin berubah jadi jpeg
        return new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '') + '.jpeg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
        });
    } catch (error) {
        console.error('Error compressing image:', error);
        return file; // fallback ke file asli jika gagal
    }
};

