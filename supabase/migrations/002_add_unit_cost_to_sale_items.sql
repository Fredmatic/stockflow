-- Migration: add unit_cost to sale_items
-- Fixes profit calculation, which was always showing profit = revenue
-- because sale_items had no column to store the cost price at time of sale.

alter table sale_items
  add column if not exists unit_cost numeric(12,2) not null default 0;

comment on column sale_items.unit_cost is
  'Cost price per unit at the time this sale was made (copied from products.cost_price). Stored historically so profit stays accurate even if cost prices change later.';

-- Backfill existing sale_items that have no recorded cost (unit_cost = 0)
-- using each product's CURRENT cost_price as a best estimate. This isn't
-- perfectly accurate if cost prices have changed since those old sales,
-- but it's far better than treating historical profit as 0 forever.
update sale_items si
set unit_cost = p.cost_price
from products p
where si.product_id = p.id
  and si.unit_cost = 0;
