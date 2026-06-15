"use client"

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import AppNavbar from '@/components/AppNavbar';
import { ALL_MENUS, ROLE_CONFIG, canAccessProjectPlanningByCabang, canViewAllBranches } from '@/lib/constants';
import { formatRupiah, parseCurrency } from '@/lib/utils';
import { downloadDashboardExport, fetchDashboardAll, viewGeneratedPdfOnline, type DashboardExportFormat } from '@/lib/api';
import {
    EMPTY_APPROVAL_COUNTS,
    fetchApprovalNotificationCounts,
    getAccessibleApprovalTypes,
    getApprovalNotificationTotal,
    type ApprovalCounts,
} from '@/lib/approval-notifications';
import { 
    Activity, CheckCircle2, ChevronRight, Clock, FileCheck, FileEdit, FileText, 
    HardHat, Layers, Search, Store, Users, MapPin, RefreshCw,
    TrendingUp, AlertCircle, Calendar, Loader2, Home, DollarSign,
    Tag, UserCheck, Coffee, AlertTriangle, X, LogOut, Download, FileDown, FileSpreadsheet, ExternalLink
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const normalizeDashboardText = (value: unknown) =>
    String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();

const PAUSED_STORE_DOCUMENT_MESSAGE =
    "Akses Penyimpanan Dokumen Toko diberhentikan sementara. Penyimpanan dokumen saat ini terpusat di GDrive regional.";

const readDashboardField = (value: unknown, key: string) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
};

const asDashboardArray = (value: unknown): Record<string, unknown>[] => {
    if (Array.isArray(value)) return value.filter(Boolean) as Record<string, unknown>[];
    return value ? [value as Record<string, unknown>] : [];
};

const projectMatchesCompany = (project: unknown, companyName: string) => {
    const normalizedCompany = normalizeDashboardText(companyName);
    if (!normalizedCompany) return false;

    const toko = readDashboardField(project, 'toko');
    const rabList = asDashboardArray(readDashboardField(project, 'rab'));
    const spkList = asDashboardArray(readDashboardField(project, 'spk'));
    const companyCandidates = [
        readDashboardField(toko, 'nama_pt'),
        readDashboardField(toko, 'nama_kontraktor'),
        ...rabList.flatMap(rab => [rab.nama_pt, rab.nama_kontraktor]),
        ...spkList.flatMap(spk => [spk.nama_pt, spk.nama_kontraktor]),
    ];

    return companyCandidates.some(candidate => normalizeDashboardText(candidate) === normalizedCompany);
};

const parseDashboardDate = (value: unknown): Date | null => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const [, day, month, year] = slashMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const addDashboardDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const isDashboardWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
};

const nextDashboardBusinessDayAfter = (date: Date) => {
    let current = addDashboardDays(date, 1);
    while (isDashboardWeekend(current)) current = addDashboardDays(current, 1);
    return current;
};

const countDashboardWeekdaysAfter = (freeDate: Date, compareDate: Date) => {
    if (compareDate <= freeDate) return 0;
    let current = addDashboardDays(freeDate, 1);
    let count = 0;
    while (current <= compareDate) {
        if (!isDashboardWeekend(current)) count += 1;
        current = addDashboardDays(current, 1);
    }
    return count;
};

const isApprovedDashboardSpk = (spk: any) => {
    const status = String(spk?.status || '').toUpperCase();
    return ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes(status);
};

const getApprovedDashboardSpks = (project: any) => {
    const spkArr = Array.isArray(project?.spk) ? project.spk : (project?.spk ? [project.spk] : []);
    const approved = spkArr.filter(isApprovedDashboardSpk);
    return approved.length > 0 ? approved : (spkArr[0] ? [spkArr[0]] : []);
};

const getSpkEffectiveEndDate = (spk: any) => {
    const pertambahanArr = Array.isArray(spk?.pertambahan_spk) ? spk.pertambahan_spk : [];
    const approvedPertambahanDates = pertambahanArr
        .filter((pt: any) => ['APPROVED', 'DISETUJUI', 'DISETUJUI BM'].includes(String(pt?.status_persetujuan || '').toUpperCase()))
        .map((pt: any) => parseDashboardDate(pt?.tanggal_spk_akhir_setelah_perpanjangan))
        .filter(Boolean) as Date[];
    const latestPertambahanDate = approvedPertambahanDates.sort((a, b) => b.getTime() - a.getTime())[0];
    return latestPertambahanDate || parseDashboardDate(spk?.waktu_selesai);
};

const getLatestProjectSpkEndDate = (project: any) => {
    const candidateDates: Array<Date | null> = getApprovedDashboardSpks(project)
        .map(getSpkEffectiveEndDate);
    return candidateDates
        .filter((date: Date | null): date is Date => Boolean(date))
        .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
};

const calculateProjectLateDays = (project: any, compareFallback = new Date()) => {
    const opnameFinalArr = Array.isArray(project?.opname_final)
        ? project.opname_final
        : (project?.opname_final ? [project.opname_final] : []);
    const latestOpnameFinal = opnameFinalArr[0];
    const backendDendaHari = Number(latestOpnameFinal?.hari_denda ?? NaN);
    const backendHasPenaltyDates = Boolean(latestOpnameFinal?.tanggal_akhir_spk_denda || latestOpnameFinal?.tanggal_serah_terima_denda);
    if (backendHasPenaltyDates && Number.isFinite(backendDendaHari)) return Math.max(0, backendDendaHari);

    const latestEndDate = getLatestProjectSpkEndDate(project);
    if (!latestEndDate) return 0;

    const stArr = Array.isArray(project?.berkas_serah_terima)
        ? project.berkas_serah_terima
        : (project?.berkas_serah_terima ? [project.berkas_serah_terima] : []);
    const stDate = parseDashboardDate(stArr[0]?.created_at) || parseDashboardDate(compareFallback.toISOString());
    if (!stDate) return 0;

    return countDashboardWeekdaysAfter(nextDashboardBusinessDayAfter(latestEndDate), stDate);
};

const calculateProjectPenalty = (lateDays: number) => {
    if (lateDays <= 0) return 0;
    const hariPertama = Math.min(lateDays, 5);
    const hariBerikutnya = Math.max(0, Math.min(lateDays - 5, 10));
    return Math.min((hariPertama * 1000000) + (hariBerikutnya * 500000), 10000000);
};

const normalizeStorePenaltyKeyPart = (value: unknown) => {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
};

const getProjectStorePenaltyKey = (project: any) => {
    const nomorUlok = normalizeStorePenaltyKeyPart(project?.toko?.nomor_ulok);
    if (nomorUlok) return `ULOK|${nomorUlok}`;

    const kodeToko = normalizeStorePenaltyKeyPart(project?.toko?.kode_toko);
    if (kodeToko) return `KODE|${kodeToko}`;

    const cabang = normalizeStorePenaltyKeyPart(project?.toko?.cabang);
    const namaToko = normalizeStorePenaltyKeyPart(project?.toko?.nama_toko);
    if (namaToko) return `NAMA|${cabang}|${namaToko}`;

    return `TOKO_ID|${project?.toko?.id || 'UNKNOWN'}`;
};

const getProjectOpnameFinals = (project: any) => {
    return Array.isArray(project?.opname_final)
        ? project.opname_final
        : (project?.opname_final ? [project.opname_final] : []);
};

const getLatestProjectOpnameFinal = (project: any) => {
    return getProjectOpnameFinals(project)[0] ?? null;
};

type ProjectPenaltyInfo = {
    amount: number;
    days: number;
    source: 'Resmi' | 'Estimasi';
    targetKategori: 'OPNAME_FINAL';
};

const getProjectPenaltyInfo = (project: any, lateDays?: number): ProjectPenaltyInfo => {
    const calculatedDays = lateDays ?? calculateProjectLateDays(project);
    const calculatedAmount = calculateProjectPenalty(calculatedDays);

    const latestOpnameFinal = getLatestProjectOpnameFinal(project);
    if (latestOpnameFinal) {
        const dbAmount = Math.max(0, parseCurrency(latestOpnameFinal.nilai_denda));
        const dbDays = Number(latestOpnameFinal.hari_denda ?? 0);
        
        // If the DB has a valid penalty > 0, trust the DB (Opname).
        // Otherwise (DB is 0), fallback to the live calculation based on SPK + ST to bypass the backend bug.
        if (dbAmount > 0 || dbDays > 0) {
            return {
                amount: dbAmount,
                days: dbDays,
                source: 'Resmi' as const,
                targetKategori: 'OPNAME_FINAL',
            };
        }
    }

    return {
        amount: calculatedAmount,
        days: calculatedDays,
        source: 'Estimasi' as const,
        targetKategori: 'OPNAME_FINAL',
    };
};

const compareProjectPenaltyInfo = (current: ProjectPenaltyInfo | undefined, next: ProjectPenaltyInfo) => {
    if (!current) return next;
    if (current.source !== next.source) {
        return next.source === 'Resmi' ? next : current;
    }
    return next.amount > current.amount ? next : current;
};

const getUniquePenaltyProjects = (projects: any[]) => {
    const byStore = new Map<string, { project: any; penalty: ProjectPenaltyInfo; createdAt: number }>();

    projects.forEach((project) => {
        const key = getProjectStorePenaltyKey(project);
        const latestOpnameFinal = getLatestProjectOpnameFinal(project);
        const penalty = getProjectPenaltyInfo(project);
        const createdAt = new Date(latestOpnameFinal?.created_at || project?.toko?.created_at || 0).getTime() || 0;
        const existing = byStore.get(key);
        const selectedPenalty = compareProjectPenaltyInfo(existing?.penalty, penalty);

        if (
            !existing ||
            selectedPenalty !== existing.penalty ||
            (penalty.amount === existing.penalty.amount && penalty.source === existing.penalty.source && createdAt > existing.createdAt)
        ) {
            byStore.set(key, { project, penalty, createdAt });
        }
    });

    return Array.from(byStore.values()).map((entry) => entry.project);
};

const getProjectStage = (project: any) => {
    const hasRAB = (project.rab || []).length > 0;
    const rabData = project.rab?.[0];
    const rabStatus = (rabData?.status || '').toUpperCase();
    const isRabMenungguGantt = rabStatus === 'MENUNGGU GANTT CHART';
    const isRabDisetujui = rabData && rabStatus === 'DISETUJUI';
    const spkArray = Array.isArray(project.spk) ? project.spk : (project.spk ? [project.spk] : []);
    const hasSPK = spkArray.some((s: any) => ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes((s.status || '').toUpperCase()));
    const hasApprovalSPK = spkArray.some((s: any) => (s.status || '').toUpperCase() === 'WAITING_FOR_BM_APPROVAL');
    const hasST = (project.berkas_serah_terima || []).length > 0;
    const opnameArr = Array.isArray(project.opname_final) ? project.opname_final : (project.opname_final ? [project.opname_final] : []);
    const opnameData = opnameArr.find((o: any) => String(o?.link_pdf_opname || '').trim());
    const hasOpnamePdf = !!opnameData;
    const isOpnameDisetujui = opnameData && (opnameData.status_opname_final || '').toUpperCase() === 'DISETUJUI';

    if (hasOpnamePdf && isOpnameDisetujui) return 'Done';
    if (hasOpnamePdf && !isOpnameDisetujui) return 'Kerja Tambah Kurang';
    if (hasST) return 'Kerja Tambah Kurang';
    if (hasSPK) return 'Ongoing';
    if (hasApprovalSPK) return 'Approval SPK';
    if (isRabDisetujui) return 'Proses PJU';
    if (hasRAB && isRabMenungguGantt) return 'Proses Gantt';
    return 'Approval RAB';
};

const getLatestSerahTerima = (project: any) => {
    const arr = Array.isArray(project?.berkas_serah_terima)
        ? project.berkas_serah_terima
        : (project?.berkas_serah_terima ? [project.berkas_serah_terima] : []);
    return arr
        .filter(Boolean)
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] ?? null;
};

const getProjectFinancialSummary = (project: any) => {
    const rab = project?.rab?.[0];
    const spkArr = Array.isArray(project?.spk) ? project.spk : (project?.spk ? [project.spk] : []);
    const opname = getLatestProjectOpnameFinal(project);
    const spkTotal = spkArr
        .filter((s: any) => s.status && !['REJECTED', 'REJECT', 'CANCELLED', 'CANCEL'].includes(String(s.status).toUpperCase()))
        .reduce((sum: number, s: any) => sum + parseCurrency(s.grand_total || s.total_harga), 0);
    return {
        penawaran: parseCurrency(rab?.grand_total_final),
        spk: spkTotal,
        opname: parseCurrency(opname?.grand_total_opname),
    };
};

const getStoreQualityScore = (items: any[]) => {
    if (!items.length) return { desain: 0, kualitas: 0, spesifikasi: 0, total: 0 };
    const desain = (items.filter((i: any) => i.desain === 'Sesuai').length / items.length) * 30;
    const kualitas = (items.filter((i: any) => i.kualitas === 'Baik').length / items.length) * 35;
    const spesifikasi = (items.filter((i: any) => i.spesifikasi === 'Sesuai').length / items.length) * 35;
    return { desain, kualitas, spesifikasi, total: desain + kualitas + spesifikasi };
};

export default function DashboardPage() {
    const router = useRouter();

    const [userInfo, setUserInfo]           = useState({ name: '', roles: [] as string[], cabang: '', namaPt: '' });
    const [allowedMenus, setAllowedMenus]   = useState<any[]>([]);
    const [isLoading, setIsLoading]         = useState(true);
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [detailModal, setDetailModal] = useState({ open: false, title: '', context: '', subContext: '' });
    const [modalPage, setModalPage] = useState(1);
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const itemsPerPage = 5;
    const [sidebarOpen, setSidebarOpen]     = useState(true);
    const [isCompanyScopedUser, setIsCompanyScopedUser] = useState(false);
    const [canViewMonitoringDashboard, setCanViewMonitoringDashboard] = useState(false);
    const [approvalCounts, setApprovalCounts] = useState<ApprovalCounts>(EMPTY_APPROVAL_COUNTS);
    const [rabRevisionCount, setRabRevisionCount] = useState(0);

    // Data State
    const [projects, setProjects] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCabang, setSelectedCabang] = useState('ALL');
    const [cabangList, setCabangList] = useState<string[]>([]);
    const [exportingFormat, setExportingFormat] = useState<DashboardExportFormat | null>(null);

    // Opname items map keyed by id_toko — populated once via bulk fetch
    const [opnameItemsMap, setOpnameItemsMap] = useState<Record<number, any[]>>({});
    // RAB items map keyed by rab.id — populated once after dashboard load
    const [rabItemsMap, setRabItemsMap] = useState<Record<number, any[]>>({});

    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const [featureAlertOpen, setFeatureAlertOpen] = useState(false);
    const [featureAlert, setFeatureAlert] = useState({
        title: "Fitur Belum Tersedia",
        description: "Fitur ini belum tersedia saat ini.",
    });

    const showFeatureAlert = useCallback((title: string, description: string) => {
        setFeatureAlert({ title, description });
        setFeatureAlertOpen(true);
    }, []);

    // =========================================================================
    // SESSION
    // =========================================================================
    const { user } = useSession();

    // =========================================================================
    // INIT
    // =========================================================================
    useEffect(() => {
        if (!user) return;

        const { cabang: userCabang, namaLengkap, namaPt, roles, isHO, isSuperHuman, isRegionalManager } = user;

        // Handle Multi-Role (DIREKTUR, KONTRAKTOR)
        const contractorFlag = roles.some(r => r.includes('KONTRAKTOR'));
        const directorFlag = roles.some(r => r.includes('DIREKTUR'));
        const companyScopedRole = contractorFlag || directorFlag;

        let combinedAllowedIds: string[] = [];
        roles.forEach(r => {
            if (ROLE_CONFIG[r]) {
                combinedAllowedIds = [...combinedAllowedIds, ...ROLE_CONFIG[r]];
            }
        });

        // Unique IDs
        let allowedIds = Array.from(new Set(combinedAllowedIds));

        if (isSuperHuman) {
            allowedIds = ALL_MENUS.map(m => m.id);
        } else if (allowedIds.length === 0) {
            allowedIds = [...(ROLE_CONFIG[isHO ? 'HEAD OFFICE' : 'BRANCH BUILDING SUPPORT'] ?? [])];
        }

        // Super Human gets menu-users explicitly (already in ROLE_CONFIG but ensure it)
        if (isSuperHuman) {
            allowedIds.push("menu-users");
        }

        if (
            ['MANADO', 'BOGOR'].includes(userCabang.toUpperCase()) &&
            roles.includes('BRANCH BUILDING & MAINTENANCE MANAGER')
        ) {
            allowedIds.push("menu-inputpic");
        }

        if (
            userCabang.toUpperCase() === 'BATAM' &&
            roles.includes('BRANCH BUILDING COORDINATOR')
        ) {
            allowedIds.push("menu-spk");
        }

        if (!canAccessProjectPlanningByCabang(userCabang) && !isRegionalManager && !isSuperHuman) {
            allowedIds = allowedIds.filter(id => id !== "menu-projek-planning");
        }

        const menuList = ALL_MENUS.filter(m => allowedIds.includes(m.id) && m.id !== "menu-dc-development");
        setAllowedMenus(menuList);
        setUserInfo({ name: namaLengkap.toUpperCase(), roles: roles, cabang: userCabang.toUpperCase(), namaPt });
        setIsCompanyScopedUser(companyScopedRole);
        
        if (window.innerWidth <= 768) setSidebarOpen(false);

        const canViewMonitoring = true;
        setCanViewMonitoringDashboard(canViewMonitoring);

        // Dashboard monitoring tersedia untuk semua cabang.
        // Head Office, Super Human, dan role global view-only melihat semua cabang.
        fetchDashboardData(
            userCabang.toUpperCase(),
            userCabang.toUpperCase() === 'HEAD OFFICE' || canViewAllBranches(roles, isSuperHuman),
            user.email,
            namaPt,
            companyScopedRole
        );
        fetchApprovalNotificationCounts(user)
            .then(setApprovalCounts)
            .catch(() => setApprovalCounts(EMPTY_APPROVAL_COUNTS));
        setIsLoading(false);
    }, [user]);

    useEffect(() => {
        if (detailModal.open) {
            setModalPage(1);
            setExpandedRow(null);
        }
    }, [detailModal.open, detailModal.context, detailModal.subContext]);

    const fetchDashboardData = async (
        userCabang: string,
        canSeeAllBranches = false,
        userEmail = '',
        userNamaPt = '',
        shouldFilterByCompany = false
    ) => {
        setIsDataLoading(true);
        try {
            // Fetch dari API real
            const json = await fetchDashboardAll();
            let data = json.data || [];
            
            // Head Office, Super Human, dan role global view-only melihat semua cabang.
            // User cabang biasa hanya melihat cabang session-nya sendiri.
            let allowedBranches: string[] = [];
            if (!canSeeAllBranches || shouldFilterByCompany) {
                allowedBranches = [userCabang];
                data = data.filter((p: any) => allowedBranches.includes(p.toko?.cabang?.toUpperCase()));
                setCabangList(allowedBranches.sort());
            } else {
                allowedBranches = Array.from(new Set(data.map((p: any) => p.toko?.cabang?.toUpperCase()).filter(Boolean)));
                setCabangList(allowedBranches.sort());
            }

            if (shouldFilterByCompany) {
                data = data.filter((p: unknown) => projectMatchesCompany(p, userNamaPt));
            }

            setProjects(data);

            const opnameMap: Record<number, any[]> = {};
            let rejectedRabCount = 0;
            const normalizedEmail = (userEmail || '').toLowerCase();

            data.forEach((project: any) => {
                const tokoId = project.toko?.id;
                const opnameFinals = Array.isArray(project.opname_final)
                    ? project.opname_final
                    : (project.opname_final ? [project.opname_final] : []);

                opnameFinals.forEach((final: any) => {
                    const items = Array.isArray(final?.items) ? final.items : [];
                    if (!tokoId || items.length === 0) return;
                    if (!opnameMap[tokoId]) opnameMap[tokoId] = [];
                    opnameMap[tokoId].push(...items);
                });

                const rabList = Array.isArray(project.rab) ? project.rab : (project.rab ? [project.rab] : []);
                rejectedRabCount += rabList.filter((rab: any) => {
                    const status = String(rab?.status || '').toUpperCase();
                    const isRejected = status.includes('TOLAK') || status === 'REJECTED';
                    const isMine = String(rab?.email_pembuat || '').toLowerCase() === normalizedEmail;
                    return isRejected && (!normalizedEmail || isMine);
                }).length;
            });

            setOpnameItemsMap(opnameMap);
            setRabRevisionCount(rejectedRabCount);

        } catch (err) {
            console.error('Gagal memuat data dashboard:', err);
            setProjects([]);
            setCabangList([]);
            setOpnameItemsMap({});
            setRabRevisionCount(0);
        } finally {
            setIsDataLoading(false);
        }
    };

    const canExportDashboard = canViewMonitoringDashboard && !userInfo.roles.some((role) => role.toUpperCase().includes('KONTRAKTOR'));

    const handleDownloadDashboardExport = async (format: DashboardExportFormat) => {
        if (!canExportDashboard || exportingFormat) return;
        setExportingFormat(format);
        try {
            await downloadDashboardExport({
                format,
                actorRole: userInfo.roles.join(', '),
                actorCabang: userInfo.cabang,
                cabang: selectedCabang,
                search: searchQuery,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal mengunduh export dashboard.';
            setFeatureAlert({
                title: "Export Dashboard Gagal",
                description: message,
            });
            setFeatureAlertOpen(true);
        } finally {
            setExportingFormat(null);
        }
    };



    // Logic for filtered projects
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const matchSearch = 
                p.toko.nomor_ulok?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.toko.nama_toko?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.toko.kode_toko?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.toko.cabang?.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchCabang = selectedCabang === 'ALL' || (p.toko?.cabang || '').toUpperCase() === selectedCabang;
            
            return matchSearch && matchCabang;
        });
    }, [projects, searchQuery, selectedCabang]);

    const handleOpenPenaltyProject = useCallback((project: any) => {
        const penaltyInfo = getProjectPenaltyInfo(project);
        const nomorUlok = String(project?.toko?.nomor_ulok || '').trim();
        const query = new URLSearchParams({
            kategori: penaltyInfo.targetKategori,
            q: nomorUlok || String(project?.toko?.nama_toko || ''),
        });
        router.push(`/list?${query.toString()}`);
    }, [router]);

    const handleOpenSerahTerima = useCallback(async (project: any) => {
        const serahTerima = getLatestSerahTerima(project);
        if (!serahTerima) return;
        if (serahTerima.link_pdf) {
            window.open(serahTerima.link_pdf, '_blank', 'noopener,noreferrer');
            return;
        }
        if (serahTerima.id) {
            await viewGeneratedPdfOnline(serahTerima.id, 'BERKAS_SERAH_TERIMA');
        }
    }, []);

    // Summary Stats
    const stats = useMemo(() => {
        let totalPenawaran = 0;
        let totalSPK = 0;
        let totalJHK = 0;
        let totalDelay = 0;
        const penaltyByStoreKey = new Map<string, ProjectPenaltyInfo>();
        
        let sumRatioTerbuka = 0; let countTerbuka = 0;
        let sumRatioBangunan = 0; let countBangunan = 0;
        let sumRatioTerbangun = 0; let countTerbangun = 0;

        let totalNilaiToko = 0;
        let countNilaiToko = 0;
        let totalNilaiKontraktor = 0;
        let totalBeanspot = 0;
        let attentionCount = 0;
        let jhkProjectCount = 0;
        let delayProjectCount = 0;

        let miniStats = { 'Proses Gantt': 0, 'Approval RAB': 0, 'Proses PJU': 0, 'Approval SPK': 0, 'Ongoing': 0, 'Kerja Tambah Kurang': 0, 'Done': 0 };
        let miniPerhatian = { 'Proses Gantt': 0, 'Approval RAB': 0, 'Proses PJU': 0, 'Approval SPK': 0, 'Ongoing': 0, 'Kerja Tambah Kurang': 0 };

        const contractorScores: Record<string, { totalNilai: number, count: number, stores: any[] }> = {};
        const beanspotStores: { nama_toko: string, nomor_ulok: string, cabang: string, nominal: number }[] = [];
        let sumBeanspot = 0;
        let countBeanspot = 0;

        filteredProjects.forEach(p => {
            // Mapping Category (Funnel)
            const hasRAB = (p.rab || []).length > 0;
            const rabData = p.rab?.[0];
            const rabStatus = (rabData?.status || '').toUpperCase();
            const isRabMenungguGantt = rabStatus === 'MENUNGGU GANTT CHART';
            const isRabDisetujui = rabData && rabStatus === 'DISETUJUI';
            
            const spkArray = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
            const hasSPK = spkArray.some((s: any) => {
                const st = (s.status || '').toUpperCase();
                return ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes(st);
            });
            const hasApprovalSPK = spkArray.some((s: any) => (s.status || '').toUpperCase() === 'WAITING_FOR_BM_APPROVAL');
            
            const hasST = (p.berkas_serah_terima || []).length > 0;
            const opnameArr = Array.isArray(p.opname_final) ? p.opname_final : (p.opname_final ? [p.opname_final] : []);
            const opnameData = opnameArr.find((o: any) => String(o?.link_pdf_opname || '').trim());
            const hasOpnamePdf = !!opnameData;
            const isOpnameDisetujui = opnameData && (opnameData.status_opname_final || '').toUpperCase() === 'DISETUJUI';

            let cat = '';
            if (hasOpnamePdf && isOpnameDisetujui) { cat = 'Done'; miniStats['Done']++; }
            else if (hasOpnamePdf && !isOpnameDisetujui) { cat = 'Kerja Tambah Kurang'; miniStats['Kerja Tambah Kurang']++; }
            else if (hasST) { cat = 'Kerja Tambah Kurang'; miniStats['Kerja Tambah Kurang']++; }
            else if (hasSPK) { cat = 'Ongoing'; miniStats['Ongoing']++; }
            else if (hasApprovalSPK) { cat = 'Approval SPK'; miniStats['Approval SPK']++; }
            else if (isRabDisetujui) { cat = 'Proses PJU'; miniStats['Proses PJU']++; }
            else if (hasRAB && isRabMenungguGantt) { cat = 'Proses Gantt'; miniStats['Proses Gantt']++; }
            else { cat = 'Approval RAB'; miniStats['Approval RAB']++; }

            // SLA / Attention Logic
            const createdAt = new Date(p.toko?.created_at || Date.now());
            const diffDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            
            let isPerhatian = false;
            if (cat === 'Ongoing') {
                const spkArr = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                const approvedSpk = spkArr.find((s: any) => {
                    const st = (s.status || '').toUpperCase();
                    return ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes(st);
                });
                if (approvedSpk) {
                    const waktuMulai = new Date(approvedSpk.waktu_mulai || approvedSpk.created_at || Date.now());
                    const durasiSPK = Number(approvedSpk.durasi || 0);
                    const pertambahanArr = Array.isArray(approvedSpk.pertambahan_spk) ? approvedSpk.pertambahan_spk : [];
                    const totalPertambahan = pertambahanArr
                        .filter((pt: any) => ['APPROVED', 'DISETUJUI', 'DISETUJUI BM'].includes((pt.status_persetujuan || '').toUpperCase()))
                        .reduce((sum: number, pt: any) => sum + Number(pt.pertambahan_hari || 0), 0);
                    const totalAllowedDays = durasiSPK + totalPertambahan;
                    const elapsedDays = Math.floor((Date.now() - waktuMulai.getTime()) / (1000 * 60 * 60 * 24));
                    if (elapsedDays > totalAllowedDays) {
                        isPerhatian = true;
                    }
                }
            }
            else if (cat === 'Approval SPK') {
                const spkArray = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                const spkData = spkArray[0];
                if (spkData) {
                    const spkCreatedAt = new Date(spkData.created_at || p.toko?.created_at || Date.now());
                    const spkDiffDays = Math.floor((Date.now() - spkCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                    if (spkDiffDays > 2) {
                        isPerhatian = true;
                    }
                } else {
                    if (diffDays > 7) isPerhatian = true;
                }
            }
            else if (cat === 'Approval RAB') {
                const rabData = p.rab?.[0];
                if (rabData) {
                    const rabCreatedAt = new Date(rabData.created_at || p.toko?.created_at || Date.now());
                    const rabDiffDays = Math.floor((Date.now() - rabCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                    const isDisetujui = (rabData.status || '').toUpperCase() === 'DISETUJUI';
                    
                    if (rabDiffDays > 2 && !isDisetujui) {
                        isPerhatian = true;
                    }
                }
            }
            else if (cat === 'Proses Gantt') {
                const rabData = p.rab?.[0];
                const rabCreatedAt = new Date(rabData?.created_at || p.toko?.created_at || Date.now());
                const rabDiffDays = Math.floor((Date.now() - rabCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                if (rabDiffDays > 2) {
                    isPerhatian = true;
                }
            }
            else if (cat === 'Proses PJU') {
                const rabData = p.rab?.[0];
                if (rabData && (rabData.status || '').toUpperCase() === 'DISETUJUI') {
                    const rabApprovedAt = new Date(rabData.waktu_persetujuan_manager || rabData.updated_at || rabData.created_at || p.toko?.created_at || Date.now());
                    const pjuDiffDays = Math.floor((Date.now() - rabApprovedAt.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (pjuDiffDays > 10) {
                        isPerhatian = true;
                    }
                }
            }
            else if (cat === 'Kerja Tambah Kurang') {
                const opnameArr = Array.isArray(p.opname_final) ? p.opname_final : (p.opname_final ? [p.opname_final] : []);
                const opnameData = opnameArr.find((o: any) => String(o?.link_pdf_opname || '').trim());
                if (opnameData) {
                    const opnameCreatedAt = new Date(opnameData.created_at || Date.now());
                    const opnameDiffDays = Math.floor((Date.now() - opnameCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                    const isDisetujui = (opnameData.status_opname_final || '').toUpperCase() === 'DISETUJUI';
                    
                    if (opnameDiffDays > 14 && !isDisetujui) {
                        isPerhatian = true;
                    }
                }
            }

            if (isPerhatian && cat !== 'Done') {
                attentionCount++;
                if (miniPerhatian[cat as keyof typeof miniPerhatian] !== undefined) {
                    miniPerhatian[cat as keyof typeof miniPerhatian]++;
                }
            }

            // Calculations
            const rab = p.rab?.[0];
            if (rab) {
                totalPenawaran += parseCurrency(rab.grand_total_final);
            }

            const spks = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
            spks.forEach((s: any) => {
                const status = (s.status || '').toUpperCase();
                // Include everything except rejected/cancelled to show the full SPK pipeline value
                if (status && !['REJECTED', 'REJECT', 'CANCELLED', 'CANCEL'].includes(status)) {
                    totalSPK += parseCurrency(s.grand_total || s.total_harga);
                }
            });

            let projectJHK = 0;
            const spkArrJHK = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
            const validSpkJHK = spkArrJHK.find((s: any) => {
                const st = (s.status || '').toUpperCase();
                return ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes(st);
            }) || spkArrJHK[0];

            if (validSpkJHK) {
                jhkProjectCount++;
                const durasi = Number(validSpkJHK.durasi || 0);
                const pertambahanArr = Array.isArray(validSpkJHK.pertambahan_spk) ? validSpkJHK.pertambahan_spk : [];
                const totalPertambahan = pertambahanArr
                    .filter((pt: any) => ['APPROVED', 'DISETUJUI', 'DISETUJUI BM'].includes((pt.status_persetujuan || '').toUpperCase()))
                    .reduce((sum: number, pt: any) => sum + Number(pt.pertambahan_hari || 0), 0);
                
                const totalAllowedDays = durasi + totalPertambahan;
                const keterlambatan = calculateProjectLateDays(p);
                if (keterlambatan > 0) delayProjectCount++;
                const penaltyKey = getProjectStorePenaltyKey(p);
                const penaltyInfo = getProjectPenaltyInfo(p, keterlambatan);
                penaltyByStoreKey.set(penaltyKey, compareProjectPenaltyInfo(penaltyByStoreKey.get(penaltyKey), penaltyInfo));
                
                projectJHK = totalAllowedDays + keterlambatan;
                totalDelay += keterlambatan;
            }
            totalJHK += projectJHK;

            // Perhitungan Rata-rata Nilai Toko dari Opname Items
            const opnameItems = opnameItemsMap[p.toko?.id] || [];
            if (opnameItems.length > 0) {
                const countDesainSesuai = opnameItems.filter((i: any) => i.desain === 'Sesuai').length;
                const countKualitasBaik = opnameItems.filter((i: any) => i.kualitas === 'Baik').length;
                const countSpesifikasiSesuai = opnameItems.filter((i: any) => i.spesifikasi === 'Sesuai').length;

                const nilaiDesain = (countDesainSesuai / opnameItems.length) * 30;
                const nilaiKualitas = (countKualitasBaik / opnameItems.length) * 35;
                const nilaiSpesifikasi = (countSpesifikasiSesuai / opnameItems.length) * 35;

                totalNilaiToko += (nilaiDesain + nilaiKualitas + nilaiSpesifikasi);
                countNilaiToko++;

                const p_total = nilaiDesain + nilaiKualitas + nilaiSpesifikasi;
                const kn = p.toko?.nama_kontraktor;
                if (kn) {
                    const knUpper = kn.toUpperCase();
                    if (!contractorScores[knUpper]) contractorScores[knUpper] = { totalNilai: 0, count: 0, stores: [] };
                    contractorScores[knUpper].totalNilai += p_total;
                    contractorScores[knUpper].count++;
                    contractorScores[knUpper].stores.push({
                        nama_toko: p.toko?.nama_toko,
                        nomor_ulok: p.toko?.nomor_ulok,
                        cabang: p.toko?.cabang,
                        nilai: p_total,
                        desain: nilaiDesain,
                        kualitas: nilaiKualitas,
                        spesifikasi: nilaiSpesifikasi
                    });
                }
            }

            // Perhitungan Cost/m2 per Toko/Ulok
            let costTerbukaToko = 0;
            let costBangunanToko = 0;
            let costTerbangunToko = 0;
            let luasTerbukaToko = 0;
            let luasBangunanToko = 0;
            let luasTerbangunToko = 0;
            let beanspotTokoNominal = 0;

            const rabItemCategoryMap = new Map<number, string>();
            const rabArr = Array.isArray(p.rab) ? p.rab : (p.rab ? [p.rab] : []);
            rabArr.forEach((rab: any) => {
                const itemsFromCache = rabItemsMap[rab.id] || [];
                const itemsData = typeof rab.items === 'string' ? JSON.parse(rab.items) : (rab.items || []);
                const itemsFromJson = typeof rab.Item_Details_JSON === 'string' ? JSON.parse(rab.Item_Details_JSON) : (rab.Item_Details_JSON || []);
                const finalItems = itemsFromCache.length > 0 ? itemsFromCache : (itemsData.length > 0 ? itemsData : itemsFromJson);
                
                finalItems.forEach((item: any) => {
                    if (item.id) rabItemCategoryMap.set(item.id, (item.kategori_pekerjaan || item.Kategori_Pekerjaan || '').toUpperCase());
                });
            });

            const latestOpnameFinal = getLatestProjectOpnameFinal(p);
            const opnameFinalItems = latestOpnameFinal?.items || opnameItemsMap[p.toko?.id] || [];
            const useOpnameFinal = !!latestOpnameFinal && opnameFinalItems.length > 0;

            rabArr.forEach((rab: any) => {
                luasTerbukaToko = Math.max(luasTerbukaToko, Number(rab.luas_area_terbuka || 0));
                luasBangunanToko = Math.max(luasBangunanToko, Number(rab.luas_bangunan || 0));
                luasTerbangunToko = Math.max(luasTerbangunToko, Number(rab.luas_terbangun || 0));
                
                if (!useOpnameFinal) {
                    costTerbangunToko += Number(rab.grand_total_final || 0);
                    
                    const itemsFromCache = rabItemsMap[rab.id] || [];
                    const itemsData = typeof rab.items === 'string' ? JSON.parse(rab.items) : (rab.items || []);
                    const itemsFromJson = typeof rab.Item_Details_JSON === 'string' ? JSON.parse(rab.Item_Details_JSON) : (rab.Item_Details_JSON || []);
                    const finalItems = itemsFromCache.length > 0 ? itemsFromCache : (itemsData.length > 0 ? itemsData : itemsFromJson);
                    
                    if (finalItems.length > 0) {
                        finalItems.forEach((item: any) => {
                            const itemTotal = Number(item.total_harga || (item.volume * (item.harga_material + item.harga_upah)) || 0);
                            const kat = (item.kategori_pekerjaan || item.Kategori_Pekerjaan || '').toUpperCase();
                            if (kat === 'PEKERJAAN AREA TERBUKA') {
                                costTerbukaToko += itemTotal;
                            } else {
                                costBangunanToko += itemTotal;
                            }
                            if (kat === 'PEKERJAAN BEANSPOT') {
                                beanspotTokoNominal += itemTotal;
                            }
                        });
                    } else {
                        // Fallback jika tidak ada items sama sekali
                        costBangunanToko += Number(rab.grand_total_final || 0);
                    }
                }
            });

            if (useOpnameFinal) {
                // Untuk total terbangun, gunakan grand total opname final
                costTerbangunToko = Number(latestOpnameFinal.grand_total_opname || 0);

                opnameFinalItems.forEach((oItem: any) => {
                    const itemTotal = Number(oItem.total_harga_opname || 0);
                    // Dapatkan kategori dari map yang telah dibuat berdasarkan id_rab_item
                    const kat = rabItemCategoryMap.get(oItem.id_rab_item) || '';
                    
                    if (kat === 'PEKERJAAN AREA TERBUKA') {
                        costTerbukaToko += itemTotal;
                    } else {
                        costBangunanToko += itemTotal;
                    }
                    if (kat === 'PEKERJAAN BEANSPOT') {
                        beanspotTokoNominal += itemTotal;
                    }
                });
            }

            if (luasTerbukaToko > 0 && costTerbukaToko > 0) {
                sumRatioTerbuka += (costTerbukaToko / luasTerbukaToko);
                countTerbuka++;
            }
            if (luasBangunanToko > 0 && costBangunanToko > 0) {
                sumRatioBangunan += (costBangunanToko / luasBangunanToko);
                countBangunan++;
            }
            if (luasTerbangunToko > 0 && costTerbangunToko > 0) {
                sumRatioTerbangun += (costTerbangunToko / luasTerbangunToko);
                countTerbangun++;
            }

            if (beanspotTokoNominal > 0) {
                beanspotStores.push({
                    nama_toko: p.toko?.nama_toko || '-',
                    nomor_ulok: p.toko?.nomor_ulok || '-',
                    cabang: p.toko?.cabang || '-',
                    nominal: beanspotTokoNominal,
                });
                sumBeanspot += beanspotTokoNominal;
                countBeanspot++;
            }
        });

        let sumNilaiKontraktor = 0;
        let countKontraktor = 0;
        Object.values(contractorScores).forEach(c => {
            if (c.count > 0) {
                sumNilaiKontraktor += (c.totalNilai / c.count);
                countKontraktor++;
            }
        });
        const finalAvgNilaiKontraktor = countKontraktor > 0 ? (sumNilaiKontraktor / countKontraktor).toFixed(1) : '0.0';
        const totalDenda = Array.from(penaltyByStoreKey.values()).reduce((sum, value) => sum + value.amount, 0);

        const contractorGrouped = Object.entries(contractorScores).map(([nama, data]) => ({
            type: 'KONTRAKTOR',
            nama_kontraktor: nama,
            nilai: data.count > 0 ? (data.totalNilai / data.count) : 0,
            tokoCount: data.count,
            stores: data.stores
        }));

        const count = filteredProjects.length || 1;

        return {
            total: filteredProjects.length,
            attention: attentionCount,
            penawaran: totalPenawaran,
            spk: totalSPK,
            avgJHK: Math.round(totalJHK / (jhkProjectCount || 1)),
            avgDelay: Math.round(totalDelay / (delayProjectCount || 1)),
            totalDenda: totalDenda,
            avgCostTerbuka: countTerbuka > 0 ? Math.round(sumRatioTerbuka / countTerbuka) : 0,
            avgCostBangunan: countBangunan > 0 ? Math.round(sumRatioBangunan / countBangunan) : 0,
            avgCostTerbangun: countTerbangun > 0 ? Math.round(sumRatioTerbangun / countTerbangun) : 0,
            avgNilaiToko: countNilaiToko > 0 ? (totalNilaiToko / countNilaiToko).toFixed(1) : '0.0',
            avgNilaiKontraktor: finalAvgNilaiKontraktor,
            contractorGrouped,
            avgBeanspot: countBeanspot > 0 ? Math.round(sumBeanspot / countBeanspot) : 0,
            beanspotStores,
            miniStats,
            miniPerhatian
        };
    }, [filteredProjects, rabItemsMap, opnameItemsMap]);

    const handleLogout = () => { sessionStorage.clear(); router.push('/'); };
    const canSeeAllMonitoringBranches = userInfo.cabang === 'HEAD OFFICE' || canViewAllBranches(userInfo.roles, user?.isSuperHuman ?? false);
    const shouldShowFinancialBenchmarkCards = !isCompanyScopedUser;
    const pipelineSteps = ['Approval RAB', 'Proses Gantt', 'Proses PJU', 'Approval SPK', 'Ongoing', 'Kerja Tambah Kurang', 'Done'];
    const priorityProjects = useMemo(() => {
        return filteredProjects
            .map((project) => {
                const lateDays = calculateProjectLateDays(project);
                const penalty = getProjectPenaltyInfo(project, lateDays);
                const stage = getProjectStage(project);
                const hasST = Boolean(getLatestSerahTerima(project));
                const priorityScore = (penalty.amount > 0 ? 3 : 0) + (lateDays > 0 ? 2 : 0) + (stage !== 'Done' ? 1 : 0) + (!hasST && stage === 'Kerja Tambah Kurang' ? 1 : 0);
                return { project, stage, lateDays, penalty, hasST, priorityScore };
            })
            .filter(item => item.priorityScore > 0)
            .sort((a, b) => b.priorityScore - a.priorityScore || b.lateDays - a.lateDays || b.penalty.amount - a.penalty.amount)
            .slice(0, 6);
    }, [filteredProjects]);

    const financialHighlights = [
        { label: 'Penawaran', value: formatRupiah(stats.penawaran), icon: <FileText className="w-4 h-4" />, context: 'PENAWARAN', color: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
        { label: 'SPK', value: formatRupiah(stats.spk), icon: <DollarSign className="w-4 h-4" />, context: 'SPK', color: 'text-orange-700 bg-orange-50 border-orange-100' },
        { label: 'Denda', value: formatRupiah(stats.totalDenda), icon: <AlertCircle className="w-4 h-4" />, context: 'DENDA', color: 'text-red-700 bg-red-50 border-red-100' },
        { label: 'Nilai Toko', value: `${stats.avgNilaiToko} Poin`, icon: <Tag className="w-4 h-4" />, context: 'NILAI_TOKO', color: 'text-amber-700 bg-amber-50 border-amber-100' },
    ];
    const focusCards = [
        { label: 'Total Toko', value: stats.total, helper: 'Semua toko pada filter aktif', icon: <Store className="w-4 h-4" />, context: 'PROJECT', subContext: '', tone: 'border-slate-200 bg-white text-slate-900' },
        { label: 'Perlu Dicek', value: stats.attention, helper: 'Lewat SLA atau punya risiko denda', icon: <AlertTriangle className="w-4 h-4" />, context: 'ATTENTION', subContext: '', tone: 'border-red-200 bg-red-50 text-red-700' },
        { label: 'Ongoing', value: stats.miniStats.Ongoing, helper: 'Sudah SPK dan masih berjalan', icon: <HardHat className="w-4 h-4" />, context: 'PROJECT', subContext: 'Ongoing', tone: 'border-blue-200 bg-blue-50 text-blue-700' },
        { label: 'Done / ST', value: stats.miniStats.Done, helper: 'Sudah opname final atau serah terima', icon: <CheckCircle2 className="w-4 h-4" />, context: 'PROJECT', subContext: 'Done', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    ];

    // =========================================================================
    // LOADING STATE
    // =========================================================================
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
                    <span className="text-sm font-medium">Memuat Dashboard...</span>
                </div>
            </div>
        );
    }

    // =========================================================================
    // RENDER
    // =========================================================================
    return (
        // h-screen + overflow-hidden → tidak ada scroll sama sekali
        <div className="h-screen flex flex-col overflow-hidden bg-slate-100 font-sans text-slate-800">

            {/* ================================================================
                HEADER — Menggunakan AppNavbar dengan konfigurasi khusus Dashboard
            ================================================================ */}
            <AppNavbar 
                title="SPARTA Building"
                showBuildingLogo={true}
                showMenuToggle={true}
                isMenuOpen={sidebarOpen}
                onMenuToggle={() => setSidebarOpen(prev => !prev)}
                showLogout={true}
                onLogout={() => setLogoutDialogOpen(true)}
            />

            {/* ================================================================
                BODY: SIDEBAR + MAIN CONTENT
            ================================================================ */}
            <div className="flex flex-1 overflow-hidden relative">

                {/* Overlay gelap — hanya mobile */}
                {sidebarOpen && (
                    <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
                )}

                {/* ===================== SIDEBAR ===================== */}
                <aside
                    className={`
                        shrink-0 bg-white border-r border-slate-200 flex flex-col z-20
                        transition-all duration-300 ease-in-out overflow-hidden
                        absolute md:relative top-0 left-0 h-full
                        ${sidebarOpen
                            ? 'w-75 translate-x-0 shadow-xl md:shadow-none'
                            : 'w-0 -translate-x-full md:translate-x-0 md:w-0'}
                    `}
                >
                    {/* Sidebar header */}
                    <div className="px-4 pt-4 pb-2.5 border-b border-slate-100 shrink-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Navigasi</p>
                        <h2 className="text-sm font-bold text-slate-700 mt-0.5">Fitur Akses</h2>
                    </div>

                    {/* Menu items */}
                    <nav className="flex-1 overflow-y-auto px-2.5 py-2.5 flex flex-col gap-0.5">
                        {allowedMenus.map((menu) => {
                            const IconComp = menu.icon;
                            const approvalCount = menu.id === "menu-approval" && user
                                ? getApprovalNotificationTotal(approvalCounts, getAccessibleApprovalTypes(user))
                                : 0;
                            const menuCount = menu.id === "menu-rab" ? rabRevisionCount : approvalCount;
                            const menuCountClass = menu.id === "menu-rab"
                                ? "bg-amber-500 text-white"
                                : "bg-red-600 text-white";
                            const isPausedStoreDocumentMenu =
                                menu.id === "menu-svdokumen" && userInfo.cabang !== "HEAD OFFICE";
                            const inner = (
                                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 hover:border-red-200 border border-transparent transition-all duration-200 group cursor-pointer">
                                    <div className="w-7 h-7 rounded-md bg-slate-100 group-hover:bg-red-100 flex items-center justify-center shrink-0 transition-colors">
                                        <IconComp className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-600 transition-colors" />
                                    </div>
                                    <div className="flex-1 min-w-0 flex items-center justify-between pr-2">
                                        <div className="flex-1 min-w-0 pr-1">
                                            <p className="text-[12px] font-semibold text-slate-700 group-hover:text-red-700 leading-snug transition-colors wrap-break-word">{menu.title}</p>
                                            <p className="text-[10px] text-slate-400 leading-snug wrap-break-word mt-0.5">{menu.desc}</p>
                                        </div>
                                        {menuCount > 0 && (
                                            <span className={`ml-2 min-w-5 h-5 px-1.5 rounded-full ${menuCountClass} text-[10px] font-extrabold flex items-center justify-center shadow-sm`}>
                                                {menuCount > 99 ? '99+' : menuCount}
                                            </span>
                                        )}
                                    </div>
                                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-red-400 shrink-0 transition-colors" />
                                </div>
                            );
                            if (isPausedStoreDocumentMenu) return (
                                <div
                                    key={menu.id}
                                    onClick={() => {
                                        showFeatureAlert("Akses Diberhentikan Sementara", PAUSED_STORE_DOCUMENT_MESSAGE);
                                        if (window.innerWidth <= 768) setSidebarOpen(false);
                                    }}
                                >
                                    {inner}
                                </div>
                            );
                            if (menu.isAlert) return (
                                <div
                                    key={menu.id}
                                    onClick={() => {
                                        showFeatureAlert("Fitur Belum Tersedia", `Halaman ${menu.title} belum tersedia saat ini.`);
                                        if (window.innerWidth <= 768) setSidebarOpen(false);
                                    }}
                                >
                                    {inner}
                                </div>
                            );
                            if (menu.external) return (
                                <a key={menu.id} href={menu.href} target="_blank" rel="noopener noreferrer">{inner}</a>
                            );
                            return (
                                <Link key={menu.id} href={menu.href} onClick={() => { if (window.innerWidth <= 768) setSidebarOpen(false); }}>{inner}</Link>
                            );
                        })}
                        {allowedMenus.length === 0 && (
                            <div className="text-center py-8 px-3">
                                <AlertTriangle className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                                <p className="text-xs text-slate-400">Tidak ada menu tersedia</p>
                            </div>
                        )}
                    </nav>

                    {/* Sidebar footer */}
                    <div className="px-4 py-2.5 border-t border-slate-100 shrink-0 space-y-2">
                        <Button
                            variant="ghost"
                            className="h-8 w-full justify-start rounded-lg text-xs font-semibold text-slate-500"
                            onClick={() => router.push('/workspace')}
                        >
                            <LogOut className="mr-2 h-3.5 w-3.5" />
                            Ganti Workspace
                        </Button>
                        <p className="text-[10px] text-slate-400 text-center">SPARTA Building — Alfamart</p>
                    </div>
                </aside>

                {/* ===================== MAIN — Home Portal ===================== */}
                <main className="flex-1 flex flex-col overflow-hidden p-3 gap-2 min-w-0">

                    {/* === TOP BAR: info user (1 baris kompak) + judul === */}
                    <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-1.5 shrink-0 shadow-sm gap-3">

                        {/* Kiri: avatar inisial + nama + role + cabang */}
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                                {userInfo.name ? userInfo.name.charAt(0) : '?'}
                            </div>
                            <span className="text-sm font-bold text-slate-800 truncate max-w-40 hidden sm:block">
                                {userInfo.name || '-'}
                            </span>
                            {userInfo.roles.length > 0 && userInfo.roles.map((r, idx) => (
                                <span key={idx} className="text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full hidden md:block whitespace-nowrap">
                                    {r}
                                </span>
                            ))}
                            {userInfo.cabang && (
                                <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full hidden lg:block whitespace-nowrap">
                                    {userInfo.cabang}
                                </span>
                            )}
                        </div>

                        {canViewMonitoringDashboard && (
                            <div className="flex items-center gap-3 shrink-0">
                                {/* Branch Select (For HO or Group) */}
                                {cabangList.length > 1 && (
                                    <Select value={selectedCabang} onValueChange={setSelectedCabang}>
                                        <SelectTrigger className="w-full md:w-40 h-8 rounded-lg text-xs bg-slate-50 border-slate-200">
                                            <SelectValue placeholder="Pilih Cabang" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">Semua Cabang</SelectItem>
                                            {cabangList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}

                                {canExportDashboard && (
                                    <div className="hidden xl:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 px-1">Export</span>
                                        {[
                                            { format: "xlsx" as const, label: "XLSX", icon: FileSpreadsheet },
                                            { format: "csv" as const, label: "CSV", icon: Download },
                                            { format: "pdf" as const, label: "PDF", icon: FileDown },
                                        ].map(({ format, label, icon: Icon }) => (
                                            <Button
                                                key={format}
                                                variant="outline"
                                                size="sm"
                                                className="h-6 rounded-md border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                                                onClick={() => handleDownloadDashboardExport(format)}
                                                disabled={Boolean(exportingFormat)}
                                                title={`Download dashboard ${label}`}
                                            >
                                                {exportingFormat === format ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <Icon className="w-3 h-3" />
                                                )}
                                                {label}
                                            </Button>
                                        ))}
                                    </div>
                                )}

                                {canExportDashboard && (
                                    <div className="flex xl:hidden items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1">
                                        {[
                                            { format: "xlsx" as const, label: "XLSX", icon: FileSpreadsheet },
                                            { format: "csv" as const, label: "CSV", icon: Download },
                                            { format: "pdf" as const, label: "PDF", icon: FileDown },
                                        ].map(({ format, label, icon: Icon }) => (
                                            <Button
                                                key={format}
                                                variant="outline"
                                                size="icon-sm"
                                                className="rounded-md border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                                                onClick={() => handleDownloadDashboardExport(format)}
                                                disabled={Boolean(exportingFormat)}
                                                title={`Download dashboard ${label}`}
                                            >
                                                {exportingFormat === format ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <Icon className="w-3.5 h-3.5" />
                                                )}
                                            </Button>
                                        ))}
                                    </div>
                                )}

                                {/* Refresh Button */}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 bg-slate-50 border-slate-200"
                                    onClick={() => fetchDashboardData(
                                        userInfo.cabang,
                                        canSeeAllMonitoringBranches,
                                        user?.email ?? '',
                                        userInfo.namaPt,
                                        isCompanyScopedUser
                                    )}
                                    disabled={isDataLoading}
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isDataLoading ? 'animate-spin' : ''}`} />
                                </Button>

                                <div className="text-right hidden sm:block border-l border-slate-200 pl-3">
                                    <p className="text-xs font-bold text-slate-700 leading-tight">Live Dashboard</p>
                                    <p className="text-[10px] text-slate-400 leading-tight">Project Monitoring</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {canViewMonitoringDashboard ? (
                    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 rounded-xl border border-slate-200">
                        
                        {/* 1. SCROLLABLE CONTENT */}
                        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-5 custom-scrollbar">
                            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <div className="border-b border-slate-200 px-5 py-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-600">Monitoring Operasional</p>
                                            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Dashboard Toko</h1>
                                            <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">
                                                {canSeeAllMonitoringBranches ? 'Ringkasan lintas cabang untuk melihat status dokumen, nilai pekerjaan, denda, dan toko yang perlu ditindaklanjuti.' : `Ringkasan cabang ${userInfo.cabang || '-'} untuk melihat toko aktif, risiko, dan dokumen penting.`}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button variant="outline" className="h-9 rounded-lg text-xs font-bold" onClick={() => setDetailModal({ open: true, title: 'Detail Status Proyek', context: 'PROJECT', subContext: '' })}>
                                                <Layers className="mr-1.5 h-3.5 w-3.5" /> Semua Toko
                                            </Button>
                                            <Button className="h-9 rounded-lg bg-red-600 text-xs font-bold text-white hover:bg-red-700" onClick={() => setDetailModal({ open: true, title: 'Detail SLA (Perlu Perhatian)', context: 'ATTENTION', subContext: '' })}>
                                                <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Prioritas
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
                                    {focusCards.map(item => (
                                        <button
                                            key={item.label}
                                            className={`rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${item.tone}`}
                                            onClick={() => setDetailModal({ open: true, title: item.label, context: item.context, subContext: item.subContext })}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="rounded-lg bg-white/80 p-2 shadow-sm">{item.icon}</div>
                                                <ChevronRight className="h-4 w-4 opacity-50" />
                                            </div>
                                            <p className="mt-4 text-[11px] font-black uppercase tracking-wide opacity-70">{item.label}</p>
                                            <p className="mt-1 text-3xl font-black leading-none">{item.value}</p>
                                            <p className="mt-2 text-xs font-semibold opacity-70">{item.helper}</p>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Tahap Pekerjaan</p>
                                            <h2 className="text-lg font-black text-slate-950">Alur Dokumen</h2>
                                        </div>
                                        <Button variant="outline" className="h-9 rounded-lg text-xs font-bold" onClick={() => setDetailModal({ open: true, title: 'Detail Status Proyek', context: 'PROJECT', subContext: '' })}>
                                            Lihat Semua
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
                                        {pipelineSteps.map((label, idx) => {
                                            const value = stats.miniStats[label as keyof typeof stats.miniStats] ?? 0;
                                            const pct = stats.total > 0 ? Math.round((value / stats.total) * 100) : 0;
                                            return (
                                                <button
                                                    key={label}
                                                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition-all hover:border-red-200 hover:bg-white hover:shadow-sm"
                                                    onClick={() => setDetailModal({ open: true, title: `Tahap ${label}`, context: 'PROJECT', subContext: label })}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-500">{idx + 1}</span>
                                                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500">{pct}%</span>
                                                    </div>
                                                    <p className="mt-3 min-h-8 text-sm font-black leading-tight text-slate-900">{label}</p>
                                                    <div className="mt-3 flex items-end justify-between gap-3">
                                                        <p className="text-2xl font-black text-red-600">{value}</p>
                                                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                                                            <div className="h-full rounded-full bg-red-600" style={{ width: `${Math.max(4, pct)}%` }} />
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="mb-4">
                                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Angka Kunci</p>
                                        <h2 className="text-lg font-black text-slate-950">Nilai & Risiko</h2>
                                    </div>
                                    <div className="space-y-3">
                                        {financialHighlights.map(item => (
                                            <button key={item.label} className={`w-full rounded-xl border p-4 text-left transition-all hover:shadow-sm ${item.color}`} onClick={() => setDetailModal({ open: true, title: item.label, context: item.context, subContext: '' })}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className="rounded-lg bg-white/80 p-2 shadow-sm">{item.icon}</div>
                                                        <div>
                                                            <p className="text-[11px] font-black uppercase tracking-wide opacity-70">{item.label}</p>
                                                            <p className="mt-1 text-xl font-black">{item.value}</p>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="mt-1 h-4 w-4 opacity-50" />
                                                </div>
                                            </button>
                                        ))}
                                        {shouldShowFinancialBenchmarkCards && (
                                            <button className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition-all hover:border-purple-200 hover:bg-white hover:shadow-sm" onClick={() => setDetailModal({ open: true, title: 'Rata-rata Cost/m2', context: 'COST_M2', subContext: '' })}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Cost/m2</p>
                                                        <p className="mt-1 text-lg font-black text-slate-950">Terbangun {formatRupiah(stats.avgCostTerbangun)}</p>
                                                        <p className="mt-1 text-xs font-semibold text-slate-500">Bangunan {formatRupiah(stats.avgCostBangunan)} - Terbuka {formatRupiah(stats.avgCostTerbuka)}</p>
                                                    </div>
                                                    <ChevronRight className="mt-1 h-4 w-4 text-slate-400" />
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Daftar Kerja</p>
                                            <h2 className="text-lg font-black text-slate-950">Toko yang Harus Dicek</h2>
                                        </div>
                                        <Button variant="outline" className="h-9 rounded-lg text-xs font-bold" onClick={() => setDetailModal({ open: true, title: 'Detail SLA (Perlu Perhatian)', context: 'ATTENTION', subContext: '' })}>
                                            Semua Prioritas
                                        </Button>
                                    </div>
                                    <div className="space-y-3">
                                        {priorityProjects.length === 0 ? (
                                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold text-emerald-700">Tidak ada toko prioritas pada filter ini.</div>
                                        ) : priorityProjects.map(({ project, stage, lateDays, penalty, hasST }) => {
                                            const st = getLatestSerahTerima(project);
                                            return (
                                                <div key={project.toko?.id || project.toko?.nomor_ulok} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="font-black text-slate-950">{project.toko?.nama_toko || '-'}</p>
                                                                <Badge className="border-slate-200 bg-slate-100 font-black text-slate-700">{project.toko?.nomor_ulok || '-'}</Badge>
                                                                <Badge className="border-blue-100 bg-blue-50 font-black text-blue-700">{stage}</Badge>
                                                            </div>
                                                            <p className="mt-1 text-xs font-semibold text-slate-500">{project.toko?.cabang || '-'} - {project.toko?.lingkup_pekerjaan || '-'}</p>
                                                            {st?.created_at && <p className="mt-1 text-[11px] font-medium text-slate-400">ST terakhir {new Date(st.created_at).toLocaleDateString('id-ID')}</p>}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                                            {lateDays > 0 && <Badge className="border-red-100 bg-red-50 font-black text-red-700">{lateDays} hari telat</Badge>}
                                                            {penalty.amount > 0 && <Badge className="border-rose-100 bg-rose-50 font-black text-rose-700">{formatRupiah(penalty.amount)}</Badge>}
                                                            {hasST ? (
                                                                <Button variant="outline" className="h-8 rounded-lg bg-white text-xs font-bold" onClick={() => handleOpenSerahTerima(project)}>
                                                                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> ST
                                                                </Button>
                                                            ) : (
                                                                <Badge className="border-slate-200 bg-slate-100 font-black text-slate-500">Belum ST</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="mb-4">
                                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Kualitas Serah Terima</p>
                                        <h2 className="text-lg font-black text-slate-950">Nilai Toko</h2>
                                    </div>
                                    <button className="w-full rounded-xl border border-amber-200 bg-amber-50 p-5 text-left transition-all hover:bg-white hover:shadow-sm" onClick={() => setDetailModal({ open: true, title: 'Rata-rata Nilai Toko', context: 'NILAI_TOKO', subContext: '' })}>
                                        <div className="flex items-center justify-between">
                                            <Tag className="h-5 w-5 text-amber-700" />
                                            <ChevronRight className="h-4 w-4 text-amber-700" />
                                        </div>
                                        <p className="mt-6 text-[11px] font-black uppercase tracking-wide text-amber-700">Rata-rata Nilai Toko</p>
                                        <p className="mt-1 text-4xl font-black text-amber-900">{stats.avgNilaiToko}</p>
                                        <p className="mt-2 text-sm font-semibold text-amber-800">Klik untuk lihat komponen nilai dan akses file ST per toko.</p>
                                    </button>
                                </div>
                            </section>

                            <section className="hidden">
                                <div className="relative overflow-hidden rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-sm">
                                    <div className="absolute inset-y-0 right-0 w-1/2 bg-linear-to-l from-red-700/25 to-transparent" />
                                    <div className="relative p-5 md:p-6">
                                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-red-200">Command Center</p>
                                                <h1 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">Monitoring Toko</h1>
                                                <p className="mt-2 text-sm text-slate-300 max-w-2xl">
                                                    {canSeeAllMonitoringBranches ? 'Pantau seluruh cabang, temukan bottleneck, dan buka dokumen penting tanpa bolak-balik halaman.' : `Fokus toko cabang ${userInfo.cabang || '-'}, prioritas tindakan, dan dokumen yang perlu dicek hari ini.`}
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 min-w-58">
                                                {[
                                                    { label: 'Toko Aktif', value: stats.total, tone: 'bg-white/10 text-white', context: 'PROJECT' },
                                                    { label: 'Perlu Tindakan', value: stats.attention, tone: 'bg-red-500/20 text-red-100', context: 'ATTENTION' },
                                                    { label: 'Ongoing', value: stats.miniStats.Ongoing, tone: 'bg-blue-500/20 text-blue-100', context: 'PROJECT', subContext: 'Ongoing' },
                                                    { label: 'Done/ST', value: stats.miniStats.Done, tone: 'bg-emerald-500/20 text-emerald-100', context: 'PROJECT', subContext: 'Done' },
                                                ].map(item => (
                                                    <button
                                                        key={item.label}
                                                        className={`rounded-2xl border border-white/10 ${item.tone} px-3 py-3 text-left hover:bg-white/15 transition-colors`}
                                                        onClick={() => setDetailModal({ open: true, title: item.label, context: item.context, subContext: item.subContext || '' })}
                                                    >
                                                        <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{item.label}</p>
                                                        <p className="mt-1 text-2xl font-black">{item.value}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5">
                                    <div className="flex items-center justify-between gap-3 mb-4">
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Kesehatan Project</p>
                                            <h2 className="text-lg font-black text-slate-900">Tindakan Cepat</h2>
                                        </div>
                                        <Badge className="bg-red-50 text-red-700 border-red-100 font-bold">{stats.attention} prioritas</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button className="rounded-2xl border border-red-100 bg-red-50 p-4 text-left hover:border-red-300 transition-colors" onClick={() => setDetailModal({ open: true, title: 'Rincian Denda', context: 'DENDA', subContext: '' })}>
                                            <AlertCircle className="w-5 h-5 text-red-600 mb-3" />
                                            <p className="text-[10px] font-bold uppercase text-red-500">Total Denda</p>
                                            <p className="text-lg font-black text-red-700">{formatRupiah(stats.totalDenda)}</p>
                                        </button>
                                        <button className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-left hover:border-amber-300 transition-colors" onClick={() => setDetailModal({ open: true, title: 'Rata-rata Nilai Toko', context: 'NILAI_TOKO', subContext: '' })}>
                                            <Tag className="w-5 h-5 text-amber-600 mb-3" />
                                            <p className="text-[10px] font-bold uppercase text-amber-500">Nilai Toko</p>
                                            <p className="text-lg font-black text-amber-700">{stats.avgNilaiToko} Poin</p>
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <section className="hidden">
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Pipeline</p>
                                        <h2 className="text-lg font-black text-slate-900">Tahapan Dokumen & Pekerjaan</h2>
                                    </div>
                                    <Button variant="outline" className="h-9 rounded-xl text-xs font-bold" onClick={() => setDetailModal({ open: true, title: 'Detail Status Proyek', context: 'PROJECT', subContext: '' })}>
                                        Semua Tahap
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
                                    {pipelineSteps.map((label, idx) => {
                                        const value = stats.miniStats[label as keyof typeof stats.miniStats] ?? 0;
                                        const pct = stats.total > 0 ? Math.round((value / stats.total) * 100) : 0;
                                        return (
                                            <button key={label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left hover:border-red-200 hover:bg-white hover:shadow-sm transition-all" onClick={() => setDetailModal({ open: true, title: `Tahap ${label}`, context: 'PROJECT', subContext: label })}>
                                                <div className="flex items-center justify-between">
                                                    <span className="w-6 h-6 rounded-full bg-white border border-slate-200 text-[10px] font-black text-slate-500 flex items-center justify-center">{idx + 1}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">{pct}%</span>
                                                </div>
                                                <p className="mt-3 min-h-8 text-xs font-black text-slate-800 leading-tight">{label}</p>
                                                <p className="mt-2 text-2xl font-black text-red-600">{value}</p>
                                                <div className="mt-3 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                                    <div className="h-full rounded-full bg-red-600" style={{ width: `${Math.max(4, pct)}%` }} />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="hidden">
                                <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Prioritas Hari Ini</p>
                                            <h2 className="text-lg font-black text-slate-900">Toko yang Perlu Dicek</h2>
                                        </div>
                                        <Button variant="outline" className="h-9 rounded-xl text-xs font-bold" onClick={() => setDetailModal({ open: true, title: 'Detail SLA (Perlu Perhatian)', context: 'ATTENTION', subContext: '' })}>
                                            Lihat Semua
                                        </Button>
                                    </div>
                                    <div className="space-y-3">
                                        {priorityProjects.length === 0 ? (
                                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-semibold text-emerald-700">Tidak ada prioritas berat pada filter ini.</div>
                                        ) : priorityProjects.map(({ project, stage, lateDays, penalty, hasST }) => {
                                            const st = getLatestSerahTerima(project);
                                            return (
                                                <div key={project.toko?.id || project.toko?.nomor_ulok} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="font-black text-slate-900 truncate">{project.toko?.nama_toko || '-'}</p>
                                                                <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-bold">{project.toko?.nomor_ulok || '-'}</Badge>
                                                                <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-bold">{stage}</Badge>
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-1">{project.toko?.cabang || '-'} - {project.toko?.lingkup_pekerjaan || '-'}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                                            {lateDays > 0 && <Badge className="bg-red-50 text-red-700 border-red-100 font-bold">{lateDays} hari terlambat</Badge>}
                                                            {penalty.amount > 0 && <Badge className="bg-rose-50 text-rose-700 border-rose-100 font-bold">{formatRupiah(penalty.amount)}</Badge>}
                                                            {hasST ? (
                                                                <Button variant="outline" className="h-8 rounded-lg text-xs font-bold bg-white" onClick={() => handleOpenSerahTerima(project)}>
                                                                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Lihat ST
                                                                </Button>
                                                            ) : (
                                                                <Badge className="bg-slate-100 text-slate-500 border-slate-200 font-bold">Belum ST</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {st?.created_at && <p className="mt-2 text-[11px] text-slate-400">ST terakhir: {new Date(st.created_at).toLocaleDateString('id-ID')}</p>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5">
                                    <div className="mb-4">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Nilai & Kualitas</p>
                                        <h2 className="text-lg font-black text-slate-900">Ringkasan Keuangan</h2>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {financialHighlights.map(item => (
                                            <button key={item.label} className={`rounded-2xl border p-4 text-left hover:shadow-sm transition-all ${item.color}`} onClick={() => setDetailModal({ open: true, title: item.label, context: item.context, subContext: '' })}>
                                                <div className="flex items-center justify-between">
                                                    {item.icon}
                                                    <ChevronRight className="w-4 h-4 opacity-50" />
                                                </div>
                                                <p className="mt-4 text-[10px] font-bold uppercase tracking-wide opacity-80">{item.label}</p>
                                                <p className="mt-1 text-lg font-black">{item.value}</p>
                                            </button>
                                        ))}
                                    </div>
                                    {shouldShowFinancialBenchmarkCards && (
                                        <button className="mt-3 w-full rounded-2xl border border-purple-100 bg-purple-50 p-4 text-left hover:border-purple-300 transition-colors" onClick={() => setDetailModal({ open: true, title: 'Rata-rata Cost/m²', context: 'COST_M2', subContext: '' })}>
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-purple-500">Cost/m²</p>
                                                    <p className="mt-1 text-sm font-black text-purple-900">Terbangun {formatRupiah(stats.avgCostTerbangun)}</p>
                                                </div>
                                                <div className="text-right text-[11px] font-bold text-purple-700">
                                                    <p>Bangunan {formatRupiah(stats.avgCostBangunan)}</p>
                                                    <p>Terbuka {formatRupiah(stats.avgCostTerbuka)}</p>
                                                </div>
                                            </div>
                                        </button>
                                    )}
                                </div>
                            </section>
                            
                            {/* 1.1 SUMMARY CARDS - GRID BARU */}
                                <div className="hidden">
                                <StatCard 
                                    title="Total Proyek" 
                                    value={stats.total} 
                                    icon={<Home />} 
                                    bgColor="#eff6ff"
                                    textColor="#2563eb"
                                    subLabel="Toko Terdaftar"
                                    className="xl:col-span-2"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Detail Status Proyek', context: 'PROJECT', subContext: '' })}
                                    renderExtra={
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 w-full mt-2 md:mt-0 md:w-auto">
                                            {Object.entries(stats.miniStats).map(([label, val]) => (
                                                <div key={label} className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 flex flex-col items-center justify-center min-w-17.5 hover:bg-blue-50 transition-colors">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase leading-none text-center">{label}</span>
                                                    <span className="text-[12px] font-black text-blue-600 mt-1 leading-none">{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    }
                                />
                                <StatCard 
                                    title="Perlu Perhatian" 
                                    value={stats.attention} 
                                    icon={<AlertTriangle />} 
                                    bgColor="#fef2f2"
                                    textColor="#ef4444"
                                    subLabel="Toko Melebihi SLA"
                                    valueColor="#ef4444"
                                    className="xl:col-span-2"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Detail SLA (Perlu Perhatian)', context: 'ATTENTION', subContext: '' })}
                                    renderExtra={
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 w-full mt-2 md:mt-0 md:w-auto">
                                            {Object.entries(stats.miniPerhatian).map(([label, val]) => (
                                                <div key={label} className={`rounded-lg px-2 py-1 flex flex-col items-center justify-center min-w-17.5 border hover:opacity-80 transition-opacity ${val > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                                    <span className={`text-[8px] font-bold uppercase leading-none text-center ${val > 0 ? 'text-red-400' : 'text-slate-400'}`}>{label}</span>
                                                    <span className={`text-[12px] font-black mt-1 leading-none ${val > 0 ? 'text-red-600' : 'text-slate-400'}`}>{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    }
                                />
                                {shouldShowFinancialBenchmarkCards && (
                                    <StatCard
                                        title="Rata-rata Cost/m²"
                                        value=""
                                        icon={<Layers />}
                                        bgColor="#faf5ff"
                                        textColor="#805ad5"
                                        subLabel="Rata-rata Biaya Per Meter Persegi"
                                        className="xl:col-span-2"
                                        isLoading={isDataLoading}
                                        onClick={() => setDetailModal({ open: true, title: 'Rata-rata Cost/m²', context: 'COST_M2', subContext: '' })}
                                        renderExtra={
                                            <div className="grid grid-cols-3 gap-10 w-full mt-2 md:mt-0 md:w-auto">
                                                <div className="bg-purple-50/60 border border-purple-100/80 rounded-lg px-2.5 py-1.5 flex flex-col items-center justify-center min-w-20 hover:bg-purple-100/40 transition-colors">
                                                    <span className="text-[8px] font-bold text-purple-500 uppercase tracking-wider leading-none text-center">Terbangun</span>
                                                    <span className="text-[10px] sm:text-[11px] font-black text-purple-700 mt-1.5 leading-none">{formatRupiah(stats.avgCostTerbangun)}</span>
                                                </div>
                                                <div className="bg-blue-50/60 border border-blue-100/80 rounded-lg px-2.5 py-1.5 flex flex-col items-center justify-center min-w-20 hover:bg-blue-100/40 transition-colors">
                                                    <span className="text-[8px] font-bold text-blue-500 uppercase tracking-wider leading-none text-center">Bangunan</span>
                                                    <span className="text-[10px] sm:text-[11px] font-black text-blue-700 mt-1.5 leading-none">{formatRupiah(stats.avgCostBangunan)}</span>
                                                </div>
                                                <div className="bg-emerald-50/60 border border-emerald-100/80 rounded-lg px-2.5 py-1.5 flex flex-col items-center justify-center min-w-20 hover:bg-emerald-100/40 transition-colors">
                                                    <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-wider leading-none text-center">Terbuka</span>
                                                    <span className="text-[10px] sm:text-[11px] font-black text-emerald-700 mt-1.5 leading-none">{formatRupiah(stats.avgCostTerbuka)}</span>
                                                </div>
                                            </div>
                                        }
                                    />
                                )}
                                <StatCard 
                                    title="Total Nilai Penawaran" 
                                    value={formatRupiah(stats.penawaran)} 
                                    icon={<FileText />} 
                                    bgColor="#e0e7ff"
                                    textColor="#4338ca"
                                    subLabel='Grand Total Final'
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Daftar Penawaran (by Ulok)', context: 'PENAWARAN', subContext: '' })}
                                />
                                <StatCard 
                                    title="Total Nilai SPK" 
                                    value={formatRupiah(stats.spk)} 
                                    icon={<DollarSign />} 
                                    bgColor="#fff7ed"
                                    textColor="#c05621"
                                    subLabel='Grand Total'
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Daftar SPK (by Ulok)', context: 'SPK', subContext: '' })}
                                />
                                <StatCard 
                                    title="Rata-rata JHK Pekerjaan" 
                                    value={`${stats.avgJHK} Hari`} 
                                    icon={<Calendar />} 
                                    bgColor="#f0fff4"
                                    textColor="#2f855a"
                                    subLabel="Durasi SPK + Tambah SPK + Keterlambatan"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Rincian JHK Pekerjaan', context: 'JHK', subContext: '' })}
                                />
                                <StatCard 
                                    title="Rata-rata Keterlambatan" 
                                    value={`${stats.avgDelay} Hari`} 
                                    icon={<Clock />} 
                                    bgColor="#fff5f5"
                                    textColor="#e53e3e"
                                    subLabel="Per Proyek"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Rincian Keterlambatan', context: 'DELAY', subContext: '' })}
                                />
                                <StatCard 
                                    title="Total Denda" 
                                    value={formatRupiah(stats.totalDenda)} 
                                    icon={<AlertCircle />} 
                                    bgColor="#fee2e2"
                                    textColor="#b91c1c"
                                    subLabel="Denda resmi opname final"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Rincian Denda', context: 'DENDA', subContext: '' })}
                                />
                                {shouldShowFinancialBenchmarkCards && (
                                    <StatCard
                                        title="Rata-rata Nilai Beanspot"
                                        value={formatRupiah(stats.avgBeanspot)}
                                        icon={<Coffee />}
                                        bgColor="#fdf2f8"
                                        textColor="#db2777"
                                        subLabel="Rata-rata Nominal Beanspot/Toko"
                                        isLoading={isDataLoading}
                                        onClick={() => setDetailModal({ open: true, title: 'Rincian Nilai Beanspot', context: 'BEANSPOT', subContext: '' })}
                                    />
                                )}
                                <StatCard 
                                    title="Rata-rata Nilai Kontraktor" 
                                    value={stats.avgNilaiKontraktor} 
                                    icon={<UserCheck />} 
                                    bgColor="#e0f2fe"
                                    textColor="#0284c7"
                                    subLabel="Nilai Kontraktor"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Rata-rata Nilai Kontraktor', context: 'NILAI_KONTRAKTOR', subContext: '' })}
                                />
                                <StatCard 
                                    title="Rata-rata Nilai Toko" 
                                    value={stats.avgNilaiToko} 
                                    icon={<Tag />} 
                                    bgColor="#fef3c7"
                                    textColor="#d97706"
                                    subLabel="Nilai Toko"
                                    isLoading={isDataLoading}
                                    onClick={() => setDetailModal({ open: true, title: 'Rata-rata Nilai Toko', context: 'NILAI_TOKO', subContext: '' })}
                                />
                                </div>


                        </div>
                    </div>
                    ) : (
                    <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200">
                        <div className="text-center px-6">
                            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-700">Pilih fitur dari navigasi</p>
                            <p className="text-xs text-slate-400 mt-1">Dashboard monitoring hanya dimuat untuk Head Office.</p>
                        </div>
                    </div>
                    )}

                </main>
            </div>

            {/* ====================== MODALS ====================== */}
            <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
                <AlertDialogContent className="rounded-2xl max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Keluar</AlertDialogTitle>
                        <AlertDialogDescription>
                            Apakah Anda yakin ingin keluar dari sistem SPARTA Building? Sesi Anda akan diakhiri.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700">Ya, Logout</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={featureAlertOpen} onOpenChange={setFeatureAlertOpen}>
                <AlertDialogContent className="rounded-2xl max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{featureAlert.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {featureAlert.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700">Mengerti</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog 
                open={detailModal.open} 
                onOpenChange={(open) => setDetailModal(prev => ({ ...prev, open }))}
            >
                <AlertDialogContent className="max-w-none! w-[98vw]! max-h-[92vh]! overflow-hidden flex flex-col p-0 rounded-2xl border-none shadow-2xl">
                    <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                                <Activity className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <AlertDialogTitle className="text-base font-bold leading-none">{detailModal.title}</AlertDialogTitle>
                                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-semibold">Monitoring Rincian Data</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-white hover:bg-white/10 rounded-full"
                                onClick={() => fetchDashboardData(
                                    userInfo.cabang,
                                    canSeeAllMonitoringBranches,
                                    user?.email ?? '',
                                    userInfo.namaPt,
                                    isCompanyScopedUser
                                )}
                                disabled={isDataLoading}
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isDataLoading ? 'animate-spin' : ''}`} />
                            </Button>
                            <AlertDialogCancel className="bg-white/10 border-none text-white hover:bg-white/20 hover:text-white h-8 w-8 p-0 rounded-full flex items-center justify-center">
                                <X className="w-4 h-4" />
                            </AlertDialogCancel>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                        {detailModal.context === 'PROJECT' && !detailModal.subContext && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(stats.miniStats).map(([label, val]) => (
                                    <div 
                                        key={label} 
                                        onClick={() => setDetailModal(prev => ({ ...prev, subContext: label }))}
                                        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                        <div className="text-3xl font-black text-slate-800">{val}</div>
                                        <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Klik untuk melihat daftar toko</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {detailModal.context === 'ATTENTION' && !detailModal.subContext && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(stats.miniPerhatian).map(([label, val]) => (
                                    <div 
                                        key={label} 
                                        onClick={() => val > 0 && setDetailModal(prev => ({ ...prev, subContext: label }))}
                                        className={`p-5 rounded-2xl border transition-all group ${val > 0 ? 'bg-white border-red-100 hover:border-red-300 shadow-sm hover:shadow-md cursor-pointer' : 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed'}`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${val > 0 ? 'text-red-400' : 'text-slate-400'}`}>{label}</span>
                                            {val > 0 && <ChevronRight className="w-4 h-4 text-red-300 group-hover:text-red-500 transition-colors" />}
                                        </div>
                                        <div className={`text-3xl font-black ${val > 0 ? 'text-red-600' : 'text-slate-300'}`}>{val}</div>
                                        <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Toko melebihi batas SLA</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(detailModal.subContext || !['PROJECT', 'ATTENTION'].includes(detailModal.context)) && (() => {
                            let modalData: any[] = [];
                            
                            if (detailModal.context === 'NILAI_KONTRAKTOR') {
                                modalData = stats.contractorGrouped || [];
                            } else if (detailModal.context === 'BEANSPOT') {
                                modalData = stats.beanspotStores || [];
                            } else {
                                modalData = filteredProjects.filter(p => {
                                    if (!detailModal.subContext) {
                                    // Context-specific filtering for summary views
                                    if (detailModal.context === 'SPK') {
                                        return (Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : [])).some((s: any) => s.status && !['REJECTED', 'REJECT', 'CANCELLED', 'CANCEL'].includes(s.status.toUpperCase()));
                                    }
                                    if (detailModal.context === 'PENAWARAN' || detailModal.context === 'COST_M2') {
                                        return (p.rab || []).length > 0;
                                    }
                                    if (detailModal.context === 'NILAI_TOKO') {
                                        const opnameItems = opnameItemsMap[p.toko?.id] || [];
                                        return opnameItems.length > 0;
                                    }
                                    if (detailModal.context === 'JHK' || detailModal.context === 'DELAY' || detailModal.context === 'DENDA') {
                                        const spkArr = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                                        const validSpk = spkArr.find((s: any) => ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes((s.status || '').toUpperCase())) || spkArr[0];
                                        if (!validSpk) return false;
                                        if (detailModal.context === 'JHK') return true;

                                        return detailModal.context === 'DENDA'
                                            ? getProjectPenaltyInfo(p).amount > 0
                                            : calculateProjectLateDays(p) > 0;
                                    }
                                    return true;
                                }
                                
                                const hasRAB = (p.rab || []).length > 0;
                                const rabData = p.rab?.[0];
                                const rabStatus = (rabData?.status || '').toUpperCase();
                                const isRabMenungguGantt = rabStatus === 'MENUNGGU GANTT CHART';
                                const isRabDisetujui = rabData && rabStatus === 'DISETUJUI';
                                
                                const spkArray = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                                const hasSPK = spkArray.some((s: any) => ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes((s.status || '').toUpperCase()));
                                const hasApprovalSPK = spkArray.some((s: any) => (s.status || '').toUpperCase() === 'WAITING_FOR_BM_APPROVAL');
                                
                                const hasST = (p.berkas_serah_terima || []).length > 0;
                                const opnameArr = Array.isArray(p.opname_final) ? p.opname_final : (p.opname_final ? [p.opname_final] : []);
                                const opnameData = opnameArr.find((o: any) => String(o?.link_pdf_opname || '').trim());
                                const hasOpnamePdf = !!opnameData;
                                const isOpnameDisetujui = opnameData && (opnameData.status_opname_final || '').toUpperCase() === 'DISETUJUI';

                                let cat = '';
                                if (hasOpnamePdf && isOpnameDisetujui) cat = 'Done';
                                else if (hasOpnamePdf && !isOpnameDisetujui) cat = 'Kerja Tambah Kurang';
                                else if (hasST) cat = 'Kerja Tambah Kurang';
                                else if (hasSPK) cat = 'Ongoing';
                                else if (hasApprovalSPK) cat = 'Approval SPK';
                                else if (isRabDisetujui) cat = 'Proses PJU';
                                else if (hasRAB && isRabMenungguGantt) cat = 'Proses Gantt';
                                else cat = 'Approval RAB';

                                if (cat !== detailModal.subContext) return false;

                                if (detailModal.context === 'ATTENTION') {
                                    const createdAt = new Date(p.toko?.created_at || Date.now());
                                    const diffDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                                    
                                    let isPerhatian = false;
                                    if (cat === 'Ongoing') {
                                        const spkArr = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                                        const approvedSpk = spkArr.find((s: any) => {
                                            const st = (s.status || '').toUpperCase();
                                            return ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes(st);
                                        });
                                        if (approvedSpk) {
                                            const waktuMulai = new Date(approvedSpk.waktu_mulai || approvedSpk.created_at || Date.now());
                                            const durasiSPK = Number(approvedSpk.durasi || 0);
                                            const pertambahanArr = Array.isArray(approvedSpk.pertambahan_spk) ? approvedSpk.pertambahan_spk : [];
                                            const totalPertambahan = pertambahanArr
                                                .filter((pt: any) => ['APPROVED', 'DISETUJUI', 'DISETUJUI BM'].includes((pt.status_persetujuan || '').toUpperCase()))
                                                .reduce((sum: number, pt: any) => sum + Number(pt.pertambahan_hari || 0), 0);
                                            const totalAllowedDays = durasiSPK + totalPertambahan;
                                            const elapsedDays = Math.floor((Date.now() - waktuMulai.getTime()) / (1000 * 60 * 60 * 24));
                                            if (elapsedDays > totalAllowedDays) {
                                                isPerhatian = true;
                                            }
                                        }
                                    }
                                    else if (cat === 'Approval SPK') {
                                        const spkArray = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                                        const spkData = spkArray[0];
                                        if (spkData) {
                                            const spkCreatedAt = new Date(spkData.created_at || p.toko?.created_at || Date.now());
                                            const spkDiffDays = Math.floor((Date.now() - spkCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                                            if (spkDiffDays > 2) {
                                                isPerhatian = true;
                                            }
                                        } else {
                                            if (diffDays > 7) isPerhatian = true;
                                        }
                                    }
                                    else if (cat === 'Approval RAB') {
                                        const rabData = p.rab?.[0];
                                        if (rabData) {
                                            const rabCreatedAt = new Date(rabData.created_at || p.toko?.created_at || Date.now());
                                            const rabDiffDays = Math.floor((Date.now() - rabCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                                            const isDisetujui = (rabData.status || '').toUpperCase() === 'DISETUJUI';
                                            
                                            if (rabDiffDays > 2 && !isDisetujui) {
                                                isPerhatian = true;
                                            }
                                        }
                                    }
                                    else if (cat === 'Proses Gantt') {
                                        const rabData = p.rab?.[0];
                                        const rabCreatedAt = new Date(rabData?.created_at || p.toko?.created_at || Date.now());
                                        const rabDiffDays = Math.floor((Date.now() - rabCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                                        if (rabDiffDays > 2) {
                                            isPerhatian = true;
                                        }
                                    }
                                    else if (cat === 'Proses PJU') {
                                        const rabData = p.rab?.[0];
                                        if (rabData && (rabData.status || '').toUpperCase() === 'DISETUJUI') {
                                            const rabApprovedAt = new Date(rabData.waktu_persetujuan_manager || rabData.updated_at || rabData.created_at || p.toko?.created_at || Date.now());
                                            const pjuDiffDays = Math.floor((Date.now() - rabApprovedAt.getTime()) / (1000 * 60 * 60 * 24));
                                            
                                            if (pjuDiffDays > 10) {
                                                isPerhatian = true;
                                            }
                                        }
                                    }
                                    else if (cat === 'Kerja Tambah Kurang') {
                                        const opnameArr = Array.isArray(p.opname_final) ? p.opname_final : (p.opname_final ? [p.opname_final] : []);
                                        const opnameData = opnameArr.find((o: any) => String(o?.link_pdf_opname || '').trim());
                                        if (opnameData) {
                                            const opnameCreatedAt = new Date(opnameData.created_at || Date.now());
                                            const opnameDiffDays = Math.floor((Date.now() - opnameCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
                                            const isDisetujui = (opnameData.status_opname_final || '').toUpperCase() === 'DISETUJUI';
                                            
                                            if (opnameDiffDays > 14 && !isDisetujui) {
                                                isPerhatian = true;
                                            }
                                        }
                                    }

                                    return isPerhatian && cat !== 'Done';
                                }

                                return true;
                            });
                            }

                            if (detailModal.context === 'DENDA') {
                                modalData = getUniquePenaltyProjects(modalData);
                            }

                            const totalPages = Math.ceil(modalData.length / itemsPerPage);
                            const paginatedData = modalData.slice((modalPage - 1) * itemsPerPage, modalPage * itemsPerPage);
                            const renderModalPagination = () => (
                                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-[11px] font-semibold text-slate-400">
                                        Menampilkan <span className="font-black text-slate-700">{modalData.length ? Math.min(modalData.length, (modalPage - 1) * itemsPerPage + 1) : 0} - {Math.min(modalData.length, modalPage * itemsPerPage)}</span> dari <span className="font-black text-slate-700">{modalData.length}</span> data
                                    </p>
                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-[10px] font-bold" onClick={() => setModalPage(p => Math.max(1, p - 1))} disabled={modalPage === 1}>
                                                Sebelumnya
                                            </Button>
                                            <span className="rounded-lg bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-600">{modalPage} / {totalPages}</span>
                                            <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-[10px] font-bold" onClick={() => setModalPage(p => Math.min(totalPages, p + 1))} disabled={modalPage === totalPages}>
                                                Selanjutnya
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                            const modernContexts = ['PROJECT', 'ATTENTION', 'PENAWARAN', 'SPK', 'JHK', 'DELAY', 'DENDA', 'NILAI_TOKO', 'NILAI_KONTRAKTOR', 'COST_M2'];
                            if (modernContexts.includes(detailModal.context)) {
                                return (
                                    <div className="space-y-4">
                                        {detailModal.subContext && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="-ml-2 rounded-lg text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                                                onClick={() => setDetailModal(prev => ({ ...prev, subContext: '' }))}
                                            >
                                                <ChevronRight className="mr-1 h-4 w-4 rotate-180" /> Kembali ke Ringkasan
                                            </Button>
                                        )}

                                        <div className="grid grid-cols-1 gap-3">
                                            {paginatedData.length === 0 && (
                                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                                                    <p className="text-sm font-bold text-slate-500">Tidak ada data untuk filter ini.</p>
                                                </div>
                                            )}

                                            {paginatedData.map((p: any, i: number) => {
                                                if (detailModal.context === 'NILAI_KONTRAKTOR') {
                                                    return (
                                                        <div key={p.nama_kontraktor || i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                                <div>
                                                                    <p className="text-base font-black text-slate-950">{p.nama_kontraktor || '-'}</p>
                                                                    <p className="mt-1 text-xs font-semibold text-slate-500">{p.tokoCount || 0} toko / ULOK dinilai</p>
                                                                </div>
                                                                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-right">
                                                                    <p className="text-[10px] font-black uppercase text-emerald-700">Rata-rata</p>
                                                                    <p className="text-2xl font-black text-emerald-900">{Number(p.nilai || 0).toFixed(1)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                                                                {(p.stores || []).slice(0, 4).map((st: any, idx: number) => (
                                                                    <div key={`${st.nomor_ulok || idx}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div>
                                                                                <p className="text-sm font-black text-slate-900">{st.nama_toko || '-'}</p>
                                                                                <p className="text-[11px] font-semibold text-slate-500">{st.nomor_ulok || '-'} - {st.cabang || '-'}</p>
                                                                            </div>
                                                                            <Badge className="border-blue-100 bg-blue-50 font-black text-blue-700">{Number(st.nilai || 0).toFixed(1)}</Badge>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                const toko = p.toko || {};
                                                const stage = getProjectStage(p);
                                                const financial = getProjectFinancialSummary(p);
                                                const penaltyInfo = getProjectPenaltyInfo(p);
                                                const lateDays = calculateProjectLateDays(p);
                                                const quality = getStoreQualityScore(opnameItemsMap[toko.id] || []);
                                                const spkArr = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                                                const activeSpk = spkArr.find((s: any) => s.status && !['REJECTED', 'REJECT', 'CANCELLED', 'CANCEL'].includes(String(s.status).toUpperCase())) || spkArr[0];
                                                const hasST = Boolean(getLatestSerahTerima(p));
                                                const areaTerbangun = Number(toko.luas_area_terbangun || toko.luas_terbangun || 0);
                                                const costTerbangun = areaTerbangun > 0 ? Math.round(financial.opname / areaTerbangun) : 0;

                                                let headline = stage;
                                                let headlineValue: React.ReactNode = toko.proyek || '-';
                                                let tone = 'border-slate-200 bg-white';
                                                let badges: React.ReactNode = null;
                                                if (detailModal.context === 'PENAWARAN') {
                                                    headline = 'Nilai Penawaran';
                                                    headlineValue = formatRupiah(financial.penawaran);
                                                    tone = 'border-indigo-100 bg-indigo-50/40';
                                                } else if (detailModal.context === 'SPK') {
                                                    headline = 'Nilai SPK';
                                                    headlineValue = formatRupiah(financial.spk);
                                                    tone = 'border-orange-100 bg-orange-50/40';
                                                } else if (detailModal.context === 'JHK') {
                                                    headline = 'Durasi SPK';
                                                    headlineValue = `${Number(activeSpk?.durasi || 0)} hari`;
                                                    tone = 'border-blue-100 bg-blue-50/40';
                                                } else if (detailModal.context === 'DELAY') {
                                                    headline = 'Keterlambatan';
                                                    headlineValue = `${lateDays} hari`;
                                                    tone = lateDays > 0 ? 'border-red-100 bg-red-50/50' : 'border-emerald-100 bg-emerald-50/40';
                                                } else if (detailModal.context === 'DENDA') {
                                                    headline = 'Nilai Denda';
                                                    headlineValue = formatRupiah(penaltyInfo.amount);
                                                    tone = 'border-rose-100 bg-rose-50/50';
                                                    badges = <Badge className="border-rose-100 bg-white font-black text-rose-700">{penaltyInfo.days} hari</Badge>;
                                                } else if (detailModal.context === 'NILAI_TOKO') {
                                                    headline = 'Nilai Toko';
                                                    headlineValue = `${quality.total.toFixed(1)} poin`;
                                                    tone = 'border-amber-100 bg-amber-50/50';
                                                } else if (detailModal.context === 'COST_M2') {
                                                    headline = 'Cost/m2 Terbangun';
                                                    headlineValue = costTerbangun ? formatRupiah(costTerbangun) : '-';
                                                    tone = costTerbangun > 900000 ? 'border-red-100 bg-red-50/50' : 'border-purple-100 bg-purple-50/40';
                                                    badges = costTerbangun > 900000 ? <Badge className="border-red-100 bg-white font-black text-red-700">Rekomendasi Non-Ruko</Badge> : null;
                                                }

                                                return (
                                                    <div key={toko.id || toko.nomor_ulok || i} className={`rounded-2xl border p-4 shadow-sm ${tone}`}>
                                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <p className="text-base font-black text-slate-950">{toko.nama_toko || '-'}</p>
                                                                    <Badge className="border-slate-200 bg-white font-black text-slate-700">{toko.nomor_ulok || '-'}</Badge>
                                                                    <Badge className="border-blue-100 bg-blue-50 font-black text-blue-700">{stage}</Badge>
                                                                    {badges}
                                                                </div>
                                                                <p className="mt-1 text-xs font-semibold text-slate-500">{toko.cabang || '-'} - {toko.lingkup_pekerjaan || '-'}</p>
                                                            </div>
                                                            <div className="rounded-xl border border-white bg-white/80 px-4 py-3 text-right shadow-xs">
                                                                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{headline}</p>
                                                                <p className="mt-1 text-xl font-black text-slate-950">{headlineValue}</p>
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                                                            <div className="rounded-xl border border-slate-100 bg-white p-3">
                                                                <p className="text-[10px] font-black uppercase text-slate-400">Penawaran</p>
                                                                <p className="mt-1 text-sm font-black text-slate-900">{formatRupiah(financial.penawaran)}</p>
                                                            </div>
                                                            <div className="rounded-xl border border-slate-100 bg-white p-3">
                                                                <p className="text-[10px] font-black uppercase text-slate-400">SPK</p>
                                                                <p className="mt-1 text-sm font-black text-slate-900">{formatRupiah(financial.spk)}</p>
                                                            </div>
                                                            <div className="rounded-xl border border-slate-100 bg-white p-3">
                                                                <p className="text-[10px] font-black uppercase text-slate-400">Denda / Telat</p>
                                                                <p className="mt-1 text-sm font-black text-slate-900">{formatRupiah(penaltyInfo.amount)} <span className="text-[10px] text-slate-400">({lateDays} hari)</span></p>
                                                            </div>
                                                            <div className="rounded-xl border border-slate-100 bg-white p-3">
                                                                <p className="text-[10px] font-black uppercase text-slate-400">Serah Terima</p>
                                                                <div className="mt-1 flex items-center justify-between gap-2">
                                                                    <p className="text-sm font-black text-slate-900">{hasST ? 'Ada' : 'Belum'}</p>
                                                                    {hasST && (
                                                                        <Button variant="outline" className="h-7 rounded-md px-2 text-[10px] font-bold" onClick={() => handleOpenSerahTerima(p)}>
                                                                            <ExternalLink className="mr-1 h-3 w-3" /> ST
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {detailModal.context === 'NILAI_TOKO' && (
                                                            <div className="mt-3 grid grid-cols-3 gap-2">
                                                                {[
                                                                    ['Desain', quality.desain, 30],
                                                                    ['Kualitas', quality.kualitas, 35],
                                                                    ['Spesifikasi', quality.spesifikasi, 35],
                                                                ].map(([label, value, max]) => (
                                                                    <div key={String(label)} className="rounded-xl border border-amber-100 bg-white p-3">
                                                                        <p className="text-[10px] font-black uppercase text-amber-700">{label}</p>
                                                                        <p className="mt-1 text-sm font-black text-slate-950">{Number(value).toFixed(1)} <span className="text-[10px] text-slate-400">/ {max}</span></p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {renderModalPagination()}
                                    </div>
                                );
                            }

                            return (
                                <div className="space-y-3">
                                    {detailModal.subContext && (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="mb-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 -ml-2"
                                            onClick={() => setDetailModal(prev => ({ ...prev, subContext: '' }))}
                                        >
                                            <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Kembali ke Ringkasan
                                        </Button>
                                    )}
                                    
                                    <div className="bg-white rounded-2xl border border-slate-300 overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse table-fixed">
                                            <thead className="bg-slate-50 border-b border-slate-300">
                                                <tr>
                                                    <th className={`px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center border-r border-slate-300 ${detailModal.context === 'NILAI_KONTRAKTOR' ? 'w-1/2' : 'w-1/3'}`}>
                                                        {detailModal.context === 'NILAI_KONTRAKTOR' ? 'Nama Kontraktor' : 'Toko / Ulok'}
                                                    </th>
                                                    {detailModal.context !== 'NILAI_KONTRAKTOR' && (
                                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center border-r border-slate-300 w-1/3">Cabang</th>
                                                    )}
                                                    <th className={`px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center ${detailModal.context === 'NILAI_KONTRAKTOR' ? 'w-1/2' : 'w-1/3'}`}>Informasi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-300">
                                                {paginatedData.map((p, i) => {
                                                    let rTerbuka = 0, rBangunan = 0, rTerbangun = 0;
                                                    
                                                    if (detailModal.context === 'COST_M2') {
                                                        let costTerbuka = 0; let costBangunan = 0; let costTerbangun = 0;
                                                        let luasTerbuka = 0; let luasBangunan = 0; let luasTerbangun = 0;
                                                        let dataSource = "Penawaran (RAB)";

                                                        const rabItemCategoryMap = new Map<number, string>();
                                                        const rabArr = Array.isArray(p.rab) ? p.rab : (p.rab ? [p.rab] : []);
                                                        
                                                        rabArr.forEach((rab: any) => {
                                                            const itemsFromCache = rabItemsMap[rab.id] || [];
                                                            const itemsData = typeof rab.items === 'string' ? JSON.parse(rab.items) : (rab.items || []);
                                                            const itemsFromJson = typeof rab.Item_Details_JSON === 'string' ? JSON.parse(rab.Item_Details_JSON) : (rab.Item_Details_JSON || []);
                                                            const finalItems = itemsFromCache.length > 0 ? itemsFromCache : (itemsData.length > 0 ? itemsData : itemsFromJson);
                                                            finalItems.forEach((item: any) => {
                                                                if (item.id) rabItemCategoryMap.set(item.id, (item.kategori_pekerjaan || item.Kategori_Pekerjaan || '').toUpperCase());
                                                            });
                                                        });

                                                        const latestOpnameFinal = getLatestProjectOpnameFinal(p);
                                                        const opnameFinalItems = latestOpnameFinal?.items || opnameItemsMap[p.toko?.id] || [];
                                                        const useOpnameFinal = !!latestOpnameFinal && opnameFinalItems.length > 0;

                                                        rabArr.forEach((rab: any) => {
                                                            luasTerbuka = Math.max(luasTerbuka, Number(rab.luas_area_terbuka || 0));
                                                            luasBangunan = Math.max(luasBangunan, Number(rab.luas_bangunan || 0));
                                                            luasTerbangun = Math.max(luasTerbangun, Number(rab.luas_terbangun || 0));
                                                            
                                                            if (!useOpnameFinal) {
                                                                costTerbangun += Number(rab.grand_total_final || 0);
                                                                const itemsFromCache = rabItemsMap[rab.id] || [];
                                                                const itemsData = typeof rab.items === 'string' ? JSON.parse(rab.items) : (rab.items || []);
                                                                const itemsFromJson = typeof rab.Item_Details_JSON === 'string' ? JSON.parse(rab.Item_Details_JSON) : (rab.Item_Details_JSON || []);
                                                                const finalItems = itemsFromCache.length > 0 ? itemsFromCache : (itemsData.length > 0 ? itemsData : itemsFromJson);
                                                                
                                                                if (finalItems.length > 0) {
                                                                    finalItems.forEach((item: any) => {
                                                                        const itemTotal = Number(item.total_harga || (item.volume * (item.harga_material + item.harga_upah)) || 0);
                                                                        const kat = (item.kategori_pekerjaan || item.Kategori_Pekerjaan || '').toUpperCase();
                                                                        if (kat === 'PEKERJAAN AREA TERBUKA') {
                                                                            costTerbuka += itemTotal;
                                                                        } else {
                                                                            costBangunan += itemTotal;
                                                                        }
                                                                    });
                                                                } else {
                                                                    costBangunan += Number(rab.grand_total_final || 0);
                                                                }
                                                            }
                                                        });

                                                        if (useOpnameFinal) {
                                                            dataSource = "Opname";
                                                            costTerbangun = Number(latestOpnameFinal.grand_total_opname || 0);
                                                            opnameFinalItems.forEach((oItem: any) => {
                                                                const itemTotal = Number(oItem.total_harga_opname || 0);
                                                                const kat = rabItemCategoryMap.get(oItem.id_rab_item) || '';
                                                                if (kat === 'PEKERJAAN AREA TERBUKA') {
                                                                    costTerbuka += itemTotal;
                                                                } else {
                                                                    costBangunan += itemTotal;
                                                                }
                                                            });
                                                        }
                                                        
                                                        rTerbuka = luasTerbuka > 0 && costTerbuka > 0 ? Math.round(costTerbuka / luasTerbuka) : 0;
                                                        rBangunan = luasBangunan > 0 && costBangunan > 0 ? Math.round(costBangunan / luasBangunan) : 0;
                                                        rTerbangun = luasTerbangun > 0 && costTerbangun > 0 ? Math.round(costTerbangun / luasTerbangun) : 0;

                                                        return (
                                                            <React.Fragment key={i}>
                                                                <tr 
                                                                    className={`transition-colors group cursor-pointer ${expandedRow === i ? 'bg-purple-50/30' : 'hover:bg-slate-50/50'}`}
                                                                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                                                                >
                                                                    <td className="px-4 py-3 border-r border-slate-300">
                                                                        <div className="font-bold text-slate-700 text-xs wrap-break-word whitespace-normal">{p.toko?.nama_toko}</div>
                                                                        <div className="text-[10px] font-mono text-red-500 bg-red-50 px-1 rounded inline-block mt-0.5">{p.toko?.nomor_ulok}</div>
                                                                        <div className="mt-1">
                                                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${useOpnameFinal ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                                SUMBER: {dataSource}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-[10px] font-semibold text-slate-500 border-r border-slate-300">{p.toko?.cabang}</td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <div className="text-[11px] font-black text-slate-700 flex items-center justify-end gap-1.5">
                                                                            {formatRupiah(rTerbangun)} <span className="text-[9px] text-slate-400 font-normal">/m²</span>
                                                                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedRow === i ? 'rotate-90' : ''}`} />
                                                                        </div>
                                                                        <div className="text-[9px] text-slate-400 italic mr-6">{p.toko?.lingkup_pekerjaan}</div>
                                                                    </td>
                                                                </tr>
                                                                {expandedRow === i && (
                                                                    <tr className="bg-slate-50/80 border-t border-slate-300 shadow-inner">
                                                                        <td colSpan={3} className="px-4 py-4">
                                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                                <div className="bg-white rounded-xl p-4 border border-purple-200 shadow-sm flex flex-col justify-between">
                                                                                    <div>
                                                                                        <p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider mb-2">Terbangun</p>
                                                                                        <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                                                                                            <span>Total Biaya</span>
                                                                                            <span className="font-semibold text-slate-700">{formatRupiah(costTerbangun)}</span>
                                                                                        </div>
                                                                                        <div className="flex justify-between items-center text-xs text-slate-500 mb-2 pb-2 border-b border-slate-100">
                                                                                            <span>Luas Area</span>
                                                                                            <span className="font-semibold text-slate-700">{luasTerbangun} m²</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-right mt-1">
                                                                                        <p className="text-lg font-black text-purple-700">{formatRupiah(rTerbangun)}</p>
                                                                                        <p className="text-[9px] text-slate-400">/ m²</p>
                                                                                    </div>
                                                                                </div>
                                                                                
                                                                                <div className="bg-white rounded-xl p-4 border border-blue-200 shadow-sm flex flex-col justify-between">
                                                                                    <div>
                                                                                        <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-2">Bangunan</p>
                                                                                        <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                                                                                            <span>Total Biaya</span>
                                                                                            <span className="font-semibold text-slate-700">{formatRupiah(costBangunan)}</span>
                                                                                        </div>
                                                                                        <div className="flex justify-between items-center text-xs text-slate-500 mb-2 pb-2 border-b border-slate-100">
                                                                                            <span>Luas Area</span>
                                                                                            <span className="font-semibold text-slate-700">{luasBangunan} m²</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-right mt-1">
                                                                                        <p className="text-lg font-black text-blue-700">{formatRupiah(rBangunan)}</p>
                                                                                        <p className="text-[9px] text-slate-400">/ m²</p>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm flex flex-col justify-between">
                                                                                    <div>
                                                                                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-2">Terbuka</p>
                                                                                        <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                                                                                            <span>Total Biaya</span>
                                                                                            <span className="font-semibold text-slate-700">{formatRupiah(costTerbuka)}</span>
                                                                                        </div>
                                                                                        <div className="flex justify-between items-center text-xs text-slate-500 mb-2 pb-2 border-b border-slate-100">
                                                                                            <span>Luas Area</span>
                                                                                            <span className="font-semibold text-slate-700">{luasTerbuka} m²</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-right mt-1">
                                                                                        <p className="text-lg font-black text-emerald-700">{formatRupiah(rTerbuka)}</p>
                                                                                        <p className="text-[9px] text-slate-400">/ m²</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    }
                                                    
                                                    if (detailModal.context === 'JHK') {
                                                        const spkArr = Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : []);
                                                        const validSpk = spkArr.find((s: any) => ['APPROVED', 'ACTIVE', 'SPK_APPROVED', 'DISETUJUI', 'AKTIF', 'SELESAI'].includes((s.status || '').toUpperCase())) || spkArr[0];
                                                        
                                                        let jhkTotal = 0, durasi = 0, totalPertambahan = 0, keterlambatan = 0;
                                                        if (validSpk) {
                                                            durasi = Number(validSpk.durasi || 0);
                                                            const pertambahanArr = Array.isArray(validSpk.pertambahan_spk) ? validSpk.pertambahan_spk : [];
                                                            totalPertambahan = pertambahanArr.filter((pt: any) => ['APPROVED', 'DISETUJUI', 'DISETUJUI BM'].includes((pt.status_persetujuan || '').toUpperCase())).reduce((sum: number, pt: any) => sum + Number(pt.pertambahan_hari || 0), 0);
                                                            const totalAllowedDays = durasi + totalPertambahan;
                                                            keterlambatan = calculateProjectLateDays(p);
                                                            jhkTotal = totalAllowedDays + keterlambatan;
                                                        }

                                                        return (
                                                            <React.Fragment key={i}>
                                                                <tr 
                                                                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                                                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                                                                >
                                                                    <td className="px-4 py-3 border-r border-slate-300">
                                                                        <div className="font-bold text-slate-700 text-xs wrap-break-word whitespace-normal">{p.toko?.nama_toko}</div>
                                                                        <div className="text-[10px] font-mono text-red-500 bg-red-50 px-1 rounded inline-block mt-0.5">{p.toko?.nomor_ulok}</div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-[10px] font-semibold text-slate-500 border-r border-slate-300">{p.toko?.cabang}</td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <div className="text-[11px] font-black text-slate-700 flex items-center justify-end gap-1.5">
                                                                            {jhkTotal} <span className="text-[9px] text-slate-400 font-normal">Hari</span>
                                                                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedRow === i ? 'rotate-90' : ''}`} />
                                                                        </div>
                                                                        <div className="text-[9px] text-slate-400 italic mr-6">{p.toko?.lingkup_pekerjaan}</div>
                                                                    </td>
                                                                </tr>
                                                                {expandedRow === i && (
                                                                    <tr className="bg-slate-50 border-t border-slate-300">
                                                                        <td colSpan={3} className="px-4 py-4">
                                                                            <div className="grid grid-cols-3 gap-3">
                                                                                <div className="bg-white rounded-xl p-3 border border-slate-300 text-center shadow-sm">
                                                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Durasi SPK</p>
                                                                                    <p className="text-sm font-black text-slate-800">{durasi}</p>
                                                                                    <p className="text-[9px] text-slate-400 mt-0.5">Hari</p>
                                                                                </div>
                                                                                <div className="bg-white rounded-xl p-3 border border-slate-300 text-center shadow-sm">
                                                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Tambah SPK</p>
                                                                                    <p className="text-sm font-black text-slate-800">{totalPertambahan}</p>
                                                                                    <p className="text-[9px] text-slate-400 mt-0.5">Hari</p>
                                                                                </div>
                                                                                <div className="bg-white rounded-xl p-3 border border-slate-300 text-center shadow-sm">
                                                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Terlambat</p>
                                                                                    <p className="text-sm font-black text-slate-800">{keterlambatan}</p>
                                                                                    <p className="text-[9px] text-slate-400 mt-0.5">Hari</p>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    }

                                                    if (detailModal.context === 'NILAI_TOKO') {
                                                        const opnameItems = opnameItemsMap[p.toko?.id] || [];
                                                        const serahTerima = getLatestSerahTerima(p);
                                                        let p_nilaiDesain = 0, p_nilaiKualitas = 0, p_nilaiSpesifikasi = 0, p_total = 0;
                                                        if (opnameItems.length > 0) {
                                                            const countDesainSesuai = opnameItems.filter((i: any) => i.desain === 'Sesuai').length;
                                                            const countKualitasBaik = opnameItems.filter((i: any) => i.kualitas === 'Baik').length;
                                                            const countSpesifikasiSesuai = opnameItems.filter((i: any) => i.spesifikasi === 'Sesuai').length;
                                            
                                                            p_nilaiDesain = (countDesainSesuai / opnameItems.length) * 30;
                                                            p_nilaiKualitas = (countKualitasBaik / opnameItems.length) * 35;
                                                            p_nilaiSpesifikasi = (countSpesifikasiSesuai / opnameItems.length) * 35;
                                                            p_total = p_nilaiDesain + p_nilaiKualitas + p_nilaiSpesifikasi;
                                                        }

                                                        return (
                                                            <React.Fragment key={i}>
                                                                <tr 
                                                                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                                                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                                                                >
                                                                    <td className="px-4 py-3 border-r border-slate-300">
                                                                        <div className="font-bold text-slate-700 text-xs wrap-break-word whitespace-normal">{p.toko?.nama_toko}</div>
                                                                        <div className="text-[10px] font-mono text-red-500 bg-red-50 px-1 rounded inline-block mt-0.5">{p.toko?.nomor_ulok}</div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-[10px] font-semibold text-slate-500 border-r border-slate-300">{p.toko?.cabang}</td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <div className="text-[11px] font-black text-slate-700 flex items-center justify-end gap-1.5">
                                                                            {p_total.toFixed(1)} <span className="text-[9px] text-slate-400 font-normal">Poin</span>
                                                                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedRow === i ? 'rotate-90' : ''}`} />
                                                                        </div>
                                                                        <div className="mt-2 flex items-center justify-end gap-2">
                                                                            <span className="text-[9px] text-slate-400 italic">{p.toko?.lingkup_pekerjaan}</span>
                                                                            {serahTerima ? (
                                                                                <Button
                                                                                    variant="outline"
                                                                                    className="h-7 rounded-md px-2 text-[10px] font-bold bg-white"
                                                                                    onClick={(event) => {
                                                                                        event.stopPropagation();
                                                                                        handleOpenSerahTerima(p);
                                                                                    }}
                                                                                >
                                                                                    <ExternalLink className="w-3 h-3 mr-1" /> Lihat ST
                                                                                </Button>
                                                                            ) : (
                                                                                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-400">Belum ST</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                                {expandedRow === i && (
                                                                    <tr className="bg-slate-50 border-t border-slate-300">
                                                                        <td colSpan={3} className="px-4 py-4">
                                                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                                                <div className="bg-white rounded-xl p-3 border border-slate-300 text-center shadow-sm">
                                                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Desain</p>
                                                                                    <p className="text-sm font-black text-slate-800">{p_nilaiDesain.toFixed(1)} <span className="text-[9px] text-slate-400 font-normal">/ 30</span></p>
                                                                                </div>
                                                                                <div className="bg-white rounded-xl p-3 border border-slate-200 text-center shadow-sm">
                                                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Kualitas</p>
                                                                                    <p className="text-sm font-black text-slate-800">{p_nilaiKualitas.toFixed(1)} <span className="text-[9px] text-slate-400 font-normal">/ 35</span></p>
                                                                                </div>
                                                                                <div className="bg-white rounded-xl p-3 border border-slate-200 text-center shadow-sm">
                                                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Spesifikasi</p>
                                                                                    <p className="text-sm font-black text-slate-800">{p_nilaiSpesifikasi.toFixed(1)} <span className="text-[9px] text-slate-400 font-normal">/ 35</span></p>
                                                                                </div>
                                                                                <div className="bg-white rounded-xl p-3 border border-amber-200 text-center shadow-sm">
                                                                                    <p className="text-[10px] text-amber-600 uppercase tracking-wider mb-1">Serah Terima</p>
                                                                                    <p className="text-sm font-black text-slate-800">{serahTerima ? 'Tersedia' : 'Belum Ada'}</p>
                                                                                    {serahTerima?.created_at && <p className="text-[9px] text-slate-400 mt-0.5">{new Date(serahTerima.created_at).toLocaleDateString('id-ID')}</p>}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    }

                                                    if (detailModal.context === 'NILAI_KONTRAKTOR') {
                                                        const pK = p as any;
                                                        return (
                                                            <React.Fragment key={i}>
                                                                <tr 
                                                                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                                                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                                                                >
                                                                    <td className="px-4 py-3 border-r border-slate-300">
                                                                        <div className="font-bold text-slate-700 text-xs wrap-break-word whitespace-normal">{pK.nama_kontraktor}</div>
                                                                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{pK.tokoCount} Toko / Ulok</div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <div className="text-[11px] font-black text-slate-700 flex items-center justify-end gap-1.5">
                                                                            {pK.nilai.toFixed(1)} <span className="text-[9px] text-slate-400 font-normal">Poin</span>
                                                                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedRow === i ? 'rotate-90' : ''}`} />
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                                {expandedRow === i && (
                                                                    <tr className="bg-slate-50 border-t border-slate-300">
                                                                        <td colSpan={2} className="px-4 py-4">
                                                                            <div className="space-y-3">
                                                                                {(pK.stores || []).map((st: any, idx: number) => (
                                                                                    <div key={idx} className="bg-white rounded-xl p-3 border border-slate-300 shadow-sm flex items-center justify-between">
                                                                                        <div>
                                                                                            <div className="font-bold text-slate-700 text-xs">{st.nama_toko}</div>
                                                                                            <div className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-2">
                                                                                                <span>{st.nomor_ulok}</span>
                                                                                                <span>•</span>
                                                                                                <span>{st.cabang}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="text-right">
                                                                                            <div className="text-sm font-black text-slate-800">{st.nilai.toFixed(1)} <span className="text-[9px] text-slate-400 font-normal">/ 100</span></div>
                                                                                            <div className="text-[8px] text-slate-400 flex items-center gap-1.5 mt-0.5 justify-end">
                                                                                                <span>Des: {st.desain.toFixed(1)}</span>
                                                                                                <span>Kual: {st.kualitas.toFixed(1)}</span>
                                                                                                <span>Spes: {st.spesifikasi.toFixed(1)}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    }

                                                    if (detailModal.context === 'BEANSPOT') {
                                                        const pB = p as any;
                                                        return (
                                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                                                <td className="px-4 py-3 border-r border-slate-300">
                                                                    <div className="font-bold text-slate-700 text-xs wrap-break-word whitespace-normal">{pB.nama_toko}</div>
                                                                    <div className="text-[10px] font-mono text-red-500 bg-red-50 px-1 rounded inline-block mt-0.5">{pB.nomor_ulok}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-[10px] font-semibold text-slate-500 border-r border-slate-300">{pB.cabang}</td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <div className="text-[11px] font-black text-slate-700">{formatRupiah(pB.nominal)}</div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    const penaltyInfo = detailModal.context === 'DENDA' ? getProjectPenaltyInfo(p) : null;

                                                    return (
                                                    <tr
                                                        key={i}
                                                        className={`hover:bg-slate-50/50 transition-colors group ${detailModal.context === 'DENDA' ? 'cursor-pointer' : ''}`}
                                                        onClick={() => {
                                                            if (detailModal.context === 'DENDA') handleOpenPenaltyProject(p);
                                                        }}
                                                        title={detailModal.context === 'DENDA' ? 'Buka sumber data denda' : undefined}
                                                    >
                                                        <td className="px-4 py-3 border-r border-slate-300">
                                                            <div className="font-bold text-slate-700 text-xs wrap-break-word whitespace-normal">{p.toko?.nama_toko}</div>
                                                            <div className="text-[10px] font-mono text-red-500 bg-red-50 px-1 rounded inline-block mt-0.5">{p.toko?.nomor_ulok}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-[10px] font-semibold text-slate-500 border-r border-slate-300">{p.toko?.cabang}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="text-[11px] font-black text-slate-700">
                                                                {detailModal.context === 'PENAWARAN' 
                                                                    ? formatRupiah(parseCurrency(p.rab?.[0]?.grand_total_final))
                                                                    : detailModal.context === 'SPK' 
                                                                        ? formatRupiah((Array.isArray(p.spk) ? p.spk : (p.spk ? [p.spk] : [])).filter((s: any) => s.status && !['REJECTED', 'REJECT', 'CANCELLED', 'CANCEL'].includes(s.status.toUpperCase())).reduce((acc: number, s: any) => acc + parseCurrency(s.grand_total || s.total_harga), 0))
                                                                        : detailModal.context === 'DELAY'
                                                                                ? (() => {
                                                                                    return `${calculateProjectLateDays(p)} Hari`;
                                                                                })()
                                                                            : detailModal.context === 'DENDA'
                                                                                ? (() => {
                                                                                    return formatRupiah(penaltyInfo?.amount ?? 0);
                                                                                })()
                                                                            : p.toko?.proyek
                                                                }
                                                            </div>
                                                            {detailModal.context === 'DENDA' && penaltyInfo ? (
                                                                <div className="mt-1 flex justify-end gap-1.5 text-[9px]">
                                                                    <span className={`rounded px-1.5 py-0.5 font-bold ${penaltyInfo.source === 'Resmi' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                                                        {penaltyInfo.source}
                                                                    </span>
                                                                    <span className="text-slate-400 italic">{penaltyInfo.days} hari</span>
                                                                </div>
                                                            ) : (
                                                                <div className="text-[9px] text-slate-400 italic">{p.toko?.lingkup_pekerjaan}</div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                                {paginatedData.length === 0 && (
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-12 text-center text-xs text-slate-400 italic">
                                                            Tidak ada data untuk ditampilkan
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Controls */}
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                                        <p className="text-[11px] text-slate-400 font-medium">
                                            Menampilkan <span className="text-slate-700 font-bold">{Math.min(modalData.length, (modalPage - 1) * itemsPerPage + 1)} - {Math.min(modalData.length, modalPage * itemsPerPage)}</span> dari <span className="text-slate-700 font-bold">{modalData.length}</span> data
                                        </p>
                                        {totalPages > 1 && (
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 px-3 text-[10px] font-bold border-slate-200"
                                                    onClick={() => setModalPage(p => Math.max(1, p - 1))}
                                                    disabled={modalPage === 1}
                                                >
                                                    Sebelumnya
                                                </Button>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] font-bold text-slate-400">Halaman</span>
                                                    <span className="text-[10px] font-black text-blue-600 px-2 py-1 bg-blue-50 rounded-md border border-blue-100">{modalPage}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">dari {totalPages}</span>
                                                </div>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 px-3 text-[10px] font-bold border-slate-200"
                                                    onClick={() => setModalPage(p => Math.min(totalPages, p + 1))}
                                                    disabled={modalPage === totalPages}
                                                >
                                                    Selanjutnya
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    <div className="px-6 py-4 bg-white border-t border-slate-100 shrink-0">
                        <p className="text-[11px] text-slate-400 font-medium italic">* Data diperbarui secara real-time berdasarkan filter yang aktif</p>
                    </div>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatCard({ 
    title, 
    value, 
    icon, 
    bgColor, 
    textColor, 
    subLabel, 
    valueColor,
    className,
    renderExtra,
    onClick,
    isLoading = false
}: { 
    title: string, 
    value: string | number, 
    icon: React.ReactNode, 
    bgColor: string, 
    textColor: string, 
    subLabel?: string,
    valueColor?: string,
    className?: string,
    renderExtra?: React.ReactNode,
    onClick?: () => void,
    isLoading?: boolean
}) {
    if (isLoading) {
        return (
            <Card className={`overflow-hidden border-none shadow-md bg-white ${className}`}>
                <CardContent className="px-3.5 py-2 flex flex-col md:flex-row md:items-center gap-4 h-23">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-2 w-16 bg-slate-100 animate-pulse rounded" />
                            <div className="h-5 w-24 bg-slate-100 animate-pulse rounded" />
                            <div className="h-2 w-20 bg-slate-100 animate-pulse rounded" />
                        </div>
                    </div>
                    {renderExtra && (
                        <div className="hidden md:block shrink-0 border-l border-slate-100 pl-4">
                            <div className="grid grid-cols-3 gap-1">
                                {[1,2,3,4,5,6].map(i => (
                                    <div key={i} className="w-16 h-8 bg-slate-50 animate-pulse rounded-lg" />
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card 
            onClick={onClick}
            className={`overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer bg-white active:scale-[0.98] ${className}`}
        >
            <CardContent className="px-3.5 py-2 flex flex-col md:flex-row md:items-center gap-4 h-full">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: bgColor, color: textColor }}>
                        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-5.5 h-5.5" }) : icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{title}</p>
                        {value !== undefined && value !== null && value !== '' && (
                            <h3 className="text-lg font-black text-slate-800 truncate" style={{ color: valueColor }}>
                                <AnimatedNumber value={value} isLoading={isLoading} />
                            </h3>
                        )}
                        {subLabel && <p className="text-[9px] font-medium text-slate-500 leading-tight mt-0.5 line-clamp-1">{subLabel}</p>}
                    </div>
                </div>
                {renderExtra && (
                    <div className="shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-1.5 md:pt-0 md:pl-4">
                        {renderExtra}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * A component that animates a numeric value from 0 to the target value.
 */
function AnimatedNumber({ value, isLoading }: { value: string | number, isLoading: boolean }) {
    const numericValue = useMemo(() => {
        if (typeof value === 'number') return value;
        if (!value) return 0;
        // Clean currency prefix before parsing
        const cleaned = typeof value === 'string' ? value.replace(/Rp\s?/g, '') : value;
        return parseCurrency(cleaned);
    }, [value]);

    const [displayValue, setDisplayValue] = useState(0);
    
    const isRupiah = typeof value === 'string' && value.includes('Rp');
    const isHari = typeof value === 'string' && value.includes('Hari');
    const hasDecimals = typeof value === 'string' && value.includes('.') && !isRupiah;
    const decimalPlaces = hasDecimals ? (value.toString().split('.')[1] || '').length : 0;

    useEffect(() => {
        if (isLoading) {
            setDisplayValue(0);
            return;
        }

        const start = 0;
        const end = numericValue;
        const duration = 1200; 
        const startTime = performance.now();

        let animationFrame: number;

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Cubic ease out
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            const current = easeProgress * (end - start) + start;
            setDisplayValue(current);

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            }
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [numericValue, isLoading]);

    if (isLoading) return null;

    if (isRupiah) return <>{formatRupiah(Math.floor(displayValue))}</>;
    if (isHari) return <>{Math.floor(displayValue)} Hari</>;
    if (hasDecimals) return <>{displayValue.toFixed(decimalPlaces)}</>;

    return <>{Math.floor(displayValue)}</>;
}
