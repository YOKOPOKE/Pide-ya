import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xsolxbroqqjkoseksmny.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzb2x4YnJvcXFqa29zZWtzbW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTQ2MTksImV4cCI6MjA4MzE5MDYxOX0.sGIq7yEoEw5Sw1KKHhRQOEJGX2HjEDcOelO49IVhndk';

let supabaseClient: any = null;

export const createClient = () => {
    try {
        if (supabaseClient) return supabaseClient;

        // console.log("DEBUG: Initializing Supabase (supabase-js)...");
        supabaseClient = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY);
        return supabaseClient;
    } catch (e) {
        console.error("CRITICAL: Supabase Init Failed", e);
        throw e;
    }
};
