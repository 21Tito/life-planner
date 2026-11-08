-- Lets shopping items be grouped by a chosen category (null = guessed from the name).
-- The quantity column is no longer used by the app.
alter table public.shopping_items
  add column category text check (category in (
    'protein', 'dairy', 'vegetable', 'fruit', 'grain',
    'spice', 'condiment', 'frozen', 'beverage', 'other'
  ));
