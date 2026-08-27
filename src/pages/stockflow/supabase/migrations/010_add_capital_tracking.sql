-- Migration 010: capital tracking — a cash/capital balance the owner tops
-- up, which Stock In purchases automatically deduct from (with a
-- notification showing how much was just used and on what). Also backs the
-- new Spending tab (Today / Yesterday / Last week / Month / All time).

alter table businesses
  add column if not exists capital_balance numeric(14, 2) not null default 0;

create table if not exists capital_transactions (
    id uuid primary key default gen_random_uuid (),
    business_id uuid not null references businesses (id) on delete cascade,
    type text not null check (
        type in ('topup', 'stock_purchase', 'adjustment')
    ),
    amount numeric(14, 2) not null, -- positive = added to balance, negative = deducted
    product_id uuid references products (id) on delete set null,
    variant_id uuid references product_variants (id) on delete set null,
    note text,
    staff_user_id uuid references staff_users (id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists capital_transactions_business_id_idx
    on capital_transactions (business_id, created_at desc);

alter table capital_transactions enable row level security;

create policy "owner_full_access" on capital_transactions for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);
