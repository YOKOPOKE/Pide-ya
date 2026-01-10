"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Save, Trash2, Edit2, ChevronRight, ArrowLeft,
    Layers, Package, CheckCircle2, XCircle, DollarSign, Image as ImageIcon,
    ChefHat, Coffee, Upload
} from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';
import { TiltCard } from '@/components/ui/TiltCard';
import { ImageUpload } from '@/components/ui/ImageUpload';

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
    category?: string;
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
// ...

// ... (Render in EDIT_STEP) ...


type Option = {
    id: number;
    step_id: number;
    name: string;
    price_extra: number | null;
    is_available: boolean;
    image_url?: string;
};

export default function AdminSettingsPage() {
    const supabase = createClient();

    // --- State ---
    const [view, setView] = useState<'LIST' | 'EDIT_PRODUCT' | 'EDIT_STEP'>('LIST');
    const [listTab, setListTab] = useState<'BUILDERS' | 'MENU'>('BUILDERS');

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection State
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [productSteps, setProductSteps] = useState<Step[]>([]);

    const [selectedStep, setSelectedStep] = useState<Step | null>(null);
    const [stepOptions, setStepOptions] = useState<Option[]>([]);

    // --- Fetching ---
    const fetchProducts = async () => {
        setLoading(true);
        const { data } = await supabase.from('products').select('*').order('id');
        if (data) setProducts(data);
        setLoading(false);
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
    }, []);

    // --- Derived State (Filters) ---
    const builderProducts = products.filter(p => p.type === 'poke' || p.type === 'burger');
    const menuProducts = products.filter(p => p.type === 'other');
    const displayedProducts = listTab === 'BUILDERS' ? builderProducts : menuProducts;

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
            type: isBuilderTab ? 'poke' : 'other', // Default type based on tab
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

    const handleSaveProduct = async () => {
        if (!selectedProduct) return;
        await supabase.from('products').update({
            name: selectedProduct.name,
            base_price: selectedProduct.base_price,
            image_url: selectedProduct.image_url,
            is_active: selectedProduct.is_active,
            category: selectedProduct.category,
            description: selectedProduct.description
        }).eq('id', selectedProduct.id);

        showToast('¡Producto actualizado con éxito! 🍔✨');
        fetchProducts();
    };

    const handleDeleteProduct = async () => {
        if (!selectedProduct) return;
        if (!confirm('¿Eliminar producto?')) return;

        await supabase.from('products').delete().eq('id', selectedProduct.id);
        setProducts(products.filter(p => p.id !== selectedProduct.id));
        setView('LIST');
    };

    // --- Handlers: Steps ---
    const handleEditStep = async (s: Step) => {
        setSelectedStep(s);
        await fetchOptions(s.id);
        setView('EDIT_STEP');
    };

    // --- Notifications ---
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
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
            showToast('¡Nueva categoría lista! A configurarla 🎉');
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

        if (error) {
            showToast('Error al guardar: ' + error.message, 'error');
        } else {
            showToast('¡Configuracion guardada con exito!🚀');
            // Update local list to reflect changes
            setProductSteps(prev => prev.map(s => s.id === selectedStep.id ? selectedStep : s));
        }
    };

    const handleDeleteStep = async () => {
        if (!selectedStep) return;
        if (!confirm('¿Estás seguro de eliminar esta categoría y todas sus opciones?')) return;

        const { error } = await supabase.from('product_steps').delete().eq('id', selectedStep.id);
        if (error) {
            alert('Error al borrar');
            return;
        }

        // Update local state
        setProductSteps(prev => prev.filter(s => s.id !== selectedStep.id));
        setView('EDIT_PRODUCT');
    };

    // --- Handlers: Options ---
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
        }
    };

    const handleUpdateOption = async (id: number, updates: Partial<Option>) => {
        // Optimistic update
        setStepOptions(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
        await supabase.from('step_options').update(updates).eq('id', id);
    };

    const handleDeleteOption = async (id: number) => {
        if (!confirm('¿Borrar ingrediente?')) return;
        setStepOptions(prev => prev.filter(o => o.id !== id));
        await supabase.from('step_options').delete().eq('id', id);
    };


    // --- Render ---

    if (loading) return <div className="p-10 text-center text-slate-400 font-bold animate-pulse">Cargando Admin...</div>;

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-10 pb-32">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-2">Arquitecto de Menú</h1>
                    <p className="text-slate-500 font-medium text-sm md:text-base">Gestiona todo el menú: Pokes, Burgers y más.</p>
                </div>
            </header>

            <AnimatePresence mode="wait">

                {/* VIEW: PRODUCT LIST */}
                {view === 'LIST' && (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                    >
                        {/* TABS */}
                        <div className="flex p-1 bg-white rounded-2xl w-full md:w-fit shadow-sm border border-slate-200 overflow-x-auto">
                            <button
                                onClick={() => setListTab('BUILDERS')}
                                className={`
                                    flex-1 md:flex-none px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap
                                    ${listTab === 'BUILDERS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}
                                `}
                            >
                                <ChefHat size={18} />
                                Builders
                            </button>
                            <button
                                onClick={() => setListTab('MENU')}
                                className={`
                                    flex-1 md:flex-none px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap
                                    ${listTab === 'MENU' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}
                                `}
                            >
                                <Coffee size={18} />
                                Carta
                            </button>
                        </div>

                        {/* LIST GRID */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            {displayedProducts.map(p => (
                                <div key={p.id} onClick={() => handleEditProduct(p)}>
                                    <TiltCard className="group relative bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-xl transition-all cursor-pointer h-full min-h-[220px] flex flex-col justify-between">
                                        <div className="absolute top-4 right-4 text-slate-300 group-hover:text-violet-500 transition-colors">
                                            <Edit2 size={20} />
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl overflow-hidden shadow-sm border border-slate-100">
                                                    {p.image_url ? (
                                                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        p.type === 'burger' ? '🍔' : p.type === 'poke' ? '🥗' : '🍱'
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg uppercase tracking-wider">
                                                    {p.category || 'General'}
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-800 mb-1 leading-tight">{p.name}</h3>
                                            <p className="text-sm text-slate-400 font-mono mb-4">${p.base_price}</p>
                                        </div>

                                        <div className={`self-start inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {p.is_active ? 'Activo' : 'Inactivo'}
                                        </div>
                                    </TiltCard>
                                </div>
                            ))}

                            <button
                                onClick={handleCreateProduct}
                                className="flex flex-col items-center justify-center gap-4 bg-slate-100 rounded-3xl p-6 border-2 border-dashed border-slate-300 text-slate-400 hover:bg-slate-200 hover:border-slate-400 hover:text-slate-600 transition-all min-h-[200px]"
                            >
                                <Plus size={40} />
                                <span className="font-bold">Crear {listTab === 'BUILDERS' ? 'Builder' : 'Producto'}</span>
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* VIEW: EDIT PRODUCT */}
                {view === 'EDIT_PRODUCT' && selectedProduct && (
                    <motion.div
                        key="edit-product"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="max-w-4xl mx-auto"
                    >
                        <button onClick={() => setView('LIST')} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold mb-6 transition-colors">
                            <ArrowLeft size={20} /> Volver a Lista
                        </button>

                        <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-xl border border-slate-100 mb-8">
                            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                                <h2 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3">
                                    <Package className="text-violet-500" />
                                    {selectedProduct.name}
                                </h2>
                                <div className="flex gap-2 self-end md:self-auto">
                                    <button onClick={handleDeleteProduct} className="bg-red-50 text-red-500 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center gap-2">
                                        <Trash2 size={18} />
                                    </button>
                                    <button onClick={handleSaveProduct} className="bg-violet-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-violet-700 transition-colors flex items-center gap-2">
                                        <Save size={18} /> Guardar
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre del Producto</label>
                                        <input
                                            value={selectedProduct.name}
                                            onChange={e => setSelectedProduct({ ...selectedProduct, name: e.target.value })}
                                            className="w-full text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 outline-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Precio Base ($)</label>
                                            <input
                                                type="number"
                                                value={selectedProduct.base_price}
                                                onChange={e => setSelectedProduct({ ...selectedProduct, base_price: Number(e.target.value) })}
                                                className="w-full text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Categoría</label>
                                            <input
                                                value={selectedProduct.category || ''}
                                                onChange={e => setSelectedProduct({ ...selectedProduct, category: e.target.value })}
                                                className="w-full text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 outline-none"
                                                list="categories-list"
                                            />
                                            <datalist id="categories-list">
                                                <option value="bowls" />
                                                <option value="burgers" />
                                                <option value="Pokes de la Casa" />
                                                <option value="Share & Smile" />
                                                <option value="Drinks" />
                                                <option value="Postres" />
                                            </datalist>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Descripción</label>
                                        <textarea
                                            value={selectedProduct.description || ''}
                                            onChange={e => setSelectedProduct({ ...selectedProduct, description: e.target.value })}
                                            className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 outline-none h-24 resize-none"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Imagen del Producto</label>
                                        <ImageUpload
                                            value={selectedProduct.image_url || ''}
                                            onChange={(url) => setSelectedProduct({ ...selectedProduct, image_url: url })}
                                            folder="products"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <span className="font-bold text-slate-700">Estado Visible</span>
                                        <button
                                            onClick={() => setSelectedProduct({ ...selectedProduct, is_active: !selectedProduct.is_active })}
                                            className={`w-14 h-8 rounded-full p-1 transition-colors ${selectedProduct.is_active ? 'bg-green-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${selectedProduct.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* STEPS LIST */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end px-2">
                                <h3 className="text-xl font-black text-slate-800">Pasos de Configuración</h3>
                                <button onClick={handleCreateStep} className="text-sm font-bold text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                    <Plus size={16} /> Agregar Paso
                                </button>
                            </div>

                            {productSteps.map((step, idx) => (
                                <motion.div
                                    layout
                                    key={step.id}
                                    onClick={() => handleEditStep(step)}
                                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-violet-300 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-sm">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-lg">{step.label}</h4>
                                            <p className="text-xs text-slate-400 font-mono">
                                                Min: {step.min_selections} | Max: {step.max_selections}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-slate-300 group-hover:text-violet-500 transition-colors" />
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* VIEW: EDIT STEP & OPTIONS */}
                {view === 'EDIT_STEP' && selectedStep && (
                    <motion.div
                        key="edit-step"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="max-w-5xl mx-auto"
                    >
                        <button onClick={() => setView('EDIT_PRODUCT')} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold mb-6 transition-colors">
                            <ArrowLeft size={20} /> Volver a {selectedProduct?.name}
                        </button>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                            {/* LEFT: STEP SETTINGS */}
                            <div className="lg:col-span-1 space-y-6">
                                <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100">
                                    <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                                        <Layers className="text-violet-500" size={20} /> Ajustes del Paso
                                    </h3>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Etiqueta (Título)</label>
                                            <input
                                                value={selectedStep.label}
                                                onChange={e => setSelectedStep({ ...selectedStep, label: e.target.value })}
                                                className="w-full font-bold bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-violet-500"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mínimo</label>
                                                <input
                                                    type="number"
                                                    value={selectedStep.min_selections ?? ''}
                                                    onChange={e => setSelectedStep({ ...selectedStep, min_selections: e.target.value === '' ? 0 : Number(e.target.value) })}
                                                    placeholder="0"
                                                    className="w-full font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-violet-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Máximo (Vacío = ∞)</label>
                                                <input
                                                    type="number"
                                                    value={selectedStep.max_selections ?? ''}
                                                    onChange={e => setSelectedStep({ ...selectedStep, max_selections: e.target.value === '' ? null : Number(e.target.value) })}
                                                    placeholder="∞"
                                                    className="w-full font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-violet-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 mt-2">
                                            <div>
                                                <label className="block text-xs font-bold text-violet-500 uppercase tracking-wider mb-2">Incluidas (Gratis)</label>
                                                <input
                                                    type="number"
                                                    value={selectedStep.included_selections ?? ''}
                                                    onChange={e => setSelectedStep({ ...selectedStep, included_selections: e.target.value === '' ? null : Number(e.target.value) })}
                                                    placeholder="Ej: 1"
                                                    className="w-full font-mono font-bold bg-violet-50 border border-violet-100 text-violet-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-violet-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Precio Extra ($)</label>
                                                <input
                                                    type="number"
                                                    value={selectedStep.price_per_extra ?? ''}
                                                    onChange={e => setSelectedStep({ ...selectedStep, price_per_extra: e.target.value === '' ? null : Number(e.target.value) })}
                                                    placeholder="Ej: 25"
                                                    className="w-full font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-violet-500"
                                                />
                                                <p className="text-[10px] text-slate-400 mt-1">Precio por cada selección adicional</p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleSaveStep}
                                            className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-black transition-colors flex justify-center gap-2 mt-4"
                                        >
                                            <Save size={18} /> Guardar Ajustes
                                        </button>

                                        <button
                                            onClick={handleDeleteStep}
                                            className="w-full bg-red-50 text-red-500 font-bold py-3 rounded-xl hover:bg-red-100 transition-colors flex justify-center gap-2 mt-2"
                                        >
                                            <Trash2 size={18} /> Eliminar Categoría
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT: OPTIONS LIST */}
                            <div className="lg:col-span-2">
                                <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl border border-slate-100 min-h-[600px]">
                                    <div className="flex justify-between items-center mb-8">
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-800">Ingredientes</h3>
                                            <p className="text-slate-400 text-sm">Opciones disponibles para este paso</p>
                                        </div>
                                        <button
                                            onClick={handleCreateOption}
                                            className="bg-violet-100 text-violet-700 hover:bg-violet-200 px-5 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2"
                                        >
                                            <Plus size={18} /> <span className="hidden md:inline">Nuevo Ingrediente</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        {stepOptions.map(opt => (
                                            <div key={opt.id} className="group flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md hover:border-violet-100 transition-all">

                                                {/* Active Toggle */}
                                                <button
                                                    onClick={() => handleUpdateOption(opt.id, { is_available: !opt.is_available })}
                                                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${opt.is_available ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}
                                                >
                                                    {opt.is_available ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                                                </button>

                                                {/* Image Upload (Mini) */}
                                                <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 relative">
                                                    {opt.image_url ? (
                                                        <div className="w-full h-full rounded-lg overflow-hidden relative group/img cursor-pointer bg-white border border-slate-200 shadow-sm">
                                                            <img src={opt.image_url} className="w-full h-full object-cover" />
                                                            <div
                                                                className="absolute inset-0 bg-black/50 hidden group-hover/img:flex items-center justify-center text-white"
                                                                onClick={() => handleUpdateOption(opt.id, { image_url: '' })}
                                                            >
                                                                <XCircle size={14} />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-full rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-violet-50 cursor-pointer overflow-hidden relative">
                                                            <ImageIcon size={16} className="text-slate-300" />
                                                            <input
                                                                type="file"
                                                                data-id={opt.id}
                                                                className="absolute inset-0 opacity-0 cursor-pointer text-[0]"
                                                                onChange={async (e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) {
                                                                        const fName = `ingredients/${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                                                                        const { data } = await supabase.storage.from('menu-images').upload(fName, file);
                                                                        if (data) {
                                                                            const { data: url } = supabase.storage.from('menu-images').getPublicUrl(data.path);
                                                                            handleUpdateOption(opt.id, { image_url: url.publicUrl });
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Name Input */}
                                                <input
                                                    value={opt.name}
                                                    onChange={e => handleUpdateOption(opt.id, { name: e.target.value })}
                                                    className="flex-1 min-w-[120px] bg-transparent font-bold text-slate-700 outline-none focus:text-violet-700 px-2 rounded hover:bg-slate-100 transition-colors"
                                                />

                                                {/* Price Extra */}
                                                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 ml-auto md:ml-0">
                                                    <span className="text-xs font-bold text-slate-400">+</span>
                                                    <DollarSign size={12} className="text-slate-400" />
                                                    <input
                                                        type="number"
                                                        value={opt.price_extra ?? ''}
                                                        onChange={e => handleUpdateOption(opt.id, { price_extra: e.target.value === '' ? null : Number(e.target.value) })}
                                                        placeholder="0"
                                                        className="w-16 bg-transparent text-sm font-mono font-bold text-slate-600 outline-none text-right"
                                                    />
                                                </div>

                                                {/* Delete */}
                                                <button
                                                    onClick={() => handleDeleteOption(opt.id)}
                                                    className="md:opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        ))}

                                        {stepOptions.length === 0 && (
                                            <div className="text-center py-10 text-slate-400 italic border-2 border-dashed border-slate-200 rounded-xl">
                                                No hay ingredientes todavía. ¡Agrega uno!
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </motion.div>
                )}

            </AnimatePresence>

            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className={`fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-[100] font-bold backdrop-blur-md border border-white/10 ${notification.type === 'success'
                            ? 'bg-slate-900/90 text-white shadow-violet-500/20'
                            : 'bg-red-500/90 text-white shadow-red-500/20'
                            }`}
                    >
                        <div className={`p-1 rounded-full ${notification.type === 'success' ? 'bg-green-500/20' : 'bg-white/20'}`}>
                            {notification.type === 'success' ? <CheckCircle2 size={20} className="text-green-400" /> : <XCircle size={20} className="text-white" />}
                        </div>
                        <span className="tracking-wide">{notification.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
