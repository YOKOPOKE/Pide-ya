
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Warn in development if real values are missing
if (process.env.NODE_ENV !== 'production' && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    console.warn('⚠️ Supabase environment variables not set. Using placeholders for build.');
}

export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

export const createClient = () => supabase;
