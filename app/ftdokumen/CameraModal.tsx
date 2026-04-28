"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, Upload, Ban, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PhotoPoint } from './photoPoints';

type PhotoData = { url: string; note: string | null; timestamp: string };

interface CameraModalProps {
    point: PhotoPoint;
    onClose: () => void;
    onCapture: (pointId: number, data: PhotoData) => void;
    existingPhoto?: PhotoData | null;
}

export default function CameraModal({ point, onClose, onCapture, existingPhoto }: CameraModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
    const [viewOnly, setViewOnly] = useState(false);

    const startCamera = useCallback(async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            if (!videoRef.current) {
                // Component unmounted while waiting for camera
                s.getTracks().forEach(t => t.stop());
                return;
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
            streamRef.current = s;
            setStream(s);
            videoRef.current.srcObject = s;
        } catch { /* camera not available, user can still upload */ }
    }, []);

    const stopCamera = useCallback(() => { 
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setStream(null); 
    }, []);

    useEffect(() => {
        if (existingPhoto && existingPhoto.url) {
            setCapturedUrl(existingPhoto.url);
            setViewOnly(true);
        } else {
            startCamera();
        }
        return () => { stopCamera(); };
    }, [existingPhoto, startCamera, stopCamera]);

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const v = videoRef.current;
        const c = canvasRef.current;
        
        let w = v.videoWidth;
        let h = v.videoHeight;
        
        // Determine if video is portrait
        const isPortrait = h > w;
        
        // Force landscape dimensions
        let canvasW = isPortrait ? h : w;
        let canvasH = isPortrait ? w : h;

        const MAX = 1280;
        if (canvasW > MAX) { 
            canvasH = Math.round(canvasH * (MAX / canvasW)); 
            canvasW = MAX; 
        }

        c.width = canvasW; 
        c.height = canvasH;
        
        const ctx = c.getContext("2d")!;
        
        if (isPortrait) {
            // Rotate 90 degrees if it's portrait to force landscape
            ctx.translate(canvasW / 2, canvasH / 2);
            ctx.rotate(90 * Math.PI / 180);
            ctx.drawImage(v, -canvasH / 2, -canvasW / 2, canvasH, canvasW);
        } else {
            ctx.drawImage(v, 0, 0, canvasW, canvasH);
        }
        
        const dataUrl = c.toDataURL("image/jpeg", 0.7);
        setCapturedUrl(dataUrl);
        setViewOnly(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => { setCapturedUrl(reader.result as string); setViewOnly(false); };
        reader.readAsDataURL(file);
    };

    const handleConfirm = () => {
        if (!capturedUrl) return;
        stopCamera();
        onCapture(point.id, { url: capturedUrl, note: null, timestamp: new Date().toISOString() });
    };

    const handleCantSnap = () => {
        stopCamera();
        onCapture(point.id, { url: "/assets/fototidakbisadiambil.jpeg", note: "TIDAK BISA DIFOTO", timestamp: new Date().toISOString() });
    };

    const handleRetake = () => { setCapturedUrl(null); setViewOnly(false); startCamera(); };
    const handleClose = () => { stopCamera(); onClose(); };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
            <div className="relative w-full max-w-lg aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-3 bg-linear-to-b from-black/80 to-transparent">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs">
                            {point.id}
                        </div>
                        <span className="text-white font-semibold text-sm drop-shadow-md">
                            {point.label}
                        </span>
                    </div>
                    <button onClick={handleClose} className="text-white hover:text-red-400 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Viewfinder */}
                <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                    {capturedUrl ? (
                        <img src={capturedUrl} alt="Captured" className="w-full h-full object-contain" />
                    ) : (
                        <>
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            {/* Grid Overlay */}
                            <div className="absolute inset-0 pointer-events-none opacity-30 border border-white/20 z-10">
                                <div className="w-full h-1/3 border-b border-white/40 absolute top-1/3"></div>
                                <div className="w-full h-1/3 border-b border-white/40 absolute top-2/3"></div>
                                <div className="h-full w-1/3 border-r border-white/40 absolute left-1/3"></div>
                                <div className="h-full w-1/3 border-r border-white/40 absolute left-2/3"></div>
                            </div>

                            {/* Landscape Hint */}
                            <div className="absolute top-10 left-0 right-0 flex justify-center pointer-events-none z-10">
                                <div className="bg-black/60 text-white/90 text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
                                    <RotateCcw className="w-3 h-3" />
                                    Miringkan HP
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Controls Panel */}
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-linear-to-t from-black/90 via-black/70 to-transparent z-20">
                    {!capturedUrl ? (
                        <div className="flex justify-between items-center px-4">
                            <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition border border-white/30">
                                <Upload className="w-4 h-4 text-white" />
                            </button>
                            <button onClick={handleCapture} className="w-14 h-14 rounded-full border-[3px] border-white flex items-center justify-center active:scale-95 transition">
                                <div className="w-10 h-10 bg-white rounded-full"></div>
                            </button>
                            <button onClick={handleCantSnap} className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition border border-red-500/50">
                                <Ban className="w-4 h-4 text-red-400" />
                            </button>
                        </div>
                    ) : !viewOnly ? (
                        <div className="flex gap-2">
                            <Button onClick={handleRetake} variant="outline" className="flex-1 h-10 bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs">
                                <RotateCcw className="w-4 h-4 mr-1" /> Ulangi
                            </Button>
                            <Button onClick={handleConfirm} className="flex-1 h-10 bg-white hover:bg-slate-200 text-black font-bold text-xs">
                                <Check className="w-4 h-4 mr-1" /> Gunakan
                            </Button>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <Button onClick={handleRetake} variant="outline" className="h-10 bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs">
                                <RotateCcw className="w-4 h-4 mr-1" /> Ambil Ulang Foto
                            </Button>
                        </div>
                    )}
                </div>
                
                <canvas ref={canvasRef} className="hidden" />
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </div>
        </div>
    );
}
