"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Plus, ArrowRight } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";

// Types
type MenuItem = {
    id: number;
    name: string;
    description: string;
    price: number;
    image_url: string;
    category: string;
    type?: string;
    is_available: boolean;
    stock?: number;
};

const CATEGORIES = [
    { id: 'Signature Bowls', label: 'Pokes de la Casa' },
    { id: 'Burgers', label: 'Sushi Burgers' },
    { id: 'Sides', label: 'Share & Smile' },
    { id: 'Drinks', label: 'Drinks' },
    { id: 'Desserts', label: 'Postres' }
];

export default function Menu() {
    const [items, setItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [addedItems, setAddedItems] = useState<Record<number, boolean>>({}); // Track added state per item
    const [activeCategory, setActiveCategory] = useState('Signature Bowls');
    const supabase = createClient();
    const { addToCart, toggleCart } = useCart();

    useEffect(() => {
        const fetchMenu = async () => {
            const { data } = await supabase
                .from('menu_items')
                .select('*')
                .eq('is_available', true)
                .order('id');
            if (data) {
                setItems(data as MenuItem[]);
            }
            setLoading(false);
        };

        fetchMenu();

        const channel = supabase
            .channel('menu_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => fetchMenu())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const cat = (item.category || item.type || '').toLowerCase();
            if (activeCategory === 'Signature Bowls' && cat.includes('bowl')) return true;
            if (activeCategory === 'Burgers' && cat.includes('burger')) return true;
            if (activeCategory === 'Sides' && (cat.includes('side') || cat.includes('entrada') || cat.includes('share'))) return true;
            if (activeCategory === 'Drinks' && (cat.includes('drink') || cat.includes('bebida'))) return true;
            if (activeCategory === 'Desserts' && (cat.includes('dessert') || cat.includes('postre'))) return true;
            return false;
        });
    }, [items, activeCategory]);

    const handleQuickAdd = (item: MenuItem) => {
        if (activeCategory === 'Burgers' || (item.category && item.category.toLowerCase().includes('burger')) || item.name.toLowerCase().includes('burger')) {
            window.dispatchEvent(new CustomEvent('open-builder', { detail: { mode: 'burger' } }));
            return;
        }

        addToCart({
            productType: item.category && item.category.toLowerCase().includes('burger') ? 'burger' : 'bowl',
            size: 'regular',
            price: item.price,
            quantity: 1,
            base: null,
            proteins: [],
            mixins: [],
            sauces: [],
            toppings: [],
            extras: [],
            name: item.name,
            image: item.image_url
        }, false); // Silent add

        // Show success feedback
        setAddedItems(prev => ({ ...prev, [item.id]: true }));
        setTimeout(() => {
            setAddedItems(prev => ({ ...prev, [item.id]: false }));
        }, 2000);
    };

    if (loading) return (
        <section id="menu" className="py-24 bg-gray-50/50 relative z-10 min-h-[50vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-yoko-primary border-t-transparent animate-spin"></div>
                <div className="text-yoko-primary font-bold text-lg animate-pulse">Cargando Menú...</div>
            </div>
        </section>
    );

    return (
        <section id="menu" className="py-24 bg-gray-50/30 relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header */}
                <div className="flex flex-col items-center text-center mb-12">
                    <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-yoko-accent font-bold tracking-widest uppercase text-xs mb-3 bg-red-50 px-3 py-1 rounded-full"
                    >
                        Ingredientes Frescos
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl md:text-5xl font-serif font-bold text-yoko-dark mb-4"
                    >
                        Nuestro Menú
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-gray-500 text-lg max-w-2xl"
                    >
                        Explora combinaciones únicas creadas para cada gusto.
                    </motion.p>
                </div>

                {/* Sliding Capsule Categories */}
                <div className="flex justify-center mb-16">
                    <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-gray-100/50 inline-flex relative overflow-hidden">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`relative px-6 py-2.5 rounded-full text-sm font-bold transition-colors duration-200 z-10 whitespace-nowrap ${activeCategory === cat.id ? 'text-white' : 'text-gray-500 hover:text-yoko-dark'
                                    }`}
                            >
                                {activeCategory === cat.id && (
                                    <motion.div
                                        layoutId="activeCategory"
                                        className="absolute inset-0 bg-yoko-dark rounded-full -z-10 shadow-md"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                <motion.div
                    layout
                    className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-8"
                >
                    <AnimatePresence mode='popLayout'>
                        {filteredItems.map((item, index) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                transition={{ duration: 0.4, delay: index * 0.05, ease: [0.23, 1, 0.32, 1] }}
                                key={item.id}
                                className="group bg-white rounded-2xl sm:rounded-[2rem] p-3 sm:p-5 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-500 cursor-pointer flex flex-col relative overflow-hidden h-full transform-gpu"
                                onClick={() => handleQuickAdd(item)}
                            >
                                {/* Image Area */}
                                <div className="relative aspect-square w-full mb-3 sm:mb-6 rounded-xl sm:rounded-[1.5rem] overflow-hidden bg-gray-50">
                                    {/* Popular Badge */}
                                    {item.id < 3 && (
                                        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20">
                                            <span className="bg-white/90 backdrop-blur-md text-yoko-salmon text-[8px] sm:text-[10px] font-bold px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-sm flex items-center gap-1 sm:gap-1.5 ring-1 ring-black/5">
                                                <Star size={8} className="fill-current sm:w-[10px]" /> <span className="hidden sm:inline">FAVORITO</span><span className="sm:hidden">TOP</span>
                                            </span>
                                        </div>
                                    )}

                                    <Image
                                        src={item.image_url || "/images/bowl-placeholder.png"}
                                        alt={item.name}
                                        fill
                                        sizes="(max-width: 768px) 50vw, 25vw"
                                        className="object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out will-change-transform"
                                    />

                                    {/* Gradient Overlay on Hover */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                </div>

                                {/* Content */}
                                <div className="flex-1 flex flex-col px-1 sm:px-2 pb-1 sm:pb-2">
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-1 sm:mb-2 gap-1 sm:gap-4">
                                        <h3 className="font-bold text-yoko-dark text-sm sm:text-xl leading-tight group-hover:text-yoko-primary transition-colors duration-300">
                                            {item.name}
                                        </h3>
                                        <span className="text-sm sm:text-lg font-black text-yoko-dark/90 shrink-0">
                                            ${item.price}
                                        </span>
                                    </div>

                                    <p className="text-gray-500 text-xs sm:text-sm mb-3 sm:mb-6 line-clamp-2 leading-relaxed font-medium hidden sm:block">
                                        {item.description}
                                    </p>

                                    {/* Mobile description simplified */}
                                    <p className="text-gray-400 text-[10px] mb-3 line-clamp-1 leading-tight sm:hidden">
                                        {item.description}
                                    </p>

                                    {/* Footer / Action */}
                                    <div className="mt-auto flex items-center justify-between">
                                        <motion.button
                                            whileHover={{ scale: 1.05, backgroundColor: addedItems[item.id] ? "#10B981" : "#FF8C69", color: "#fff" }}
                                            whileTap={{ scale: 0.95 }}
                                            className={`w-full py-2 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300 shadow-sm flex items-center justify-center gap-1 sm:gap-2 group-hover:shadow-md
                                                ${addedItems[item.id] ? 'bg-green-500 text-white' : 'bg-gray-50 text-yoko-dark'}`}
                                        >
                                            {addedItems[item.id] ? (
                                                <>
                                                    <span className="text-white">¡Agregado!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Plus size={14} strokeWidth={3} className="text-yoko-primary group-hover:text-white transition-colors sm:w-[16px]" />
                                                    {item.category && item.category.toLowerCase().includes('burger') ? 'Diseñar' : 'Agregar'}
                                                </>
                                            )}
                                        </motion.button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>

                {filteredItems.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-32 text-gray-400 flex flex-col items-center"
                    >
                        <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mb-6 text-3xl shadow-inner">🥣</div>
                        <p className="text-lg font-medium">No hay productos disponibles por ahora.</p>
                    </motion.div>
                )}

            </div>
        </section>
    );
}
