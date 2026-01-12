"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { CheckCircle, RefreshCw, User, ShoppingBag, MapPin, ChefHat, Flame, Timer, BarChart3 } from 'lucide-react';
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
    const [minutes, setMinutes] = useState(0);
    useEffect(() => {
        const update = () => {
            const diff = new Date().getTime() - new Date(dateString).getTime();
            setMinutes(Math.floor(diff / 60000));
        };
        update();
        const interval = setInterval(update, 30000);
        return () => clearInterval(interval);
    }, [dateString]);
    return minutes;
};

export default function AdminOrdersPage() {
    const supabase = createClient();
    const { showToast } = useToast();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'completed'>('pending');
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

    // NOTE: Audio and IncomingOrderModal are now handled globally in AdminContext/Layout
    // We only manage the list view here.

    const fetchOrders = async () => {
        setLoading(true);
        // Fetch orders, but exclude those stuck in 'awaiting_payment' (abandoned checkout)
        const { data } = await supabase.from('orders')
            .select('*')
            .neq('status', 'awaiting_payment')
            .order('created_at', { ascending: false })
            .limit(50);
        if (data) setOrders(data as Order[]);
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();
        const channel = supabase
            .channel('kitchen-ultra-v3')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
                const newOrder = payload.new as Order;
                if (newOrder.status === 'awaiting_payment') return;

                setOrders(prev => {
                    if (prev.some(o => o.id === newOrder.id)) return prev;
                    return [newOrder, ...prev];
                });
                // No toast here, AdminContext handles it
            })
            // Listen for UPDATES
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
                const updated = payload.new as Order;
                if (updated.status === 'pending' && payload.old.status === 'awaiting_payment') {
                    // Stripe confirmation
                    setOrders(prev => {
                        if (prev.some(o => o.id === updated.id)) return prev.map(o => o.id === updated.id ? updated : o);
                        return [updated, ...prev];
                    });
                } else {
                    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') console.log('Orders List Synced');
            });
        return () => { supabase.removeChannel(channel); };
    }, []);

    const updateStatus = async (id: number, status: string) => {
        // Optimistic Update
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o));

        try {
            const { error } = await supabase.from('orders').update({ status }).eq('id', id);

            if (error) {
                throw error;
            }

            showToast(status === 'preparing' ? '🔥 A cocinar...' : '✅ Pedido completado', 'success');
        } catch (e) {
            console.error(e);
            showToast('Error al actualizar status', 'error');
            // Revert changes if needed or re-fetch
            fetchOrders();
        }
    };

    // Stats Logic
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const preparingCount = orders.filter(o => o.status === 'preparing').length;
    const completedCount = orders.filter(o => o.status === 'completed').length;
    const totalRevenue = orders.reduce((acc, curr) => acc + (curr.status !== 'cancelled' ? curr.total : 0), 0);

    // Mock Data for Mini Chart (Last 5 orders amount)
    const recentSales = orders.slice(0, 7).map(o => o.total).reverse();
    const maxSale = Math.max(...recentSales, 100);

    const tabs = [
        { id: 'pending', label: 'Pendientes', icon: <Flame size={18} />, count: pendingCount, color: 'from-amber-500 to-orange-500' },
        { id: 'preparing', label: 'Cocinando', icon: <ChefHat size={18} />, count: preparingCount, color: 'from-blue-500 to-indigo-500' },
        { id: 'completed', label: 'Entregados', icon: <CheckCircle size={18} />, count: completedCount, color: 'from-green-500 to-emerald-500' },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-24 md:pb-0 relative overflow-hidden">

            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-200/50 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-200/50 blur-[100px]" />
            </div>

            {/* --- DASHBOARD HEADER --- */}
            <div className="sticky top-0 z-40">
                <div className="absolute inset-0 bg-white/80 backdrop-blur-xl border-b border-white/40 shadow-sm" />

                <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                        {/* Left: Brand & Time */}
                        <div className="flex items-center gap-4">
                            <div className="bg-gradient-to-br from-rose-500 to-orange-500 text-white p-2.5 rounded-xl shadow-lg shadow-rose-500/30">
                                <ChefHat size={24} />
                            </div>
                            <div>
                                <h1 className="font-black text-xl tracking-tight text-slate-800">YOKO KITCHEN</h1>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live System
                                </p>
                            </div>
                        </div>

                        {/* Center: Analytics Cards */}
                        <div className="hidden md:flex items-center gap-4">
                            {/* Revenue Card */}
                            <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/60 p-2 pr-4 flex items-center gap-3">
                                <div className="bg-green-100 text-green-600 p-2 rounded-xl">
                                    <BarChart3 size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Ventas Hoy</span>
                                    <span className="text-sm font-black text-slate-800">${totalRevenue.toLocaleString()}</span>
                                </div>
                                {/* Mini Sparkline Chart */}
                                <div className="flex items-end gap-0.5 h-6 pl-2">
                                    {recentSales.map((val, i) => (
                                        <div key={i} style={{ height: `${(val / maxSale) * 100}%` }} className="w-1 bg-green-200 rounded-t-sm" />
                                    ))}
                                </div>
                            </div>

                            {/* Orders Card */}
                            <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/60 p-2 pr-4 flex items-center gap-3">
                                <div className="bg-blue-100 text-blue-600 p-2 rounded-xl">
                                    <ShoppingBag size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Entregados</span>
                                    <span className="text-sm font-black text-slate-800">{completedCount} / {orders.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">
                            <div className="hidden md:flex bg-slate-100 p-1 rounded-full mr-2">
                                <button onClick={() => setViewMode('kanban')} className={`p-2 rounded-full transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}><BarChart3 size={16} className="rotate-90" /></button>
                                <button onClick={() => setViewMode('list')} className={`p-2 rounded-full transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}><BarChart3 size={16} /></button>
                            </div>
                            <button onClick={fetchOrders} className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-slate-50 border border-slate-200 shadow-sm text-slate-500 hover:text-slate-800 transition-all active:scale-95">
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {/* Mobile Analytics Summary */}
                    <div className="md:hidden grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-white/50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">Ventas</span>
                            <span className="text-sm font-black text-slate-800">${totalRevenue}</span>
                        </div>
                        <div className="bg-white/50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">Pedidos</span>
                            <span className="text-sm font-black text-slate-800">{orders.length}</span>
                        </div>
                    </div>
                </div>

                {/* Mobile Tabs */}
                <div className="md:hidden flex justify-center pb-2 relative z-10 px-4 mt-2">
                    <div className="flex bg-white/80 backdrop-blur-md p-1 rounded-2xl shadow-sm border border-slate-200/60 w-full">
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex-1 relative flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${isActive ? 'text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                                >
                                    {isActive && (
                                        <motion.div layoutId="activeTab" className={`absolute inset-0 bg-gradient-to-r ${tab.color} rounded-xl`} />
                                    )}
                                    <span className="relative z-10 flex items-center gap-1.5">
                                        {tab.count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>}
                                        {tab.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="max-w-screen-2xl mx-auto p-4 md:p-8 relative z-10">

                {/* Desktop Tabs */}
                <div className="hidden md:flex justify-start mb-6">
                    <div className="bg-slate-100/50 p-1 rounded-2xl flex gap-1">
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${isActive ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'}`}
                                >
                                    {tab.id === 'pending' && <Flame size={16} className={isActive ? 'text-amber-500' : ''} />}
                                    {tab.id === 'preparing' && <ChefHat size={16} className={isActive ? 'text-blue-500' : ''} />}
                                    {tab.id === 'completed' && <CheckCircle size={16} className={isActive ? 'text-green-500' : ''} />}
                                    {tab.label}
                                    {tab.count > 0 && (
                                        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'}`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Desktop Content Area (Single Column based on Tab) */}
                <div className="hidden md:block h-[calc(100vh-220px)]">
                    <AnimatePresence mode='wait'>
                        {/* PENDING TAB */}
                        {activeTab === 'pending' && (
                            <motion.div
                                key="pending"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="h-full flex flex-col bg-slate-50/50 rounded-3xl border-2 border-slate-200/60 overflow-hidden shadow-sm"
                            >
                                <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><Flame size={14} className="text-amber-500" /> Por Aceptar</h3>
                                    <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded text-xs">{pendingCount}</span>
                                </div>
                                <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 content-start">
                                    <AnimatePresence mode='popLayout'>
                                        {orders.filter(o => o.status === 'pending').map(order => (
                                            <div key={order.id} className="w-full">
                                                <OrderCardUltra order={order} updateStatus={updateStatus} />
                                            </div>
                                        ))}
                                    </AnimatePresence>
                                    {pendingCount === 0 && <div className="col-span-full"><EmptyStateUltra /></div>}
                                </div>
                            </motion.div>
                        )}

                        {/* PREPARING TAB */}
                        {activeTab === 'preparing' && (
                            <motion.div
                                key="preparing"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="h-full flex flex-col bg-blue-50/30 rounded-3xl border-2 border-blue-100/50 overflow-hidden shadow-sm"
                            >
                                <div className="p-4 bg-white border-b border-blue-100 flex justify-between items-center">
                                    <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><ChefHat size={14} className="text-blue-500" /> Cocinando</h3>
                                    <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-xs">{preparingCount}</span>
                                </div>
                                <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 content-start">
                                    <AnimatePresence mode='popLayout'>
                                        {orders.filter(o => o.status === 'preparing').map(order => (
                                            <div key={order.id} className="w-full">
                                                <OrderCardUltra order={order} updateStatus={updateStatus} />
                                            </div>
                                        ))}
                                    </AnimatePresence>
                                    {preparingCount === 0 && <div className="col-span-full"><EmptyStateUltra /></div>}
                                </div>
                            </motion.div>
                        )}

                        {/* COMPLETED TAB */}
                        {activeTab === 'completed' && (
                            <motion.div
                                key="completed"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="h-full flex flex-col bg-green-50/30 rounded-3xl border-2 border-green-100/50 overflow-hidden shadow-sm"
                            >
                                <div className="p-4 bg-white border-b border-green-100 flex justify-between items-center">
                                    <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><CheckCircle size={14} className="text-green-500" /> Resumen</h3>
                                    <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded text-xs">{completedCount}</span>
                                </div>
                                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                        <AnimatePresence mode='popLayout'>
                                            {orders.filter(o => o.status === 'completed').map(order => (
                                                <CompactOrderCard key={order.id} order={order} />
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                    {completedCount === 0 && <EmptyStateUltra />}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Mobile Layout (Styled Container) */}
                <div className="md:hidden h-[calc(100vh-240px)]">
                    <AnimatePresence mode='wait'>
                        {/* PENDING MOBILE */}
                        {activeTab === 'pending' && (
                            <motion.div
                                key="pending-mobile"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="h-full flex flex-col bg-slate-50/50 rounded-3xl border-2 border-slate-200/60 overflow-hidden shadow-sm"
                            >
                                <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><Flame size={14} className="text-amber-500" /> Pendientes</h3>
                                    <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded text-xs">{pendingCount}</span>
                                </div>
                                <div className="p-4 overflow-y-auto space-y-4 custom-scrollbar flex-1">
                                    <AnimatePresence mode='popLayout'>
                                        {orders.filter(o => o.status === 'pending').map(order => (
                                            <OrderCardUltra key={order.id} order={order} updateStatus={updateStatus} />
                                        ))}
                                    </AnimatePresence>
                                    {pendingCount === 0 && <EmptyStateUltra />}
                                </div>
                            </motion.div>
                        )}

                        {/* PREPARING MOBILE */}
                        {activeTab === 'preparing' && (
                            <motion.div
                                key="preparing-mobile"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="h-full flex flex-col bg-blue-50/30 rounded-3xl border-2 border-blue-100/50 overflow-hidden shadow-sm"
                            >
                                <div className="p-4 bg-white border-b border-blue-100 flex justify-between items-center">
                                    <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><ChefHat size={14} className="text-blue-500" /> Cocinando</h3>
                                    <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-xs">{preparingCount}</span>
                                </div>
                                <div className="p-4 overflow-y-auto space-y-4 custom-scrollbar flex-1">
                                    <AnimatePresence mode='popLayout'>
                                        {orders.filter(o => o.status === 'preparing').map(order => (
                                            <OrderCardUltra key={order.id} order={order} updateStatus={updateStatus} />
                                        ))}
                                    </AnimatePresence>
                                    {preparingCount === 0 && <EmptyStateUltra />}
                                </div>
                            </motion.div>
                        )}

                        {/* COMPLETED MOBILE */}
                        {activeTab === 'completed' && (
                            <motion.div
                                key="completed-mobile"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="h-full flex flex-col bg-green-50/30 rounded-3xl border-2 border-green-100/50 overflow-hidden shadow-sm"
                            >
                                <div className="p-4 bg-white border-b border-green-100 flex justify-between items-center">
                                    <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><CheckCircle size={14} className="text-green-500" /> Entregados</h3>
                                    <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded text-xs">{completedCount}</span>
                                </div>
                                <div className="p-4 overflow-y-auto space-y-4 custom-scrollbar flex-1">
                                    <AnimatePresence mode='popLayout'>
                                        {orders.filter(o => o.status === 'completed').map(order => (
                                            <CompactOrderCard key={order.id} order={order} mobile />
                                        ))}
                                    </AnimatePresence>
                                    {completedCount === 0 && <EmptyStateUltra />}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </div>
    );
}

// --- COMPACT & ULTRA COMPONENTS ---

const CompactOrderCard = ({ order, mobile }: { order: Order, mobile?: boolean }) => (
    <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex items-center justify-between group hover:border-green-200 transition-all ${mobile ? 'mb-2' : ''}`}
    >
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                <CheckCircle size={14} />
            </div>
            <div>
                <p className="font-bold text-slate-800 text-sm">{order.customer_name}</p>
                <p className="text-[10px] text-slate-400 font-mono">#{order.id} • ${order.total}</p>
            </div>
        </div>

        <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md block mb-1">
                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {order.delivery_method === 'pickup' ? <ShoppingBag size={12} className="ml-auto text-orange-400" /> : <User size={12} className="ml-auto text-indigo-400" />}
        </div>
    </motion.div>
);

const OrderCardUltra = ({ order, updateStatus }: { order: Order, updateStatus: any }) => {
    const elapsed = useElapsedMinutes(order.created_at);

    // Status Logic
    const isPending = order.status === 'pending';
    const isPreparing = order.status === 'preparing';

    // Timer Style
    let timerStyle = 'text-slate-400 bg-slate-50 border-slate-100';
    if (isPending) {
        if (elapsed > 10) timerStyle = 'text-white bg-red-500 border-red-500 animate-pulse shadow-red-200';
        else if (elapsed > 5) timerStyle = 'text-white bg-amber-500 border-amber-500';
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="group relative bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300"
        >
            {/* Glow Effect on Hover */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[1.5rem] pointer-events-none bg-gradient-to-tr from-transparent via-transparent to-${isPending ? 'amber' : isPreparing ? 'blue' : 'green'}-500/5`} />

            <div className="flex justify-between items-start mb-5 relative z-10">
                <div className="flex flex-col">
                    <span className="font-mono text-[10px] text-slate-400 font-bold tracking-wider mb-1">ID #{order.id}</span>
                    <span className="text-xl font-black text-slate-800 leading-none">{order.customer_name}</span>
                </div>
                <div className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 shadow-sm ${timerStyle}`}>
                    <Timer size={12} /> {elapsed}m
                </div>
            </div>

            {/* Payment Badge */}
            <div className="mb-2">
                {(order.payment_method === 'card') && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${order.payment_status === 'paid'
                        ? 'bg-violet-100 text-violet-700 border-violet-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                        {order.payment_status === 'paid' ? '💳 PAGADO (Stripe)' : '⏳ PAGO PENDIENTE'}
                    </span>
                )}
                {(order.payment_method !== 'card') && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-green-100 text-green-700 border-green-200">
                        💵 EFECTIVO / TRANSFER
                    </span>
                )}
            </div>

            {/* Content Items */}
            <div className="space-y-3 mb-6 relative z-10 pl-1">
                {order.items.map((item: any, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm group/item">
                        <div className="w-5 h-5 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-bold shrink-0 text-slate-400 group-hover/item:text-slate-600 group-hover/item:border-slate-300 transition-colors">1</div>
                        <div className="leading-tight">
                            <p className="font-bold text-slate-700">{item.name || (item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger')}</p>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5 line-clamp-1">
                                {[item.base?.name, ...(item.proteins || []), ...(item.mixins || [])].map((x: any) => x?.name).filter(Boolean).join(', ')}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Actions */}
            <div className="flex items-end justify-between border-t border-slate-50 pt-4 mt-2 relative z-10">
                <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Total</span>
                    <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">${order.total}</span>
                </div>

                <div className="flex gap-2">
                    {isPending && (
                        <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'preparing'); }}
                            className="bg-gradient-to-r from-slate-900 to-slate-800 text-white pl-4 pr-5 py-3 rounded-2xl text-xs font-bold shadow-lg shadow-slate-900/20 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group/btn"
                        >
                            <div className="relative">
                                <div className="absolute inset-0 bg-rose-500 blur-sm opacity-50 animate-pulse" />
                                <Flame size={14} className="text-rose-500 relative z-10" />
                            </div>
                            COCINAR
                        </button>
                    )}
                    {isPreparing && (
                        <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'completed'); }}
                            className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-5 py-3 rounded-2xl text-xs font-bold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <CheckCircle size={16} /> Listo
                        </button>
                    )}
                </div>
            </div>

            {/* Ribbon/Tag for Delivery Method */}
            <div className="absolute -right-3 -top-3">
                {order.delivery_method === 'pickup' ? (
                    <div className="bg-white text-orange-600 shadow-sm border border-orange-100 p-2 rounded-full">
                        <ShoppingBag size={14} strokeWidth={3} />
                    </div>
                ) : (
                    <div className="bg-white text-indigo-600 shadow-sm border border-indigo-100 p-2 rounded-full">
                        <MapPin size={14} strokeWidth={3} />
                    </div>
                )}
            </div>
        </motion.div>
    );
}

const EmptyStateUltra = () => (
    <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
        <div className="w-20 h-20 bg-gradient-to-tr from-slate-100 to-white rounded-3xl shadow-inner border border-white flex items-center justify-center mb-6 transform rotate-6">
            <ChefHat size={36} className="text-slate-300" />
        </div>
        <p className="font-black text-slate-300 text-sm tracking-[0.2em] uppercase">Sin Pedidos</p>
        <p className="text-xs text-slate-300 mt-2 font-medium">Todo bajo control chef ✨</p>
    </div>
);
