-- ===========================================
-- Freezer meals: frozen leftovers linked to their recipe, and planned meals
-- that come out of the freezer
-- ===========================================

-- Target for the composite FK below, so a meal can't point at another household's item
alter table public.pantry_items
  add constraint pantry_items_id_user_key unique (id, user_id);

-- Set for frozen leftovers of a recipe. Those are prepared meals, so they're left out of
-- ingredient matching (a frozen "Mapo tofu" shouldn't count as having tofu).
alter table public.pantry_items
  add column recipe_id uuid,
  add constraint pantry_items_recipe_fk
    foreign key (recipe_id, user_id)
    references public.recipes(id, user_id) on delete set null (recipe_id);

-- A planned meal eaten from the freezer; marking it eaten removes the item
alter table public.meal_plan_entries
  add column pantry_item_id uuid,
  add constraint meal_plan_entries_pantry_item_fk
    foreign key (pantry_item_id, user_id)
    references public.pantry_items(id, user_id) on delete set null (pantry_item_id);
