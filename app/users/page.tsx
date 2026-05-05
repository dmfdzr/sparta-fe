"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Users, Search, Plus, Edit2, Trash2, ArrowLeft, Loader2, Save, X, AlertTriangle
} from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';
import {
    fetchUserCabangList, createUserCabang, updateUserCabang, deleteUserCabang
} from '@/lib/api';
import { BRANCH_TO_ULOK } from '@/lib/constants';

// Role yang tersedia sesuai instruksi
const JABATAN_OPTIONS = [
    'BRANCH BUILDING & MAINTENANCE MANAGER',
    'BRANCH BUILDING COORDINATOR',
    'BRANCH BUILDING SUPPORT',
    'BRANCH MANAGER',
    'KONTRAKTOR',
    'DIREKTUR'
];

// Daftar cabang dari constants + HEAD OFFICE
const CABANG_OPTIONS = Array.from(new Set([
    'HEAD OFFICE',
    ...Object.keys(BRANCH_TO_ULOK)
])).sort();

export default function UsersPage() {
    const router = useRouter();

    // --- AUTH ---
    const [userInfo, setUserInfo] = useState({ name: '', role: '', cabang: '', email: '' });

    // --- DATA ---
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCabang, setFilterCabang] = useState('');
    const [filterJabatan, setFilterJabatan] = useState('');

    // --- MODAL / FORM ---
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        cabang: '',
        email_sat: '',
        nama_lengkap: '',
        jabatan: '',
        nama_pt: ''
    });
    
    // Simpan key asli saat edit (berjaga-jaga jika diperlukan)
    const [editKeys, setEditKeys] = useState({ cabang: '', email_sat: '' });

    // --- TOAST ---
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- DELETE MODAL ---
    const [deleteModal, setDeleteModal] = useState<{ cabang: string; email_sat: string; nama: string } | null>(null);

    // =========================================================================
    // INIT & AUTH
    // =========================================================================
    useEffect(() => {
        const isAuth = sessionStorage.getItem("authenticated");
        const role = sessionStorage.getItem("userRole") || '';
        const email = sessionStorage.getItem("loggedInUserEmail") || '';
        const cabang = sessionStorage.getItem("loggedInUserCabang") || '';
        const namaLengkap = sessionStorage.getItem("nama_lengkap") || email.split('@')[0];

        if (isAuth !== "true" || !role) {
            router.push('/auth');
            return;
        }

        // Hanya HEAD OFFICE yang boleh akses
        if (cabang.toUpperCase() !== 'HEAD OFFICE') {
            alert("Hanya pengguna Head Office yang dapat mengakses halaman ini.");
            router.push('/dashboard');
            return;
        }

        setUserInfo({ name: namaLengkap.toUpperCase(), role, cabang, email });
        loadUsers();
    }, [router]);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // =========================================================================
    // LOAD DATA
    // =========================================================================
    const loadUsers = async (searchStr: string = searchQuery, cabang: string = filterCabang, jabatan: string = filterJabatan) => {
        setIsLoading(true);
        try {
            const res = await fetchUserCabangList({ search: searchStr, cabang, jabatan });
            setUsers(res.data || []);
        } catch (err: any) {
            showToast(err.message || 'Gagal memuat data user.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadUsers(searchQuery, filterCabang, filterJabatan);
    };

    // =========================================================================
    // FORM HANDLERS
    // =========================================================================
    const openAddForm = () => {
        setIsEditing(false);
        setFormData({ cabang: '', email_sat: '', nama_lengkap: '', jabatan: '', nama_pt: '' });
        setIsFormOpen(true);
    };

    const openEditForm = (user: any) => {
        setIsEditing(true);
        setEditKeys({ cabang: user.cabang, email_sat: user.email_sat });
        setFormData({
            cabang: user.cabang,
            email_sat: user.email_sat,
            nama_lengkap: user.nama_lengkap || '',
            jabatan: user.jabatan || '',
            nama_pt: user.nama_pt || ''
        });
        setIsFormOpen(true);
    };

    const handleSave = async () => {
        if (!formData.cabang || !formData.email_sat) {
            showToast('Cabang dan Email wajib diisi!', 'error');
            return;
        }

        setIsProcessing(true);
        try {
            if (isEditing) {
                // Sesuai API, PUT /api/user_cabang/:cabang/:email_sat
                await updateUserCabang(editKeys.cabang, editKeys.email_sat, {
                    nama_lengkap: formData.nama_lengkap,
                    jabatan: formData.jabatan,
                    nama_pt: formData.nama_pt
                });
                showToast('Data user berhasil diperbarui!', 'success');
            } else {
                // POST /api/user_cabang
                await createUserCabang(formData);
                showToast('User berhasil ditambahkan!', 'success');
            }
            setIsFormOpen(false);
            loadUsers(searchQuery);
        } catch (err: any) {
            showToast(err.message || 'Terjadi kesalahan saat menyimpan.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // =========================================================================
    // DELETE HANDLER
    // =========================================================================
    const confirmDelete = async () => {
        if (!deleteModal) return;
        setIsProcessing(true);
        try {
            await deleteUserCabang(deleteModal.cabang, deleteModal.email_sat);
            showToast('User berhasil dihapus!', 'success');
            setDeleteModal(null);
            loadUsers(searchQuery);
        } catch (err: any) {
            showToast(err.message || 'Gagal menghapus user.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // =========================================================================
    // RENDER
    // =========================================================================
    if (isLoading && users.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                <p className="text-slate-500">Memuat manajemen user...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-800">
            {/* TOAST */}
            {toast && (
                <div className={`fixed top-4 right-4 z-9999 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top-5 ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {toast.type === 'success' ? <Users className="w-5 h-5 text-green-500" /> : <X className="w-5 h-5 text-red-500" />}
                    <p className="text-sm font-semibold">{toast.msg}</p>
                </div>
            )}

            {/* SIDEBAR / HEADER */}
            <AppNavbar 
                title="SPARTA"
                showBackButton={true}
                backHref="/dashboard"
            />

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 min-w-0">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">Manajemen User Cabang</h1>
                            <p className="text-sm text-slate-500">Kelola data PIC dan akses aplikasi setiap cabang</p>
                        </div>
                    </div>
                    <Button onClick={openAddForm} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm h-10 px-5 font-semibold shrink-0">
                        <Plus className="w-4 h-4 mr-2" />
                        Tambah User
                    </Button>
                </div>

                {/* Toolbar */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 shrink-0 flex flex-col md:flex-row gap-3 mb-4">
                    <form onSubmit={handleSearch} className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari nama, email, cabang, atau jabatan..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                        {searchQuery && (
                            <button type="button" onClick={() => { setSearchQuery(''); loadUsers('', filterCabang, filterJabatan); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </form>

                    <div className="flex gap-2 shrink-0">
                        <select 
                            value={filterCabang} 
                            onChange={(e) => {
                                setFilterCabang(e.target.value);
                                loadUsers(searchQuery, e.target.value, filterJabatan);
                            }}
                            className="w-36 md:w-44 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Semua Cabang</option>
                            {CABANG_OPTIONS.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        
                        <select 
                            value={filterJabatan} 
                            onChange={(e) => {
                                setFilterJabatan(e.target.value);
                                loadUsers(searchQuery, filterCabang, e.target.value);
                            }}
                            className="w-36 md:w-44 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Semua Jabatan</option>
                            {JABATAN_OPTIONS.map(j => (
                                <option key={j} value={j}>{j}</option>
                            ))}
                        </select>
                        
                        <Button type="button" onClick={() => loadUsers(searchQuery, filterCabang, filterJabatan)} variant="outline" className="h-10.5 border-slate-200 text-slate-600 rounded-xl">
                            Cari
                        </Button>
                    </div>
                </div>

                {/* Table / List */}
                <div className="flex-1 overflow-auto bg-white rounded-2xl shadow-sm border border-slate-200 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-4" />
                            <p>Memuat data user...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-slate-400">
                            <Users className="w-12 h-12 mb-4 opacity-50" />
                            <p>Tidak ada data user ditemukan.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-slate-600 uppercase text-xs tracking-wider">User Info</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 uppercase text-xs tracking-wider">Jabatan & PT</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 uppercase text-xs tracking-wider">Cabang</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 uppercase text-xs tracking-wider text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map((u, idx) => (
                                    <tr key={`${u.cabang}-${u.email_sat}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800">{u.nama_lengkap || '-'}</span>
                                                <span className="text-slate-500 text-xs mt-0.5">{u.email_sat}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-700">{u.jabatan || '-'}</span>
                                                <span className="text-slate-500 text-[10px] mt-0.5 max-w-50 truncate" title={u.nama_pt}>{u.nama_pt || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-bold px-2 py-0.5">
                                                {u.cabang}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" onClick={() => openEditForm(u)} className="h-8 w-8 p-0 rounded-lg text-amber-600 border-amber-200 hover:bg-amber-50">
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => setDeleteModal({ cabang: u.cabang, email_sat: u.email_sat, nama: u.nama_lengkap || u.email_sat })} className="h-8 w-8 p-0 rounded-lg text-red-600 border-red-200 hover:bg-red-50">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>

            {/* FORM MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border-0">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">
                                {isEditing ? 'Edit User Cabang' : 'Tambah User Cabang'}
                            </h2>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Cabang *</label>
                                <select 
                                    value={formData.cabang} 
                                    onChange={e => setFormData({ ...formData, cabang: e.target.value })}
                                    disabled={isEditing}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <option value="">-- Pilih Cabang --</option>
                                    {CABANG_OPTIONS.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Email SAT *</label>
                                <input 
                                    type="email"
                                    value={formData.email_sat}
                                    onChange={e => setFormData({ ...formData, email_sat: e.target.value })}
                                    disabled={isEditing}
                                    placeholder="contoh@alfamart.co.id"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Nama Lengkap</label>
                                <input 
                                    type="text"
                                    value={formData.nama_lengkap}
                                    onChange={e => setFormData({ ...formData, nama_lengkap: e.target.value })}
                                    placeholder="Masukkan nama lengkap"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Jabatan</label>
                                <select 
                                    value={formData.jabatan} 
                                    onChange={e => setFormData({ ...formData, jabatan: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">-- Pilih Jabatan --</option>
                                    {JABATAN_OPTIONS.map(j => (
                                        <option key={j} value={j}>{j}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Nama PT</label>
                                <input 
                                    type="text"
                                    value={formData.nama_pt}
                                    onChange={e => setFormData({ ...formData, nama_pt: e.target.value })}
                                    placeholder="Misal: PT Sumber Alfaria Trijaya Tbk"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </CardContent>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="rounded-xl font-semibold text-slate-600 border-slate-200">
                                Batal
                            </Button>
                            <Button onClick={handleSave} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm min-w-25">
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Simpan</>}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden border-0">
                        <div className="p-6 text-center">
                            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-7 h-7" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Konfirmasi Hapus</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Apakah Anda yakin ingin menghapus user <br />
                                <strong className="text-slate-800">{deleteModal.nama}</strong> ({deleteModal.cabang})?
                            </p>
                            <div className="flex gap-3 w-full">
                                <Button variant="outline" onClick={() => setDeleteModal(null)} className="flex-1 rounded-xl font-semibold border-slate-200">
                                    Batal
                                </Button>
                                <Button onClick={confirmDelete} disabled={isProcessing} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-sm">
                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hapus User'}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
