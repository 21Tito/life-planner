-- Make timezone nullable so NULL means "not set yet" vs an explicit choice.
-- Existing rows that were never intentionally set are still 'UTC' (the old
-- column default) — clear those so the UI shows "Set timezone" for them.

alter table public.trips alter column timezone drop not null;
alter table public.trips alter column timezone set default null;

update public.trips set timezone = null where timezone = 'UTC';
