-- ============================================================
-- Admin dashboard access
-- Run this in: Supabase Dashboard -> SQL Editor -> New query
-- Fixes: the admin dashboard (fssaazi46@gmail.com) currently can only see
-- its OWN business's rows, because every table's RLS policy is scoped to
-- owner_auth_id = auth.uid(). These policies add a second, OR'd rule that
-- grants full read (and for businesses, write) access specifically to the
-- admin email, without loosening access for anyone else.
--
-- If you ever change the admin's login email, update it here too — these
-- three policies are the only places it's referenced.
-- ============================================================

create policy "admin_full_access" on businesses for all using (
    auth.jwt () ->> 'email' = 'fssaazi46@gmail.com'
);

create policy "admin_read_sales" on sales for
select using (
        auth.jwt () ->> 'email' = 'fssaazi46@gmail.com'
    );

create policy "admin_read_staff" on staff_users for
select using (
        auth.jwt () ->> 'email' = 'fssaazi46@gmail.com'
    );

-- Sanity check afterwards — log into the admin dashboard, then in SQL
-- Editor (as yourself, not the dashboard) run:
-- select count(*) from businesses;
-- and compare it to how many rows the dashboard actually lists.