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

/**
 * Calculates the total price of a customized product.
 * @param product The full product tree with steps and options
 * @param selections A map of Step ID -> Array of Option IDs selected
 * @returns Total price including base price and extra costs
 */
export function calculateProductTotal(product: ProductTree, selections: Record<number, number[]>) {
    let total = product.base_price;

    product.steps.forEach(step => {
        const selectedOptionIds = selections[step.id] || [];
        const included = step.included_selections;
        const pricePerExtra = step.price_per_extra;

        // Find the actual option objects to check their specific extra prices
        const selectedOptions = step.options.filter(o => selectedOptionIds.includes(o.id));

        // Logic:
        // 1. All selected options might have their own `price_extra` (premium ingredients like Avocado).
        // 2. ADITIONALLY, we check if the COUNT of selections exceeds `included`.
        //    If so, we add `pricePerExtra` for each item over the limit.
        //    Wait, which items are "over the limit"? The cheapest ones? The most expensive? 
        //    Typically, the "slots" are priced. 
        //    Let's assume the count excess pays `pricePerExtra`.
        //    AND specialized `price_extra` on an option is ALWAYS added regardless of slots?
        //    
        //    Re-reading SQL schema:
        //    `price_per_extra` on Step: "Cost if user exceeds 'included'"
        //    `price_extra` on Option: "Markup for specific premium ingredients"

        //    So:
        //    Total = Base + Sum(Option.price_extra) + (max(0, Count - Included) * Step.price_per_extra)

        let stepExtra = 0;

        // A. Option Specific Premiums (Always added?)
        // Example: Philly Cheese (+$0) vs Truffle (+$20). 
        // Even if it's your "first" topping, if it's premium, you pay? 
        // Or is premium only if it's an EXTRA topping?
        // Analyzing `whatsappBot.ts` previous logic:
        /*
            selectedOptions.forEach((opt, idx) => {
                const isFree = idx < included;
                if (!isFree) {
                    total += step.price_per_extra;
                    total += opt.price_extra;
                }
            });
        */
        // The previous bot logic was: Sort by... index? (insertion order).
        // First N items are free.
        // Subsequent items cost `step.price_per_extra` + `opt.price_extra`.
        // This implies `opt.price_extra` is ONLY charged if it's an "Extra" selection?
        // That seems wrong for "Premium Ingredients". Usually premiums are paid even if included.
        // BUT, adhering to "Robustness", I should stick to the existing observed behavior OR safe defaults.
        // Looking at `add_full_menu.sql`:
        // "Proteína (Elige 1)". included=1. price_per_extra=40.
        // "Agrega extra por $40".
        // If I pick 2 proteins: 1st is free. 2nd is $40.
        // If I pick "Spicy Tuna" (price_extra=0) and "Salmon" (price_extra=0). Total +40.
        // If I pick "Premium Steak" (price_extra=20?).

        // Let's stick to the simpler interpretation that seems standard:
        // 1. Count based extra.
        // 2. Ingredient based extra (always).

        // However, to match the Bot's old logic (which I must assume was "working" or at least intended):
        // It calculated cost for items *after* index >= included.

        // I will implement the standard robust logic:
        // Extras count = max(0, selected - included).
        // Step Cost = Extras Count * price_per_extra.
        // Option Cost = Sum of price_extra of ALL selected options (Premuims are premiums).

        const extraCount = Math.max(0, selectedOptionIds.length - included);
        stepExtra += extraCount * pricePerExtra;

        selectedOptions.forEach(opt => {
            stepExtra += opt.price_extra;
        });

        total += stepExtra;
    });

    return total;
}
