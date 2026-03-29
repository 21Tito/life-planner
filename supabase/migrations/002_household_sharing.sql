-- ===========================================
-- Household Sharing
-- ===========================================
-- Allows an account owner to invite others to collaborate
-- on their trips and meal plans.

-- =====================
-- HOUSEHOLD MEMBERS
-- =====================
create table public.household_members (
  owner_id  uuid references public.profiles(id) on delete cascade not null,
  member_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (owner_id, member_id),
  check (owner_id != member_id)
);

alter table public.household_members enable row level security;

create policy "Owners manage members"
  on public.household_members for all using (auth.uid() = owner_id);

create policy "Members view own membership"
  on public.household_members for select using (auth.uid() = member_id);

-- =====================
-- HOUSEHOLD INVITES
-- =====================
-- Multi-use invite links. Owner can regenerate (delete + insert) to revoke.
create table public.household_invites (
  id        uuid default gen_random_uuid() primary key,
  owner_id  uuid references public.profiles(id) on delete cascade not null,
  token     uuid default gen_random_uuid() unique not null,
  created_at timestamptz default now()
);

alter table public.household_invites enable row level security;

-- Owner manages their own invites
create policy "Owners manage invites"
  on public.household_invites for all using (auth.uid() = owner_id);

-- Any authenticated user can read an invite (token acts as the secret)
create policy "Authenticated users can read invites"
  on public.household_invites for select using (auth.uid() is not null);

-- =====================
-- HELPER FUNCTION
-- =====================
create or replace function public.is_household_member(resource_owner_id uuid)
returns boolean
language sql
security definer
stable as $$
  select exists (
    select 1 from public.household_members
    where owner_id = resource_owner_id
      and member_id = auth.uid()
  );
$$;

-- =====================
-- UPDATE RLS POLICIES
-- Allow household members to read/write the owner's data
-- =====================

-- pantry_items
drop policy if exists "Users can manage own pantry" on public.pantry_items;
create policy "Users can manage pantry"
  on public.pantry_items for all using (
    auth.uid() = user_id
    or public.is_household_member(user_id)
  );

-- meal_plans
drop policy if exists "Users can manage own meal plans" on public.meal_plans;
create policy "Users can manage meal plans"
  on public.meal_plans for all using (
    auth.uid() = user_id
    or public.is_household_member(user_id)
  );

-- meals
drop policy if exists "Users can manage own meals" on public.meals;
create policy "Users can manage meals"
  on public.meals for all using (
    auth.uid() = user_id
    or public.is_household_member(user_id)
  );

-- grocery_items
drop policy if exists "Users can manage own grocery items" on public.grocery_items;
create policy "Users can manage grocery items"
  on public.grocery_items for all using (
    auth.uid() = user_id
    or public.is_household_member(user_id)
  );

-- trips
drop policy if exists "Users can manage own trips" on public.trips;
create policy "Users can manage trips"
  on public.trips for all using (
    auth.uid() = user_id
    or public.is_household_member(user_id)
  );

-- trip_days
drop policy if exists "Users can manage own trip days" on public.trip_days;
create policy "Users can manage trip days"
  on public.trip_days for all using (
    auth.uid() = user_id
    or public.is_household_member(user_id)
  );

-- trip_activities
drop policy if exists "Users can manage own trip activities" on public.trip_activities;
create policy "Users can manage trip activities"
  on public.trip_activities for all using (
    auth.uid() = user_id
    or public.is_household_member(user_id)
  );

-- =====================
-- INDEXES
-- =====================
create index idx_household_members_owner  on public.household_members(owner_id);
create index idx_household_members_member on public.household_members(member_id);
create index idx_household_invites_owner  on public.household_invites(owner_id);
create index idx_household_invites_token  on public.household_invites(token);
