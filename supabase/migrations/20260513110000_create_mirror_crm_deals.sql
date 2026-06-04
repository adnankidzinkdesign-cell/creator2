create table mirror_crm_deals (
  id text primary key,                    -- Zoho CRM deal ID
  deal_name text,
  stage text,
  amount numeric(14,2),
  closing_date date,
  account_name text,
  account_id text,
  contact_name text,
  contact_id text,
  owner_name text,
  owner_id text,
  owner_email text,
  type text,
  lead_source text,
  probability numeric(5,2),
  expected_revenue numeric(14,2),
  campaign_source_name text,
  campaign_source_id text,
  next_step text,
  description text,
  created_time timestamptz,
  modified_time timestamptz,
  raw jsonb not null,
  synced_at timestamptz not null default now()
);

create index mirror_crm_deals_stage_idx on mirror_crm_deals (stage);
create index mirror_crm_deals_account_id_idx on mirror_crm_deals (account_id);
create index mirror_crm_deals_owner_id_idx on mirror_crm_deals (owner_id);
create index mirror_crm_deals_closing_date_idx on mirror_crm_deals (closing_date desc);
create index mirror_crm_deals_modified_time_idx on mirror_crm_deals (modified_time desc);

alter table mirror_crm_deals enable row level security;

-- Policy: authenticated users can read; service_role bypasses RLS automatically
create policy "authenticated users can read CRM deals"
  on mirror_crm_deals for select
  to authenticated
  using (true);
