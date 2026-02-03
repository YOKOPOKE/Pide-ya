import Stripe from 'stripe';

let stripePromise: Stripe | undefined;

export const getStripe = () => {
    if (!stripePromise) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
            throw new Error('STRIPE_SECRET_KEY is missing');
        }
        stripePromise = new Stripe(key, {
            // apiVersion: '2025-01-27.acacia', // Use default or specific version
        });
    }
    return stripePromise;
};
