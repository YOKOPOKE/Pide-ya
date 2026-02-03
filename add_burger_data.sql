-- =============================================
-- ADD SUSHI BURGER DATA (IDEMPOTENT SCRIPT)
-- =============================================

-- 0. Cleanup existing Sushi Burger data into a clean slate
-- Because we have ON DELETE CASCADE on foreign keys in schema_migration.sql,
-- deleting the product should automatically delete its steps and options.
DELETE FROM products WHERE slug = 'sushi-burger';

-- 1. Insert 'Sushi Burger' Product
INSERT INTO products (name, slug, type, base_price, description, image_url, is_active)
VALUES 
('Sushi Burger', 'sushi-burger', 'burger', 155, 'Deliciosa hamburguesa de arroz con tu proteína favorita', 'https://images.unsplash.com/photo-1592417817098-8ec3d9ca96ee', true);

-- 2. Insert Steps for Sushi Burger
-- We use subqueries to get the correct product_id dynamically
INSERT INTO product_steps (product_id, name, label, "order", min_selections, max_selections, price_per_extra) 
VALUES 
((SELECT id FROM products WHERE slug = 'sushi-burger'), 'flavor', 'Elige el Sabor', 1, 1, 1, 0),
((SELECT id FROM products WHERE slug = 'sushi-burger'), 'extras', 'Extras & Salsas', 2, 0, 5, 15);


-- 3. Insert Options
DO $$
DECLARE
    burger_id bigint;
    step_flavor_id bigint;
    step_extras_id bigint;
BEGIN
    SELECT id INTO burger_id FROM products WHERE slug = 'sushi-burger';
    
    -- Get Step IDs (Assuming unique names per product, which is good practice)
    SELECT id INTO step_flavor_id FROM product_steps WHERE product_id = burger_id AND name = 'flavor';
    SELECT id INTO step_extras_id FROM product_steps WHERE product_id = burger_id AND name = 'extras';

    -- Flavors
    INSERT INTO step_options (step_id, name, price_extra, is_available) VALUES
    (step_flavor_id, 'Res', 0, true),
    (step_flavor_id, 'Camarón', 0, true),
    (step_flavor_id, 'Pollo Empanizado', 0, true),
    (step_flavor_id, 'Surimi', 0, true),
    (step_flavor_id, 'Mixta (Res + Camarón)', 20, true);

    -- Extras
    INSERT INTO step_options (step_id, name, price_extra, is_available) VALUES
    (step_extras_id, 'Queso Extra', 15, true),
    (step_extras_id, 'Aguacate Extra', 15, true),
    (step_extras_id, 'Salsa Anguila', 0, true),
    (step_extras_id, 'Salsa Chipotle', 0, true);
END $$;
