-- Migration: lenders (money YOU owe — personal/business loans, advances,
-- etc.) — separate from `customers` (who owe the shop) and unrelated to
-- stock suppliers. Mirrors the customers/debt_transactions pattern, but
-- inverted: a "borrowed" transaction increases what you owe a lender, a
-- "repayment" decreases it. due_date drives the on-device reminder (this
-- is a reminder for yourself, not a message sent to the lender).

create table if not exists lenders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  phone text,
  note text,
  due_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists lenders_business_idx on lenders (business_id);

-- Every change to what you owe a lender is one row here: 'borrowed'
-- (increases what you owe) or 'repayment' (decreases it). Current balance
-- = sum of borrowed amounts minus sum of repayment amounts.
create table if not exists lender_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  lender_id uuid not null references lenders(id) on delete cascade,
  type text not null check (type in ('borrowed', 'repayment')),
  amount numeric(12,2) not null check (amount > 0),
  note text,
  staff_user_id uuid references staff_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lender_transactions_lender_idx on lender_transactions (lender_id, created_at desc);
create index if not exists lender_transactions_business_idx on lender_transactions (business_id);

alter table lenders enable row level security;
alter table lender_transactions enable row level security;

create policy "owner_full_access" on lenders
  for all using (business_id in (select id from businesses where owner_auth_id = auth.uid()));

create policy "owner_full_access" on lender_transactions
  for all using (business_id in (select id from businesses where owner_auth_id = auth.uid()));

-- ------------------------------------------------------------
-- View: one row per lender with the current balance (how much you
-- still owe them) and when they last had any activity.
-- ------------------------------------------------------------
drop view if exists lender_summary;

create view lender_summary as
select
  l.id as lender_id,
  l.business_id,
  l.name,
  l.phone,
  l.note,
  l.due_date,
  coalesce(sum(case when t.type = 'borrowed' then t.amount else -t.amount end), 0) as balance,
  max(t.created_at) as last_activity
from lenders l
left join lender_transactions t on t.lender_id = l.id
where l.is_active = true
group by l.id, l.business_id, l.name, l.phone, l.note, l.due_date;
