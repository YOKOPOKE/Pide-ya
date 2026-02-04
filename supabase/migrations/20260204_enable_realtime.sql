-- =====================================================
-- SAFE Enable Supabase Realtime on Tables
-- =====================================================
-- This script checks if the table is already enabled before adding it
-- to prevent "relation already member" errors.
-- =====================================================

DO $$
BEGIN
    -- 1. Enable for 'products'
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'products') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE products;
    END IF;

    -- 2. Enable for 'categories'
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'categories') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE categories;
    END IF;

    -- 3. Enable for 'product_steps'
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'product_steps') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE product_steps;
    END IF;

    -- 4. Enable for 'step_options'
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'step_options') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE step_options;
    END IF;

END $$;

-- Verify final status
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
