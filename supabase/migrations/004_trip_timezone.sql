-- Add timezone to trips table
alter table public.trips add column if not exists timezone text not null default 'UTC';
