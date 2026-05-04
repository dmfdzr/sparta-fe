"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
    Camera, ArrowRight, ArrowLeft, FileText, CheckCircle,
    Loader2, Image as ImageIcon, Ban, ChevronDown, Search
} from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';
import { useGlobalAlert } from '@/context/GlobalAlertContext';
import { PHOTO_POINTS, ALL_POINTS, TOTAL_PHOTOS, FLOOR_IMAGES, PAGE_LABELS, type PhotoPoint } from './photoPoints';
import CameraModal from './CameraModal';
import { submitDokumentasiBangunan, fetchSPKList } from '@/lib/api';


// =============================================================================
// TYPES
// =============================================================================
type PhotoData = { url: string; note: string | null; timestamp: string };
type FormData = {
    cabang: string; nomorUlok: string; kontraktorSipil: string; kontraktorMe: string;
    spkAwal: string; spkAkhir: string; kodeToko: string; namaToko: string;
    tanggalGo: string; tanggalSt: string; tanggalAmbilFoto: string;
};

type UlokOption = {
    nomorUlok: string; kontraktorSipil: string; kontraktorMe: string;
    spkAwal: string; spkAkhir: string; kodeToko: string; namaToko: string;
};

const emptyForm: FormData = {
    cabang: '', nomorUlok: '', kontraktorSipil: '', kontraktorMe: '',
    spkAwal: '', spkAkhir: '', kodeToko: '', namaToko: '',
    tanggalGo: '', tanggalSt: '', tanggalAmbilFoto: '',
};

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function FTDokumenPage() {
    const { showAlert } = useGlobalAlert();
    const [currentStep, setCurrentStep] = useState<'form' | 'floorplan'>('form');
    const [formData, setFormData] = useState<FormData>(emptyForm);
    const [photos, setPhotos] = useState<Record<number, PhotoData>>({});
    const [currentPhotoNumber, setCurrentPhotoNumber] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [cameraPoint, setCameraPoint] = useState<PhotoPoint | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [ulokOptions, setUlokOptions] = useState<UlokOption[]>([]);
    const [isLoadingUlok, setIsLoadingUlok] = useState(true);

    // Populate cabang from session + fetch ULOK data from SPK list
    useEffect(() => {
        const cabang = typeof window !== 'undefined' ? sessionStorage.getItem('loggedInUserCabang') || '' : '';
        setFormData(prev => ({ ...prev, cabang }));

        const loadUlokData = async () => {
            setIsLoadingUlok(true);
            try {
                // Ambil SPK yang sudah approved untuk mendapatkan data proyek
                const res = await fetchSPKList({ status: 'approved' });
                const spkList = res.data || [];

                // Kelompokkan SPK berdasarkan nomor_ulok, pisahkan kontraktor sipil & ME
                const grouped: Record<string, UlokOption> = {};
                for (const spk of spkList) {
                    const ulok = spk.nomor_ulok;
                    if (!ulok) continue;

                    if (!grouped[ulok]) {
                        grouped[ulok] = {
                            nomorUlok: ulok,
                            kontraktorSipil: '',
                            kontraktorMe: '',
                            spkAwal: spk.waktu_mulai || '',
                            spkAkhir: spk.waktu_selesai || '',
                            kodeToko: spk.kode_toko || spk.toko?.kode_toko || '',
                            namaToko: spk.toko?.nama_toko || '',
                        };
                    }

                    // Tentukan kontraktor sipil vs ME berdasarkan lingkup_pekerjaan
                    const lingkup = (spk.lingkup_pekerjaan || '').toUpperCase();
                    if (lingkup.includes('ME') || lingkup.includes('MEKANIKAL') || lingkup.includes('ELEKTRIKAL')) {
                        grouped[ulok].kontraktorMe = spk.nama_kontraktor || '';
                    } else {
                        grouped[ulok].kontraktorSipil = spk.nama_kontraktor || '';
                    }

                    // Gunakan tanggal paling awal dan paling akhir
                    if (spk.waktu_mulai && (!grouped[ulok].spkAwal || spk.waktu_mulai < grouped[ulok].spkAwal)) {
                        grouped[ulok].spkAwal = spk.waktu_mulai;
                    }
                    if (spk.waktu_selesai && (!grouped[ulok].spkAkhir || spk.waktu_selesai > grouped[ulok].spkAkhir)) {
                        grouped[ulok].spkAkhir = spk.waktu_selesai;
                    }
                }

                setUlokOptions(Object.values(grouped));
                if (Object.keys(grouped).length === 0) {
                    showAlert({ message: 'Tidak ada data SPK yang disetujui. Pastikan sudah ada SPK dengan status approved.', type: 'warning' });
                }
            } catch (err) {
                console.error('Gagal memuat data ULOK:', err);
                showAlert({ message: 'Gagal memuat daftar ULOK dari server.', type: 'error' });
            } finally {
                setIsLoadingUlok(false);
            }
        };

        loadUlokData();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const completedCount = Object.keys(photos).length;
    const progressPct = Math.round((completedCount / TOTAL_PHOTOS) * 100);

    const handleFormChange = (field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nomorUlok) { showAlert({ message: 'Pilih Nomor ULOK terlebih dahulu.', type: 'warning' }); return; }
        if (!formData.namaToko) { showAlert({ message: 'Isi Nama Toko.', type: 'warning' }); return; }
        setCurrentStep('floorplan');
    };

    const handleCapture = (pointId: number, data: PhotoData) => {
        setPhotos(prev => ({ ...prev, [pointId]: data }));
        if (pointId === currentPhotoNumber) {
            let next = pointId + 1;
            while (next <= TOTAL_PHOTOS && photos[next]) next++;
            setCurrentPhotoNumber(Math.min(next, TOTAL_PHOTOS));
        }
        setCameraPoint(null);
        showAlert({ message: `Foto #${pointId} berhasil disimpan!`, type: 'success' });
    };

    const handleSavePdf = async () => {
        if (completedCount < TOTAL_PHOTOS) {
            showAlert({ message: `Mohon lengkapi seluruh ${TOTAL_PHOTOS} foto sebelum menyimpan.`, type: 'warning' });
            return;
        }

        setIsSubmitting(true);
        try {
            const payloadFields: Record<string, string> = {
                cabang: formData.cabang,
                nomor_ulok: formData.nomorUlok,
                kontraktor_sipil: formData.kontraktorSipil,
                kontraktor_me: formData.kontraktorMe,
                spk_awal: formData.spkAwal,
                spk_akhir: formData.spkAkhir,
                kode_toko: formData.kodeToko,
                nama_toko: formData.namaToko,
                tanggal_go: formData.tanggalGo,
                tanggal_serah_terima: formData.tanggalSt,
                tanggal_ambil_foto: formData.tanggalAmbilFoto,
                email_pengirim: sessionStorage.getItem('loggedInUserEmail') || '',
                status_validasi: 'submitted',
                pic_dokumentasi: sessionStorage.getItem('loggedInUserName') || 'PIC'
            };

            await submitDokumentasiBangunan(payloadFields, photos);
            showAlert({ message: 'Dokumentasi berhasil disimpan dan sedang diproses!', type: 'success' });
            
            // Reset form
            setFormData(emptyForm);
            setPhotos({});
            setCurrentStep('form');
            setCurrentPage(1);
            setCurrentPhotoNumber(1);
        } catch (error: any) {
            showAlert({ message: error.message || 'Gagal menyimpan dokumentasi.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <AppNavbar title="Dokumentasi Bangunan Toko Baru" showBackButton backHref="/dashboard" />

            <main className="max-w-6xl mx-auto p-4 md:p-8 mt-4 pb-24">
                {currentStep === 'form' ? (
                    <DataFormView
                        formData={formData}
                        onChange={handleFormChange}
                        onSubmit={handleFormSubmit}
                        setFormData={setFormData}
                        ulokOptions={ulokOptions}
                        isLoadingUlok={isLoadingUlok}
                    />
                ) : (
                    <FloorPlanView
                        formData={formData}
                        photos={photos}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                        currentPhotoNumber={currentPhotoNumber}
                        completedCount={completedCount}
                        progressPct={progressPct}
                        isSubmitting={isSubmitting}
                        onBack={() => setCurrentStep('form')}
                        onPointClick={(p) => setCameraPoint(p)}
                        onSavePdf={handleSavePdf}
                    />
                )}
            </main>

            {cameraPoint && (
                <CameraModal
                    point={cameraPoint}
                    existingPhoto={photos[cameraPoint.id] || null}
                    onClose={() => setCameraPoint(null)}
                    onCapture={handleCapture}
                />
            )}
        </>
    );
}

// =============================================================================
// DATA FORM VIEW
// =============================================================================
function DataFormView({ formData, onChange, onSubmit, setFormData, ulokOptions, isLoadingUlok }: {
    formData: FormData;
    onChange: (field: keyof FormData, value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    setFormData: React.Dispatch<React.SetStateAction<FormData>>;
    ulokOptions: UlokOption[];
    isLoadingUlok: boolean;
}) {
    const handleUlokSelect = (val: string) => {
        const selected = ulokOptions.find(u => u.nomorUlok === val);
        if (selected) {
            setFormData(prev => ({
                ...prev,
                nomorUlok: selected.nomorUlok,
                kontraktorSipil: selected.kontraktorSipil,
                kontraktorMe: selected.kontraktorMe,
                spkAwal: selected.spkAwal,
                spkAkhir: selected.spkAkhir,
                kodeToko: selected.kodeToko,
                namaToko: selected.namaToko,
            }));
        } else {
            onChange('nomorUlok', val);
        }
    };

    return (
        <Card className="mb-8 shadow-sm border-slate-200">
            <CardHeader className="border-b bg-slate-50/50 pb-4">
                <CardTitle className="text-red-700 flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Data & Identitas Proyek
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <form onSubmit={onSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label>Nomor ULOK <span className="text-red-500">*</span></Label>
                            {isLoadingUlok ? (
                                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-400">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Memuat daftar ULOK...
                                </div>
                            ) : (
                                <Select onValueChange={handleUlokSelect} value={formData.nomorUlok} required>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="-- Pilih Nomor ULOK --" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ulokOptions.map(ulok => (
                                            <SelectItem key={ulok.nomorUlok} value={ulok.nomorUlok}>
                                                {ulok.nomorUlok} — {ulok.namaToko || ulok.kodeToko}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Kontraktor Sipil <span className="text-red-500">*</span></Label>
                            <Input readOnly value={formData.kontraktorSipil} className="bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200" placeholder="Terisi otomatis" tabIndex={-1} />
                        </div>
                        <div className="space-y-2">
                            <Label>Kontraktor ME <span className="text-red-500">*</span></Label>
                            <Input readOnly value={formData.kontraktorMe} className="bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200" placeholder="Terisi otomatis" tabIndex={-1} />
                        </div>
                        <div className="space-y-2">
                            <Label>SPK Awal <span className="text-red-500">*</span></Label>
                            <Input type="date" readOnly value={formData.spkAwal} className="bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200" tabIndex={-1} />
                        </div>
                        <div className="space-y-2">
                            <Label>SPK Akhir <span className="text-red-500">*</span></Label>
                            <Input type="date" readOnly value={formData.spkAkhir} className="bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200" tabIndex={-1} />
                        </div>
                        <div className="space-y-2">
                            <Label>Kode Toko <span className="text-red-500">*</span></Label>
                            <Input readOnly value={formData.kodeToko} className="bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200 font-bold" placeholder="Terisi otomatis" tabIndex={-1} />
                        </div>
                        <div className="space-y-2 lg:col-span-3">
                            <Label>Nama Toko <span className="text-red-500">*</span></Label>
                            <Input readOnly value={formData.namaToko} className="bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200 font-bold" placeholder="Terisi otomatis" tabIndex={-1} />
                        </div>
                        <div className="space-y-2">
                            <Label>Tanggal GO <span className="text-red-500">*</span></Label>
                            <Input type="date" value={formData.tanggalGo} onChange={e => onChange('tanggalGo', e.target.value)} className="bg-white" required />
                        </div>
                        <div className="space-y-2">
                            <Label>Tanggal ST <span className="text-red-500">*</span></Label>
                            <Input type="date" value={formData.tanggalSt} onChange={e => onChange('tanggalSt', e.target.value)} className="bg-white" required />
                        </div>
                        <div className="space-y-2">
                            <Label>Tanggal Ambil Foto <span className="text-red-500">*</span></Label>
                            <Input type="date" value={formData.tanggalAmbilFoto} onChange={e => onChange('tanggalAmbilFoto', e.target.value)} className="bg-white" required />
                        </div>
                    </div>
                    <div className="flex justify-end mt-8 border-t border-slate-100 pt-6">
                        <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-2.5">
                            <ArrowRight className="w-4 h-4 mr-2" /> Lanjut ke Denah & Foto
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

// =============================================================================
// FLOOR PLAN VIEW
// =============================================================================
function FloorPlanView({ formData, photos, currentPage, setCurrentPage, currentPhotoNumber, completedCount, progressPct, isSubmitting, onBack, onPointClick, onSavePdf }: {
    formData: FormData; photos: Record<number, PhotoData>;
    currentPage: number; setCurrentPage: (p: number) => void;
    currentPhotoNumber: number; completedCount: number; progressPct: number;
    isSubmitting: boolean;
    onBack: () => void; onPointClick: (p: PhotoPoint) => void; onSavePdf: () => void;
}) {
    const pagePoints = PHOTO_POINTS[currentPage] || [];

    return (
        <Card className="shadow-sm border-slate-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-white rounded-t-xl">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={onBack} className="text-red-600 font-semibold text-sm flex items-center gap-1 hover:underline">
                        <ArrowLeft className="w-4 h-4" /> Kembali ke Data
                    </button>
                    <div className="text-right">
                        <div className="font-bold text-red-600">{formData.namaToko || '-'} ({formData.kodeToko || '-'})</div>
                        <div className="text-xs text-slate-500">{formData.tanggalAmbilFoto || '-'}</div>
                    </div>
                </div>
                {/* Progress */}
                <div className="bg-slate-100 h-2.5 rounded-full overflow-hidden mb-1">
                    <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="text-right text-xs text-slate-500 font-medium">Progress: {completedCount}/{TOTAL_PHOTOS} foto</div>
            </div>

            <CardContent className="p-5">
                <div className="grid grid-cols-1 lg:grid-cols-[2.5fr_1fr] gap-5">
                    {/* Left: Floor plan */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        {/* Page tabs */}
                        <div className="flex justify-center gap-2 mb-4 flex-wrap">
                            {[1, 2, 3].map(pg => (
                                <button key={pg} onClick={() => setCurrentPage(pg)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${currentPage === pg ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:border-red-300'}`}>
                                    {pg}. {PAGE_LABELS[pg]}
                                </button>
                            ))}
                        </div>

                        {/* Denah image with points */}
                        <div className="relative w-full" style={{ paddingTop: '75%' }}>
                            <img src={FLOOR_IMAGES[currentPage]} alt={`Denah ${PAGE_LABELS[currentPage]}`}
                                className="absolute inset-0 w-full h-full object-contain rounded" />
                            {pagePoints.map(p => {
                                const done = !!photos[p.id];
                                const isActive = p.id === currentPhotoNumber;
                                const isLocked = !done && p.id > currentPhotoNumber;
                                const isMissed = !done && p.id < currentPhotoNumber;

                                let bg = 'bg-slate-400'; // pending
                                if (done) bg = 'bg-emerald-600';
                                else if (isActive) bg = 'bg-green-500 animate-pulse';
                                else if (isMissed) bg = 'bg-slate-400 opacity-50';

                                return (
                                    <button key={p.id} title={done ? `✓ ${p.label}` : p.label}
                                        disabled={isLocked}
                                        onClick={() => onPointClick(p)}
                                        className={`absolute w-5 h-5 md:w-4 md:h-4 rounded-full flex items-center justify-center text-[8px] md:text-[7px] font-bold text-white border-2 border-white shadow-md transition-all hover:scale-125 z-10 ${bg} ${isLocked ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                                        style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}>
                                        {p.id}
                                        {done && (
                                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white text-emerald-600 rounded-full flex items-center justify-center text-[6px] font-bold shadow">✓</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Photo list */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col max-h-150">
                        <h3 className="font-bold text-red-600 text-sm mb-3 flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4" /> Daftar Foto ({completedCount}/{TOTAL_PHOTOS})
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {pagePoints.map(p => {
                                const photo = photos[p.id];
                                return (
                                    <div key={p.id}
                                        onClick={() => { if (!(!photo && p.id > currentPhotoNumber)) onPointClick(p); }}
                                        className={`p-3 rounded-lg border-2 transition cursor-pointer text-xs ${photo
                                            ? 'border-l-4 border-l-green-500 border-slate-200 bg-green-50'
                                            : p.id === currentPhotoNumber
                                                ? 'border-red-300 bg-red-50'
                                                : 'border-slate-200 bg-white opacity-60'
                                            }`}>
                                        <div className="font-bold text-red-600">{p.id}</div>
                                        <div className="text-slate-600 text-[11px] leading-tight">{p.label}</div>
                                        {photo?.note && (
                                            <div className="mt-1 text-[10px] text-red-600 border border-red-300 rounded px-1.5 py-0.5 text-center font-semibold">
                                                {photo.note}
                                            </div>
                                        )}
                                        {photo && photo.url && (
                                            <img src={photo.url} alt={`Foto ${p.id}`} className="w-full h-12 object-cover rounded mt-1.5" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-200">
                            <Button onClick={onSavePdf} disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold shadow-md">
                                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                                {isSubmitting ? 'Menyimpan...' : 'Simpan & Kirim PDF'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Completion banner */}
                {completedCount === TOTAL_PHOTOS && (
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                        <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <h3 className="font-bold text-green-800">Semua Foto Lengkap! 🎉</h3>
                        <p className="text-sm text-green-600">Silakan tekan tombol &quot;Simpan & Kirim PDF&quot; di atas.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
