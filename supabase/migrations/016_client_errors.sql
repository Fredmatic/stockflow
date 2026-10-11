-- ============================================================
-- Migration 016 — error monitoring
-- Every crash a user hits in the app is saved here so you can see it
-- (and fix it) before the customer has to phone you.
-- View them: Supabase Dashboard -> Table Editor -> client_errors
-- ============================================================
create table if not exists client_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  business_id uuid,
  message text not null,
  stack text,
  url text,
  user_agent text,
  app_version text,
  context jsonb not null default '{}'::jsonb
);

create index if not exists client_errors_created_idx on client_errors (created_at desc);

alter table client_errors enable row level security;

-- A signed-in user can only write their own errors, and cannot read anyone's.
-- You read them as the project owner in the Supabase dashboard.
drop policy if exists "users can log their own errors" on client_errors;
create policy "users can log their own errors" on client_errors
  for insert to authenticated
  with check (user_id = auth.uid());
