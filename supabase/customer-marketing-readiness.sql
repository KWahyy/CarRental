-- Customer email marketing fields. Run once in the Supabase SQL Editor.
-- Existing customers default to 'unknown'; rental activity never implies marketing consent.
alter table public.crm_customers
  add column if not exists marketing_consent_status text not null default 'unknown',
  add column if not exists marketing_consent_source text not null default '',
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_unsubscribed_at timestamptz,
  add column if not exists marketing_tags text[] not null default '{}';

alter table public.crm_customers
  drop constraint if exists crm_customers_marketing_consent_status_check;
alter table public.crm_customers
  add constraint crm_customers_marketing_consent_status_check
  check (marketing_consent_status in ('unknown', 'subscribed', 'unsubscribed'));

create index if not exists crm_customers_marketing_subscribers_idx
  on public.crm_customers (lower(email))
  where marketing_consent_status = 'subscribed' and email <> '';

comment on column public.crm_customers.marketing_consent_status is
  'Explicit email marketing permission. Unknown is never eligible for campaigns.';
comment on column public.crm_customers.marketing_consent_source is
  'Staff-recorded evidence of how permission was granted or withdrawn.';
