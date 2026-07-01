-- Migration 008: add owner_name, trial tracking, and subscription status
-- to the businesses table. Also widens the `type` check to include all the
-- new business types added to the signup form.

alter table businesses
  add column if not exists owner_name text,
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'expired', 'cancelled'));

-- Widen the type check to include all options shown in the signup form
alter table businesses
  drop constraint if exists businesses_type_check;

alter table businesses
  add constraint businesses_type_check
    check (type in (
      'retail', 'electronics', 'supermarket', 'restaurant',
      'barbershop', 'clothing', 'wholesale', 'pharmacy', 'hardware', 'other'
    ));

-- Backfill existing businesses: they were created before trials existed so
-- give them a generous trial end date (90 days from now) so existing users
-- aren't suddenly locked out.
update businesses
  set trial_ends_at = now() + interval '90 days'
  where trial_ends_at < now() + interval '13 days'; -- only touch rows we just created with the default
