-- Migration: add expenses tracking
-- Lets the owner log operating costs (rent, transport, utilities, etc.)
-- separately from cost-of-goods, so "net profit" = gross profit - expenses
-- can be shown on the Sales page alongside the existing gross margin.

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  staff_user_id uuid references staff_users(id) on delete set null,
  category text not null,
  amount numeric(12,2) not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_business_created_idx on expenses (business_id, created_at desc);

alter table expenses enable row level security;

create policy "owner_full_access" on expenses
  for all using (business_id in (select id from businesses where owner_auth_id = auth.uid()));
