-- =====================
-- TRIP HOTELS
-- =====================
create table public.trip_hotels (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  location text,
  maps_url text,
  check_in_date date not null,
  check_out_date date not null,
  notes text,
  created_at timestamptz default now()
);

alter table public.trip_hotels enable row level security;

create policy "Users can manage own trip hotels"
  on public.trip_hotels for all using (auth.uid() = user_id);

create index idx_trip_hotels_trip on public.trip_hotels(trip_id);
