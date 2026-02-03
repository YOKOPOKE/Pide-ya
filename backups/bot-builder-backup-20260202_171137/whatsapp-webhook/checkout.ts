import { SessionData, CheckoutState } from './session.ts';
import { getProductWithSteps } from './productService.ts';
import { BotResponse } from './index.ts';
import { supabase } from './productService.ts';

export async function handleCheckoutFlow(
    from: string,
    text: string,
    session: SessionData
): Promise<BotResponse> {
    if (!session.checkoutState) {
        return { text: "Error: No hay checkout en curso." };
    }

    const checkout = session.checkoutState;
    const lowerText = text.toLowerCase().trim();

    // Step 1: COLLECT_NAME
    if (checkout.checkoutStep === 'COLLECT_NAME') {
        if (text.length < 2) {
            return {
                text: "⚠️ Por favor escribe un nombre válido (mínimo 2 caracteres)."
            };
        }

        checkout.customerName = text.trim();
        checkout.checkoutStep = 'COLLECT_DELIVERY';

        return {
            text: `✅ Perfecto, *${checkout.customerName}*!\n\n📍 ¿Cómo lo quieres recibir?`,
            useButtons: true,
            buttons: ['🏪 Recoger en tienda', '🚗 Envío a domicilio']
        };
    }

    // Step 2: COLLECT_DELIVERY
    if (checkout.checkoutStep === 'COLLECT_DELIVERY') {
        let deliveryMethod: 'pickup' | 'delivery';

        if (lowerText.includes('recoger') || lowerText.includes('tienda') || lowerText.includes('pickup')) {
            deliveryMethod = 'pickup';
        } else if (lowerText.includes('envío') || lowerText.includes('envio') || lowerText.includes('domicilio') || lowerText.includes('delivery')) {
            deliveryMethod = 'delivery';
        } else {
            return {
                text: "⚠️ Por favor elige una opción válida:",
                useButtons: true,
                buttons: ['🏪 Recoger en tienda', '🚗 Envío a domicilio']
            };
        }

        checkout.deliveryMethod = deliveryMethod;
        checkout.checkoutStep = 'SHOW_SUMMARY';

        // Get product to show summary
        const product = await getProductWithSteps(checkout.productSlug);
        if (!product) {
            return { text: "Error: Producto no encontrado." };
        }

        // Calculate order details
        const { total, summary } = calculateCheckoutSummary(product, checkout.selections, checkout.totalPrice);
        const deliveryText = deliveryMethod === 'pickup' ? '🏪 Recoger en tienda' : '🚗 Envío a domicilio';

        return {
            text: `📋 *RESUMEN DE TU ORDEN*\n\n${summary}\n\n------------------\n👤 *Nombre:* ${checkout.customerName}\n📍 *Entrega:* ${deliveryText}\n💰 *TOTAL: $${total}*\n------------------\n\n¿Todo correcto?`,
            useButtons: true,
            buttons: ['✅ Confirmar Orden', '❌ Cancelar']
        };
    }

    // Step 3: SHOW_SUMMARY (Confirmation)
    if (checkout.checkoutStep === 'SHOW_SUMMARY') {
        if (lowerText.includes('cancelar')) {
            return {
                text: "❌ Orden cancelada. ¿Quieres empezar de nuevo?",
                useButtons: true,
                buttons: ['Armar un Poke', 'Ver Menú']
            };
        }

        if (!lowerText.includes('confirmar')) {
            return {
                text: "⚠️ Por favor confirma o cancela tu orden:",
                useButtons: true,
                buttons: ['✅ Confirmar Orden', '❌ Cancelar']
            };
        }

        // CREATE ORDER IN DATABASE
        const product = await getProductWithSteps(checkout.productSlug);
        if (!product) {
            return { text: "Error: Producto no encontrado." };
        }

        const { items } = calculateCheckoutSummary(product, checkout.selections, checkout.totalPrice);

        const orderData = {
            customer_name: checkout.customerName,
            phone: from,
            total: checkout.totalPrice,
            status: 'pending',
            items: items,
            delivery_method: checkout.deliveryMethod,
            payment_status: 'pending',
            created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('orders').insert(orderData);
        if (error) {
            console.error("Error inserting order:", error);
            return {
                text: "⚠️ Hubo un error al procesar tu orden. Por favor intenta de nuevo."
            };
        }

        return {
            text: `🎉 *¡ORDEN CONFIRMADA!* 🎉\n\n🧾 EN PREPARACIÓN. Su orden ha sido confirmada y nuestra cocina ha comenzado a prepararla.\n\n¡Gracias por tu preferencia, ${checkout.customerName}! 🥢✨`,
            useButtons: true,
            buttons: ['Menú Principal']
        };
    }

    return { text: "Error en el flujo de checkout." };
}

function calculateCheckoutSummary(product: any, selections: Record<number, number[]>, totalPrice: number) {
    let summary = `*${product.name}*`;
    const itemsJson: any = {
        name: product.name,
        productType: product.type || 'bowl',
        base_price: product.base_price
    };

    product.steps.forEach((step: any) => {
        const selectedOptionIds = selections[step.id] || [];
        const selectedOptions = step.options.filter((o: any) => selectedOptionIds.includes(o.id));

        if (selectedOptions.length > 0) {
            summary += `\n\n*${step.label}:*`;
            const optionNames = selectedOptions.map((o: any) => `• ${o.name}`).join('\n');
            summary += `\n${optionNames}`;

            itemsJson[step.name || step.label] = selectedOptions.map((o: any) => o.name);
        }
    });

    return {
        total: totalPrice,
        summary,
        items: itemsJson
    };
}
