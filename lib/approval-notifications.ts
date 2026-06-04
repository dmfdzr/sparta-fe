import type { UserSession } from "@/context/SessionContext";
import {
    BRANCH_GROUPS,
    canViewAllBranches,
    isViewOnlyUser,
} from "@/lib/constants";
import {
    fetchInstruksiLapanganList,
    fetchOpnameFinalList,
    fetchPertambahanSPKList,
    fetchProjekPlanningList,
    fetchRABList,
    fetchSPKList,
    type RABListFilters,
} from "@/lib/api";

export type ApprovalType =
    | "RAB"
    | "SPK"
    | "PERTAMBAHAN_SPK"
    | "OPNAME_FINAL"
    | "INSTRUKSI_LAPANGAN"
    | "PROJECT_PLANNING";

export type ApprovalCounts = Record<ApprovalType, number>;

type ApprovalJabatan = "KOORDINATOR" | "MANAGER" | "DIREKTUR" | "KONTRAKTOR" | null;

type CountableApprovalItem = {
    tipe: ApprovalType;
    status: string;
    cabang?: string | null;
    raw?: any;
};

export const EMPTY_APPROVAL_COUNTS: ApprovalCounts = {
    RAB: 0,
    SPK: 0,
    PERTAMBAHAN_SPK: 0,
    OPNAME_FINAL: 0,
    INSTRUKSI_LAPANGAN: 0,
    PROJECT_PLANNING: 0,
};

const ROLE_ACCESS: Record<ApprovalType, string[]> = {
    RAB: ["BRANCH BUILDING COORDINATOR", "BRANCH BUILDING & MAINTENANCE MANAGER", "DIREKTUR KONTRAKTOR", "DIREKTUR", "COORDINATOR", "MANAGER"],
    SPK: ["BRANCH MANAGER", "MANAGER"],
    PERTAMBAHAN_SPK: ["BRANCH MANAGER", "MANAGER"],
    OPNAME_FINAL: ["BRANCH BUILDING COORDINATOR", "BRANCH BUILDING & MAINTENANCE MANAGER", "DIREKTUR KONTRAKTOR", "DIREKTUR", "COORDINATOR", "MANAGER"],
    INSTRUKSI_LAPANGAN: ["BRANCH BUILDING COORDINATOR", "BRANCH BUILDING & MAINTENANCE MANAGER", "COORDINATOR", "MANAGER"],
    PROJECT_PLANNING: ["BRANCH BUILDING & MAINTENANCE MANAGER", "PROJECT PLANNING & DEVELOPMENT SPECIALIST", "PROJECT PLANNING & DEVELOPMENT MANAGER"],
};

const normalizeBranch = (branch?: string | null) => (branch ?? "").trim().toUpperCase();

const hasDirectorRole = (roles: string[]) =>
    roles.some(role => role === "DIREKTUR" || role === "DIREKTUR KONTRAKTOR" || role.includes("DIREKTUR"));

const isHeadOfficeDirector = (user: UserSession) =>
    normalizeBranch(user.cabang) === "HEAD OFFICE" && hasDirectorRole(user.roles);

const isContractorCompanyScopedRole = (roles: string[]) =>
    roles.some(role => role.includes("KONTRAKTOR"));

const normalizeCompanyName = (value?: string | null) =>
    String(value || "").trim().replace(/\s+/g, " ").toUpperCase();

const isPendingApprovalStatus = (status?: string | null) => {
    const upper = String(status ?? "").trim().toUpperCase();
    return upper.includes("MENUNGGU") || upper.startsWith("PENDING");
};

const isCoordinatorApprovalStatus = (status?: string | null) => {
    const upper = String(status ?? "").trim().toUpperCase();
    return upper.includes("KOORDINATOR");
};

const isManagerApprovalStatus = (status?: string | null) => {
    const upper = String(status ?? "").trim().toUpperCase();
    return upper.includes("MANAGER") || upper.includes("MANAJER");
};

const isDirectorApprovalStatus = (status?: string | null) => {
    const upper = String(status ?? "").trim().toUpperCase();
    return upper.includes("DIREKTUR") || upper.includes("DIR.");
};

const matchesUserCompany = (value: unknown, userCompany?: string | null) => {
    const normalizedUserCompany = normalizeCompanyName(userCompany);
    if (!normalizedUserCompany || !value || typeof value !== "object") return false;

    const source = value as Record<string, any>;
    const candidates = [
        source.nama_pt,
        source.nama_kontraktor,
        source.toko?.nama_pt,
        source.toko?.nama_kontraktor,
    ];

    return candidates.some(candidate => normalizeCompanyName(candidate) === normalizedUserCompany);
};

const getApprovalJabatan = (user: UserSession): ApprovalJabatan => {
    const roles = user.roles;
    if (user.isSuperHuman) return "MANAGER";
    if (roles.some(role => role.includes("DIREKTUR"))) return "DIREKTUR";
    if (roles.includes("KONTRAKTOR")) return "KONTRAKTOR";
    if (roles.includes("BRANCH BUILDING & MAINTENANCE MANAGER") || roles.includes("MANAGER")) return "MANAGER";
    if (roles.includes("BRANCH BUILDING COORDINATOR") || roles.includes("COORDINATOR")) return "KOORDINATOR";
    return null;
};

export const getAccessibleApprovalTypes = (user: UserSession): ApprovalType[] => {
    const roles = user.roles;
    const isHO = normalizeBranch(user.cabang) === "HEAD OFFICE";
    const isDirectorHO = isHeadOfficeDirector(user);
    const isProjectPlanningApprovalRole = roles.some(role =>
        role.includes("PROJECT PLANNING & DEVELOPMENT SPECIALIST") ||
        role.includes("PROJECT PLANNING & DEVELOPMENT MANAGER") ||
        role.includes("PP SPECIALIST") ||
        role.includes("PP MANAGER")
    );

    const allAccessibleTypes = new Set<ApprovalType>();
    if (user.isRegionalManager || user.isSuperHuman) {
        (Object.keys(ROLE_ACCESS) as ApprovalType[]).forEach(type => allAccessibleTypes.add(type));
    } else if (isProjectPlanningApprovalRole && isHO) {
        allAccessibleTypes.add("PROJECT_PLANNING");
    } else if (isDirectorHO) {
        allAccessibleTypes.add("RAB");
        allAccessibleTypes.add("OPNAME_FINAL");
    } else {
        roles.forEach(role => {
            (Object.keys(ROLE_ACCESS) as ApprovalType[]).forEach(type => {
                if (ROLE_ACCESS[type].some(allowedRole => allowedRole.toUpperCase() === role)) {
                    allAccessibleTypes.add(type);
                }
            });
        });
    }

    if (isHO && roles.some(role => ROLE_ACCESS.PROJECT_PLANNING.some(allowedRole => allowedRole.toUpperCase() === role))) {
        allAccessibleTypes.add("PROJECT_PLANNING");
    }

    return Array.from(allAccessibleTypes);
};

const isSameBranchScope = (itemCabang: string | null | undefined, userCabang: string) => {
    if (!userCabang || !itemCabang || itemCabang === "-") return true;

    let userGroup: string[] | null = null;
    for (const group of Object.values(BRANCH_GROUPS)) {
        if (group.includes(userCabang)) {
            userGroup = group;
            break;
        }
    }

    const itemCabangUpper = itemCabang.toUpperCase();
    return userGroup ? userGroup.includes(itemCabangUpper) : itemCabangUpper === userCabang;
};

const isPendingProcessStatus = (status: string, tipe: ApprovalType) => {
    const upper = (status ?? "").toUpperCase();
    if (!upper) return false;
    if (upper === "DRAFT") return false;
    if (upper === "MENUNGGU GANTT CHART") return false;
    if (upper.includes("TOLAK") || upper.includes("DITOLAK") || upper === "REJECTED" || upper === "SPK_REJECTED") return false;
    if (upper.includes("DISETUJUI") || upper === "APPROVED" || upper === "SPK_APPROVED" || upper === "COMPLETED") return false;

    if (tipe === "SPK") return upper === "WAITING_FOR_BM_APPROVAL";
    if (tipe === "PERTAMBAHAN_SPK") return upper === "MENUNGGU PERSETUJUAN";
    if (tipe === "PROJECT_PLANNING") return upper.startsWith("WAITING_") || upper === "PP_DESIGN_3D_REQUIRED";
    return isPendingApprovalStatus(upper);
};

const canCountProjectPlanningForUser = (item: CountableApprovalItem, user: UserSession) => {
    const upper = item.status.toUpperCase();
    const userCabang = normalizeBranch(user.cabang);
    const isHOUser = userCabang === "HEAD OFFICE";
    const canSeeAll = canViewAllBranches(user.roles, user.isSuperHuman);
    const roles = user.roles;
    const raw = item.raw ?? {};

    if (!canSeeAll && !isHOUser) return false;

    const isBmManager = roles.some(role =>
        role.includes("BRANCH BUILDING & MAINTENANCE MANAGER") ||
        role.includes("MAINTENANCE MANAGER") ||
        role.includes("BBMM")
    );
    const isPpSpecialist = roles.some(role =>
        role.includes("PROJECT PLANNING & DEVELOPMENT SPECIALIST") ||
        role.includes("PP SPECIALIST")
    );
    const isPpManager = roles.some(role =>
        role.includes("PROJECT PLANNING & DEVELOPMENT MANAGER") ||
        role.includes("PP MANAGER")
    );

    if (canSeeAll) return true;

    const statusMatchesRole =
        (isBmManager && (upper === "WAITING_BM_APPROVAL" || upper === "WAITING_BM_APPROVAL_2")) ||
        (isPpSpecialist && ["WAITING_PP_APPROVAL_1", "PP_DESIGN_3D_REQUIRED", "WAITING_PP_APPROVAL_2"].includes(upper)) ||
        (isPpManager && (
            upper === "WAITING_PP_MANAGER_APPROVAL" ||
            (upper === "WAITING_RAB_UPLOAD" && !!raw.pp_manager_approver_email)
        ));

    if (!statusMatchesRole) return false;
    if (isHOUser) return normalizeBranch(item.cabang) === userCabang;
    return isSameBranchScope(item.cabang, userCabang);
};

const canCountForUser = (item: CountableApprovalItem, user: UserSession, jabatan: ApprovalJabatan) => {
    if (!isPendingProcessStatus(item.status, item.tipe)) return false;
    if (isViewOnlyUser(user.roles, user.isSuperHuman)) return false;
    if (
        item.tipe === "RAB"
        && isContractorCompanyScopedRole(user.roles)
        && user.namaPt
        && !matchesUserCompany(item.raw, user.namaPt)
    ) return false;

    if (item.tipe === "PROJECT_PLANNING") {
        return canCountProjectPlanningForUser(item, user);
    }

    const upper = item.status.toUpperCase();
    const userCabang = normalizeBranch(user.cabang);
    const isHOUser = userCabang === "HEAD OFFICE";
    const isDirectorHOUser = isHeadOfficeDirector(user);
    const canSeeAll = canViewAllBranches(user.roles, user.isSuperHuman);

    if (!canSeeAll && !user.isRegionalManager && jabatan !== "DIREKTUR" && item.tipe !== "PERTAMBAHAN_SPK") {
        if (!isSameBranchScope(item.cabang, userCabang)) return false;
    }

    if (canSeeAll || user.isRegionalManager) return true;
    if (item.tipe === "SPK") return upper === "WAITING_FOR_BM_APPROVAL";
    if (item.tipe === "PERTAMBAHAN_SPK") return upper === "MENUNGGU PERSETUJUAN";

    if (item.tipe === "RAB" && jabatan === "DIREKTUR") {
        if (userCabang && !isDirectorHOUser && item.cabang) {
            if (!isSameBranchScope(item.cabang, userCabang)) return false;
        }

        return isDirectorApprovalStatus(upper);
    }

    if (jabatan === "KOORDINATOR") return isCoordinatorApprovalStatus(upper);
    if (jabatan === "MANAGER") return isManagerApprovalStatus(upper);
    if (jabatan === "DIREKTUR") return isDirectorApprovalStatus(upper);
    if (jabatan === "KONTRAKTOR") return upper.includes("KONTRAKTOR");
    return true;
};

const countItems = (items: CountableApprovalItem[], user: UserSession, jabatan: ApprovalJabatan) =>
    items.filter(item => canCountForUser(item, user, jabatan)).length;

export const fetchApprovalNotificationCounts = async (user: UserSession): Promise<ApprovalCounts> => {
    const accessibleTypes = getAccessibleApprovalTypes(user);
    const jabatan = getApprovalJabatan(user);
    const counts = { ...EMPTY_APPROVAL_COUNTS };

    for (const type of accessibleTypes) {
        try {
            if (type === "RAB") {
                const filters: RABListFilters | undefined = isContractorCompanyScopedRole(user.roles) && user.namaPt
                    ? { nama_pt: user.namaPt }
                    : undefined;
                const res = await fetchRABList(filters, { suppressGlobalError: true });
                counts.RAB = countItems((res.data ?? []).map(item => ({
                    tipe: "RAB",
                    status: item.status,
                    cabang: item.cabang ?? item.toko?.cabang,
                    raw: item,
                })), user, jabatan);
            } else if (type === "SPK") {
                const res = await fetchSPKList({ status: "WAITING_FOR_BM_APPROVAL" }, { suppressGlobalError: true });
                counts.SPK = countItems((res.data ?? []).map((item: any) => ({
                    tipe: "SPK",
                    status: item.status,
                    cabang: item.toko?.cabang ?? item.cabang,
                    raw: item,
                })), user, jabatan);
            } else if (type === "PERTAMBAHAN_SPK") {
                const res = await fetchPertambahanSPKList({ status_persetujuan: "Menunggu Persetujuan" }, { suppressGlobalError: true });
                counts.PERTAMBAHAN_SPK = countItems((res.data ?? []).map((item: any) => ({
                    tipe: "PERTAMBAHAN_SPK",
                    status: item.status_persetujuan,
                    cabang: item.toko?.cabang,
                    raw: item,
                })), user, jabatan);
            } else if (type === "OPNAME_FINAL") {
                const res = await fetchOpnameFinalList({ aksi: "terkunci" }, { suppressGlobalError: true });
                const rows = Array.isArray(res.data)
                    ? res.data
                    : Array.isArray((res.data as any)?.opname_final)
                        ? (res.data as any).opname_final
                        : [];
                counts.OPNAME_FINAL = countItems(rows.map((item: any) => ({
                    tipe: "OPNAME_FINAL",
                    status: item.status_opname_final,
                    cabang: item.cabang ?? item.toko?.cabang,
                    raw: item,
                })), user, jabatan);
            } else if (type === "INSTRUKSI_LAPANGAN") {
                const res = await fetchInstruksiLapanganList(undefined, { suppressGlobalError: true });
                counts.INSTRUKSI_LAPANGAN = countItems((res.data ?? []).map((item: any) => ({
                    tipe: "INSTRUKSI_LAPANGAN",
                    status: item.status,
                    cabang: item.cabang,
                    raw: item,
                })), user, jabatan);
            } else if (type === "PROJECT_PLANNING") {
                const res = await fetchProjekPlanningList(undefined, { suppressGlobalError: true });
                counts.PROJECT_PLANNING = countItems((res.data ?? []).map((item: any) => ({
                    tipe: "PROJECT_PLANNING",
                    status: item.status,
                    cabang: item.cabang,
                    raw: item,
                })), user, jabatan);
            }
        } catch (error) {
            console.warn(`Gagal memuat notifikasi approval ${type}:`, error);
            counts[type] = 0;
        }
    }

    return counts;
};

export const getApprovalNotificationTotal = (counts: ApprovalCounts, types?: ApprovalType[]) =>
    (types ?? (Object.keys(counts) as ApprovalType[])).reduce((total, type) => total + (counts[type] ?? 0), 0);
