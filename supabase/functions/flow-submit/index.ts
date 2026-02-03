import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        console.log("Flow Submit Request:", JSON.stringify(body, null, 2));

        const { flow_token, data: orderData } = body;

        // Extract order details
        const {
            size,
            base,
            proteins,
            mixins,
            toppings,
            sauce,
            customer_name,
            delivery_method
        } = orderData;

        // Get product to calculate price
        const { data: product } = await supabase
            .from('products')
            .select(`
        *,
        steps:product_steps(
          *,
          options:product_options(*)
        )
      `)
            .eq('slug', size)
            .single();

        if (!product) {
            throw new Error("Product not found");
        }

        // Calculate total price (simplified - expand this)
        let total = product.base_price || 120;

        // Build order items
        const items = {
            name: product.name,
            productType: product.type || 'bowl',
            base_price: product.base_price,
            base: base,
            proteins: Array.isArray(proteins) ? proteins : [proteins],
            mixins: Array.isArray(mixins) ? mixins : [mixins],
            toppings: Array.isArray(toppings) ? toppings : [toppings],
            sauce: sauce
        };

        // Create order in database
        const { data: order, error } = await supabase
            .from('orders')
            .insert({
                customer_name,
                phone: flow_token, // Use flow_token as temporary identifier
                total,
                status: 'pending',
                items,
                delivery_method,
                payment_status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error("Order insert error:", error);
            throw error;
        }

        console.log("Order created:", order);

        // Return success response
        const response = {
            version: "3.0",
            screen: "SUCCESS",
            data: {
                extension_message_response: {
                    params: {
                        flow_token,
                        order_id: order.id
                    }
                }
            }
        };

        return new Response(
            JSON.stringify(response),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error("Flow Submit Error:", error);
        return new Response(
            JSON.stringify({
                error: error.message,
                version: "3.0",
                screen: "ERROR"
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
