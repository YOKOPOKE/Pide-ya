// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code is meant to be pasted into a Supabase Edge Function (e.g. 'notify_new_order')

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID")!;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;

serve(async (req) => {
    try {
        const payload = await req.json();
        console.log("🦋 Webhook Payload received:", payload);

        const order = payload.record;
        const oldRecord = payload.old_record;

        if (!order || !oldRecord) {
            return new Response("Update requires old and new record", { status: 200 });
        }

        // 🧠 STATUS CHANGE LOGIC 🧠

        const oldStatus = oldRecord.status;
        const newStatus = order.status;
        const deliveryMethod = order.delivery_method;

        // SKIP if status didn't change
        if (oldStatus === newStatus) {
            return new Response("No status change", { status: 200 });
        }

        let message = "";

        // 1. ACCEPTED (pending -> preparing)
        if (oldStatus === 'pending' && newStatus === 'preparing') {
            message = "👨‍🍳 *EN PREPARACIÓN:* Su orden ha sido confirmada y nuestra cocina ha comenzado a prepararla.";
        }
        // 2. SENT (preparing -> out_for_delivery) - Only for Delivery
        else if (oldStatus === 'preparing' && newStatus === 'out_for_delivery' && deliveryMethod === 'delivery') {
            message = "🚀 *EN CAMINO:* Su pedido ha salido del restaurante y va rumbo a su domicilio. ¡Le sugerimos estar atento!";
        }
        // 3. DELIVERED (out_for_delivery -> completed) - Only for Delivery
        else if (oldStatus === 'out_for_delivery' && newStatus === 'completed' && deliveryMethod === 'delivery') {
            message = "✅ *ENTREGADO:* Su pedido ha llegado. Esperamos que disfrute su experiencia culinaria.";
        }
        // 4. PICKUP READY/DONE (preparing -> completed) - Only for Pickup
        else if (oldStatus === 'preparing' && newStatus === 'completed' && deliveryMethod === 'pickup') {
            message = "🛍️ *LISTO PARA RECOGER:* Su pedido está listo en sucursal. ¡Lo esperamos!";
        }

        if (!message) {
            console.log(`ℹ️ Status change ${oldStatus}->${newStatus} not relevant for notification.`);
            return new Response("Skipped: Irrelevant Status change", { status: 200 });
        }

        const customerName = order.customer_name;
        const orderId = order.id;

        // Format Phone: Remove non-digits, ensure MX prefix
        let phone = (order.customer_phone || '').replace(/\D/g, ''); // Using 'customer_phone' field? Previous code used order.phone or order.customer_phone?
        // Checking previous file, it used 'order.customer_phone' OR 'order.phone' wasn't clear, let's assume 'phone' based on insert logic in index.ts
        // In index.ts insert: phone: context.from
        if (!phone && order.phone) phone = order.phone.replace(/\D/g, '');

        // If from whatsapp it might have 52...
        // Ensure it has 52 if 10 digits
        if (phone.length === 10) phone = '52' + phone;

        console.log(`Sending WhatsApp to Customer (${phone}) for Order #${orderId} - Status: ${newStatus}`);

        if (phone.length < 10) {
            console.error("Invalid phone number, skipping WhatsApp");
            return new Response("Invalid Phone", { status: 400 });
        }

        const response = await fetch(
            `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: phone,
                    type: "template",
                    template: {
                        name: "actualizacion_pedido1",
                        language: { code: "es_MX" },
                        components: [
                            {
                                type: "body",
                                parameters: [
                                    { type: "text", text: String(orderId) }, // {{1}}
                                    { type: "text", text: "Yoko Poke House" }, // {{2}}
                                    { type: "text", text: message } // {{3}}
                                ],
                            },
                        ],
                    },
                }),
            }
        );


        const data = await response.json();

        if (!response.ok) {
            console.error("❌ Meta API Error:", data);
            return new Response(JSON.stringify(data), { status: 400 });
        }

        console.log("✅ Message sent successfully:", data);
        return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("❌ Internal Function Error:", error);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), { status: 500 });
    }
});
