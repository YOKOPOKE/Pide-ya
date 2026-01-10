-- =============================================
-- MASTER SCRIPT: FULL MENU & CATEGORIES
-- =============================================

-- 1. ADD COLUMN (Safe to run multiple times)
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';

-- 2. UPDATE EXISTING CUSTOM BUILDER ITEMS
UPDATE products SET category = 'bowls' WHERE type = 'poke';
UPDATE products SET category = 'burgers' WHERE type = 'burger';

-- 3. CLEANUP PREVIOUS ATTEMPTS FOR FIXED MENU
DELETE FROM products WHERE category IN ('Pokes de la Casa', 'Share & Smile', 'Drinks', 'Postres');

-- 4. INSERT FIXED MENU ITEMS

-- POKES DE LA CASA
INSERT INTO products (name, slug, type, category, base_price, description, image_url, is_active) VALUES
('Sweet & Crunch', 'sweet-crunch', 'other', 'Pokes de la Casa', 150, 'Arroz blanco, mango, pimientos, Philadelphia, pollo teriyaki, aguacate, won ton, cacahuate garapiñado, banana chips y salsa de anguila', '', true),
('California', 'california', 'other', 'Pokes de la Casa', 125, 'Arroz blanco, aguacate, pepino, Philadelphia, kanikama, salsa soya, ponzu y almendra fileteada', '', true),
('Black Mamba', 'black-mamba', 'other', 'Pokes de la Casa', 150, 'Arroz negro, spicy tuna, pimientos, mango, sweet salmon, Philadelphia, betabel bacon, won ton, banana chips, salsa de mango habanero', '', true),
('Bowl Verde', 'bowl-verde', 'other', 'Pokes de la Casa', 135, 'Noodles de vegetales, aguacate, zanahoria, tomate cherry, almendra fileteada, olive oil y un toque de mayo cilantro', '', true),
('Mexicano', 'mexicano', 'other', 'Pokes de la Casa', 160, 'Arroz blanco, arrachera, elote, pimientos, aguacate, zanahoria, pollo al grill, cacahuate, mayo ajo, mayo cilantro y un toque de habanero drops', '', true);

-- SHARE & SMILE
INSERT INTO products (name, slug, type, category, base_price, description, image_url, is_active) VALUES
('Edamames', 'edamames', 'other', 'Share & Smile', 100, 'Vainas de edamame salteadas en ajonjolí oil, toque de limón y salsas orientales', '', true),
('Pollo al Grill', 'pollo-grill-share', 'other', 'Share & Smile', 150, 'Pollo a la plancha acompañado de un mix de verduras de temporada y un scoop de arroz', '', true),
('Torre Won Ton', 'torre-won-ton', 'other', 'Share & Smile', 135, 'Atún fresco en salsa de mayo siracha acompañado de aguacate y pepino, servido en crujientes láminas de won ton', '', true),
('Kushiagues', 'kushiagues', 'other', 'Share & Smile', 110, 'Crujientes empanizados al estilo japonés rellenos de Queso o Plátano', '', true),
('Rollos Vietnamita', 'rollos-vietnamita', 'other', 'Share & Smile', 120, 'Rollos fritos rellenos de vegetales salteados en salsas orientales y queso derretido', '', true),
('Green Rolls', 'green-rolls', 'other', 'Share & Smile', 115, 'Verduras de temporada envueltas en una delicada hoja de papel arroz fresco', '', true),
('Papas Trufadas', 'papas-trufadas', 'other', 'Share & Smile', 250, 'Papas gajo bañadas en aceite de trufa, queso parmesano y especias de la casa, acompañadas de mermelada de tocino y pork belly bites', '', true),
('Camarones Panko', 'camarones-panko', 'other', 'Share & Smile', 150, 'Camarones empanizados al estilo japonés servidos con nuestra salsa de temporada', '', true),
('Gyozas', 'gyozas', 'other', 'Share & Smile', 120, 'Deliciosas gyozas salteadas en un preparado oriental', '', true);

-- DRINKS
INSERT INTO products (name, slug, type, category, base_price, description, image_url, is_active) VALUES
('Water People', 'water-people', 'other', 'Drinks', 35, 'Agua de manantial gasificada (0 cal 0 Azúcares) - Pink Lemonade, Fresa + Albahaca, Mora + Açai', '', true),
('Refresher del día', 'refresher-dia', 'other', 'Drinks', 50, 'Bebida refrescante del día', '', true),
('Café', 'cafe', 'other', 'Drinks', 35, '', '', true),
('Agua Embotellada', 'agua-embotellada', 'other', 'Drinks', 25, '', '', true),
('Coca Cola', 'coca-cola', 'other', 'Drinks', 35, '', '', true),
('Coca Cola Light', 'coca-cola-light', 'other', 'Drinks', 35, '', '', true),
('Soda Japonesa', 'soda-japonesa', 'other', 'Drinks', 35, '', '', true),
('Monster Zero', 'monster-zero', 'other', 'Drinks', 48, '', '', true),
('Modelo Especial', 'modelo-especial', 'other', 'Drinks', 45, '', '', true),
('Modelo Negra', 'modelo-negra', 'other', 'Drinks', 45, '', '', true),
('Modelo Negra 0%', 'modelo-negra-zero', 'other', 'Drinks', 45, '', '', true),
('Lucky Buddha Beer', 'lucky-buddha', 'other', 'Drinks', 85, '', '', true);

-- POSTRES
INSERT INTO products (name, slug, type, category, base_price, description, image_url, is_active) VALUES
('By GERANIO', 'by-geranio', 'other', 'Postres', 110, 'Postres contemporáneos basados en la temporalidad e innovación', '', true),
('Helado Artesanal', 'helado-artesanal', 'other', 'Postres', 95, 'Sabores de temporada', '', true),
('Mochis', 'mochis', 'other', 'Postres', 100, 'Bocaditos dulces de arroz con una textura elástica inconfundible', '', true);
