"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { hasRegionalManagerRole, hasSuperHumanRole } from '@/lib/constants';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface UserSession {
  email: string;
  cabang: string;
  role: string;
  namaLengkap: string;
  namaPt: string;
  alamatCabang: string;
  /** Array of roles (split by comma & uppercased) */
  roles: string[];
  /** true jika cabang === "HEAD OFFICE" */
  isHO: boolean;
  /** true jika jabatan === "BUILDING & MAINTENANCE SUPER HUMAN" — akses penuh ke semua cabang & aksi */
  isSuperHuman: boolean;
  /** true jika jabatan === "BUILDING & MAINTENANCE REGIONAL MANAGER" */
  isRegionalManager: boolean;
}

interface SessionContextValue {
  user: UserSession | null;
  isLoading: boolean;
  logout: () => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const SessionContext = createContext<SessionContextValue | null>(null);

// ─── Constants ───────────────────────────────────────────────────────────────
/** Routes that do NOT require authentication */
const PUBLIC_PATHS = ['/', '/auth', '/about', '/manual'];

/**
 * ============================================================================
 * [KONFIGURASI BATASAN WAKTU DAN HARI AKSES]
 * ============================================================================
 * Ubah batasan waktu dan hari operasional aplikasi pada fungsi ini.
 * Pengecualian: Super Human mengabaikan aturan ini sepenuhnya.
 */
const OPERATING_START_MINUTES = 6 * 60;
const GENERAL_OPERATING_END_MINUTES = 18 * 60;
const CONTRACTOR_OPERATING_END_MINUTES = 20 * 60;

const isContractorRole = (roles: string[]): boolean =>
  roles.some((role) => role.includes('KONTRAKTOR'));

const getOperatingEndMinutes = (roles: string[]): number =>
  isContractorRole(roles)
    ? CONTRACTOR_OPERATING_END_MINUTES
    : GENERAL_OPERATING_END_MINUTES;

const formatMinutesAsTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

function isWithinOperatingHours(roles: string[]): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  const operatingEndMinutes = getOperatingEndMinutes(roles);

  // 1. BATASAN HARI: Block akses pada hari Sabtu (6) dan Minggu (0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // 2. BATASAN WAKTU: Block akses di luar jam operasional
  return totalMinutes >= OPERATING_START_MINUTES && totalMinutes < operatingEndMinutes;
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTimeBlocked, setIsTimeBlocked] = useState(false);

  const logout = useCallback(() => {
    sessionStorage.clear();
    setUser(null);
    setIsTimeBlocked(false);
    router.push('/');
  }, [router]);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith('/auth')
    );

    if (isPublic) {
      setIsLoading(false);
      setIsTimeBlocked(false);
      return;
    }

    // Read session data
    const authenticated = sessionStorage.getItem('authenticated') === 'true';
    const role = sessionStorage.getItem('userRole') || '';
    const email = sessionStorage.getItem('loggedInUserEmail') || '';
    const cabang = sessionStorage.getItem('loggedInUserCabang') || '';
    const namaLengkap =
      sessionStorage.getItem('nama_lengkap') || email.split('@')[0];
    const namaPt = sessionStorage.getItem('nama_pt') || '';
    const alamatCabang = sessionStorage.getItem('alamat_cabang') || '';

    // If not authenticated → redirect to login
    if (!authenticated || !role) {
      router.push('/auth');
      return;
    }

    const isHO = cabang.trim().toUpperCase() === 'HEAD OFFICE';
    const roles = role
      .split(',')
      .map((r: string) => r.trim().toUpperCase())
      .filter(Boolean);

    const isSuperHuman = hasSuperHumanRole(roles);
    const isRegionalManager = hasRegionalManagerRole(roles);

    const sessionUser: UserSession = {
      email,
      cabang,
      role,
      namaLengkap,
      namaPt,
      alamatCabang,
      roles,
      isHO,
      isSuperHuman,
      isRegionalManager,
    };

    setUser(sessionUser);

    // Time restriction: only Super Human is always allowed.
    if (!isSuperHuman && !isWithinOperatingHours(roles)) {
      setIsTimeBlocked(true);
    } else {
      setIsTimeBlocked(false);
    }

    setIsLoading(false);
  }, [pathname, router]);

  // Show time-blocked screen instead of children
  if (!isLoading && isTimeBlocked && user) {
    return <TimeBlockedScreen user={user} onLogout={logout} />;
  }

  return (
    <SessionContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession() must be called inside <SessionProvider>');
  }
  return ctx;
}

// ─── Time Blocked UI ─────────────────────────────────────────────────────────
function TimeBlockedScreen({
  user,
  onLogout,
}: {
  user: UserSession;
  onLogout: () => void;
}) {
  const now = new Date();
  const operatingHoursLabel = `${formatMinutesAsTime(OPERATING_START_MINUTES)} - ${formatMinutesAsTime(getOperatingEndMinutes(user.roles))}`;
  const currentTime = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily:
          "var(--font-sans, 'Inter', system-ui, -apple-system, sans-serif)",
      }}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: '420px',
          width: '100%',
        }}
      >
        {/* Clock Icon */}
        <div
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            background: 'rgba(239,68,68,0.12)',
            border: '2px solid rgba(239,68,68,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.75rem',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            fill="none"
            viewBox="0 0 24 24"
            stroke="rgba(248,113,113,1)"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
            />
          </svg>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: '#f1f5f9',
            marginBottom: '0.5rem',
            letterSpacing: '-0.025em',
          }}
        >
          Akses Terbatas
        </h1>

        <p style={{ color: '#94a3b8', marginBottom: '0.25rem', fontSize: '0.9375rem' }}>
          Halo,{' '}
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
            {user.namaLengkap}
          </span>{' '}
          ({user.cabang})
        </p>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
          Aplikasi SPARTA Building hanya dapat diakses pada jam operasional.
        </p>

        {/* Time Box */}
        <div
          style={{
            background: 'rgba(15,23,42,0.8)',
            border: '1px solid rgba(71,85,105,0.5)',
            borderRadius: '1rem',
            padding: '1.5rem 2rem',
            marginBottom: '1.25rem',
            backdropFilter: 'blur(12px)',
          }}
        >
          <p
            style={{
              color: '#f87171',
              fontFamily: "'Geist Mono', 'Courier New', monospace",
              fontSize: '2.75rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              marginBottom: '0.25rem',
            }}
          >
            {operatingHoursLabel}
          </p>
          <p style={{ color: '#475569', fontSize: '0.75rem' }}>
            Senin – Jumat &nbsp;|&nbsp; WIB
          </p>
        </div>

        {/* Current time */}
        <p style={{ color: '#475569', fontSize: '0.8125rem', marginBottom: '2rem' }}>
          Waktu saat ini:{' '}
          <span
            style={{
              color: '#94a3b8',
              fontFamily: "'Geist Mono', 'Courier New', monospace",
              fontWeight: 600,
            }}
          >
            {currentTime}
          </span>{' '}
          WIB
        </p>

        {/* Logout button */}
        <button
          onClick={onLogout}
          style={{
            padding: '0.75rem 2rem',
            background: 'rgba(51,65,85,0.8)',
            color: '#e2e8f0',
            border: '1px solid rgba(71,85,105,0.5)',
            borderRadius: '0.75rem',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) =>
            ((e.target as HTMLButtonElement).style.background = 'rgba(71,85,105,0.9)')
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLButtonElement).style.background = 'rgba(51,65,85,0.8)')
          }
        >
          Keluar
        </button>
      </div>
    </div>
  );
}
