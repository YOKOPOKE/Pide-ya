
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
    // 1. Fix Mediano
    // Buscar productos que se llamen "Poke Mediano" y tengan slug "new-product-..."
    const { data: d1, error: e1 } = await supabase
        .from('products')
        .update({ slug: 'poke-mediano' })
        .ilike('name', '%poke mediano%')
        .ilike('slug', 'new-product-%')
        .select();

    // 2. Fix Grande
    const { data: d2, error: e2 } = await supabase
        .from('products')
        .update({ slug: 'poke-grande' })
        .ilike('name', '%poke grande%')
        .ilike('slug', 'new-product-%')
        .select();

    // 3. Fix Burger Res (si aplica)
    const { data: d3, error: e3 } = await supabase
        .from('products')
        .update({ slug: 'sushi-burger-res' })
        .ilike('name', '%sushi burger res%')
        .ilike('slug', 'new-product-%')
        .select();

    const results = {
        mediano: { updated: d1?.length, error: e1 },
        grande: { updated: d2?.length, error: e2 },
        burger: { updated: d3?.length, error: e3 }
    };

    return new Response(JSON.stringify(results, null, 2), {
        headers: { "Content-Type": "application/json" }
    });
});
