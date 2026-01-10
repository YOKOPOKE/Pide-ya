"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/context/ToastContext";

type Order = {
    id: number;
    created_at: string;
    customer_name: string;
    total: number;
    status: 'pending' | 'preparing' | 'completed' | 'cancelled' | 'awaiting_payment';
    payment_status?: string;
    payment_method?: string;
    delivery_method: 'delivery' | 'pickup';
    items: any[];
    address?: string;
    phone?: string;
    pickup_time?: string;
};

interface AdminContextType {
    incomingOrder: Order | null;
    setIncomingOrder: (order: Order | null) => void;
    stopAudio: () => void;
    testAudio: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
    const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const supabase = createClient();
    const { showToast } = useToast();

    // 1. Initialize Audio & Permissions
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.loop = true;
            audioRef.current = audio;

            // Request Notification Permission
            if ("Notification" in window && Notification.permission !== "granted") {
                Notification.requestPermission();
            }
        }
    }, []);

    // 2. Handle Incoming Order Effects (Audio + System Notification)
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (incomingOrder) {
            // Play Sound
            audio.play().catch((err) => console.log('Audio autoplay blocked:', err));

            // System Notification
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("🌮 NUEVO PEDIDO YOKO", {
                    body: `Pedido de ${incomingOrder.customer_name} - $${incomingOrder.total}`,
                    icon: "/icon.png" // Fallback if exists, optional
                });
            }
        } else {
            // Stop Sound
            audio.pause();
            audio.currentTime = 0;
        }
    }, [incomingOrder]);

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    const testAudio = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => showToast("Autoplay bloqueado, interactúa primero", 'error'));
            setTimeout(() => {
                if (audioRef.current && !incomingOrder) audioRef.current.pause();
            }, 2000);
        }
    };

    // 3. Global Subscription
    useEffect(() => {
        const channel = supabase
            .channel('admin-global-orders')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
                const newOrder = payload.new as Order;
                if (newOrder.status === 'awaiting_payment') return;

                setIncomingOrder(newOrder);
                showToast(`🎉 Pedido Global: ${newOrder.customer_name}`, 'success');
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
                const updated = payload.new as Order;
                // Detect late payment confirmation (Stripe webhook)
                if (updated.status === 'pending' && payload.old.status === 'awaiting_payment') {
                    setIncomingOrder(updated);
                    showToast(`💸 Pago confirmado: ${updated.customer_name}`, 'success');
                }
                // Auto-dismiss if handled elsewhere by status change (e.g. approved)
                if (updated.status !== 'pending' && incomingOrder?.id === updated.id) {
                    setIncomingOrder(null);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [incomingOrder]);

    return (
        <AdminContext.Provider value={{ incomingOrder, setIncomingOrder, stopAudio, testAudio }}>
            {children}
        </AdminContext.Provider>
    );
}

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) throw new Error("useAdmin must be used within AdminProvider");
    return context;
};
