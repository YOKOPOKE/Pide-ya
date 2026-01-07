"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { ShoppingBag, Plus, ChefHat } from "lucide-react";
import { useCart } from "@/context/CartContext";
import confetti from "canvas-confetti";
import { toast } from "@/components/ui/Toast";
import Image from "next/image";
import { TiltCard } from "@/components/ui/TiltCard";

interface ProductSelectorProps {
    onSelect?: (productSlug: string) => void;
}

type Product = {
    id: number;
    name: string;
    description: string;
    base_price: number;
    type: string;
    category: string;
    slug: string;
    image_url: string;
};

// Order for fixed menu
const MENY_CATEGORY_ORDER = [
    'Pokes de la Casa',
    'Share & Smile',
    'Drinks',
    'Postres'
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.2,
            delayChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: "spring",
            stiffness: 70,
            damping: 15,
            mass: 0.8
        }
    }
} as any;

export default function ProductSelector({ onSelect }: ProductSelectorProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();
    const { addToCart } = useCart();

    useEffect(() => {
        const fetchMenu = async () => {
            const { data } = await supabase.from('products').select('*').eq('is_active', true);
            if (data) setProducts(data);
            setLoading(false);
        };
        fetchMenu();
    }, []);

    // 1. Extract Heroes (Custom Builders)
    const customBowls = products.filter(p => p.category === 'bowls' || p.type === 'poke');
    const customBurgers = products.filter(p => p.category === 'burgers' || p.type === 'burger');

    // 2. Extract Fixed Menu & Group (Unused logic kept for safety or future use)
    const fixedMenuData = products.filter(p => p.category !== 'bowls' && p.category !== 'burgers' && p.type === 'other');

    const groupedFixedMenu = fixedMenuData.reduce((acc, product) => {
        const cat = product.category || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(product);
        return acc;
    }, {} as Record<string, Product[]>);

    const sortedMenuCategories = Object.keys(groupedFixedMenu).sort((a, b) => {
        const indexA = MENY_CATEGORY_ORDER.indexOf(a);
        const indexB = MENY_CATEGORY_ORDER.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    const handleBuilderSelect = (slug: string) => {
        if (onSelect) onSelect(slug);
    };

    const handleQuickAdd = (product: Product) => {
        const price = Number(product.base_price || 0);

        addToCart({
            name: product.name,
            productType: 'menu',
            price: price,
            quantity: 1,
            details: [],
            image: product.image_url,
            priceBreakdown: {
                base: price,
                extras: 0
            }
        });

        confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.8 },
            colors: ['#a78bfa', '#34d399']
        });
        toast.success(`Agregado: ${product.name}`);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-300 animate-pulse">Cargando menú delicioso...</div>;

    return (
        <section id="product-selector" className="min-h-screen bg-gradient-to-b from-yoko-light via-white to-yoko-light relative overflow-hidden pb-40">
            {/* --- HERO SECTION: BUILD YOUR OWN --- */}
            <div className="bg-white/80 backdrop-blur-sm pb-12 pt-24 rounded-b-[3rem] shadow-xl shadow-yoko-primary/5 mb-16 relative overflow-hidden">
                {/* Decor */}
                <div className="absolute top-0 right-0 w-1/2 h-full bg-yoko-light/50 skew-x-12 transform origin-top-right pointer-events-none" />

                <motion.div
                    className="max-w-7xl mx-auto px-4 relative z-10 text-center"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: false, margin: "-100px" }}
                >
                    <motion.div
                        variants={itemVariants}
                        className="mb-12"
                    >
                        <span className="text-xs font-bold tracking-[0.2em] text-violet-600 uppercase mb-2 block">Experiencia Yoko</span>
                        <h2 className="text-5xl md:text-7xl font-serif font-black text-slate-900 mb-4 tracking-tight">
                            Arma tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">Favorito</span>
                        </h2>
                        <p className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto">
                            Elige los ingredientes frescos que más te gusten y crea una obra maestra culinaria.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">

                        {/* CUSTOM BOWL CARD */}
                        <motion.div variants={itemVariants}>
                            <TiltCard
                                onClick={() => handleBuilderSelect('poke-mediano')}
                                className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-green-50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />

                                <div className="relative z-10 flex flex-col items-center">
                                    <motion.span
                                        className="text-8xl mb-6 block pb-4"
                                        whileHover={{ rotate: 15, scale: 1.15 }}
                                        transition={{ type: "spring", stiffness: 200 }}
                                    >
                                        🥗
                                    </motion.span>
                                    <h3 className="text-3xl font-black text-slate-800 mb-2">Poke Bowl</h3>
                                    <p className="text-slate-500 font-medium mb-6">Base de arroz + Proteína + Toppings ilimitados</p>

                                    <button className="bg-slate-900 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 group-hover:bg-green-600 transition-colors shadow-lg shadow-slate-900/20 group-hover:shadow-green-600/30">
                                        <ChefHat size={20} /> Armar Bowl
                                    </button>
                                </div>
                            </TiltCard>
                        </motion.div>

                        {/* CUSTOM BURGER CARD */}
                        <motion.div variants={itemVariants}>
                            <TiltCard
                                onClick={() => handleBuilderSelect('sushi-burger')}
                                className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-orange-50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />

                                <div className="relative z-10 flex flex-col items-center">
                                    <motion.span
                                        className="text-8xl mb-6 block pb-4"
                                        whileHover={{ rotate: -15, scale: 1.15 }}
                                        transition={{ type: "spring", stiffness: 200 }}
                                    >
                                        🍔
                                    </motion.span>
                                    <h3 className="text-3xl font-black text-slate-800 mb-2">Sushi Burger</h3>
                                    <p className="text-slate-500 font-medium mb-6">Hamburguesa de Arroz + Proteína + Salsas</p>

                                    <button className="bg-slate-900 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 group-hover:bg-orange-600 transition-colors shadow-lg shadow-slate-900/20 group-hover:shadow-orange-600/30">
                                        <ChefHat size={20} /> Armar Burger
                                    </button>
                                </div>
                            </TiltCard>
                        </motion.div>

                    </div>

                    {/* Extra message for sizes if needed */}
                    <div className="mt-8 flex justify-center gap-4 text-sm font-bold text-slate-400 uppercase tracking-widest opacity-60">
                        {customBowls.map(p => (
                            <span key={p.id}>• {p.name} ${p.base_price}</span>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* --- FIXED MENU SECTION REMOVED --- */}
        </section>
    );
}
