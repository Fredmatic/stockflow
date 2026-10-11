-- ============================================================
-- Migration 015 — several businesses per owner + business-type features
-- Run in: Supabase Dashboard -> SQL Editor -> New query
-- Safe to run more than once.
-- ============================================================

-- 1) One owner login can now run several businesses.
--    (Row Level Security already scopes every table by
--    "business_id in (businesses owned by auth.uid())", so each
--    business's data stays separate with no policy changes.)
alter table businesses drop constraint if exists businesses_owner_auth_id_key;
create index if not exists businesses_owner_idx on businesses (owner_auth_id);

-- 2) Two new kinds of business: salon, bar.
alter table businesses drop constraint if exists businesses_type_check;
alter table businesses
  add constraint businesses_type_check
  check (type in (
    'retail', 'electronics', 'supermarket', 'restaurant',
    'barbershop', 'salon', 'clothing', 'wholesale',
    'pharmacy', 'hardware', 'bar', 'other'
  ));

-- 3) Per-business switches, e.g. {"services": true} turns the Services
--    module on for a type that doesn't normally have it.
alter table businesses
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- 4) Extra details captured at the till, per type of business:
--    restaurant {order_type, table, deliver_to}, bar {table},
--    pharmacy {patient, prescriber}, electronics {serial},
--    hardware/wholesale {delivery, deliver_to}.
alter table sales
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- 5) Services grow from "walk-in haircut" into bookings and repair jobs.
--    status: completed = money earned (the only status counted as revenue)
--            booked / in_progress / ready = open work, deposit may be held
--            cancelled = never counted
--    Note: when an open job is completed, created_at is set to that moment
--    so every existing report ("today", "this month") counts the revenue on
--    the day the money was actually earned. received_at keeps when it came in.
alter table service_tickets
  add column if not exists status text not null default 'completed',
  add column if not exists payment_method text,
  add column if not exists tip_amount numeric(12, 2) not null default 0,
  add column if not exists item_details text,
  add column if not exists deposit_amount numeric(12, 2) not null default 0,
  add column if not exists scheduled_at timestamptz,
  add column if not exists received_at timestamptz;

alter table service_tickets drop constraint if exists service_tickets_status_check;
alter table service_tickets
  add constraint service_tickets_status_check
  check (status in ('booked', 'in_progress', 'ready', 'completed', 'cancelled'));

update service_tickets set received_at = created_at where received_at is null;

create index if not exists service_tickets_status_idx on service_tickets (business_id, status);
