-- Optional fields shown on printed/shared receipts. All nullable — a
-- business that hasn't filled these in just gets a shorter receipt (no
-- location/contact/QR lines), nothing breaks.
-- Run in Supabase SQL Editor. Save as the next numbered file in
-- supabase/migrations/ (check your migrations folder for the next free
-- number — 013 was already taken by add_service_tickets).

alter table businesses
add column if not exists tagline text,
add column if not exists location text,
add column if not exists phone text,
add column if not exists social_platform text,
add column if not exists social_handle text;