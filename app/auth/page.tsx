"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, ChevronLeft, Info } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Import base URL dari constants
import {
  API_URL,
  ENERGY_SYSTEM_MANAGER_ROLE,
  GENERAL_MANAGER_ROLE,
  REGIONAL_MANAGER_ROLE,
  STORE_BRANCH_CONTROLLING_ROLE,
  DIRECTOR_CONTRACTOR_ROLE,
} from '@/lib/constants';
import { fetchUserCabangList } from '@/lib/api';

// URL Google Apps Script tetap di sini karena spesifik hanya untuk file ini (logging)
const APPS_SCRIPT_POST_URL = "https://script.google.com/macros/s/AKfycbzPubDTa7E2gT5HeVLv9edAcn1xaTiT3J4BtAVYqaqiFAvFtp1qovTXpqpm-VuNOxQJ/exec";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const [otpOpen, setOtpOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpLoginData, setOtpLoginData] = useState<{ email: string; cabang: string } | null>(null);

  // Modal untuk multi-role
  const [roleSelectOpen, setRoleSelectOpen] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [pendingLoginData, setPendingLoginData] = useState<any>(null);

  // Fungsi untuk logging ke Google Apps Script
  const logLoginAttempt = async (username: string, cabang: string, status: string) => {
    const logData = {
      requestType: "loginAttempt",
      username: username,
      cabang: cabang,
      status: status,
    };

    try {
      await fetch(APPS_SCRIPT_POST_URL, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(logData),
      });
    } catch (error) {
      console.error("Failed to log login attempt:", error);
    }
  };

  const normalizeJabatanRole = (jabatan: string) => {
    const upper = String(jabatan || "").toUpperCase().trim();
    if (upper.includes("PROJECT PLANNING") && upper.includes("MANAGER")) return "PROJECT PLANNING & DEVELOPMENT MANAGER";
    if (upper.includes("PP MANAGER")) return "PROJECT PLANNING & DEVELOPMENT MANAGER";
    if (upper.includes("PROJECT PLANNING") || upper.includes("PP SPECIALIST")) return "PROJECT PLANNING & DEVELOPMENT SPECIALIST";
    if (upper.includes("ENERGY SYSTEM") && upper.includes("MANAGER")) return ENERGY_SYSTEM_MANAGER_ROLE;
    if (upper.includes("GENERAL MANAGER")) return GENERAL_MANAGER_ROLE;
    if (upper.includes("STORE") && upper.includes("BRANCH CONTROLLING")) return STORE_BRANCH_CONTROLLING_ROLE;
    if (upper.includes("REGIONAL") && upper.includes("MANAGER")) return REGIONAL_MANAGER_ROLE;
    if (upper.includes("BUILDING MAINTENANCE MANAGER") || upper === "BBMM") return "BRANCH BUILDING & MAINTENANCE MANAGER";
    if (upper.includes("BRANCH MANAGER") || upper === "BM") return "BRANCH MANAGER";
    if (upper.includes("DOKUMENTASI") || upper === "BBSD") return "BRANCH BUILDING SUPPORT DOKUMENTASI";
    if (upper.includes("COORDINATOR") || upper === "BBC") return "BRANCH BUILDING COORDINATOR";
    if (upper.includes("SUPPORT") || upper === "BBS") return "BRANCH BUILDING SUPPORT";
    if (upper.includes("KONTRAKTOR") && upper.includes("DIREKTUR")) return DIRECTOR_CONTRACTOR_ROLE;
    if (upper.includes("KONTRAKTOR")) return "KONTRAKTOR";
    if (upper.includes("DIREKTUR")) return DIRECTOR_CONTRACTOR_ROLE;
    return upper;
  };

  const processLoginSuccess = async (result: any, fallbackEmail: string, fallbackCabang: string) => {
    const jabatanFromAPI = String(result?.data?.jabatan || "").toUpperCase().trim();
    const namaLengkapFromAPI = (result?.data?.nama_lengkap || "").trim();
    const cabangFromAPI = (result?.data?.cabang || fallbackCabang).trim();
    const emailFromAPI = (result?.data?.email_sat || fallbackEmail).trim();
    const namaPtFromAPI = (result?.data?.nama_pt || "").trim();

    let mappedRole = normalizeJabatanRole(jabatanFromAPI);
    let sessionCabang = cabangFromAPI;
    let sessionNamaPt = namaPtFromAPI;
    let sessionAlamatCabang = result?.data?.alamat_cabang || "";

    try {
      const userList = await fetchUserCabangList({ email_sat: emailFromAPI });
      
      // Filter list role yang didapat berdasarkan password/cabang yang dimasukkan saat login
      const filteredUsers = userList?.data ? userList.data.filter((u: any) => 
        (u.cabang || "").trim().toUpperCase() === fallbackCabang.trim().toUpperCase()
      ) : [];

      if (filteredUsers.length > 1) {
        setAvailableRoles(filteredUsers);
        setPendingLoginData({ emailFromAPI, cabangFromAPI, namaPtFromAPI, mappedRole, result });
        setIsLoading(false);
        setRoleSelectOpen(true);
        return;
      } else if (filteredUsers.length === 1) {
        const selectedUser = filteredUsers[0];
        const realName = selectedUser.nama_lengkap;
        const realJabatan = selectedUser.jabatan;
        sessionStorage.setItem("nama_lengkap", realName);

        let realMappedRole = normalizeJabatanRole(realJabatan);

        sessionStorage.setItem("userRole", realMappedRole);
        mappedRole = realMappedRole;
        sessionCabang = (selectedUser.cabang || cabangFromAPI).trim();
        sessionNamaPt = (selectedUser.nama_pt || namaPtFromAPI || "").trim();
        sessionAlamatCabang = selectedUser.alamat_cabang || sessionAlamatCabang;
      } else {
        sessionStorage.setItem("nama_lengkap", namaLengkapFromAPI);
        sessionStorage.setItem("userRole", mappedRole);
      }
    } catch (e) {
      console.error("Gagal mengecek multi-role", e);
      sessionStorage.setItem("nama_lengkap", namaLengkapFromAPI);
      sessionStorage.setItem("userRole", mappedRole);
    }

    setMessage({ text: "Login berhasil! Mengalihkan...", type: "success" });

    sessionStorage.setItem("authenticated", "true");
    sessionStorage.setItem("loggedInUserEmail", emailFromAPI);
    sessionStorage.setItem("loggedInUserCabang", sessionCabang);
    sessionStorage.setItem("nama_pt", sessionNamaPt);
    sessionStorage.setItem("alamat_cabang", sessionAlamatCabang);

    setIsLoading(false);
    setTimeout(() => {
      router.push("/dashboard");
    }, 900);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // JIKA ADA SESI MAINTENANCE, KECUALI HEAD OFFICE //
    // if (password.trim().toUpperCase() !== "HEAD OFFICE") {
    //   setAlertMessage("Mohon maaf, sistem sedang dalam masa maintenance. Silakan coba beberapa saat lagi.");
    //   setAlertOpen(true);
    //   return;
    // }
    // SESI MAINTENANCE //

    setIsLoading(true);
    setMessage({ text: "Logging in...", type: "info" });

    try {
      const cleanBaseUrl = API_URL.replace(/\/$/, "");
      const loginEndpoint = `${cleanBaseUrl}/api/auth/login`;

      const response = await fetch(loginEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_sat: email, cabang: password }),
      });

      const result = await response.json();

      if (response.ok) {
        logLoginAttempt(email, password, "Success");

        if (result?.data?.requires_otp) {
          setOtpToken(result.data.otp_token || "");
          setOtpLoginData({
            email: result?.data?.email_sat || email,
            cabang: result?.data?.cabang || password
          });
          setOtpCode("");
          setOtpError("");
          setOtpOpen(true);
          setIsLoading(false);
          setMessage({ text: "OTP sudah dikirim ke email Anda.", type: "info" });
          return;
        }

        await processLoginSuccess(result, email, password);
      } else {
        const errorMessage = result.message ? result.message.toLowerCase() : "";
        let errorText = result.message || "Login gagal!";

        if (errorMessage.includes("not found") || errorMessage.includes("tidak ditemukan")) {
          errorText = "User belum terdaftar";
        } else if (errorMessage.includes("invalid") || errorMessage.includes("salah") || errorMessage.includes("incorrect")) {
          errorText = "Email atau password salah";
        }

        setMessage({ text: errorText, type: "error" });
        logLoginAttempt(email, password, "Failed");
        setIsLoading(false);
      }
    } catch (error) {
      console.error(error);
      logLoginAttempt(email, password, "Failed");
      setMessage({ text: "Gagal terhubung ke server. Silakan coba lagi.", type: "error" });
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpLoginData) return;

    setOtpLoading(true);
    setOtpError("");

    try {
      const cleanBaseUrl = API_URL.replace(/\/$/, "");
      const verifyEndpoint = `${cleanBaseUrl}/api/auth/verify-otp`;

      const response = await fetch(verifyEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_sat: otpLoginData.email,
          cabang: otpLoginData.cabang,
          otp_token: otpToken,
          otp_code: otpCode
        })
      });

      const result = await response.json();

      if (response.ok) {
        setOtpOpen(false);
        setOtpCode("");
        setOtpToken("");
        setOtpLoginData(null);
        setOtpLoading(false);
        await processLoginSuccess(result, otpLoginData.email, otpLoginData.cabang);
        return;
      }

      setOtpError(result.message || "OTP tidak valid.");
      setOtpLoading(false);
    } catch (error) {
      console.error(error);
      setOtpError("Gagal verifikasi OTP. Silakan coba lagi.");
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
      <Card className="w-full max-w-100 p-2 md:p-4 shadow-xl border-0 md:border md:border-slate-200">
        <CardHeader className="relative pb-2 text-center">
          {/* Tombol Kembali */}
          <Link 
            href="/" 
            className="absolute left-6 top-6 flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Kembali</span>
          </Link>
          
          <div className="flex flex-col items-center mt-6">
            <img 
              src="/assets/Alfamart-Emblem.png" 
              alt="Logo Alfamart" 
              className="h-12 mb-4 object-contain"
            />
            <CardTitle className="text-xl md:text-2xl font-bold text-slate-800">
              SPARTA Building
            </CardTitle>
            <h3 className="mt-2 text-base font-semibold text-slate-600">Login</h3>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5 mt-4">
            {/* Input Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-600 font-medium">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="Masukkan email Anda" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>

            {/* Input Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-600 font-medium">Password (Cabang)</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Masukkan kata sandi Anda" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value.toUpperCase())}
                  className="h-11 pr-10 tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Tombol Submit */}
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-11 text-base font-semibold bg-[#005a9e] hover:bg-[#004a80] transition-transform active:scale-[0.98]"
            >
              {isLoading ? "Memproses..." : "Login"}
            </Button>

            {/* Pesan Alert */}
            {message.text && (
              <p className={`text-center text-sm font-medium mt-4 p-2 rounded-md ${
                message.type === 'success' ? 'bg-green-100 text-green-700' : 
                message.type === 'error' ? 'bg-red-100 text-red-600' : 
                'bg-blue-50 text-blue-600'
              }`}>
                {message.text}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* MODAL / ALERT MAINTENANCE */}
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent className="text-center rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <div className="mx-auto bg-red-100 text-red-600 w-16 h-16 flex items-center justify-center rounded-full mb-4">
              <Info className="w-8 h-8" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-center">Informasi</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base text-slate-600">
              {alertMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white px-8 rounded-lg w-full">
              Tutup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL OTP HEAD OFFICE */}
      <AlertDialog open={otpOpen} onOpenChange={setOtpOpen}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-800">Verifikasi OTP</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600">
              Masukkan kode OTP yang dikirim ke email Anda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 mt-4">
            <Label htmlFor="otpCode" className="text-slate-600 font-medium">Kode OTP</Label>
            <Input
              id="otpCode"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="6 digit"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              className="h-11 tracking-widest text-center"
            />
            {otpError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md p-2">{otpError}</p>
            )}
          </div>
          <AlertDialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setOtpOpen(false)}
              disabled={otpLoading}
            >
              Batal
            </Button>
            <Button
              onClick={handleVerifyOtp}
              disabled={otpLoading || otpCode.length !== 6}
              className="bg-[#005a9e] hover:bg-[#004a80]"
            >
              {otpLoading ? "Memverifikasi..." : "Verifikasi"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL PILIH ROLE JIKA EMAIL SAMA */}
      <AlertDialog open={roleSelectOpen} onOpenChange={setRoleSelectOpen}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-800">Pilih Akun Pengguna</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600">
              Ditemukan beberapa akun dengan email ini. Silakan pilih Anda ingin login sebagai siapa:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 mt-4">
            {availableRoles.map((role, idx) => (
              <Button 
                key={idx}
                variant="outline"
                className="w-full justify-start h-auto py-3 px-4 border-slate-200 hover:bg-blue-50 hover:border-blue-300"
                onClick={() => {
                  let realMappedRole = normalizeJabatanRole(role.jabatan);

                  sessionStorage.setItem("authenticated", "true");
                  sessionStorage.setItem("loggedInUserEmail", role.email_sat || pendingLoginData.emailFromAPI);
                  sessionStorage.setItem("loggedInUserCabang", (role.cabang || pendingLoginData.cabangFromAPI || "").trim()); 
                  sessionStorage.setItem("nama_pt", (role.nama_pt || "").trim());
                  sessionStorage.setItem("alamat_cabang", role.alamat_cabang || pendingLoginData.result?.data?.alamat_cabang || "");
                  
                  // Set nama dan role yang dipilih
                  sessionStorage.setItem("nama_lengkap", role.nama_lengkap);
                  sessionStorage.setItem("userRole", realMappedRole);

                  setRoleSelectOpen(false);
                  setMessage({ text: "Login berhasil! Mengalihkan...", type: "success" });
                  setTimeout(() => {
                    router.push("/dashboard"); 
                  }, 500);
                }}
              >
                <div className="text-left flex-col items-start gap-1">
                  <div className="font-bold text-slate-800">{role.nama_lengkap}</div>
                  <div className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded inline-block mt-1">
                    {role.jabatan}
                  </div>
                </div>
              </Button>
            ))}
          </div>
          <AlertDialogFooter className="mt-6">
            <Button variant="ghost" onClick={() => {
              setRoleSelectOpen(false);
              setPendingLoginData(null);
            }}>
              Batal
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
