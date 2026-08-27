-- ============================================================
-- Adds service tickets: a walk-in "customer service" log for
-- barbershop/salon-style businesses. Each row is one service done
-- for one customer (haircut, shave, braids, etc), who did it, what
-- it cost the shop (supplies + staff commission), and what's left
-- as profit.
--
-- customer_name/customer_phone are snapshots taken at the time of
-- the service (so history still reads correctly even if the linked
-- customer is later renamed or removed). customer_id links back to
-- the existing `customers` table when the customer is saved/known.
-- ============================================================

create table service_tickets (
    id uuid primary key default gen_random_uuid (),
    business_id uuid not null references businesses (id) on delete cascade,
    staff_user_id uuid references staff_users (id) on delete set null,
    customer_id uuid references customers (id) on delete set null,
    customer_name text not null,
    customer_phone text,
    service_name text not null,
    amount numeric(12, 2) not null default 0,
    supply_cost numeric(12, 2) not null default 0,
    commission_pct numeric(5, 2) not null default 0,
    commission_amount numeric(12, 2) not null default 0,
    note text,
    created_at timestamptz not null default now()
);

create index on service_tickets (business_id, created_at desc);

create index on service_tickets (customer_id);

create index on service_tickets (staff_user_id);

alter table service_tickets enable row level security;

create policy "owner_full_access" on service_tickets for all using (
    business_id in (
        select id
        from businesses
        where
            owner_auth_id = auth.uid ()
    )
);