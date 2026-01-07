"use client";

import { useCart, OrderItem } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Trash2, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

type Tab = 'cart' | 'checkout' | 'success';

export default function CartDrawer() {
    const { items, isCartOpen, toggleCart, removeFromCart, cartTotal, clearCart } = useCart();
    const [step, setStep] = useState<Tab>('cart');
    const [formData, setFormData] = useState({
        name: '', phone: '', address: '', instructions: ''
    });

    if (!isCartOpen) return null;

    const handleCheckout = () => {
        setStep('checkout');
    };

    const handleWhatsApp = () => {
        // Construct message
        let message = `*Hola, quiero hacer un pedido 🥡*\n\n`;
        message += `*Nombre:* ${formData.name}\n`;
        message += `*Dirección:* ${formData.address}\n\n`;
        message += `*PEDIDO:*\n`;

        items.forEach(item => {
            message += `▪️ 1x ${item.name || (item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger')} - $${item.price}\n`;

            // New Detail Logic
            if (item.details && item.details.length > 0) {
                item.details.forEach(det => {
                    message += `   - ${det.label}: ${det.value}\n`;
                });
            } else {
                // Legacy
                if (item.base) message += `   - Base: ${item.base.name}\n`;
                const allIngs = [
                    ...(item.proteins || []),
                    ...(item.mixins || []),
                    ...(item.sauces || []),
                    ...(item.toppings || []),
                    ...(item.extras || [])
                ];
                if (allIngs.length > 0) {
                    message += `   - Ingredientes: ${allIngs.map(i => i.name).join(', ')}\n`;
                }
            }
            if (item.size) message += `   - Tamaño: ${item.size}\n`;
            message += `\n`;
        });

        message += `*Total: $${cartTotal}*\n`;
        if (formData.instructions) message += `\n📝 Nota: ${formData.instructions}`;

        const url = `https://wa.me/5216672000000?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');

        clearCart();
        setStep('success');
    };

    return (
        <AnimatePresence>
            {isCartOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={toggleCart}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col border-l border-gray-100"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
                            <h2 className="text-2xl font-serif font-bold text-yoko-dark flex items-center gap-2">
                                {step === 'cart' && <>🛍️ Tu Carrito <span className="text-sm bg-green-100 text-yoko-primary px-2 py-0.5 rounded-full">{items.length}</span></>}
                                {step === 'checkout' && <>📝 Datos de Envío</>}
                                {step === 'success' && <>🎉 ¡Orden Enviada!</>}
                            </h2>
                            <button onClick={toggleCart} className="p-2 hover:bg-gray-50 rounded-full transition">
                                <X size={24} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/50">
                            {step === 'cart' && (
                                <div className="space-y-4">
                                    {items.length === 0 ? (
                                        <div className="text-center py-20 opacity-50">
                                            <ShoppingBag size={64} className="mx-auto mb-4 text-gray-300" />
                                            <p className="text-lg font-bold text-gray-400">Tu carrito está vacío</p>
                                            <p className="text-sm text-gray-400">¡Arma tu bowl perfecto!</p>
                                        </div>
                                    ) : (
                                        items.map(item => (
                                            <motion.div
                                                layout
                                                key={item.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -100 }}
                                                className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex gap-4"
                                            >
                                                <div className="text-3xl bg-green-50 w-16 h-16 rounded-lg flex items-center justify-center shrink-0">
                                                    {item.productType === 'bowl' ? '🥣' : '🍔'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="font-bold text-yoko-dark truncate">
                                                            {item.name || (item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger')}
                                                        </h4>
                                                        <div className="text-right">
                                                            <div className="font-bold text-yoko-primary">${item.price}</div>
                                                            {item.priceBreakdown && item.priceBreakdown.extras > 0 && (
                                                                <div className="text-[10px] text-gray-400 font-medium">
                                                                    Base ${item.priceBreakdown.base} + ${item.priceBreakdown.extras}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mb-2">{item.size || 'Regular'}</p>

                                                    <div className="text-xs text-gray-600 space-y-1">
                                                        {item.details ? (
                                                            item.details.map((d, i) => (
                                                                <div key={i} className="line-clamp-2">
                                                                    <span className="font-semibold text-gray-700">{d.label}:</span> {d.value}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            // Legacy Layout
                                                            <>
                                                                {item.base && <div>Base: {item.base.name}</div>}
                                                                <div>
                                                                    {[
                                                                        ...(item.proteins || []),
                                                                        ...(item.mixins || [])
                                                                    ].map(i => i.name).join(', ')}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="text-gray-300 hover:text-red-500 transition-colors self-center p-2"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            )}

                            {step === 'checkout' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-4"
                                >
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Nombre</label>
                                        <input
                                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full p-3 rounded-xl border border-gray-200 focus:border-yoko-primary focus:ring-2 focus:ring-green-100 outline-none transition"
                                            placeholder="Tu nombre"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Dirección</label>
                                        <input
                                            value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full p-3 rounded-xl border border-gray-200 focus:border-yoko-primary focus:ring-2 focus:ring-green-100 outline-none transition"
                                            placeholder="Calle, número, colonia..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono</label>
                                        <input
                                            value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full p-3 rounded-xl border border-gray-200 focus:border-yoko-primary focus:ring-2 focus:ring-green-100 outline-none transition"
                                            placeholder="Ej: 667 123 4567"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Instrucciones / Nota</label>
                                        <textarea
                                            value={formData.instructions} onChange={e => setFormData({ ...formData, instructions: e.target.value })}
                                            className="w-full p-3 rounded-xl border border-gray-200 focus:border-yoko-primary focus:ring-2 focus:ring-green-100 outline-none transition"
                                            placeholder="¿Sin cebolla? ¿Salsa extra?"
                                            rows={3}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {step === 'success' && (
                                <div className="text-center py-20">
                                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <ShoppingBag className="text-yoko-primary" size={32} />
                                    </div>
                                    <h3 className="text-2xl font-bold text-yoko-dark mb-2">¡Pedido Listo!</h3>
                                    <p className="text-gray-500 mb-8">Te hemos redirigido a WhatsApp para confirmar tu orden.</p>
                                    <button onClick={toggleCart} className="text-yoko-primary font-bold hover:underline">
                                        Cerrar ventana
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {step !== 'success' && (
                            <div className="p-6 bg-white border-t border-gray-100">
                                {step === 'cart' ? (
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-lg font-bold text-yoko-dark">
                                            <span>Total</span>
                                            <span>${cartTotal}</span>
                                        </div>
                                        <button
                                            onClick={handleCheckout}
                                            disabled={items.length === 0}
                                            className="w-full bg-yoko-primary hover:bg-yoko-dark text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                                        >
                                            Continuar <ArrowRight size={20} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <button
                                            onClick={handleWhatsApp}
                                            disabled={!formData.name || !formData.address}
                                            className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                                        >
                                            Confirmar por WhatsApp <ArrowRight size={20} />
                                        </button>
                                        <button onClick={() => setStep('cart')} className="w-full text-gray-500 font-bold py-2">
                                            Volver al Carrito
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
