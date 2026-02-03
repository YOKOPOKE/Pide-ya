
-- Corregir Slugs de Productos Generados Automáticamente
BEGIN;

-- 1. Arreglar Poke Mediano
UPDATE public.products 
SET slug = 'poke-mediano' 
WHERE name ILIKE 'poke mediano' OR slug LIKE 'new-product-%' AND name ILIKE '%mediano%';

-- 2. Arreglar Poke Grande
UPDATE public.products 
SET slug = 'poke-grande' 
WHERE name ILIKE 'poke grande' OR slug LIKE 'new-product-%' AND name ILIKE '%grande%';

-- 3. Arreglar Sushi Burger (Opcional pero útil)
UPDATE public.products 
SET slug = 'sushi-burger-res' 
WHERE name ILIKE 'sushi burger res' OR slug LIKE 'new-product-%' AND name ILIKE '%burger%';

COMMIT;
