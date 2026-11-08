-- ===========================================
-- Shopping list, and marking planned meals as cooked
-- ===========================================

create table public.shopping_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null check (length(trim(name)) > 0 and length(name) <= 200),
  quantity text check (quantity is null or length(quantity) <= 100),
  checked boolean default false not null,
  created_at timestamptz default now() not null
);

alter table public.shopping_items enable row level security;

create policy "Household can manage shopping items"
  on public.shopping_items for all
  using (auth.uid() = user_id or public.is_household_member(user_id))
  with check (auth.uid() = user_id or public.is_household_member(user_id));

create index idx_shopping_items_user on public.shopping_items(user_id);

alter table public.meal_plan_entries
  add column cooked_at timestamptz;
