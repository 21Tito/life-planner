-- ===========================================
-- Google Calendar Integration
-- ===========================================

-- =====================
-- GOOGLE TOKENS (one per user)
-- =====================
create table public.google_tokens (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);

alter table public.google_tokens enable row level security;

create policy "Users can manage own tokens"
  on public.google_tokens for all using (auth.uid() = user_id);

-- =====================
-- Add gcal_event_id to trip_activities
-- =====================
alter table public.trip_activities add column if not exists gcal_event_id text;

-- =====================
-- Drop push notification tables
-- =====================
drop table if exists public.trip_reminders;
drop table if exists public.push_subscriptions;
