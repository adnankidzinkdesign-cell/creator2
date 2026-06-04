alter table mirror_furniture_items
  add column if not exists approval text;

create index if not exists mirror_furniture_items_approval_idx
  on mirror_furniture_items (approval);
