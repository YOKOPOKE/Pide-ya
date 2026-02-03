"use client";

import { useToast } from "@/context/ToastContext";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export default function ToastContainer() {
    const { toasts, removeToast } = useToast();

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        layout
                        initial={{ opacity: 0, y: 50, scale: 0.3 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                        className="pointer-events-auto min-w-[300px] bg-white/90 backdrop-blur-md border border-white/20 shadow-lg shadow-black/5 p-4 rounded-2xl flex items-center gap-3"
                    >
                        <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center shrink-0
                            ${toast.type === 'success' ? 'bg-green-100 text-green-600' : ''}
                            ${toast.type === 'error' ? 'bg-red-100 text-red-600' : ''}
                            ${toast.type === 'info' ? 'bg-blue-100 text-blue-600' : ''}
                        `}>
                            {toast.type === 'success' && <CheckCircle2 size={20} />}
                            {toast.type === 'error' && <AlertCircle size={20} />}
                            {toast.type === 'info' && <Info size={20} />}
                        </div>

                        <div className="flex-1">
                            <h4 className="font-bold text-sm text-yoko-dark captialize">
                                {toast.type === 'success' ? '¡Éxito!' : toast.type === 'error' ? 'Error' : 'Info'}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">{toast.message}</p>
                        </div>

                        <button
                            onClick={() => removeToast(toast.id)}
                            className="p-1 hover:bg-black/5 rounded-full transition-colors text-slate-400"
                        >
                            <X size={16} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
