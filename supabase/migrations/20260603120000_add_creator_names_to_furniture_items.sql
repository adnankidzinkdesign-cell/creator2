alter table mirror_furniture_items
  add column if not exists first_name text,
  add column if not exists last_name text;
