import { createClient } from '@/lib/supabase';

// Tipos reflejados de Builder.tsx pero simplificados para el bot
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

export async function getProductWithSteps(slug: string): Promise<ProductTree | null> {
    const supabase = createClient();

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
        const stepIds = stepsData.map(s => s.id);
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
        const stepsWithOptions = stepsData.map(step => ({
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
