"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Save, Loader2, Search, Users, AlertCircle, CheckCircle,
    ChevronDown, Info, Hash, Calendar, Clock, MapPin, Building2,
    Briefcase, Eye, BarChartHorizontal
} from 'lucide-react';
import { useGlobalAlert } from '@/context/GlobalAlertContext';
import AppNavbar from '@/components/AppNavbar';
import {
    fetchSPKList, fetchRABList, fetchRABDetail,
    fetchGanttList, fetchGanttDetail, fetchGanttDetailByToko, submitGanttPengawasan,
    submitPICPengawasan, fetchPICPengawasanList, fetchUserCabangList,
    type SPKListItem, type RABListItem, type GanttDetailDayItem,
    type GanttDetailKategori, type GanttDetailDependency,
} from '@/lib/api';

// =============================================================================
// CONSTANTS
// =============================================================================

const DAY_WIDTH = 40;
const ROW_HEIGHT = 50;

const SUPERVISION_RULES: Record<number, number[]> = {
    10: [2, 5, 8, 10], 14: [2, 7, 10, 14], 20: [2, 12, 16, 20],
    30: [2, 7, 14, 18, 23, 30], 35: [2, 7, 17, 22, 28, 35],
    40: [2, 7, 17, 25, 33, 40], 48: [2, 10, 25, 32, 41, 48]
};

// =============================================================================
// HELPERS
// =============================================================================

const formatTanggal = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

function parseDateDDMMYYYY(dateStr: string) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return null;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/** Info item card for project details */
function InfoItem({ icon, label, value, highlight }: {
    icon: React.ReactNode; label: string; value: string; highlight?: boolean;
}) {
    return (
        <div className="flex items-start gap-2.5 p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
            <div className={`p-1.5 rounded-md shrink-0 mt-0.5 ${highlight ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className={`text-sm font-semibold truncate ${highlight ? 'text-amber-700' : 'text-slate-800'}`} title={value}>{value}</p>
            </div>
        </div>
    );
}

// =============================================================================
// INTERACTIVE GANTT CHART COMPONENT (with clickable day headers)
// =============================================================================

function InteractiveGanttChart({
    nomorUlok,
    idToko,
    selectedDays,
    onToggleDay,
    spkStartDate,
    spkDuration,
}: {
    nomorUlok: string;
    idToko?: number;
    selectedDays: number[];
    onToggleDay: (day: number) => void;
    spkStartDate?: string;  // ISO date string
    spkDuration?: number;   // SPK duration in days
}) {
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [projectData, setProjectData] = useState<any>(null);
    const [tasks, setTasks] = useState<any[]>([]); useEffect(() => {
        if (!nomorUlok && !idToko) return;

        setIsLoading(true);
        setErrorMsg('');

        const fetchPromise = idToko
            ? fetchGanttDetailByToko(idToko).then((res: any) => {
                if (!res || !res.gantt_data) throw new Error("Gantt Chart belum dibuat untuk proyek ini.");
                return {
                    data: {
                        gantt: res.gantt_data,
                        toko: res.toko,
                        kategori_pekerjaan: res.kategori_pekerjaan,
                        day_items: res.day_gantt_data,
                        dependencies: res.dependency_data || []
                    }
                };
            })
            : fetchGanttList({ nomor_ulok: nomorUlok })
                .then(res => {
                    const list = res.data || [];
                    if (list.length === 0) throw new Error("Gantt Chart belum dibuat untuk proyek ini.");
                    return fetchGanttDetail(list[0].id);
                });

        fetchPromise
            .then(detailRes => {
                if (!detailRes) return;
                const { gantt, toko, kategori_pekerjaan, day_items, dependencies } = detailRes.data;

                let projectStart = new Date();
                if (gantt.timestamp) {
                    const parts = gantt.timestamp.split('T')[0].split('-');
                    if (parts.length === 3) projectStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                }

                const msPerDay = 1000 * 60 * 60 * 24;
                const toDayNumber = (val: string): number => {
                    if (!val) return NaN;
                    if (val.includes('/')) {
                        const parsed = parseDateDDMMYYYY(val);
                        if (!parsed) return NaN;
                        const diff = Math.round((parsed.getTime() - projectStart.getTime()) / msPerDay);
                        return diff + 1;
                    }
                    return parseInt(val);
                };

                const endDaysRaw = day_items.map((entry: any) => toDayNumber(entry.h_akhir)).filter((d: number) => !isNaN(d));
                const maxDay = endDaysRaw.length > 0 ? Math.max(...endDaysRaw) : 0;
                const duration = maxDay;

                setProjectData({
                    duration: (spkDuration && spkDuration > 0) ? spkDuration : duration,
                    startDate: projectStart.toISOString().split('T')[0],
                    useSpkDates: !!(spkStartDate && spkDuration && spkDuration > 0),
                    spkStartDateObj: spkStartDate ? new Date(spkStartDate.split('T')[0] + 'T00:00:00') : projectStart,
                });

                let generatedTasks: any[] = kategori_pekerjaan.map((k: any, idx: number) => ({
                    id: idx + 1, name: k.kategori_pekerjaan, dependencies: [], ranges: [], keterlambatan: 0
                }));

                const categoryRangesMap: Record<string, any[]> = {};
                day_items.forEach((entry: any) => {
                    const startDay = toDayNumber(entry.h_awal);
                    const endDay = toDayNumber(entry.h_akhir);
                    if (!isNaN(startDay) && !isNaN(endDay)) {
                        const key = entry.kategori_pekerjaan.toLowerCase().trim();
                        if (!categoryRangesMap[key]) categoryRangesMap[key] = [];
                        categoryRangesMap[key].push({
                            start: startDay,
                            end: endDay,
                            duration: endDay - startDay + 1,
                            keterlambatan: parseInt(String(entry.keterlambatan || 0)),
                        });
                    }
                });

                const depMap: Record<string, string[]> = {};
                dependencies.forEach((dep: any) => {
                    const child = dep.kategori_pekerjaan.toLowerCase().trim();
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
                        ranges: matchedRanges.length > 0 ? matchedRanges : [{ start: '', end: '', keterlambatan: 0 }],
                        dependencies: parentIds,
                    };
                });

                setTasks(generatedTasks);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('GanttViewer error:', err);
                setErrorMsg(err?.message || "Gagal memuat detail Gantt Chart.");
                setIsLoading(false);
            });
    }, [nomorUlok, idToko, spkStartDate, spkDuration]);

    const chartData = useMemo(() => {
        if (!projectData || tasks.length === 0) return null;
        let processedTasks = [...tasks];
        let maxTaskEndDay = 0;

        processedTasks.forEach(task => {
            let maxShift = 0;
            const myParents = processedTasks.filter(pt => pt.dependencies && pt.dependencies.includes(task.id));
            if (myParents.length > 0) {
                myParents.forEach(parentTask => {
                    const parentShift = parentTask.computed?.shift || 0;
                    const pRanges = parentTask.ranges || [];
                    const parentDelay = pRanges.length > 0 ? (parseInt(pRanges[pRanges.length - 1].keterlambatan) || 0) : 0;
                    const potentialShift = parentShift + parentDelay;
                    if (potentialShift > maxShift) maxShift = potentialShift;
                });
            }

            task.computed = { shift: maxShift };

            const ranges = task.ranges || [];
            if (ranges.length > 0 && ranges[0].start) {
                ranges.forEach((r: any) => {
                    const endVal = parseInt(r.end || 0) + maxShift + (parseInt(r.keterlambatan) || 0);
                    if (endVal > maxTaskEndDay) maxTaskEndDay = endVal;
                });
            }
        });

        const totalDaysToRender = projectData.duration;
        const totalChartWidth = totalDaysToRender * DAY_WIDTH;
        const svgHeight = processedTasks.length * ROW_HEIGHT;

        let taskCoordinates: Record<number, any> = {};
        processedTasks.forEach((task, idx) => {
            const shift = task.computed.shift || 0;
            const ranges = task.ranges || [];
            if (ranges.length > 0 && ranges[0].start) {
                const maxEnd = Math.max(...ranges.map((r: any) => parseInt(r.end || 0) + shift + (parseInt(r.keterlambatan) || 0)));
                const minStart = Math.min(...ranges.map((r: any) => parseInt(r.start || 0) + shift));

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

        let svgLines: any[] = [];
        for (let i = 0; i < processedTasks.length; i++) {
            const task = processedTasks[i];
            if (task.dependencies && task.dependencies.length > 0) {
                for (let cId of task.dependencies) {
                    const parentCoordinates = taskCoordinates[task.id];
                    const childCoordinates = taskCoordinates[cId];
                    if (parentCoordinates && childCoordinates && parentCoordinates.firstEndX !== undefined && childCoordinates.startX !== undefined) {
                        const startX = parentCoordinates.firstEndX, startY = parentCoordinates.centerY;
                        const endX = childCoordinates.startX, endY = childCoordinates.centerY;
                        let tension = (endX - startX) < 40 ? 60 : 40;
                        if ((endX - startX) < 0) tension = 100;
                        const path = `M ${startX} ${startY} C ${startX + tension} ${startY}, ${endX - tension} ${endY}, ${endX} ${endY}`;
                        svgLines.push(
                            <g key={`${task.id}-${cId}`}>
                                <path d={path} className="stroke-blue-500 fill-transparent stroke-2" markerEnd="url(#depArrowPIC)" opacity="0.95" />
                                <circle cx={startX} cy={startY} r="4" className="fill-white stroke-blue-500 stroke-2" />
                                <circle cx={endX} cy={endY} r="4" className="fill-white stroke-blue-500 stroke-2" />
                            </g>
                        );
                    }
                }
            }
        }

        return { processedTasks, totalDaysToRender, totalChartWidth, svgHeight, svgLines };
    }, [tasks, projectData]);

    if (isLoading) {
        return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
    }

    if (errorMsg) {
        return (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-500">{errorMsg}</p>
            </div>
        );
    }

    if (!chartData) return null;

    const { processedTasks, totalDaysToRender, totalChartWidth, svgHeight, svgLines } = chartData;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-linear-to-r from-slate-50 to-blue-50 border-b flex justify-between items-center text-sm">
                <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <BarChartHorizontal className="w-4 h-4 text-blue-600" />
                        2. Gantt Chart & Hari Pengawasan
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Klik angka pada header hari untuk menandai hari pengawasan PIC.
                    </p>
                </div>
                {selectedDays.length > 0 && (
                    <div className="bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-xs font-bold">
                        {selectedDays.length} hari dipilih
                    </div>
                )}
            </div>
            <div className="flex border-b overflow-hidden relative" style={{ maxHeight: "450px" }}>
                {/* Left Pane — Task Names */}
                <div className="w-1/3 min-w-50 border-r border-slate-200 bg-white z-10 sticky left-0 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.1)] flex flex-col">
                    <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center px-4 font-bold text-slate-600">
                        Tahapan Pekerjaan
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar" id="pic-left-pane" onScroll={(e) => {
                        const rightPane = document.getElementById('pic-right-pane');
                        if (rightPane) rightPane.scrollTop = e.currentTarget.scrollTop;
                    }}>
                        {processedTasks.map((task) => (
                            <div key={task.id} className="border-b border-slate-100 flex flex-col justify-center px-4" style={{ height: ROW_HEIGHT }}>
                                <div className="font-semibold text-slate-800 truncate" title={task.name}>{task.id}. {task.name}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Pane — Chart */}
                <div className="w-2/3 flex-1 overflow-auto bg-grid-pattern relative pb-6" id="pic-right-pane" onScroll={(e) => {
                    const leftPane = document.getElementById('pic-left-pane');
                    if (leftPane) leftPane.scrollTop = e.currentTarget.scrollTop;
                }}>
                    {/* Header Hari — CLICKABLE */}
                    <div className="h-10 border-b border-slate-200 flex sticky top-0 bg-white z-20" style={{ minWidth: totalChartWidth }}>
                        {Array.from({ length: totalDaysToRender }).map((_, i) => {
                            const dayNumber = i + 1;
                            const isSelected = selectedDays.includes(dayNumber);
                            let label: string = String(dayNumber);
                            if (projectData?.useSpkDates && projectData?.spkStartDateObj) {
                                const d = new Date(projectData.spkStartDateObj);
                                d.setDate(d.getDate() + i);
                                const dd = String(d.getDate()).padStart(2, '0');
                                const mm = String(d.getMonth() + 1).padStart(2, '0');
                                label = `${dd}/${mm}`;
                            }
                            return (
                                <div
                                    key={i}
                                    className={`shrink-0 border-r border-slate-200 font-bold flex items-center justify-center cursor-pointer select-none transition-all duration-150 ${
                                        isSelected
                                            ? 'bg-blue-600 text-white shadow-inner'
                                            : 'bg-slate-50 text-slate-500 hover:bg-blue-100 hover:text-blue-700'
                                    }`}
                                    style={{ width: DAY_WIDTH, fontSize: projectData?.useSpkDates ? '9px' : undefined }}
                                    onClick={() => onToggleDay(dayNumber)}
                                    title={isSelected ? `Hari ke-${dayNumber} (terpilih — klik untuk batal)` : `Klik untuk pilih hari ke-${dayNumber}`}
                                >
                                    {label}
                                </div>
                            );
                        })}
                    </div>

                    <div className="relative" style={{ width: totalChartWidth, height: svgHeight }}>
                        {/* Day column lines */}
                        {Array.from({ length: totalDaysToRender }).map((_, i) => {
                            const dayNumber = i + 1;
                            const isSelected = selectedDays.includes(dayNumber);
                            return (
                                <div
                                    key={`col-${i}`}
                                    className={`absolute top-0 bottom-0 z-0 pointer-events-none ${
                                        isSelected ? 'bg-blue-50/80' : ''
                                    }`}
                                    style={{
                                        left: i * DAY_WIDTH,
                                        width: DAY_WIDTH,
                                        borderRight: '1px solid #f1f5f9',
                                    }}
                                />
                            );
                        })}

                        {/* SVG Dependency Lines */}
                        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-visible">
                            <defs>
                                <marker id="depArrowPIC" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                                    <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
                                </marker>
                            </defs>
                            {svgLines}
                        </svg>

                        {/* Task Bars */}
                        {processedTasks.map((task, rowIdx) => {
                            const shift = task.computed?.shift || 0;
                            const tRanges = task.ranges || [];
                            if (tRanges.length === 0 || !tRanges[0].start) return null;

                            return (
                                <div key={`row-${task.id}`} className="absolute left-0 right-0 border-b border-slate-100 z-10" style={{ top: rowIdx * ROW_HEIGHT, height: ROW_HEIGHT }}>
                                    {tRanges.map((r: any, rIdx: number) => {
                                        if (!r.start || !r.end) return null;
                                        const rStart = parseInt(r.start);
                                        const rEnd = parseInt(r.end);
                                        const bStart = rStart + shift;
                                        const bEnd = rEnd + shift + parseInt(r.keterlambatan || 0);
                                        const leftPos = (bStart - 1) * DAY_WIDTH;
                                        const blockWidth = (bEnd - bStart + 1) * DAY_WIDTH;

                                        return (
                                            <div
                                                key={`block-${task.id}-${rIdx}`}
                                                className="absolute border border-blue-500 rounded-md shadow-sm transition-all group overflow-hidden bg-blue-100 flex items-center justify-center cursor-default"
                                                style={{ left: leftPos, width: blockWidth, top: 8, height: ROW_HEIGHT - 16 }}
                                            >
                                                <div className="absolute inset-0 bg-blue-600 opacity-20"></div>
                                                <div className="relative z-10 font-bold text-[10px] text-blue-800 tracking-wider">
                                                    {bEnd - bStart + 1} Hari
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Selected days summary */}
            {selectedDays.length > 0 && (
                <div className="p-3 bg-blue-50 border-t border-blue-100">
                    <p className="text-xs font-bold text-blue-700 mb-1.5">Hari Pengawasan Terpilih:</p>
                    <div className="flex flex-wrap gap-1.5">
                        {[...selectedDays].sort((a, b) => a - b).map(day => (
                            <button
                                key={day}
                                type="button"
                                onClick={() => onToggleDay(day)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-full hover:bg-red-500 transition-colors group"
                                title="Klik untuk hapus"
                            >
                                H-{day}
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white/90">×</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <style jsx>{`
                .bg-grid-pattern {
                    background-image: linear-gradient(to right, #f8fafc 1px, transparent 1px);
                    background-size: 40px 100%;
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function InputPICPage() {
    const router = useRouter();
    const { showAlert } = useGlobalAlert();

    // ── Auth & User ──
    const [userInfo, setUserInfo] = useState({ name: '', role: '', cabang: '', email: '' });

    // ── Loading & Submit ──
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── Modal ──
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // ── Data ──
    const [approvedSpks, setApprovedSpks] = useState<SPKListItem[]>([]);
    const [selectedSpk, setSelectedSpk] = useState<SPKListItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // ── RAB detail for id_rab & kategori_lokasi ──
    const [rabDetail, setRabDetail] = useState<any>(null);

    // ── Status ──
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' as '' | 'info' | 'success' | 'warning' | 'error' });
    const [isLocked, setIsLocked] = useState(false);

    // ── Form ──
    const [picName, setPicName] = useState('');
    const [picList, setPicList] = useState<any[]>([]);
    const [selectedDays, setSelectedDays] = useState<number[]>([]);

    const requiredDays = useMemo(() => {
        if (!rabDetail?.kategori_lokasi) return 0;
        const katStr = rabDetail.kategori_lokasi.toLowerCase();
        if (katStr.includes('non ruko') || katStr.includes('non-ruko')) {
            return 8;
        } else if (katStr.includes('ruko')) {
            return 4;
        }
        return 0; // Kategori lainnya, biarkan 0 (tidak ada batasan ketat sementara ini, atau set limit khusus jika ada)
    }, [rabDetail]);

    // ── Auth guard: Only BRANCH BUILDING COORDINATOR ──
    useEffect(() => {
        const isAuth = sessionStorage.getItem("authenticated");
        const role = sessionStorage.getItem("userRole");
        const email = sessionStorage.getItem("loggedInUserEmail") || '';
        const cabang = sessionStorage.getItem("loggedInUserCabang") || '';

        if (isAuth !== "true" || !role) { router.push('/auth'); return; }

        if (role.toUpperCase() !== 'BRANCH BUILDING COORDINATOR') {
            showAlert({
                message: "Hanya Branch Building Coordinator yang dapat mengakses halaman ini.",
                type: "warning",
                onConfirm: () => router.push('/dashboard')
            });
            return;
        }

        const name = email.split('@')[0].toUpperCase();
        setUserInfo({ name, role, cabang, email });
        loadApprovedSpks(cabang);
        loadPicList(cabang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    const loadPicList = async (cabang: string) => {
        try {
            const res = await fetchUserCabangList({ cabang, jabatan: 'BRANCH BUILDING SUPPORT' });
            if (res.data) setPicList(res.data);
        } catch (error) {
            console.error("Gagal memuat daftar PIC:", error);
        }
    };

    // ── Load approved SPKs filtered by user's cabang ──
    const loadApprovedSpks = async (cabang: string) => {
        setIsLoading(true);
        try {
            const res = await fetchSPKList({ status: 'SPK_APPROVED' });
            const allSpks = res.data || [];
            // Filter by user's cabang via toko relationship
            const filtered = allSpks.filter((s: SPKListItem) => {
                const spkCabang = (s.toko?.cabang || '').toUpperCase();
                return spkCabang === cabang.toUpperCase();
            });
            setApprovedSpks(filtered);
        } catch (error: any) {
            setStatusMsg({ text: "Gagal memuat data SPK: " + error.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // ── Filtered SPKs by search ──
    const filteredSpks = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return approvedSpks.filter(s =>
            (s.nomor_ulok || '').toLowerCase().includes(q) ||
            (s.nomor_spk || '').toLowerCase().includes(q) ||
            (s.toko?.nama_toko || '').toLowerCase().includes(q) ||
            (s.toko?.kode_toko || s.kode_toko || '').toLowerCase().includes(q) ||
            (s.proyek || '').toLowerCase().includes(q)
        );
    }, [approvedSpks, searchQuery]);

    // ── Handle ULOK selection ──
    const handleSpkSelect = async (spkId: string) => {
        setStatusMsg({ text: '', type: '' });
        setIsLocked(false);
        setPicName('');
        setSelectedDays([]);
        setRabDetail(null);

        if (!spkId) {
            setSelectedSpk(null);
            return;
        }

        const selected = approvedSpks.find(s => s.id === parseInt(spkId));
        if (!selected) return;

        setSelectedSpk(selected);
        setStatusMsg({ text: 'Memuat detail proyek...', type: 'info' });

        // Check if PIC already assigned for this ULOK
        try {
            const picRes = await fetchPICPengawasanList({ nomor_ulok: selected.nomor_ulok });
            const existingPics = picRes.data || [];
            if (existingPics.length > 0) {
                setStatusMsg({
                    text: `PIC Pengawasan untuk ULOK ${selected.nomor_ulok} sudah ditentukan (${existingPics[0].plc_building_support}).`,
                    type: 'warning'
                });
                setIsLocked(true);
                return;
            }
        } catch {
            // No existing PIC — continue
        }

        // Fetch RAB detail for id_rab and kategori_lokasi
        try {
            const rabList = await fetchRABList({ nomor_ulok: selected.nomor_ulok });
            const approvedRab = (rabList.data || []).find(r =>
                r.status?.toUpperCase().includes('DISETUJUI') || r.status?.toUpperCase().includes('APPROVED')
            );
            if (approvedRab) {
                const detail = await fetchRABDetail(approvedRab.id);
                setRabDetail({
                    id: approvedRab.id,
                    kategori_lokasi: detail.data.rab.kategori_lokasi || '-',
                    durasi_pekerjaan: detail.data.rab.durasi_pekerjaan || '-',
                });
            }
        } catch (err) {
            console.warn("Gagal memuat detail RAB:", err);
        }

        setStatusMsg({ text: 'Detail proyek berhasil dimuat. Silakan pilih PIC dan hari pengawasan.', type: 'info' });
    };

    // ── Toggle day selection ──
    const handleToggleDay = useCallback((day: number) => {
        setSelectedDays(prev => {
            if (prev.includes(day)) {
                return prev.filter(d => d !== day);
            }
            if (requiredDays > 0 && prev.length >= requiredDays) {
                // Tidak bisa menambah hari lagi jika sudah mencapai batas maksimal
                return prev;
            }
            return [...prev, day].sort((a, b) => a - b);
        });
    }, [requiredDays]);

    // ── Submit PIC Pengawasan ──
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSpk || !picName.trim()) return;

        if (!rabDetail?.id) {
            showAlert({
                message: "Data RAB belum dimuat. Pastikan ULOK memiliki RAB yang disetujui.",
                type: "warning"
            });
            return;
        }

        if (requiredDays > 0 && selectedDays.length !== requiredDays) {
            showAlert({
                message: `Sesuai dengan kategori lokasi ULOK (${rabDetail.kategori_lokasi}), jumlah pemilihan hari pengawasan harus persis ${requiredDays} hari. Saat ini Anda baru memilih ${selectedDays.length} hari.`,
                type: "warning"
            });
            return;
        } else if (requiredDays === 0 && selectedDays.length === 0) {
            showAlert({
                message: "Silakan pilih minimal satu hari pengawasan di kalender Gantt.",
                type: "warning"
            });
            return;
        }

        setIsSubmitting(true);
        try {
            // Cek apakah Gantt Chart sudah ada
            let id_gantt = null;
            try {
                const ganttListRes = await fetchGanttList({ nomor_ulok: selectedSpk.nomor_ulok });
                const existingGantt = ganttListRes.data?.[0];
                if (existingGantt) {
                    id_gantt = existingGantt.id;
                }
            } catch (err) {
                throw new Error("Gagal memeriksa Gantt Chart untuk proyek ini.");
            }

            if (!id_gantt) {
                throw new Error("Gantt Chart belum dibuat untuk proyek ini. Harap lengkapi Jadwal Kerja terlebih dahulu.");
            }

            const startDateStr = selectedSpk.waktu_mulai?.split('T')[0] || '';
            const tglPengawasan = selectedDays.map(day => {
                const tempDate = new Date(startDateStr);
                tempDate.setDate(tempDate.getDate() + (day - 1));
                const d = tempDate.getDate().toString().padStart(2, '0');
                const m = (tempDate.getMonth() + 1).toString().padStart(2, '0');
                const y = tempDate.getFullYear();
                return `${d}/${m}/${y}`;
            });

            // Submit ke Gantt
            await submitGanttPengawasan(id_gantt, tglPengawasan);

            const payloadPIC = {
                nomor_ulok: selectedSpk.nomor_ulok,
                id_rab: rabDetail.id,
                id_spk: selectedSpk.id,
                kategori_lokasi: rabDetail.kategori_lokasi || '-',
                durasi: `${selectedSpk.durasi} Hari`,
                tanggal_mulai_spk: startDateStr,
                plc_building_support: picName.trim(),
                hari_pengawasan: selectedDays,
            };

            await submitPICPengawasan(payloadPIC);
            setShowSuccessModal(true);
        } catch (err: any) {
            showAlert({
                message: err.message || "Gagal menyimpan data PIC Pengawasan.",
                type: "error"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12 relative">
            <AppNavbar
                title="PIC PENGAWASAN"
                showBackButton
                backHref="/dashboard"
            />

            <main className="max-w-6xl mx-auto p-4 md:p-8 mt-4">
                <Card className="shadow-sm border-slate-200 relative z-10">
                    {/* ──── HEADER ──── */}
                    <div className="p-6 border-b border-slate-100 bg-white rounded-t-xl flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Input PIC Pengawasan</h2>
                            <p className="text-sm text-slate-500">Tentukan PIC (Branch Building Support) untuk mengawasi proyek.</p>
                        </div>
                    </div>

                    <CardContent className="p-6 md:p-8 bg-slate-50/50">
                        <form onSubmit={handleSubmit} className="space-y-8">

                            {/* ═══════════════════════════════════════════════════
                                SECTION 1: PILIH ULOK
                            ═══════════════════════════════════════════════════ */}
                            <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2">
                                    <Hash className="w-4 h-4 text-indigo-600" />
                                    1. Pilih ULOK Proyek
                                </h3>

                                {/* Search */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Cari &amp; Pilih ULOK *</label>
                                    <div className="relative mb-2">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Ketik No ULOK / Nama Toko / Kode Toko..."
                                            className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>

                                    {isLoading ? (
                                        <div className="p-3 text-center text-slate-500 bg-slate-100 rounded-lg text-sm">
                                            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                            Memuat data SPK yang disetujui...
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <select
                                                required
                                                className="w-full p-3 border rounded-lg bg-slate-50 outline-none font-semibold text-slate-700 cursor-pointer focus:bg-white focus:ring-2 focus:ring-indigo-500 appearance-none pr-10"
                                                value={selectedSpk?.id?.toString() || ''}
                                                onChange={(e) => handleSpkSelect(e.target.value)}
                                            >
                                                <option value="">-- Klik untuk Pilih ULOK --</option>
                                                {filteredSpks.map(s => (
                                                    <option key={s.id} value={s.id.toString()}>
                                                        {s.nomor_ulok} ({s.lingkup_pekerjaan}) — {s.toko?.kode_toko || s.kode_toko || ''} — {s.toko?.nama_toko || ''} — {s.proyek}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                        </div>
                                    )}
                                </div>

                                {/* Status Message */}
                                {statusMsg.text && (
                                    <div className={`p-4 rounded-lg flex items-start gap-3 mt-4 font-medium text-sm ${
                                        statusMsg.type === 'error'   ? 'bg-red-50 text-red-700 border border-red-200' :
                                        statusMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                                        statusMsg.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                        'bg-blue-50 text-blue-700 border border-blue-200'
                                    }`}>
                                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                        <p>{statusMsg.text}</p>
                                    </div>
                                )}

                                {/* Project Detail Cards */}
                                {selectedSpk && (
                                    <div className="pt-4 border-t mt-4 border-slate-100">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-linear-to-br from-slate-50 to-indigo-50/30 p-4 rounded-xl border border-slate-200">
                                            <InfoItem
                                                icon={<Hash className="w-3.5 h-3.5" />}
                                                label="Nomor ULOK"
                                                value={selectedSpk.nomor_ulok}
                                            />
                                            <InfoItem
                                                icon={<Building2 className="w-3.5 h-3.5" />}
                                                label="Nama Toko"
                                                value={selectedSpk.toko?.nama_toko || '-'}
                                            />
                                            <InfoItem
                                                icon={<Hash className="w-3.5 h-3.5" />}
                                                label="Kode Toko"
                                                value={selectedSpk.toko?.kode_toko || selectedSpk.kode_toko || '-'}
                                            />
                                            <InfoItem
                                                icon={<MapPin className="w-3.5 h-3.5" />}
                                                label="Cabang"
                                                value={selectedSpk.toko?.cabang || '-'}
                                            />
                                            <InfoItem
                                                icon={<Briefcase className="w-3.5 h-3.5" />}
                                                label="Proyek"
                                                value={selectedSpk.proyek || '-'}
                                            />
                                            <InfoItem
                                                icon={<Eye className="w-3.5 h-3.5" />}
                                                label="Lingkup Pekerjaan"
                                                value={selectedSpk.lingkup_pekerjaan || '-'}
                                            />
                                            <InfoItem
                                                icon={<Users className="w-3.5 h-3.5" />}
                                                label="Kontraktor"
                                                value={selectedSpk.nama_kontraktor || '-'}
                                            />
                                            <InfoItem
                                                icon={<Clock className="w-3.5 h-3.5" />}
                                                label="Durasi"
                                                value={`${selectedSpk.durasi} Hari`}
                                            />
                                            <InfoItem
                                                icon={<Calendar className="w-3.5 h-3.5" />}
                                                label="Tgl Mulai SPK"
                                                value={formatTanggal(selectedSpk.waktu_mulai)}
                                                highlight
                                            />
                                            {rabDetail && (
                                                <InfoItem
                                                    icon={<MapPin className="w-3.5 h-3.5" />}
                                                    label="Kategori Lokasi"
                                                    value={rabDetail.kategori_lokasi}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ═══════════════════════════════════════════════════
                                SECTION 2: GANTT CHART INTERAKTIF
                            ═══════════════════════════════════════════════════ */}
                            {selectedSpk && !isLocked && (
                                <div className="space-y-4">
                                    <InteractiveGanttChart
                                        nomorUlok={selectedSpk.nomor_ulok}
                                        idToko={selectedSpk.toko ? undefined : undefined}
                                        selectedDays={selectedDays}
                                        onToggleDay={handleToggleDay}
                                        spkStartDate={selectedSpk.waktu_mulai}
                                        spkDuration={selectedSpk.durasi}
                                    />
                                </div>
                            )}

                            {/* ═══════════════════════════════════════════════════
                                SECTION 3: PEMILIHAN PIC
                            ═══════════════════════════════════════════════════ */}
                            {selectedSpk && !isLocked && (
                                <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-indigo-600" />
                                        3. Pilih PIC Pengawasan
                                    </h3>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">
                                            Nama PIC (Branch Building Support) *
                                        </label>
                                        <select
                                            required
                                            className="w-full p-3 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold cursor-pointer"
                                            value={picName}
                                            onChange={(e) => setPicName(e.target.value)}
                                        >
                                            <option value="" disabled>-- Pilih Branch Building Support --</option>
                                            {picList.map((pic, idx) => (
                                                <option key={pic.id || idx} value={pic.nama_lengkap || pic.email}>
                                                    {pic.nama_lengkap || pic.email}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-500">
                                            Pilih nama PIC dari Branch Building Support di cabang <strong>{userInfo.cabang || '-'}</strong>.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ═══════════════════════════════════════════════════
                                TOMBOL SUBMIT
                            ═══════════════════════════════════════════════════ */}
                            {selectedSpk && !isLocked && (
                                <div className="pt-4 pb-4">
                                    <Button
                                        type="submit"
                                        disabled={
                                            isSubmitting || 
                                            !selectedSpk || 
                                            !picName.trim() || 
                                            (requiredDays > 0 && selectedDays.length !== requiredDays) ||
                                            (requiredDays === 0 && selectedDays.length === 0)
                                        }
                                        className="w-full h-14 text-lg font-bold shadow-lg transition-all bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-400 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting
                                            ? <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> Menyimpan Data...</>
                                            : <><Save className="w-6 h-6 mr-2" /> Simpan PIC Pengawasan</>
                                        }
                                    </Button>
                                </div>
                            )}
                        </form>
                    </CardContent>
                </Card>
            </main>

            {/* ════════════════════════════════════════════════════════════
                MODAL: SUKSES
            ════════════════════════════════════════════════════════════ */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center transform scale-100 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Berhasil!</h2>
                        <p className="text-slate-600 mb-8 leading-relaxed">
                            PIC Pengawasan untuk ULOK <b>{selectedSpk?.nomor_ulok}</b> berhasil disimpan.
                            PIC yang ditunjuk: <b>{picName}</b>.
                        </p>
                        <Button
                            onClick={() => router.push('/dashboard')}
                            className="w-full h-12 bg-slate-800 hover:bg-slate-900 text-white font-bold text-lg rounded-xl"
                        >
                            Kembali ke Dashboard
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
