"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Clock, CheckCircle, RefreshCw, User, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/components/ui/Toast';

export const dynamic = 'force-dynamic';

// Types
type Order = {
    id: number;
    created_at: string;
    customer_name: string;
    total: number;
    status: 'pending' | 'preparing' | 'completed' | 'cancelled';
    delivery_method: 'delivery' | 'pickup';
    items: any[]; // JSON
    address?: string;
    phone?: string;
    pickup_time?: string;
};

export default function AdminOrdersPage() {
    const supabase = createClient();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio once
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.loop = true;
            audioRef.current = audio;
        }
    }, []);

    // Handle Incoming Order Audio
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (incomingOrder) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log("Audio play failed - interaction needed", e));
        } else {
            audio.pause();
            audio.currentTime = 0;
        }
    }, [incomingOrder]);

    const fetchOrders = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (data) setOrders(data as Order[]);
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();

        // Realtime subscription
        const channel = supabase
            .channel('orders')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
                const newOrder = payload.new as Order;
                setOrders(prev => [newOrder, ...prev]);
                setIncomingOrder(newOrder); // Open Modal which triggers audio
                toast.success(`¡Nuevo pedido de ${newOrder.customer_name}!`);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const updateStatus = async (id: number, status: string) => {
        const { error } = await supabase.from('orders').update({ status }).eq('id', id);

        if (error) {
            console.error('Error updating status:', error);
            toast.error('Error al guardar estado (Revisa Permisos DB).');
        } else {
            // Optimistic update
            setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o));
            toast.success('Estado actualizado');
        }
    };

    const handleAcceptOrder = async () => {
        if (incomingOrder) {
            // Optional: Auto-move to preparing or just acknowledge?
            // User workflow seems to be: Acknowledge -> Then click "Cook" manually or "Accept" implies cooking.
            // Let's just acknowledge for now to stop sound.
            setIncomingOrder(null);
        }
    };

    const handleRejectOrder = async () => {
        if (!incomingOrder) return;

        const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', incomingOrder.id);

        if (error) {
            toast.error('Error al rechazar pedido');
        } else {
            setOrders(prev => prev.map(o => o.id === incomingOrder.id ? { ...o, status: 'cancelled' } : o));
            toast.info('Pedido rechazado');
        }
        setIncomingOrder(null);
    };

    const columns = {
        pending: { label: 'Pendientes', color: 'bg-yellow-50 text-yellow-600 border-yellow-200', icon: <Clock className="text-yellow-600" /> },
        preparing: { label: 'Preparando', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: <RefreshCw className="text-blue-600" /> },
        completed: { label: 'Listos/Entregados', color: 'bg-green-50 text-green-600 border-green-200', icon: <CheckCircle className="text-green-600" /> }
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col text-yoko-dark relative">

            {/* INCOMING ORDER MODAL */}
            <AnimatePresence>
                {incomingOrder && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative"
                        >
                            {/* Header */}
                            <div className="bg-red-600 text-white p-6 text-center animate-pulse">
                                <h2 className="text-4xl font-black uppercase tracking-widest">¡Nuevo Pedido!</h2>
                                <p className="text-lg opacity-90 mt-2">La cocina te necesita 👨‍🍳🔥</p>
                            </div>

                            {/* Content */}
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-2xl font-bold text-yoko-dark">{incomingOrder.customer_name}</h3>
                                        <div className="flex gap-2 mt-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${incomingOrder.delivery_method === 'pickup' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                                                {incomingOrder.delivery_method === 'pickup' ? 'Recoger' : 'Domicilio'}
                                            </span>
                                            {incomingOrder.delivery_method === 'pickup' && incomingOrder.pickup_time && (
                                                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                                                    ⏰ {incomingOrder.pickup_time}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-500">Total</p>
                                        <p className="text-4xl font-serif font-bold text-yoko-primary">${incomingOrder.total}</p>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-6 mb-8 max-h-60 overflow-y-auto custom-scrollbar border border-gray-100">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-4">Detalles del Pedido</h4>
                                    <ul className="space-y-4">
                                        {Array.isArray(incomingOrder.items) && incomingOrder.items.map((item: any, idx: number) => (
                                            <li key={idx} className="flex gap-4 border-b border-gray-200 last:border-0 pb-4 last:pb-0">
                                                <div className="bg-white w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm text-xl border border-gray-100">
                                                    {item.productType === 'bowl' ? '🥣' : '🍔'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800">{item.name || (item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger')}</p>
                                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                        {item.base ? `Base: ${item.base.name}. ` : ''}
                                                        {[...(item.proteins || []), ...(item.mixins || [])].map((i: any) => i.name).join(', ')}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={handleRejectOrder}
                                        className="py-4 rounded-xl font-bold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                                    >
                                        Rechazar / Cancelar
                                    </button>
                                    <button
                                        onClick={handleAcceptOrder}
                                        className="py-4 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transition-all transform active:scale-95"
                                    >
                                        ¡Aceptado! A Cocinar 🍳
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex justify-between items-center mb-6 px-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pedidos en Vivo</h1>
                    <p className="text-gray-500 text-sm">Gestiona el flujo de la cocina en tiempo real.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            if (audioRef.current) {
                                audioRef.current.currentTime = 0;
                                audioRef.current.play();
                                setTimeout(() => audioRef.current?.pause(), 2000);
                            }
                            toast.info('Probando sonido...');
                        }}
                        className="p-3 text-xs font-bold text-gray-400 hover:text-yoko-dark transition"
                    >
                        🔊 Test
                    </button>
                    <button
                        onClick={fetchOrders}
                        className="p-3 bg-white hover:bg-gray-50 rounded-full transition-colors border border-gray-200 shadow-sm"
                    >
                        <RefreshCw size={20} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden pb-4">
                {(Object.entries(columns) as [keyof typeof columns, any][]).map(([status, config]) => (
                    <div key={status} className="flex flex-col bg-white rounded-3xl p-4 border border-gray-200 h-full shadow-lg shadow-gray-100">
                        <div className={`flex items-center gap-3 font-bold p-4 rounded-2xl mb-4 border ${config.color}`}>
                            {config.icon}
                            <span className="tracking-wide">{config.label}</span>
                            <span className="ml-auto bg-white/50 px-3 py-1 rounded-lg text-sm tabular-nums shadow-sm">
                                {orders.filter(o => o.status === status).length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            <AnimatePresence mode='popLayout'>
                                {orders.filter(o => o.status === status).map(order => (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        key={order.id}
                                        className="bg-white p-5 rounded-2xl border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer group shadow-sm relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="font-bold text-lg text-yoko-dark">#{order.id}</span>
                                            <span className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded-lg">
                                                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={`p-1.5 rounded-full ${order.delivery_method === 'pickup' ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'}`}>
                                                {order.delivery_method === 'pickup' ? <ShoppingBag size={14} /> : <User size={14} />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-700 text-sm truncate">{order.customer_name || 'Sin Nombre'}</p>
                                                {order.delivery_method === 'pickup' && order.pickup_time && (
                                                    <p className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded ml-1 inline-block">
                                                        ⏰ {order.pickup_time}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-xs text-gray-500 mb-4 line-clamp-3 leading-relaxed">
                                            {Array.isArray(order.items) ? (
                                                <ul className="list-disc pl-4 space-y-1">
                                                    {order.items.map((item: any, idx: number) => (
                                                        <li key={idx}>
                                                            <span className="text-yoko-dark font-medium">1x</span> {item.name || 'Bowl Personalizado'}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : 'Detalles...'}
                                        </div>

                                        <div className="flex justify-between items-center border-t border-gray-100 pt-4 mt-2">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total</span>
                                                <span className="font-serif font-bold text-2xl text-yoko-dark">${order.total}</span>
                                            </div>

                                            {status === 'pending' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'preparing'); }}
                                                    className="group bg-yoko-dark text-white px-6 py-3 rounded-full text-sm font-bold shadow-lg shadow-yoko-dark/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                                >
                                                    <span className="group-hover:animate-pulse">🔥</span> A Cocinar
                                                </button>
                                            )}
                                            {status === 'preparing' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'completed'); }}
                                                    className="group bg-green-500 text-white px-6 py-3 rounded-full text-sm font-bold shadow-lg shadow-green-500/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                                >
                                                    <CheckCircle size={18} className="group-hover:rotate-12 transition-transform" />
                                                    {order.delivery_method === 'pickup' ? 'Listo p/ Recoger' : 'Enviado'}
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {orders.filter(o => o.status === status).length === 0 && (
                                <div className="text-center py-20 opacity-40">
                                    <div className="text-5xl mb-4 grayscale">🍃</div>
                                    <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Sin pedidos</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
