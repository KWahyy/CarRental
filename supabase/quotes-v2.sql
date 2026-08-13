-- Prestige Luxor quote management, customer proposal, and reservation conversion.
-- Safe to run more than once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.crm_customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  email text not null default '',
  company text not null default '',
  lead_source text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_customers_email_unique
on public.crm_customers (lower(email)) where email <> '';
create unique index if not exists crm_customers_phone_unique
on public.crm_customers (regexp_replace(phone, '[^0-9]', '', 'g')) where phone <> '';

create sequence if not exists public.quote_number_seq start with 1048;

create or replace function public.next_quote_number()
returns text language sql security definer set search_path = public as $$
  select 'PL-Q-' || lpad(nextval('public.quote_number_seq')::text, 4, '0');
$$;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique default public.next_quote_number(),
  access_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  revision integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'follow_up', 'accepted', 'deposit_pending', 'converted', 'declined', 'expired', 'cancelled')),
  customer_id uuid references public.crm_customers(id) on delete set null,
  lead_id uuid references public.quote_requests(id) on delete set null,
  vehicle_id uuid references public.cars(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  customer_first_name text not null default '',
  customer_last_name text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  customer_company text not null default '',
  lead_source text not null default '',
  vehicle_name text not null default '',
  vehicle_image_url text not null default '',
  ownership_type text not null default 'prestige' check (ownership_type in ('prestige', 'partner')),
  start_at timestamptz,
  end_at timestamptz,
  duration_type text not null default 'days' check (duration_type in ('days', 'hours', 'custom')),
  duration_value numeric(12,2) not null default 1,
  rate_type text not null default 'daily' check (rate_type in ('daily', 'hourly', 'flat', 'custom')),
  rate_amount numeric(12,2) not null default 0,
  rental_taxable boolean not null default false,
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  discount_type text not null default 'fixed' check (discount_type in ('fixed', 'percentage')),
  discount_label text not null default 'Discount',
  discount_value numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_enabled boolean not null default false,
  tax_rate numeric(7,4) not null default 0,
  taxable_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  rental_total numeric(12,2) not null default 0,
  amount_required_type text not null default 'fixed' check (amount_required_type in ('fixed', 'percentage')),
  amount_required_value numeric(12,2) not null default 0,
  amount_required numeric(12,2) not null default 0,
  remaining_balance numeric(12,2) not null default 0,
  security_deposit numeric(12,2) not null default 0,
  deposit_paid_amount numeric(12,2) not null default 0,
  partner_cost numeric(12,2) not null default 0,
  internal_costs jsonb not null default '[]'::jsonb,
  internal_cost_total numeric(12,2) not null default 0,
  expected_profit numeric(12,2) not null default 0,
  expires_at timestamptz,
  follow_up_at timestamptz,
  internal_notes text not null default '',
  customer_message text not null default '',
  lost_reason text not null default '',
  previous_total numeric(12,2),
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  deposit_paid_at timestamptz,
  converted_at timestamptz,
  invoice_id uuid references public.invoices(id) on delete set null,
  reservation_id uuid references public.rental_agreements(id) on delete set null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_payment_url text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  event_type text not null,
  detail text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_revisions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  revision integer not null,
  rental_total numeric(12,2) not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (quote_id, revision)
);

create index if not exists quotes_status_idx on public.quotes(status, created_at desc);
create index if not exists quotes_customer_idx on public.quotes(customer_id, created_at desc);
create index if not exists quotes_vehicle_dates_idx on public.quotes(vehicle_id, start_at, end_at);
create index if not exists quotes_follow_up_idx on public.quotes(follow_up_at) where follow_up_at is not null;
create index if not exists quote_events_quote_idx on public.quote_events(quote_id, created_at asc);

create or replace function public.calculate_quote_totals()
returns trigger language plpgsql as $$
declare
  base_amount numeric(12,2);
  item_amount numeric(12,2);
  taxable_items numeric(12,2);
  taxable_before_discount numeric(12,2);
  net_before_tax numeric(12,2);
  discount_ratio numeric(12,6);
  internal_items numeric(12,2);
begin
  new.duration_value := greatest(coalesce(new.duration_value, 1), 0.01);
  new.rate_amount := greatest(coalesce(new.rate_amount, 0), 0);
  new.discount_value := greatest(coalesce(new.discount_value, 0), 0);
  new.tax_rate := greatest(coalesce(new.tax_rate, 0), 0);
  new.amount_required_value := greatest(coalesce(new.amount_required_value, 0), 0);
  new.security_deposit := greatest(coalesce(new.security_deposit, 0), 0);
  new.deposit_paid_amount := greatest(coalesce(new.deposit_paid_amount, 0), 0);
  new.partner_cost := greatest(coalesce(new.partner_cost, 0), 0);

  base_amount := case when new.rate_type = 'flat' then new.rate_amount else new.rate_amount * new.duration_value end;
  select coalesce(sum(greatest(coalesce(nullif(item->>'quantity', '')::numeric, 0), 0) * greatest(coalesce(nullif(item->>'rate', '')::numeric, 0), 0)), 0),
         coalesce(sum(case when coalesce((item->>'taxable')::boolean, false) then greatest(coalesce(nullif(item->>'quantity', '')::numeric, 0), 0) * greatest(coalesce(nullif(item->>'rate', '')::numeric, 0), 0) else 0 end), 0)
  into item_amount, taxable_items
  from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) item;

  new.subtotal := round(greatest(base_amount + item_amount, 0), 2);
  new.discount_amount := round(case when new.discount_type = 'percentage' then new.subtotal * least(new.discount_value, 100) / 100 else least(new.discount_value, new.subtotal) end, 2);
  net_before_tax := greatest(new.subtotal - new.discount_amount, 0);
  taxable_before_discount := (case when new.rental_taxable then base_amount else 0 end) + taxable_items;
  discount_ratio := case when new.subtotal > 0 then net_before_tax / new.subtotal else 0 end;
  new.taxable_amount := round(greatest(taxable_before_discount * discount_ratio, 0), 2);
  new.tax_amount := round(case when new.tax_enabled then new.taxable_amount * new.tax_rate / 100 else 0 end, 2);
  new.rental_total := round(net_before_tax + new.tax_amount, 2);
  new.amount_required := round(least(case when new.amount_required_type = 'percentage' then new.rental_total * least(new.amount_required_value, 100) / 100 else new.amount_required_value end, new.rental_total), 2);
  new.remaining_balance := round(greatest(new.rental_total - new.deposit_paid_amount, 0), 2);

  select coalesce(sum(greatest(coalesce(nullif(item->>'amount', '')::numeric, 0), 0)), 0)
  into internal_items from jsonb_array_elements(coalesce(new.internal_costs, '[]'::jsonb)) item;
  new.internal_cost_total := round(new.partner_cost + internal_items, 2);
  new.expected_profit := round(new.rental_total - new.internal_cost_total, 2);
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists quotes_calculate_totals on public.quotes;
create trigger quotes_calculate_totals before insert or update on public.quotes
for each row execute function public.calculate_quote_totals();

drop trigger if exists crm_customers_touch_updated_at on public.crm_customers;
create trigger crm_customers_touch_updated_at before update on public.crm_customers
for each row execute function public.set_updated_at();

alter table public.invoices add column if not exists quote_id uuid references public.quotes(id) on delete set null;
create unique index if not exists invoices_quote_unique on public.invoices(quote_id) where quote_id is not null;

alter table public.rental_agreements add column if not exists quote_id uuid references public.quotes(id) on delete set null;
alter table public.rental_agreements add column if not exists vehicle_id uuid references public.cars(id) on delete set null;
alter table public.rental_agreements add column if not exists rental_start_at timestamptz;
alter table public.rental_agreements add column if not exists rental_end_at timestamptz;
alter table public.rental_agreements add column if not exists quote_total numeric(12,2) not null default 0;
alter table public.rental_agreements add column if not exists line_items jsonb not null default '[]'::jsonb;
alter table public.rental_agreements add column if not exists discount_amount numeric(12,2) not null default 0;
alter table public.rental_agreements add column if not exists tax_amount numeric(12,2) not null default 0;
alter table public.rental_agreements add column if not exists amount_required numeric(12,2) not null default 0;
alter table public.rental_agreements add column if not exists partner_cost numeric(12,2) not null default 0;
alter table public.rental_agreements add column if not exists internal_costs jsonb not null default '[]'::jsonb;
alter table public.rental_agreements add column if not exists lead_source text not null default '';
alter table public.rental_agreements add column if not exists assigned_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists rental_agreements_quote_unique on public.rental_agreements(quote_id) where quote_id is not null;

create or replace function public.calculate_agreement_totals()
returns trigger language plpgsql as $$
begin
  new.rental_days := greatest(coalesce(new.rental_days, 1), 1);
  new.daily_rate := greatest(coalesce(new.daily_rate, 0), 0);
  new.quote_total := greatest(coalesce(new.quote_total, 0), 0);
  new.rental_total := case when new.quote_total > 0 then new.quote_total else new.daily_rate * new.rental_days end;
  new.amount_paid := greatest(coalesce(new.amount_paid, 0), 0);
  new.refundable_deposit := greatest(coalesce(new.refundable_deposit, 0), 0);
  new.deposit_deduction := least(greatest(coalesce(new.deposit_deduction, 0), 0), new.refundable_deposit);
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists rental_agreements_calculate on public.rental_agreements;
create trigger rental_agreements_calculate before insert or update on public.rental_agreements
for each row execute function public.calculate_agreement_totals();

alter table public.crm_customers enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_events enable row level security;
alter table public.quote_revisions enable row level security;

drop policy if exists "Employees manage customers" on public.crm_customers;
create policy "Employees manage customers" on public.crm_customers for all to authenticated
using (public.is_invoice_employee()) with check (public.is_invoice_employee());
drop policy if exists "Employees manage quotes" on public.quotes;
create policy "Employees manage quotes" on public.quotes for all to authenticated
using (public.is_invoice_employee()) with check (public.is_invoice_employee());
drop policy if exists "Employees manage quote events" on public.quote_events;
create policy "Employees manage quote events" on public.quote_events for all to authenticated
using (public.is_invoice_employee()) with check (public.is_invoice_employee());
drop policy if exists "Employees manage quote revisions" on public.quote_revisions;
create policy "Employees manage quote revisions" on public.quote_revisions for all to authenticated
using (public.is_invoice_employee()) with check (public.is_invoice_employee());

drop policy if exists "Employees read team profiles" on public.admin_profiles;
create policy "Employees read team profiles" on public.admin_profiles for select to authenticated
using (public.is_invoice_employee());
