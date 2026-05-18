"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
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
    fetchGanttList, fetchGanttDetail, submitGanttPengawasan,
    submitPICPengawasan, fetchPICPengawasanList, fetchUserCabangList,
    type SPKListItem
} from '@/lib/api';
import { BRANCH_GROUPS } from '@/lib/constants';

// =============================================================================
// CONSTANTS
// =============================================================================

const DAY_WIDTH = 40;
const ROW_HEIGHT = 50;

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
// INTERACTIVE GANTT CHART COMPONENT
// =============================================================================

function InteractiveGanttChart({
    ganttId,
    readonlyDays,
    selectedDays,
    onToggleDay,
    spkStartDate,
    spkDuration,
    onDataLoaded,
    requiredDays,
}: {
    ganttId: number;
    readonlyDays?: boolean;
    selectedDays: number[];
    onToggleDay: (day: number) => void;
    spkStartDate?: string;
    spkDuration?: number;
    onDataLoaded?: (duration: number) => void;
    requiredDays: number;
}) {
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [projectData, setProjectData] = useState<any>(null);
    const [tasks, setTasks] = useState<any[]>([]); 
    
    useEffect(() => {
        if (!ganttId) return;

        setIsLoading(true);
        setErrorMsg('');

        fetchGanttDetail(ganttId)
            .then(res => {
                if (!res || !res.data) throw new Error("Gantt Chart belum dibuat untuk proyek ini.");
                return res;
            })
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
                const finalDuration = (spkDuration && spkDuration > 0) ? spkDuration : duration;

                setProjectData({
                    duration: finalDuration,
                    startDate: projectStart.toISOString().split('T')[0],
                    useSpkDates: !!(spkStartDate && spkDuration && spkDuration > 0),
                    spkStartDateObj: spkStartDate ? new Date(spkStartDate.split('T')[0] + 'T00:00:00') : projectStart,
                    lingkup_pekerjaan: toko?.lingkup_pekerjaan || '',
                });

                if (onDataLoaded) onDataLoaded(finalDuration);

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
    }, [ganttId, spkStartDate, spkDuration]);

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
                        Gantt Chart {projectData?.lingkup_pekerjaan ? `(${projectData.lingkup_pekerjaan})` : ''}
                    </h3>
                    {!readonlyDays && (
                        <p className="text-xs text-slate-500 mt-0.5">
                            Klik angka pada header hari untuk menandai hari pengawasan PIC.
                            {requiredDays > 0 && (
                                <span className="font-bold text-indigo-600 ml-1">
                                    (Wajib pilih tepat {requiredDays} hari)
                                </span>
                            )}
                        </p>
                    )}
                </div>
                {!readonlyDays && (
                    <div className={`border rounded-full px-3 py-1 text-xs font-bold ${
                        requiredDays > 0 && selectedDays.length === requiredDays
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : requiredDays > 0 && selectedDays.length > requiredDays
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : 'bg-blue-100 text-blue-700 border-blue-200'
                    }`}>
                        {selectedDays.length}{requiredDays > 0 ? ` / ${requiredDays}` : ''} hari dipilih
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
                                    className={`shrink-0 border-r border-slate-200 font-bold flex items-center justify-center select-none transition-all duration-150 ${
                                        isSelected
                                            ? 'bg-blue-600 text-white shadow-inner'
                                            : readonlyDays 
                                                ? 'bg-slate-50 text-slate-500' 
                                                : 'bg-slate-50 text-slate-500 hover:bg-blue-100 hover:text-blue-700'
                                    } ${!readonlyDays ? 'cursor-pointer' : ''}`}
                                    style={{ width: DAY_WIDTH, fontSize: projectData?.useSpkDates ? '9px' : undefined }}
                                    onClick={() => !readonlyDays && onToggleDay(dayNumber)}
                                    title={
                                        readonlyDays 
                                            ? isSelected ? `Hari ke-${dayNumber} (terpilih)` : `Hari ke-${dayNumber}` 
                                            : isSelected ? `Hari ke-${dayNumber} (terpilih — klik untuk batal)` : `Klik untuk pilih hari ke-${dayNumber}`
                                    }
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
            {!readonlyDays && selectedDays.length > 0 && (
                <div className="p-3 bg-blue-50 border-t border-blue-100">
                    <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-bold text-blue-700">Hari Pengawasan Terpilih:</p>
                        {requiredDays > 0 && selectedDays.length !== requiredDays && (
                            <p className={`text-xs font-bold ${selectedDays.length > requiredDays ? 'text-red-600' : 'text-amber-600'}`}>
                                {selectedDays.length > requiredDays
                                    ? `Kelebihan ${selectedDays.length - requiredDays} hari! Hapus ${selectedDays.length - requiredDays} hari.`
                                    : `Kurang ${requiredDays - selectedDays.length} hari lagi.`
                                }
                            </p>
                        )}
                        {requiredDays > 0 && selectedDays.length === requiredDays && (
                            <p className="text-xs font-bold text-green-600">✓ Jumlah hari sudah sesuai</p>
                        )}
                    </div>
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
// SUB-COMPONENT: SPK PIC FORM
// =============================================================================

function SpkPicForm({
    spk,
    rabDetail,
    picList,
    userInfo,
    onSuccess
}: {
    spk: SPKListItem;
    rabDetail: any;
    picList: any[];
    userInfo: { name: string; role: string; cabang: string; email: string };
    onSuccess: (spkId: number, picName: string) => void;
}) {
    const { showAlert } = useGlobalAlert();
    const isHO = userInfo.cabang?.toUpperCase() === 'HEAD OFFICE';
    const [picName, setPicName] = useState('');
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [ganttDuration, setGanttDuration] = useState<number>(0);
    const [ganttIds, setGanttIds] = useState<number[]>([]);
    const [isLocked, setIsLocked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' as '' | 'info' | 'success' | 'warning' | 'error' });

    const requiredDays = useMemo(() => {
        if (!rabDetail?.kategori_lokasi) return 0;
        const katStr = rabDetail.kategori_lokasi.toLowerCase();
        if (katStr.includes('non ruko') || katStr.includes('non-ruko')) return 8;
        if (katStr.includes('ruko')) return 4;
        return 0;
    }, [rabDetail]);

    useEffect(() => {
        if (!spk.id) return;
        fetchPICPengawasanList({ id_spk: spk.id })
            .then(res => {
                if (res.data && res.data.length > 0) {
                    setIsLocked(true);
                    setStatusMsg({
                        text: `PIC Pengawasan untuk Lingkup ${spk.lingkup_pekerjaan} sudah ditentukan (${res.data[0].plc_building_support}).`,
                        type: 'success'
                    });
                }
            })
            .catch(console.error);
    }, [spk.id, spk.lingkup_pekerjaan]);

    useEffect(() => {
        if (!spk.nomor_ulok) return;
        fetchGanttList({ nomor_ulok: spk.nomor_ulok })
            .then(res => {
                if (res.data && res.data.length > 0) {
                    const fetchDetails = res.data.map((g: any) => fetchGanttDetail(g.id));
                    Promise.all(fetchDetails).then(details => {
                        const matching = details.filter(d => {
                            if (!d.data?.toko?.lingkup_pekerjaan) return false;
                            const gScope = d.data.toko.lingkup_pekerjaan.toUpperCase();
                            const sScope = spk.lingkup_pekerjaan.toUpperCase();
                            return gScope.includes(sScope) || sScope.includes(gScope);
                        });
                        setGanttIds(matching.map(d => d.data.gantt.id));
                    });
                }
            })
            .catch(console.error);
    }, [spk.nomor_ulok, spk.lingkup_pekerjaan]);

    const handleDataLoaded = useCallback((duration: number) => {
        setGanttDuration(prev => Math.max(prev, duration));
        setSelectedDays(prev => {
            if (!prev.includes(duration)) {
                return [...prev, duration].sort((a, b) => a - b);
            }
            return prev;
        });
    }, []);

    const handleToggleDay = useCallback((day: number) => {
        if (ganttDuration > 0 && day === ganttDuration) {
            showAlert({ message: "Hari terakhir pekerjaan wajib dipilih dan tidak dapat dibatalkan.", type: "warning" });
            return;
        }

        setSelectedDays(prev => {
            if (prev.includes(day)) return prev.filter(d => d !== day);
            if (requiredDays > 0 && prev.length >= requiredDays) {
                setTimeout(() => {
                    showAlert({
                        message: `Jumlah hari pengawasan sudah mencapai batas maksimal (${requiredDays} hari).`,
                        type: "warning"
                    });
                }, 0);
                return prev;
            }
            return [...prev, day].sort((a, b) => a - b);
        });
    }, [ganttDuration, requiredDays, showAlert]);

    const handleSubmit = async () => {
        if (!picName.trim()) return;

        const idToko = spk.toko?.id ?? spk.id_toko;
        if (!idToko) {
            showAlert({ message: "ID toko tidak ditemukan pada data SPK.", type: "warning" });
            return;
        }

        if (!rabDetail?.id) {
            showAlert({ message: "Data RAB belum dimuat.", type: "warning" });
            return;
        }

        if (!selectedDays.includes(1) && !selectedDays.includes(2)) {
            showAlert({ message: "Wajib memilih H1 atau H2.", type: "warning" });
            return;
        }

        if (ganttDuration > 0 && !selectedDays.includes(ganttDuration)) {
            showAlert({ message: `Wajib memilih H${ganttDuration}.`, type: "warning" });
            return;
        }

        if (requiredDays > 0 && selectedDays.length !== requiredDays) {
            showAlert({ message: `Wajib tepat ${requiredDays} hari.`, type: "warning" });
            return;
        }

        setIsSubmitting(true);
        try {
            if (ganttIds.length === 0) {
                throw new Error("Gantt Chart belum dibuat untuk lingkup ini.");
            }

            const startDateStr = spk.waktu_mulai?.split('T')[0] || '';
            const tglPengawasan = selectedDays.map(day => {
                const tempDate = new Date(startDateStr);
                tempDate.setDate(tempDate.getDate() + (day - 1));
                const d = tempDate.getDate().toString().padStart(2, '0');
                const m = (tempDate.getMonth() + 1).toString().padStart(2, '0');
                const y = tempDate.getFullYear();
                return `${d}/${m}/${y}`;
            });

            for (const gid of ganttIds) {
                await submitGanttPengawasan(gid, tglPengawasan);
            }

            const payloadPIC = {
                id_toko: idToko,
                nomor_ulok: spk.nomor_ulok,
                id_rab: rabDetail.id,
                id_spk: spk.id,
                kategori_lokasi: rabDetail.kategori_lokasi || '-',
                durasi: `${spk.durasi} Hari`,
                tanggal_mulai_spk: startDateStr,
                plc_building_support: picName.trim(),
                hari_pengawasan: selectedDays,
            };

            await submitPICPengawasan(payloadPIC);
            setIsLocked(true);
            setStatusMsg({ text: `Berhasil disimpan! PIC yang ditunjuk: ${picName}`, type: 'success' });
            onSuccess(spk.id, picName);
        } catch (err: any) {
            showAlert({ message: err.message || "Gagal menyimpan data PIC Pengawasan.", type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            <div className="bg-indigo-50 border-b border-indigo-100 p-4">
                <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-indigo-600" />
                    Lingkup Pekerjaan: {spk.lingkup_pekerjaan}
                </h3>
            </div>
            <div className="p-5 space-y-6">
                {statusMsg.text && (
                    <div className={`p-4 rounded-lg flex items-start gap-3 font-medium text-sm ${
                        statusMsg.type === 'error'   ? 'bg-red-50 text-red-700 border border-red-200' :
                        statusMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                        statusMsg.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                        {statusMsg.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                        <p>{statusMsg.text}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <InfoItem icon={<Users className="w-3.5 h-3.5" />} label="Kontraktor" value={spk.nama_kontraktor || '-'} />
                    <InfoItem icon={<Clock className="w-3.5 h-3.5" />} label="Durasi" value={`${spk.durasi} Hari`} />
                    <InfoItem icon={<Calendar className="w-3.5 h-3.5" />} label="Tgl Mulai SPK" value={formatTanggal(spk.waktu_mulai)} highlight />
                    <InfoItem icon={<BarChartHorizontal className="w-3.5 h-3.5" />} label="Gantt Chart" value={ganttIds.length > 0 ? 'Tersedia' : 'Belum Ada'} />
                </div>

                {!isLocked && ganttIds.length > 0 && (
                    <div className="space-y-4">
                        {ganttIds.map((gid, idx) => (
                            <InteractiveGanttChart
                                key={gid}
                                ganttId={gid}
                                readonlyDays={isHO || idx > 0}
                                selectedDays={selectedDays}
                                onToggleDay={handleToggleDay}
                                spkStartDate={spk.waktu_mulai}
                                spkDuration={spk.durasi}
                                requiredDays={requiredDays}
                                onDataLoaded={handleDataLoaded}
                            />
                        ))}

                        {requiredDays > 0 && (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <Info className="w-4 h-4 text-indigo-500" />
                                    Syarat Hari Pengawasan ({rabDetail?.kategori_lokasi})
                                </h4>
                                <ul className="text-xs space-y-1.5 ml-6">
                                    <li className={`flex items-center gap-2 ${(selectedDays.includes(1) || selectedDays.includes(2)) ? 'text-green-600' : 'text-slate-500'}`}>
                                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${(selectedDays.includes(1) || selectedDays.includes(2)) ? 'border-green-500 bg-green-50 text-green-600' : 'border-slate-300'}`}>
                                            {(selectedDays.includes(1) || selectedDays.includes(2)) ? '✓' : ''}
                                        </span>
                                        Wajib pilih <strong>H1</strong> atau <strong>H2</strong>
                                    </li>
                                    <li className={`flex items-center gap-2 ${ganttDuration > 0 && selectedDays.includes(ganttDuration) ? 'text-green-600' : 'text-slate-500'}`}>
                                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${ganttDuration > 0 && selectedDays.includes(ganttDuration) ? 'border-green-500 bg-green-50 text-green-600' : 'border-slate-300'}`}>
                                            {ganttDuration > 0 && selectedDays.includes(ganttDuration) ? '✓' : ''}
                                        </span>
                                        Wajib pilih <strong>H terakhir (H{ganttDuration || '?'})</strong>
                                    </li>
                                    <li className={`flex items-center gap-2 ${selectedDays.length === requiredDays ? 'text-green-600' : selectedDays.length > requiredDays ? 'text-red-600' : 'text-slate-500'}`}>
                                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${selectedDays.length === requiredDays ? 'border-green-500 bg-green-50 text-green-600' : selectedDays.length > requiredDays ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-300'}`}>
                                            {selectedDays.length === requiredDays ? '✓' : selectedDays.length > requiredDays ? '!' : ''}
                                        </span>
                                        Jumlah hari harus tepat <strong>{requiredDays} hari</strong> — saat ini: {selectedDays.length}/{requiredDays}
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {!isLocked && (
                    <div className="space-y-4 bg-slate-50 p-5 rounded-lg border border-slate-200">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Nama PIC (Branch Building Support) *</label>
                            <select
                                required
                                disabled={isHO}
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
                        </div>
                    </div>
                )}

                {!isLocked && !isHO && (
                    <div className="pt-2">
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={
                                isSubmitting || 
                                !picName.trim() || 
                                selectedDays.length === 0 ||
                                (!selectedDays.includes(1) && !selectedDays.includes(2)) ||
                                (ganttDuration > 0 && !selectedDays.includes(ganttDuration)) ||
                                (requiredDays > 0 && selectedDays.length !== requiredDays)
                            }
                            className="w-full h-12 text-base font-bold shadow-md transition-all bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-400 disabled:cursor-not-allowed"
                        >
                            {isSubmitting
                                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Menyimpan...</>
                                : <><Save className="w-5 h-5 mr-2" /> Simpan PIC ({spk.lingkup_pekerjaan})</>
                            }
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

type UlokGroup = {
    nomor_ulok: string;
    lingkup_gabungan: string;
    toko: any;
    proyek: string;
    kode_toko: string;
    spks: SPKListItem[];
};

export default function InputPICPage() {
    const router = useRouter();
    const { showAlert } = useGlobalAlert();

    const [userInfo, setUserInfo] = useState({ name: '', role: '', cabang: '', email: '' });
    const [isLoading, setIsLoading] = useState(false);
    
    // UI states
    const [searchQuery, setSearchQuery] = useState('');
    const [cabangFilter, setCabangFilter] = useState('');
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' as '' | 'info' | 'success' | 'warning' | 'error' });
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Data states
    const [approvedGroups, setApprovedGroups] = useState<UlokGroup[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<UlokGroup | null>(null);
    const [rabDetail, setRabDetail] = useState<any>(null);
    const [picList, setPicList] = useState<any[]>([]);

    const { user } = useSession();

    useEffect(() => {
        if (!user) return;

        const { role, email, cabang } = user;
        const roleUpper = role.toUpperCase();
        const cabangUpper = cabang.toUpperCase();
        const isHO = cabangUpper === 'HEAD OFFICE';

        const isAllowed = 
            isHO ||
            roleUpper === 'BRANCH BUILDING COORDINATOR' ||
            (cabangUpper === 'MANADO' && roleUpper === 'BRANCH BUILDING & MAINTENANCE MANAGER');

        if (!isAllowed) {
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
    }, [user, router]);

    const loadPicList = async (cabang: string) => {
        try {
            const res = await fetchUserCabangList({ cabang, jabatan: 'BRANCH BUILDING SUPPORT' });
            if (res.data) setPicList(res.data);
        } catch (error) {
            console.error("Gagal memuat daftar PIC:", error);
        }
    };

    const loadApprovedSpks = async (cabang: string) => {
        setIsLoading(true);
        try {
            const res = await fetchSPKList({ status: 'SPK_APPROVED' });
            const allSpks = res.data || [];
            const upperCabang = cabang.toUpperCase();
            const isHO = upperCabang === 'HEAD OFFICE';
            let userGroup: string[] | null = null;
            if (!isHO) {
                for (const grp of Object.values(BRANCH_GROUPS)) {
                    if (grp.includes(upperCabang)) {
                        userGroup = grp;
                        break;
                    }
                }
            }
            const filtered = allSpks.filter((s: SPKListItem) => {
                if (isHO) return true;
                const spkCabang = (s.toko?.cabang || '').toUpperCase();
                if (userGroup) return userGroup.includes(spkCabang);
                return spkCabang === upperCabang;
            });
            
            const map = new Map<string, UlokGroup>();
            filtered.forEach((s: SPKListItem) => {
                const ulok = s.nomor_ulok;
                if (!ulok) return;
                
                if (!map.has(ulok)) {
                    map.set(ulok, {
                        nomor_ulok: ulok,
                        lingkup_gabungan: s.lingkup_pekerjaan || '',
                        toko: s.toko,
                        proyek: s.proyek || '',
                        kode_toko: s.toko?.kode_toko || s.kode_toko || '',
                        spks: [s]
                    });
                } else {
                    const existing = map.get(ulok)!;
                    const l1 = existing.lingkup_gabungan;
                    const l2 = s.lingkup_pekerjaan || '';
                    if (l1 && l2 && l1 !== l2 && !l1.includes(l2)) {
                        existing.lingkup_gabungan = `${l1} & ${l2}`;
                    }
                    existing.spks.push(s);
                }
            });

            setApprovedGroups(Array.from(map.values()));
        } catch (error: any) {
            setStatusMsg({ text: "Gagal memuat data SPK: " + error.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const cabangOptions = useMemo(() => {
        const upper = userInfo.cabang?.toUpperCase();
        if (!upper) return [];
        if (upper === 'HEAD OFFICE') {
            const allBranches = Array.from(new Set(Object.values(BRANCH_GROUPS).flat())).sort();
            return allBranches;
        }
        let userGroup: string[] | null = null;
        for (const grp of Object.values(BRANCH_GROUPS)) {
            if (grp.includes(upper)) {
                userGroup = grp;
                break;
            }
        }
        return userGroup ? [...userGroup].sort() : [];
    }, [userInfo.cabang]);

    const filteredGroups = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return approvedGroups.filter(g => {
            const matchSearch =
                (g.nomor_ulok || '').toLowerCase().includes(q) ||
                (g.kode_toko || '').toLowerCase().includes(q) ||
                (g.toko?.nama_toko || '').toLowerCase().includes(q) ||
                (g.proyek || '').toLowerCase().includes(q);
            const matchCabang = cabangFilter
                ? (g.toko?.cabang || '').toUpperCase() === cabangFilter.toUpperCase()
                : true;
            return matchSearch && matchCabang;
        });
    }, [approvedGroups, searchQuery, cabangFilter]);

    const handleGroupSelect = async (ulok: string) => {
        setStatusMsg({ text: '', type: '' });
        setRabDetail(null);

        if (!ulok) {
            setSelectedGroup(null);
            return;
        }

        const selected = approvedGroups.find(g => g.nomor_ulok === ulok);
        if (!selected) return;

        setSelectedGroup(selected);
        if (selected.toko?.cabang) {
            loadPicList(selected.toko.cabang);
        }
        setStatusMsg({ text: 'Memuat detail proyek...', type: 'info' });

        try {
            const rabList = await fetchRABList({ nomor_ulok: ulok });
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

        setStatusMsg({ text: 'Detail proyek berhasil dimuat. Silakan isi form pengawasan untuk masing-masing lingkup pekerjaan.', type: 'info' });
    };

    const handleSuccess = (spkId: number, picName: string) => {
        // Cek apakah semua SPK dalam group sudah disubmit/locked
        const checkAll = async () => {
            try {
                if (!selectedGroup) return;
                const checks = selectedGroup.spks.map(s => fetchPICPengawasanList({ id_spk: s.id }));
                const results = await Promise.all(checks);
                const allLocked = results.every(res => res.data && res.data.length > 0);
                if (allLocked) {
                    setShowSuccessModal(true);
                }
            } catch (err) {
                console.error(err);
            }
        };
        checkAll();
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
                    <div className="p-6 border-b border-slate-100 bg-white rounded-t-xl flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Input PIC Pengawasan</h2>
                            <p className="text-sm text-slate-500">Tentukan PIC (Branch Building Support) untuk mengawasi proyek per lingkup pekerjaan.</p>
                        </div>
                    </div>

                    <CardContent className="p-6 md:p-8 bg-slate-50/50">
                        <div className="space-y-8">
                            {/* SECTION 1: PILIH ULOK */}
                            <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2">
                                    <Hash className="w-4 h-4 text-indigo-600" />
                                    1. Pilih ULOK Proyek
                                </h3>

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
                                        <div className="flex flex-col md:flex-row gap-3">
                                            {cabangOptions.length > 0 && (
                                                <select
                                                    className="w-full md:w-1/3 p-3 border rounded-lg bg-white outline-none text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500"
                                                    value={cabangFilter}
                                                    onChange={(e) => {
                                                        setCabangFilter(e.target.value);
                                                        setSelectedGroup(null);
                                                        setRabDetail(null);
                                                        if (e.target.value) {
                                                            loadPicList(e.target.value);
                                                        } else {
                                                            loadPicList(userInfo.cabang);
                                                        }
                                                    }}
                                                >
                                                    <option value="">Semua Cabang (Grup)</option>
                                                    {cabangOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            )}
                                            <div className="relative flex-1">
                                                <select
                                                    className="w-full p-3 border rounded-lg bg-slate-50 outline-none font-semibold text-slate-700 cursor-pointer focus:bg-white focus:ring-2 focus:ring-indigo-500 appearance-none pr-10"
                                                    value={selectedGroup?.nomor_ulok || ''}
                                                    onChange={(e) => handleGroupSelect(e.target.value)}
                                                >
                                                    <option value="">-- Klik untuk Pilih ULOK --</option>
                                                    {filteredGroups.map(g => (
                                                        <option key={g.nomor_ulok} value={g.nomor_ulok}>
                                                            {g.nomor_ulok} ({g.lingkup_gabungan}) — {g.kode_toko} — {g.toko?.nama_toko || ''} — {g.proyek}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    )}
                                </div>

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

                                {selectedGroup && (
                                    <div className="pt-4 border-t mt-4 border-slate-100">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-linear-to-br from-slate-50 to-indigo-50/30 p-4 rounded-xl border border-slate-200">
                                            <InfoItem icon={<Hash className="w-3.5 h-3.5" />} label="Nomor ULOK" value={selectedGroup.nomor_ulok} />
                                            <InfoItem icon={<Building2 className="w-3.5 h-3.5" />} label="Nama Toko" value={selectedGroup.toko?.nama_toko || '-'} />
                                            <InfoItem icon={<Hash className="w-3.5 h-3.5" />} label="Kode Toko" value={selectedGroup.kode_toko || '-'} />
                                            <InfoItem icon={<MapPin className="w-3.5 h-3.5" />} label="Cabang" value={selectedGroup.toko?.cabang || '-'} />
                                            <InfoItem icon={<Briefcase className="w-3.5 h-3.5" />} label="Proyek" value={selectedGroup.proyek || '-'} />
                                            <InfoItem icon={<Eye className="w-3.5 h-3.5" />} label="Lingkup Gabungan" value={selectedGroup.lingkup_gabungan} />
                                            {rabDetail && (
                                                <InfoItem icon={<MapPin className="w-3.5 h-3.5" />} label="Kategori Lokasi" value={rabDetail.kategori_lokasi} />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SECTION 2: FORMS PER LINGKUP PEKERJAAN */}
                            {selectedGroup && rabDetail && (
                                <div className="space-y-6 pt-4">
                                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 mb-4">
                                        <BarChartHorizontal className="w-5 h-5 text-indigo-600" />
                                        2. Jadwal &amp; Pengawasan per Lingkup
                                    </h3>
                                    {selectedGroup.spks.map(spk => (
                                        <SpkPicForm
                                            key={spk.id}
                                            spk={spk}
                                            rabDetail={rabDetail}
                                            picList={picList}
                                            userInfo={userInfo}
                                            onSuccess={handleSuccess}
                                        />
                                    ))}
                                </div>
                            )}

                        </div>
                    </CardContent>
                </Card>
            </main>

            {showSuccessModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center transform scale-100 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Berhasil!</h2>
                        <p className="text-slate-600 mb-8 leading-relaxed">
                            PIC Pengawasan untuk semua lingkup pada ULOK <b>{selectedGroup?.nomor_ulok}</b> berhasil disimpan secara utuh.
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
