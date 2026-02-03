
-- Check for categories resembling 'burger'
SELECT * FROM categories WHERE name ILIKE '%burger%';

-- Assuming we find a category, let's list products. 
-- We'll list ALL products first to see if we can spot them if the category name is different.
SELECT id, name, slug, category, base_price, is_active FROM products WHERE name ILIKE '%burger%' OR slug ILIKE '%burger%';
