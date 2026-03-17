"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    Info, 
    FileText, 
    Activity, 
    CheckCircle, 
    HardHat,
    Briefcase,
    Eye,
    ClipboardList,
    Camera,
    Archive,
    Lightbulb,
    Code,
    Users,
    UserCircle,
    Rocket,
    Wrench
} from 'lucide-react';

export default function TentangSparta() {
  // State untuk mengontrol tab yang aktif
    const [activeTab, setActiveTab] = useState<'aplikasi' | 'tim1' | 'tim2'>('aplikasi');

  // --- DATA APLIKASI ---
    const processes = [
        { title: "Penawaran", icon: <Briefcase className="w-6 h-6 text-slate-700" /> },
        { title: "Pembuatan SPK", icon: <FileText className="w-6 h-6 text-slate-700" /> },
        { title: "Pengawasan", icon: <Eye className="w-6 h-6 text-slate-700" /> },
        { title: "Opname", icon: <Activity className="w-6 h-6 text-slate-700" /> },
        { title: "Instruksi Lapangan", icon: <ClipboardList className="w-6 h-6 text-slate-700" /> },
        { title: "Serah Terima", icon: <CheckCircle className="w-6 h-6 text-slate-700" /> },
        { title: "Dokumentasi", desc: "Bangunan toko baru", icon: <Camera className="w-6 h-6 text-slate-700" /> },
        { title: "Penyimpanan", desc: "Dokumen toko eksisting terpusat", icon: <Archive className="w-6 h-6 text-slate-700" /> }
    ];

  // --- DATA TIM PERTAMA ---
    const initiators = [
        { name: "Andy Mulyono", role: "Head of Building & Maintenance", desc: "Penggagas utama digitalisasi proses bisnis.", icon: <Lightbulb className="w-6 h-6 text-amber-600" /> }
    ];

    const firstTeamDevelopers = [
        { name: "Daniel Bernard Yonathan", role: "Project Leader", desc: "Merancang arsitektur antarmuka dan struktur UI/UX SPARTA serta awal database dan kerangka API dasar.", icon: <Code className="w-6 h-6 text-red-600" /> },
        { name: "Ananda Dwi Rizkyta", role: "Project Assistant", desc: "Merancang arsitektur antarmuka dan struktur UI/UX SPARTA serta awal database dan kerangka API dasar.", icon: <Code className="w-6 h-6 text-red-700" /> },
        { name: "Nathanael Bernike", role: "Project Assistant", desc: "Merancang arsitektur antarmuka dan struktur UI/UX SPARTA serta awal database dan kerangka API dasar.", icon: <Code className="w-6 h-6 text-red-700" /> },
        { name: "I Putu Dharma Puspa", role: "Project Assistant", desc: "Merancang arsitektur antarmuka dan struktur UI/UX SPARTA serta awal database dan kerangka API dasar.", icon: <Code className="w-6 h-6 text-red-700" /> },
    ];

    const stakeholders = [
        { name: "8 Cabang", role: "End-User Pertama", desc: "Pihak yang pertama kali menggunakan SPARTA (Trial).", icon: <UserCircle className="w-6 h-6 text-emerald-600" /> }
    ];

  // --- DATA TIM KEDUA ---
    const secondTeamInitiators = [
        { name: "Andy Mulyono", role: "Head of Building & Maintenance", desc: "Penggagas utama digitalisasi proses bisnis.", icon: <Lightbulb className="w-6 h-6 text-amber-600" /> },
        { name: "Bima Arya Bhagaskara", role: "Project Manager", desc: "Pengarah untuk pengembangan lanjutan SPARTA.", icon: <Users className="w-6 h-6 text-amber-600" /> }
    ];

    const secondTeamDevelopers = [
        { name: "Dimas Abidzar Fadly", role: "Frontend Engineer", desc: "Mengembangkan fitur lanjutan, optimasi UI/UX, re-integrasi API, dan maintenance.", icon: <Rocket className="w-6 h-6 text-red-600" /> },
        { name: "Charderra Bagas Eka Sanjaya", role: "Backend Engineer", desc: "Pengembangan endpoint baru, stabilisasi server, dan manajemen arsitektur data lanjutan.", icon: <Wrench className="w-6 h-6 text-red-600" /> }
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
        
        {/* HEADER - Layout disamakan dengan Dashboard */}
        <header className="flex items-center justify-between p-4 md:px-8 bg-linear-to-r from-red-700 via-red-600 to-red-800 text-white shadow-md border-b border-red-900 sticky top-0 z-30 shrink-0">
            <div className="flex items-center gap-3 md:gap-5">
                {/* Tombol Kembali (Efek Glass Dihilangkan) */}
                <Link 
                    href="/" 
                    className="w-9 h-9 md:w-10 md:h-10 rounded-lg hover:bg-white/10 transition-all duration-200 shrink-0 flex items-center justify-center font-bold text-lg md:text-xl"
                    aria-label="Kembali"
                >
                    &lt;
                </Link>
                <img src="/assets/Alfamart-Emblem.png" alt="Logo" className="h-8 md:h-12 object-contain drop-shadow-md" />
                <div className="h-6 md:h-8 w-px bg-white/30 hidden md:block" />
                <h1 className="text-lg md:text-2xl font-bold md:font-extrabold tracking-widest drop-shadow-md">TENTANG SPARTA</h1>
                <img src="/assets/Building-Logo.png" alt="BM Logo" className="h-8 md:h-12 hidden sm:block object-contain drop-shadow-md" />
            </div>
            
            <div className="items-center gap-2 relative z-10 hidden md:flex">
                <div className="h-9 px-4 flex items-center text-sm font-medium text-white/80">
                    V 2.0.0
                </div>
            </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 mt-4">
            
            {/* TABS NAVIGATION */}
            <div className="flex justify-center mb-8">
            <div className="bg-white p-1.5 rounded-full shadow-sm border border-slate-200 inline-flex overflow-x-auto max-w-full">
                <button 
                onClick={() => setActiveTab('aplikasi')}
                className={`px-5 py-2.5 rounded-full text-sm md:text-base font-semibold transition-all duration-300 whitespace-nowrap ${
                    activeTab === 'aplikasi' 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-red-600 hover:bg-red-50'
                }`}
                >
                Tentang Aplikasi
                </button>
                <button 
                onClick={() => setActiveTab('tim1')}
                className={`px-5 py-2.5 rounded-full text-sm md:text-base font-semibold transition-all duration-300 whitespace-nowrap ${
                    activeTab === 'tim1' 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-red-600 hover:bg-red-50'
                }`}
                >
                First Dev Team
                </button>
                <button 
                onClick={() => setActiveTab('tim2')}
                className={`px-5 py-2.5 rounded-full text-sm md:text-base font-semibold transition-all duration-300 whitespace-nowrap ${
                    activeTab === 'tim2' 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-red-600 hover:bg-red-50'
                }`}
                >
                Second Dev Team
                </button>
            </div>
            </div>

            {/* TAB CONTENT SECTION */}
            <div className="min-h-125">
            
            {/* SECTION 1: TENTANG APLIKASI */}
            {activeTab === 'aplikasi' && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                {/* HERO SECTION */}
                <div className="flex flex-col items-center text-center mb-16">
                    <h2 className="text-3xl font-bold text-slate-800 mb-4">
                    System for Property Administration, Reporting, Tracking & Approval
                    </h2>
                    <p className="text-lg text-slate-600 max-w-3xl leading-relaxed">
                    SPARTA merupakan program untuk mendigitalisasi proses bisnis yang ada pada 
                    <span className="font-semibold text-slate-800"> Building & Maintenance</span> (khususnya Building). 
                    Melalui satu platform digital, sistem ini terintegrasi dan dirancang untuk menghubungkan seluruh proses kerja.
                    </p>
                </div>

                {/* PROCESSES GRID */}
                <div className="mb-16">
                    <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-slate-800">Platform Digital Terpusat</h3>
                    <p className="text-slate-500 mt-2">Melingkupi 8 proses inti operasional</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {processes.map((item, index) => (
                        <Card key={index} className="border-slate-200 hover:border-red-300 hover:shadow-lg transition-all duration-300 bg-white/50 backdrop-blur-xs">
                        <CardHeader className="flex flex-col items-center gap-3 p-4 text-center h-full justify-center">
                            <div className="bg-slate-100 p-3 rounded-full transition-transform hover:scale-110 duration-300">
                            {item.icon}
                            </div>
                            <div className="space-y-1">
                            <CardTitle className="text-base font-semibold text-slate-800">{item.title}</CardTitle>
                            {item.desc && (
                                <CardDescription className="text-xs text-slate-500 mt-1">{item.desc}</CardDescription>
                            )}
                            </div>
                        </CardHeader>
                        </Card>
                    ))}
                    </div>
                </div>

                {/* VERSION INFO */}
                <Card className="border-dashed border-2 border-slate-300 bg-transparent shadow-none text-center p-8 max-w-2xl mx-auto">
                    <Info className="w-8 h-8 text-slate-400 mx-auto mb-4" />
                    <h3 className="font-semibold text-slate-800 mb-2">Informasi Sistem</h3>
                    <p className="text-sm text-slate-500 mb-1">Versi: 2.0.0</p>
                    <p className="text-sm text-slate-500">
                    Dibangun dan dikembangkan khusus untuk keperluan manajemen internal Building & Maintenance.
                    </p>
                </Card>
                </div>
            )}

            {/* SECTION 2: FIRST DEV TEAM */}
            {activeTab === 'tim1' && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 bg-white p-6 md:p-10 rounded-3xl border border-slate-200 shadow-sm">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-800">First Development Team</h2>
                    <p className="text-slate-500 mt-3 text-lg">Inisiator dan tim awal yang mengembangkan SPARTA</p>
                </div>

                <div className="space-y-12">
                    {/* Inisiator & Manajemen */}
                    <section>
                        <h4 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="bg-amber-100 p-2 rounded-lg"><Lightbulb className="w-6 h-6 text-amber-600" /></div>
                            Inisiator & Manajemen
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {initiators.map((person, index) => (
                            <div key={index} className="flex gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-md transition-shadow">
                                <div className="bg-white shadow-xs p-3 rounded-full h-fit border border-slate-100">{person.icon}</div>
                                <div>
                                <h5 className="font-semibold text-lg text-slate-800">{person.name}</h5>
                                <p className="text-sm font-semibold text-amber-600 mb-2">{person.role}</p>
                                <p className="text-sm text-slate-600 leading-relaxed">{person.desc}</p>
                                </div>
                            </div>
                            ))}
                        </div>
                    </section>

                    {/* Tim Pengembang Pertama */}
                    <section>
                    <h4 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-3">
                        <div className="bg-red-100 p-2 rounded-lg"><Code className="w-6 h-6 text-red-600" /></div>
                        Tim Pengembang (First Gen)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {firstTeamDevelopers.map((person, index) => (
                        <div key={index} className="flex gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="bg-white shadow-xs p-3 rounded-full h-fit border border-slate-100">{person.icon}</div>
                            <div>
                            <h5 className="font-semibold text-lg text-slate-800">{person.name}</h5>
                            <p className="text-sm font-semibold text-red-600 mb-2">{person.role}</p>
                            <p className="text-sm text-slate-600 leading-relaxed">{person.desc}</p>
                            </div>
                        </div>
                        ))}
                    </div>
                    </section>

                    {/* Pihak Terkait */}
                    <section>
                    <h4 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-3">
                        <div className="bg-emerald-100 p-2 rounded-lg"><Users className="w-6 h-6 text-emerald-600" /></div>
                        Pihak Terkait & Pengguna
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {stakeholders.map((person, index) => (
                        <div key={index} className="flex gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="bg-white shadow-xs p-3 rounded-full h-fit border border-slate-100">{person.icon}</div>
                            <div>
                            <h5 className="font-semibold text-lg text-slate-800">{person.name}</h5>
                            <p className="text-sm font-semibold text-emerald-600 mb-2">{person.role}</p>
                            <p className="text-sm text-slate-600 leading-relaxed">{person.desc}</p>
                            </div>
                        </div>
                        ))}
                    </div>
                    </section>
                </div>
                </div>
            )}

            {/* SECTION 3: SECOND DEV TEAM */}
            {activeTab === 'tim2' && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 bg-white p-6 md:p-10 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                
                <div className="relative z-10">
                    <div className="text-center mb-12">
                    <div className="inline-block bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide mb-4">
                        ACTIVE MAINTAINER
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800">Second Development Team</h2>
                    <p className="text-slate-500 mt-3 text-lg max-w-2xl mx-auto">
                        Tim yang bertanggung jawab atas pengembangan fitur lanjutan (V2), peningkatan performa, dan pemeliharaan sistem SPARTA saat ini.
                    </p>
                    </div>

                    <div className="space-y-12">
                        {/* Inisiator & Manajemen Kedua */}
                        <section>
                            <h4 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-3">
                                <div className="bg-amber-100 p-2 rounded-lg"><Lightbulb className="w-6 h-6 text-amber-600" /></div>
                                Inisiator & Manajemen
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {secondTeamInitiators.map((person, index) => (
                                <div key={index} className="flex gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-md transition-shadow">
                                    <div className="bg-white shadow-xs p-3 rounded-full h-fit border border-slate-100">{person.icon}</div>
                                    <div>
                                    <h5 className="font-semibold text-lg text-slate-800">{person.name}</h5>
                                    <p className="text-sm font-semibold text-amber-600 mb-2">{person.role}</p>
                                    <p className="text-sm text-slate-600 leading-relaxed">{person.desc}</p>
                                    </div>
                                </div>
                                ))}
                            </div>
                        </section>

                        {/* Tim Pengembang Kedua */}
                        <section>
                        <h4 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="bg-red-100 p-2 rounded-lg"><Rocket className="w-6 h-6 text-red-600" /></div>
                            Tim Pengembang (Second Gen)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {secondTeamDevelopers.map((person, index) => (
                            <div key={index} className="flex gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-md transition-shadow">
                                <div className="bg-white shadow-xs p-3 rounded-full h-fit border border-slate-100">{person.icon}</div>
                                <div>
                                <h5 className="font-semibold text-lg text-slate-800">{person.name}</h5>
                                <p className="text-sm font-semibold text-red-600 mb-2">{person.role}</p>
                                <p className="text-sm text-slate-600 leading-relaxed">{person.desc}</p>
                                </div>
                            </div>
                            ))}
                        </div>
                        </section>
                    </div>
                </div>
                </div>
            )}
            </div>

        </main>
        </div>
    );
}