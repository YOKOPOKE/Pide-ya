
-- Transacción para asegurar integridad
BEGIN;

-- 1. Asegurar Categoría 'Bowls'
INSERT INTO public.categories (name, slug, is_active)
VALUES ('Pokes de la Casa', 'bowls', true)
ON CONFLICT (slug) DO UPDATE SET is_active = true;

-- Obtener ID de categoría bowls
DO $$
DECLARE
    cat_id BIGINT;
    p_med_id BIGINT;
    p_gde_id BIGINT;
    step_id BIGINT;
BEGIN
    SELECT id INTO cat_id FROM public.categories WHERE slug = 'bowls';

    -- 2. Insertar/Actualizar POKE MEDIANO
    INSERT INTO public.products (
        name, slug, description, base_price, category_id, is_active, type, image_url
    ) VALUES (
        'Poke Mediano', 
        'poke-mediano', 
        'Tu Poke favorito de tamaño ideal (2 Proteínas)', 
        139.00, 
        cat_id, 
        true, 
        'bowl',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'
    )
    ON CONFLICT (slug) DO UPDATE SET 
        base_price = 139.00,
        is_active = true,
        category_id = cat_id
    RETURNING id INTO p_med_id;

    -- 3. Insertar/Actualizar POKE GRANDE
    INSERT INTO public.products (
        name, slug, description, base_price, category_id, is_active, type, image_url
    ) VALUES (
        'Poke Grande', 
        'poke-grande', 
        'Poke para mucha hambre (3 Proteínas)', 
        169.00, 
        cat_id, 
        true, 
        'bowl',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'
    )
    ON CONFLICT (slug) DO UPDATE SET 
        base_price = 169.00,
        is_active = true,
        category_id = cat_id
    RETURNING id INTO p_gde_id;

    -- =============================================
    -- CONFIGURACIÓN DE PASOS (Steps) para MEDIANO
    -- =============================================
    
    -- Limpiar pasos anteriores para evitar duplicados al re-correr seed
    DELETE FROM public.product_steps WHERE product_id IN (p_med_id, p_gde_id);

    -- Loop para ambos productos (Mediano y Grande) para compartir pasos básicos
    -- Diferencia: Cantidad de Proteínas (Mediano=2, Grande=3)
    
    -- ---------------------------------------------
    -- PASO 1: BASE
    -- ---------------------------------------------
    INSERT INTO public.product_steps (product_id, name, description, min_selections, max_selections, order_index, is_required)
    VALUES (p_med_id, 'Elige tu Base', 'Selecciona 1 base', 1, 1, 1, true) RETURNING id INTO step_id;
    
    INSERT INTO public.product_options (step_id, name, price_modifier) VALUES 
    (step_id, 'Arroz Blanco', 0),
    (step_id, 'Arroz Integral', 0),
    (step_id, 'Mix de Lechugas', 0),
    (step_id, 'Mitad Blanco / Mitad Lechuga', 0);

    INSERT INTO public.product_steps (product_id, name, description, min_selections, max_selections, order_index, is_required)
    VALUES (p_gde_id, 'Elige tu Base', 'Selecciona 1 base', 1, 1, 1, true) RETURNING id INTO step_id;
    
    INSERT INTO public.product_options (step_id, name, price_modifier) VALUES 
    (step_id, 'Arroz Blanco', 0),
    (step_id, 'Arroz Integral', 0),
    (step_id, 'Mix de Lechugas', 0),
    (step_id, 'Mitad Blanco / Mitad Lechuga', 0);

    -- ---------------------------------------------
    -- PASO 2: PROTEÍNAS (Diferente Max)
    -- ---------------------------------------------
    -- Mediano: Max 2
    INSERT INTO public.product_steps (product_id, name, description, min_selections, max_selections, order_index, is_required, included_selections, price_per_extra)
    VALUES (p_med_id, 'Proteínas', 'Elige hasta 2 proteínas', 1, 2, 2, true, 2, 45) RETURNING id INTO step_id;
    
    INSERT INTO public.product_options (step_id, name, price_modifier) VALUES 
    (step_id, 'Atún Fresco', 0),
    (step_id, 'Salmón Fresco', 0),
    (step_id, 'Pollo Teriyaki', 0),
    (step_id, 'Camarón Cocido', 0),
    (step_id, 'Tofu Firme', 0),
    (step_id, 'Kanikama (Cangrejo)', 0);

    -- Grande: Max 3
    INSERT INTO public.product_steps (product_id, name, description, min_selections, max_selections, order_index, is_required, included_selections, price_per_extra)
    VALUES (p_gde_id, 'Proteínas', 'Elige hasta 3 proteínas', 1, 3, 2, true, 3, 45) RETURNING id INTO step_id;
    
    INSERT INTO public.product_options (step_id, name, price_modifier) VALUES 
    (step_id, 'Atún Fresco', 0),
    (step_id, 'Salmón Fresco', 0),
    (step_id, 'Pollo Teriyaki', 0),
    (step_id, 'Camarón Cocido', 0),
    (step_id, 'Tofu Firme', 0),
    (step_id, 'Kanikama (Cangrejo)', 0);

    -- ---------------------------------------------
    -- PASO 3: MIX-INS (Ingredientes)
    -- ---------------------------------------------
    INSERT INTO public.product_steps (product_id, name, description, min_selections, max_selections, order_index, is_required, included_selections, price_per_extra)
    VALUES (p_med_id, 'Mix-ins', 'Agrega frescura (Incluye 4)', 0, 10, 3, false, 4, 15) RETURNING id INTO step_id;
    
    INSERT INTO public.product_options (step_id, name, price_modifier) VALUES 
    (step_id, 'Pepino', 0), (step_id, 'Zanahoria', 0), (step_id, 'Edamame', 0),
    (step_id, 'Mango', 0), (step_id, 'Piña', 0), (step_id, 'Elote Dulce', 0),
    (step_id, 'Cebolla Morada', 0), (step_id, 'Jicama', 0), (step_id, 'Tomate Cherry', 0),
    (step_id, 'Aguacate Extra', 25); -- Aguacate suele cobrarse aparte o incluirse limitado

    -- Grande Mixins
    INSERT INTO public.product_steps (product_id, name, description, min_selections, max_selections, order_index, is_required, included_selections, price_per_extra)
    VALUES (p_gde_id, 'Mix-ins', 'Agrega frescura (Incluye 5)', 0, 10, 3, false, 5, 15) RETURNING id INTO step_id;
    
    INSERT INTO public.product_options (step_id, name, price_modifier) VALUES 
    (step_id, 'Pepino', 0), (step_id, 'Zanahoria', 0), (step_id, 'Edamame', 0),
    (step_id, 'Mango', 0), (step_id, 'Piña', 0), (step_id, 'Elote Dulce', 0),
    (step_id, 'Cebolla Morada', 0), (step_id, 'Jicama', 0), (step_id, 'Tomate Cherry', 0),
    (step_id, 'Aguacate Extra', 25);

    -- ---------------------------------------------
    -- PASO 4: SALSAS
    -- ---------------------------------------------
    INSERT INTO public.product_steps (product_id, name, description, min_selections, max_selections, order_index, is_required)
    VALUES (p_med_id, 'Salsas', 'El toque final', 1, 2, 4, true) RETURNING id INTO step_id;
    
    INSERT INTO public.product_options (step_id, name, price_modifier) VALUES 
    (step_id, 'Soya Yoko (De la casa)', 0), (step_id, 'Ponzu (Cítrica)', 0),
    (step_id, 'Spicy Mayo', 0), (step_id, 'Anguila (Dulce)', 0),
    (step_id, 'Aerezzo de Cilantro', 0);

    INSERT INTO public.product_steps (product_id, name, description, min_selections, max_selections, order_index, is_required)
    VALUES (p_gde_id, 'Salsas', 'El toque final', 1, 2, 4, true) RETURNING id INTO step_id;
    
    INSERT INTO public.product_options (step_id, name, price_modifier) VALUES 
    (step_id, 'Soya Yoko (De la casa)', 0), (step_id, 'Ponzu (Cítrica)', 0),
    (step_id, 'Spicy Mayo', 0), (step_id, 'Anguila (Dulce)', 0),
    (step_id, 'Aerezzo de Cilantro', 0);

    -- ---------------------------------------------
    -- PASO 5: TOPPINGS / CRUNCH
    -- ---------------------------------------------
    INSERT INTO public.product_steps (product_id, name, description, min_selections, max_selections, order_index, is_required, included_selections, price_per_extra)
    VALUES (p_med_id, 'Toppings & Crunch', 'Dale textura', 0, 5, 5, false, 3, 10) RETURNING id INTO step_id;
    
    INSERT INTO public.product_options (step_id, name, price_modifier) VALUES 
    (step_id, 'Ajonjolí Mixto', 0), (step_id, 'Cebolla Crispy', 0),
    (step_id, 'Wonton Frito', 0), (step_id, 'Nori Tiras', 0),
    (step_id, 'Cacahuate Tostado', 0), (step_id, 'Coco Rallado', 0);

    INSERT INTO public.product_steps (product_id, name, description, min_selections, max_selections, order_index, is_required, included_selections, price_per_extra)
    VALUES (p_gde_id, 'Toppings & Crunch', 'Dale textura', 0, 5, 5, false, 3, 10) RETURNING id INTO step_id;
    
    INSERT INTO public.product_options (step_id, name, price_modifier) VALUES 
    (step_id, 'Ajonjolí Mixto', 0), (step_id, 'Cebolla Crispy', 0),
    (step_id, 'Wonton Frito', 0), (step_id, 'Nori Tiras', 0),
    (step_id, 'Cacahuate Tostado', 0), (step_id, 'Coco Rallado', 0);

END $$;

COMMIT;
