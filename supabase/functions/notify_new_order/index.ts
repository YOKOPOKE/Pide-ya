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

        if (!order) {
            return new Response("No record found", { status: 400 });
        }

        // 🧠 SMART LOGIC 🧠

        // 1. If it's waiting for payment, DO NOT annoy the customer yet.
        if (order.status === 'awaiting_payment') {
            console.log("⏸️ Order waiting for payment. Skipping notification.");
            return new Response("Skipped: Awaiting Payment", { status: 200 });
        }

        // 2. Determine if we should send message
        // - Send if it's a NEW Cash order (INSERT + pending)
        // - Send if it's a PAID Update (Update: awaiting_payment -> pending)
        // - Skip if it's just a random update (e.g. preparing -> completed)

        const isNewCashOrder = payload.type === 'INSERT' && order.status === 'pending';
        const isPaymentConfirmed = payload.type === 'UPDATE'
            && oldRecord?.status === 'awaiting_payment'
            && order.status === 'pending';

        if (!isNewCashOrder && !isPaymentConfirmed) {
            console.log("ℹ️ Status change not relevant for notification.");
            return new Response("Skipped: Irrelevant Status Change", { status: 200 });
        }

        const customerName = order.customer_name;
        const orderId = order.id;
        const total = order.total;

        // 3. Smart Message Content
        let typeMessage = "🍳 Cocinando";
        if (order.delivery_method === 'pickup') {
            typeMessage = "🛍️ Para Recoger en Tienda";
        } else {
            // Shorten address to keep it clean
            const shortAddr = (order.customer_address || '').split(',')[0].slice(0, 25);
            typeMessage = `🛵 Envío a: ${shortAddr}...`;
        }

        // Format Phone: Remove non-digits, ensure MX prefix
        let phone = (order.customer_phone || '').replace(/\D/g, '');
        if (phone.length === 10) phone = '52' + phone;

        console.log(`Sending WhatsApp to Customer (${phone}) for Order #${orderId}`);

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
                    to: phone, // Send to Customer
                    type: "template",
                    template: {
                        name: "actualizacion_pedido",
                        language: { code: "es_MX" },
                        components: [
                            {
                                type: "body",
                                parameters: [
                                    { type: "text", text: String(orderId) }, // {{1}}
                                    { type: "text", text: "Yoko Poke House" }, // {{2}}
                                    // {{3}} - Clean text without newlines
                                    { type: "text", text: `CONFIRMADO ($${total}) - ${typeMessage} - Cliente: ${customerName}` }
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
