create table mirror_furniture_items (
  id text primary key,                    -- Zoho's record ID
  sku_id text,
  furniture_item_name text,
  description text,
  furniture_type text,                    -- "Standard" | "Custom"
  category text,                          -- denormalized display value
  category_id text,                       -- Zoho lookup ID for joins later
  subcategory text,
  subcategory_id text,
  length_mm int,
  height_mm int,
  depth_mm int,
  retail_price_aed numeric(12,2),
  retail_price_usd numeric(12,2),
  retail_price_sar numeric(12,2),
  finishes_summary text,
  number_of_shelves int,
  number_of_compartments int,
  age_range text,
  designer_name text,
  customisation_details_html text,        -- preserve raw HTML
  customisation_details_text text,        -- stripped for table display
  suitable_spaces text[],                 -- multi-lookup display values
  finishes text[],                        -- multi-lookup display values
  role_play_purpose text,
  created_time timestamptz,
  modified_time timestamptz,
  raw jsonb not null,                     -- full Zoho payload for completeness
  synced_at timestamptz not null default now()
);

create index mirror_furniture_items_sku_idx on mirror_furniture_items (sku_id);
create index mirror_furniture_items_category_idx on mirror_furniture_items (category);
create index mirror_furniture_items_furniture_type_idx on mirror_furniture_items (furniture_type);
create index mirror_furniture_items_modified_time_idx on mirror_furniture_items (modified_time desc);

alter table mirror_furniture_items enable row level security;

-- Policy: authenticated users can read; service_role bypasses RLS automatically
create policy "authenticated users can read furniture items"
  on mirror_furniture_items for select
  to authenticated
  using (true);
