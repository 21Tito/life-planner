-- ===========================================
-- Meal Planner: recipes, weekly plan, fridge review
-- ===========================================
-- The fridge reuses public.pantry_items (001), which already has household RLS (002).
-- Supersedes meal_plans / meals / grocery_items from 001, which the app no longer uses.
-- Requires Postgres 15+ for `on delete set null (column)`.

-- =====================
-- RECIPES (reusable across weeks)
-- =====================
create table public.recipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null check (length(trim(title)) > 0),
  source_url text,
  instructions text,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  -- Target for composite FKs so child rows can't point at another household's recipe
  unique (id, user_id)
);

alter table public.recipes enable row level security;

create policy "Household can manage recipes"
  on public.recipes for all
  using (auth.uid() = user_id or public.is_household_member(user_id))
  with check (auth.uid() = user_id or public.is_household_member(user_id));

-- =====================
-- RECIPE INGREDIENTS
-- =====================
create table public.recipe_ingredients (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null check (length(trim(name)) > 0),
  quantity text, -- free text, e.g. "2", "1 lb", "1/2 cup"
  sort_order int default 0 not null,
  foreign key (recipe_id, user_id)
    references public.recipes(id, user_id) on delete cascade
);

alter table public.recipe_ingredients enable row level security;

create policy "Household can manage recipe ingredients"
  on public.recipe_ingredients for all
  using (auth.uid() = user_id or public.is_household_member(user_id))
  with check (auth.uid() = user_id or public.is_household_member(user_id));

-- =====================
-- MEAL PLAN ENTRIES (one per day + slot)
-- =====================
create table public.meal_plan_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  slot text not null check (slot in ('lunch', 'dinner')),
  recipe_id uuid,
  -- Recipe title snapshot, or a free-text note like "Leftovers"; survives recipe deletion
  title text not null check (length(trim(title)) > 0),
  created_at timestamptz default now() not null,
  unique (user_id, date, slot),
  foreign key (recipe_id, user_id)
    references public.recipes(id, user_id) on delete set null (recipe_id)
);

alter table public.meal_plan_entries enable row level security;

create policy "Household can manage meal plan entries"
  on public.meal_plan_entries for all
  using (auth.uid() = user_id or public.is_household_member(user_id))
  with check (auth.uid() = user_id or public.is_household_member(user_id));

-- =====================
-- PANTRY STATUS (when the fridge was last reviewed, per household)
-- =====================
create table public.pantry_status (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reviewed_at timestamptz default now() not null
);

alter table public.pantry_status enable row level security;

create policy "Household can manage pantry status"
  on public.pantry_status for all
  using (auth.uid() = user_id or public.is_household_member(user_id))
  with check (auth.uid() = user_id or public.is_household_member(user_id));

-- =====================
-- INDEXES
-- =====================
create index idx_recipes_user on public.recipes(user_id);
create index idx_recipe_ingredients_recipe on public.recipe_ingredients(recipe_id);
create index idx_meal_plan_entries_recipe on public.meal_plan_entries(recipe_id);
-- (user_id, date) lookups are covered by the unique (user_id, date, slot) index
