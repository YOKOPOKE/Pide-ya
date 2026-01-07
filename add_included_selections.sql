-- Add included_selections column to product_steps if it doesn't exist
alter table product_steps 
add column if not exists included_selections integer default 1;

-- Ensure price_per_extra exists (it should, but just in case)
alter table product_steps 
add column if not exists price_per_extra numeric default 0;

-- Update existing steps to sensible defaults if they are null
update product_steps set included_selections = 1 where included_selections is null;
update product_steps set price_per_extra = 0 where price_per_extra is null;
