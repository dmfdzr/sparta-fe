"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Download,
  ExternalLink,
  File,
  FolderArchive,
  Loader2,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/context/SessionContext";
import {
  buildDcDocumentViewUrl,
  createDcArchiveProject,
  deleteDcDocument,
  fetchDcArchiveProjects,
  fetchDcDocuments,
  type DcArchiveProject,
  type DcDocument,
  uploadDcDocuments,
} from "@/lib/api";
import {
  DC_BUILDING_DEVELOPMENT_MANAGER_ROLE,
  DC_BUILDING_DEVELOPMENT_SPECIALIST_ROLE,
  SUPER_HUMAN_ROLE,
  normalizeRoles,
} from "@/lib/constants";

const DOCUMENT_CATEGORIES = [
  { key: "fotoExisting", label: "Foto Toko Existing", group: "Foto" },
  { key: "fotoRenovasi", label: "Foto Proses Renovasi", group: "Foto" },
  { key: "me", label: "Gambar ME", group: "Gambar" },
  { key: "sipil", label: "Gambar Sipil", group: "Gambar" },
  { key: "sketsaAwal", label: "Sketsa Awal (Layout)", group: "Gambar" },
  { key: "spk", label: "Dokumen SPK", group: "Dokumen" },
  { key: "rab", label: "Dokumen RAB & Penawaran", group: "Dokumen" },
  { key: "pendukung", label: "Dokumen Pendukung", group: "Dokumen" },
  { key: "instruksiLapangan", label: "Instruksi Lapangan", group: "Dokumen" },
  { key: "pengawasan", label: "Berkas Pengawasan", group: "Dokumen" },
  { key: "aanwijzing", label: "Aanwijzing", group: "Dokumen" },
  { key: "kerjaTambahKurang", label: "Kerja Tambah Kurang", group: "Dokumen" },
];

const REQUIRED_CATEGORY_KEYS = DOCUMENT_CATEGORIES
  .map((category) => category.key)
  .filter((key) => key !== "pendukung");

const CAN_CREATE_ARCHIVE_ROLES = [
  SUPER_HUMAN_ROLE,
  DC_BUILDING_DEVELOPMENT_MANAGER_ROLE,
  DC_BUILDING_DEVELOPMENT_SPECIALIST_ROLE,
];

const emptyArchiveForm = {
  archive_code: "",
  archive_name: "",
  branch_name: "",
  location_name: "",
  project_type: "",
  address: "",
  notes: "",
};

function actorFromUser(user: ReturnType<typeof useSession>["user"]) {
  return {
    actor_email: user?.email || "",
    actor_role: user?.role || "",
  };
}

function canCreateArchive(role: string | string[] | undefined | null) {
  const roles = normalizeRoles(role);
  return roles.some((userRole) => CAN_CREATE_ARCHIVE_ROLES.includes(userRole));
}

function isArchiveComplete(item: DcArchiveProject) {
  const counts = item.kategori_counts ?? {};
  return REQUIRED_CATEGORY_KEYS.every((key) => Number(counts[key] ?? 0) > 0);
}

function statusMeta(item: DcArchiveProject) {
  const complete = isArchiveComplete(item);
  return {
    label: complete ? "Sudah Lengkap" : "Belum Lengkap",
    className: complete
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-amber-50 text-amber-700 border-amber-200",
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function DcDocumentsPage() {
  const { user, isLoading } = useSession();
  const [archives, setArchives] = useState<DcArchiveProject[]>([]);
  const [documents, setDocuments] = useState<DcDocument[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<DcArchiveProject | null>(null);
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "lengkap" | "belum">("all");
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [archiveForm, setArchiveForm] = useState(emptyArchiveForm);

  const actor = useMemo(() => actorFromUser(user), [user]);
  const canAddData = useMemo(() => canCreateArchive(user?.roles), [user?.roles]);

  const loadArchives = useCallback(async () => {
    if (!actor.actor_email || !actor.actor_role) return;
    setLoadingArchives(true);
    setMessage("");
    try {
      const res = await fetchDcArchiveProjects({
        actor_email: actor.actor_email,
        actor_role: actor.actor_role,
        search: query.trim() || undefined,
        branch_name: branchFilter,
        status: statusFilter,
      }, { suppressGlobalError: true });
      setArchives(res.data ?? []);
    } catch (error) {
      setMessage(getErrorMessage(error, "Gagal memuat arsip dokumen DC"));
    } finally {
      setLoadingArchives(false);
    }
  }, [actor.actor_email, actor.actor_role, branchFilter, query, statusFilter]);

  const loadDocuments = useCallback(async (archive: DcArchiveProject) => {
    if (!actor.actor_email || !actor.actor_role) return;
    setLoadingDocs(true);
    setMessage("");
    try {
      const res = await fetchDcDocuments({
        project_id: archive.project_id,
        entity_type: "DC_ARCHIVE_PROJECT",
        actor_email: actor.actor_email,
        actor_role: actor.actor_role,
      }, { suppressGlobalError: true });
      setDocuments(res.data ?? []);
    } catch (error) {
      setMessage(getErrorMessage(error, "Gagal memuat dokumen DC"));
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [actor.actor_email, actor.actor_role]);

  useEffect(() => {
    if (!isLoading && user && !selectedArchive) loadArchives();
  }, [isLoading, loadArchives, selectedArchive, user]);

  const branchOptions = useMemo(() => {
    const branches = new Set(archives.map((archive) => archive.branch_name).filter(Boolean));
    if (branchFilter !== "all") branches.add(branchFilter);
    return Array.from(branches).sort((a, b) => a.localeCompare(b));
  }, [archives, branchFilter]);

  const docsByType = useMemo(() => {
    return documents.reduce<Record<string, DcDocument[]>>((acc, doc) => {
      acc[doc.document_type] = acc[doc.document_type] || [];
      acc[doc.document_type].push(doc);
      return acc;
    }, {});
  }, [documents]);

  const totals = useMemo(() => {
    const complete = archives.filter(isArchiveComplete).length;
    return {
      total: archives.length,
      complete,
      incomplete: archives.length - complete,
    };
  }, [archives]);

  const openArchive = (archive: DcArchiveProject) => {
    setSelectedArchive(archive);
    loadDocuments(archive);
  };

  const handleCreateArchive = async () => {
    if (!canAddData) {
      setMessage("Anda tidak memiliki akses untuk menambah data arsip DC.");
      return;
    }

    const payload = {
      archive_code: archiveForm.archive_code.trim(),
      archive_name: archiveForm.archive_name.trim(),
      branch_name: archiveForm.branch_name.trim().toUpperCase(),
      location_name: archiveForm.location_name.trim() || undefined,
      project_type: archiveForm.project_type.trim(),
      address: archiveForm.address.trim() || undefined,
      notes: archiveForm.notes.trim() || undefined,
      actor_email: actor.actor_email,
      actor_role: actor.actor_role,
    };

    if (!payload.archive_code || !payload.archive_name || !payload.branch_name || !payload.project_type) {
      setMessage("Kode, nama DC, cabang/lokasi, dan tipe project wajib diisi.");
      return;
    }

    setIsCreating(true);
    setMessage("");
    try {
      await createDcArchiveProject(payload);
      setArchiveForm(emptyArchiveForm);
      setIsCreateOpen(false);
      setMessage("Data arsip DC berhasil dibuat.");
      await loadArchives();
    } catch (error) {
      setMessage(getErrorMessage(error, "Gagal membuat data arsip DC"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpload = async (documentType: string, fileList: FileList | null) => {
    if (!selectedArchive || !fileList?.length) return;
    setUploadingKey(documentType);
    setMessage("");
    try {
      await uploadDcDocuments({
        project_id: selectedArchive.project_id,
        entity_type: "DC_ARCHIVE_PROJECT",
        entity_id: selectedArchive.id,
        document_type: documentType,
        stage: "LEGACY_ARCHIVE",
        actor_email: actor.actor_email,
        actor_role: actor.actor_role,
      }, Array.from(fileList));
      await loadDocuments(selectedArchive);
      setMessage(`${fileList.length} file berhasil diupload.`);
    } catch (error) {
      setMessage(getErrorMessage(error, "Gagal upload dokumen DC"));
    } finally {
      setUploadingKey(null);
    }
  };

  const handleDelete = async (doc: DcDocument) => {
    if (!selectedArchive) return;
    setDeletingId(doc.id);
    setMessage("");
    try {
      await deleteDcDocument(doc.id, actor);
      await loadDocuments(selectedArchive);
      setMessage("Dokumen DC berhasil dihapus.");
    } catch (error) {
      setMessage(getErrorMessage(error, "Gagal menghapus dokumen DC"));
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading || !user) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#edf2f6] px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/dc-development" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" />
              DC Development
            </Link>
            <h1 className="mt-2 text-xl font-bold text-slate-800">Penyimpanan Dokumen DC</h1>
          </div>
          <Button variant="outline" className="rounded-lg bg-white" onClick={() => selectedArchive ? loadDocuments(selectedArchive) : loadArchives()} disabled={loadingArchives || loadingDocs}>
            <RefreshCw className={(loadingArchives || loadingDocs) ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
        </div>

        {message && (
          <div className="mb-4 rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
            {message}
          </div>
        )}

        {!selectedArchive ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SummaryCard title="Total Data" value={totals.total} />
              <SummaryCard title="Sudah Lengkap" value={totals.complete} tone="green" />
              <SummaryCard title="Belum Lengkap" value={totals.incomplete} tone="amber" />
            </div>

            <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Cari kode, nama DC, cabang, atau lokasi..." />
                </div>
                <Select value={statusFilter} onValueChange={(value: "all" | "lengkap" | "belum") => setStatusFilter(value)}>
                  <SelectTrigger className="w-full lg:w-52">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="lengkap">Sudah Lengkap</SelectItem>
                    <SelectItem value="belum">Belum Lengkap</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="w-full lg:w-52">
                    <SelectValue placeholder="Semua Cabang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Cabang</SelectItem>
                    {branchOptions.map((branch) => (
                      <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canAddData && (
                  <Button className="rounded-lg bg-red-600 text-white hover:bg-red-700" onClick={() => setIsCreateOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Tambah Data
                  </Button>
                )}
              </div>
            </div>

            <Card className="overflow-hidden rounded-lg bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">No</th>
                      <th className="px-5 py-3">Kode</th>
                      <th className="px-5 py-3">Nama DC</th>
                      <th className="px-5 py-3">Cabang/Lokasi</th>
                      <th className="px-5 py-3">Tipe</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {archives.map((archive, index) => {
                      const status = statusMeta(archive);
                      return (
                        <tr key={archive.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4 text-slate-500">{index + 1}</td>
                          <td className="px-5 py-4 font-bold text-slate-950">{archive.archive_code}</td>
                          <td className="px-5 py-4 font-semibold text-slate-800">{archive.archive_name}</td>
                          <td className="px-5 py-4 text-slate-600">
                            <div>{archive.branch_name}</div>
                            <div className="text-xs text-slate-400">{archive.location_name || "-"}</div>
                          </td>
                          <td className="px-5 py-4">
                            <Badge variant="secondary">{archive.project_type}</Badge>
                          </td>
                          <td className="px-5 py-4">
                            <Badge className={`${status.className} border`}>{status.label}</Badge>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Button size="sm" variant="outline" className="rounded-lg bg-white" onClick={() => openArchive(archive)}>
                              <FolderArchive className="mr-2 h-4 w-4" />
                              Kelola Dokumen
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {loadingArchives && (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                        </td>
                      </tr>
                    )}
                    {!loadingArchives && archives.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-slate-500">Belum ada arsip dokumen DC.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <Button variant="ghost" className="mb-2 h-8 px-0 text-slate-500 hover:bg-transparent" onClick={() => { setSelectedArchive(null); setDocuments([]); loadArchives(); }}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Kembali ke daftar arsip
                  </Button>
                  <h2 className="text-lg font-bold text-slate-900">{selectedArchive.archive_name}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge className="bg-red-50 text-red-700 border-red-100">{selectedArchive.archive_code}</Badge>
                    <Badge variant="secondary">{selectedArchive.branch_name}</Badge>
                    <Badge variant="secondary">{selectedArchive.project_type}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {["Foto", "Gambar", "Dokumen"].map((group) => {
                    const keys = DOCUMENT_CATEGORIES.filter((category) => category.group === group).map((category) => category.key);
                    const count = documents.filter((doc) => keys.includes(doc.document_type)).length;
                    return (
                      <div key={group} className="rounded-lg bg-slate-50 px-4 py-3">
                        <div className="text-xs font-bold uppercase text-slate-400">{group}</div>
                        <div className="text-2xl font-bold text-slate-900">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {loadingDocs ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-7 w-7 animate-spin text-red-600" />
              </div>
            ) : (
              ["Foto", "Gambar", "Dokumen"].map((groupName) => (
                <section key={groupName} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{groupName}</h3>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {DOCUMENT_CATEGORIES.filter((category) => category.group === groupName).map((category) => {
                      const docs = docsByType[category.key] || [];
                      const isUploading = uploadingKey === category.key;
                      return (
                        <Card key={category.key} className="rounded-lg bg-white shadow-sm">
                          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <h4 className="truncate text-sm font-bold text-slate-800">{category.label}</h4>
                              {docs.length > 0 && <Badge className="bg-red-50 text-red-600 border-red-100">{docs.length}</Badge>}
                            </div>
                            <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:text-red-600" title="Upload file">
                              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                              <input
                                type="file"
                                multiple
                                className="hidden"
                                disabled={isUploading}
                                onChange={(event) => {
                                  handleUpload(category.key, event.target.files);
                                  event.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                          <CardContent className="space-y-2 p-3">
                            {docs.map((doc) => (
                              <div key={doc.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                      <File className="h-4 w-4 shrink-0 text-slate-400" />
                                      <span className="truncate">{doc.file_name || category.label}</span>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      v{doc.version_no || 1} - {doc.uploaded_by_email || doc.created_by_email || "-"}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <a className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-blue-600" href={buildDcDocumentViewUrl(doc.id, actor, "view")} target="_blank" rel="noopener noreferrer" title="Lihat dokumen">
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                    <a className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-emerald-600" href={buildDcDocumentViewUrl(doc.id, actor, "download")} target="_blank" rel="noopener noreferrer" title="Download dokumen">
                                      <Download className="h-4 w-4" />
                                    </a>
                                    <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-red-600" onClick={() => handleDelete(doc)} disabled={deletingId === doc.id} title="Hapus dokumen">
                                      {deletingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {docs.length === 0 && (
                              <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs font-medium text-slate-400">
                                Belum ada file
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Data Arsip DC</DialogTitle>
            <DialogDescription>Data legacy ini akan menjadi workspace penyimpanan dokumen DC.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Kode DC / Project</Label>
              <Input value={archiveForm.archive_code} onChange={(event) => setArchiveForm((prev) => ({ ...prev, archive_code: event.target.value }))} placeholder="Contoh: DC-LPG-2024-001" />
            </div>
            <div className="grid gap-2">
              <Label>Nama DC / Project</Label>
              <Input value={archiveForm.archive_name} onChange={(event) => setArchiveForm((prev) => ({ ...prev, archive_name: event.target.value }))} placeholder="Contoh: DC Lampung Expansion" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Cabang / Area</Label>
                <Input value={archiveForm.branch_name} onChange={(event) => setArchiveForm((prev) => ({ ...prev, branch_name: event.target.value }))} placeholder="Contoh: LAMPUNG" />
              </div>
              <div className="grid gap-2">
                <Label>Tipe Project</Label>
                <Input value={archiveForm.project_type} onChange={(event) => setArchiveForm((prev) => ({ ...prev, project_type: event.target.value }))} placeholder="Contoh: Renovasi" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Lokasi</Label>
              <Input value={archiveForm.location_name} onChange={(event) => setArchiveForm((prev) => ({ ...prev, location_name: event.target.value }))} placeholder="Opsional" />
            </div>
            <div className="grid gap-2">
              <Label>Alamat / Catatan</Label>
              <Input value={archiveForm.notes} onChange={(event) => setArchiveForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Opsional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>Batal</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" onClick={handleCreateArchive} disabled={isCreating}>
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SummaryCard({ title, value, tone = "slate" }: { title: string; value: number; tone?: "slate" | "green" | "amber" }) {
  const toneClass = {
    slate: "text-slate-900",
    green: "text-emerald-700",
    amber: "text-amber-700",
  }[tone];

  return (
    <div className="rounded-lg bg-white px-5 py-4 ring-1 ring-slate-200">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        {tone === "green" && <CheckCircle className="h-4 w-4 text-emerald-500" />}
        {title}
      </div>
      <div className={`mt-2 text-3xl font-extrabold ${toneClass}`}>{value}</div>
    </div>
  );
}
