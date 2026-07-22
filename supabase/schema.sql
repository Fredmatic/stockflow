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
    id uuid primary key default gen_random_uuid (),
    owner_auth_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    type text not null check (
        type in (
            'retail',
            'electronics',
            'supermarket'
        )
    ),
    capital_balance numeric(14, 2) not null default 0,
    created_at timestamptz not null default now()
);

create table staff_users (
    id uuid primary key default gen_random_uuid (),
    business_id uuid not null references businesses (id) on delete cascade,
    name text not null,
    role text not null check (
        role in ('owner', 'staff', 'cashier')
    ),
    pin text not null check (
        pin ~ '^[0-9]{4}$'
        or pin ~ '^[0-9a-f]{64}$'
    ),
    created_at timestamptz not null default now(),
    unique (business_id, pin)
);

create table categories (
    id uuid primary key default gen_random_uuid (),
    business_id uuid not null references businesses (id) on delete cascade,
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
  has_variants boolean not null default false, -- true = priced/stocked per product_variants row instead of on this row
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index on products (business_id);

-- Types/variants of a product (e.g. "Screen Guard" -> Ceramic, Full Glue,
-- Matte), each with its own price, cost price, and stock. Used when
-- products.has_variants = true; the parent products row then just holds
-- the shared name/category, and selling/stocking happens per variant.
create table product_variants (
    id uuid primary key default gen_random_uuid (),
    product_id uuid not null references products (id) on delete cascade,
    business_id uuid not null references businesses (id) on delete cascade,
    name text not null,
    sub_name text,
    sku text,
    barcode text,
    cost_price numeric(12, 2) not null default 0,
    selling_price numeric(12, 2) not null default 0,
    reorder_level integer not null default 5,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create index on product_variants (product_id);

create index on product_variants (business_id);

-- Every stock change is a row here. Current quantity = sum(quantity).
-- quantity is signed: positive = stock added, negative = stock removed.
create table stock_movements (
    id uuid primary key default gen_random_uuid (),
    product_id uuid not null references products (id) on delete cascade,
    variant_id uuid references product_variants (id) on delete cascade,
    business_id uuid not null references businesses (id) on delete cascade,
    type text not null check (
        type in (
            'restock',
            'sale',
            'adjustment',
            'damaged'
        )
    ),
    quantity integer not null,
    note text,
    staff_user_id uuid references staff_users (id) on delete set null,
    created_at timestamptz not null default now()
);

create index on stock_movements (product_id);

create index on stock_movements (variant_id);

create index on stock_movements (business_id, created_at desc);

-- A customer who can buy on credit (pay later) instead of paying in full
-- at the till.
create table customers (
    id uuid primary key default gen_random_uuid (),
    business_id uuid not null references businesses (id) on delete cascade,
    name text not null,
    phone text,
    note text,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create index on customers (business_id);

create table sales (
    id uuid primary key default gen_random_uuid (),
    business_id uuid not null references businesses (id) on delete cascade,
    staff_user_id uuid references staff_users (id) on delete set null,
    customer_id uuid references customers (id) on delete set null,
    is_credit boolean not null default false,
    total_amount numeric(12, 2) not null default 0,
    created_at timestamptz not null default now()
);

create table sale_items (
    id uuid primary key default gen_random_uuid (),
    sale_id uuid not null references sales (id) on delete cascade,
    product_id uuid not null references products (id) on delete restrict,
    variant_id uuid references product_variants (id) on delete set null,
    quantity integer not null,
    unit_price numeric(12, 2) not null,
    unit_cost numeric(12, 2) not null default 0
);

-- Every change to the owner's capital balance is a row here: a 'topup'
-- (owner adding cash in) or a 'stock_purchase' (auto-deducted whenever
-- Stock In records a restock with a cost price). Powers the Spending tab.
create table capital_transactions (
    id uuid primary key default gen_random_uuid (),
    business_id uuid not null references businesses (id) on delete cascade,
    type text not null check (
        type in ('topup', 'stock_purchase', 'sale_income', 'debt_payment', 'adjustment')
    ),
    amount numeric(14, 2) not null, -- positive = added to balance, negative = deducted
    product_id uuid references products (id) on delete set null,
    variant_id uuid references product_variants (id) on delete set null,
    note text,
    staff_user_id uuid references staff_users (id) on delete set null,
    created_at timestamptz not null default now()
);

create index on capital_transactions (business_id, created_at desc);

-- Operating expenses (rent, transport, utilities, etc.) — tracked
-- separately from cost-of-goods so "net profit" can be shown alongside
-- the per-product gross margin already calculated from sale_items.
create table expenses (
    id uuid primary key default gen_random_uuid (),
    business_id uuid not null references businesses (id) on delete cascade,
    staff_user_id uuid references staff_users (id) on delete set null,
    category text not null,
    amount numeric(12, 2) not null,
    note text,
    created_at timestamptz not null default now()
);

create index on expenses (business_id, created_at desc);

-- Every change to what a customer owes is one row here: a credit_sale
-- (increases what they owe) or a payment (decreases it). Current balance
-- = sum of credit_sale amounts minus sum of payment amounts.
create table debt_transactions (
    id uuid primary key default gen_random_uuid (),
    business_id uuid not null references businesses (id) on delete cascade,
    customer_id uuid not null references customers (id) on delete cascade,
    sale_id uuid references sales (id) on delete set null,
    type text not null check (
        type in ('credit_sale', 'payment')
    ),
    amount numeric(12, 2) not null check (amount > 0),
    note text,
    staff_user_id uuid references staff_users (id) on delete set null,
    created_at timestamptz not null default now()
);

create index on debt_transactions (customer_id, created_at desc);

create index on debt_transactions (business_id);

-- A lender who YOU owe money to (personal/business loans, advances, etc).
-- Separate from `customers` (who owe the shop) and unrelated to stock
-- suppliers. due_date is a self-reminder of when you intend to repay.
create table lenders (
    id uuid primary key default gen_random_uuid (),
    business_id uuid not null references businesses (id) on delete cascade,
    name text not null,
    phone text,
    note text,
    due_date date,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create index on lenders (business_id);

-- Every change to what you owe a lender is one row here: 'borrowed'
-- (increases what you owe) or 'repayment' (decreases it).
create table lender_transactions (
    id uuid primary key default gen_random_uuid (),
    business_id uuid not null references businesses (id) on delete cascade,
    lender_id uuid not null references lenders (id) on delete cascade,
    type text not null check (
        type in ('borrowed', 'repayment')
    ),
    amount numeric(12, 2) not null check (amount > 0),
    note text,
    staff_user_id uuid references staff_users (id) on delete set null,
    created_at timestamptz not null default now()
);

create index on lender_transactions (lender_id, created_at desc);

create index on lender_transactions (business_id);

-- ------------------------------------------------------------
-- View: current stock level per SELLABLE item (the heart of the app).
-- A row is either a simple product, or one variant/type of a
-- variant-parent product (has_variants = true).
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- View: one row per customer with their current balance (how much
-- they owe right now) and when they last had any activity.
-- ------------------------------------------------------------
create view debtor_summary as
select
    c.id as customer_id,
    c.business_id,
    c.name,
    c.phone,
    c.note,
    coalesce(
        sum(
            case
                when t.type = 'credit_sale' then t.amount
                else - t.amount
            end
        ),
        0
    ) as balance,
    max(t.created_at) as last_activity
from
    customers c
    left join debt_transactions t on t.customer_id = c.id
where
    c.is_active = true
group by
    c.id,
    c.business_id,
    c.name,
    c.phone,
    c.note;

-- ------------------------------------------------------------
-- View: one row per lender with the current balance (how much you
-- still owe them) and when they last had any activity.
-- ------------------------------------------------------------
create view lender_summary as
select
    l.id as lender_id,
    l.business_id,
    l.name,
    l.phone,
    l.note,
    l.due_date,
    coalesce(
        sum(
            case
                when t.type = 'borrowed' then t.amount
                else - t.amount
            end
        ),
        0
    ) as balance,
    max(t.created_at) as last_activity
from
    lenders l
    left join lender_transactions t on t.lender_id = l.id
where
    l.is_active = true
group by
    l.id,
    l.business_id,
    l.name,
    l.phone,
    l.note,
    l.due_date;

-- ------------------------------------------------------------
-- Row Level Security — every table is locked to the owner's
-- Supabase Auth account. Staff/cashiers operate through the
-- same logged-in session (the shared shop device).
-- ------------------------------------------------------------
alter table businesses enable row level security;

alter table staff_users enable row level security;

alter table categories enable row level security;

alter table products enable row level security;

alter table product_variants enable row level security;

alter table stock_movements enable row level security;

alter table customers enable row level security;

alter table sales enable row level security;

alter table sale_items enable row level security;

alter table expenses enable row level security;

alter table capital_transactions enable row level security;

alter table debt_transactions enable row level security;

alter table lenders enable row level security;

alter table lender_transactions enable row level security;

create policy "owner_full_access" on businesses for all using (owner_auth_id = auth.uid ());

create policy "owner_full_access" on staff_users for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);

create policy "owner_full_access" on categories for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);

create policy "owner_full_access" on products for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);

create policy "owner_full_access" on product_variants for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);

create policy "owner_full_access" on stock_movements for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);

create policy "owner_full_access" on sales for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);

create policy "owner_full_access" on sale_items for all using (
    sale_id in (
        select id
        from sales
        where
            business_id in (
                select id
                from businesses
                where
                    owner_auth_id = auth.uid ()
            )
    )
);

create policy "owner_full_access" on expenses for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);

create policy "owner_full_access" on capital_transactions for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);

create policy "owner_full_access" on customers for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);

create policy "owner_full_access" on debt_transactions for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);

create policy "owner_full_access" on lenders for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);

create policy "owner_full_access" on lender_transactions for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);