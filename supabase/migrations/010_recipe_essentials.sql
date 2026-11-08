-- Ingredients a recipe can't be made without; used to suggest meals from the fridge
alter table public.recipe_ingredients
  add column is_essential boolean default false not null;
