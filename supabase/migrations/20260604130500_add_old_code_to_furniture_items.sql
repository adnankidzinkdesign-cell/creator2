alter table mirror_furniture_items
  add column if not exists old_code text;

create index if not exists mirror_furniture_items_old_code_idx
  on mirror_furniture_items (old_code);
