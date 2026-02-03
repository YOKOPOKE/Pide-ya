"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from './ToastContext';

export type Ingredient = {
    id: number;
    name: string;
    price?: number;
    icon?: string;
    type: string;
};

export type OrderItem = {
    id: string; // Unique ID for cart item
    productType: 'bowl' | 'burger' | 'menu';
    size?: string;
    // Dynamic Structure for new Builder
    details?: { label: string; value: string }[];
    // Legacy support (optional now)
    base?: Ingredient | null;
    proteins?: Ingredient[];
    mixins?: Ingredient[];
    sauces?: Ingredient[];
    toppings?: Ingredient[];
    extras?: Ingredient[];
    price: number;
    quantity: number;
    name?: string; // Specific product name (e.g., "Spicy Tuna Bowl")
    image?: string;
    priceBreakdown?: {
        base: number;
        extras: number;
    };
};

type CartContextType = {
    items: OrderItem[];
    addToCart: (item: Omit<OrderItem, 'id'>, openDrawer?: boolean) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    isCartOpen: boolean;
    toggleCart: () => void;
    cartTotal: number;
    cartCount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const { showToast } = useToast();
    const [items, setItems] = useState<OrderItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const saved = localStorage.getItem('yoko-cart');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setItems(parsed);
                } else if (parsed && parsed.cart && Array.isArray(parsed.cart)) {
                    setItems(parsed.cart);
                }
            } catch (e) {
                console.error("Failed to load cart", e);
            }
        }
    }, []);

    useEffect(() => {
        if (isClient) {
            localStorage.setItem('yoko-cart', JSON.stringify(items));
        }
    }, [items, isClient]);

    const addToCart = (newItem: Omit<OrderItem, 'id'>, openDrawer = true) => {
        const item: OrderItem = {
            ...newItem,
            id: Math.random().toString(36).substr(2, 9),
            // Default legacy fields to empty to prevent undefined errors if accessed unsafely elsewhere
            proteins: newItem.proteins || [],
            mixins: newItem.mixins || [],
            sauces: newItem.sauces || [],
            toppings: newItem.toppings || [],
            extras: newItem.extras || []
        };
        setItems(prev => [...prev, item]);
        showToast(`Agregaste ${item.name || 'Producto'} al carrito`, 'success');
        if (openDrawer) setIsCartOpen(true);
    };

    const removeFromCart = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const clearCart = () => {
        setItems([]);
    };

    const toggleCart = () => {
        setIsCartOpen(prev => !prev);
    };

    const cartTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <CartContext.Provider value={{
            items,
            addToCart,
            removeFromCart,
            clearCart,
            isCartOpen,
            toggleCart,
            cartTotal,
            cartCount
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
