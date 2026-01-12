"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { Plus, Search, Filter, Edit2, Archive, CheckCircle, XCircle, Box, Trash2, Coffee, Utensils } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/context/ToastContext';
import { ImageUpload } from '@/components/ui/ImageUpload';

export const dynamic = 'force-dynamic';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

// --- Mapped Types for "Unified" View ---
type Category = {
    id: number;
    name: string;
    slug: string;
};

type ProductItem = {
    id: number;
    name: string;
    description?: string;
    price: number;
    category_id: number | null; // Database relation
    category_name: string; // Display helper
    image_url?: string;
    is_active: boolean;
    type: 'poke' | 'burger' | 'other';
};

// Old ingredients table is likely still in use for the builder components
type Ingredient = {
    id: number;
    name: string;
    type: string; // category
    premium_price: number;
    is_available: boolean;
    stock?: number;
    image_url?: string;
};

export default function AdminMenuPage() {
    const supabase = createClient();
    const { showToast } = useToast();
    const [selectedTab, setSelectedTab] = useState<'products' | 'ingredients'>('products');

    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Edit Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<ProductItem | Ingredient> | null>(null);

    // Form Mockup
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '0',
        categoryId: '', // For Products (ID)
        categoryType: '', // For Ingredients (String)
        imageUrl: '',
        isActive: true
    });

    // Fetch Data
    const fetchData = async () => {
        setLoading(true);

        // 0. Fetch Categories (Reference)
        const { data: catData } = await supabase.from('categories').select('*').order('name');
        if (catData) setCategories(catData);

        // 1. Fetch Products (New Schema with Relation)
        // We select categories(name) to display it nicely
        const { data: prodData } = await supabase
            .from('products')
            .select('*, categories(name)')
            .order('id');

        if (prodData) {
            const mapped: ProductItem[] = prodData.map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                price: p.base_price,
                category_id: p.category_id,
                // @ts-ignore: Supabase relation typing can be tricky
                category_name: p.categories?.name || 'Sin Categoría',
                image_url: p.image_url,
                is_active: p.is_active,
                type: p.type
            }));
            setProducts(mapped);
        }

        // 2. Fetch Ingredients (Legacy Table)
        const { data: ingData } = await supabase.from('ingredients').select('*').order('name');
        if (ingData) {
            setIngredients(ingData);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter Logic
    const filteredItems = selectedTab === 'products'
        ? products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.category_name.toLowerCase().includes(searchTerm.toLowerCase()))
        : ingredients.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.type.toLowerCase().includes(searchTerm.toLowerCase()));

    // Handlers
    const handleSave = async (e: React.ChangeEvent<HTMLFormElement>) => {
        e.preventDefault();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showToast('Error de sesión: Usuario no autenticado en Supabase', 'error');
            return;
        }

        try {
            if (selectedTab === 'products') {
                // Upsert Product
                const catId = parseInt(formData.categoryId);
                const payload = {
                    name: formData.name,
                    description: formData.description,
                    base_price: parseFloat(formData.price),
                    category_id: isNaN(catId) ? null : catId,
                    // We also update the old text column for backward compatibility if needed, 
                    // but let's rely on relation. Or better, fetch the name to fill it just in case?
                    // Let's assume database trigger or we just ignore the old column.
                    image_url: formData.imageUrl,
                    is_active: formData.isActive
                };

                let error;
                let data;
                if (editingItem && 'id' in editingItem) {
                    const res = await supabase.from('products').update(payload).eq('id', editingItem.id).select();
                    error = res.error;
                    data = res.data;
                } else {
                    const res = await supabase.from('products').insert({
                        ...payload,
                        slug: `prod-${Date.now()}`,
                        type: 'other' // Default type
                    }).select();
                    error = res.error;
                    data = res.data;
                }

                if (error) throw error;
                showToast(editingItem ? 'Producto actualizado' : 'Producto creado', 'success');

            } else {
                // Upsert Ingredient (Legacy)
                const payload = {
                    name: formData.name,
                    premium_price: parseFloat(formData.price),
                    type: formData.categoryType,
                    image_url: formData.imageUrl,
                    is_available: formData.isActive
                };

                let error;
                if (editingItem && 'id' in editingItem) {
                    const res = await supabase.from('ingredients').update(payload).eq('id', editingItem.id).select();
                    error = res.error;
                } else {
                    const res = await supabase.from('ingredients').insert(payload).select();
                    error = res.error;
                }

                if (error) throw error;
                showToast(editingItem ? 'Ingrediente actualizado' : 'Ingrediente creado', 'success');
            }

            setIsModalOpen(false);
            fetchData();
        } catch (e: any) {
            console.error(e);
            showToast(`Error: ${e.message}`, 'error');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar?')) return;
        const table = selectedTab === 'products' ? 'products' : 'ingredients';
        await supabase.from(table).delete().eq('id', id);
        showToast('Eliminado correctamente', 'success');
        fetchData();
    };

    const openModal = (item?: any) => {
        if (item) {
            setEditingItem(item);
            if (selectedTab === 'products') {
                setFormData({
                    name: item.name,
                    description: item.description || '',
                    price: item.price,
                    categoryId: item.category_id?.toString() || '',
                    categoryType: '',
                    imageUrl: item.image_url || '',
                    isActive: item.is_active
                });
            } else {
                setFormData({
                    name: item.name,
                    description: '',
                    price: item.premium_price,
                    categoryId: '',
                    categoryType: item.type || 'protein', // Using type for ingredients
                    imageUrl: item.image_url || '',
                    isActive: item.is_available
                });
            }
        } else {
            setEditingItem(null);
            setFormData({
                name: '',
                description: '',
                price: '0',
                categoryId: categories.length > 0 ? categories[0].id.toString() : '',
                categoryType: 'protein',
                imageUrl: '',
                isActive: true
            });
        }
        setIsModalOpen(true);
    };


    return (
        <div className="p-6 md:p-10 min-h-screen bg-rose-50/20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
                <div>
                    <h5 className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-2">Administración</h5>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-none">
                        Menú & <br />
                        <span className="text-violet-600">Productos.</span>
                    </h1>
                </div>
                <button
                    onClick={() => openModal()}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-colors shadow-lg shadow-slate-900/20"
                >
                    <Plus size={20} /> Nuevo {selectedTab === 'products' ? 'Producto' : 'Ingrediente'}
                </button>
            </div>

            {/* Controls */}
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 mb-8">
                {/* Tabs */}
                <div className="flex bg-slate-100/50 p-1 rounded-xl">
                    <button
                        onClick={() => setSelectedTab('products')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${selectedTab === 'products' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Utensils size={16} /> Carta
                    </button>
                    <button
                        onClick={() => setSelectedTab('ingredients')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${selectedTab === 'ingredients' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Box size={16} /> Ingredientes
                    </button>
                </div>

                {/* Search */}
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar producto..."
                        className="w-full h-full pl-12 bg-transparent outline-none font-medium text-slate-600 placeholder:text-slate-300"
                    />
                </div>
            </div>

            {/* List Grouped by Category */}
            <AnimatePresence mode="wait">
                {selectedTab === 'products' ? (
                    <motion.div
                        key="products-grouped"
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="space-y-12"
                    >
                        {/* Group items by category NAME for display */}
                        {Object.entries(filteredItems.reduce((acc, item) => {
                            // @ts-ignore
                            const cat = item.category_name || 'Sin Categoría';
                            // @ts-ignore
                            if (!acc[cat]) acc[cat] = [];
                            // @ts-ignore
                            acc[cat].push(item);
                            return acc;
                        }, {} as Record<string, any[]>)).map(([category, items]) => (
                            <div key={category}>
                                <div className="flex items-center gap-4 mb-6">
                                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{category}</h3>
                                    <div className="h-px bg-slate-200 flex-1" />
                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">{items.length} items</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {items.map((item) => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 1, y: 0 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-white p-6 rounded-[2rem] shadow-md border border-slate-200 hover:shadow-xl hover:border-violet-300 transition-all group relative min-h-[160px] flex flex-col justify-between"
                                        >
                                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <button onClick={() => openModal(item)} className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-violet-100 hover:text-violet-600">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(item.id)} className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-red-100 hover:text-red-500">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center text-4xl overflow-hidden shadow-sm border border-slate-100 relative">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>🍱</span>
                                                )}
                                            </div>

                                            <h3 className="text-xl font-bold text-slate-800 mb-1">{item.name}</h3>
                                            <p className="font-mono text-slate-400 text-sm mb-4">
                                                ${item.price}
                                            </p>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                ) : (
                    // Ingredients Logic (Unchanged)
                    <motion.div
                        key="ingredients-list"
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
                        {filteredItems.map((item) => (
                            <motion.div
                                key={item.id}
                                variants={itemVariants}
                                className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:border-violet-100 transition-all group relative"
                            >
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openModal(item)} className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-violet-100 hover:text-violet-600">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-red-100 hover:text-red-500">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-1">{item.name}</h3>
                                <div className="flex justify-between items-center mb-4">
                                    <p className="font-mono text-slate-400 text-sm">
                                        {/* @ts-ignore */}
                                        {item.premium_price > 0 ? `$${item.premium_price}` : 'Gratis / Base'}
                                    </p>
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            // @ts-ignore
                                            const newVal = !item.is_available;
                                            const newIngredients = [...ingredients];
                                            const idx = newIngredients.findIndex(i => i.id === item.id);
                                            if (idx !== -1) {
                                                newIngredients[idx] = { ...newIngredients[idx], is_available: newVal };
                                                setIngredients(newIngredients);
                                            }
                                            const { error } = await supabase.from('ingredients').update({ is_available: newVal }).eq('id', item.id);
                                            if (error) fetchData();
                                        }}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                                            // @ts-ignore
                                            item.is_available
                                                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                                : 'bg-red-100 text-red-600 hover:bg-red-200'
                                            }`}
                                    >
                                        {/* @ts-ignore */}
                                        {item.is_available ? 'Disponible' : 'Agotado'}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl">
                        <h2 className="text-2xl font-black text-slate-900 mb-6">
                            {editingItem ? 'Editar Item' : 'Nuevo Item'}
                        </h2>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Nombre</label>
                                <input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Precio</label>
                                    <input type="number" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
                                </div>

                                {selectedTab === 'products' ? (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1">Categoría</label>
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none"
                                            value={formData.categoryId}
                                            onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                                            required
                                        >
                                            <option value="" disabled>Seleccionar...</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1">Tipo</label>
                                        <input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none" value={formData.categoryType} onChange={e => setFormData({ ...formData, categoryType: e.target.value })} required />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Imagen</label>
                                <ImageUpload
                                    value={formData.imageUrl}
                                    onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                                    folder="items"
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100">Cancelar</button>
                                <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-violet-600 text-white hover:bg-violet-700">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
