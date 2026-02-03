-- Add category column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';

-- Update existing items
UPDATE products SET category = 'bowls' WHERE type = 'poke';
UPDATE products SET category = 'burgers' WHERE type = 'burger';
