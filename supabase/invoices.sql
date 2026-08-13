-- Prestige Luxor invoice workspace
-- Run once in the Supabase SQL Editor. This migration is safe to run again.

create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The oldest existing account becomes the initial owner; later accounts start as staff.
insert into public.admin_profiles (user_id, display_name, role)
select id, coalesce(raw_user_meta_data->>'full_name', email, ''),
       case when row_number() over (order by created_at, id) = 1 then 'owner' else 'staff' end
from auth.users
on conflict (user_id) do nothing;

create sequence if not exists public.invoice_number_seq start with 1048;

create or replace function public.next_invoice_number()
returns text
language sql
security definer
set search_path = public
as $$
  select 'PL-' || extract(year from now())::int || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
$$;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default public.next_invoice_number(),
  source_type text not null default 'manual' check (source_type in ('manual', 'quote', 'booking')),
  source_id text,
  parent_invoice_id uuid references public.invoices(id) on delete set null,
  revision integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'finalized', 'sent', 'due', 'partially_paid', 'paid', 'overdue', 'refunded', 'void')),
  issue_date date not null default current_date,
  due_date date,
  valid_through date,
  customer_name text not null default '',
  customer_email text not null default '',
  customer_phone text not null default '',
  customer_address text not null default '',
  vehicle_name text not null default '',
  rental_start date,
  rental_end date,
  daily_rate numeric(12,2) not null default 0,
  rental_days integer not null default 1 check (rental_days > 0),
  delivery_fee numeric(12,2) not null default 0,
  addons_total numeric(12,2) not null default 0,
  insurance_fee numeric(12,2) not null default 0,
  mileage_fee numeric(12,2) not null default 0,
  fuel_fee numeric(12,2) not null default 0,
  tolls_fee numeric(12,2) not null default 0,
  damage_fee numeric(12,2) not null default 0,
  other_fee numeric(12,2) not null default 0,
  other_label text not null default 'Other charge',
  discount numeric(12,2) not null default 0,
  refundable_deposit numeric(12,2) not null default 0,
  deposit_method text not null default 'charge' check (deposit_method in ('charge', 'authorization_hold')),
  deposit_hold_status text not null default 'not_applicable' check (deposit_hold_status in ('not_applicable', 'pending', 'authorized', 'released', 'captured', 'cancelled')),
  deposit_released_at timestamptz,
  deposit_released_by uuid references auth.users(id) on delete set null,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  payment_method text not null default 'stripe' check (payment_method in ('stripe', 'cash', 'wire', 'zelle', 'other')),
  payment_reference text not null default '',
  balance_due numeric(12,2) not null default 0,
  mileage_allowance text not null default '100 miles/day',
  overage_rate text not null default '',
  notes text not null default '',
  terms text not null default 'Full payment is due by the due date to confirm the reservation. The refundable security deposit is subject to inspection and deductions for excess mileage, fuel, tolls, late return, damage, or other charges permitted by the signed rental agreement. A valid driver license, proof of insurance, and driver approval are required. Changes and cancellations are governed by the signed rental agreement. This invoice does not replace the rental agreement.',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_payment_url text,
  pdf_path text,
  sent_at timestamptz,
  paid_at timestamptz,
  locked_at timestamptz,
  finalized_at timestamptz,
  finalized_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check check (status in ('draft', 'finalized', 'sent', 'due', 'partially_paid', 'paid', 'overdue', 'refunded', 'void'));
alter table public.invoices add column if not exists insurance_fee numeric(12,2) not null default 0;
alter table public.invoices add column if not exists mileage_fee numeric(12,2) not null default 0;
alter table public.invoices add column if not exists fuel_fee numeric(12,2) not null default 0;
alter table public.invoices add column if not exists tolls_fee numeric(12,2) not null default 0;
alter table public.invoices add column if not exists damage_fee numeric(12,2) not null default 0;
alter table public.invoices add column if not exists other_fee numeric(12,2) not null default 0;
alter table public.invoices add column if not exists other_label text not null default 'Other charge';
alter table public.invoices add column if not exists deposit_method text not null default 'charge';
alter table public.invoices add column if not exists deposit_hold_status text not null default 'not_applicable';
alter table public.invoices add column if not exists deposit_released_at timestamptz;
alter table public.invoices add column if not exists deposit_released_by uuid references auth.users(id) on delete set null;
alter table public.invoices add column if not exists payment_method text not null default 'stripe';
alter table public.invoices add column if not exists payment_reference text not null default '';
alter table public.invoices add column if not exists finalized_at timestamptz;
alter table public.invoices add column if not exists finalized_by uuid references auth.users(id) on delete set null;

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  method text not null default 'manual',
  reference text not null default '',
  paid_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  event_type text not null,
  detail text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists invoices_customer_idx on public.invoices(customer_name, customer_email);
create index if not exists invoices_created_at_idx on public.invoices(created_at desc);
create index if not exists invoice_payments_invoice_idx on public.invoice_payments(invoice_id, paid_at desc);
create index if not exists invoice_events_invoice_idx on public.invoice_events(invoice_id, created_at desc);

create or replace function public.calculate_invoice_totals()
returns trigger
language plpgsql
as $$
begin
  new.daily_rate := greatest(coalesce(new.daily_rate, 0), 0);
  new.rental_days := greatest(coalesce(new.rental_days, 1), 1);
  new.delivery_fee := greatest(coalesce(new.delivery_fee, 0), 0);
  new.addons_total := greatest(coalesce(new.addons_total, 0), 0);
  new.insurance_fee := greatest(coalesce(new.insurance_fee, 0), 0);
  new.mileage_fee := greatest(coalesce(new.mileage_fee, 0), 0);
  new.fuel_fee := greatest(coalesce(new.fuel_fee, 0), 0);
  new.tolls_fee := greatest(coalesce(new.tolls_fee, 0), 0);
  new.damage_fee := greatest(coalesce(new.damage_fee, 0), 0);
  new.other_fee := greatest(coalesce(new.other_fee, 0), 0);
  new.discount := greatest(coalesce(new.discount, 0), 0);
  new.refundable_deposit := greatest(coalesce(new.refundable_deposit, 0), 0);
  new.amount_paid := greatest(coalesce(new.amount_paid, 0), 0);
  new.subtotal := greatest((new.daily_rate * new.rental_days) + new.delivery_fee + new.addons_total + new.insurance_fee + new.mileage_fee + new.fuel_fee + new.tolls_fee + new.damage_fee + new.other_fee - new.discount, 0);
  new.total := new.subtotal + case when new.deposit_method = 'charge' then new.refundable_deposit else 0 end;
  new.balance_due := greatest(new.total - new.amount_paid, 0);
  new.updated_at := now();
  if new.status = 'paid' and new.balance_due > 0 then
    new.status := case when new.amount_paid > 0 then 'partially_paid' else 'due' end;
  elsif new.status not in ('draft', 'void', 'refunded') and new.balance_due = 0 and new.total > 0 then
    new.status := 'paid';
    new.paid_at := coalesce(new.paid_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_calculate_totals on public.invoices;
create trigger invoices_calculate_totals
before insert or update on public.invoices
for each row execute function public.calculate_invoice_totals();

alter table public.invoices enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.invoice_events enable row level security;
alter table public.admin_profiles enable row level security;

drop policy if exists "Authenticated users manage invoices" on public.invoices;
drop policy if exists "Authenticated users manage invoice payments" on public.invoice_payments;
drop policy if exists "Authenticated users manage invoice events" on public.invoice_events;

create or replace function public.is_invoice_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and role in ('owner', 'manager', 'staff')
  );
$$;

revoke all on function public.is_invoice_employee() from public;
grant execute on function public.is_invoice_employee() to authenticated;

create policy "Authenticated users manage invoices" on public.invoices
for all to authenticated
using (public.is_invoice_employee())
with check (public.is_invoice_employee());

create policy "Authenticated users manage invoice payments" on public.invoice_payments
for all to authenticated
using (public.is_invoice_employee())
with check (public.is_invoice_employee());

create policy "Authenticated users manage invoice events" on public.invoice_events
for all to authenticated
using (public.is_invoice_employee())
with check (public.is_invoice_employee());

drop policy if exists "Employees read own profile" on public.admin_profiles;
create policy "Employees read own profile" on public.admin_profiles
for select to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('invoice-pdfs', 'invoice-pdfs', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated users read invoice PDFs" on storage.objects;
create policy "Authenticated users read invoice PDFs" on storage.objects
for select to authenticated using (bucket_id = 'invoice-pdfs');

drop policy if exists "Authenticated users upload invoice PDFs" on storage.objects;
create policy "Authenticated users upload invoice PDFs" on storage.objects
for insert to authenticated with check (bucket_id = 'invoice-pdfs');

drop policy if exists "Authenticated users update invoice PDFs" on storage.objects;
create policy "Authenticated users update invoice PDFs" on storage.objects
for update to authenticated using (bucket_id = 'invoice-pdfs') with check (bucket_id = 'invoice-pdfs');

drop policy if exists "Authenticated users delete invoice PDFs" on storage.objects;
create policy "Authenticated users delete invoice PDFs" on storage.objects
for delete to authenticated using (bucket_id = 'invoice-pdfs');
