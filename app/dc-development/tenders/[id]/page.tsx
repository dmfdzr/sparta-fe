"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, Send, CheckCircle, UserPlus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/context/SessionContext";
import { 
  fetchDcTenderById, 
  inviteDcTenderParticipant, 
  submitDcTenderSubmission, 
  setDcTenderWinner,
  fetchDcVendors,
  type DcTender, 
  type DcTenderParticipant,
  type DcVendor
} from "@/lib/api";

export default function DcTenderDetailPage() {
  const { id } = useParams() as { id: string };
  const { user } = useSession();
  
  const [tender, setTender] = useState<DcTender | null>(null);
  const [participants, setParticipants] = useState<DcTenderParticipant[]>([]);
  const [vendors, setVendors] = useState<DcVendor[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Invite Vendor Form
  const [inviteVendorId, setInviteVendorId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  // Submit Submission Form
  const [submitParticipantId, setSubmitParticipantId] = useState("");
  const [submissionType, setSubmissionType] = useState("TECHNICAL_AND_COMMERCIAL");
  const [offerAmount, setOfferAmount] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Set Winner
  const [settingWinner, setSettingWinner] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const [tenderRes, vendorsRes] = await Promise.all([
        fetchDcTenderById(Number(id)),
        fetchDcVendors({ suppressGlobalError: true })
      ]);
      setTender(tenderRes.data.tender);
      setParticipants(tenderRes.data.participants);
      setVendors(vendorsRes.data);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Gagal memuat detail tender", 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const formatRupiah = (amount: string | number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(Number(amount));
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteVendorId) return showMessage("Pilih vendor terlebih dahulu", 'error');
    
    setInviting(true);
    try {
      await inviteDcTenderParticipant(Number(id), {
        vendor_company_id: Number(inviteVendorId),
        invited_by_email: inviteEmail || user?.email,
      });
      showMessage("Vendor berhasil diundang", 'success');
      setInviteVendorId("");
      setInviteEmail("");
      loadData(true);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Gagal mengundang vendor", 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitParticipantId) return showMessage("Pilih participant terlebih dahulu", 'error');
    
    setSubmitting(true);
    try {
      await submitDcTenderSubmission(Number(id), {
        participant_id: Number(submitParticipantId),
        submission_type: submissionType,
        submitted_offer_amount: offerAmount ? Number(offerAmount) : undefined,
        notes: submissionNotes,
        submitted_by_email: user?.email,
      });
      showMessage("Penawaran berhasil disubmit", 'success');
      setSubmitParticipantId("");
      setOfferAmount("");
      setSubmissionNotes("");
      loadData(true);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Gagal submit penawaran", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetWinner = async (participantId: number) => {
    if (!confirm("Apakah Anda yakin ingin menetapkan vendor ini sebagai pemenang? Aksi ini tidak dapat dibatalkan dan tender akan selesai.")) return;
    
    setSettingWinner(true);
    try {
      await setDcTenderWinner(Number(id), {
        participant_id: participantId,
        actor_email: user?.email || 'system',
        actor_role: user?.role || 'USER',
      });
      showMessage("Pemenang berhasil ditetapkan", 'success');
      loadData(true);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Gagal menetapkan pemenang", 'error');
    } finally {
      setSettingWinner(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#edf2f6] px-4 py-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </main>
    );
  }

  if (!tender) {
    return (
      <main className="min-h-screen bg-[#edf2f6] px-4 py-6 flex flex-col items-center justify-center gap-4">
        <div className="text-lg font-medium text-slate-700">Tender tidak ditemukan</div>
        <Link href="/dc-development/tenders">
          <Button variant="outline">Kembali ke Daftar</Button>
        </Link>
      </main>
    );
  }

  const isCompleted = tender.status === 'COMPLETED';

  return (
    <main className="min-h-screen bg-[#edf2f6] px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/dc-development/tenders" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Daftar
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-800">{tender.title}</h1>
            <p className="text-sm text-slate-500 mt-1">Project: {tender.project_name} ({tender.project_code})</p>
          </div>
          <Button variant="outline" className="rounded-lg bg-white" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw className={refreshing ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200'}`}>
            {message.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3 mb-6">
          <Card className="rounded-xl border-slate-200 bg-white shadow-sm lg:col-span-2">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Informasi Tender
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Status</div>
                  <div className="font-semibold text-blue-700">{tender.status}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Tipe Tender</div>
                  <div className="font-medium text-slate-800">{tender.tender_type.replace(/_/g, " ")}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Owner Estimate (OE)</div>
                  <div className="font-medium text-slate-800">{formatRupiah(tender.owner_estimate_amount)}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Toleransi OE</div>
                  <div className="font-medium text-slate-800">{tender.oe_tolerance_percent}%</div>
                </div>
                {tender.winner_participant_id && (
                  <div className="md:col-span-2 bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                    <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Pemenang Tender
                    </div>
                    <div className="font-semibold text-emerald-900 text-lg">
                      {participants.find(p => p.id === tender.winner_participant_id)?.company_name || 'Vendor Tidak Ditemukan'}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {!isCompleted && (
            <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-blue-600" />
                  Undang Vendor
                </CardTitle>
                <CardDescription>Pilih vendor dari Master Vendor untuk diundang.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">Pilih Vendor</Label>
                    <Select value={inviteVendorId} onValueChange={setInviteVendorId}>
                      <SelectTrigger className="bg-slate-50">
                        <SelectValue placeholder="-- Pilih Vendor --" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.filter(v => !participants.some(p => p.vendor_company_id === v.id)).map(v => (
                          <SelectItem key={v.id} value={String(v.id)}>{v.company_name}</SelectItem>
                        ))}
                        {vendors.length === 0 && <SelectItem value="0" disabled>Tidak ada vendor tersedia</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">Email Undangan (Opsional)</Label>
                    <Input 
                      type="email" 
                      placeholder="Email kontak vendor" 
                      value={inviteEmail} 
                      onChange={e => setInviteEmail(e.target.value)} 
                      className="bg-slate-50"
                    />
                  </div>
                  <Button type="submit" disabled={inviting || !inviteVendorId} className="w-full bg-blue-700 hover:bg-blue-800 text-white">
                    {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Kirim Undangan
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="rounded-xl border-slate-200 bg-white shadow-sm lg:col-span-2">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-base font-bold text-slate-800">Partisipan & Penawaran</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Vendor</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Penawaran Terakhir</th>
                      <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {participants.map((p) => {
                      const latestSubmission = p.submissions?.[0];
                      const isWinner = tender.winner_participant_id === p.id;
                      
                      return (
                        <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${isWinner ? 'bg-emerald-50/30' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800">{p.company_name}</div>
                            <div className="text-xs text-slate-500">{p.invited_by_email || 'Tidak ada email'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                              isWinner ? 'bg-emerald-100 text-emerald-800' :
                              p.status === 'LOST' ? 'bg-slate-100 text-slate-800' :
                              p.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {isWinner ? 'WINNER' : p.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {latestSubmission ? (
                              <div>
                                <div className="font-medium text-slate-900">{formatRupiah(latestSubmission.submitted_offer_amount)}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{new Date(latestSubmission.submitted_at).toLocaleDateString('id-ID')}</div>
                                {latestSubmission.oe_review_required && (
                                  <div className="text-[10px] uppercase font-bold text-amber-600 mt-1 bg-amber-50 inline-block px-1.5 py-0.5 rounded">Perlu Review OE</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-xs">Belum ada penawaran</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {!isCompleted && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                onClick={() => handleSetWinner(p.id)}
                                disabled={settingWinner || !latestSubmission}
                              >
                                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                Pilih Pemenang
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {participants.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <UserPlus className="h-8 w-8 text-slate-300" />
                            <p>Belum ada vendor yang diundang ke tender ini.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {!isCompleted && participants.length > 0 && (
            <Card className="rounded-xl border-slate-200 bg-white shadow-sm h-fit">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                <CardTitle className="text-base font-bold text-slate-800">Simulasi Penawaran</CardTitle>
                <CardDescription>Untuk testing: Submit penawaran atas nama participant.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmitOffer} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">Participant</Label>
                    <Select value={submitParticipantId} onValueChange={setSubmitParticipantId}>
                      <SelectTrigger className="bg-slate-50">
                        <SelectValue placeholder="-- Pilih Participant --" />
                      </SelectTrigger>
                      <SelectContent>
                        {participants.map(p => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">Tipe Penawaran</Label>
                    <Select value={submissionType} onValueChange={setSubmissionType}>
                      <SelectTrigger className="bg-slate-50">
                        <SelectValue placeholder="-- Pilih Tipe --" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TECHNICAL">Teknis Saja</SelectItem>
                        <SelectItem value="COMMERCIAL">Komersial Saja</SelectItem>
                        <SelectItem value="TECHNICAL_AND_COMMERCIAL">Teknis & Komersial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">Nilai Penawaran (Rp)</Label>
                    <Input 
                      type="number" 
                      placeholder="Contoh: 150000000" 
                      value={offerAmount} 
                      onChange={e => setOfferAmount(e.target.value)} 
                      className="bg-slate-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">Catatan</Label>
                    <Textarea 
                      placeholder="Catatan penawaran (opsional)" 
                      value={submissionNotes} 
                      onChange={e => setSubmissionNotes(e.target.value)}
                      className="bg-slate-50 min-h-[80px]"
                    />
                  </div>
                  <Button type="submit" disabled={submitting || !submitParticipantId} className="w-full bg-slate-800 hover:bg-slate-900 text-white">
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit Penawaran
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
