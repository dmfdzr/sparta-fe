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
import { API_URL } from '@/lib/constants';

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Pengecekan maintenance sistem
    if (password.trim().toUpperCase() !== "HEAD OFFICE") {
      setAlertMessage("Mohon maaf, sistem sedang dalam masa maintenance. Silakan coba beberapa saat lagi.");
      setAlertOpen(true);
      return;
    }

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

        // 1. Tangkap data dari response API
        const rawJabatan = 
          result?.data?.jabatan || 
          result.jabatan || 
          result?.user?.jabatan || 
          result?.data?.role ||
          result.role;
        
        // 1. Tangkap data dari response API
        const jabatanFromAPI = String(result?.data?.jabatan || "").toUpperCase().trim();
        const namaLengkapFromAPI = result?.data?.nama_lengkap || "";
        const cabangFromAPI = result?.data?.cabang || password; 
        const emailFromAPI = result?.data?.email_sat || email;
        const namaPtFromAPI = result?.data?.nama_pt || "";

        // 2. FUNGSI PEMETAAN (MAPPING) JABATAN
        let mappedRole = jabatanFromAPI;

        if (jabatanFromAPI.includes("BUILDING MAINTENANCE MANAGER") || jabatanFromAPI === "BBMM") {
            mappedRole = "BRANCH BUILDING & MAINTENANCE MANAGER";
        }
        else if (jabatanFromAPI.includes("BRANCH MANAGER") || jabatanFromAPI === "BM") {
            mappedRole = "BRANCH MANAGER";
        } 
        else if (jabatanFromAPI.includes("DOKUMENTASI") || jabatanFromAPI === "BBSD") {
            mappedRole = "BRANCH BUILDING SUPPORT DOKUMENTASI";
        }
        else if (jabatanFromAPI.includes("COORDINATOR") || jabatanFromAPI === "BBC") {
            mappedRole = "BRANCH BUILDING COORDINATOR";
        }
        else if (jabatanFromAPI.includes("SUPPORT") || jabatanFromAPI === "BBS") {
            mappedRole = "BRANCH BUILDING SUPPORT";
        }
        else if (jabatanFromAPI.includes("KONTRAKTOR") && jabatanFromAPI.includes("DIREKTUR")) {
            mappedRole = "DIREKTUR, KONTRAKTOR";
        }
        else if (jabatanFromAPI.includes("KONTRAKTOR")) {
            mappedRole = "KONTRAKTOR";
        }
        else if (jabatanFromAPI.includes("DIREKTUR")) {
            mappedRole = "DIREKTUR";
        }

        setMessage({ text: "Login berhasil! Mengalihkan...", type: "success" });

        // 3. Simpan data yang komplit ke sessionStorage
        sessionStorage.setItem("authenticated", "true");
        sessionStorage.setItem("loggedInUserEmail", emailFromAPI);
        sessionStorage.setItem("loggedInUserCabang", cabangFromAPI); 
        sessionStorage.setItem("userRole", mappedRole);
        sessionStorage.setItem("nama_lengkap", namaLengkapFromAPI);
        sessionStorage.setItem("nama_pt", namaPtFromAPI);
        sessionStorage.setItem("alamat_cabang", result?.data?.alamat_cabang || "");

        setTimeout(() => {
          router.push("/dashboard"); 
        }, 900);

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

    </div>
  );
}