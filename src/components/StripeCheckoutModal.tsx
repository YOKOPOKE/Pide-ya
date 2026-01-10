'use client';

import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { X } from 'lucide-react';

const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
if (!key) console.warn("Stripe Publishable Key is missing!");
const stripePromise = key ? loadStripe(key) : null;

export default function StripeCheckoutModal({ clientSecret }: { clientSecret: string, onClose?: () => void }) {
    return (
        <div className="w-full h-full flex flex-col bg-white">
            <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ clientSecret }}
            >
                <EmbeddedCheckout className="flex-1" />
            </EmbeddedCheckoutProvider>
        </div>
    );
}
