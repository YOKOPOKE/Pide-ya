-- Comprehensive fix for product_steps table
-- Adds all columns expected by the Admin Builder if they don't exist.

ALTER TABLE product_steps ADD COLUMN IF NOT EXISTS step_order INTEGER DEFAULT 0;
ALTER TABLE product_steps ADD COLUMN IF NOT EXISTS label TEXT DEFAULT 'Nuevo Paso';
ALTER TABLE product_steps ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE product_steps ADD COLUMN IF NOT EXISTS min_selections INTEGER DEFAULT 0;
ALTER TABLE product_steps ADD COLUMN IF NOT EXISTS max_selections INTEGER DEFAULT 1;
ALTER TABLE product_steps ADD COLUMN IF NOT EXISTS included_selections INTEGER DEFAULT 1;
ALTER TABLE product_steps ADD COLUMN IF NOT EXISTS price_per_extra NUMERIC DEFAULT 0;
ALTER TABLE product_steps ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT TRUE;

-- Also verify step_options just in case
ALTER TABLE step_options ADD COLUMN IF NOT EXISTS price_extra NUMERIC DEFAULT 0;
ALTER TABLE step_options ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;

-- Refresh schema cache advice (User might need to reload Supabase dashboard or Client)
