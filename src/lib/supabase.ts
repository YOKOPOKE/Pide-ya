
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Warn in development if real values are missing
if (process.env.NODE_ENV !== 'production' && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    console.warn('⚠️ Supabase environment variables not set. Using placeholders for build.');
}

export const supabase = createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    global: {
        // Force fetch to not cache requests to ensure fresh data
        fetch: (url, options) => {
            return fetch(url, { ...options, cache: 'no-store' });
        }
    }
});

export const createClient = () => supabase;

// console.log('Supabase Client Initialized with URL:', supabaseUrl);
