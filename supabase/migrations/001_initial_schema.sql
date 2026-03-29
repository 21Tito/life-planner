-- ===========================================
-- Life Planner - Database Schema
-- ===========================================
-- Run this in your Supabase SQL Editor or as a migration

-- =====================
-- PROFILES (extends Supabase auth.users)
-- =====================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  stripe_customer_id text unique,
  subscription_status text default 'free' check (subscription_status in ('free', 'pro', 'cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================
-- PANTRY / FRIDGE INVENTORY
-- =====================
create table public.pantry_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  category text default 'other' check (category in (
    'protein', 'dairy', 'vegetable', 'fruit', 'grain',
    'spice', 'condiment', 'frozen', 'beverage', 'other'
  )),
  quantity text, -- e.g. "2 lbs", "1 bunch", "half gallon"
  expiry_date date,
  created_at timestamptz default now()
);

alter table public.pantry_items enable row level security;

create policy "Users can manage own pantry"
  on public.pantry_items for all using (auth.uid() = user_id);

-- =====================
-- MEAL PLANS
-- =====================
create table public.meal_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null, -- e.g. "Week of Mar 31"
  week_start date not null,
  preferences text, -- dietary preferences, notes
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.meal_plans enable row level security;

create policy "Users can manage own meal plans"
  on public.meal_plans for all using (auth.uid() = user_id);

-- =====================
-- MEALS (individual meals within a plan)
-- =====================
create table public.meals (
  id uuid default gen_random_uuid() primary key,
  meal_plan_id uuid references public.meal_plans(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Mon, 6=Sun
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  title text not null,
  description text,
  recipe jsonb, -- full recipe: { ingredients: [], steps: [], prep_time, cook_time }
  created_at timestamptz default now()
);

alter table public.meals enable row level security;

create policy "Users can manage own meals"
  on public.meals for all using (auth.uid() = user_id);

-- =====================
-- GROCERY LIST (auto-generated from meal plan)
-- =====================
create table public.grocery_items (
  id uuid default gen_random_uuid() primary key,
  meal_plan_id uuid references public.meal_plans(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  quantity text,
  category text,
  checked boolean default false,
  created_at timestamptz default now()
);

alter table public.grocery_items enable row level security;

create policy "Users can manage own grocery items"
  on public.grocery_items for all using (auth.uid() = user_id);

-- =====================
-- TRIPS
-- =====================
create table public.trips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  destination text not null,
  start_date date not null,
  end_date date not null,
  notes text,
  budget_cents int, -- stored in cents for precision
  cover_image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.trips enable row level security;

create policy "Users can manage own trips"
  on public.trips for all using (auth.uid() = user_id);

-- =====================
-- TRIP DAYS
-- =====================
create table public.trip_days (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  day_number int not null,
  date date not null,
  title text, -- e.g. "Arrival Day", "Beach Day"
  notes text,
  created_at timestamptz default now()
);

alter table public.trip_days enable row level security;

create policy "Users can manage own trip days"
  on public.trip_days for all using (auth.uid() = user_id);

-- =====================
-- TRIP ACTIVITIES
-- =====================
create table public.trip_activities (
  id uuid default gen_random_uuid() primary key,
  trip_day_id uuid references public.trip_days(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  category text default 'activity' check (category in (
    'flight', 'hotel', 'restaurant', 'activity', 'transport', 'shopping', 'rest', 'other'
  )),
  start_time time,
  end_time time,
  location text,
  cost_cents int,
  booking_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table public.trip_activities enable row level security;

create policy "Users can manage own trip activities"
  on public.trip_activities for all using (auth.uid() = user_id);

-- =====================
-- INDEXES
-- =====================
create index idx_pantry_user on public.pantry_items(user_id);
create index idx_meal_plans_user on public.meal_plans(user_id);
create index idx_meals_plan on public.meals(meal_plan_id);
create index idx_grocery_plan on public.grocery_items(meal_plan_id);
create index idx_trips_user on public.trips(user_id);
create index idx_trip_days_trip on public.trip_days(trip_id);
create index idx_trip_activities_day on public.trip_activities(trip_day_id);
