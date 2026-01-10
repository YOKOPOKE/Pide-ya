'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import CheckoutStatus, { CheckoutStep } from '@/components/CheckoutStatus';
import { motion } from 'framer-motion';

function ReturnContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const orderId = searchParams.get('orderId');
    const [status, setStatus] = useState<CheckoutStep>('idle');

    useEffect(() => {
        if (sessionId) {
            // Start the sequence
            const sequence = async () => {
                setStatus('notifying');
                await new Promise(r => setTimeout(r, 4000)); // Simulate notifying restaurant
                setStatus('success');
                localStorage.removeItem('cart'); // Clear cart on success
                localStorage.removeItem('yoko-cart');
            };
            sequence();
        }
    }, [sessionId]);

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute inset-0 bg-green-50/30 z-0" />

            <div className="relative z-10 w-full max-w-md bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-gray-100 min-h-[400px] flex flex-col items-center justify-center">
                {status === 'success' ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center"
                    >
                        <CheckoutStatus step="success" className="!static !bg-transparent !inset-auto !p-0 mb-6" />

                        <p className="text-gray-500 mb-8 max-w-xs mx-auto">
                            Tu orden <span className="font-bold text-gray-800">#{orderId?.slice(0, 8)}</span> ha sido confirmada y enviada a cocina.
                        </p>

                        <Link
                            href="/"
                            className="bg-yoko-primary text-white font-bold py-4 px-8 rounded-2xl flex items-center gap-2 hover:bg-yoko-dark transition-all shadow-lg active:scale-95"
                        >
                            Volver al Menú <ArrowRight size={20} />
                        </Link>
                    </motion.div>
                ) : (
                    <CheckoutStatus step={status === 'idle' ? 'sending' : status} className="!static !bg-transparent !inset-auto !p-0" />
                )}
            </div>
        </div>
    );
}

export default function ReturnPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-white">
                <CheckoutStatus step="sending" />
            </div>
        }>
            <ReturnContent />
        </Suspense>
    );
}
