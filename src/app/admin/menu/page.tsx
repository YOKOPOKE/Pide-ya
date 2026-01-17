"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Save, Trash2, Edit2, ChevronRight, ArrowLeft,
    Layers, Package, CheckCircle2, XCircle, DollarSign, Image as ImageIcon,
    ChefHat, Coffee, Search, MoreHorizontal
} from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useToast } from '@/context/ToastContext';

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

type Option = {
    id: number;
    step_id: number;
    name: string;
    price_extra: number | null;
    is_available: boolean;
    image_url?: string;
};

export default function AdminMenuPage() {
    const supabase = createClient();
    const { showToast } = useToast();

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

        showToast('¡Producto actualizado con éxito! 🍔✨', 'success');
        fetchProducts();
    };

    const handleDeleteProduct = async () => {
        if (!selectedProduct) return;
        if (!confirm('¿Eliminar producto?')) return;
        await supabase.from('products').delete().eq('id', selectedProduct.id);
        setProducts(products.filter(p => p.id !== selectedProduct.id));
        setView('LIST');
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

    const handleDeleteStep = async () => {
        if (!selectedStep) return;
        if (!confirm('¿Borrar categoría?')) return;
        await supabase.from('product_steps').delete().eq('id', selectedStep.id);
        setProductSteps(prev => prev.filter(s => s.id !== selectedStep.id));
        setView('EDIT_PRODUCT');
    };

    const handleCreateOption = async () => {
        if (!selectedStep) return;
        const { data } = await supabase.from('step_options').insert({
            step_id: selectedStep.id,
            name: 'Nuevo Ingrediente',
            price_extra: 0,
            is_available: true
        }).select().single();
        if (data) setStepOptions([...stepOptions, data]);
    };

    const handleUpdateOption = async (id: number, updates: Partial<Option>) => {
        setStepOptions(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
        await supabase.from('step_options').update(updates).eq('id', id);
    };

    const handleDeleteOption = async (id: number) => {
        if (!confirm('¿Borrar ingrediente?')) return;
        setStepOptions(prev => prev.filter(o => o.id !== id));
        await supabase.from('step_options').delete().eq('id', id);
    };


    if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400 font-bold">Cargando Menú...</div>;

    return (
        <div className="min-h-screen p-4 md:p-8 font-sans text-slate-800">
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
                        <motion.div key="edit-product" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-5xl mx-auto pb-20">
                            {/* Nav */}
                            <button onClick={() => setView('LIST')} className="flex items-center gap-2 text-slate-400 hover:text-slate-800 font-bold mb-6 transition-colors group">
                                <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:border-slate-300">
                                    <ArrowLeft size={16} />
                                </div>
                                <span className="text-sm">Volver al Menú</span>
                            </button>

                            {/* Main Card */}
                            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mb-8">
                                <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                                            {selectedProduct.name}
                                        </h2>
                                        <p className="text-sm text-slate-400 font-bold mt-1">Editando detalles del producto</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handleDeleteProduct} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors">
                                            <Trash2 size={20} />
                                        </button>
                                        <button onClick={handleSaveProduct} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black shadow-lg shadow-slate-200 transition-all flex items-center gap-2">
                                            <Save size={18} /> Guardar Cambios
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre</label>
                                            <input
                                                value={selectedProduct.name}
                                                onChange={e => setSelectedProduct({ ...selectedProduct, name: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Precio Base</label>
                                                <input
                                                    type="number"
                                                    value={selectedProduct.base_price}
                                                    onChange={e => setSelectedProduct({ ...selectedProduct, base_price: Number(e.target.value) })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Categoría</label>
                                                <input
                                                    value={selectedProduct.category || ''}
                                                    onChange={e => setSelectedProduct({ ...selectedProduct, category: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                                                    list="categories-list"
                                                />
                                                <datalist id="categories-list">
                                                    <option value="bowls" /><option value="burgers" /><option value="Drinks" />
                                                </datalist>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Descripción</label>
                                            <textarea
                                                value={selectedProduct.description || ''}
                                                onChange={e => setSelectedProduct({ ...selectedProduct, description: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 min-h-[100px] resize-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Imagen</label>
                                            <ImageUpload
                                                value={selectedProduct.image_url || ''}
                                                onChange={(url) => setSelectedProduct({ ...selectedProduct, image_url: url })}
                                                folder="products"
                                            />
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                                            <span className="font-bold text-slate-700">Producto Activo</span>
                                            <button
                                                onClick={() => setSelectedProduct({ ...selectedProduct, is_active: !selectedProduct.is_active })}
                                                className={`w-12 h-7 rounded-full p-1 transition-colors ${selectedProduct.is_active ? 'bg-green-500' : 'bg-slate-300'}`}
                                            >
                                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${selectedProduct.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Steps Card */}
                            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-black text-slate-900">Pasos de Configuración</h3>
                                    <button onClick={handleCreateStep} className="text-sm font-bold text-rose-500 hover:bg-rose-50 px-4 py-2 rounded-xl transition-colors flex items-center gap-2">
                                        <Plus size={16} /> Nuevo Paso
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {productSteps.map((step, idx) => (
                                        <div
                                            key={step.id}
                                            onClick={() => handleEditStep(step)}
                                            className="group flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-xs group-hover:bg-rose-500 group-hover:text-white transition-colors">{idx + 1}</div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800">{step.label}</h4>
                                                    <p className="text-xs text-slate-400 font-medium">{step.min_selections} min - {step.max_selections ?? '∞'} max</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="text-slate-300 group-hover:text-rose-500" />
                                        </div>
                                    ))}
                                    {productSteps.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No hay pasos configurados.</p>}
                                </div>
                            </div>

                        </motion.div>
                    )}

                    {/* VIEW: EDIT STEP (Simplified - similar structure) */}
                    {view === 'EDIT_STEP' && selectedStep && (
                        <motion.div key="edit-step" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-5xl mx-auto pb-20">
                            <button onClick={() => setView('EDIT_PRODUCT')} className="flex items-center gap-2 text-slate-400 hover:text-slate-800 font-bold mb-6 transition-colors group">
                                <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:border-slate-300"><ArrowLeft size={16} /></div>
                                <span className="text-sm">Volver a {selectedProduct?.name}</span>
                            </button>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left Settings */}
                                <div className="lg:col-span-1 space-y-6">
                                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                        <h3 className="text-lg font-black text-slate-900 mb-6">Ajustes del Paso</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 mb-2">Título</label>
                                                <input value={selectedStep.label} onChange={e => setSelectedStep({ ...selectedStep, label: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-rose-500" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><label className="text-[10px] font-bold text-slate-400 block mb-1">Mínimo</label><input type="number" value={selectedStep.min_selections} onChange={e => setSelectedStep({ ...selectedStep, min_selections: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-none" /></div>
                                                <div><label className="text-[10px] font-bold text-slate-400 block mb-1">Máximo</label><input type="number" value={selectedStep.max_selections ?? ''} onChange={e => setSelectedStep({ ...selectedStep, max_selections: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-none" /></div>
                                            </div>
                                            <button onClick={handleSaveStep} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl mt-4 hover:shadow-lg">Guardar</button>
                                            <button onClick={handleDeleteStep} className="w-full text-red-500 font-bold py-2 text-sm hover:underline">Eliminar Paso</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Options */}
                                <div className="lg:col-span-2">
                                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-h-[500px]">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-xl font-black text-slate-900">Opciones ({stepOptions.length})</h3>
                                            <button onClick={handleCreateOption} className="text-xs font-bold text-white bg-slate-900 px-4 py-2 rounded-xl">Agregar Opción</button>
                                        </div>
                                        <div className="space-y-2">
                                            {stepOptions.map(opt => (
                                                <div key={opt.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                                    <button onClick={() => handleUpdateOption(opt.id, { is_available: !opt.is_available })} className={`w-8 h-8 rounded-lg flex items-center justify-center ${opt.is_available ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                                                        {opt.is_available ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                                    </button>
                                                    <input value={opt.name} onChange={e => handleUpdateOption(opt.id, { name: e.target.value })} className="bg-transparent font-bold text-slate-700 outline-none flex-1" />
                                                    <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                                                        <span className="text-xs text-slate-400">$</span>
                                                        <input type="number" value={opt.price_extra ?? ''} onChange={e => handleUpdateOption(opt.id, { price_extra: Number(e.target.value) })} className="w-12 text-sm font-bold text-slate-600 outline-none text-right bg-transparent" placeholder="0" />
                                                    </div>
                                                    <button onClick={() => handleDeleteOption(opt.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
