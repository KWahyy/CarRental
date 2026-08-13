-- Prestige Luxor rental agreements and vehicle handoff records.
-- Safe to run more than once in the Supabase SQL Editor.

create extension if not exists pgcrypto;
create sequence if not exists public.agreement_number_seq start with 1001;

create or replace function public.next_agreement_number()
returns text language sql security definer set search_path = public as $$
  select 'RA-' || extract(year from now())::int || '-' || lpad(nextval('public.agreement_number_seq')::text, 4, '0');
$$;

create table if not exists public.rental_agreements (
  id uuid primary key default gen_random_uuid(),
  agreement_number text not null unique default public.next_agreement_number(),
  source_type text not null default 'manual' check (source_type in ('manual', 'quote', 'invoice')),
  source_id text,
  status text not null default 'draft' check (status in ('draft', 'signed', 'vehicle_out', 'returned', 'completed', 'cancelled')),
  customer_name text not null default '', customer_email text not null default '', customer_phone text not null default '', customer_address text not null default '',
  driver_name text not null default '', license_number text not null default '', license_state text not null default '', license_expiration date,
  insurance_provider text not null default '', policy_number text not null default '', insurance_expiration date,
  license_file_path text, insurance_file_path text,
  vehicle_name text not null default '', vehicle_vin text not null default '', vehicle_plate text not null default '',
  rental_start date, rental_end date, rental_days integer not null default 1 check (rental_days > 0),
  daily_rate numeric(12,2) not null default 0, rental_total numeric(12,2) not null default 0,
  mileage_allowance text not null default '100 miles/day', overage_rate numeric(12,2) not null default 0,
  refundable_deposit numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid', 'refunded')),
  amount_paid numeric(12,2) not null default 0, payment_method text not null default 'stripe', payment_reference text not null default '',
  deposit_status text not null default 'pending' check (deposit_status in ('not_required', 'pending', 'held', 'charged', 'released', 'partially_deducted', 'deducted')),
  deposit_deduction numeric(12,2) not null default 0, deposit_resolution_note text not null default '', deposit_resolved_at timestamptz,
  pickup_mileage integer, pickup_fuel text not null default '', pickup_notes text not null default '', pickup_photo_paths jsonb not null default '[]'::jsonb, picked_up_at timestamptz,
  return_mileage integer, return_fuel text not null default '', return_notes text not null default '', return_photo_paths jsonb not null default '[]'::jsonb, returned_at timestamptz,
  mileage_charge numeric(12,2) not null default 0, fuel_charge numeric(12,2) not null default 0, tolls_charge numeric(12,2) not null default 0,
  damage_charge numeric(12,2) not null default 0, other_charge numeric(12,2) not null default 0, other_charge_label text not null default 'Other',
  signature_name text not null default '', signature_data text, signed_at timestamptz,
  terms text not null default '', internal_notes text not null default '',
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.rental_agreements drop constraint if exists rental_agreements_source_type_check;
alter table public.rental_agreements add constraint rental_agreements_source_type_check check (source_type in ('manual', 'quote', 'invoice'));

create table if not exists public.rental_agreement_events (
  id uuid primary key default gen_random_uuid(), agreement_id uuid not null references public.rental_agreements(id) on delete cascade,
  event_type text not null, detail text not null default '', created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);

create or replace function public.calculate_agreement_totals()
returns trigger language plpgsql as $$
begin
  new.rental_days := greatest(coalesce(new.rental_days, 1), 1);
  new.daily_rate := greatest(coalesce(new.daily_rate, 0), 0);
  new.rental_total := new.daily_rate * new.rental_days;
  new.amount_paid := greatest(coalesce(new.amount_paid, 0), 0);
  new.refundable_deposit := greatest(coalesce(new.refundable_deposit, 0), 0);
  new.deposit_deduction := least(greatest(coalesce(new.deposit_deduction, 0), 0), new.refundable_deposit);
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists rental_agreements_calculate on public.rental_agreements;
create trigger rental_agreements_calculate before insert or update on public.rental_agreements
for each row execute function public.calculate_agreement_totals();

create index if not exists rental_agreements_status_idx on public.rental_agreements(status);
create index if not exists rental_agreements_created_idx on public.rental_agreements(created_at desc);
create index if not exists rental_agreement_events_idx on public.rental_agreement_events(agreement_id, created_at desc);

alter table public.rental_agreements enable row level security;
alter table public.rental_agreement_events enable row level security;

drop policy if exists "Employees manage rental agreements" on public.rental_agreements;
create policy "Employees manage rental agreements" on public.rental_agreements for all to authenticated
using (public.is_invoice_employee()) with check (public.is_invoice_employee());
drop policy if exists "Employees manage rental agreement events" on public.rental_agreement_events;
create policy "Employees manage rental agreement events" on public.rental_agreement_events for all to authenticated
using (public.is_invoice_employee()) with check (public.is_invoice_employee());

insert into storage.buckets (id, name, public) values ('rental-documents', 'rental-documents', false)
on conflict (id) do update set public = false;
drop policy if exists "Employees read rental documents" on storage.objects;
create policy "Employees read rental documents" on storage.objects for select to authenticated
using (bucket_id = 'rental-documents' and public.is_invoice_employee());
drop policy if exists "Employees upload rental documents" on storage.objects;
create policy "Employees upload rental documents" on storage.objects for insert to authenticated
with check (bucket_id = 'rental-documents' and public.is_invoice_employee());
drop policy if exists "Employees update rental documents" on storage.objects;
create policy "Employees update rental documents" on storage.objects for update to authenticated
using (bucket_id = 'rental-documents' and public.is_invoice_employee()) with check (bucket_id = 'rental-documents' and public.is_invoice_employee());
