"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Check, X, Type } from "lucide-react";
import { useState, useEffect } from "react";

type ModalType = "danger" | "info" | "input" | "success";

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (inputValue?: string) => void;
    title: string;
    message?: string;
    type?: ModalType;
    confirmText?: string;
    cancelText?: string;
    inputPlaceholder?: string;
    initialInputValue?: string;
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = "info",
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    inputPlaceholder = "",
    initialInputValue = ""
}: ConfirmModalProps) {
    const [inputValue, setInputValue] = useState(initialInputValue);

    // Update input value when modal opens or initialValue changes
    useEffect(() => {
        if (isOpen) setInputValue(initialInputValue);
    }, [isOpen, initialInputValue]);

    const handleConfirm = () => {
        onConfirm(inputValue);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-900/40 overflow-hidden"
                    >
                        <div className={`p-6 ${type === 'danger' ? 'bg-rose-50' : type === 'success' ? 'bg-green-50' : 'bg-slate-50'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm 
                                    ${type === 'danger' ? 'bg-white text-rose-500' :
                                        type === 'success' ? 'bg-white text-green-500' :
                                            'bg-white text-violet-500'}`}
                                >
                                    {type === 'danger' && <AlertTriangle size={24} />}
                                    {type === 'success' && <Check size={24} />}
                                    {(type === 'info' || type === 'input') && <Type size={24} />}
                                </div>
                                <div>
                                    <h3 className={`text-xl font-black ${type === 'danger' ? 'text-rose-900' : 'text-slate-900'}`}>
                                        {title}
                                    </h3>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 md:p-8 space-y-6">
                            {message && (
                                <p className="text-slate-600 font-medium leading-relaxed">
                                    {message}
                                </p>
                            )}

                            {type === 'input' && (
                                <div>
                                    <input
                                        autoFocus
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder={inputPlaceholder}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all"
                                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                                    />
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className={`flex-1 py-3 px-4 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95
                                        ${type === 'danger' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' :
                                            type === 'success' ? 'bg-green-500 hover:bg-green-600 shadow-green-200' :
                                                'bg-slate-900 hover:bg-black shadow-slate-200'}`}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
