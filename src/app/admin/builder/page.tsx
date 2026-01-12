"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { Plus, Trash2, Edit2, Save, X, ChevronRight, ChevronDown, ChevronLeft, Move, Copy, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/context/ToastContext';

export const dynamic = 'force-dynamic';

// --- Types ---
type Product = {
    id: number;
    name: string;
    slug: string;
    category_id: number | null;
};

type ProductStep = {
    id: number;
    product_id: number;
    step_order: number;
    label: string;
    description?: string;
    min_selections: number;
    max_selections: number;
    included_selections: number;
    price_per_extra: number;
    is_required: boolean;
};

type StepOption = {
    id: number;
    step_id: number;
    name: string;
    price_extra: number;
    is_available: boolean;
};

type Ingredient = {
    id: number;
    name: string;
    premium_price: number;
};

export default function BuilderPage() {
    const supabase = createClient();
    const { showToast } = useToast();

    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [steps, setSteps] = useState<ProductStep[]>([]);
    const [expandedStep, setExpandedStep] = useState<number | null>(null);
    const [stepOptions, setStepOptions] = useState<Record<number, StepOption[]>>({});
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);

    const [loading, setLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        const loadInitial = async () => {
            const { data: prods } = await supabase.from('products').select('id, name, slug, category_id').eq('is_active', true).order('name');
            if (prods) setProducts(prods);

            const { data: ings } = await supabase.from('ingredients').select('id, name, premium_price').order('name');
            if (ings) setIngredients(ings);

            setLoading(false);
        };
        loadInitial();
    }, []);

    // Load Steps when Product Selected
    useEffect(() => {
        if (!selectedProduct) {
            setSteps([]);
            setStepOptions({}); // Clear options cache when product changes
            return;
        }

        const loadSteps = async () => {
            console.log('🔍 Loading steps for product:', selectedProduct.name, 'ID:', selectedProduct.id);

            const { data, error } = await supabase
                .from('product_steps')
                .select('id, product_id, step_order, label, min_selections, max_selections, included_selections, price_per_extra, is_required, name')
                .eq('product_id', selectedProduct.id)
                .order('step_order');

            if (error) {
                console.error('❌ Error loading steps:', error);
            } else {
                console.log('✅ Loaded steps:', data?.length || 0, 'steps:', data);
                setSteps(data || []);
            }

            // Clear step options cache when switching products
            setStepOptions({});
        };
        loadSteps();
    }, [selectedProduct]);

    // Load Options when Step Expanded
    useEffect(() => {
        if (!expandedStep) return;
        if (stepOptions[expandedStep]) return;

        const loadOptions = async () => {
            const { data } = await supabase
                .from('step_options')
                .select('*')
                .eq('step_id', expandedStep)
                .order('name');

            if (data) {
                setStepOptions(prev => ({ ...prev, [expandedStep]: data }));
            }
        };
        loadOptions();
    }, [expandedStep]);


    // --- Handlers ---

    const handleCreateStep = async () => {
        if (!selectedProduct) return;
        const newOrder = steps.length + 1;

        const payload = {
            product_id: selectedProduct.id,
            step_order: newOrder,
            name: 'Nuevo Paso', // Required by DB
            label: 'Nuevo Paso',
            min_selections: 1,
            max_selections: 1,
            included_selections: 1,
            price_per_extra: 0,
            is_required: true
        };

        const { data, error } = await supabase.from('product_steps').insert(payload).select().single();

        if (error) {
            console.error("Error creating step:", error);
            showToast(`Error: ${error.message || 'Check console'}`, 'error');
        } else if (data) {
            setSteps([...steps, data]);
            showToast('Paso creado', 'success');
        }
    };

    const handleDeleteStep = async (stepId: number) => {
        if (!confirm("¿Seguro? Esto borrará todas las opciones de este paso.")) return;
        const { error } = await supabase.from('product_steps').delete().eq('id', stepId);
        if (error) showToast('Error al eliminar', 'error');
        else {
            setSteps(steps.filter(s => s.id !== stepId));
            showToast('Paso eliminado', 'success');
        }
    };

    const handleUpdateStep = (stepId: number, field: keyof ProductStep, value: any) => {
        // Update local state ONLY
        const updatedSteps = steps.map(s => s.id === stepId ? { ...s, [field]: value } : s);
        setSteps(updatedSteps);
    };

    const handleSaveStep = async (step: ProductStep) => {
        const payload = {
            label: step.label,
            name: step.label, // Sync name with label
            min_selections: step.min_selections,
            max_selections: step.max_selections,
            included_selections: step.included_selections,
            price_per_extra: step.price_per_extra,
            is_required: step.is_required
        };

        const { error } = await supabase.from('product_steps').update(payload).eq('id', step.id);

        if (error) {
            console.error(error);
            showToast('Error al guardar', 'error');
        } else {
            showToast('Cambios guardados', 'success');
        }
    };


    const handleAddOption = async (stepId: number, name: string = "Nueva Opción", price: number = 0) => {
        const { data, error } = await supabase.from('step_options').insert({
            step_id: stepId,
            name: name,
            price_extra: price,
            is_available: true
        }).select().single();

        if (error) {
            console.error("Error creating option:", error);
            showToast(`Error op: ${error.message}`, 'error');
        } else if (data) {
            setStepOptions(prev => ({
                ...prev,
                [stepId]: [...(prev[stepId] || []), data]
            }));
            showToast('Opción agregada', 'success');
        }
    };

    const handleDeleteOption = async (stepId: number, optId: number) => {
        const { error } = await supabase.from('step_options').delete().eq('id', optId);
        if (!error) {
            setStepOptions(prev => ({
                ...prev,
                [stepId]: prev[stepId].filter(o => o.id !== optId)
            }));
        }
    };

    const handleMoveStep = async (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === steps.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const currentStep = steps[index];
        const targetStep = steps[targetIndex];

        // Swap orders
        const newCurrentOrder = targetStep.step_order;
        const newTargetOrder = currentStep.step_order;

        // Optimistic update
        const newSteps = [...steps];
        newSteps[index] = { ...currentStep, step_order: newCurrentOrder };
        newSteps[targetIndex] = { ...targetStep, step_order: newTargetOrder };

        // Sort by order to keep UI consistent
        newSteps.sort((a, b) => a.step_order - b.step_order);
        setSteps(newSteps);

        // DB Update
        await supabase.from('product_steps').update({ step_order: newCurrentOrder }).eq('id', currentStep.id);
        await supabase.from('product_steps').update({ step_order: newTargetOrder }).eq('id', targetStep.id);
    };

    const handleToggleRequired = (step: ProductStep) => {
        const newValue = !step.is_required;
        handleUpdateStep(step.id, 'is_required', newValue);
        // Auto-save toggle for better UX, or let them click save. 
        // Let's mark it as dirty in UI? For now, we update local state and user must click Save to persist? 
        // No, for toggles user expects instant feedback usually, but consistency says use the Save button.
        // However, I'll update the visual toggle immediately via handleUpdateStep.
    };

    const handleImportIngredient = async (stepId: number, ingredient: Ingredient) => {
        await handleAddOption(stepId, ingredient.name, ingredient.premium_price);
    };


    if (loading) return <div className="p-10 flex items-center justify-center h-screen text-slate-400 font-bold">Cargando Builder...</div>;

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h5 className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-1">Configuración</h5>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-none">
                        Reglas <span className="text-indigo-600 hidden md:inline">de Armado</span>
                    </h1>
                </div>
                {selectedProduct && (
                    <button
                        onClick={() => setSelectedProduct(null)}
                        className="lg:hidden flex items-center gap-2 text-sm font-bold text-slate-500 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200"
                    >
                        <ArrowLeft size={16} /> Volver
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[85vh]">

                {/* --- Left: Product List (Hidden on mobile if product selected) --- */}
                <div className={`lg:col-span-1 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 overflow-y-auto ${selectedProduct ? 'hidden lg:block' : 'block'}`}>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Productos ({products.length})</h3>
                    <div className="space-y-2">
                        {products.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedProduct(p)}
                                className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-all flex justify-between items-center ${selectedProduct?.id === p.id
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                    : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <span className="truncate">{p.name}</span>
                                {selectedProduct?.id === p.id && <ChevronRight size={16} />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* --- Right: Steps Editor (Hidden on mobile if NO product selected) --- */}
                <div className={`lg:col-span-3 flex flex-col ${!selectedProduct ? 'hidden lg:flex' : 'flex'}`}>
                    {selectedProduct ? (
                        <div className="flex flex-col h-full">
                            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4 sticky top-0 z-10">
                                <div>
                                    <h2 className="text-lg font-black text-slate-800 leading-tight">{selectedProduct.name}</h2>
                                    <span className="text-xs font-bold text-slate-400">{steps.length} pasos configurados</span>
                                </div>
                                <button onClick={handleCreateStep} className="flex items-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-xl font-bold hover:bg-black transition-colors text-xs md:text-sm">
                                    <Plus size={16} /> <span className="hidden md:inline">Agregar Paso</span>
                                </button>
                            </div>

                            <div className="space-y-6 overflow-y-auto pb-32 pr-2">
                                <AnimatePresence mode="popLayout">
                                    {steps.map((step, index) => (
                                        <motion.div
                                            key={step.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-md transition-all duration-300"
                                        >
                                            {/* --- Premium Step Header --- */}
                                            <div className="p-5 flex flex-col gap-4 relative">
                                                {/* Left decorative bar */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${expandedStep === step.id ? 'bg-indigo-500' : 'bg-slate-200 group-hover:bg-indigo-300'} transition-colors`} />

                                                <div className="flex items-start gap-4">
                                                    {/* Step Number & Reorder */}
                                                    <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                                        <div className="w-10 h-10 flex items-center justify-center bg-slate-900 text-white rounded-xl font-black text-lg shadow-lg shadow-slate-200 z-10 relative">
                                                            {index + 1}
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleMoveStep(index, 'up'); }}
                                                                disabled={index === 0}
                                                                className="p-1 text-slate-300 hover:text-indigo-600 disabled:opacity-0 transition-colors"
                                                            >
                                                                <ChevronLeft size={16} className="rotate-90" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleMoveStep(index, 'down'); }}
                                                                disabled={index === steps.length - 1}
                                                                className="p-1 text-slate-300 hover:text-indigo-600 disabled:opacity-0 transition-colors"
                                                            >
                                                                <ChevronRight size={16} className="rotate-90" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Title & Main Info */}
                                                    <div className="flex-1 w-full pt-1">
                                                        <input
                                                            value={step.label}
                                                            onChange={(e) => handleUpdateStep(step.id, 'label', e.target.value)}
                                                            className="w-full text-xl font-black text-slate-800 bg-transparent outline-none placeholder:text-slate-300 mb-3 border-b-2 border-transparent focus:border-indigo-100 transition-colors py-1"
                                                            placeholder="Nombre del paso (ej: Elige tu Proteína)"
                                                        />

                                                        {/* Status Badges / Toggles */}
                                                        <div className="flex items-center gap-4">
                                                            <button
                                                                onClick={() => handleToggleRequired(step)}
                                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border ${step.is_required
                                                                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200 pr-4'
                                                                    : 'bg-slate-50 text-slate-400 border-slate-200 pl-4'
                                                                    }`}
                                                            >
                                                                {!step.is_required && <span className="w-2 h-2 rounded-full bg-slate-300" />}
                                                                {step.is_required ? 'Requerido' : 'Opcional'}
                                                                {step.is_required && <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-300" />}
                                                            </button>

                                                            <div className="h-4 w-px bg-slate-200" />

                                                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                                                <span className="font-black text-slate-600">{stepOptions[step.id]?.length || 0}</span> opciones
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Actions Toolbar */}
                                                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                                        <button
                                                            onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                                        >
                                                            {expandedStep === step.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                                        </button>
                                                        <div className="w-px h-6 bg-slate-200 mx-1" />
                                                        <button
                                                            onClick={() => handleSaveStep(step)}
                                                            className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-white rounded-lg transition-all"
                                                            title="Guardar Cambios"
                                                        >
                                                            <Save size={20} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteStep(step.id)}
                                                            className="p-2 text-red-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* --- Pro Rules Control Bar --- */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/80 p-3 rounded-2xl border border-slate-100/50 mt-2">
                                                    {/* Min */}
                                                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                                                            <span className="text-xs">MIN</span>
                                                        </div>
                                                        <div>
                                                            <input
                                                                type="number"
                                                                value={step.min_selections ?? 0}
                                                                onChange={(e) => handleUpdateStep(step.id, 'min_selections', parseInt(e.target.value) || 0)}
                                                                className="w-12 text-center font-black text-slate-700 outline-none text-lg border-b border-transparent focus:border-emerald-300"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Max */}
                                                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                                        <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                                                            <span className="text-xs">MAX</span>
                                                        </div>
                                                        <div>
                                                            <input
                                                                type="number"
                                                                value={step.max_selections ?? 1}
                                                                onChange={(e) => handleUpdateStep(step.id, 'max_selections', parseInt(e.target.value) || 1)}
                                                                className="w-12 text-center font-black text-slate-700 outline-none text-lg border-b border-transparent focus:border-orange-300"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Included */}
                                                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                            <Copy size={16} /> {/* Icon for 'Included' or 'Pack' */}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Incluye</span>
                                                            <input
                                                                type="number"
                                                                value={step.included_selections ?? 1}
                                                                onChange={(e) => handleUpdateStep(step.id, 'included_selections', parseInt(e.target.value) || 1)}
                                                                className="w-12 font-black text-slate-700 outline-none text-sm border-b border-transparent focus:border-blue-300"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Extra Price */}
                                                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold">
                                                            $
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Extra</span>
                                                            <input
                                                                type="number"
                                                                value={step.price_per_extra ?? 0}
                                                                onChange={(e) => handleUpdateStep(step.id, 'price_per_extra', parseFloat(e.target.value) || 0)}
                                                                className="w-16 font-black text-slate-700 outline-none text-sm border-b border-transparent focus:border-purple-300"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* --- Options Section (Collapsible) --- */}
                                            <AnimatePresence>
                                                {expandedStep === step.id && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="bg-slate-50 border-t border-slate-100"
                                                    >
                                                        <div className="p-5">
                                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
                                                                <div>
                                                                    <h4 className="font-black text-slate-700 text-sm uppercase tracking-wide">Opciones del Paso</h4>
                                                                    <p className="text-xs text-slate-400 font-medium mt-1">Define qué puede elegir el cliente aquí.</p>
                                                                </div>

                                                                <div className="flex gap-2 w-full md:w-auto">
                                                                    {/* Import Toggle / Button */}
                                                                    <div className="relative group w-full md:w-auto">
                                                                        <button className="w-full md:w-auto flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 bg-white border-2 border-indigo-100 px-4 py-2.5 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm">
                                                                            <Copy size={14} /> <span>Importar Ingredientes</span>
                                                                        </button>
                                                                        {/* Dropdown */}
                                                                        <div className="absolute top-full right-0 mt-2 w-64 bg-white shadow-2xl shadow-indigo-100 rounded-2xl border border-slate-100 max-h-60 overflow-y-auto hidden group-hover:block z-50 py-2 transform origin-top-right transition-all">
                                                                            {ingredients.map(ing => (
                                                                                <button
                                                                                    key={ing.id}
                                                                                    onClick={() => handleImportIngredient(step.id, ing)}
                                                                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 rounded-xl text-xs text-slate-600 font-bold truncate flex justify-between items-center group/ing transition-colors"
                                                                                >
                                                                                    {ing.name}
                                                                                    <span className="w-5 h-5 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-full opacity-0 group-hover/ing:opacity-100 transition-opacity">
                                                                                        <Plus size={12} />
                                                                                    </span>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    <button
                                                                        onClick={() => handleAddOption(step.id)}
                                                                        className="w-full md:w-auto flex items-center justify-center gap-2 text-xs font-bold text-white bg-slate-900 border-2 border-slate-900 px-4 py-2.5 rounded-xl hover:bg-black hover:border-black transition-all shadow-lg shadow-slate-200"
                                                                    >
                                                                        <Plus size={14} /> <span>Crear Manual</span>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                                                {stepOptions[step.id]?.map(opt => (
                                                                    <div key={opt.id} className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center gap-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group relative overflow-hidden">
                                                                        {/* Color Indicator */}
                                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-400 to-purple-400" />

                                                                        <div className="pl-2 flex-1 min-w-0">
                                                                            <input
                                                                                className="w-full text-sm font-bold text-slate-800 outline-none bg-transparent truncate mb-1"
                                                                                defaultValue={opt.name}
                                                                                onBlur={async (e) => {
                                                                                    if (e.target.value !== opt.name) {
                                                                                        await supabase.from('step_options').update({ name: e.target.value }).eq('id', opt.id);
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <div className="flex items-center px-2 py-1 bg-slate-50 rounded-lg w-fit">
                                                                                <span className="text-[10px] font-bold text-slate-400 mr-1">EXTRA:</span>
                                                                                <span className="text-xs font-bold text-slate-600">$</span>
                                                                                <input
                                                                                    type="number"
                                                                                    className="w-12 bg-transparent outline-none text-xs font-bold text-slate-600 ml-0.5"
                                                                                    defaultValue={opt.price_extra}
                                                                                    onBlur={async (e) => {
                                                                                        const val = parseFloat(e.target.value);
                                                                                        if (val !== opt.price_extra) {
                                                                                            await supabase.from('step_options').update({ price_extra: val }).eq('id', opt.id);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleDeleteOption(step.id, opt.id)}
                                                                            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                                                                            title="Eliminar Opción"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {(!stepOptions[step.id] || stepOptions[step.id].length === 0) && (
                                                                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                                                    <p className="text-sm font-bold text-slate-400 mb-1">Paso vacío</p>
                                                                    <p className="text-xs text-slate-300">Agrega opciones manuales o importa ingredientes.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {steps.length === 0 && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-center py-20"
                                    >
                                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                            <Edit2 size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-700 mb-2">Comienza a configurar</h3>
                                        <p className="text-slate-400 text-sm max-w-xs mx-auto mb-6">Este producto no tiene reglas de armado. Crea el primer paso para empezar.</p>
                                        <button onClick={handleCreateStep} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-colors shadow-xl shadow-slate-200">
                                            Crear Primer Paso
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-3xl min-h-[50vh] bg-slate-50/50">
                            <Edit2 size={48} className="mb-4 opacity-50" />
                            <p className="font-bold text-lg text-slate-400 px-6 text-center">Selecciona un producto de la izquierda para comenzar</p>
                            <p className="text-sm mt-2 text-slate-400">Configura tus Pokes, Burgers y más.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
