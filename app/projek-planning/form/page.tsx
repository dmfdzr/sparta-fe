"use client"
import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Send, Loader2, ChevronDown, Building2, Droplets, Wind, Zap, ClipboardList, FileText } from "lucide-react";
import { fetchTokoList, submitProjekPlanning, resubmitProjekPlanning, fetchProjekPlanningDetail } from "@/lib/api";
import { getPpRoles, BRANCH_TO_ULOK } from "@/lib/constants";

type TokoOption = { id: number; nomor_ulok: string; nama_toko: string; cabang: string; proyek: string; lingkup_pekerjaan: string; kode_toko: string };

const JENIS_OPTIONS = ["DRIVE THRU", "BEAN SPOT", "FASADE", "HEAD TO HEAD", "LAINNYA"];

function FormProjekPlanningInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resubmitId = searchParams.get("resubmit");
  const [submitting, setSubmitting] = useState(false);
  const [fileFpd, setFileFpd] = useState<File | null>(null);
  const [fileRabSipil, setFileRabSipil] = useState<File | null>(null);
  const [fileRabMe, setFileRabMe] = useState<File | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ title: "", desc: "", type: "" });
  const [tokoList, setTokoList] = useState<TokoOption[]>([]);
  const [tokoSearch, setTokoSearch] = useState("");
  const [showToko, setShowToko] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // Form state
  const [ketentuan, setKetentuan] = useState<string[]>([""]);
  const [catatanDesign, setCatatanDesign] = useState<string[]>([""]);
  const [fasilitas, setFasilitas] = useState<{jenis_fasilitas: string; nama_fasilitas_lainnya?: string; is_tersedia: boolean; keterangan?: string}[]>([
    { jenis_fasilitas: "AIR_BERSIH", is_tersedia: false, keterangan: "" },
    { jenis_fasilitas: "DRAINASE", is_tersedia: false, keterangan: "" },
    { jenis_fasilitas: "AC", is_tersedia: false, keterangan: "" },
    { jenis_fasilitas: "LAINNYA", nama_fasilitas_lainnya: "", is_tersedia: false, keterangan: "" }
  ]);

  const [f, setF] = useState({
    id_toko: 0, nomor_ulok: "", lingkup_pekerjaan: "", jenis_proyek: "",
    nama_pengaju: "", nama_lokasi: "", jenis_pengajuan: "", jenis_pengajuan_lainnya: "",
    estimasi_biaya: "", keterangan: "", link_fpd: "",
    link_gambar_rab_sipil: "", link_gambar_rab_me: "",
  });
  const [originalF, setOriginalF] = useState<any>(null);

  const set = (key: string, val: any) => setF(p => ({ ...p, [key]: val }));

  useEffect(() => {
    const email = sessionStorage.getItem("loggedInUserEmail") || "";
    if (!email) { router.push("/auth"); return; }
    
    const cabang = sessionStorage.getItem("loggedInUserCabang") || "";
    if (cabang.toUpperCase() === "HEAD OFFICE") {
      router.push("/projek-planning");
      return;
    }

    setUserEmail(email);
    const nama = sessionStorage.getItem("nama_lengkap") || "";
    set("nama_pengaju", nama);
    
    fetchTokoList().then(r => {
      let data = r.data || [];
      const role = sessionStorage.getItem("userRole") || "";
      const cabang = sessionStorage.getItem("loggedInUserCabang") || "";
      const { isPP, isPPMgr } = getPpRoles(role, email);
      
      // Jika BUKAN PP / PP Manager (artinya Coordinator atau BM), WAJIB difilter ke cabangnya sendiri
      if (!isPP && !isPPMgr && cabang) {
        // Cari pemetaan Ulok (Kode Cabang vs Nama Cabang)
        const ulokEntry = Object.entries(BRANCH_TO_ULOK).find(([nama, kode]) => 
          nama === cabang.toUpperCase() || kode === cabang.toUpperCase()
        );
        
        const allowedCabang = [cabang.toUpperCase()];
        if (ulokEntry) {
          allowedCabang.push(ulokEntry[0]); // ex: KLATEN
          allowedCabang.push(ulokEntry[1]); // ex: OZ01
        }

        data = data.filter(t => t.cabang && allowedCabang.includes(t.cabang.toUpperCase()));
      }
      setTokoList(data);
    }).catch(console.error);

    if (resubmitId) {
      fetchProjekPlanningDetail(Number(resubmitId)).then(r => {
        if (r.data && r.data.projek) {
          const p = r.data.projek;
          const merged = { ...f, ...p };
          setF(merged as any);
          setOriginalF(merged);
          setTokoSearch(`${p.nomor_ulok} — ${p.nama_toko || p.nama_lokasi}`);
          
          if (p.ketentuan && p.ketentuan.length > 0) setKetentuan(p.ketentuan.map((k: any) => k.isi_ketentuan || ""));
          if (p.catatan_design && p.catatan_design.length > 0) setCatatanDesign(p.catatan_design.map((c: any) => c.isi_catatan || ""));
          if (p.fasilitas && p.fasilitas.length > 0) {
            setFasilitas(p.fasilitas.map(item => ({
              jenis_fasilitas: item.jenis_fasilitas,
              nama_fasilitas_lainnya: item.nama_fasilitas_lainnya || undefined,
              is_tersedia: item.is_tersedia,
              keterangan: item.keterangan || undefined,
            })));
          }
        }
      });
    }
  }, [router, resubmitId]);

  const selectToko = (t: TokoOption) => {
    setF(p => ({ ...p, id_toko: t.id, nomor_ulok: t.nomor_ulok, nama_lokasi: t.nama_toko, lingkup_pekerjaan: t.lingkup_pekerjaan, jenis_proyek: t.proyek }));
    setTokoSearch(`${t.nomor_ulok} — ${t.nama_toko}`);
    setShowToko(false);
  };

  const filteredToko = tokoList.filter(t =>
    `${t.nomor_ulok} ${t.nama_toko} ${t.cabang}`.toLowerCase().includes(tokoSearch.toLowerCase())
  ).slice(0, 30);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.id_toko) { setAlertMsg({ title: "Error", desc: "Pilih toko terlebih dahulu", type: "error" }); setAlertOpen(true); return; }
    if (!f.jenis_pengajuan) { setAlertMsg({ title: "Error", desc: "Pilih jenis pengajuan", type: "error" }); setAlertOpen(true); return; }
    
    if (resubmitId && originalF) {
      // Cek apakah ada perubahan
      const hasChanges = Object.keys(f).some(key => (f as any)[key] !== originalF[key]) || fileFpd !== null || fileRabSipil !== null || fileRabMe !== null;
      if (!hasChanges) {
        setAlertMsg({ title: "Peringatan", desc: "Silakan ubah minimal satu data / isi form sebelum melakukan resubmit.", type: "error" });
        setAlertOpen(true);
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = { 
        ...f, 
        email_pembuat: userEmail, 
        estimasi_biaya: f.estimasi_biaya ? Number(f.estimasi_biaya) : undefined,
        ketentuan: JSON.stringify(ketentuan.filter(k => k.trim() !== "")),
        catatan_design: JSON.stringify(catatanDesign.filter(c => c.trim() !== "")),
        fasilitas: JSON.stringify(fasilitas.filter(f => f.is_tersedia || f.jenis_fasilitas === "LAINNYA" && f.nama_fasilitas_lainnya?.trim()))
      };
      let res;
      if (resubmitId) {
        res = await resubmitProjekPlanning(Number(resubmitId), payload, fileFpd ?? undefined, fileRabSipil ?? undefined, fileRabMe ?? undefined);
      } else {
        res = await submitProjekPlanning(payload, fileFpd ?? undefined, fileRabSipil ?? undefined, fileRabMe ?? undefined);
      }
      setAlertMsg({ title: "Berhasil!", desc: "Pengajuan FPD berhasil disimpan. Menunggu approval B&M Manager.", type: "success" });
      setAlertOpen(true);
    } catch (err: any) {
      setAlertMsg({ title: "Gagal", desc: err.message || "Terjadi kesalahan", type: "error" });
      setAlertOpen(true);
    }
    setSubmitting(false);
  };

  const SectionTitle = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
    <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
      <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">{icon}</div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <AppNavbar title="Form Pengajuan FPD" showBackButton backHref="/projek-planning" />
      <main className="max-w-3xl mx-auto p-4 md:p-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-red-600" /> Form Pengajuan Data (FPD)
            </CardTitle>
            <p className="text-sm text-slate-500">Pengajuan design dengan fasilitas untuk toko Alfamart</p>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* === SECTION: Pilih Toko === */}
              <SectionTitle icon={<Building2 className="w-4 h-4" />} title="Informasi Toko" />
              <div className="relative">
                <Label className="text-xs font-semibold text-slate-600">Cari Toko (ULOK / Nama) *</Label>
                <Input value={tokoSearch} onChange={e => { setTokoSearch(e.target.value); setShowToko(true); }}
                  onFocus={() => setShowToko(true)} placeholder="Ketik nomor ULOK atau nama toko..." className="mt-1" />
                {showToko && filteredToko.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {filteredToko.map(t => (
                      <button key={t.id} type="button" onClick={() => selectToko(t)}
                        className="w-full text-left px-3 py-2 hover:bg-red-50 text-sm border-b last:border-0 transition-colors">
                        <span className="font-semibold text-slate-700">{t.nomor_ulok}</span>
                        <span className="text-slate-500"> — {t.nama_toko}</span>
                        <span className="text-xs text-slate-400 ml-2">({t.cabang})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {f.id_toko > 0 && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg text-sm">
                  <div><span className="text-slate-500">ULOK:</span> <span className="font-semibold">{f.nomor_ulok}</span></div>
                  <div><span className="text-slate-500">Lokasi:</span> <span className="font-semibold">{f.nama_lokasi}</span></div>
                  <div><span className="text-slate-500">Lingkup:</span> <span className="font-semibold">{f.lingkup_pekerjaan}</span></div>
                  <div><span className="text-slate-500">Proyek:</span> <span className="font-semibold">{f.jenis_proyek}</span></div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-600">Nama Pengaju *</Label>
                  <Input value={f.nama_pengaju} onChange={e => set("nama_pengaju", e.target.value)} required className="mt-1" />
                </div>
              </div>

              {/* === SECTION: Jenis Pengajuan === */}
              <SectionTitle icon={<FileText className="w-4 h-4" />} title="Pengajuan Design Dengan Fasilitas" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {JENIS_OPTIONS.map(j => (
                  <button key={j} type="button" onClick={() => set("jenis_pengajuan", j)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${f.jenis_pengajuan === j ? "bg-red-600 text-white border-red-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-red-300"}`}>
                    {j}
                  </button>
                ))}
              </div>
              {f.jenis_pengajuan === "LAINNYA" && (
                <Input value={f.jenis_pengajuan_lainnya} onChange={e => set("jenis_pengajuan_lainnya", e.target.value)}
                  placeholder="Sebutkan jenis pengajuan lainnya..." className="mt-1" />
              )}

              {/* === SECTION: Fasilitas === */}
              <SectionTitle icon={<Droplets className="w-4 h-4" />} title="Fasilitas Yang Disediakan" />
              {fasilitas.map((fac, idx) => {
                if (fac.jenis_fasilitas === "LAINNYA") return null;
                const labels: Record<string, string> = { "AIR_BERSIH": "Sumber Air Bersih", "DRAINASE": "Drain Pembuangan Air Kotor", "AC": "AC" };
                const icons: Record<string, any> = { "AIR_BERSIH": <Droplets className="w-3.5 h-3.5" />, "DRAINASE": <Wind className="w-3.5 h-3.5" />, "AC": <Zap className="w-3.5 h-3.5" /> };
                return (
                  <div key={idx} className="p-3 border rounded-lg space-y-2 bg-white">
                    <div className="flex items-center gap-2">
                      <Checkbox id={`fas_${fac.jenis_fasilitas}`} checked={fac.is_tersedia}
                        onCheckedChange={v => {
                          const newF = [...fasilitas];
                          newF[idx].is_tersedia = !!v;
                          setFasilitas(newF);
                        }} />
                      <label htmlFor={`fas_${fac.jenis_fasilitas}`} className="text-sm font-medium flex items-center gap-1.5">
                        {icons[fac.jenis_fasilitas]} {labels[fac.jenis_fasilitas]}
                      </label>
                    </div>
                    {fac.is_tersedia && (
                      <Input placeholder={`Keterangan ${labels[fac.jenis_fasilitas]}...`} value={fac.keterangan || ""}
                        onChange={e => {
                          const newF = [...fasilitas];
                          newF[idx].keterangan = e.target.value;
                          setFasilitas(newF);
                        }} className="text-sm" />
                    )}
                  </div>
                );
              })}
              <div className="p-3 border rounded-lg space-y-2 bg-white">
                <Label className="text-sm font-medium">Fasilitas Lainnya</Label>
                <Input value={fasilitas.find(f => f.jenis_fasilitas === "LAINNYA")?.nama_fasilitas_lainnya || ""} 
                  onChange={e => {
                    const newF = [...fasilitas];
                    const idx = newF.findIndex(f => f.jenis_fasilitas === "LAINNYA");
                    if(idx !== -1) {
                      newF[idx].nama_fasilitas_lainnya = e.target.value;
                      if(e.target.value) newF[idx].is_tersedia = true;
                      else newF[idx].is_tersedia = false;
                      setFasilitas(newF);
                    }
                  }} placeholder="Nama fasilitas lainnya..." />
                {fasilitas.find(f => f.jenis_fasilitas === "LAINNYA")?.nama_fasilitas_lainnya && (
                  <Input value={fasilitas.find(f => f.jenis_fasilitas === "LAINNYA")?.keterangan || ""} 
                    onChange={e => {
                      const newF = [...fasilitas];
                      const idx = newF.findIndex(f => f.jenis_fasilitas === "LAINNYA");
                      if(idx !== -1) {
                        newF[idx].keterangan = e.target.value;
                        setFasilitas(newF);
                      }
                    }} placeholder="Keterangan fasilitas lainnya..." />
                )}
              </div>

              {/* === SECTION: Ketentuan === */}
              <SectionTitle icon={<FileText className="w-4 h-4" />} title="Ketentuan dari Pengelola / Landlord / Pihak Ketiga" />
              {ketentuan.map((k, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Label className="text-xs text-slate-500">Ketentuan {i + 1}</Label>
                    <Input value={k} onChange={e => {
                      const newK = [...ketentuan];
                      newK[i] = e.target.value;
                      setKetentuan(newK);
                    }} placeholder={`Ketentuan ${i + 1}...`} className="mt-1" />
                  </div>
                  {ketentuan.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setKetentuan(ketentuan.filter((_, idx) => idx !== i))} className="mt-5 text-red-500 hover:text-red-700 hover:bg-red-50">
                      Hapus
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setKetentuan([...ketentuan, ""])} className="mt-2 text-xs">
                + Tambah Ketentuan
              </Button>

              {/* === SECTION: Catatan Design === */}
              <SectionTitle icon={<ClipboardList className="w-4 h-4" />} title="Catatan Design (Hasil Ukur & Kondisi Lingkungan)" />
              {catatanDesign.map((c, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Label className="text-xs text-slate-500">Catatan {i + 1}</Label>
                    <Textarea value={c} onChange={e => {
                      const newC = [...catatanDesign];
                      newC[i] = e.target.value;
                      setCatatanDesign(newC);
                    }} placeholder={`Catatan ${i + 1}...`} rows={2} className="mt-1" />
                  </div>
                  {catatanDesign.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCatatanDesign(catatanDesign.filter((_, idx) => idx !== i))} className="mt-5 text-red-500 hover:text-red-700 hover:bg-red-50">
                      Hapus
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setCatatanDesign([...catatanDesign, ""])} className="mt-2 text-xs">
                + Tambah Catatan
              </Button>

              {/* === SECTION: Upload Files === */}
              <SectionTitle icon={<FileText className="w-4 h-4" />} title="Upload Gambar Kerja & RAB (Link / File Lokal)" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-600">Gambar Kerja / Foto Eksisting</Label>
                  <Input placeholder="Link Google Drive..." value={(f as any).link_fpd} onChange={e => { set("link_fpd", e.target.value); setFileFpd(null); }} className="bg-white" disabled={!!fileFpd} />
                  <Input type="file" accept="image/*,.pdf,.dwg" className="mt-1 file:bg-red-50 file:text-red-600 file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3 hover:file:bg-red-100 cursor-pointer" 
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { setFileFpd(file); set("link_fpd", ""); } else { setFileFpd(null); }
                    }} />
                  {fileFpd ? <p className="text-[10px] text-red-600 mt-1">File siap diupload: {fileFpd.name}</p> : <p className="text-[10px] text-slate-400 mt-1">Pilih File (akan diupload ke GDrive) atau Paste Link</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-600">File RAB Sipil</Label>
                  <Input placeholder="Link Google Drive..." value={(f as any).link_gambar_rab_sipil} onChange={e => { set("link_gambar_rab_sipil", e.target.value); setFileRabSipil(null); }} className="bg-white" disabled={!!fileRabSipil} />
                  <Input type="file" accept=".pdf,.xls,.xlsx" className="mt-1 file:bg-blue-50 file:text-blue-600 file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3 hover:file:bg-blue-100 cursor-pointer"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { setFileRabSipil(file); set("link_gambar_rab_sipil", ""); } else { setFileRabSipil(null); }
                    }} />
                  {fileRabSipil && <p className="text-[10px] text-blue-600 mt-1">File siap diupload: {fileRabSipil.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-600">File RAB ME</Label>
                  <Input placeholder="Link Google Drive..." value={(f as any).link_gambar_rab_me} onChange={e => { set("link_gambar_rab_me", e.target.value); setFileRabMe(null); }} className="bg-white" disabled={!!fileRabMe} />
                  <Input type="file" accept=".pdf,.xls,.xlsx" className="mt-1 file:bg-blue-50 file:text-blue-600 file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3 hover:file:bg-blue-100 cursor-pointer"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { setFileRabMe(file); set("link_gambar_rab_me", ""); } else { setFileRabMe(null); }
                    }} />
                  {fileRabMe && <p className="text-[10px] text-blue-600 mt-1">File siap diupload: {fileRabMe.name}</p>}
                </div>
              </div>
              
              <div>
                <Label className="text-xs font-semibold text-slate-600">Keterangan Tambahan</Label>
                <Textarea value={f.keterangan} onChange={e => set("keterangan", e.target.value)}
                  placeholder="Keterangan tambahan..." rows={3} className="mt-1" />
              </div>

              {/* Submit */}
              <Button type="submit" disabled={submitting} className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm gap-2 mt-4">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? "Mengirim..." : "Kirim Pengajuan FPD"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">{alertMsg.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-center">{alertMsg.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction className={`w-full rounded-lg ${alertMsg.type === "success" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
              onClick={() => { if (alertMsg.type === "success") router.push("/projek-planning"); }}>
              {alertMsg.type === "success" ? "Lihat Daftar" : "Tutup"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function FormProjekPlanning() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" /></div>}>
      <FormProjekPlanningInner />
    </Suspense>
  );
}
