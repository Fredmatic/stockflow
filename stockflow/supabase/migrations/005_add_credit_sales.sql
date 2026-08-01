-- Migration: credit sales / debtors
-- Lets a sale be marked "pay later" against a customer, and tracks how
-- much each customer currently owes, so the owner/staff can see who
-- owes what and record repayments over time.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  phone text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists customers_business_idx on customers (business_id);

-- A sale can be tagged as "on credit" against a customer instead of paid
-- in full at the till.
alter table sales
  add column if not exists customer_id uuid references customers(id) on delete set null;

alter table sales
  add column if not exists is_credit boolean not null default false;

-- Every change to what a customer owes is one row here: a credit_sale
-- (increases what they owe) or a payment (decreases it). Current balance
-- = sum of credit_sale amounts minus sum of payment amounts. This mirrors
-- how stock_movements/expenses already work in this app — a running
-- ledger instead of an editable balance field.
create table if not exists debt_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  sale_id uuid references sales(id) on delete set null,
  type text not null check (type in ('credit_sale', 'payment')),
  amount numeric(12,2) not null check (amount > 0),
  note text,
  staff_user_id uuid references staff_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists debt_transactions_customer_idx on debt_transactions (customer_id, created_at desc);
create index if not exists debt_transactions_business_idx on debt_transactions (business_id);

alter table customers enable row level security;
alter table debt_transactions enable row level security;

create policy "owner_full_access" on customers
  for all using (business_id in (select id from businesses where owner_auth_id = auth.uid()));

create policy "owner_full_access" on debt_transactions
  for all using (business_id in (select id from businesses where owner_auth_id = auth.uid()));

-- ------------------------------------------------------------
-- View: one row per customer with their current balance (how much
-- they owe right now) and when they last had any activity.
-- ------------------------------------------------------------
drop view if exists debtor_summary;

create view debtor_summary as
select
  c.id as customer_id,
  c.business_id,
  c.name,
  c.phone,
  c.note,
  coalesce(sum(case when t.type = 'credit_sale' then t.amount else -t.amount end), 0) as balance,
  max(t.created_at) as last_activity
from customers c
left join debt_transactions t on t.customer_id = c.id
where c.is_active = true
group by c.id, c.business_id, c.name, c.phone, c.note;
