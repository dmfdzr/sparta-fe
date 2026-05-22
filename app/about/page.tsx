"use client";
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import AppNavbar from '@/components/AppNavbar'; // Import AppNavbar
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    Info, 
    FileText, 
    Activity, 
    CheckCircle, 
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

type TeamMember = {
    name: string;
    role: string;
    desc: string;
    icon: React.ReactNode;
    photo?: string;
};

const TeamMemberCard = ({
    person,
    accentColor = 'red',
    onPhotoClick
}: {
    person: TeamMember;
    accentColor?: 'amber' | 'red' | 'emerald';
    onPhotoClick?: (person: TeamMember) => void;
}) => {
    const accentClass = {
        amber: 'text-amber-600',
        red: 'text-red-600',
        emerald: 'text-emerald-600'
    }[accentColor];

    return (
        <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-red-200 hover:shadow-md">
            <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-100">
                {person.photo ? (
                    <button
                        type="button"
                        onClick={() => onPhotoClick?.(person)}
                        className="relative h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
                        aria-label={`Perbesar foto ${person.name}`}
                    >
                        <Image
                            src={person.photo}
                            alt={`Foto ${person.name}`}
                            fill
                            sizes="(min-width: 768px) 50vw, 100vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    </button>
                ) : (
                    <div className="flex h-full items-center justify-center bg-linear-to-br from-white to-slate-100">
                        <div className="rounded-full border border-slate-100 bg-white p-4 shadow-xs">
                            {person.icon}
                        </div>
                    </div>
                )}
            </div>
            <div className="flex flex-1 flex-col p-5">
                <div className="mb-4 h-fit w-fit rounded-full border border-slate-100 bg-white p-3 shadow-xs">{person.icon}</div>
                <h5 className="text-lg font-semibold text-slate-800">{person.name}</h5>
                <p className={`mb-2 text-sm font-semibold ${accentClass}`}>{person.role}</p>
                <p className="text-sm leading-relaxed text-slate-600">{person.desc}</p>
            </div>
        </div>
    );
};

const PhotoPreviewModal = ({
    person,
    isOpen,
    onClose
}: {
    person: TeamMember | null;
    isOpen: boolean;
    onClose: () => void;
}) => {
    if (!person?.photo) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm transition-opacity duration-300 ${
                isOpen ? 'opacity-100' : 'opacity-0'
            }`}
            role="dialog"
            aria-modal="true"
            aria-label={`Preview foto ${person.name}`}
            onClick={onClose}
        >
            <div
                className={`relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl transition-all duration-300 ease-out ${
                    isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                }`}
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/70 text-xl font-semibold leading-none text-white shadow-lg transition hover:bg-slate-950 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
                    aria-label="Tutup preview foto"
                >
                    ×
                </button>
                <div className="relative aspect-4/3 w-full bg-slate-100">
                    <Image
                        src={person.photo}
                        alt={`Foto ${person.name}`}
                        fill
                        sizes="(min-width: 1024px) 768px, 94vw"
                        className="object-contain"
                        priority
                    />
                </div>
                <div className="px-6 py-5">
                    <h3 className="text-xl font-bold text-slate-900">{person.name}</h3>
                    <p className="text-sm font-semibold text-red-600">{person.role}</p>
                </div>
            </div>
        </div>
    );
};

export default function TentangSparta() {
  // State untuk mengontrol tab yang aktif
    const [activeTab, setActiveTab] = useState<'aplikasi' | 'tim1' | 'tim2' | 'tim3'>('aplikasi');
    const [previewMember, setPreviewMember] = useState<TeamMember | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const openPhotoPreview = (person: TeamMember) => {
        if (!person.photo) return;
        setPreviewMember(person);
        window.requestAnimationFrame(() => setIsPreviewOpen(true));
    };

    const closePhotoPreview = () => {
        setIsPreviewOpen(false);
        window.setTimeout(() => setPreviewMember(null), 300);
    };

    useEffect(() => {
        if (!previewMember) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closePhotoPreview();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [previewMember]);

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
        { name: "Andy Mulyono", role: "Building, Maintenance, & Energy System Manager", desc: "Penggagas utama digitalisasi proses bisnis.", icon: <Lightbulb className="w-6 h-6 text-amber-600" /> }
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
        { name: "Andy Mulyono", role: "Building, Maintenance, & Energy System Manager", desc: "Penggagas utama digitalisasi proses bisnis.", icon: <Lightbulb className="w-6 h-6 text-amber-600" /> },
        { name: "Bima Arya Bhagaskara", role: "Building, Maintenance, & Energy System Specialist", desc: "Pengarah untuk pengembangan lanjutan SPARTA.", icon: <Users className="w-6 h-6 text-amber-600" />, photo: "/assets/dev/bima.jpeg" }
    ];

    const secondTeamDevelopers = [
        { name: "Dimas Abidzar Fadly", role: "Frontend Engineer", desc: "Mengembangkan fitur lanjutan, optimasi UI/UX, re-integrasi API, dan maintenance.", icon: <Rocket className="w-6 h-6 text-red-600" />, photo: "/assets/dev/dimas.jpeg" },
        { name: "Charderra Bagas Eka Sanjaya", role: "Backend Engineer", desc: "Pengembangan endpoint baru, stabilisasi server, dan manajemen arsitektur data lanjutan.", icon: <Wrench className="w-6 h-6 text-red-600" />, photo: "/assets/dev/bagas.jpeg" }
    ];

    const thirdTeamInitiators = [
        { name: "Andy Mulyono", role: "Building, Maintenance, & Energy System Manager", desc: "Penggagas utama digitalisasi proses bisnis.", icon: <Lightbulb className="w-6 h-6 text-amber-600" /> },
        { name: "Bima Arya Bhagaskara", role: "Building, Maintenance, & Energy System Specialist", desc: "Pengarah untuk pengembangan lanjutan SPARTA.", icon: <Users className="w-6 h-6 text-amber-600" />, photo: "/assets/dev/bima.jpeg" }
    ];

    const thirdTeamDevelopers = [
        { name: "Wildan Fadillah", role: "Software Engineer", desc: "Bertanggung jawab atas pengembangan fitur lanjutan, peningkatan stabilitas aplikasi, dan maintenance sistem SPARTA.", icon: <Code className="w-6 h-6 text-red-600" /> }
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
        
        {/* Mengganti header lama dengan AppNavbar */}
        <AppNavbar 
            title="TENTANG SPARTA"
            showBackButton={true}
            backHref="/"
            showBuildingLogo={true}
        />

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
                <button
                onClick={() => setActiveTab('tim3')}
                className={`px-5 py-2.5 rounded-full text-sm md:text-base font-semibold transition-all duration-300 whitespace-nowrap ${
                    activeTab === 'tim3'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-red-600 hover:bg-red-50'
                }`}
                >
                Third Dev Team
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
                                <TeamMemberCard key={index} person={person} accentColor="amber" onPhotoClick={openPhotoPreview} />
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
                            <TeamMemberCard key={index} person={person} accentColor="red" onPhotoClick={openPhotoPreview} />
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
                            <TeamMemberCard key={index} person={person} accentColor="emerald" onPhotoClick={openPhotoPreview} />
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
                    <h2 className="text-3xl font-bold text-slate-800">Second Development Team</h2>
                    <p className="text-slate-500 mt-3 text-lg max-w-2xl mx-auto">
                        Tim pengembang generasi kedua yang berperan dalam pengembangan SPARTA V2, re-integrasi API, peningkatan UI/UX, dan stabilisasi arsitektur sistem sebelum transisi ke tim berikutnya.
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
                                    <TeamMemberCard key={index} person={person} accentColor="amber" onPhotoClick={openPhotoPreview} />
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
                                <TeamMemberCard key={index} person={person} accentColor="red" onPhotoClick={openPhotoPreview} />
                            ))}
                        </div>
                        </section>
                    </div>
                </div>
                </div>
            )}

            {/* SECTION 4: THIRD DEV TEAM */}
            {activeTab === 'tim3' && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 bg-white p-6 md:p-10 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">

                <div className="relative z-10">
                    <div className="text-center mb-12">
                    <div className="inline-block bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide mb-4">
                        ACTIVE MAINTAINER
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800">Third Development Team</h2>
                    <p className="text-slate-500 mt-3 text-lg max-w-2xl mx-auto">
                        Tim yang bertanggung jawab atas pengembangan fitur lanjutan, peningkatan performa, dan pemeliharaan sistem SPARTA saat ini.
                    </p>
                    </div>

                    <div className="space-y-12">
                        {/* Inisiator & Manajemen Ketiga */}
                        <section>
                            <h4 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-3">
                                <div className="bg-amber-100 p-2 rounded-lg"><Lightbulb className="w-6 h-6 text-amber-600" /></div>
                                Inisiator & Manajemen
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {thirdTeamInitiators.map((person, index) => (
                                    <TeamMemberCard key={index} person={person} accentColor="amber" onPhotoClick={openPhotoPreview} />
                                ))}
                            </div>
                        </section>

                        {/* Tim Pengembang Ketiga */}
                        <section>
                        <h4 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="bg-red-100 p-2 rounded-lg"><Rocket className="w-6 h-6 text-red-600" /></div>
                            Tim Pengembang (Third Gen)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {thirdTeamDevelopers.map((person, index) => (
                                <TeamMemberCard key={index} person={person} accentColor="red" onPhotoClick={openPhotoPreview} />
                            ))}
                        </div>
                        </section>
                    </div>
                </div>
                </div>
            )}
            </div>

        </main>
        <PhotoPreviewModal person={previewMember} isOpen={isPreviewOpen} onClose={closePhotoPreview} />
        </div>
    );
}
