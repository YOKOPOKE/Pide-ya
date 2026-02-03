import { expect, test, describe } from 'vitest'
import { calculateProductTotal, ProductTree, ProductStep, ProductOption } from './src/lib/pricing'

// --- Mock Data Factories ---
const mockOption = (id: number, price_extra: number = 0, name = "Opt"): ProductOption => ({
    id, name, price_extra, is_available: true
})

const mockStep = (id: number, included: number, price_per_extra: number, options: ProductOption[]): ProductStep => ({
    id, name: "step", label: "Step", order: 1,
    min_selections: 0, max_selections: null,
    included_selections: included,
    price_per_extra,
    options
})

const mockProduct = (basePrice: number, steps: ProductStep[]): ProductTree => ({
    id: 1, name: "Poke", slug: "poke", base_price: basePrice, steps
})

describe('Pricing Engine', () => {

    test('Calculates Base Price correctly when no selections', () => {
        const product = mockProduct(150, []);
        expect(calculateProductTotal(product, {})).toBe(150);
    });

    test('Includes free toppings correctly', () => {
        const opt1 = mockOption(1, 0);
        const step = mockStep(1, 1, 10, [opt1]); // 1 Included, Extra cost 10
        const product = mockProduct(100, [step]);

        // Select 1 (Included)
        expect(calculateProductTotal(product, { 1: [1] })).toBe(100);
    });

    test('Charges for extra toppings beyond included limit', () => {
        const opt1 = mockOption(1, 0);
        const opt2 = mockOption(2, 0);
        const step = mockStep(1, 1, 10, [opt1, opt2]); // 1 Included, Extra cost 10
        const product = mockProduct(100, [step]);

        // Select 2 (1 Free, 1 Paid) -> 100 + 10 = 110
        expect(calculateProductTotal(product, { 1: [1, 2] })).toBe(110);
    });

    test('Charges for Premium Ingredients PLUS Slot Cost', () => {
        // This tests the "Double Charge" scenario logic we decided on.
        // If Avocado is $20 Premium, and you pick it as your 2nd item (where 2nd slot costs $10).
        // Total Extra = $20 (Avocado) + $10 (Slot) = $30.

        const regular = mockOption(1, 0, "Cucumber");
        const premium = mockOption(2, 20, "Avocado"); // +20

        const step = mockStep(1, 1, 10, [regular, premium]); // 1 Included, Extra Slot cost 10
        const product = mockProduct(100, [step]);

        // Scenario A: Pick Regular (1st, Free Slot). Total 100.
        expect(calculateProductTotal(product, { 1: [1] })).toBe(100);

        // Scenario B: Pick Premium (1st, Free Slot). Total 100 + 20(Premium) = 120.
        expect(calculateProductTotal(product, { 1: [2] })).toBe(120);

        // Scenario C: Pick Regular + Premium. 
        // 2 items total. 1 Included. 1 Extra Slot ($10).
        // Premium cost ($20).
        // Total = 100 (Base) + 10 (Slot) + 20 (Premium) = 130.
        expect(calculateProductTotal(product, { 1: [1, 2] })).toBe(130);
    });

    test('Handles multiple steps independenty', () => {
        const step1 = mockStep(1, 1, 10, [mockOption(1), mockOption(2)]); // Base
        const step2 = mockStep(2, 0, 50, [mockOption(3)]); // Protein (0 included, pay all)

        const product = mockProduct(100, [step1, step2]);

        // Step 1: 2 items (1 free, 1 extra=10)
        // Step 2: 1 item (0 free, 1 extra=50)
        // Total = 100 + 10 + 50 = 160
        expect(calculateProductTotal(product, { 1: [1, 2], 2: [3] })).toBe(160);
    });

});
