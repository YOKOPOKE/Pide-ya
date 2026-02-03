import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        console.log("Flow Data Request:", JSON.stringify(body, null, 2));

        const { screen, data: flowData = {}, action } = body;

        // Get product slug from flow data (default to mediano if not present)
        const size = flowData.size || 'poke-mediano';

        // Fetch product with steps
        const { data: products } = await supabase
            .from('products')
            .select(`
        *,
        steps:product_steps(
          *,
          options:product_options(*)
        )
      `)
            .eq('slug', size)
            .order('order_index', { foreignTable: 'product_steps' })
            .order('order_index', { foreignTable: 'product_steps.product_options' })
            .single();

        if (!products) {
            return new Response(
                JSON.stringify({ error: "Product not found" }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
            );
        }

        const steps = products.steps || [];
        let responseData = {};
        let nextScreen = screen; // Default to current screen (for INIT)

        // Determine target screen and data based on action
        if (action === 'data_exchange') {
            switch (screen) {
                case "SIZE_SELECTION":
                    nextScreen = "BASE_SELECTION";
                    break;
                case "BASE_SELECTION":
                    nextScreen = "PROTEIN_SELECTION";
                    break;
                case "PROTEIN_SELECTION":
                    nextScreen = "MIXINS_SELECTION";
                    break;
                case "MIXINS_SELECTION":
                    nextScreen = "TOPPINGS_SELECTION";
                    break;
                case "TOPPINGS_SELECTION":
                    nextScreen = "SAUCE_SELECTION";
                    break;
                case "SAUCE_SELECTION":
                    nextScreen = "CHECKOUT";
                    break;
                default:
                    // Stay on same screen or handle error
                    break;
            }
        }

        // Prepare data for the NEXT screen (or current if INIT)
        switch (nextScreen) {
            case "BASE_SELECTION": {
                const baseStep = steps.find(s => s.name === 'base' || s.label?.toLowerCase().includes('base'));
                if (baseStep) {
                    responseData = {
                        ...flowData, // Echo back previous data
                        bases: baseStep.options.map(opt => ({
                            id: opt.id.toString(),
                            title: opt.name,
                            description: opt.price_extra > 0 ? `+$${opt.price_extra}` : ""
                        }))
                    };
                }
                break;
            }

            case "PROTEIN_SELECTION": {
                const proteinStep = steps.find(s => s.name === 'proteins' || s.label?.toLowerCase().includes('protein'));
                if (proteinStep) {
                    const included = proteinStep.included_selections || 1;
                    const extraCost = proteinStep.price_per_extra || 40;

                    responseData = {
                        ...flowData, // Echo back previous data
                        proteins: proteinStep.options.map((opt, idx) => ({
                            id: opt.id.toString(),
                            title: opt.name,
                            description: idx < included ? "Incluida" : `+$${extraCost}`
                        })),
                        protein_help: `${included}ra GRATIS, extras +$${extraCost} c/u`
                    };
                }
                break;
            }

            case "MIXINS_SELECTION": {
                const mixinStep = steps.find(s => s.name === 'mixins' || s.label?.toLowerCase().includes('mix'));
                if (mixinStep) {
                    const included = mixinStep.included_selections || 5;
                    const extraCost = mixinStep.price_per_extra || 10;

                    responseData = {
                        ...flowData, // Echo back previous data
                        mixins: mixinStep.options.map((opt, idx) => ({
                            id: opt.id.toString(),
                            title: opt.name,
                            description: opt.price_extra > 0 ? `+$${opt.price_extra}` : ""
                        })),
                        mixin_help: `${included} GRATIS, extras +$${extraCost} c/u`
                    };
                }
                break;
            }

            case "TOPPINGS_SELECTION": {
                const toppingStep = steps.find(s => s.name === 'toppings' || s.label?.toLowerCase().includes('topping'));
                if (toppingStep) {
                    const included = toppingStep.included_selections || 3;
                    const extraCost = toppingStep.price_per_extra || 10;

                    responseData = {
                        ...flowData, // Echo back previous data
                        toppings: toppingStep.options.map(opt => ({
                            id: opt.id.toString(),
                            title: opt.name,
                            description: opt.price_extra > 0 ? `+$${opt.price_extra}` : ""
                        })),
                        topping_help: `${included} GRATIS, extras +$${extraCost} c/u`
                    };
                }
                break;
            }

            case "SAUCE_SELECTION": {
                const sauceStep = steps.find(s => s.name === 'sauce' || s.label?.toLowerCase().includes('salsa'));
                if (sauceStep) {
                    responseData = {
                        ...flowData, // Echo back previous data
                        sauces: sauceStep.options.map(opt => ({
                            id: opt.id.toString(),
                            title: opt.name
                        }))
                    };
                }
                break;
            }

            case "CHECKOUT": {
                // Calculate total and create summary
                const basePrice = products.base_price || 120;
                // Simplified total calculation
                // In a real app, you'd iterate over proteins, mixins, etc. in flowData to add extra costs
                responseData = {
                    ...flowData, // Echo back previous data
                    total: basePrice,
                    summary: `${products.name}\nBase: ${flowData.base || 'N/A'}`
                };
                break;
            }

            case "SIZE_SELECTION":
            default:
                responseData = {};
        }

        const response = {
            version: "3.0",
            screen: nextScreen,
            data: responseData
        };

        console.log("Flow Data Response:", JSON.stringify(response, null, 2));

        return new Response(
            JSON.stringify(response),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error("Flow Data Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
