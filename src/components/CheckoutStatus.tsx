"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { UtensilsCrossed, CheckCircle2, Send, ChefHat } from 'lucide-react';
import { useEffect, useState } from 'react';

export type CheckoutStep = 'idle' | 'sending' | 'notifying' | 'success';

interface CheckoutStatusProps {
    step: CheckoutStep;
    className?: string;
}

export default function CheckoutStatus({ step, className = '' }: CheckoutStatusProps) {
    if (step === 'idle') return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 bg-white/95 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-8 text-center ${className}`}
        >
            <div className="w-24 h-24 relative mb-8">
                {/* Background Ring */}
                <div className="absolute inset-0 rounded-full border-4 border-gray-100" />

                <AnimatePresence mode="wait">
                    {step === 'sending' && (
                        <motion.div
                            key="sending"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute inset-0 flex items-center justify-center"
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 rounded-full border-4 border-transparent border-t-yoko-primary border-r-yoko-primary"
                            />
                            <Send className="text-yoko-primary" size={32} />
                        </motion.div>
                    )}

                    {step === 'notifying' && (
                        <motion.div
                            key="notifying"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute inset-0 flex items-center justify-center"
                        >
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="absolute inset-0 rounded-full bg-orange-50"
                            />
                            <motion.div
                                animate={{ rotate: [0, 10, -10, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <ChefHat className="text-orange-500 relative z-10" size={40} />
                            </motion.div>
                        </motion.div>
                    )}

                    {step === 'success' && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1, rotate: [0, -10, 10, 0] }}
                            transition={{
                                scale: { type: "spring", stiffness: 300, damping: 20 },
                                rotate: { duration: 0.5 },
                                opacity: { duration: 0.2 }
                            }}
                            className="absolute inset-0 flex items-center justify-center bg-green-100 rounded-full"
                        >
                            <CheckCircle2 className="text-green-600" size={48} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="h-16 relative w-full max-w-xs">
                <AnimatePresence mode="wait">
                    {step === 'sending' && (
                        <motion.div
                            key="text-sending"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute inset-0"
                        >
                            <h3 className="text-xl font-bold text-yoko-dark mb-1">Mandando Pedido...</h3>
                            <p className="text-sm text-gray-400">Creando orden</p>
                        </motion.div>
                    )}

                    {step === 'notifying' && (
                        <motion.div
                            key="text-notifying"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute inset-0"
                        >
                            <h3 className="text-xl font-bold text-yoko-dark mb-1">Notificando al Restaurante...</h3>
                            <p className="text-sm text-gray-400">Preparando la cocina</p>
                        </motion.div>
                    )}

                    {step === 'success' && (
                        <motion.div
                            key="text-success"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute inset-0"
                        >
                            <h3 className="text-2xl font-black text-yoko-dark mb-1">¡Pedido Confirmado!</h3>
                            <p className="text-sm text-gray-400">Tu orden ha sido recibida</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
