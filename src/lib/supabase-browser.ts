import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let supabaseClient: any = null;

export const createClient = () => {
    try {
        if (supabaseClient) return supabaseClient;

        if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase Env Vars");

        // console.log("DEBUG: Initializing Supabase (supabase-js)...");
        supabaseClient = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY);
        return supabaseClient;
    } catch (e) {
        console.error("CRITICAL: Supabase Init Failed", e);
        throw e;
    }
};
