-- ===========================================
-- Push Subscriptions & Trip Reminders
-- ===========================================

-- =====================
-- PUSH SUBSCRIPTIONS (one per device per user)
-- =====================
create table public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Users can manage own push subscriptions"
  on public.push_subscriptions for all using (auth.uid() = user_id);

-- =====================
-- TRIP REMINDERS
-- =====================
create table public.trip_reminders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  activity_id uuid references public.trip_activities(id) on delete cascade not null,
  remind_at timestamptz not null,
  remind_minutes_before int not null default 60,
  sent boolean default false,
  created_at timestamptz default now(),
  unique(activity_id, remind_minutes_before)
);

alter table public.trip_reminders enable row level security;

create policy "Users can manage own reminders"
  on public.trip_reminders for all using (auth.uid() = user_id);

-- =====================
-- INDEXES
-- =====================
create index idx_push_subs_user on public.push_subscriptions(user_id);
create index idx_reminders_due on public.trip_reminders(remind_at) where sent = false;
create index idx_reminders_activity on public.trip_reminders(activity_id);
