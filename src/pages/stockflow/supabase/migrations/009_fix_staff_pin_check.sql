-- The original constraint only allowed a raw 4-digit PIN. The app now
-- briefly stores a 'pending' placeholder on insert, then overwrites it
-- with a 64-char SHA-256 hex hash (see src/lib/pinHash.js). Both of those
-- values violated the old constraint. Allow either form.

alter table staff_users drop constraint staff_users_pin_check;

alter table staff_users
add constraint staff_users_pin_check check (
    pin ~ '^[0-9]{4}$'
    or pin ~ '^[0-9a-f]{64}$'
);