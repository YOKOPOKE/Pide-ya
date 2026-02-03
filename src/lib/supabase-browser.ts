import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

let supabaseClient: any = null;

export const createClient = () => {
    try {
        if (supabaseClient) return supabaseClient;

        // Only warn in development if real values are missing
        if (process.env.NODE_ENV !== 'production' && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
            console.warn('⚠️ Supabase environment variables not set. Using placeholders.');
        }

        // console.log("DEBUG: Initializing Supabase (supabase-js)...");
        supabaseClient = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY);
        return supabaseClient;
    } catch (e) {
        console.error("CRITICAL: Supabase Init Failed", e);
        throw e;
    }
};
