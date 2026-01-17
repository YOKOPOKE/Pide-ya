"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';
import {
    CheckCircle, RefreshCw, User, ShoppingBag, MapPin,
    ChefHat, Flame, Timer, BarChart3, ChevronDown,
    Search, Bell, Filter, MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/context/ToastContext';

export const dynamic = 'force-dynamic';

// Types
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

// Hook for elapsed time
const useElapsedMinutes = (dateString: string) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const update = () => {
            const created = new Date(dateString);
            const now = new Date();
            const diffMs = now.getTime() - created.getTime();
            setElapsed(Math.floor(diffMs / 60000));
        };
        update();
        const interval = setInterval(update, 60000);
        return () => clearInterval(interval);
    }, [dateString]);

    return elapsed;
};

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'completed'>('pending');
    const { showToast } = useToast();

    // Supabase
    const supabase = createClient();

    const fetchOrders = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
            showToast('Error al cargar pedidos', 'error');
        } else {
            setOrders(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();

        const channel = supabase
            .channel('admin_orders')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: any) => {
                const newOrder = payload.new as Order;
                setOrders(prev => [newOrder, ...prev]);
                showToast(`Nuevo pedido: #${newOrder.id}`, 'success');
                // Play sound if needed
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload: any) => {
                const updated = payload.new as Order;
                if (updated.status === 'pending' && payload.old.status === 'awaiting_payment') {
                    setOrders(prev => {
                        if (prev.some(o => o.id === updated.id)) return prev.map(o => o.id === updated.id ? updated : o);
                        return [updated, ...prev];
                    });
                } else {
                    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const updateStatus = async (id: number, status: string) => {
        // Optimistic Update
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o));

        try {
            const { error } = await supabase.from('orders').update({ status }).eq('id', id);
            if (error) throw error;
            showToast(status === 'preparing' ? '🔥 A cocinar...' : '✅ Pedido completado', 'success');
        } catch (e) {
            console.error(e);
            showToast('Error al actualizar status', 'error');
            fetchOrders();
        }
    };

    // Stats Logic
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const preparingCount = orders.filter(o => o.status === 'preparing').length;
    const completedCount = orders.filter(o => o.status === 'completed').length;

    // Revenue logic (Today)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayOrders = orders.filter(o => new Date(o.created_at) >= todayStart && o.status !== 'cancelled');
    const totalRevenue = todayOrders.reduce((acc, curr) => acc + curr.total, 0);

    const tabs = [
        { id: 'pending', label: 'Por Aceptar', count: pendingCount, icon: <Flame size={18} /> },
        { id: 'preparing', label: 'Cocinando', count: preparingCount, icon: <ChefHat size={18} /> },
        { id: 'completed', label: 'Entregados', count: completedCount, icon: <CheckCircle size={18} /> },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans text-slate-800">
            {/* --- DASHBOARD HEADER & STATS --- */}
            <div className="max-w-[1600px] mx-auto space-y-8">

                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Panel de Control</h1>
                        <p className="text-sm text-slate-400 font-medium">Bienvenido de nuevo, Chef.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search Bar (Visual) */}
                        <div className="hidden md:flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm focus-within:border-slate-300 transition-all">
                            <Search size={18} className="text-slate-400" />
                            <input placeholder="Buscar pedido..." className="bg-transparent outline-none text-sm font-medium w-48" />
                        </div>

                        <button onClick={fetchOrders} className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors relative">
                            <Bell size={20} />
                            {pendingCount > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-rose-500" />}
                        </button>
                    </div>
                </div>

                {/* Stats Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Stats Card 1: Total Orders */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-100 to-orange-50 flex items-center justify-center text-rose-500 shadow-inner">
                            <ShoppingBag size={24} />
                        </div>
                        <div>
                            <p className="text-3xl font-black text-slate-900">{orders.length}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total Pedidos</p>
                        </div>
                    </div>

                    {/* Stats Card 2: Revenue */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center text-green-500 shadow-inner">
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <p className="text-3xl font-black text-slate-900">${totalRevenue.toLocaleString()}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ingresos Hoy</p>
                        </div>
                    </div>

                    {/* Stats Card 3: Pending (Actionable) */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-rose-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-14 h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                            <Flame size={24} fill="currentColor" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-3xl font-black text-slate-900">{pendingCount}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Pendientes</p>
                        </div>
                    </div>

                    {/* Stats Card 4: Happiness/Other */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
                            <User size={24} />
                        </div>
                        <div>
                            <p className="text-3xl font-black text-slate-900">{todayOrders.length}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Clientes Hoy</p>
                        </div>
                    </div>
                </div>

                {/* --- MAIN CONTENT AREA --- */}
                <div className="flex flex-col gap-6">

                    {/* Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            const activeClass = isActive
                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                                : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100';

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeClass}`}
                                >
                                    {tab.icon}
                                    <span>{tab.label}</span>
                                    {tab.count > 0 && (
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Orders Grid */}
                    <motion.div
                        layout
                        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 content-start min-h-[500px]"
                    >
                        <AnimatePresence mode='popLayout'>
                            {orders
                                .filter(o => o.status === activeTab)
                                .map(order => (
                                    <div key={order.id} className="w-full">
                                        <KitchenTicketCard order={order} updateStatus={updateStatus} />
                                    </div>
                                ))
                            }
                        </AnimatePresence>

                        {/* Empty State */}
                        {orders.filter(o => o.status === activeTab).length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-50">
                                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <ChefHat size={40} className="text-slate-300" />
                                </div>
                                <p className="font-bold text-slate-400">No hay órdenes en esta sección</p>
                            </div>
                        )}
                    </motion.div>
                </div>

            </div>
        </div>
    );
}

// --- NEW COMPONENT: KITCHEN TICKET CARD ---
// Clean, "Davur" style, Yoko Branding
const KitchenTicketCard = ({ order, updateStatus }: { order: Order, updateStatus: any }) => {
    const elapsed = useElapsedMinutes(order.created_at);

    // Status Logic
    const isPending = order.status === 'pending';
    const isPreparing = order.status === 'preparing';

    // Branding Colors
    // Pending = Rose/Orange, Preparing = Blue, Completed = Green/Slate
    const borderColor = isPending ? 'bg-rose-500' : isPreparing ? 'bg-blue-500' : 'bg-green-500';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="group relative bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
        >
            {/* Left Status Stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${borderColor}`} />

            {/* Header */}
            <div className="p-5 pb-3 border-b border-slate-50 flex justify-between items-start pl-6">
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Orden</span>
                    <h3 className="text-2xl font-black text-slate-900 leading-none">#{order.id}</h3>
                    <p className="text-sm font-bold text-slate-600 mt-1 truncate max-w-[150px]">{order.customer_name}</p>
                </div>
                <div className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border ${elapsed > 10 ? 'bg-rose-50 text-rose-500 border-rose-100 animate-pulse' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                    <Timer size={12} />
                    <span>{elapsed}m</span>
                </div>
            </div>

            {/* Info Row */}
            <div className="px-6 py-2 flex items-center gap-3 text-xs font-medium text-slate-400 border-b border-slate-50 bg-slate-50/30">
                {order.delivery_method === 'pickup' ? (
                    <span className="flex items-center gap-1.5"><ShoppingBag size={12} className="text-orange-400" /> Pickup</span>
                ) : (
                    <span className="flex items-center gap-1.5"><MapPin size={12} className="text-indigo-400" /> Delivery</span>
                )}
                <span>•</span>
                <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {order.payment_status === 'paid' && <span className="text-green-500 flex items-center gap-1"><CheckCircle size={10} /> Pagado</span>}
            </div>

            {/* Items List (Scrollable if too long) */}
            <div className="p-6 pt-4 flex-1 space-y-4">
                {order.items.map((item: any, i) => (
                    <div key={i} className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600">
                            1
                        </div>
                        <div className="flex-1 text-sm">
                            <p className="font-bold text-slate-800 leading-tight">{item.name || (item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger')}</p>

                            {/* Detailed Ingredients */}
                            <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1.5">
                                {item.base && <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 rounded border border-slate-100">Base: {item.base.name}</span>}
                                {item.proteins?.map((p: any, idx: number) => (
                                    <span key={idx} className="text-[10px] text-rose-600 bg-rose-50 px-1.5 rounded border border-rose-100">{p.name}</span>
                                ))}
                                {item.sauce && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 rounded border border-amber-100">Salsa: {item.sauce.name}</span>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Action Footer */}
            {isPending && (
                <div className="p-4 pt-0 mt-auto">
                    <button
                        onClick={() => updateStatus(order.id, 'preparing')}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-bold text-sm shadow-xl shadow-rose-200 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Flame size={18} fill="currentColor" className="text-white/90" />
                        COCINAR
                    </button>
                    <div className="text-center mt-3">
                        <span className="text-xs font-bold text-slate-300">Total: ${order.total}</span>
                    </div>
                </div>
            )}

            {isPreparing && (
                <div className="p-4 pt-0 mt-auto">
                    <button
                        onClick={() => updateStatus(order.id, 'completed')}
                        className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-xl shadow-slate-200 hover:shadow-2xl hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={18} />
                        FINALIZAR
                    </button>
                </div>
            )}
        </motion.div>
    );
};
