import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export type ProductOption = {
    id: number;
    name: string;
    price_extra: number;
    is_available: boolean;
};

export type ProductStep = {
    id: number;
    name: string;
    label: string;
    order: number;
    min_selections: number;
    max_selections: number | null;
    included_selections: number;
    price_per_extra: number;
    options: ProductOption[];
};

export type ProductTree = {
    id: number;
    name: string;
    slug: string;
    base_price: number;
    steps: ProductStep[];
};

export async function getCategories() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Attempt to fetch categories. If table doesn't exist, this will error and we return [].
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
    return data as { id: number; name: string }[];
}

export async function getCategoryByName(nameFragment: string) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .ilike('name', `%${nameFragment}%`)
        .limit(1)
        .single();
    if (error) return null;
    return data as { id: number; name: string };
}

export async function getProductsByCategory(categoryId: number) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('name');
    if (error) return [];
    return data as { id: number; name: string; slug: string; base_price: number }[];
}

export async function getAllProducts() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Fetch products. We assume there might be a category_id. 
    // If not, we just get products.
    const { data, error } = await supabase.from('products').select('*').eq('is_active', true).order('name');
    if (error) {
        console.error('Error fetching products:', error);
        return [];
    }
    return data as { id: number; name: string; slug: string; base_price: number; category_id?: number }[];
}

export async function getProductWithSteps(slug: string): Promise<ProductTree | null> {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
        // 1. Fetch Product
        const { data: prodData, error: prodError } = await supabase
            .from('products')
            .select('*')
            .eq('slug', slug)
            .single();

        if (prodError || !prodData) throw new Error('Producto no encontrado');

        // 2. Fetch Steps
        const { data: stepsData, error: stepsError } = await supabase
            .from('product_steps')
            .select('*')
            .eq('product_id', prodData.id)
            .order('order', { ascending: true });

        if (stepsError) throw stepsError;

        // 3. Fetch Options
        const stepIds = stepsData.map((s: any) => s.id);
        let optionsData: any[] = [];

        if (stepIds.length > 0) {
            const { data, error } = await supabase
                .from('step_options')
                .select('*')
                .in('step_id', stepIds)
                .eq('is_available', true)
                .order('name', { ascending: true });
            if (error) throw error;
            optionsData = data;
        }

        // 4. Assemble Tree
        const stepsWithOptions = stepsData.map((step: any) => ({
            id: Number(step.id),
            name: step.name,
            label: step.label,
            order: Number(step.order),
            min_selections: Number(step.min_selections),
            max_selections: step.max_selections === '' || step.max_selections === null ? null : Number(step.max_selections),
            included_selections: Number(step.included_selections ?? 0),
            price_per_extra: Number(step.price_per_extra ?? 0),
            options: optionsData
                .filter(opt => Number(opt.step_id) === Number(step.id))
                .map(opt => ({
                    id: Number(opt.id),
                    name: opt.name,
                    price_extra: Number(opt.price_extra ?? 0),
                    is_available: opt.is_available
                }))
        }));

        return {
            id: Number(prodData.id),
            name: prodData.name,
            slug: prodData.slug,
            base_price: Number(prodData.base_price ?? 0),
            steps: stepsWithOptions
        };

    } catch (err) {
        console.error('Error fetching product tree:', err);
        return null;
    }
}
