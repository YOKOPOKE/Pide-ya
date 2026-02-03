-- fix_storage_permissions.sql
-- ESTE SCRIPT SOLO AFECTA A LAS IMAGENES (NO TOCA TABLAS)

-- 1. Asegurar que el bucket 'menu-images' exista y sea público
insert into storage.buckets (id, name, public) 
values ('menu-images', 'menu-images', true)
on conflict (id) do update set public = true;

-- 2. Permitir a cualquiera VER y SUBIR archivos a este bucket
drop policy if exists "Imagenes Menu Publico" on storage.objects;

create policy "Imagenes Menu Publico" on storage.objects
for all using ( bucket_id = 'menu-images' ) with check ( bucket_id = 'menu-images' );
