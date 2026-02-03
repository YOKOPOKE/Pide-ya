"use client";

import { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';

interface ImageUploadProps {
    value?: string;
    onChange: (url: string) => void;
    folder?: string; // Optional folder path inside bucket
    className?: string;
}

export function ImageUpload({ value, onChange, folder = 'uploads', className = '' }: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const file = e.target.files?.[0];
            if (!file) return;

            setUploading(true);

            const fileExt = file.name.split('.').pop();
            const fileName = `${folder}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

            const { error: uploadError, data } = await supabase.storage
                .from('menu-images')
                .upload(fileName, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data: publicUrlData } = supabase.storage
                .from('menu-images')
                .getPublicUrl(fileName);

            onChange(publicUrlData.publicUrl);
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Error al subir la imagen');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRemove = () => {
        onChange('');
    };

    return (
        <div className={`w-full relative ${className}`}>

            {value ? (
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border-2 border-slate-200 group bg-slate-100">
                    <img
                        src={value}
                        alt="Upload"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white/20 hover:bg-white/40 text-white p-2 rounded-full transition-colors backdrop-blur-sm"
                        >
                            <Upload size={20} />
                        </button>
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full transition-colors backdrop-blur-sm"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                        border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-slate-400
                        hover:border-violet-400 hover:text-violet-500 hover:bg-violet-50 transition-all cursor-pointer aspect-video
                        ${uploading ? 'opacity-50 pointer-events-none' : ''}
                    `}
                >
                    {uploading ? (
                        <Loader2 size={32} className="animate-spin text-violet-600" />
                    ) : (
                        <>
                            <div className="p-3 bg-slate-100 rounded-full mb-1 group-hover:bg-violet-100 transition-colors">
                                <ImageIcon size={24} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">Subir Imagen</span>
                        </>
                    )}
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
        </div>
    );
}
