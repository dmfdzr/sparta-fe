"use client"

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// Import AppNavbar
import AppNavbar from '@/components/AppNavbar';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// ChevronLeft dihapus karena sudah ada di AppNavbar
import { Lock, Send, Loader2, Info, Plus, Trash2 } from 'lucide-react'; 
import { 
    fetchGanttDetail, fetchGanttList, submitGanttChart, 
    updateGanttChart, lockGanttChart, deleteGanttChart, 
    updateGanttDelay, updateGanttSpeed, fetchGanttDetailByToko,
    fetchTokoList
} from '@/lib/api';
import type { GanttListItem } from '@/lib/api';
import { API_URL } from '@/lib/constants';

// --- ATURAN PENGAWASAN (SUPERVISION RULES) ---
const SUPERVISION_RULES: Record<number, number[]> = {
    10: [2, 5, 8, 10],
    14: [2, 7, 10, 14],
    20: [2, 12, 16, 20],
    30: [2, 7, 14, 18, 23, 30],
    35: [2, 7, 17, 22, 28, 35],
    40: [2, 7, 17, 25, 33, 40],
    48: [2, 10, 25, 32, 41, 48]
};

const DAY_WIDTH = 40;
const ROW_HEIGHT = 50;

// --- FUNGSI HELPER BARU (PERBAIKAN FORMAT STRIP) ---
function formatUlokWithDash(ulok: string) {
    if (!ulok) return "";
    // Jika sudah ada strip, biarkan saja
    if (ulok.includes("-")) return ulok;
    
    // Format Z00126028989 -> Z001-2602-8989
    const clean = ulok.replace(/[^a-zA-Z0-9]/g, '');
    if (clean.length === 11 || clean.length === 12) {
        return `${clean.substring(0,4)}-${clean.substring(4,8)}-${clean.substring(8)}`;
    }
    return ulok;
}

function parseDateDDMMYYYY(dateStr: string) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return null;
}

function formatDateID(date: Date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

// --- KOMPONEN UTAMA GANTT ---
function GanttBoard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const urlUlok = searchParams.get('ulok');
    const urlIdToko = searchParams.get('id_toko');

    const [appMode, setAppMode] = useState<'kontraktor' | 'pic' | null>(null);
    const [userRole, setUserRole] = useState('');
    
    // Perbaikan: Pastikan urlUlok yang masuk diformat pakai strip jika perlu
    const [selectedUlok, setSelectedUlok] = useState(formatUlokWithDash(urlUlok || ''));
    // ID Gantt Chart yang sedang aktif — digunakan untuk reload setelah save/delay
    const [selectedGanttId, setSelectedGanttId] = useState<number | null>(null);
    
    const [projectData, setProjectData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isProjectLocked, setIsProjectLocked] = useState(false);
    const [availableProjects, setAvailableProjects] = useState<GanttListItem[]>([]);
    const [allTokoList, setAllTokoList] = useState<any[]>([]);
    const [isDirectAccess, setIsDirectAccess] = useState(false);

    // State Tabel / Tasks
    const [tasks, setTasks] = useState<any[]>([]);
    const [isApplying, setIsApplying] = useState(false);

    // State Delay (PIC)
    const [delayTaskIdx, setDelayTaskIdx] = useState<string>('');
    const [delayDays, setDelayDays] = useState<number>(0);

    const [speedTaskIdx, setSpeedTaskIdx] = useState<string>('');
    const [speedDays, setSpeedDays] = useState<number>(0);

    const [rawDayGanttData, setRawDayGanttData] = useState<any[]>([]);

    useEffect(() => {
        const role = sessionStorage.getItem('userRole');
        const cabang = sessionStorage.getItem('loggedInUserCabang'); 
        const email = sessionStorage.getItem('loggedInUserEmail'); 

        if (!role) {
            alert("Sesi Anda telah habis. Silakan login kembali.");
            router.push('/auth');
            return;
        }

        setUserRole(role);
        let currentAppMode: 'kontraktor' | 'pic' = 'kontraktor';
        const picRoles = ['BRANCH BUILDING & MAINTENANCE MANAGER', 'BRANCH BUILDING COORDINATOR', 'BRANCH BUILDING SUPPORT'];
        
        if (role === 'KONTRAKTOR') {
            currentAppMode = 'kontraktor';
            setAppMode('kontraktor');
        } else if (picRoles.includes(role.toUpperCase())) {
            currentAppMode = 'pic';
            setAppMode('pic');
        } else {
            alert("Anda tidak memiliki akses.");
            router.push('/dashboard');
            return;
        }

        if (urlIdToko) {
            loadDataByToko(parseInt(urlIdToko));
        } else {
            const filters = currentAppMode === 'kontraktor'
                ? { email_pembuat: email || '' }
                : { status: 'active' };

            fetchGanttList(filters)
                .then(res => setAvailableProjects(res.data || []))
                .catch(err => console.error("Gagal memuat list Gantt Chart:", err));
        }

        // Cek apakah akses langsung atau dari parameter (RAB)
        if (!urlUlok && !urlIdToko) {
            setIsDirectAccess(true);
        }

        // Ambil daftar seluruh toko untuk dropdown
        fetchTokoList()
            .then(res => setAllTokoList(res.data || []))
            .catch(err => console.error("Gagal memuat semua daftar Toko:", err));
        
    }, [router, urlIdToko]);

    const loadDataByToko = async (idToko: number) => {
        setIsLoading(true);
        try {
            const res = await fetchGanttDetailByToko(idToko);
            const { rab, filtered_categories, gantt_data, toko } = res;

            if (gantt_data) {
                // JIKA GANTT SUDAH ADA: Langsung gunakan fungsi loadGanttDetail yang sudah ada
                await loadGanttDetail(gantt_data.id);
            } else {
                // JIKA BELUM ADA GANTT: Bikin draft baru dari kategori RAB
                setSelectedGanttId(null);
                setIsProjectLocked(false);
                setSelectedUlok(formatUlokWithDash(toko.nomor_ulok));
                
                if (!rab) {
                    alert("Info: RAB belum disetujui atau belum ada untuk toko ini.");
                }
                
                // Set data proyek awal
                setProjectData({
                    ganttId: null,
                    ulokClean: formatUlokWithDash(toko.nomor_ulok),
                    store: toko.nama_toko || "Data Toko",
                    kode_toko: toko.kode_toko || "-",
                    work: toko.lingkup_pekerjaan || "SIPIL",
                    cabang: toko.cabang || "-",
                    kontraktor: toko.nama_kontraktor || "-",
                    duration: 0,
                    startDate: new Date().toISOString().split('T')[0],
                });
                
                // Buat baris pekerjaan (tasks) otomatis dari filtered_categories RAB
                const generatedTasks = filtered_categories.map((kName, idx) => ({
                    id: idx + 1, 
                    name: kName, 
                    dependencies: [], 
                    ranges: [{ start: '', end: '', keterlambatan: 0 }], 
                    keterlambatan: 0
                }));
                
                setTasks(generatedTasks);
                setRawDayGanttData([]);
            }
        } catch (err: any) {
            console.error(err);
            alert(`Gagal memuat data Toko: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const loadGanttDetail = async (ganttId: number) => {
        if (!ganttId) return;
        setIsLoading(true);
        setSelectedGanttId(ganttId);

        try {
            const { data } = await fetchGanttDetail(ganttId);
            const { gantt, toko, kategori_pekerjaan, day_items, dependencies } = data;

            // --- Hitung projectStart dan Durasi dengan lebih aman (Functional Approach) ---

            // 1. Ekstrak semua timestamp yang valid dari day_items
            const startTimestamps = day_items
                .map(entry => parseDateDDMMYYYY(entry.h_awal)?.getTime())
                .filter((time): time is number => time !== undefined && time !== null && !isNaN(time));

            const endTimestamps = day_items
                .map(entry => parseDateDDMMYYYY(entry.h_akhir)?.getTime())
                .filter((time): time is number => time !== undefined && time !== null && !isNaN(time));

            // 2. Dapatkan nilai paling awal (min) dan paling akhir (max)
            const startTime = startTimestamps.length > 0 ? Math.min(...startTimestamps) : null;
            const endTime = endTimestamps.length > 0 ? Math.max(...endTimestamps) : null;

            // 3. Set projectStart
            let projectStart = new Date();
            if (startTime) {
                projectStart = new Date(startTime);
            }

            // 4. Hitung durasi
            const msPerDay = 1000 * 60 * 60 * 24;
            const duration = (startTime && endTime)
                ? Math.round((endTime - startTime) / msPerDay) + 1
                : 0;

            // --- Set project info ---
            setSelectedUlok(formatUlokWithDash(toko.nomor_ulok));
            setProjectData({
                ganttId:    gantt.id,
                ulokClean:  formatUlokWithDash(toko.nomor_ulok),
                store:      toko.nama_toko || "Data Toko Ditemukan",
                kode_toko:  toko.kode_toko || "-",
                work:       toko.lingkup_pekerjaan || "SIPIL",
                cabang:     toko.cabang || "-",
                kontraktor: toko.nama_kontraktor || "-",
                duration,
                startDate:  projectStart.toISOString().split('T')[0],
            });

            setIsProjectLocked(['terkunci', 'locked', 'published'].includes(gantt.status.toLowerCase()));

            // --- Normalisasi rawDayGanttData: map ke format lama (Kategori, h_awal, h_akhir)
            //     agar handlePICDelaySave, removeRange, & delay-select tidak perlu diubah ---
            const normalizedRaw = day_items.map(d => ({
                Kategori:  d.kategori_pekerjaan,
                h_awal:    d.h_awal,
                h_akhir:   d.h_akhir,
                keterlambatan: d.keterlambatan ?? 0,
                kecepatan:     d.kecepatan ?? "",
                // simpan id asli jika dibutuhkan nanti
                _id:       d.id,
                _id_gantt: d.id_gantt,
            }));
            setRawDayGanttData(normalizedRaw);

            // --- Build tasks dari kategori_pekerjaan ---
            // Type eksplisit any[] agar reassignment .map() berikutnya tidak konflik dengan inferensi never[]
            let generatedTasks: any[] = kategori_pekerjaan.map((k, idx) => ({
                id: idx + 1, name: k.kategori_pekerjaan, dependencies: [], ranges: [], keterlambatan: 0
            }));

            // --- Map ranges dari day_items ---
            const categoryRangesMap: Record<string, any[]> = {};
            day_items.forEach(entry => {
                const startDate = parseDateDDMMYYYY(entry.h_awal);
                const endDate   = parseDateDDMMYYYY(entry.h_akhir);
                if (startDate && endDate) {
                    const startDay = Math.round((startDate.getTime() - projectStart.getTime()) / msPerDay) + 1;
                    const endDay   = Math.round((endDate.getTime()   - projectStart.getTime()) / msPerDay) + 1;
                    const key = entry.kategori_pekerjaan.toLowerCase().trim();
                    if (!categoryRangesMap[key]) categoryRangesMap[key] = [];
                    categoryRangesMap[key].push({
                        start:         startDay > 0 ? startDay : 1,
                        end:           endDay   > 0 ? endDay   : 1,
                        duration:      endDay - startDay + 1,
                        keterlambatan: parseInt(String(entry.keterlambatan || 0)),
                    });
                }
            });

            // --- Map dependencies --- 
            // API baru: child = kategori_pekerjaan, parent = kategori_pekerjaan_terikat
            const depMap: Record<string, string[]> = {};
            dependencies.forEach(dep => {
                const child  = dep.kategori_pekerjaan.toLowerCase().trim();
                const parent = dep.kategori_pekerjaan_terikat.toLowerCase().trim();
                if (!depMap[child]) depMap[child] = [];
                depMap[child].push(parent);
            });

            generatedTasks = generatedTasks.map(task => {
                const tName = task.name.toLowerCase().trim();

                // Match ranges (exact key match lebih diprioritaskan)
                const matchedRanges = categoryRangesMap[tName]
                    ?? Object.entries(categoryRangesMap).find(([k]) => tName.includes(k) || k.includes(tName))?.[1]
                    ?? [];

                // Match parent ids dari depMap
                const parentIds: number[] = [];
                (depMap[tName] || []).forEach(parentName => {
                    const parentObj = generatedTasks.find(t => t.name.toLowerCase().trim() === parentName);
                    if (parentObj) parentIds.push(parentObj.id);
                });

                return {
                    ...task,
                    ranges:       matchedRanges.length > 0 ? matchedRanges : [{ start: '', end: '', keterlambatan: 0 }],
                    dependencies: parentIds,
                };
            });

            setTasks(generatedTasks);

        } catch (err: any) {
            console.error(err);
            alert(`Sistem: ${err.message}`);
            setProjectData(null);
            setTasks([]);
        } finally {
            setIsLoading(false);
        }
    };

  // --- HANDLER TABEL INPUT ---
    const handleRangeChange = (taskId: number, rangeIdx: number, field: 'start'|'end', value: string) => {
        setTasks(prev => prev.map(t => {
            if(t.id === taskId) {
                const newRanges = [...t.ranges];
                newRanges[rangeIdx][field] = value;
                return {...t, ranges: newRanges};
            }
            return t;
        }));
    };

    const handleDependencyChange = (taskId: number, parentIdStr: string) => {
        setTasks(prev => prev.map(t => {
            if(t.id === taskId) {
                return {...t, dependencies: parentIdStr ? [parseInt(parentIdStr)] : []};
            }
            return t;
        }));
    };

    const addRange = (taskId: number) => {
        setTasks(prev => prev.map(t => {
            if(t.id === taskId) {
                return {...t, ranges: [...t.ranges, {start: '', end: '', keterlambatan: 0}]};
            }
            return t;
        }));
    };

    const removeRange = async (taskId: number, rangeIdx: number) => {
        const taskObj = tasks.find(t => t.id === taskId);
        if (!taskObj) return;

        const rangeToRemove = taskObj.ranges[rangeIdx];
        
        if (rangeToRemove.start && rangeToRemove.end) {
            const isConfirmed = window.confirm("Hapus periode ini? Jangan lupa untuk klik 'Simpan Draft' agar penghapusan tersimpan di server.");
            if (!isConfirmed) return;
            
        }

        // Langsung update UI state
        setTasks(prev => prev.map(t => {
            if(t.id === taskId) {
                const newRanges = t.ranges.filter((_: any, i: number) => i !== rangeIdx);
                // Jika semua range terhapus, sisakan satu form kosong agar user bisa input lagi
                if (newRanges.length === 0) newRanges.push({start: '', end: '', keterlambatan: 0});
                return {...t, ranges: newRanges};
            }
            return t;
        }));
    };

  // --- API SUBMIT FUNCTIONS ---
    const handleSaveData = async (status: 'Active' | 'Terkunci') => {
        setIsApplying(true);
        try {
            const email = sessionStorage.getItem('loggedInUserEmail') || "-";
            const cabang = sessionStorage.getItem('loggedInUserCabang') || "-";
            const namaKontraktor = sessionStorage.getItem('loggedInUserName') || sessionStorage.getItem('loggedInUserEmail') || "-";
            const pStart = new Date(projectData.startDate);

            const kategori_pekerjaan: string[] = [];
            const day_items: any[] = [];
            const dependencies: any[] = [];

            const pengawasanSet = new Set<string>(
                (rawDayGanttData || []).map((d: any) => (d.Kategori || '').toUpperCase().trim())
            );
            const pengawasan = Array.from(pengawasanSet).map(k => ({ kategori_pekerjaan: k }));

            tasks.forEach(t => {
                const kategoriName = t.name.toUpperCase();
                kategori_pekerjaan.push(kategoriName);
                
                // 1. Map Day Items
                if (t.ranges && t.ranges.length > 0) {
                    t.ranges.forEach((r: any) => {
                        if (!r.start || !r.end) return;
                        const rdS = new Date(pStart); rdS.setDate(pStart.getDate() + parseInt(r.start) - 1);
                        const rdE = new Date(pStart); rdE.setDate(pStart.getDate() + parseInt(r.end) - 1);
                        
                        day_items.push({
                            kategori_pekerjaan: kategoriName,
                            h_awal: formatDateID(rdS),
                            h_akhir: formatDateID(rdE),
                            keterlambatan: String(r.keterlambatan || ""),
                            kecepatan: ""
                        });
                    });
                }

                // 2. Map Dependencies
                if (t.dependencies && t.dependencies.length > 0) {
                    t.dependencies.forEach((pId: number) => {
                        const pTask = tasks.find(pt => pt.id === pId);
                        if (pTask) {
                            dependencies.push({
                                kategori_pekerjaan: kategoriName,
                                kategori_pekerjaan_terikat: pTask.name.toUpperCase()
                            });
                        }
                    });
                }
            });

            // Validasi minimal sebelum kirim
            if (day_items.length === 0) {
                throw new Error("Harap isi tanggal mulai dan selesai minimal satu tahapan.");
            }

            if (selectedGanttId) {
                // JIKA MENGEDIT DRAFT YANG SUDAH ADA (Gunakan PUT)
                const updatePayload = {
                    kategori_pekerjaan,
                    day_items,
                    pengawasan,
                    dependencies
                };
                await updateGanttChart(selectedGanttId, updatePayload);

                // JIKA USER MENEKAN TOMBOL KUNCI, PANGGIL ENDPOINT LOCK
                if (status === 'Terkunci') {
                    await lockGanttChart(selectedGanttId, email); // <-- Tambahan parameter email
                }
            } else {
                const payload = {
                    nomor_ulok: projectData.ulokClean,
                    nama_toko: projectData.store,
                    kode_toko: projectData.kode_toko,
                    proyek: "Reguler",
                    cabang: cabang,
                    alamat: "-",
                    nama_kontraktor: namaKontraktor,
                    lingkup_pekerjaan: projectData.work.toUpperCase(),
                    email_pembuat: email,
                    kategori_pekerjaan,
                    day_items,
                    pengawasan,
                    dependencies
                };
                const submitRes = await submitGanttChart(payload);
                
                if (status === 'Terkunci' && submitRes.data?.id) {
                    await lockGanttChart(submitRes.data.id, email);
                }
            }

            if (status === 'Terkunci') {
                alert("Berhasil! Jadwal telah dikunci.");
                router.push('/dashboard');
            } else {
                alert("Draft berhasil disimpan.");
                if (selectedGanttId) loadGanttDetail(selectedGanttId);
            }
        } catch (e: any) {
            alert(`Gagal menyimpan data: ${e.message}`);
            console.error(e);
        } finally {
            setIsApplying(false);
        }
    };

    const handleDeleteGantt = async () => {
        if (!selectedGanttId) return;

        const isConfirmed = window.confirm("Hapus draft jadwal ini? Semua data periode dan keterikatan di dalamnya akan terhapus permanen.");
        if (!isConfirmed) return;

        setIsApplying(true);
        try {
            await deleteGanttChart(selectedGanttId);
            alert("Draft jadwal berhasil dihapus.");
            
            // Reset tampilan ke awal
            setSelectedGanttId(null);
            setProjectData(null);
            setTasks([]);
            
            // Refresh list dropdown (Opsional)
            window.location.reload(); 
        } catch (error: any) {
            alert(`Gagal menghapus: ${error.message}`);
        } finally {
            setIsApplying(false);
        }
    };

    const handlePICDelaySave = async () => {
        if (!selectedGanttId) return alert("Proyek belum dipilih.");
        if (!delayTaskIdx || delayDays < 0) return alert("Pilih tahapan dan masukkan jumlah hari yang valid.");
        
        const item = rawDayGanttData[parseInt(delayTaskIdx)];
        if (!item) return;

        setIsApplying(true); // Tambahkan loading state agar tombol disable saat proses
        try {
            // Payload baru sesuai spesifikasi No. 8
            const payload = {
                kategori_pekerjaan: item.Kategori.toUpperCase(),
                h_awal: item.h_awal,
                h_akhir: item.h_akhir,
                keterlambatan: delayDays.toString() // Diubah menjadi string sesuai aturan API
            };
            
            await updateGanttDelay(selectedGanttId, payload);
            
            alert("Keterlambatan berhasil diterapkan.");
            
            // Reset form delay dan refresh data chart
            setDelayTaskIdx('');
            setDelayDays(0);
            loadGanttDetail(selectedGanttId);

        } catch (err: any) {
            console.error("Gagal update keterlambatan:", err);
            alert(`Gagal menyimpan: ${err.message}`);
        } finally {
            setIsApplying(false);
        }
    };

    const handlePICSpeedSave = async () => {
        if (!selectedGanttId) return alert("Proyek belum dipilih.");
        if (!speedTaskIdx || speedDays < 0) return alert("Pilih tahapan dan masukkan jumlah hari yang valid.");
        
        const item = rawDayGanttData[parseInt(speedTaskIdx)];
        if (!item) return;

        setIsApplying(true);
        try {
            const payload = {
                kategori_pekerjaan: item.Kategori.toUpperCase(),
                h_awal: item.h_awal,
                h_akhir: item.h_akhir,
                kecepatan: speedDays.toString()
            };
            
            await updateGanttSpeed(selectedGanttId, payload);
            
            alert("Percepatan (Kecepatan) berhasil diterapkan.");
            
            setSpeedTaskIdx('');
            setSpeedDays(0);
            loadGanttDetail(selectedGanttId);

        } catch (err: any) {
            console.error("Gagal update kecepatan:", err);
            alert(`Gagal menyimpan: ${err.message}`);
        } finally {
            setIsApplying(false);
        }
    };

  // --- LOGIKA KALKULASI GRAFIK (RIPPLE EFFECT) ---
    const chartData = useMemo(() => {
        if (!projectData || tasks.length === 0) return null;

        let processedTasks = [...tasks];
        let maxTaskEndDay = 0;
        let effectiveEndDates: Record<number, number> = {};

        processedTasks.forEach(task => {
            let maxShift = 0;
            if (task.dependencies && task.dependencies.length > 0) {
                task.dependencies.forEach((parentId: number) => {
                    const parentTask = processedTasks.find(t => t.id === parentId);
                    if (parentTask) {
                        const parentShift = parentTask.computed?.shift || 0;
                        const pRanges = parentTask.ranges || [];
                        const parentDelay = pRanges.length > 0 ? (parseInt(pRanges[pRanges.length-1].keterlambatan) || 0) : 0;
                        const potentialShift = parentShift + parentDelay;
                        if (potentialShift > maxShift) maxShift = potentialShift;
                    }
                });
            }
            
            task.computed = { shift: maxShift };

            const ranges = task.ranges || [];
            if (ranges.length > 0 && ranges[0].start) {
                const lastRange = ranges[ranges.length - 1];
                effectiveEndDates[task.id] = parseInt(lastRange.end) + maxShift + (parseInt(lastRange.keterlambatan) || 0);
                
                ranges.forEach((r: any) => {
                    const endVal = parseInt(r.end) + maxShift + (parseInt(r.keterlambatan) || 0);
                    if(endVal > maxTaskEndDay) maxTaskEndDay = endVal;
                });
            }
        });
        const totalDaysToRender = Math.max(projectData.duration, maxTaskEndDay) + 5;
        const totalChartWidth = totalDaysToRender * DAY_WIDTH;
        const svgHeight = processedTasks.length * ROW_HEIGHT;
        const supervisionDays: Record<number, boolean> = {};
        const rules = SUPERVISION_RULES[projectData.duration];
        if (rules) rules.forEach(d => supervisionDays[d] = true);
        
        let taskCoordinates: Record<number, any> = {};
        processedTasks.forEach((task, idx) => {
            const shift = task.computed.shift || 0;
            const ranges = task.ranges || [];
            if(ranges.length > 0 && ranges[0].start) {
                const maxEnd = Math.max(...ranges.map((r:any) => parseInt(r.end) + shift + (parseInt(r.keterlambatan) || 0)));
                const minStart = Math.min(...ranges.map((r:any) => parseInt(r.start) + shift));
                taskCoordinates[task.id] = {
                    centerY: (idx * ROW_HEIGHT) + (ROW_HEIGHT / 2),
                    endX: maxEnd * DAY_WIDTH,
                    startX: (minStart - 1) * DAY_WIDTH
                };
            }
        });
        let svgLines = [];
        for (let i=0; i < processedTasks.length; i++) {
            const task = processedTasks[i];
            if(task.dependencies && task.dependencies.length > 0) {
                for (let pId of task.dependencies) {
                    const parent = taskCoordinates[pId];
                    const me = taskCoordinates[task.id];
                    if(parent && me && parent.endX !== undefined && me.startX !== undefined) {
                        const startX = parent.endX, startY = parent.centerY;
                        const endX = me.startX, endY = me.centerY;
                        let tension = (endX - startX) < 40 ? 60 : 40;
                        if ((endX - startX) < 0) tension = 100;
                        const path = `M ${startX} ${startY} C ${startX + tension} ${startY}, ${endX - tension} ${endY}, ${endX} ${endY}`;
                        svgLines.push(
                            <g key={`${pId}-${task.id}`}>
                                <path d={path} className="dependency-line stroke-blue-500 fill-transparent stroke-2" markerEnd="url(#depArrow)" opacity="0.95" />
                                <circle cx={startX} cy={startY} r="4" className="fill-white stroke-blue-500 stroke-2" />
                                <circle cx={endX} cy={endY} r="4" className="fill-white stroke-blue-500 stroke-2" />
                            </g>
                        );
                    }
                }
            }
        }
        return { processedTasks, totalDaysToRender, totalChartWidth, svgHeight, supervisionDays, svgLines };
    }, [tasks, projectData]);

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">
        
        {/* Mengganti header lama dengan AppNavbar yang membawa Badge di sebelah kanan */}
        <AppNavbar 
            title="Gantt Chart"
            showBackButton={true}
            backHref="/dashboard"
            rightActions={
                <Badge variant="outline" className="bg-black/20 text-white border-white/30 px-3 py-1 shadow-sm whitespace-nowrap">
                    {appMode === 'kontraktor' ? 'MODE KONTRAKTOR' : 'MODE PENGAWASAN'}
                </Badge>
            }
        />

        <main className="p-4 md:p-8 max-w-350 mx-auto mt-2">
            <div className="flex flex-col lg:flex-row gap-6 mb-6">
                <Card className="w-full lg:w-1/3 shadow-sm">
                    <CardContent className="p-6">
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Pilih / Input No. Ulok</label>
                            {(urlIdToko || urlUlok) && !isDirectAccess ? (
                                <div className="p-3 bg-slate-100 border rounded-md font-bold text-slate-600 flex justify-between items-center shadow-inner">
                                    <span>{selectedUlok}</span><Lock className="w-5 h-5 text-slate-400" />
                                </div>
                            ) : (
                                <select 
                                    className="w-full p-3 border rounded-md bg-white focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                                    value={selectedGanttId ? `gantt-${selectedGanttId}` : (urlIdToko ? `toko-${urlIdToko}` : '')}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (!val) return;

                                        if (val.startsWith('gantt-')) {
                                            const gId = parseInt(val.replace('gantt-', ''));
                                            const proj = availableProjects.find(p => p.id === gId);
                                            if (proj?.id_toko) {
                                                const newUrl = new URL(window.location.href);
                                                newUrl.searchParams.set('id_toko', proj.id_toko.toString());
                                                window.history.pushState({}, '', newUrl.toString());
                                                loadGanttDetail(gId);
                                            } else {
                                                loadGanttDetail(gId);
                                            }
                                        } else if (val.startsWith('toko-')) {
                                            const tId = parseInt(val.replace('toko-', ''));
                                            const newUrl = new URL(window.location.href);
                                            newUrl.searchParams.set('id_toko', tId.toString());
                                            window.history.pushState({}, '', newUrl.toString());
                                            loadDataByToko(tId);
                                        }
                                    }}
                                >
                                    <option value="">-- Pilih Proyek / RAB Anda --</option>
                                    {/* PRIORITASKAN TOKO DARI DAFTAR TOKO LENGKAP */}
                                    {allTokoList.map((toko) => {
                                        const ganttMatch = availableProjects.find(p => p.id_toko === toko.id || p.nomor_ulok === toko.nomor_ulok);
                                        const ulok = formatUlokWithDash(toko.nomor_ulok);
                                        const label = [toko.nama_toko, toko.cabang, toko.proyek]
                                            .filter(Boolean).join(' · ');
                                        const statusBadge = ganttMatch?.status === 'terkunci' ? ' 🔒' : (ganttMatch ? ' 📝' : '');
                                        
                                        // Gunakan ID Gantt jika ada, jika tidak gunakan ID Toko dengan prefix
                                        const val = ganttMatch ? `gantt-${ganttMatch.id}` : `toko-${toko.id}`;
                                        
                                        return (
                                            <option key={toko.id} value={val}>
                                                {label || ulok}{statusBadge}
                                            </option>
                                        );
                                    })}
                                </select>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {projectData && (
                    <Card className="w-full lg:w-2/3 bg-blue-50 border-blue-200 shadow-sm">
                        <CardContent className="p-6 flex flex-wrap gap-x-10 gap-y-6 items-center">
                            <div><p className="text-xs font-semibold text-blue-600/70 uppercase tracking-wider mb-1">Nama Toko</p><p className="text-xl font-bold text-blue-900">{projectData.store}</p></div>
                            <div className="h-10 w-px bg-blue-200 hidden md:block"></div>
                            <div><p className="text-xs font-semibold text-blue-600/70 uppercase tracking-wider mb-1">Lingkup</p><p className="text-xl font-bold text-blue-900">{projectData.work}</p></div>
                            <div className="h-10 w-px bg-blue-200 hidden md:block"></div>
                            <div><p className="text-xs font-semibold text-blue-600/70 uppercase tracking-wider mb-1">Durasi</p><p className="text-xl font-bold text-blue-900">{projectData.duration} Hari</p></div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {!isLoading && selectedUlok && appMode === 'kontraktor' && !isProjectLocked && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-8 overflow-hidden">
                    <div className="p-4 bg-slate-100 border-b flex justify-between items-center">
                        <div>
                            <h2 className="font-bold text-slate-800 text-lg">Input Jadwal & Keterikatan (Dependencies)</h2>
                            <p className="text-sm text-slate-500">Item pekerjaan ditarik otomatis dari form RAB yang telah disubmit.</p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{tasks.length} Item Pekerjaan</Badge>
                    </div>
                    
                    {tasks.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse min-w-225">
                                <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                                    <tr>
                                        <th className="p-4 w-12 text-center border-r">No</th>
                                        <th className="p-4 w-[30%] border-r">Tahapan Pekerjaan</th>
                                        <th className="p-4 w-[25%] border-r">Keterikatan (Bisa dikerjakan setelah..)</th>
                                        <th className="p-4">Durasi (Hari Ke-)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tasks.map(task => (
                                        <tr key={task.id} className="border-b hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 text-center font-bold text-slate-500 border-r">{task.id}</td>
                                            <td className="p-4 font-semibold text-slate-800 border-r">{task.name}</td>
                                            
                                            <td className="p-4 border-r">
                                                <select 
                                                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                                                    value={task.dependencies[0] || ''}
                                                    onChange={(e) => handleDependencyChange(task.id, e.target.value)}
                                                >
                                                    <option value="">- Tidak Ada (Dikerjakan paralel) -</option>
                                                    {tasks.filter(t => t.id < task.id).map(opt => (
                                                        <option key={opt.id} value={opt.id}>{opt.id}. {opt.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-4 space-y-2">
                                                {task.ranges.map((r: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-2 mb-2">
                                                        <div className="flex items-center border border-slate-300 rounded-md overflow-hidden bg-white shadow-sm">
                                                            <span className="bg-slate-100 text-slate-500 px-2 py-1.5 text-xs font-bold border-r">H</span>
                                                            <input 
                                                                type="number" className="w-16 p-1.5 text-center outline-none focus:bg-blue-50 text-sm font-semibold text-slate-800" 
                                                                value={r.start} onChange={(e) => handleRangeChange(task.id, idx, 'start', e.target.value)}
                                                                placeholder="Start" min="1" max={projectData?.duration || 99}
                                                            />
                                                        </div>
                                                        <span className="text-slate-400 text-xs">➜</span>
                                                        <div className="flex items-center border border-slate-300 rounded-md overflow-hidden bg-white shadow-sm">
                                                            <span className="bg-slate-100 text-slate-500 px-2 py-1.5 text-xs font-bold border-r">H</span>
                                                            <input 
                                                                type="number" className="w-16 p-1.5 text-center outline-none focus:bg-blue-50 text-sm font-semibold text-slate-800" 
                                                                value={r.end} onChange={(e) => handleRangeChange(task.id, idx, 'end', e.target.value)}
                                                                placeholder="End" min="1" max={projectData?.duration || 99}
                                                            />
                                                        </div>
                                                        
                                                        <button 
                                                            type="button" 
                                                            onClick={() => removeRange(task.id, idx)} 
                                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded border border-transparent hover:border-red-200 transition-colors"
                                                            title="Hapus Periode"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                
                                                <button 
                                                    type="button" 
                                                    onClick={() => addRange(task.id)} 
                                                    className="text-xs text-blue-600 font-semibold hover:bg-blue-50 px-2 py-1 rounded transition-colors mt-1 flex items-center"
                                                >
                                                    <Plus className="w-3 h-3 mr-1" /> Tambah Periode Terputus
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            <p className="font-semibold mb-1">Data Pekerjaan Kosong</p>
                        </div>
                    )}
                </div>
            )}

            {!isLoading && selectedUlok && appMode === 'pic' && isProjectLocked && tasks.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* FORM KETERLAMBATAN */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-red-600 mb-4 flex items-center"><Info className="w-5 h-5 mr-2" /> Input Keterlambatan Pengawasan</h3>
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 space-y-2 w-full">
                                <label className="text-sm font-semibold text-slate-600">Pilih Tahapan yang Terlambat</label>
                                <select 
                                    className="w-full p-3 border border-slate-300 rounded-md bg-slate-50 focus:bg-white outline-none"
                                    value={delayTaskIdx}
                                    onChange={(e) => {
                                        setDelayTaskIdx(e.target.value);
                                        if(e.target.value !== '') setDelayDays(parseInt(rawDayGanttData[parseInt(e.target.value)]?.keterlambatan || 0));
                                    }}
                                >
                                    <option value="">-- Pilih Tahapan --</option>
                                    {rawDayGanttData.map((d, idx) => (
                                        <option key={idx} value={idx}>{d.Kategori} ({d.h_awal} - {d.h_akhir})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-full md:w-24 space-y-2">
                                <label className="text-sm font-semibold text-slate-600">Hari (+)</label>
                                <input type="number" className="w-full p-3 border border-slate-300 rounded-md font-bold text-slate-800 text-center outline-none focus:border-red-500" value={delayDays} onChange={(e) => setDelayDays(parseInt(e.target.value)||0)} min="0" />
                            </div>
                        </div>
                        <Button onClick={handlePICDelaySave} disabled={isApplying} className="mt-4 w-full bg-red-600 hover:bg-red-700 shadow-sm font-bold">
                            <Send className="w-4 h-4 mr-2" /> Simpan Keterlambatan
                        </Button>
                    </div>

                    {/* FORM KECEPATAN (PERCEPATAN) */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-green-600 mb-4 flex items-center"><Info className="w-5 h-5 mr-2" /> Input Percepatan (Maju)</h3>
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 space-y-2 w-full">
                                <label className="text-sm font-semibold text-slate-600">Pilih Tahapan yang Lebih Cepat</label>
                                <select 
                                    className="w-full p-3 border border-slate-300 rounded-md bg-slate-50 focus:bg-white outline-none"
                                    value={speedTaskIdx}
                                    onChange={(e) => {
                                        setSpeedTaskIdx(e.target.value);
                                        if(e.target.value !== '') setSpeedDays(parseInt(rawDayGanttData[parseInt(e.target.value)]?.kecepatan || 0));
                                    }}
                                >
                                    <option value="">-- Pilih Tahapan --</option>
                                    {rawDayGanttData.map((d, idx) => (
                                        <option key={idx} value={idx}>{d.Kategori} ({d.h_awal} - {d.h_akhir})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-full md:w-24 space-y-2">
                                <label className="text-sm font-semibold text-slate-600">Hari (-)</label>
                                <input type="number" className="w-full p-3 border border-slate-300 rounded-md font-bold text-slate-800 text-center outline-none focus:border-green-500" value={speedDays} onChange={(e) => setSpeedDays(parseInt(e.target.value)||0)} min="0" />
                            </div>
                        </div>
                        <Button onClick={handlePICSpeedSave} disabled={isApplying} className="mt-4 w-full bg-green-600 hover:bg-green-700 shadow-sm font-bold">
                            <Send className="w-4 h-4 mr-2" /> Simpan Percepatan
                        </Button>
                    </div>
                </div>
            )}

            <Card className="overflow-hidden shadow-md mb-8 border-slate-200">
                <div className="p-4 bg-slate-100 border-b flex justify-center gap-6 text-sm font-medium">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded shadow-inner"></div> Sesuai Target</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-linear-to-r from-pink-500 to-orange-500 rounded shadow-inner"></div> Terlambat</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-sky-200 border border-sky-300 rounded shadow-inner"></div> Masa Pengawasan</div>
                </div>
                
                <div className="p-0 overflow-x-auto min-h-100 relative bg-white pb-10" id="ganttChartContainer">
                    {isLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 backdrop-blur-sm">
                            <Loader2 className="w-12 h-12 animate-spin text-red-600 mb-4" />
                            <p className="font-semibold text-slate-700">Mempersiapkan Jadwal Proyek...</p>
                        </div>
                    ) : chartData ? (
                        <div>
                            <div className="flex sticky top-0 bg-white z-40 border-b border-slate-200 shadow-sm">
                                <div className="w-62.5 shrink-0 font-bold text-slate-600 p-2.5 bg-white border-r border-slate-200 sticky left-0 z-50">Tahapan</div>
                                <div className="flex" style={{ width: chartData.totalChartWidth }}>
                                    {Array.from({length: chartData.totalDaysToRender}).map((_, i) => {
                                        const isSup = chartData.supervisionDays[i+1];
                                        return (
                                            <div key={i} className={`shrink-0 text-center border-r border-slate-100 py-1 text-xs font-bold ${isSup ? 'bg-sky-200 text-sky-900 border-b-2 border-sky-500' : 'bg-slate-50 text-slate-500'}`} style={{ width: DAY_WIDTH }}>
                                                {i+1}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                            
                            <div className="relative">
                                {chartData.processedTasks.map((task: any, idx: number) => {
                                    const shift = task.computed.shift || 0;
                                    return (
                                        <div key={task.id} className="flex border-b border-slate-50 hover:bg-slate-50/50" style={{ height: ROW_HEIGHT }}>
                                            <div className="w-62.5 shrink-0 px-2.5 py-1 bg-white border-r border-slate-200 sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.02)] flex flex-col justify-center">
                                                <span className="text-[13px] font-semibold text-slate-800 leading-tight">{task.name}</span>
                                            </div>
                                            <div className="relative" style={{ width: chartData.totalChartWidth }}>
                                                {task.ranges && task.ranges.map((r: any, rIdx: number) => {
                                                    if(!r.start || !r.end) return null;
                                                    const s = parseInt(r.start) + shift;
                                                    const e = parseInt(r.end) + shift;
                                                    const dur = e - s + 1;
                                                    const delay = parseInt(r.keterlambatan) || 0;
                                                    return (
                                                        <React.Fragment key={rIdx}>
                                                            <div 
                                                                className={`absolute top-3.25 h-6 rounded flex items-center justify-center text-[11px] font-bold text-white shadow-sm z-10 ${shift > 0 ? 'bg-linear-to-r from-orange-400 to-orange-500' : 'bg-linear-to-r from-green-500 to-green-600'}`}
                                                                style={{ left: (s - 1) * DAY_WIDTH, width: dur * DAY_WIDTH - 1 }}
                                                            >
                                                                {dur} Hari
                                                            </div>
                                                            {delay > 0 && (
                                                                <div 
                                                                    className="absolute top-3.25 h-6 rounded flex items-center justify-center text-[11px] font-bold text-white bg-linear-to-r from-red-500 to-red-600 shadow-sm z-10 opacity-90"
                                                                    style={{ left: e * DAY_WIDTH, width: delay * DAY_WIDTH - 1 }}
                                                                >
                                                                    +{delay}
                                                                </div>
                                                            )}
                                                        </React.Fragment>
                                                    )
                                                })}
                                                {Object.keys(chartData.supervisionDays).map(day => (
                                                    <div key={day} className="absolute top-10 w-7.5 h-1 bg-sky-500 rounded-full z-15 ml-1" style={{ left: (parseInt(day) - 1) * DAY_WIDTH }}></div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}

                                <svg className="absolute top-0 pointer-events-none z-30" style={{ left: 250, width: chartData.totalChartWidth, height: chartData.svgHeight }}>
                                    <defs>
                                        <marker id="depArrow" viewBox="0 0 10 6" refX="7" refY="3" markerWidth="8" markerHeight="6" orient="auto">
                                            <path d="M0,0 L10,3 L0,6 Z" className="fill-blue-500" />
                                        </marker>
                                    </defs>
                                    {chartData.svgLines}
                                </svg>
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                            <p>Silakan pilih proyek / ulok di atas untuk mulai</p>
                        </div>
                    )}
                </div>
            </Card>

            {projectData && !isLoading && tasks.length > 0 && (
                <div className="sticky bottom-4 z-50 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] flex flex-col md:flex-row gap-4 justify-end">
                    {appMode === 'kontraktor' && !isProjectLocked && (
                        <>
                            {/* Tombol Hapus Draft */}
                            {selectedGanttId && (
                                <Button variant="outline" onClick={handleDeleteGantt} disabled={isApplying} className="h-12 border-red-200 text-red-600 hover:bg-red-50 font-semibold px-6 w-full md:w-auto mr-auto">
                                    <Trash2 className="w-5 h-5 mr-2" /> {isApplying ? "Loading..." : "Hapus Draft"}
                                </Button>
                            )}
                            
                            {/* Tombol Simpan & Kunci (Bawaan Lama) */}
                            <Button variant="outline" onClick={() => handleSaveData('Active')} disabled={isApplying} className="h-12 border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold px-6 w-full md:w-auto">
                                {isApplying ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : "Simpan Draft"}
                            </Button>
                            <Button onClick={() => handleSaveData('Terkunci')} disabled={isApplying} className="h-12 bg-red-600 hover:bg-red-700 shadow-md font-bold px-8 text-[15px] w-full md:w-auto">
                                <Lock className="w-5 h-5 mr-2" /> {isApplying ? "Menyimpan..." : "Kunci & Publish Jadwal"}
                            </Button>
                        </>
                    )}
                    {appMode === 'pic' && isProjectLocked && (
                        <Button onClick={handlePICDelaySave} className="h-12 bg-blue-600 hover:bg-blue-700 shadow-md font-bold px-8 text-[15px] w-full md:w-auto">
                            <Send className="w-5 h-5 mr-2" /> Simpan Update Keterlambatan
                        </Button>
                    )}
                </div>
            )}
        </main>
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
                <Loader2 className="w-12 h-12 animate-spin text-red-600 mb-4" />
                <p className="font-semibold text-slate-600">Memuat Gantt Chart Workspace...</p>
            </div>
        }>
            <GanttBoard />
        </Suspense>
    );
}