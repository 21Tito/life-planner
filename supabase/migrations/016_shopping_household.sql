-- Shopping items can be household supplies (paper towels, soap). Those never go into
-- the kitchen, so pantry_items keeps its food-only categories.
alter table public.shopping_items
  drop constraint if exists shopping_items_category_check;

alter table public.shopping_items
  add constraint shopping_items_category_check check (category in (
    'protein', 'dairy', 'vegetable', 'fruit', 'grain',
    'spice', 'condiment', 'frozen', 'beverage', 'household', 'other'
  ));
