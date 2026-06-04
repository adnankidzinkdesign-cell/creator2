alter table mirror_furniture_items
  add column if not exists image_storage_path text,
  add column if not exists image_url text,
  add column if not exists image_storage_paths jsonb not null default '[]'::jsonb,
  add column if not exists image_urls jsonb not null default '[]'::jsonb,
  add column if not exists image_synced_at timestamptz;

create index if not exists mirror_furniture_items_image_storage_path_idx
  on mirror_furniture_items (image_storage_path)
  where image_storage_path is not null;

insert into storage.buckets (id, name, public)
values ('furniture-images', 'furniture-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public can read furniture images"
  on storage.objects;

create policy "public can read furniture images"
  on storage.objects for select
  using (bucket_id = 'furniture-images');
