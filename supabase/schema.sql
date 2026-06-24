-- ============================================================
-- StockFlow schema for Supabase (Postgres)
-- Run this in: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- One business = one Supabase Auth account (the owner's login).
-- Staff/cashiers don't get their own Supabase Auth account — they
-- pick their name + a 4-digit PIN on a shared device. This keeps
-- security (Row Level Security) simple while still letting you see
-- who did what.

create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_auth_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('retail', 'electronics', 'supermarket')),
  created_at timestamptz not null default now()
);

create table staff_users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  role text not null check (role in ('owner', 'staff', 'cashier')),
  pin text not null check (pin ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  unique (business_id, pin)
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  sku text,
  barcode text,
  cost_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  reorder_level integer not null default 5,
  attributes jsonb not null default '{}'::jsonb, -- e.g. {"imei":"..."} or {"expiry_date":"..."}
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index on products (business_id);

-- Every stock change is a row here. Current quantity = sum(quantity).
-- quantity is signed: positive = stock added, negative = stock removed.
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  type text not null check (type in ('restock', 'sale', 'adjustment', 'damaged')),
  quantity integer not null,
  note text,
  staff_user_id uuid references staff_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on stock_movements (product_id);
create index on stock_movements (business_id, created_at desc);

create table sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  staff_user_id uuid references staff_users(id) on delete set null,
  total_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  unit_cost numeric(12,2) not null default 0
);

-- ------------------------------------------------------------
-- View: current stock level per product (the heart of the app)
-- ------------------------------------------------------------
create view product_stock as
select
  p.id as product_id,
  p.business_id,
  p.name,
  p.sku,
  p.reorder_level,
  p.selling_price,
  coalesce(sum(sm.quantity), 0) as quantity_on_hand,
  case
    when coalesce(sum(sm.quantity), 0) <= 0 then 'out_of_stock'
    when coalesce(sum(sm.quantity), 0) <= p.reorder_level then 'low_stock'
    else 'in_stock'
  end as status
from products p
left join stock_movements sm on sm.product_id = p.id
where p.is_active = true
group by p.id, p.business_id, p.name, p.sku, p.reorder_level, p.selling_price;

-- ------------------------------------------------------------
-- Row Level Security — every table is locked to the owner's
-- Supabase Auth account. Staff/cashiers operate through the
-- same logged-in session (the shared shop device).
-- ------------------------------------------------------------
alter table businesses enable row level security;
alter table staff_users enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table stock_movements enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;

create policy "owner_full_access" on businesses
  for all using (owner_auth_id = auth.uid());

create policy "owner_full_access" on staff_users
  for all using (business_id in (select id from businesses where owner_auth_id = auth.uid()));

create policy "owner_full_access" on categories
  for all using (business_id in (select id from businesses where owner_auth_id = auth.uid()));

create policy "owner_full_access" on products
  for all using (business_id in (select id from businesses where owner_auth_id = auth.uid()));

create policy "owner_full_access" on stock_movements
  for all using (business_id in (select id from businesses where owner_auth_id = auth.uid()));

create policy "owner_full_access" on sales
  for all using (business_id in (select id from businesses where owner_auth_id = auth.uid()));

create policy "owner_full_access" on sale_items
  for all using (sale_id in (
    select id from sales where business_id in (
      select id from businesses where owner_auth_id = auth.uid()
    )
  ));
