import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
export const supabase = createClient(supabaseUrl, supabaseKey);

export interface ProductOption {
    id: number;
    name: string;
    description?: string;
    price_modifier?: number;
    max_quantity?: number;
    price_extra?: number; // Added to match usage
}

export interface ProductStep {
    id: number;
    name: string;
    label?: string; // Added to match usage
    description?: string;
    min_selections: number;
    max_selections: number;
    options: ProductOption[];
    price_per_extra?: number; // Added
    included_selections?: number; // Added
}

export interface Product {
    id: number;
    name: string;
    base_price: number;
    description?: string;
    image_url?: string;
    category_id?: number;
    categories?: { name: string }; // For join
    slug?: string;
    type?: string; // Added to match Admin
    active?: boolean;
    steps?: ProductStep[];
}

export interface Category {
    id: number;
    name: string;
    slug: string;
    description?: string;
}

export interface ProductTree extends Product {
    steps: ProductStep[];
}

export async function getAllProducts(): Promise<Product[]> {
    const { data, error } = await supabase
        .from('products')
        .select(`
            *,
            categories (
                name
            )
        `)
        .eq('is_active', true);

    if (error) {
        console.error("Error getting products:", error);
        return [];
    }
    return data || [];
}

export async function getProductWithSteps(slug: string): Promise<ProductTree | null> {
    return getProductBySlug(slug) as Promise<ProductTree | null>;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
    // 1. Get Product
    const { data: product, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .single();

    if (prodError || !product) return null;

    // 2. Get Steps & Options
    const { data: steps, error: stepsError } = await supabase
        .from('product_steps')
        .select(`
            *,
            product_options (*)
        `)
        .eq('product_id', product.id)
        .order('order_index');

    if (stepsError) {
        console.error("Error getting steps:", stepsError);
        return product;
    }

    // Transform to cleaner structure
    const stepsFormatted: ProductStep[] = steps.map((s: any) => ({
        id: s.id,
        name: s.name,
        label: s.name, // Map name to label for compatibility
        description: s.description,
        min_selections: s.min_selections,
        max_selections: s.max_selections,
        price_per_extra: s.price_per_extra || 0,
        included_selections: s.included_selections || 0,
        options: s.product_options.map((o: any) => ({
            id: o.id,
            name: o.name,
            description: o.description,
            price_modifier: o.price_modifier,
            price_extra: o.price_modifier || 0 // Map modifier to extra
        }))
    }));

    return { ...product, steps: stepsFormatted };
}

export async function getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('id');

    if (error) {
        console.error("Error fetching categories:", error);
        return [];
    }
    return data || [];
}

export async function getCategoryByName(nameFragment: string): Promise<Category | null> {
    const categories = await getCategories();
    return categories.find(c => c.name.toLowerCase().includes(nameFragment.toLowerCase())) || null;
}

export async function getProductsByCategory(categoryId: number): Promise<Product[]> {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_active', true);
    if (error) return [];
    return data || [];
}

/**
 * Returns a structured string representation of the active menu by category.
 */
export async function getMenuContext(): Promise<string> {
    const products = await getAllProducts();
    if (!products.length) return "No hay productos disponibles por el momento.";

    // Group by Category Name
    const grouped: Record<string, Product[]> = {};

    products.forEach((p: any) => {
        const catName = p.categories?.name || 'Otros';
        if (!grouped[catName]) grouped[catName] = [];
        grouped[catName].push(p);
    });

    let menuText = "";
    for (const [category, items] of Object.entries(grouped)) {
        menuText += `\n[${category.toUpperCase()}]\n`;
        items.forEach(p => {
            menuText += `- ${p.name} ($${p.base_price}): ${p.description || ''}\n`;
        });
    }

    return menuText.trim();
}
