-- Add a JSONB column to store flexible product configuration
-- This allows defining rules like:
-- [
--   { "categoryId": "protein", "label": "Proteínas", "included": 2, "extraPrice": 45 },
--   { "categoryId": "toppings", "label": "Toppings", "included": 4, "extraPrice": 5 }
-- ]
ALTER TABLE sizes ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '[]'::jsonb;

-- Optional: Add a 'type' column to distinguish between Bowls, Burgers, etc. more explicitly if needed
-- But we can likely use the existing 'name' or add a new column if we want strict typing.
-- For now, let's just ensure we have the config column.
