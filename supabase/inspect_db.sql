-- 1. Ver qué tablas existen realmente en el esquema 'public'
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- 2. Ver las columnas de la tabla 'products'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products';

-- 3. Ver los primeros 10 productos
SELECT * FROM products LIMIT 10;

-- 4. Intentar ver 'categories' (si da error, es que no existe)
SELECT * FROM categories LIMIT 10;
