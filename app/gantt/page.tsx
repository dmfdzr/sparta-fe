"use client"

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppNavbar from '@/components/AppNavbar';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Send, Loader2, Info, Plus, Trash2, X, AlertTriangle, AlertCircle, Calendar, CheckCircle, Save, FileText } from 'lucide-react'; 
import { 
    fetchGanttDetail, fetchGanttList, submitGanttChart, 
    updateGanttChart, lockGanttChart, deleteGanttChart, 
    updateGanttDelay, updateGanttSpeed, fetchGanttDetailByToko,
    fetchRABList, fetchRABDetail, fetchSPKList
} from '@/lib/api';
import type { GanttListItem } from '@/lib/api';
import { API_URL } from '@/lib/constants';
import InstruksiLapanganModal from '@/components/InstruksiLapanganModal';
import { useGlobalAlert } from '@/context/GlobalAlertContext';

const DAY_WIDTH = 40;
const ROW_HEIGHT = 50;

function formatUlokWithDash(ulok: string) {
    if (!ulok) return "";
    if (ulok.includes("-")) return ulok;
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

function GanttBoard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showAlert } = useGlobalAlert();
    
    const urlUlok = searchParams.get('ulok');
    const urlIdToko = searchParams.get('id_toko');
    const urlIdRab = searchParams.get('id_rab');

    const [appMode, setAppMode] = useState<'kontraktor' | 'pic' | null>(null);
    const [userRole, setUserRole] = useState('');
    
    const [selectedUlok, setSelectedUlok] = useState(formatUlokWithDash(urlUlok || ''));
    const [selectedGanttId, setSelectedGanttId] = useState<number | null>(null);
    
    const [projectData, setProjectData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isProjectLocked, setIsProjectLocked] = useState(false);
    const [availableProjects, setAvailableProjects] = useState<GanttListItem[]>([]);
    const [allTokoList, setAllTokoList] = useState<any[]>([]);
    const [isDirectAccess, setIsDirectAccess] = useState(false);

    const [tasks, setTasks] = useState<any[]>([]);
    const [isApplying, setIsApplying] = useState(false);

    const [rawDayGanttData, setRawDayGanttData] = useState<any[]>([]);

    const [spkInfo, setSpkInfo] = useState<{ startDate: string; duration: number } | null>(null);
    const [pengawasanDates, setPengawasanDates] = useState<string[]>([]);
    const [pengawasanHistory, setPengawasanHistory] = useState<any[]>([]);
    
    const [rabItems, setRabItems] = useState<any[]>([]);
    const [showMemoModal, setShowMemoModal] = useState(false);
    const [showOpnameModal, setShowOpnameModal] = useState(false);
    const [activeHeaderClick, setActiveHeaderClick] = useState<{ dayIndex: number, dateString: string, label: string } | null>(null);

    useEffect(() => {
        const role = sessionStorage.getItem('userRole');
        const cabang = sessionStorage.getItem('loggedInUserCabang'); 
        const email = sessionStorage.getItem('loggedInUserEmail'); 

        if (!role) {
            showAlert({ message: "Sesi Anda telah habis. Silakan login kembali.", type: "warning", onConfirm: () => router.push('/auth') });
            return;
        }

        setUserRole(role);
        const roles = role.split(',').map(r => r.trim().toUpperCase());
        let currentAppMode: 'kontraktor' | 'pic' = 'kontraktor';
        const picRoles = ['BRANCH BUILDING & MAINTENANCE MANAGER', 'BRANCH BUILDING COORDINATOR', 'BRANCH BUILDING SUPPORT', 'DIREKTUR'];
        
        if (roles.includes('KONTRAKTOR')) {
            currentAppMode = 'kontraktor';
            setAppMode('kontraktor');
        } else if (roles.some(r => picRoles.includes(r))) {
            currentAppMode = 'pic';
            setAppMode('pic');
        } else {
            showAlert({ message: "Anda tidak memiliki akses.", type: "error", onConfirm: () => router.push('/dashboard') });
            return;
        }

        if (urlIdToko) {
            loadDataByToko(parseInt(urlIdToko), urlIdRab ? parseInt(urlIdRab) : undefined);
        } else if (urlIdRab) {
            loadDataByRab(parseInt(urlIdRab));
        } else {
            const filters = currentAppMode === 'kontraktor'
                ? { email_pembuat: email || '' }
                : { status: 'active' };

            fetchGanttList(filters)
                .then(res => {
                    const data = res.data || [];
                    const filtered = cabang ? data.filter(item => item.cabang?.toUpperCase() === cabang.toUpperCase()) : data;
                    setAvailableProjects(filtered);
                })
                .catch(err => console.error("Gagal memuat list Gantt Chart:", err));
        }

        const urlLocked = searchParams.get('locked');
        if (!urlLocked && !urlUlok) {
            setIsDirectAccess(true);
        }

        fetchRABList()
            .then(res => {
                const data = res.data || [];
                const filtered = cabang ? data.filter(item => item.cabang?.toUpperCase() === cabang.toUpperCase()) : data;
                setAllTokoList(filtered);
            })
            .catch(err => console.error("Gagal memuat semua daftar RAB:", err));
        
    }, [router, urlIdToko, urlIdRab]);

    const loadDataByRab = async (idRab: number, fallbackIdToko?: number) => {
        setIsLoading(true);
        try {
            const rabDetailRes = await fetchRABDetail(idRab);
            const { rab, toko, items } = rabDetailRes.data;
            if (items) setRabItems(items);

            setSelectedGanttId(null);
            setIsProjectLocked(false);
            setSelectedUlok(formatUlokWithDash(toko.nomor_ulok));
            setSpkInfo(null);
            
            const rData: any = rab;
            const rDuration = rData?.durasi_pekerjaan ? parseInt(String(rData.durasi_pekerjaan).replace(/\D/g, '')) || 1 : 1;

            setProjectData({
                ganttId: null,
                id_toko: toko.id,
                ulokClean: formatUlokWithDash(toko.nomor_ulok),
                store: toko.nama_toko || "Data Toko",
                kode_toko: toko.kode_toko || "-",
                work: toko.lingkup_pekerjaan || "SIPIL",
                cabang: toko.cabang || "-",
                kontraktor: toko.nama_kontraktor || "-",
                duration: rDuration,
                startDate: new Date().toISOString().split('T')[0],
            });

            const uniqueCats = new Set<string>();
            if (items) {
                items.forEach((item: any) => {
                    if (item.kategori_pekerjaan && item.volume > 0) {
                         uniqueCats.add(item.kategori_pekerjaan);
                    }
                });
            }
            
            let finalCategories = uniqueCats.size > 0 ? Array.from(uniqueCats) : ["PERSIAPAN"];

            const generatedTasks = finalCategories.map((kName: string, idx: number) => ({
                id: idx + 1, 
                name: kName, 
                dependencies: [], 
                ranges: [{ start: '', end: '', keterlambatan: 0 }], 
                keterlambatan: 0
            }));
            
            setTasks(generatedTasks);
            setRawDayGanttData([]);

        } catch (err: any) {
            console.error("loadDataByRab Error:", err);
            if (fallbackIdToko) {
                 loadDataByToko(fallbackIdToko);
            } else {
                 showAlert({ message: `Gagal memuat data RAB: ${err.message}`, type: "error" });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const loadDataByToko = async (idToko: number, fallbackIdRab?: number) => {
        setIsLoading(true);
        try {
            const res = await fetchGanttDetailByToko(idToko);
            const { rab, filtered_categories, gantt_data, toko } = res;

            const validRabId = rab?.id || fallbackIdRab;

            if (gantt_data) {
                await loadGanttDetail(gantt_data.id, validRabId);
            } else {
                setSelectedGanttId(null);
                setIsProjectLocked(false);
                setSelectedUlok(formatUlokWithDash(toko.nomor_ulok));
                setSpkInfo(null);
                
                if (!validRabId) {
                    showAlert({ message: "Info: RAB belum disetujui atau belum ada untuk toko ini.", type: "info" });
                }

                let finalCategories = filtered_categories || [];
                let rDuration = 1;

                if (validRabId) {
                    try {
                        const rabDetailRes = await fetchRABDetail(validRabId);
                        if (rabDetailRes?.data?.rab?.durasi_pekerjaan) {
                            rDuration = parseInt(String(rabDetailRes.data.rab.durasi_pekerjaan).replace(/\D/g, '')) || 1;
                        }

                        if (rabDetailRes?.data?.items) {
                            setRabItems(rabDetailRes.data.items);
                            const uniqueCats = new Set<string>();
                            rabDetailRes.data.items.forEach((item: any) => {
                                if (item.kategori_pekerjaan && item.volume > 0) {
                                     uniqueCats.add(item.kategori_pekerjaan);
                                }
                            });
                            if (uniqueCats.size > 0) {
                                finalCategories = Array.from(uniqueCats);
                            }
                        }
                    } catch (e) {
                         console.error("Gagal mengambil kategori dari RAB Detail:", e);
                    }
                }
                
                setProjectData({
                    ganttId: null,
                    id_toko: toko.id,
                    ulokClean: formatUlokWithDash(toko.nomor_ulok),
                    store: toko.nama_toko || "Data Toko",
                    kode_toko: toko.kode_toko || "-",
                    work: toko.lingkup_pekerjaan || "SIPIL",
                    cabang: toko.cabang || "-",
                    kontraktor: toko.nama_kontraktor || "-",
                    duration: rDuration,
                    startDate: new Date().toISOString().split('T')[0],
                });
                
                const generatedTasks = finalCategories.map((kName: string, idx: number) => ({
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
            showAlert({ message: `Gagal memuat data Toko: ${err.message}`, type: "error" });
        } finally {
            setIsLoading(false);
        }
    };
    
    const loadGanttDetail = async (ganttId: number, idRabFallback?: number) => {
        if (!ganttId) return;
        setIsLoading(true);
        setSelectedGanttId(ganttId);

        try {
            const { data } = await fetchGanttDetail(ganttId);
            const { gantt, toko, kategori_pekerjaan, day_items, dependencies, pengawasan } = data;

            let baseCategories: string[] = [];
            let rabDurationFallback = 0;

            if (idRabFallback) {
                try {
                    const rabDetailRes = await fetchRABDetail(idRabFallback);
                    if (rabDetailRes?.data) {
                        const rData: any = rabDetailRes.data.rab;
                        if (rData?.durasi_pekerjaan) {
                            rabDurationFallback = parseInt(String(rData.durasi_pekerjaan).replace(/\D/g, '')) || 0;
                        }
                        if (rabDetailRes.data.items) {
                            setRabItems(rabDetailRes.data.items);
                            const uniqueCats = new Set<string>();
                            rabDetailRes.data.items.forEach((item: any) => {
                                if (item.kategori_pekerjaan && item.volume > 0) {
                                    uniqueCats.add(item.kategori_pekerjaan.toUpperCase());
                                }
                            });
                            baseCategories = Array.from(uniqueCats);
                        }
                    }
                } catch (e) {
                    console.error("Gagal get fallback RAB details:", e);
                }
            }

            const startDaysRaw = day_items
                .map(entry => parseInt(entry.h_awal))
                .filter(d => !isNaN(d));

            const endDaysRaw = day_items
                .map(entry => parseInt(entry.h_akhir))
                .filter(d => !isNaN(d));

            const maxDay = endDaysRaw.length > 0 ? Math.max(...endDaysRaw) : 0;

            let projectStart = new Date();
            if (gantt.timestamp) {
                const parts = gantt.timestamp.split('T')[0].split('-'); 
                if (parts.length === 3) {
                    projectStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                }
            }

            const ganttComputedDuration = maxDay;
            const duration = rabDurationFallback > 0 ? rabDurationFallback : ganttComputedDuration;

            setSelectedUlok(formatUlokWithDash(toko.nomor_ulok));
            setProjectData({
                ganttId:    gantt.id,
                id_toko:    toko.id,
                ulokClean:  formatUlokWithDash(toko.nomor_ulok),
                store:      toko.nama_toko || "Data Toko Ditemukan",
                kode_toko:  toko.kode_toko || "-",
                work:       toko.lingkup_pekerjaan || "SIPIL",
                cabang:     toko.cabang || "-",
                kontraktor: toko.nama_kontraktor || "-",
                duration,
                startDate:  projectStart.toISOString().split('T')[0],
            });

            const pDates = (pengawasan || [])
                .map((p: any) => p.tanggal_pengawasan)
                .filter(Boolean);
            setPengawasanDates(pDates);
            setPengawasanHistory(pengawasan || []);

            setIsProjectLocked(['terkunci', 'locked', 'published'].includes(gantt.status.toLowerCase()));

            try {
                const spkRes = await fetchSPKList({ nomor_ulok: toko.nomor_ulok, status: 'SPK_APPROVED' });
                const approvedSpk = (spkRes.data || []).find(s => s.status?.toUpperCase() === 'SPK_APPROVED');
                if (approvedSpk && approvedSpk.waktu_mulai && approvedSpk.durasi) {
                    setSpkInfo({ startDate: approvedSpk.waktu_mulai, duration: approvedSpk.durasi });
                } else {
                    setSpkInfo(null);
                }
            } catch {
                setSpkInfo(null);
            }

            const normalizedRaw = day_items.map(d => ({
                Kategori:  d.kategori_pekerjaan,
                h_awal:    d.h_awal,
                h_akhir:   d.h_akhir,
                keterlambatan: d.keterlambatan ?? 0,
                kecepatan:     d.kecepatan ?? "",
                _id:       d.id,
                _id_gantt: d.id_gantt,
            }));
            setRawDayGanttData(normalizedRaw);

            const savedCategories = kategori_pekerjaan.map(k => k.kategori_pekerjaan.toUpperCase());
            const mergedCategoriesRaw = new Set([...baseCategories, ...savedCategories]);
            if (mergedCategoriesRaw.size === 0) mergedCategoriesRaw.add("PERSIAPAN");

            let generatedTasks: any[] = Array.from(mergedCategoriesRaw).map((catName, idx) => ({
                id: idx + 1, name: catName, dependencies: [], ranges: [], keterlambatan: 0
            }));

            const categoryRangesMap: Record<string, any[]> = {};
            day_items.forEach(entry => {
                const startDay = parseInt(entry.h_awal);
                const endDay   = parseInt(entry.h_akhir);
                
                if (!isNaN(startDay) && !isNaN(endDay)) {
                    const key = entry.kategori_pekerjaan.toLowerCase().trim();
                    if (!categoryRangesMap[key]) categoryRangesMap[key] = [];
                    categoryRangesMap[key].push({
                        start:         startDay,
                        end:           endDay,
                        duration:      endDay - startDay + 1,
                        keterlambatan: parseInt(String(entry.keterlambatan || 0)),
                    });
                }
            });

            const depMap: Record<string, string[]> = {};
            dependencies.forEach(dep => {
                const child  = dep.kategori_pekerjaan.toLowerCase().trim();
                const parent = dep.kategori_pekerjaan_terikat.toLowerCase().trim();
                if (!depMap[parent]) depMap[parent] = [];
                depMap[parent].push(child);
            });

            generatedTasks = generatedTasks.map(task => {
                const tName = task.name.toLowerCase().trim();

                const matchedRanges = categoryRangesMap[tName]
                    ?? Object.entries(categoryRangesMap).find(([k]) => tName.includes(k) || k.includes(tName))?.[1]
                    ?? [];

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
            showAlert({ message: `Sistem: ${err.message}`, type: "error" });
            setProjectData(null);
            setTasks([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRangeChange = (taskId: number, rangeIdx: number, field: 'start'|'end', value: string) => {
        let parsedVal = parseInt(value);
        if (!isNaN(parsedVal)) {
            const maxDuration = projectData?.duration || 99;
            if (parsedVal > maxDuration) {
                parsedVal = maxDuration;
            }
        }
        const finalValue = isNaN(parsedVal) && value !== '' ? '' : (value === '' ? '' : parsedVal.toString());

        setTasks(prev => prev.map(t => {
            if(t.id === taskId) {
                const newRanges = [...t.ranges];
                newRanges[rangeIdx][field] = finalValue;
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

        setTasks(prev => prev.map(t => {
            if(t.id === taskId) {
                const newRanges = t.ranges.filter((_: any, i: number) => i !== rangeIdx);
                if (newRanges.length === 0) newRanges.push({start: '', end: '', keterlambatan: 0});
                return {...t, ranges: newRanges};
            }
            return t;
        }));
    };

    const handleSaveData = async (status: 'Active' | 'Terkunci') => {
        setIsApplying(true);
        try {
            const email = sessionStorage.getItem('loggedInUserEmail') || "-";
            const cabang = sessionStorage.getItem('loggedInUserCabang') || "-";
            const namaKontraktor = sessionStorage.getItem('loggedInUserName') || sessionStorage.getItem('loggedInUserEmail') || "-";

            const kategori_pekerjaan: string[] = [];
            const day_items: any[] = [];
            const dependencies: any[] = [];

            const pengawasanSet = new Set<string>();
            (rawDayGanttData || []).forEach((d: any) => {
                const k = (d.Kategori || '').toUpperCase().trim();
                if (k) pengawasanSet.add(k);
            });
            const pengawasan = Array.from(pengawasanSet).map(k => ({ kategori_pekerjaan: k }));

            tasks.forEach(t => {
                const kategoriName = t.name?.toUpperCase().trim();
                if (!kategoriName) return;

                kategori_pekerjaan.push(kategoriName);
                
                if (t.ranges && t.ranges.length > 0) {
                    t.ranges.forEach((r: any) => {
                        if (!r.start || !r.end) return;
                        
                        const dayItem: any = {
                            kategori_pekerjaan: kategoriName,
                            h_awal: String(r.start),
                            h_akhir: String(r.end),
                        };
                        
                        dayItem.keterlambatan = r.keterlambatan ? String(r.keterlambatan) : "";
                        dayItem.kecepatan = ""; 
                        
                        day_items.push(dayItem);
                    });
                }

                if (t.dependencies && t.dependencies.length > 0) {
                    t.dependencies.forEach((childId: number) => {
                        const cTask = tasks.find(ct => ct.id === childId);
                        if (cTask && cTask.name?.trim()) {
                            dependencies.push({
                                kategori_pekerjaan: cTask.name.toUpperCase().trim(),
                                kategori_pekerjaan_terikat: kategoriName 
                            });
                        }
                    });
                }
            });

            if (day_items.length === 0) {
                throw new Error("Harap isi tanggal mulai dan selesai minimal satu tahapan.");
            }

            let submitRes: any = null;

            if (selectedGanttId) {
                const updatePayload = {
                    day_items: day_items,
                    kategori_pekerjaan: [], 
                    pengawasan: [],
                    dependencies: []
                };

                await updateGanttChart(selectedGanttId, updatePayload);

                if (status === 'Terkunci') {
                    await lockGanttChart(selectedGanttId, email); 
                }
            } else {
                const payload: any = {
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

                submitRes = await submitGanttChart(payload);
                
                if (status === 'Terkunci' && submitRes.data?.id) {
                    await lockGanttChart(submitRes.data.id, email);
                }
            }

            if (status === 'Terkunci') {
                showAlert({ message: "Berhasil! Jadwal telah dikunci.", type: "success" });
                router.push('/dashboard');
            } else {
                showAlert({ message: "Draft berhasil disimpan.", type: "success" });
                const newGanttId = selectedGanttId || submitRes?.data?.id;
                if (newGanttId) loadGanttDetail(newGanttId);
            }
        } catch (e: any) {
            showAlert({ message: `Gagal menyimpan data: ${e.message}`, type: "error" });
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
            showAlert({ message: "Draft jadwal berhasil dihapus.", type: "success" });
            
            setSelectedGanttId(null);
            setProjectData(null);
            setTasks([]);
            
            window.location.reload(); 
        } catch (error: any) {
            showAlert({ message: `Gagal menghapus: ${error.message}`, type: "error" });
        } finally {
            setIsApplying(false);
        }
    };

    const chartData = useMemo(() => {
        if (!projectData || tasks.length === 0) return null;

        let processedTasks = [...tasks];
        let maxTaskEndDay = 0;
        let effectiveEndDates: Record<number, number> = {};

        processedTasks.forEach(task => { 
            let maxShift = 0;
            const myParents = processedTasks.filter(pt => pt.dependencies && pt.dependencies.includes(task.id));
            if (myParents.length > 0) {
                myParents.forEach(parentTask => {
                    const parentShift = parentTask.computed?.shift || 0;
                    const pRanges = parentTask.ranges || [];
                    const parentDelay = pRanges.length > 0 ? (parseInt(pRanges[pRanges.length-1].keterlambatan) || 0) : 0;
                    const potentialShift = parentShift + parentDelay;
                    if (potentialShift > maxShift) maxShift = potentialShift;
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
        const baseDuration = spkInfo ? spkInfo.duration : projectData.duration;
        const totalDaysToRender = Math.max(baseDuration, maxTaskEndDay);
        const totalChartWidth = totalDaysToRender * DAY_WIDTH;
        const svgHeight = processedTasks.length * ROW_HEIGHT;
        const supervisionDays: Record<number, boolean> = {};
        
        let taskCoordinates: Record<number, any> = {};
        processedTasks.forEach((task, idx) => {
            const shift = task.computed.shift || 0;
            const ranges = task.ranges || [];
            if(ranges.length > 0 && ranges[0].start) {
                const maxEnd = Math.max(...ranges.map((r:any) => parseInt(r.end || 0) + shift + (parseInt(r.keterlambatan) || 0)));
                const minStart = Math.min(...ranges.map((r:any) => parseInt(r.start || 0) + shift));
                
                let firstPeriodEnd = maxEnd;
                let lowestStart = Infinity;
                ranges.forEach((r: any) => {
                    const s = parseInt(r.start || 0) + shift;
                    if (s < lowestStart) {
                        lowestStart = s;
                        firstPeriodEnd = parseInt(r.end || 0) + shift + (parseInt(r.keterlambatan) || 0);
                    }
                });

                taskCoordinates[task.id] = {
                    centerY: (idx * ROW_HEIGHT) + (ROW_HEIGHT / 2),
                    endX: maxEnd * DAY_WIDTH,
                    startX: (minStart - 1) * DAY_WIDTH,
                    firstEndX: firstPeriodEnd * DAY_WIDTH
                };
            }
        });
        let svgLines = [];
        for (let i=0; i < processedTasks.length; i++) {
            const task = processedTasks[i]; 
            if(task.dependencies && task.dependencies.length > 0) {
                for (let cId of task.dependencies) {
                    const parentCoordinates = taskCoordinates[task.id];
                    const childCoordinates = taskCoordinates[cId];
                    if(parentCoordinates && childCoordinates && parentCoordinates.firstEndX !== undefined && childCoordinates.startX !== undefined) {
                        const startX = parentCoordinates.firstEndX, startY = parentCoordinates.centerY;
                        const endX = childCoordinates.startX, endY = childCoordinates.centerY;
                        let tension = (endX - startX) < 40 ? 60 : 40;
                        if ((endX - startX) < 0) tension = 100;
                        const path = `M ${startX} ${startY} C ${startX + tension} ${startY}, ${endX - tension} ${endY}, ${endX} ${endY}`;
                        svgLines.push(
                            <g key={`${task.id}-${cId}`}>
                                <path d={path} className="dependency-line stroke-blue-500 fill-transparent stroke-2" markerEnd="url(#depArrow)" opacity="0.95" />
                                <circle cx={startX} cy={startY} r="4" className="fill-white stroke-blue-500 stroke-2" />
                                <circle cx={endX} cy={endY} r="4" className="fill-white stroke-blue-500 stroke-2" />
                            </g>
                        );
                    }
                }
            }
        }
        let liveDayIndex = -1;
        if (spkInfo) {
            const today = new Date();
            const td = String(today.getDate()).padStart(2, '0');
            const tm = String(today.getMonth() + 1).padStart(2, '0');
            const ty = today.getFullYear();
            
            for (let i = 0; i < totalDaysToRender; i++) {
                const d = new Date(spkInfo.startDate.split('T')[0] + 'T00:00:00');
                d.setDate(d.getDate() + i);
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                if (dd === td && mm === tm && yyyy === ty) {
                    liveDayIndex = i;
                    break;
                }
            }
        }
        
        return { processedTasks, totalDaysToRender, totalChartWidth, svgHeight, supervisionDays, svgLines, liveDayIndex };
    }, [tasks, projectData, spkInfo]);

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">
        
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
                                    <span>{selectedUlok || projectData?.ulokClean || "Memuat..."}</span><Lock className="w-5 h-5 text-slate-400" />
                                </div>
                            ) : (
                                <select 
                                    className="w-full p-3 border rounded-md bg-white focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                                    value={(() => {
                                        const targetTokoId = projectData?.id_toko ? projectData.id_toko : (urlIdToko ? parseInt(urlIdToko) : null);
                                        if (!targetTokoId) return '';
                                        
                                        const ganttMatch = availableProjects.find(p => p.id === selectedGanttId || p.id_toko === targetTokoId);
                                        return ganttMatch ? `gantt-${ganttMatch.id}` : `toko-${targetTokoId}`;
                                    })()}
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
                                            }
                                            loadGanttDetail(gId);
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
                                    {allTokoList.map((toko) => {
                                        const tID = toko.id_toko || toko.id;
                                        const ganttMatch = availableProjects.find(p => p.id_toko === tID || p.nomor_ulok === toko.nomor_ulok);
                                        const ulok = formatUlokWithDash(toko.nomor_ulok);
                                        const label = [ulok, toko.nama_toko, toko.cabang]
                                            .filter(Boolean).join(' · ');
                                        const statusBadge = ganttMatch?.status === 'terkunci' ? ' (Terkunci)' : (ganttMatch?.status === 'active' ? ' (Aktif)' : '');
                                        
                                        const val = ganttMatch ? `gantt-${ganttMatch.id}` : `toko-${tID}`;
                                        
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
                            {spkInfo && (
                                <>
                                    <div className="h-10 w-px bg-blue-200 hidden md:block"></div>
                                    <div><p className="text-xs font-semibold text-blue-600/70 uppercase tracking-wider mb-1">Durasi (SPK)</p><p className="text-xl font-bold text-blue-900">{spkInfo.duration} Hari</p></div>
                                    <div className="h-10 w-px bg-blue-200 hidden md:block"></div>
                                    <div><p className="text-xs font-semibold text-green-600/70 uppercase tracking-wider mb-1">Tgl Mulai SPK</p><p className="text-xl font-bold text-green-800">{new Date(spkInfo.startDate.split('T')[0]).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
                                </>
                            )}
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
                                        <th className="p-4 w-[25%] border-r">Keterikatan (Dilanjutkan ke..)</th>
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
                                                    <option value="">- Tidak Ada -</option>
                                                    {tasks.filter(t => t.id > task.id).map(opt => (
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



            <Card className="overflow-hidden shadow-md mb-8 border-slate-200">
                <div className="p-4 bg-slate-100 border-b flex justify-center gap-6 text-sm font-medium">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded shadow-inner"></div> Progress</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-linear-to-r from-pink-500 to-orange-500 rounded shadow-inner"></div> Terlambat</div>
                </div>
                
                <div className="p-0 overflow-x-auto min-h-100 relative bg-white pb-10" id="ganttChartContainer">
                    {isLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 backdrop-blur-sm">
                            <Loader2 className="w-12 h-12 animate-spin text-red-600 mb-4" />
                            <p className="font-semibold text-slate-700">Mempersiapkan Jadwal Proyek...</p>
                        </div>
                    ) : chartData ? (
                        <div>
                            <div className="flex sticky top-0 bg-white z-20 border-b-2 border-slate-300 shadow-sm" style={{ minWidth: 250 + chartData.totalChartWidth }}>
                                <div className="w-62.5 shrink-0 font-bold text-slate-600 p-2.5 bg-white border-r-[3px] border-slate-400 sticky left-0 z-30 shadow-[2px_0_10px_rgba(0,0,0,0.1)]">Tahapan</div>
                                <div className="flex" style={{ width: chartData.totalChartWidth }}>
                                {Array.from({length: chartData.totalDaysToRender}).map((_, i) => {
                                    let label: string = String(i + 1);
                                    let isPengawasan = false;
                                    let isLiveDay = false;
                                    let fullDateString = '';
                                    
                                    if (spkInfo) {
                                        const d = new Date(spkInfo.startDate.split('T')[0] + 'T00:00:00');
                                        d.setDate(d.getDate() + i);
                                        const dd = String(d.getDate()).padStart(2, '0');
                                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                                        const yyyy = d.getFullYear();
                                        label = `${dd}/${mm}`;
                                        
                                        fullDateString = `${dd}/${mm}/${yyyy}`;
                                        
                                        const today = new Date();
                                        const td = String(today.getDate()).padStart(2, '0');
                                        const tm = String(today.getMonth() + 1).padStart(2, '0');
                                        const ty = today.getFullYear();
                                        
                                        if (dd === td && mm === tm && yyyy === ty) {
                                            isLiveDay = true;
                                        }
                                        if (pengawasanDates.includes(fullDateString)) {
                                            isPengawasan = true;
                                        }
                                    }
                                    const isClickable = appMode === 'pic' && isPengawasan;
                                    return (
                                        <div key={i} className={`shrink-0 flex flex-col items-center border-r-2 border-slate-300 py-1 font-bold ${isLiveDay ? 'bg-green-50 text-green-700' : isPengawasan ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-500'} ${isClickable ? 'cursor-pointer hover:bg-blue-100 ring-inset hover:ring-2 hover:ring-blue-500 transition-all' : ''}`} style={{ width: DAY_WIDTH, fontSize: spkInfo ? '9px' : '12px' }}
                                             onClick={() => {
                                                 if (isClickable) {
                                                     setActiveHeaderClick({ dayIndex: i, dateString: fullDateString, label });
                                                     setShowMemoModal(true);
                                                 }
                                             }}>
                                            <span>{label}</span>
                                            {isPengawasan && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1" title="Hari Pengawasan" />}
                                            {isLiveDay && !isPengawasan && <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1" title="Hari Ini" />}
                                        </div>
                                    )
                                })}
                                </div>
                            </div>
                            
                            <div className="relative" style={{ minWidth: 250 + chartData.totalChartWidth }}>
                                {/* Garis Live Day - kolom hijau samar full height */}
                                {chartData.liveDayIndex !== -1 && (
                                    <div 
                                        className="absolute top-0 bottom-0 pointer-events-none"
                                        style={{ left: 250 + (chartData.liveDayIndex * DAY_WIDTH), width: DAY_WIDTH, zIndex: 5, backgroundColor: 'rgba(34, 197, 94, 0.08)' }} 
                                    />
                                )}
                                {chartData.liveDayIndex !== -1 && (
                                    <div 
                                        className="absolute top-0 bottom-0 pointer-events-none"
                                        style={{ left: 250 + (chartData.liveDayIndex * DAY_WIDTH) + (DAY_WIDTH / 2), width: 2, zIndex: 16, backgroundColor: 'rgba(34, 197, 94, 0.7)' }} 
                                    />
                                )}

                                {/* Garis pemisah tegas antara Tahapan Pekerjaan dan Hari */}
                                <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: 250, borderRight: '3px solid #94a3b8', zIndex: 18, boxShadow: '2px 0 8px rgba(0,0,0,0.1)' }} />

                                {/* Garis vertikal pembatas kolom - full height */}
                                {Array.from({ length: chartData.totalDaysToRender }).map((_, ci) => (
                                    <div key={`vl-${ci}`} className="absolute top-0 bottom-0 pointer-events-none z-0" style={{ left: 250 + ((ci + 1) * DAY_WIDTH), borderRight: '1px solid #e2e8f0' }} />
                                ))}

                                {chartData.processedTasks.map((task: any, idx: number) => {
                                    const shift = task.computed.shift || 0;
                                    return (
                                        <div key={task.id} className="flex hover:bg-slate-50/50" style={{ height: ROW_HEIGHT, borderBottom: '1px solid #cbd5e1', minWidth: 250 + chartData.totalChartWidth }}>
                                            <div className="w-62.5 shrink-0 px-2.5 py-1 bg-white border-r-[3px] border-slate-400 sticky left-0 z-20 flex flex-col justify-center shadow-[2px_0_10px_rgba(0,0,0,0.1)]">
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
                                             </div>
                                        </div>
                                    )
                                })}

                                <svg className="absolute top-0 pointer-events-none z-0" style={{ left: 250, width: chartData.totalChartWidth, height: chartData.svgHeight }}>
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

            {projectData && !isLoading && tasks.length > 0 && appMode === 'kontraktor' && !isProjectLocked && (
                <div className="sticky bottom-4 z-50 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] flex flex-col md:flex-row gap-4 justify-end">
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
                </div>
            )}
        </main>

        {/* MODAL 2: Memo Pengawasan Detail */}
        {showMemoModal && (
            <MemoPengawasanModal 
                activeHeaderClick={activeHeaderClick} 
                chartData={chartData} 
                rabItems={rabItems} 
                pengawasanHistory={pengawasanHistory}
                onClose={() => setShowMemoModal(false)} 
                selectedGanttId={selectedGanttId}
                spkInfo={spkInfo}
                id_toko={projectData?.id_toko}
                onSuccess={() => {
                    setShowMemoModal(false);
                    setShowOpnameModal(true);
                }}
            />
        )}

        {/* MODAL 3: Opname Hasil Evaluasi */}
        {showOpnameModal && (
            <OpnameModal
                activeHeaderClick={activeHeaderClick}
                rabItems={rabItems}
                id_toko={projectData?.id_toko}
                onClose={() => {
                    setShowOpnameModal(false);
                    setShowMemoModal(true);
                }}
                selectedGanttId={selectedGanttId}
                onSuccess={() => {
                    setShowOpnameModal(false);
                    if (selectedGanttId) loadGanttDetail(selectedGanttId);
                }}
            />
        )}
        </div>
    );
}

// Komponen Modal Diekstraksi untuk memisahkan state/kalkulasi
function MemoPengawasanModal({ activeHeaderClick, chartData, rabItems, pengawasanHistory, onClose, selectedGanttId, spkInfo, id_toko, onSuccess }: any) {
    const { showAlert } = useGlobalAlert();
    const router = useRouter();
    const [liveHistory, setLiveHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [memoInputs, setMemoInputs] = useState<Record<string, { status: string, lateDays: number, catatan: string, file: File | null, dokumentasiUrl: string | null }>>({});
    const [isDirty, setIsDirty] = useState(false);
    const [showInstruksiModal, setShowInstruksiModal] = useState(false);
    
    useEffect(() => {
        if (!selectedGanttId || !spkInfo || !activeHeaderClick) {
            setIsLoadingHistory(false);
            return;
        }

        const offset = activeHeaderClick?.dayIndex || 0;
        const dDate = new Date(spkInfo.startDate.split('T')[0] + 'T00:00:00');
        dDate.setDate(dDate.getDate() + offset);
        const yyyy = dDate.getFullYear();
        const mm = String(dDate.getMonth() + 1).padStart(2, '0');
        const dd = String(dDate.getDate()).padStart(2, '0');
        const formattedDate = `${yyyy}-${mm}-${dd}`;

        import('@/lib/api').then(({ fetchPengawasanList }) => {
            Promise.all([
                fetchPengawasanList({ id_gantt: selectedGanttId, tanggal: formattedDate }),
                fetchPengawasanList({ id_gantt: selectedGanttId })
            ])
            .then(([resLive, resAll]) => {
                const dataLive = resLive.data || [];
                const dataAll = resAll.data || [];

                setLiveHistory(dataLive);
                
                const initial: Record<string, any> = {};
                dataLive.forEach((p: any) => {
                    if (p.kategori_pekerjaan && p.jenis_pekerjaan && p.status) {
                        const key = `${p.kategori_pekerjaan.toUpperCase()}|${p.jenis_pekerjaan.toUpperCase()}`;
                        if (p.status.toLowerCase() !== 'selesai') {
                            initial[key] = {
                                status: p.status.charAt(0).toUpperCase() + p.status.slice(1), 
                                lateDays: p.keterlambatan ? parseInt(p.keterlambatan) : 0,
                                catatan: p.catatan || '',
                                file: null, 
                                dokumentasiUrl: p.dokumentasi || null
                            };
                        }
                    }
                });
                setMemoInputs(initial);

                const map = new Map<string, string>();
                const idMap = new Map<string, number>();
                
                dataAll.forEach((p: any) => {
                    if (p.kategori_pekerjaan && p.jenis_pekerjaan && p.status) {
                        const key = `${p.kategori_pekerjaan.toUpperCase()}|${p.jenis_pekerjaan.toUpperCase()}`;
                        
                        // Selalu catat ID terbaru dari item tersebut
                        if (p.id) idMap.set(key, p.id);

                        if (map.get(key) === 'Selesai' && p.status.toLowerCase() !== 'selesai') {
                            // Pertahankan status Selesai jika sebelumnya sudah pernah Selesai
                        } else {
                            map.set(key, p.status.charAt(0).toUpperCase() + p.status.slice(1));
                        }
                    }
                });
                setLatestStatusMapState(map);
                setLatestIdMapState(idMap);
            })
            .catch(err => console.error("Gagal mendapatkan pengawasan history:", err))
            .finally(() => setIsLoadingHistory(false));
        });
    }, [selectedGanttId, spkInfo, activeHeaderClick]);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [latestStatusMapState, setLatestStatusMapState] = useState<Map<string, string>>(new Map());
    const [latestIdMapState, setLatestIdMapState] = useState<Map<string, number>>(new Map());

    const hasSelesaiItems = Array.from(latestStatusMapState.values()).some((s: string) => s.toLowerCase() === 'selesai');

    const memoConfig = useMemo(() => {
        if (!chartData || !activeHeaderClick) return [];
        const day = activeHeaderClick.dayIndex;
        // Peta semua tugas dan cek apakah items-nya valid (belum selesai/harus tampil)
        return chartData.processedTasks.map((task: any) => {
            const shift = task.computed.shift || 0;
            let isScheduledToday = false;
            let isLastDay = false;
            let hideOnProgress = true; // default hidden
            let rawRangeMatch: any = null;
            
            task.ranges?.forEach((r: any) => {
                if (!r.start || !r.end) return;
                const s = parseInt(r.start) + shift - 1;
                const e = parseInt(r.end) + shift - 1 + (parseInt(r.keterlambatan) || 0);
                
                if (s <= day && day <= e) isScheduledToday = true;
                
                // Cek apakah hari terakhir kategori ini bertepatan dengan hari pengawasan
                if (day === e) {
                    isLastDay = true;
                }
                
                // Progress harus muncul HANYA jika hari ini berjalan di dalam rentang waktu (day >= s) 
                // TETAPI belum mencapai hari terakhir (day < e).
                if (day >= s && day < e) {
                    hideOnProgress = false;
                }
                
                // Kita prioritaskan rawRangeMatch untuk rentang yang benar-benar aktif atau yang sudah terlewati
                if (day >= s && day <= e) {
                    rawRangeMatch = r;
                } else if (!rawRangeMatch && day > e) {
                    rawRangeMatch = r;
                }
            });
            
            if (!rawRangeMatch && task.ranges?.length > 0) {
                rawRangeMatch = task.ranges[0];
            }
            
            const catItems = rabItems.filter((item: any) => item.kategori_pekerjaan.toUpperCase() === task.name.toUpperCase());
            
            const filteredItems = catItems.filter((item: any) => {
                 const key = `${task.name.toUpperCase()}|${item.jenis_pekerjaan.toUpperCase()}`;
                 const latestStatus = latestStatusMapState.get(key);
                 
                 // Jika gantung, teruskan
                 if (latestStatus === 'Progress' || latestStatus === 'Terlambat') return true;
                 
                 // Jika Selesai, tampilkan saat jadwalnya memang aktif hari ini, atau jika barusan di-submit hari ini
                 const wasFinishedToday = liveHistory.some((lh: any) => lh.kategori_pekerjaan.toUpperCase() === task.name.toUpperCase() && lh.jenis_pekerjaan.toUpperCase() === item.jenis_pekerjaan.toUpperCase() && lh.status.toLowerCase() === 'selesai');
                 if (latestStatus === 'Selesai' && wasFinishedToday) return true;
                 
                 // Kalau belum pernah ada histori yg nggantung, ikut jadwal Gantt:
                 return isScheduledToday;
            });
            
            return {
                category: { ...task, isLastDay, hideOnProgress, rawRangeMatch },
                items: filteredItems
            };
        }).filter((d: any) => d.items.length > 0);
    }, [chartData, activeHeaderClick, rabItems, latestStatusMapState]);
    const handleSetStatus = (catName: string, itemJenis: string, status: string) => {
        setIsDirty(true);
        const key = `${catName.toUpperCase()}|${itemJenis.toUpperCase()}`;
        setMemoInputs(prev => ({
            ...prev,
            [key]: { 
                status, 
                lateDays: prev[key]?.lateDays || 0,
                catatan: prev[key]?.catatan || '',
                file: prev[key]?.file || null,
                dokumentasiUrl: prev[key]?.dokumentasiUrl || null
            }
        }));
    };

    const handleSetLateDays = (catName: string, itemJenis: string, lateDays: number) => {
        setIsDirty(true);
        const key = `${catName.toUpperCase()}|${itemJenis.toUpperCase()}`;
        setMemoInputs(prev => ({
            ...prev,
            [key]: { 
                status: prev[key]?.status || 'Terlambat', 
                lateDays: Math.max(0, lateDays),
                catatan: prev[key]?.catatan || '',
                file: prev[key]?.file || null,
                dokumentasiUrl: prev[key]?.dokumentasiUrl || null
            }
        }));
    };

    const handleSetField = (catName: string, itemJenis: string, field: 'catatan' | 'file', value: any) => {
        setIsDirty(true);
        const key = `${catName.toUpperCase()}|${itemJenis.toUpperCase()}`;
        setMemoInputs(prev => ({
            ...prev,
            [key]: {
                status: prev[key]?.status || '',
                lateDays: prev[key]?.lateDays || 0,
                catatan: prev[key]?.catatan || '',
                file: prev[key]?.file || null,
                dokumentasiUrl: prev[key]?.dokumentasiUrl || null,
                [field]: value
            }
        }));
    };

    const isSubmitValid = useMemo(() => {
        if (memoConfig.length === 0) return false;
        if (!isDirty) return false;

        for (const cat of memoConfig) {
            if (!cat.items) continue;
            for (const item of cat.items) {
                const isAlreadySelesai = latestStatusMapState.get(`${cat.category.name.toUpperCase()}|${item.jenis_pekerjaan.toUpperCase()}`) === 'Selesai';
                if (isAlreadySelesai) continue;

                const key = `${cat.category.name.toUpperCase()}|${item.jenis_pekerjaan.toUpperCase()}`;
                const input = memoInputs[key];
                
                if (!input || !input.status) {
                    return false;
                }
                
                if (input.status === 'Terlambat') {
                    if (input.lateDays === undefined || input.lateDays === null || input.lateDays <= 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }, [memoConfig, memoInputs, latestStatusMapState, isDirty]);

    const getDateStr = (dayIndexOffset: number) => {
        if (!spkInfo) return '';
        const d = new Date(spkInfo.startDate.split('T')[0] + 'T00:00:00');
        d.setDate(d.getDate() + dayIndexOffset);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };

    const isLastSupervisionDay = useMemo(() => {
        if (!pengawasanHistory || pengawasanHistory.length === 0 || !spkInfo || !activeHeaderClick) return false;
        
        const datesInNumeric = pengawasanHistory
            .map((p: any) => p.tanggal_pengawasan)
            .filter(Boolean)
            .map((dStr: string) => {
                const parts = dStr.split('/');
                if(parts.length === 3) {
                    return parseInt(`${parts[2]}${parts[1]}${parts[0]}`, 10);
                }
                return 0;
            })
            .filter((val: number) => val > 0)
            .sort((a: number, b: number) => a - b);
            
        if (datesInNumeric.length === 0) return false;
        const maxDate = datesInNumeric[datesInNumeric.length - 1];
        
        const offset = activeHeaderClick.dayIndex || 0;
        const dDate = new Date(spkInfo.startDate.split('T')[0] + 'T00:00:00');
        dDate.setDate(dDate.getDate() + offset);
        const yyyy = dDate.getFullYear();
        const mm = String(dDate.getMonth() + 1).padStart(2, '0');
        const dd = String(dDate.getDate()).padStart(2, '0');
        const currentNumeric = parseInt(`${yyyy}${mm}${dd}`, 10);
        
        return maxDate === currentNumeric;
    }, [pengawasanHistory, spkInfo, activeHeaderClick]);

    const handleSubmit = async () => {
        if (!selectedGanttId) {
            showAlert({ message: 'Draft belum disimpan permanen. Simpan Gantt Chart terlebih dahulu.', type: 'warning' });
            return;
        }

        setIsSubmitting(true);
        try {
            const itemsArrayInsert: any[] = [];
            const filesMapInsert: { index: number, file: File }[] = [];
            
            const itemsArrayUpdate: any[] = [];
            const filesMapUpdate: { index: number, file: File }[] = [];

            let catsLate = new Map<string, number>();

            const entriesToSubmit = Object.entries(memoInputs).filter(([_, val]) => val.status);

            const offset = activeHeaderClick?.dayIndex || 0;
            const dDate = new Date(spkInfo.startDate.split('T')[0] + 'T00:00:00');
            dDate.setDate(dDate.getDate() + offset);
            const yyyy = dDate.getFullYear();
            const mm = String(dDate.getMonth() + 1).padStart(2, '0');
            const dd = String(dDate.getDate()).padStart(2, '0');
            const formattedDate = `${yyyy}-${mm}-${dd}`;

            entriesToSubmit.forEach(([key, val]) => {
                const pipeIdx = key.indexOf('|');
                if (pipeIdx === -1) return; // malformed key, skip
                const catName = key.substring(0, pipeIdx);       // already UPPERCASE
                const itemJenis = key.substring(pipeIdx + 1);    // already UPPERCASE
                const upperKey = key; // already normalized
                const existingId = latestIdMapState.get(upperKey);

                // [PERBAIKAN 1]: Mengubah status menjadi lowercase utuh agar lolos validasi strict enum backend
                const statusLower = typeof val.status === 'string' ? val.status.toLowerCase() : '';
                const validStatuses = ['progress', 'selesai', 'terlambat'];
                if (!validStatuses.includes(statusLower)) return; // skip jika status tidak valid
                const statusSafe = statusLower;
                const lateDaysSafe = Number(val.lateDays) || 0;
                
                if (existingId) {
                    // [PERBAIKAN 2]: DILARANG mengirim keterlambatan, id_gantt, & tanggal_pengawasan pada API PUT
                    // [PERBAIKAN 3]: Hanya kirim catatan jika user mengisinya, hindari duplicate ID
                    const alreadyQueued = itemsArrayUpdate.some(i => i.id === Number(existingId));
                    if (alreadyQueued) return; // skip duplicate ID
                    const updateItem: any = { id: Number(existingId), status: statusSafe };
                    if (val.catatan && String(val.catatan).trim()) updateItem.catatan = String(val.catatan).trim();
                    itemsArrayUpdate.push(updateItem);
                    if (val.file) {
                        filesMapUpdate.push({ index: itemsArrayUpdate.length - 1, file: val.file });
                    }
                } else {
                    const insertItem: any = {
                        id_gantt: Number(selectedGanttId),
                        tanggal_pengawasan: formattedDate,
                        kategori_pekerjaan: catName,
                        jenis_pekerjaan: itemJenis,
                        status: statusSafe,
                        // [PERBAIKAN 4]: DILARANG mengirim keterlambatan pada payload POST bulk
                    };
                    if (val.catatan && String(val.catatan).trim()) insertItem.catatan = String(val.catatan).trim();
                    itemsArrayInsert.push(insertItem);
                    if (val.file) {
                        filesMapInsert.push({ index: itemsArrayInsert.length - 1, file: val.file });
                    }
                }
                
                if (val.status === 'Terlambat' && Number(val.lateDays) > 0) {
                    catsLate.set(catName, (catsLate.get(catName) || 0) + Number(val.lateDays));
                }
            });

            const { submitPengawasanBulk, updatePengawasanBulk } = await import('@/lib/api');
            const { API_URL } = await import('@/lib/constants');

            // --- A. Eksekusi INSERT (POST) ---
            if (itemsArrayInsert.length > 0) {
                if (filesMapInsert.length > 0) {
                    const formData = new FormData();
                    formData.append('items', JSON.stringify(itemsArrayInsert));
                    filesMapInsert.forEach(f => {
                        formData.append('file_dokumentasi', f.file);
                    });
                    const indexes = filesMapInsert.map(f => f.index);
                    formData.append('file_dokumentasi_indexes', JSON.stringify(indexes));
                    
                    await submitPengawasanBulk(formData);
                } else {
                    await submitPengawasanBulk({ items: itemsArrayInsert });
                }
            }

            // --- B. Eksekusi UPDATE (PUT) ---
            if (itemsArrayUpdate.length > 0) {
                if (filesMapUpdate.length > 0) {
                    // [PERBAIKAN 3]: Gunakan method spoofing ke POST agar payload Multipart FormData tidak drop di server PHP/Laravel
                    const formData = new FormData();
                    formData.append('items', JSON.stringify(itemsArrayUpdate));
                    formData.append('_method', 'PUT'); 

                    filesMapUpdate.forEach(f => {
                        formData.append('rev_file_dokumentasi', f.file);
                    });
                    const indexes = filesMapUpdate.map(f => f.index);
                    formData.append('rev_file_dokumentasi_indexes', JSON.stringify(indexes));
                    
                    const response = await fetch(`${API_URL.replace(/\/$/, "")}/api/pengawasan/bulk`, {
                        method: "POST",
                        body: formData
                    });
                    if(!response.ok) throw new Error("Gagal mengupdate pengawasan bulk dengan file.");
                } else {
                    // JSON request aman berjalan dengan HTTP PUT murni
                    await updatePengawasanBulk({ items: itemsArrayUpdate });
                }
            }

            // 2. Submit Keterlambatan (API Terpisah sesuai dokumentasi gantt delay)
            if (catsLate.size > 0) {
                const { updateGanttDelay } = await import('@/lib/api');
                const updates = Array.from(catsLate.entries()).map(([catName, totalLate]) => ({
                    kategori_pekerjaan: catName.toUpperCase(),
                    keterlambatan: String(totalLate)
                }));
                
                try {
                    await updateGanttDelay(selectedGanttId, { updates });
                } catch(e: any) {
                    console.warn("Update delay bulk error:", e);
                }
            }

            showAlert({ 
                message: 'Memo pengawasan berhasil disimpan! Lanjutkan ke form Opname.', 
                type: 'success',
                onConfirm: () => onSuccess()
            });
        } catch (err: any) {
            showAlert({ message: `Gagal menyimpan: ${err.message}`, type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-50 flex flex-col rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95">
                <div className="p-5 border-b flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-xl text-slate-800 leading-tight">
                                {isLastSupervisionDay ? "Serah Terima" : "Memo Pengawasan"}
                            </h2>
                            <p className="text-sm text-slate-500 font-medium">{activeHeaderClick.dateString}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowInstruksiModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-bold border border-indigo-200 transition-colors"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Instruksi Lapangan
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"><X className="w-6 h-6"/></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {isLoadingHistory ? (
                        <div className="flex flex-col items-center justify-center text-slate-400 py-12">
                            <Loader2 className="w-10 h-10 animate-spin mb-3 text-blue-500" />
                            <p className="font-medium text-slate-500">Memuat data pengawasan terakhir...</p>
                        </div>
                    ) : memoConfig.length === 0 ? (
                        hasSelesaiItems ? (
                            <div className="flex flex-col items-center justify-center text-slate-500 py-12 text-center">
                                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                                    <CheckCircle className="w-7 h-7" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700 mb-1">Semua Pekerjaan Selesai</h3>
                                <p className="font-medium mb-6">Pekerjaan pada hari ini telah memiliki memo Selesai.</p>
                                <Button onClick={onSuccess} className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2 h-auto text-sm shadow-md transition-transform hover:scale-105">
                                    Lanjut ke Form Opname &rarr;
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 py-12 text-center">
                                <Info className="w-12 h-12 mb-3 text-slate-300" />
                                <p className="font-medium">Tidak ada kategori pekerjaan yang sedang aktif pada hari ini.</p>
                            </div>
                        )
                    ) : (
                        memoConfig.map((d: any, i: number) => (
                            <div key={i} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="bg-slate-100 px-5 py-3 border-b flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800">{d.category.name}</h3>
                                    {d.category.isLastDay && <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Hari Terakhir Target!</Badge>}
                                </div>
                                <div className="p-2">
                                    {d.items && d.items.length > 0 ? (
                                        <table className="w-full text-sm text-left border-collapse">
                                            <tbody>
                                                {d.items.map((item: any, j: number) => {
                                                    const key = `${d.category.name.toUpperCase()}|${item.jenis_pekerjaan.toUpperCase()}`;
                                                    const currentStatus = memoInputs[key]?.status;
                                                    const lateDays = memoInputs[key]?.lateDays || 0;
                                                    return (
                                                        <tr key={j} className="border-b last:border-b-0 hover:bg-slate-50/50">
                                                            <td className="p-4 align-middle">
                                                                <p className="font-semibold text-slate-700">{item.jenis_pekerjaan}</p>
                                                            </td>
                                                            <td className="p-4 align-middle w-90">
                                                                {latestStatusMapState.get(`${d.category.name.toUpperCase()}|${item.jenis_pekerjaan.toUpperCase()}`) === 'Selesai' ? (
                                                                    <div className="flex items-center justify-center p-2.5 rounded-lg bg-green-50 border border-green-200/60 shadow-sm w-full">
                                                                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                                                                        <span className="font-bold text-green-700 text-sm">Telah Selesai</span>
                                                                    </div>
                                                                ) : (
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex gap-2">
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => handleSetStatus(d.category.name, item.jenis_pekerjaan, 'Selesai')}
                                                                            className={`flex-1 py-1.5 px-3 rounded text-xs font-bold transition-all ${currentStatus === 'Selesai' ? 'bg-green-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                                        >
                                                                            Selesai
                                                                        </button>
                                                                        
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => handleSetStatus(d.category.name, item.jenis_pekerjaan, 'Terlambat')}
                                                                            className={`flex-1 py-1.5 px-3 rounded text-xs font-bold transition-all ${currentStatus === 'Terlambat' ? 'bg-red-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                                        >
                                                                            Terlambat
                                                                        </button>

                                                                        {!d.category.hideOnProgress && (
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={() => handleSetStatus(d.category.name, item.jenis_pekerjaan, 'Progress')}
                                                                                className={`flex-1 py-1.5 px-3 rounded text-xs font-bold transition-all ${currentStatus === 'Progress' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                                            >
                                                                                Progress
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {/* Input Hari Keterlambatan jika status Terlambat */}
                                                                    {currentStatus === 'Terlambat' && (
                                                                        <div className="flex items-center gap-2 mt-1 animate-in slide-in-from-top-1">
                                                                            <span className="text-xs font-semibold text-red-600">Terlambat:</span>
                                                                            <input 
                                                                                type="number" min="0" 
                                                                                className="w-20 p-1 text-sm border-2 border-red-300 rounded focus:border-red-500 focus:outline-none" 
                                                                                value={lateDays === 0 ? '' : lateDays}
                                                                                onChange={(e) => handleSetLateDays(d.category.name, item.jenis_pekerjaan, parseInt(e.target.value) || 0)}
                                                                                placeholder="Hari"
                                                                            />
                                                                            <span className="text-xs text-slate-500">hari</span>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {/* Input Catatan & Dokumentasi ketika sudah di-set status */}
                                                                    {currentStatus && (
                                                                        <div className="mt-2 flex flex-col gap-2 rounded bg-slate-50 p-2 border border-slate-200">
                                                                            <textarea 
                                                                                className="w-full p-2 text-xs border border-slate-300 rounded focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
                                                                                placeholder="Tambahkan catatan/keterangan (opsional)..."
                                                                                value={memoInputs[key]?.catatan || ''}
                                                                                onChange={(e) => handleSetField(d.category.name, item.jenis_pekerjaan, 'catatan', e.target.value)}
                                                                                rows={2}
                                                                            />
                                                                            <div className="flex items-center text-xs">
                                                                                <span className="text-slate-600 font-medium w-16">Foto/Dok:</span>
                                                                                <input 
                                                                                    type="file" 
                                                                                    accept="image/*,.pdf,application/pdf"
                                                                                    onChange={(e) => handleSetField(d.category.name, item.jenis_pekerjaan, 'file', e.target.files?.[0] || null)}
                                                                                    className="flex-1 text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-4 text-center text-sm text-slate-500 italic">Data item jenis pekerjaan tidak tersedia.</div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-5 border-t bg-white flex justify-between items-center shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-10">
                    <div>
                        {hasSelesaiItems && (
                            <Button variant="outline" onClick={onSuccess} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border-emerald-200 font-semibold transition-colors">
                                Lanjut ke Opname &rarr;
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" className="font-semibold" onClick={onClose}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting || !isSubmitValid} className="bg-blue-600 hover:bg-blue-700 px-8 font-bold shadow-md">
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Simpan
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        {showInstruksiModal && (
            <InstruksiLapanganModal 
                onClose={() => setShowInstruksiModal(false)} 
                onSuccess={() => setShowInstruksiModal(false)} 
                initialTokoId={id_toko}
            />
        )}
        </>
    );
}

// Komponen OpnameModal
function OpnameModal({ activeHeaderClick, rabItems, id_toko, onClose, selectedGanttId, onSuccess }: any) {
    const { showAlert } = useGlobalAlert();
    const [completedItems, setCompletedItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [opnameInputs, setOpnameInputs] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        import('@/lib/api').then(({ fetchPengawasanList, fetchRABDetail, fetchOpnameList }) => {
            fetchPengawasanList({ id_gantt: selectedGanttId })
                .then(async res => {
                    const allData = res.data || [];
                    // Case-insensitive filtering in frontend to bypass strict backend endpoints
                    const data = allData.filter((p: any) => p.status?.toLowerCase() === 'selesai');
                    
                    let latestRabItems = rabItems;
                    let existingOpnameItems: any[] = [];

                    // Ambil daftar opname yg sudah ada untuk toko ini
                    if (id_toko) {
                        try {
                            const opnames = await fetchOpnameList({ id_toko });
                            existingOpnameItems = opnames.data || [];
                        } catch (e) {
                            console.warn("Gagal mendapatkan status opname existing:", e);
                        }
                    }

                    // Build maps from existing opname items
                    // Menggunakan Number() untuk menghindari type mismatch string vs number
                    const blockedRabItemIds = new Set<number>();
                    const existingOpnameMap = new Map<number, any>(); // id_rab_item -> opname record
                    existingOpnameItems.forEach((op: any) => {
                        const rid = Number(op.id_rab_item);
                        const status = (op.status || '').toLowerCase();
                        if (['pending', 'disetujui'].includes(status)) {
                            blockedRabItemIds.add(rid);
                        }
                        // Track latest opname record per rab_item for upsert (including ditolak)
                        if (!existingOpnameMap.has(rid) || Number(op.id) > Number(existingOpnameMap.get(rid).id)) {
                            existingOpnameMap.set(rid, op);
                        }
                    });

                    // Fetch fresh RAB data directly from GET api/rab/:id to guarantee satuan exists
                    const idRab = rabItems?.[0]?.id_rab;
                    if (idRab) {
                        try {
                            const rabRes = await fetchRABDetail(idRab);
                            if (rabRes?.data?.items) {
                                latestRabItems = rabRes.data.items;
                            }
                        } catch (e) {
                            console.error("Gagal get RAB detail fallback", e);
                        }
                    }

                    const merged = data.map((p: any) => {
                        // Coba gunakan id_rab_item langsung dari pengawasan jika tersedia
                        let matchedRabItemId = p.id_rab_item ? Number(p.id_rab_item) : null;
                        let rItem: any = null;

                        if (matchedRabItemId) {
                            // Cocokkan langsung via ID
                            rItem = latestRabItems.find((r: any) => Number(r.id) === matchedRabItemId);
                        }

                        // Fallback: cocokkan via nama kategori + jenis pekerjaan
                        if (!rItem) {
                            rItem = latestRabItems.find((r: any) =>
                                r.kategori_pekerjaan?.toUpperCase() === p.kategori_pekerjaan?.toUpperCase() &&
                                r.jenis_pekerjaan?.toUpperCase() === p.jenis_pekerjaan?.toUpperCase()
                            );
                            if (rItem) matchedRabItemId = Number(rItem.id);
                        }

                        // Lookup existing opname record for upsert id
                        const existingOp = matchedRabItemId ? existingOpnameMap.get(matchedRabItemId) : null;

                        return {
                            ...p,
                            id_rab_item: matchedRabItemId || rItem?.id,
                            volume_rab: parseFloat(rItem?.volume) || 0,
                            harga_material: parseFloat(rItem?.harga_material) || 0,
                            harga_upah: parseFloat(rItem?.harga_upah) || 0,
                            satuan: rItem?.satuan || '',
                            existing_opname_id: existingOp?.id || null, // for upsert
                            existing_opname: existingOp || null,
                        };
                    }).filter((item: any) => {
                        if (!item.id_rab_item) return false;
                        
                        // Filter: item yg sudah diajukan opname (pending/disetujui) tidak muncul lagi
                        if (blockedRabItemIds.has(Number(item.id_rab_item))) return false;
                        return true;
                    });

                    const deduped = new Map<number, any>();
                    merged.forEach((item: any) => {
                        const rid = Number(item.id_rab_item);
                        if (!deduped.has(rid) || Number(item.id) > Number(deduped.get(rid).id)) {
                            deduped.set(rid, item);
                        }
                    });
                    const dedupedItems = Array.from(deduped.values());

                    setCompletedItems(dedupedItems);
                    
                    const inputs: any = {};
                    dedupedItems.forEach((item: any) => {
                        const key = item.id;
                        const ex = item.existing_opname;
                        inputs[key] = {
                            volume_akhir: ex ? String(ex.volume_akhir) : String(item.volume_rab),
                            desain: ex?.desain || '',
                            kualitas: ex?.kualitas || '',
                            spesifikasi: ex?.spesifikasi || '',
                            catatan: ex?.catatan || '',
                            file: null,
                            existing_foto: ex?.foto || null,
                        };
                    });
                    setOpnameInputs(inputs);
                })
                .catch(err => {
                    console.error(err);
                    showAlert({ message: "Gagal memuat list pengawasan selesai.", type: "error" });
                })
                .finally(() => setIsLoading(false));
        });
    }, [selectedGanttId, rabItems]);

    const handleSetOpname = (id: number, field: string, value: any) => {
        setOpnameInputs(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value
            }
        }));
    };

    const groupedByCategory = useMemo(() => {
        const map = new Map<string, any[]>();
        completedItems.forEach(item => {
            const cat = item.kategori_pekerjaan;
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat)!.push(item);
        });
        return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
    }, [completedItems]);

    // Tambahan Validasi isSubmitValid
    const isSubmitValid = useMemo(() => {
        if (completedItems.length === 0) return false;
        
        for (const item of completedItems) {
            const input = opnameInputs[item.id];
            if (!input) return false;
            
            // 1. Validasi volume akhir tidak boleh kosong
            if (input.volume_akhir === undefined || input.volume_akhir === null || input.volume_akhir === '') return false;
            
            // 2. Validasi verifikasi pekerjaan (semua dropdown wajib diisi)
            if (!input.desain || input.desain === '') return false;
            if (!input.kualitas || input.kualitas === '') return false;
            if (!input.spesifikasi || input.spesifikasi === '') return false;
            
            // 3. Validasi foto bukti wajib diisi (boleh foto lama jika ada)
            if (!input.file && !input.existing_foto) return false;
        }
        
        return true;
    }, [completedItems, opnameInputs]);

    // Refactor handleSubmit dengan parsing tipe data untuk menghindari API Rejection
    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const emailPembuat = sessionStorage.getItem('loggedInUserEmail') || '';
            if (!id_toko || !emailPembuat) {
                showAlert({ message: "Data toko atau email user tidak ditemukan. Silakan login ulang lalu coba lagi.", type: "error" });
                setIsSubmitting(false);
                return;
            }

            const itemsArray: any[] = [];
            const filesMap: { index: number, file: File }[] = [];
            
            let currentIndex = 0;
            completedItems.forEach(item => {
                const input = opnameInputs[item.id];
                const volAkhir = parseFloat(input.volume_akhir) || 0;
                const selisihVol = volAkhir - item.volume_rab;
                const hargaSatuan = Number(item.harga_material || 0) + Number(item.harga_upah || 0);
                const totalSelisih = Math.round(selisihVol * hargaSatuan);
                const totalHargaOpname = Math.round(volAkhir * hargaSatuan);
                
                const itemData: any = {
                    id_toko: Number(id_toko),
                    id_rab_item: Number(item.id_rab_item),
                    status: 'pending',
                    volume_akhir: volAkhir,
                    selisih_volume: selisihVol,
                    total_selisih: totalSelisih,
                    total_harga_opname: totalHargaOpname,
                    desain: input.desain,
                    kualitas: input.kualitas,
                    spesifikasi: input.spesifikasi,
                    catatan: input.catatan || undefined,
                };

                // Include existing opname id for upsert if available
                if (item.existing_opname_id) {
                    itemData.id = Number(item.existing_opname_id);
                }

                // Preserve existing photo URL if no new file is selected
                if (!input.file && input.existing_foto) {
                    itemData.foto = input.existing_foto;
                }
                
                itemsArray.push(itemData);
                
                if (input.file) {
                    filesMap.push({ index: currentIndex, file: input.file });
                }
                currentIndex++;
            });
            
            if (itemsArray.length === 0) {
                showAlert({ message: "Tidak ada item untuk di-opname.", type: "warning" });
                setIsSubmitting(false);
                return;
            }

            const grandTotalOpname = itemsArray.reduce((acc, item) => {
                const rabRef = completedItems.find((completed) => completed.id_rab_item === item.id_rab_item);
                const hargaSatuan = Number(rabRef?.harga_material || 0) + Number(rabRef?.harga_upah || 0);
                return acc + Math.round(Number(item.volume_akhir) * hargaSatuan);
            }, 0);

            const grandTotalRab = completedItems.reduce((acc, item) => {
                const hargaSatuan = Number(item.harga_material || 0) + Number(item.harga_upah || 0);
                return acc + Math.round(Number(item.volume_rab || 0) * hargaSatuan);
            }, 0);
            
            const { submitOpnameBulk } = await import('@/lib/api');
            if (filesMap.length > 0) {
                const formData = new FormData();
                formData.append('id_toko', String(id_toko));
                formData.append('email_pembuat', emailPembuat);
                formData.append('grand_total_opname', String(Math.round(grandTotalOpname)));
                formData.append('grand_total_rab', String(Math.round(grandTotalRab)));
                formData.append('items', JSON.stringify(itemsArray));
                filesMap.forEach(f => {
                    formData.append('file_foto_opname', f.file);
                });
                // Mapping file index - hanya kirim indeks untuk item yang memang punya file baru
                formData.append('file_foto_opname_indexes', JSON.stringify(filesMap.map(f => f.index)));
                
                await submitOpnameBulk(formData);
            } else {
                await submitOpnameBulk({
                    id_toko: Number(id_toko),
                    email_pembuat: emailPembuat,
                    grand_total_opname: String(Math.round(grandTotalOpname)),
                    grand_total_rab: String(Math.round(grandTotalRab)),
                    items: itemsArray
                });
            }

            // Trigger API Berkas Serah Terima
            try {
                const { API_URL } = await import('@/lib/constants');
                const pdfRes = await fetch(`${API_URL.replace(/\/$/, "")}/api/create_pdf_serah_terima`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_toko: Number(id_toko) })
                });
                if (!pdfRes.ok) {
                    console.warn("Gagal trigger PDF serah terima:", await pdfRes.text());
                }
            } catch (pdfErr) {
                console.error("Error trigger PDF serah terima:", pdfErr);
            }
            
            showAlert({ 
                message: 'Data Opname berhasil disimpan!', 
                type: 'success',
                onConfirm: () => onSuccess()
            });
        } catch(e: any) {
             showAlert({ message: `Gagal menyimpan: ${e.message}`, type: "error" });
        } finally {
             setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-50 flex flex-col rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-in zoom-in-95">
                <div className="p-5 border-b flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                            <span className="font-bold">OP</span>
                        </div>
                        <div>
                            <h2 className="font-bold text-xl text-slate-800 leading-tight">Opname Pekerjaan Selesai</h2>
                            <p className="text-sm text-slate-500 font-medium">Isi detail opname untuk pekerjaan yang telah diverifikasi selesai</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"><X className="w-6 h-6"/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                            <Loader2 className="w-10 h-10 animate-spin text-slate-400 mb-2" />
                            <p>Memuat data pekerjaan...</p>
                        </div>
                    ) : groupedByCategory.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-500 bg-white rounded-lg border border-slate-200">
                            <Info className="w-12 h-12 mb-3 text-slate-300" />
                            <p className="font-semibold text-lg">Tidak ada pekerjaan yang selesai</p>
                            <p className="text-sm">Belum ada item pekerjaan yang telah disubmit sebagai Selesai.</p>
                        </div>
                    ) : (
                        groupedByCategory.map((category, i) => (
                            <div key={i} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
                                <div className="bg-slate-100 px-5 py-3 border-b flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">{category.name}</h3>
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">{category.items.length} Item</Badge>
                                </div>
                                <div className="p-4 space-y-4">
                                    {category.items.map((item, j) => {
                                        const input = opnameInputs[item.id] || {};
                                        const volAkhir = parseFloat(input.volume_akhir) || 0;
                                        const selisih = volAkhir - item.volume_rab;
                                        const hargaSatuan = item.harga_material + item.harga_upah;
                                        const totalHargaRAB = item.volume_rab * hargaSatuan;
                                        const totalHargaBaru = volAkhir * hargaSatuan;
                                        const selisihHarga = totalHargaBaru - totalHargaRAB;

                                        const formatRp = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
                                        
                                        return (
                                            <div key={j} className="border border-slate-200 p-4 rounded-lg bg-slate-50 flex flex-col gap-4">
                                                <div className="font-bold text-slate-800 border-b border-slate-200 pb-2 flex justify-between items-center">
                                                    <span>{item.jenis_pekerjaan}</span>
                                                    <div className="flex gap-2">
                                                        <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-1 rounded">Material: {formatRp(item.harga_material)}</span>
                                                        <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-1 rounded">Upah: {formatRp(item.harga_upah)}</span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                                                    
                                                    {/* Kolom 1: Info RAB, Input Volume, dan Kalkulasi Harga */}
                                                    <div className="space-y-3 bg-white p-3 rounded border border-slate-200 shadow-sm col-span-1">
                                                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b pb-1 mb-2">Volume & Biaya</h4>
                                                        <div className="flex justify-between items-center text-xs text-slate-600">
                                                            <span>Vol Awal (RAB):</span> 
                                                            <span className="font-bold">{item.volume_rab} <span className="text-[10px] text-slate-400 font-normal ml-0.5">{item.satuan}</span></span>
                                                        </div>
                                                        <div>
                                                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Volume Akhir Opname</label>
                                                            <div className="relative mt-1">
                                                                <input type="number" step="any" className="w-full p-1.5 border border-slate-300 rounded text-sm bg-blue-50 focus:bg-white focus:border-blue-500 focus:outline-none font-bold pr-12" 
                                                                    value={input.volume_akhir ?? ''} 
                                                                    onChange={(e)=>handleSetOpname(item.id, 'volume_akhir', e.target.value)} />
                                                                {item.satuan && <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-bold uppercase">{item.satuan}</span>}
                                                            </div>
                                                            <div className="text-[10px] text-right mt-1 text-slate-500">
                                                                Selisih Vol: <span className={`font-bold ${selisih > 0 ? 'text-blue-600' : (selisih < 0 ? 'text-red-600' : '')}`}>{selisih > 0 ? '+'+selisih : selisih} <span className="font-normal text-slate-400 ml-0.5">{item.satuan}</span></span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[11px] space-y-1.5 mt-2">
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-500">Total Harga RAB:</span>
                                                                <span className="font-medium">{formatRp(totalHargaRAB)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-700 font-semibold">Total Harga Opname:</span>
                                                                <span className="font-bold text-slate-800">{formatRp(totalHargaBaru)}</span>
                                                            </div>
                                                            <div className="flex justify-between border-t pt-1 border-slate-200">
                                                                <span className="text-slate-600">Selisih Biaya:</span>
                                                                <span className={`font-bold ${selisihHarga > 0 ? 'text-blue-600' : (selisihHarga < 0 ? 'text-red-600' : 'text-slate-500')}`}>
                                                                    {selisihHarga > 0 ? '+' : ''}{formatRp(selisihHarga)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Kolom 2: Verifikasi Mutu */}
                                                    <div className="space-y-3 bg-white p-3 rounded border border-slate-200 shadow-sm col-span-1">
                                                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b pb-1 mb-2">Verifikasi Pekerjaan</h4>
                                                        <div>
                                                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Desain</label>
                                                            <select className="w-full p-1.5 border border-slate-300 rounded mt-1 text-xs focus:border-blue-500 focus:outline-none bg-slate-50" value={input.desain || ''} onChange={(e)=>handleSetOpname(item.id, 'desain', e.target.value)}>
                                                                <option value="">-- Pilih --</option>
                                                                <option value="Sesuai">Sesuai</option>
                                                                <option value="Tidak Sesuai">Tidak Sesuai</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Kualitas</label>
                                                            <select className="w-full p-1.5 border border-slate-300 rounded mt-1 text-xs focus:border-blue-500 focus:outline-none bg-slate-50" value={input.kualitas || ''} onChange={(e)=>handleSetOpname(item.id, 'kualitas', e.target.value)}>
                                                                <option value="">-- Pilih --</option>
                                                                <option value="Baik">Baik</option>
                                                                <option value="Tidak Baik">Tidak Baik</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Spesifikasi</label>
                                                            <select className="w-full p-1.5 border border-slate-300 rounded mt-1 text-xs focus:border-blue-500 focus:outline-none bg-slate-50" value={input.spesifikasi || ''} onChange={(e)=>handleSetOpname(item.id, 'spesifikasi', e.target.value)}>
                                                                <option value="">-- Pilih --</option>
                                                                <option value="Sesuai">Sesuai</option>
                                                                <option value="Tidak Sesuai">Tidak Sesuai</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Kolom 3: Catatan & Foto Dokumentasi */}
                                                    <div className="space-y-3 bg-white p-3 rounded border border-slate-200 shadow-sm col-span-1 flex flex-col">
                                                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b pb-1 mb-2">Catatan & Dokumentasi</h4>
                                                        <div className="flex-1 flex flex-col">
                                                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Catatan Opname</label>
                                                            <textarea className="w-full p-2 border border-slate-300 rounded mt-1 text-xs focus:border-blue-500 focus:outline-none placeholder:text-slate-300 bg-slate-50 flex-1 resize-none min-h-15" placeholder="Masukkan keterangan selisih atau masalah kualitas..." value={input.catatan || ''} onChange={(e)=>handleSetOpname(item.id, 'catatan', e.target.value)}></textarea>
                                                        </div>
                                                        <div>
                                                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Foto Bukti (Drive)</label>
                                                            <input type="file" className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mt-1 cursor-pointer border border-slate-200 rounded p-1"
                                                                accept="image/*" onChange={(e)=>handleSetOpname(item.id, 'file', e.target.files?.[0] || null)} />
                                                            {!input.file && input.existing_foto && (
                                                                <div className="mt-2 flex items-center gap-2 p-1.5 bg-blue-50 border border-blue-100 rounded">
                                                                    <div className="w-8 h-8 rounded overflow-hidden border border-blue-200 bg-white shrink-0">
                                                                        <img src={input.existing_foto} alt="Existing" className="w-full h-full object-cover" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-[9px] font-bold text-blue-700 uppercase">Foto lama tersedia</p>
                                                                        <a href={input.existing_foto} target="_blank" rel="noreferrer" className="text-[9px] text-blue-500 hover:underline truncate block">Lihat full size</a>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-5 border-t bg-white flex justify-end gap-3 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-10">
                    <Button variant="outline" className="font-semibold" onClick={onClose}>Kembali</Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !isSubmitValid} 
                        className="bg-blue-600 hover:bg-blue-700 px-8 font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                        Submit Opname
                    </Button>
                </div>
            </div>
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