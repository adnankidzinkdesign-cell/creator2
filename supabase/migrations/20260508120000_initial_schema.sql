-- Cached Zoho access token (single row, id always = 1)
create table zoho_token_cache (
  id int primary key,
  access_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);

-- Sync run history
create table sync_log (
  id uuid primary key default gen_random_uuid(),
  report_name text not null,
  status text not null check (status in ('running', 'success', 'error')),
  records_synced int default 0,
  error text,
  started_at timestamptz default now(),
  finished_at timestamptz
);

create index sync_log_started_at_idx on sync_log (started_at desc);
create index sync_log_report_idx on sync_log (report_name, started_at desc);

-- Enable RLS on both — only service_role can access
alter table zoho_token_cache enable row level security;
alter table sync_log enable row level security;
