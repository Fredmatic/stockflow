-- Migration: fix missing sub_name column on product_variants
-- The Products page (variant sub-types, e.g. "Cangaroo Capes" under a
-- "Capes" product with types/variants) was shipped expecting this column,
-- but no migration ever created it — causing "Could not find the
-- 'sub_name' column" errors when saving products with variants.

alter table product_variants
  add column if not exists sub_name text;
