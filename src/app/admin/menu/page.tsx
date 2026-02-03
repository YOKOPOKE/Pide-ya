"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Save, Trash2, Edit2, ChevronRight, ArrowLeft,
    Layers, Package, CheckCircle2, XCircle, DollarSign, Image as ImageIcon,
    ChefHat, Coffee, Search, MoreHorizontal, Settings
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useToast } from '@/context/ToastContext';
import ConfirmModal from '@/components/admin/ConfirmModal';

// --- Types ---
type Product = {
    id: number;
    name: string;
    slug: string;
    base_price: number;
    description?: string;
    image_url?: string;
    is_active: boolean;
    type: 'poke' | 'burger' | 'other';
    category?: string; // Legacy
    category_id?: number | null; // New Relation
};

type Category = {
    id: number;
    name: string;
    slug: string;
    is_active?: boolean;
};

type Step = {
    id: number;
    product_id: number;
    name: string;
    label: string;
    order: number;
    min_selections: number;
    max_selections: number | null;
    included_selections: number | null;
    price_per_extra: number | null;
};

type Option = {
    id: number;
    step_id: number;
    name: string;
    price_extra: number | null;
    is_available: boolean;
    image_url?: string;
};

export default function AdminMenuPage() {
    // const supabase = createClient();
    const { showToast } = useToast();

    // --- State ---
    const [view, setView] = useState<'LIST' | 'EDIT_PRODUCT' | 'EDIT_STEP'>('LIST');
    const [listTab, setListTab] = useState<'BUILDERS' | 'MENU'>('BUILDERS');
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection State
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [productSteps, setProductSteps] = useState<Step[]>([]);
    const [selectedStep, setSelectedStep] = useState<Step | null>(null);
    const [stepOptions, setStepOptions] = useState<Option[]>([]);

    // Modal State
    const [modal, setModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info' as 'info' | 'danger' | 'input' | 'success',
        confirmText: 'Confirmar',
        initialInputValue: '',
        inputPlaceholder: '',
        onConfirm: (val?: string) => { }
    });

    const openModal = (
        title: string,
        message: string,
        type: 'info' | 'danger' | 'input' | 'success',
        onConfirm: (val?: string) => void,
        config?: { confirmText?: string; initialInputValue?: string; inputPlaceholder?: string; }
    ) => {
        setModal({
            isOpen: true,
            title,
            message,
            type,
            onConfirm,
            confirmText: config?.confirmText || 'Confirmar',
            initialInputValue: config?.initialInputValue || '',
            inputPlaceholder: config?.inputPlaceholder || ''
        });
    };

    const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

    // --- Fetching ---
    const fetchProducts = async () => {
        setLoading(true);
        const { data } = await supabase.from('products').select('*').order('id');
        if (data) setProducts(data);
        setLoading(false);
    };

    const fetchCategories = async () => {
        const { data } = await supabase.from('categories').select('*').order('id');
        if (data) setCategories(data);
    };

    const fetchSteps = async (productId: number) => {
        const { data } = await supabase.from('product_steps').select('*').eq('product_id', productId).order('order');
        if (data) setProductSteps(data);
    };

    const fetchOptions = async (stepId: number) => {
        const { data } = await supabase.from('step_options').select('*').eq('step_id', stepId).order('name');
        if (data) setStepOptions(data);
    };

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    // --- Derived State (Filters) ---
    const builderProducts = products.filter(p => p.type === 'poke' || p.type === 'burger');
    const menuProducts = products.filter(p => p.type === 'other');
    const displayedProducts = listTab === 'BUILDERS' ? builderProducts : menuProducts;

    // Get unique categories for autocomplete
    const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
    const defaultCategories = ['bowls', 'burgers', 'Drinks', 'Entrantes', 'Postres', 'Salsas', 'Bebidas'];
    const allCategories = Array.from(new Set([...uniqueCategories, ...defaultCategories])).sort();

    // --- Handlers: Product ---
    const handleEditProduct = async (p: Product) => {
        setSelectedProduct(p);
        await fetchSteps(p.id);
        setView('EDIT_PRODUCT');
    };

    const handleCreateProduct = async () => {
        const isBuilderTab = listTab === 'BUILDERS';
        const newProd = {
            name: 'Nuevo Producto',
            slug: `new-product-${Date.now()}`,
            type: isBuilderTab ? 'poke' : 'other',
            category: isBuilderTab ? 'bowls' : 'General',
            base_price: 0,
            is_active: false
        };
        // @ts-ignore
        const { data } = await supabase.from('products').insert(newProd).select().single();
        if (data) {
            setProducts([...products, data]);
            handleEditProduct(data);
        }
    };

    const handleCreateCategory = () => {
        openModal(
            'Nueva Categoría',
            'Escribe el nombre de la nueva categoría (ej. "Niños", "Salsas"):',
            'input',
            async (name) => {
                if (!name) return;
                const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
                const { data } = await supabase.from('categories').insert({ name, slug }).select().single();
                if (data) {
                    setCategories([...categories, data]);
                    if (selectedProduct) setSelectedProduct(prev => prev ? { ...prev, category_id: data.id } : null);
                    showToast('Categoría creada', 'success');
                }
            },
            { confirmText: 'Crear Categoría', inputPlaceholder: 'Nombre...' }
        );
    };

    const handleEditCategory = (cat: Category) => {
        openModal(
            'Editar Categoría',
            `Cambiar nombre de "${cat.name}" a:`,
            'input',
            async (newName) => {
                if (!newName || newName === cat.name) return;
                const { error } = await supabase.from('categories').update({ name: newName }).eq('id', cat.id);
                if (!error) {
                    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: newName } : c));
                    showToast('Categoría actualizada', 'success');
                }
            },
            { confirmText: 'Guardar Cambios', initialInputValue: cat.name }
        );
    };

    const handleDeleteCategory = (catId: number) => {
        // Check if used
        const used = products.some(p => p.category_id === catId);
        if (used) {
            showToast('No se puede eliminar: Hay productos en esta categoría', 'error');
            return;
        }

        openModal(
            '¿Eliminar Categoría?',
            'Esta acción no se puede deshacer. ¿Seguro que quieres borrarla?',
            'danger',
            async () => {
                await supabase.from('categories').delete().eq('id', catId);
                setCategories(prev => prev.filter(c => c.id !== catId));
                if (selectedProduct?.category_id === catId) {
                    setSelectedProduct(prev => prev ? { ...prev, category_id: null, category: '' } : null);
                }
                showToast('Categoría eliminada', 'success');
            },
            { confirmText: 'Sí, Eliminar' }
        );
    };

    const handleToggleCategory = async (cat: Category) => {
        const newState = !cat.is_active;
        // Optimistic UI
        setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: newState } : c));

        const { error } = await supabase.from('categories').update({ is_active: newState }).eq('id', cat.id);
        if (error) {
            // Revert on error
            setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !newState } : c));
            showToast('Error al actualizar visibilidad', 'error');
        } else {
            showToast(newState ? 'Categoría Visible 👁️' : 'Categoría Oculta 🙈', 'success');
        }
    };

    const handleSaveProduct = async () => {
        if (!selectedProduct) return;
        await supabase.from('products').update({
            name: selectedProduct.name,
            base_price: selectedProduct.base_price,
            image_url: selectedProduct.image_url,
            is_active: selectedProduct.is_active,
            category: selectedProduct.category,
            category_id: selectedProduct.category_id,
            description: selectedProduct.description,
            slug: selectedProduct.slug
        }).eq('id', selectedProduct.id);

        showToast('¡Producto actualizado con éxito! 🍔✨', 'success');
        fetchProducts();
    };

    const handleDeleteProduct = () => {
        if (!selectedProduct) return;
        openModal(
            '¿Eliminar Producto?',
            `Se eliminará "${selectedProduct.name}" y toda su configuración.`,
            'danger',
            async () => {
                await supabase.from('products').delete().eq('id', selectedProduct.id);
                setProducts(products.filter(p => p.id !== selectedProduct.id));
                showToast('Producto eliminado', 'success');
                setView('LIST');
            },
            { confirmText: 'Eliminar definitivamente' }
        );
    };

    // --- Handlers: Steps & Options (Simplified for Brevity - logic mostly same) ---
    const handleEditStep = async (s: Step) => {
        setSelectedStep(s);
        await fetchOptions(s.id);
        setView('EDIT_STEP');
    };

    const handleCreateStep = async () => {
        if (!selectedProduct) return;
        const newStep = {
            product_id: selectedProduct.id,
            name: 'new-step',
            label: 'Nueva Categoría',
            order: productSteps.length + 1,
            min_selections: 0,
            max_selections: 1,
            included_selections: 1,
            price_per_extra: 0
        };
        // @ts-ignore
        const { data } = await supabase.from('product_steps').insert(newStep).select().single();
        if (data) {
            setProductSteps([...productSteps, data]);
            showToast('¡Nueva categoría lista!', 'success');
        }
    };

    const handleSaveStep = async () => {
        if (!selectedStep) return;
        const { error } = await supabase.from('product_steps').update({
            label: selectedStep.label,
            min_selections: selectedStep.min_selections,
            max_selections: selectedStep.max_selections,
            included_selections: selectedStep.included_selections ?? 1,
            price_per_extra: selectedStep.price_per_extra ?? 0
        }).eq('id', selectedStep.id);

        if (error) showToast('Error al guardar', 'error');
        else {
            showToast('Configuracion guardada', 'success');
            setProductSteps(prev => prev.map(s => s.id === selectedStep.id ? selectedStep : s));
        }
    };

    const handleDeleteStep = () => {
        if (!selectedStep) return;
        openModal(
            '¿Eliminar Paso?',
            `Se eliminará el paso "${selectedStep.label}" y sus opciones.`,
            'danger',
            async () => {
                await supabase.from('product_steps').delete().eq('id', selectedStep.id);
                setProductSteps(prev => prev.filter(s => s.id !== selectedStep.id));
                showToast('Categoría eliminada', 'success');
                setView('EDIT_PRODUCT');
            },
            { confirmText: 'Eliminar' }
        );
    };

    const handleCreateOption = async () => {
        if (!selectedStep) return;
        const { data } = await supabase.from('step_options').insert({
            step_id: selectedStep.id,
            name: 'Nuevo Ingrediente',
            price_extra: 0,
            is_available: true
        }).select().single();
        if (data) {
            setStepOptions([...stepOptions, data]);
            showToast('Ingrediente agregado', 'success');
        }
    };

    const handleUpdateOption = async (id: number, updates: Partial<Option>) => {
        setStepOptions(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
        await supabase.from('step_options').update(updates).eq('id', id);
    };

    const handleDeleteOption = (id: number) => {
        openModal(
            '¿Borrar Ingrediente?',
            'Se eliminará este ingrediente de la lista.',
            'danger',
            async () => {
                setStepOptions(prev => prev.filter(o => o.id !== id));
                await supabase.from('step_options').delete().eq('id', id);
                showToast('Ingrediente eliminado', 'success');
            },
            { confirmText: 'Borrar' }
        );
    };



    if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400 font-bold">Cargando Menú...</div>;

    return (
        <div className="min-h-screen p-4 md:p-8 font-sans text-slate-800 bg-slate-50/50">
            <div className="max-w-[1600px] mx-auto space-y-8">

                {/* --- HEADER --- */}
                {view === 'LIST' && (
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestión del Menú</h1>
                            <p className="text-sm font-bold text-slate-400">Administra tus productos, precios y stock.</p>
                        </div>
                        <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
                            <button onClick={() => setListTab('BUILDERS')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${listTab === 'BUILDERS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                                <ChefHat size={16} /> Builders
                            </button>
                            <button onClick={() => setListTab('MENU')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${listTab === 'MENU' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                                <Coffee size={16} /> Carta
                            </button>
                        </div>
                    </div>
                )}


                <AnimatePresence mode="wait">
                    {/* VIEW: LIST */}
                    {view === 'LIST' && (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6"
                        >
                            <button
                                onClick={handleCreateProduct}
                                className="group flex flex-col items-center justify-center gap-3 bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 hover:border-rose-300 hover:bg-rose-50 transition-all min-h-[220px]"
                            >
                                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-rose-500 shadow-sm transition-colors">
                                    <Plus size={24} />
                                </div>
                                <span className="font-bold text-slate-400 group-hover:text-rose-500">Crear Nuevo Producto</span>
                            </button>

                            {displayedProducts.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => handleEditProduct(p)}
                                    className="group relative bg-white rounded-3xl p-5 shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer h-full flex flex-col justify-between overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-slate-50 to-transparent rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-150" />

                                    <div>
                                        <div className="flex justify-between items-start mb-4 relative z-10">
                                            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner border border-slate-100">
                                                {p.image_url ? (
                                                    <img src={p.image_url} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-2xl">{p.type === 'burger' ? '🍔' : p.type === 'poke' ? '🥗' : '🍱'}</div>
                                                )}
                                            </div>
                                            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border ${p.is_active ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                {p.is_active ? 'Activo' : 'Inactivo'}
                                            </div>
                                        </div>

                                        <h3 className="text-lg font-black text-slate-900 leading-tight mb-1 group-hover:text-rose-500 transition-colors">{p.name}</h3>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{p.category || 'General'}</p>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center">
                                        <span className="font-mono font-black text-xl text-slate-800">${p.base_price}</span>
                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                            <Edit2 size={14} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {/* VIEW: EDIT PRODUCT */}
                    {view === 'EDIT_PRODUCT' && selectedProduct && (
                        <motion.div key="edit-product" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-6xl mx-auto pb-20">
                            {/* Nav */}
                            <button onClick={() => setView('LIST')} className="flex items-center gap-2 text-slate-400 hover:text-slate-800 font-bold mb-8 transition-colors group">
                                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:border-slate-300">
                                    <ArrowLeft size={18} />
                                </div>
                                <span className="text-sm">Volver al Dashboard</span>
                            </button>

                            {/* Product Header Card */}
                            <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 mb-10 overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-slate-50/80 to-transparent rounded-bl-full -mr-20 -mt-20 -z-0 pointer-events-none" />

                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-8">
                                    <div className="flex-1 space-y-6">
                                        <div>
                                            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">{selectedProduct.name}</h2>
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider rounded-lg border border-slate-200">
                                                    {selectedProduct.category || 'General'}
                                                </span>
                                                <span className="text-slate-400 font-bold">•</span>
                                                <span className="font-mono text-slate-500 font-bold">${selectedProduct.base_price} base</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nombre del Producto</label>
                                                <input
                                                    value={selectedProduct.name}
                                                    onChange={e => setSelectedProduct({ ...selectedProduct, name: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Slug (URL)</label>
                                                <input
                                                    value={selectedProduct.slug || ''}
                                                    onChange={e => setSelectedProduct({ ...selectedProduct, slug: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-mono text-sm text-slate-600 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Precio Base</label>
                                                <div className="relative">
                                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                    <input
                                                        type="number"
                                                        value={selectedProduct.base_price}
                                                        onChange={e => setSelectedProduct({ ...selectedProduct, base_price: Number(e.target.value) })}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-5 py-4 font-bold text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Categoría</label>
                                                <div className="flex gap-2">
                                                    <select
                                                        value={selectedProduct.category_id || ''}
                                                        onChange={e => {
                                                            const catId = Number(e.target.value);
                                                            const catName = categories.find(c => c.id === catId)?.name;
                                                            setSelectedProduct({
                                                                ...selectedProduct,
                                                                category_id: catId,
                                                                category: catName // Keep legacy sync for now
                                                            });
                                                        }}
                                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all appearance-none min-w-0"
                                                    >
                                                        <option value="">-- Sin Categoría --</option>
                                                        {categories.map(c => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </select>

                                                    <button
                                                        onClick={handleCreateCategory}
                                                        className="px-4 bg-violet-50 text-violet-600 rounded-2xl border border-violet-100 hover:bg-violet-100 transition-colors"
                                                        title="Crear Nueva Categoría"
                                                    >
                                                        <Plus size={20} />
                                                    </button>

                                                    {selectedProduct.category_id && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    const cat = categories.find(c => c.id === selectedProduct.category_id);
                                                                    if (cat) handleEditCategory(cat);
                                                                }}
                                                                className="px-4 bg-slate-50 text-slate-500 rounded-2xl border border-slate-200 hover:bg-slate-100 transition-colors"
                                                                title="Editar Nombre Categoría"
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>

                                                            {/* Toggle Hide/Show */}
                                                            {(() => {
                                                                const cat = categories.find(c => c.id === selectedProduct.category_id);
                                                                if (cat) return (
                                                                    <button
                                                                        onClick={() => handleToggleCategory(cat)}
                                                                        className={`px-4 rounded-2xl border transition-colors flex items-center justify-center
                                                                            ${cat.is_active !== false
                                                                                ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'
                                                                                : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'}`}
                                                                        title={cat.is_active !== false ? 'Ocultar Categoría' : 'Mostrar Categoría'}
                                                                    >
                                                                        <div className={`w-8 h-4 rounded-full relative transition-colors ${cat.is_active !== false ? 'bg-blue-500' : 'bg-slate-400'}`}>
                                                                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${cat.is_active !== false ? 'left-4.5' : 'left-0.5'}`} style={{ left: cat.is_active !== false ? '18px' : '2px' }} />
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })()}

                                                            <button
                                                                onClick={() => handleDeleteCategory(selectedProduct.category_id!)}
                                                                className="px-4 bg-rose-50 text-rose-500 rounded-2xl border border-rose-100 hover:bg-rose-100 transition-colors"
                                                                title="Eliminar Categoría"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 flex items-center gap-4">
                                            <button onClick={handleSaveProduct} className="px-8 py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold shadow-lg shadow-slate-900/20 active:scale-95 transition-all flex items-center gap-2">
                                                <Save size={20} /> Guardar Cambios
                                            </button>
                                            <button onClick={handleDeleteProduct} className="px-6 py-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl font-bold transition-all flex items-center gap-2">
                                                <Trash2 size={20} /> <span className="hidden sm:inline">Eliminar</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Right Column: Image & Status */}
                                    <div className="w-full md:w-80 space-y-6">
                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-center">
                                            <div className="mb-4">
                                                <ImageUpload
                                                    value={selectedProduct.image_url || ''}
                                                    onChange={(url) => setSelectedProduct({ ...selectedProduct, image_url: url })}
                                                    folder="products"
                                                />
                                            </div>
                                            <button
                                                onClick={() => setSelectedProduct({ ...selectedProduct, is_active: !selectedProduct.is_active })}
                                                className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${selectedProduct.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                                            >
                                                {selectedProduct.is_active ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                                                {selectedProduct.is_active ? 'Producto Activo' : 'Oculto en Menú'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Steps Section */}
                            <div className="space-y-6">
                                <div className="flex items-end justify-between px-4">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900">Pasos de Configuración</h3>
                                        <p className="text-slate-400 font-medium">El cliente seguirá este orden al armar su pedido.</p>
                                    </div>
                                    <button onClick={handleCreateStep} className="group px-6 py-3 bg-white text-slate-900 border border-slate-200 hover:border-violet-500 hover:text-violet-600 rounded-xl font-bold shadow-sm hover:shadow-lg hover:shadow-violet-200 transition-all flex items-center gap-2">
                                        <span className="bg-slate-100 group-hover:bg-violet-100 p-1 rounded-lg transition-colors"><Plus size={16} /></span>
                                        Agregar Paso
                                    </button>
                                </div>

                                <div className="grid gap-4">
                                    <AnimatePresence>
                                        {productSteps.map((step, idx) => (
                                            <motion.div
                                                key={step.id}
                                                layout
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                onClick={() => handleEditStep(step)}
                                                className="group bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-violet-200 transition-all cursor-pointer relative overflow-hidden"
                                            >
                                                {/* Connecting Line Visual */}
                                                {idx !== productSteps.length - 1 && (
                                                    <div className="absolute left-[3.25rem] top-16 bottom-0 w-0.5 bg-gradient-to-b from-slate-200 to-transparent group-hover:from-violet-200" />
                                                )}

                                                <div className="flex items-center gap-6 relative z-10">
                                                    <div className="flex-shrink-0 w-14 h-14 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center font-black text-lg text-slate-400 group-hover:bg-violet-600 group-hover:text-white group-hover:border-violet-600 transition-all shadow-sm">
                                                        {idx + 1}
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h4 className="text-xl font-black text-slate-800 group-hover:text-violet-900 transition-colors">{step.label}</h4>
                                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                                                                {step.max_selections ? `Max: ${step.max_selections}` : 'Ilimitado'}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                                                                {step.included_selections ?? 0} Incluidos
                                                            </span>
                                                        </div>
                                                        <p className="text-slate-400 text-sm font-medium">Configura opciones, precios extra y límites para este paso.</p>
                                                    </div>

                                                    <div className="flex items-center gap-4 text-slate-300 group-hover:translate-x-1 transition-transform">
                                                        <span className="text-xs font-bold uppercase tracking-widest hidden sm:block group-hover:text-violet-500">Editar</span>
                                                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:border-violet-200 group-hover:bg-violet-50 group-hover:text-violet-600">
                                                            <Edit2 size={16} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>

                                {productSteps.length === 0 && (
                                    <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 hover:bg-slate-100/50 transition-colors">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300">
                                            <Layers size={32} />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-500 mb-2">Aún no hay pasos configurados</h3>
                                        <p className="text-slate-400 max-w-sm mx-auto mb-6">Comienza agregando el primer paso (ej. "Base", "Proteína") para armar este producto.</p>
                                        <button onClick={handleCreateStep} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all">
                                            Comenzar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* VIEW: EDIT STEP */}
                    {view === 'EDIT_STEP' && selectedStep && (
                        <motion.div key="edit-step" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-7xl mx-auto pb-20">
                            {/* Nav */}
                            <button onClick={() => setView('EDIT_PRODUCT')} className="flex items-center gap-2 text-slate-400 hover:text-slate-800 font-bold mb-8 transition-colors group">
                                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:border-slate-300">
                                    <ArrowLeft size={18} />
                                </div>
                                <span className="text-sm">Volver a {selectedProduct?.name}</span>
                            </button>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                {/* LEFT: Sidebar Settings */}
                                <div className="lg:col-span-4 space-y-6">
                                    <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 sticky top-4">
                                        <div className="flex items-center justify-between mb-8">
                                            <h3 className="text-2xl font-black text-slate-900">Configuración</h3>
                                            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shadow-inner">
                                                <Settings size={20} />
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Título del Paso</label>
                                                <input
                                                    value={selectedStep.label}
                                                    onChange={e => setSelectedStep({ ...selectedStep, label: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-800 focus:outline-none focus:border-violet-500 transition-all text-lg"
                                                    placeholder="ej. Elige tu Base"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Reglas de Selección</label>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                        <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Mínimo</span>
                                                        <input type="number" value={selectedStep.min_selections} onChange={e => setSelectedStep({ ...selectedStep, min_selections: Number(e.target.value) })} className="w-full bg-transparent font-black text-xl text-slate-800 focus:outline-none" />
                                                    </div>
                                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                        <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Máximo</span>
                                                        <input type="number" value={selectedStep.max_selections ?? ''} onChange={e => setSelectedStep({ ...selectedStep, max_selections: Number(e.target.value) })} className="w-full bg-transparent font-black text-xl text-slate-800 focus:outline-none placeholder:text-slate-300" placeholder="∞" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Reglas de Cobro</label>
                                                <div className="bg-violet-50/50 p-4 rounded-2xl border border-violet-100 space-y-4">
                                                    <div>
                                                        <span className="block text-[9px] font-bold text-violet-400 uppercase mb-1">Incluidos GRATIS</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-violet-500 shadow-sm"><CheckCircle2 size={16} /></div>
                                                            <input type="number" value={selectedStep.included_selections ?? 0} onChange={e => setSelectedStep({ ...selectedStep, included_selections: Number(e.target.value) })} className="w-full bg-transparent font-black text-xl text-violet-700 focus:outline-none" />
                                                        </div>
                                                    </div>
                                                    <div className="h-px bg-violet-200/50" />
                                                    <div>
                                                        <span className="block text-[9px] font-bold text-violet-400 uppercase mb-1">Precio Extra por Adicional</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-violet-500 shadow-sm"><DollarSign size={16} /></div>
                                                            <input type="number" value={selectedStep.price_per_extra ?? 0} onChange={e => setSelectedStep({ ...selectedStep, price_per_extra: Number(e.target.value) })} className="w-full bg-transparent font-black text-xl text-violet-700 focus:outline-none" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-4 space-y-3">
                                                <button onClick={handleSaveStep} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-black hover:shadow-xl transition-all flex items-center justify-center gap-2">
                                                    <Save size={20} /> Guardar Configuración
                                                </button>
                                                <button onClick={handleDeleteStep} className="w-full text-rose-500 font-bold py-3 hover:bg-rose-50 rounded-xl transition-all flex items-center justify-center gap-2">
                                                    <Trash2 size={18} /> Eliminar Paso
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT: Options Grid */}
                                <div className="lg:col-span-8">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h3 className="text-3xl font-black text-slate-900">Opciones</h3>
                                            <p className="text-slate-400 font-bold">Variantes e ingredientes para este paso.</p>
                                        </div>
                                        <button onClick={handleCreateOption} className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold shadow-lg shadow-violet-200 transition-all flex items-center gap-2">
                                            <Plus size={20} /> Agregar Opción
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <AnimatePresence>
                                            {stepOptions.map(opt => (
                                                <motion.div
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    key={opt.id}
                                                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-violet-100 transition-all group"
                                                >
                                                    <div className="flex items-start justify-between gap-4 mb-3">
                                                        {/* Image Placeholder or Upload (Future) */}
                                                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                                                            <div className="text-xl">🥗</div>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleUpdateOption(opt.id, { is_available: !opt.is_available })}
                                                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${opt.is_available ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}
                                                                title={opt.is_available ? 'Disponible' : 'No disponible'}
                                                            >
                                                                {opt.is_available ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                                                            </button>
                                                            <button onClick={() => handleDeleteOption(opt.id)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-all">
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <input
                                                            value={opt.name}
                                                            onChange={e => handleUpdateOption(opt.id, { name: e.target.value })}
                                                            className="w-full bg-transparent font-black text-lg text-slate-800 placeholder:text-slate-300 focus:outline-none"
                                                            placeholder="Nombre Opción"
                                                        />

                                                        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
                                                            <span className="text-xs font-bold text-slate-400 uppercase">Precio Premium: $</span>
                                                            <input
                                                                type="number"
                                                                value={opt.price_extra ?? ''}
                                                                onChange={e => handleUpdateOption(opt.id, { price_extra: Number(e.target.value) })}
                                                                className="flex-1 bg-transparent font-bold text-slate-700 outline-none w-full"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>

                                        {/* New Option Ghost Card */}
                                        <button
                                            onClick={handleCreateOption}
                                            className="min-h-[160px] rounded-2xl border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-violet-600 transition-all group"
                                        >
                                            <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-white flex items-center justify-center shadow-sm">
                                                <Plus size={24} />
                                            </div>
                                            <span className="font-bold">Agregar Opción</span>
                                        </button>
                                    </div>

                                    {stepOptions.length === 0 && (
                                        <div className="col-span-full py-12 text-center">
                                            <p className="text-slate-400 text-lg">No hay opciones en este paso.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <ConfirmModal
                    isOpen={modal.isOpen}
                    onClose={closeModal}
                    title={modal.title}
                    message={modal.message}
                    type={modal.type}
                    confirmText={modal.confirmText}
                    inputPlaceholder={modal.inputPlaceholder}
                    initialInputValue={modal.initialInputValue}
                    onConfirm={modal.onConfirm}
                />
            </div>
        </div>
    );
}
