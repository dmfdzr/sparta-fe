"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { fetchGanttList, fetchGanttDetail, fetchGanttDetailByToko } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const SUPERVISION_RULES: Record<number, number[]> = {
    10: [2, 5, 8, 10], 14: [2, 7, 10, 14], 20: [2, 12, 16, 20],
    30: [2, 7, 14, 18, 23, 30], 35: [2, 7, 17, 22, 28, 35],
    40: [2, 7, 17, 25, 33, 40], 48: [2, 10, 25, 32, 41, 48]
};

const DAY_WIDTH = 40;
const ROW_HEIGHT = 50;

function parseDateDDMMYYYY(dateStr: string) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return null;
}

export default function GanttViewer({ nomorUlok, idToko }: { nomorUlok: string, idToko?: number }) {
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [projectData, setProjectData] = useState<any>(null);
    const [tasks, setTasks] = useState<any[]>([]);

    useEffect(() => {
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
                    if (list.length === 0) {
                        throw new Error("Gantt Chart belum dibuat untuk proyek ini.");
                    }
                    const ganttId = list[0].id;
                    return fetchGanttDetail(ganttId);
                });

        fetchPromise
            .then(detailRes => {
                if (!detailRes) return;
                const { gantt, toko, kategori_pekerjaan, day_items, dependencies } = detailRes.data;

                // Determine project start date
                let projectStart = new Date();
                if (gantt.timestamp) {
                    const parts = gantt.timestamp.split('T')[0].split('-');
                    if (parts.length === 3) projectStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                }

                const msPerDay = 1000 * 60 * 60 * 24;

                // Helper: convert h_awal/h_akhir to day number
                // Supports both numeric ("1", "10") and date format ("01/04/2026")
                const toDayNumber = (val: string): number => {
                    if (!val) return NaN;
                    if (val.includes('/')) {
                        // Date format DD/MM/YYYY — convert to relative day from projectStart
                        const parsed = parseDateDDMMYYYY(val);
                        if (!parsed) return NaN;
                        const diff = Math.round((parsed.getTime() - projectStart.getTime()) / msPerDay);
                        return diff + 1; // Day 1-based
                    }
                    return parseInt(val);
                };

                const endDaysRaw = day_items.map((entry: any) => toDayNumber(entry.h_akhir)).filter((d: number) => !isNaN(d));
                const maxDay = endDaysRaw.length > 0 ? Math.max(...endDaysRaw) : 0;

                const duration = maxDay;

                setProjectData({
                    duration,
                    startDate: projectStart.toISOString().split('T')[0],
                });

                let generatedTasks: any[] = kategori_pekerjaan.map((k: any, idx: number) => ({
                    id: idx + 1, name: k.kategori_pekerjaan, dependencies: [], ranges: [], keterlambatan: 0
                }));

                const categoryRangesMap: Record<string, any[]> = {};
                day_items.forEach((entry: any) => {
                    const startDay = toDayNumber(entry.h_awal);
                    const endDay   = toDayNumber(entry.h_akhir);
                    
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
                dependencies.forEach((dep: any) => {
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
                setIsLoading(false);
            })
            .catch(err => {
                console.error('GanttViewer error:', err);
                setErrorMsg(err?.message || "Gagal memuat detail Gantt Chart.");
                setIsLoading(false);
            });
    }, [nomorUlok, idToko]);

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
                    const parentDelay = pRanges.length > 0 ? (parseInt(pRanges[pRanges.length-1].keterlambatan) || 0) : 0;
                    const potentialShift = parentShift + parentDelay;
                    if (potentialShift > maxShift) maxShift = potentialShift;
                });
            }
            
            task.computed = { shift: maxShift };

            const ranges = task.ranges || [];
            if (ranges.length > 0 && ranges[0].start) {
                ranges.forEach((r: any) => {
                    const endVal = parseInt(r.end || 0) + maxShift + (parseInt(r.keterlambatan) || 0);
                    if(endVal > maxTaskEndDay) maxTaskEndDay = endVal;
                });
            }
        });

        const totalDaysToRender = Math.max(projectData.duration, maxTaskEndDay) + 5;
        const totalChartWidth = totalDaysToRender * DAY_WIDTH;
        const svgHeight = processedTasks.length * ROW_HEIGHT;
        
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

        let svgLines: any[] = [];
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
            <div className="p-4 bg-slate-100 border-b flex justify-between items-center text-sm">
                <div>
                    <h3 className="font-bold text-slate-800">Visualisasi Gantt Chart</h3>
                    <p className="text-xs text-slate-500">Jadwal yang telah direncanakan oleh Kontraktor.</p>
                </div>
            </div>
            <div className="flex border-b overflow-hidden relative" style={{ maxHeight: "400px" }}>
                <div className="w-1/3 min-w-50 border-r border-slate-200 bg-white z-10 sticky left-0 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.1)] flex flex-col">
                    <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center px-4 font-bold text-slate-600">
                        Tahapan Pekerjaan
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar" id="left-pane" onScroll={(e) => {
                        const rightPane = document.getElementById('right-pane');
                        if (rightPane) rightPane.scrollTop = e.currentTarget.scrollTop;
                    }}>
                        {processedTasks.map((task) => (
                            <div key={task.id} className="border-b border-slate-100 flex flex-col justify-center px-4" style={{ height: ROW_HEIGHT }}>
                                <div className="font-semibold text-slate-800 truncate" title={task.name}>{task.id}. {task.name}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-2/3 flex-1 overflow-auto bg-grid-pattern relative pb-6" id="right-pane" onScroll={(e) => {
                    const leftPane = document.getElementById('left-pane');
                    if (leftPane) leftPane.scrollTop = e.currentTarget.scrollTop;
                }}>
                    <div className="h-10 border-b border-slate-200 flex sticky top-0 bg-white z-10">
                        {Array.from({ length: totalDaysToRender }).map((_, i) => (
                            <div key={i} className="shrink-0 border-r border-slate-200 font-bold text-slate-500 flex items-center justify-center bg-slate-50" style={{ width: DAY_WIDTH }}>
                                {i + 1}
                            </div>
                        ))}
                    </div>

                    <div className="relative" style={{ width: totalChartWidth, height: svgHeight }}>
                        {Array.from({ length: totalDaysToRender }).map((_, i) => (
                            <div key={`col-${i}`} className="absolute top-0 bottom-0 border-r border-slate-100 z-0 pointer-events-none" style={{ left: (i + 1) * DAY_WIDTH, width: 1 }} />
                        ))}
                        
                        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-visible">
                            <defs>
                                <marker id="depArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                                    <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
                                </marker>
                            </defs>
                            {svgLines}
                        </svg>

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
