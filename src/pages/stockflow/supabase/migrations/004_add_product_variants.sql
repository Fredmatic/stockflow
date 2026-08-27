-- Migration: product variants (types)
-- Lets a single product (e.g. "Screen Guard") have multiple types/variants
-- (e.g. Ceramic, Full Glue, Matte) each with their own price, cost price,
-- and stock count — instead of creating a separate product per type.
--
-- A product is either:
--   - a simple product (has_variants = false): priced/stocked on the
--     products row itself, exactly like before, OR
--   - a variant parent (has_variants = true): the products row just holds
--     the shared name/category/barcode-search info, and each type is a row
--     in product_variants with its own price, cost, and stock.

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null, -- the type, e.g. "Ceramic", "Full Glue"
  sku text,
  barcode text,
  cost_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  reorder_level integer not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists product_variants_product_idx on product_variants (product_id);
create index if not exists product_variants_business_idx on product_variants (business_id);

alter table products
  add column if not exists has_variants boolean not null default false;

-- A stock movement or sale item can now point at a specific variant.
-- product_id is still kept (pointing at the parent product) so existing
-- business-wide queries/filters by product_id keep working unchanged.
alter table stock_movements
  add column if not exists variant_id uuid references product_variants(id) on delete cascade;

alter table sale_items
  add column if not exists variant_id uuid references product_variants(id) on delete set null;

create index if not exists stock_movements_variant_idx on stock_movements (variant_id);
create index if not exists sale_items_variant_idx on sale_items (variant_id);

alter table product_variants enable row level security;

create policy "owner_full_access" on product_variants
  for all using (business_id in (select id from businesses where owner_auth_id = auth.uid()));

-- ------------------------------------------------------------
-- Replace product_stock view so it returns one row per SELLABLE
-- item: a simple product, or each individual variant of a
-- variant-parent product. This is what Sell / Stock In / Dashboard
-- query to show what's actually in stock and ready to sell.
-- ------------------------------------------------------------
drop view if exists product_stock;

create view product_stock as
select
  p.id as product_id,
  null::uuid as variant_id,
  p.business_id,
  p.name as product_name,
  null::text as variant_name,
  p.sku,
  p.barcode,
  p.reorder_level,
  p.selling_price,
  p.cost_price,
  coalesce(sum(sm.quantity), 0) as quantity_on_hand,
  case
    when coalesce(sum(sm.quantity), 0) <= 0 then 'out_of_stock'
    when coalesce(sum(sm.quantity), 0) <= p.reorder_level then 'low_stock'
    else 'in_stock'
  end as status
from products p
left join stock_movements sm on sm.product_id = p.id and sm.variant_id is null
where p.is_active = true and p.has_variants = false
group by p.id, p.business_id, p.name, p.sku, p.barcode, p.reorder_level, p.selling_price, p.cost_price

union all

select
  v.product_id,
  v.id as variant_id,
  v.business_id,
  p.name as product_name,
  v.name as variant_name,
  v.sku,
  v.barcode,
  v.reorder_level,
  v.selling_price,
  v.cost_price,
  coalesce(sum(sm.quantity), 0) as quantity_on_hand,
  case
    when coalesce(sum(sm.quantity), 0) <= 0 then 'out_of_stock'
    when coalesce(sum(sm.quantity), 0) <= v.reorder_level then 'low_stock'
    else 'in_stock'
  end as status
from product_variants v
join products p on p.id = v.product_id
left join stock_movements sm on sm.variant_id = v.id
where v.is_active = true and p.is_active = true and p.has_variants = true
group by v.id, v.product_id, v.business_id, p.name, v.name, v.sku, v.barcode, v.reorder_level, v.selling_price, v.cost_price;
