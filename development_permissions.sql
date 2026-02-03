-- development_permissions.sql
-- ESTE SCRIPT ABRE TOTALMENTE LOS PERMISOS PARA DESARROLLO (SOLO USAR EN MODO DEV)

-- 1. Habilitar RLS en las tablas correctas
-- (Usamos 'products' porque es la tabla real según update_menu_complete.sql)
alter table public.products enable row level security;
alter table public.ingredients enable row level security;
alter table public.orders enable row level security;

-- 2. Eliminar políticas antiguas para evitar conflictos
drop policy if exists "Productos Acceso Total" on public.products;
drop policy if exists "Ingredientes Acceso Total" on public.ingredients;
drop policy if exists "Ordenes Acceso Total" on public.orders;

-- Políticas legacy (por si acaso existen)
drop policy if exists "Public Menu Access 2024" on public.products;
drop policy if exists "Menu Full Access" on public.products;


-- 3. Crear Políticas de "PUERTAS ABIERTAS" (Permite todo a todos, incluso anon)
--    En producción, cambia 'to authenticated' o usa roles específicos.

create policy "Productos Acceso Total" on public.products
for all using (true) with check (true);

create policy "Ingredientes Acceso Total" on public.ingredients
for all using (true) with check (true);

create policy "Ordenes Acceso Total" on public.orders
for all using (true) with check (true);

-- 4. Permisos de Almacenamiento (Storage) para Iconos
--    Asegura que el bucket 'menu-images' exista y sea público
insert into storage.buckets (id, name, public) 
values ('menu-images', 'menu-images', true)
on conflict (id) do update set public = true;

--    Política de acceso total a imágenes
drop policy if exists "Imagenes Menu Publico" on storage.objects;
create policy "Imagenes Menu Publico" on storage.objects
for all using ( bucket_id = 'menu-images' ) with check ( bucket_id = 'menu-images' );
