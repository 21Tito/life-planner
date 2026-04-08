-- STANDALONE GROCERY LIST
-- ========================
create table public.grocery_list_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  quantity text,
  is_staple boolean default false not null,
  checked boolean default false not null,
  created_at timestamptz default now()
);

alter table public.grocery_list_items enable row level security;

create policy "Users can manage own grocery list"
  on public.grocery_list_items for all using (auth.uid() = user_id);

create index idx_grocery_list_user on public.grocery_list_items(user_id);
