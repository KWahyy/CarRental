-- Prestige Luxor fleet operations, availability, maintenance, documents, and profitability.
-- Extends the existing cars / car_partners / car_photos records. Safe to run more than once.

create extension if not exists pgcrypto;

alter table public.cars add column if not exists year integer;
alter table public.cars add column if not exists trim text not null default '';
alter table public.cars add column if not exists interior_color text not null default '';
alter table public.cars add column if not exists vin text not null default '';
alter table public.cars add column if not exists license_plate text not null default '';
alter table public.cars add column if not exists registration_state text not null default 'CA';
alter table public.cars add column if not exists internal_fleet_id text not null default '';
alter table public.cars add column if not exists internal_nickname text not null default '';
alter table public.cars add column if not exists ownership_type text not null default 'prestige';
alter table public.cars drop constraint if exists cars_ownership_type_check;
alter table public.cars add constraint cars_ownership_type_check check (ownership_type in ('prestige', 'partner'));
alter table public.cars add column if not exists operational_status text not null default 'available';
alter table public.cars drop constraint if exists cars_operational_status_check;
alter table public.cars add constraint cars_operational_status_check check (operational_status in ('available', 'maintenance', 'on_hold', 'partner_unavailable', 'inactive'));
alter table public.cars add column if not exists weekend_rate numeric(12,2);
alter table public.cars add column if not exists weekly_rate numeric(12,2);
alter table public.cars add column if not exists hourly_rate numeric(12,2);
alter table public.cars add column if not exists included_mileage integer;
alter table public.cars add column if not exists extra_mileage_rate numeric(12,2) not null default 0;
alter table public.cars add column if not exists security_deposit numeric(12,2) not null default 0;
alter table public.cars add column if not exists minimum_rental_days integer not null default 1;
alter table public.cars add column if not exists delivery_base_fee numeric(12,2) not null default 0;
alter table public.cars add column if not exists event_rate numeric(12,2);
alter table public.cars add column if not exists current_mileage integer;
alter table public.cars add column if not exists mileage_updated_at timestamptz;
alter table public.cars add column if not exists mileage_source text not null default 'manual';
alter table public.cars add column if not exists current_location text not null default 'Prestige Luxor facility';
alter table public.cars add column if not exists location_notes text not null default '';
alter table public.cars add column if not exists location_updated_at timestamptz;
alter table public.cars add column if not exists registration_expiration date;
alter table public.cars add column if not exists insurance_provider text not null default '';
alter table public.cars add column if not exists insurance_policy_number text not null default '';
alter table public.cars add column if not exists insurance_expiration date;

create unique index if not exists cars_vin_unique on public.cars (upper(vin)) where vin <> '';
create unique index if not exists cars_plate_unique on public.cars (upper(license_plate)) where license_plate <> '';
create unique index if not exists cars_internal_fleet_id_unique on public.cars (upper(internal_fleet_id)) where internal_fleet_id <> '';
create index if not exists cars_operations_idx on public.cars (is_active, ownership_type, operational_status);

alter table public.car_partners add column if not exists partner_identifier text not null default '';
alter table public.car_partners add column if not exists partner_notes text not null default '';
alter table public.car_partners add column if not exists partner_daily_cost numeric(12,2) not null default 0;
alter table public.car_partners add column if not exists weekend_cost numeric(12,2);
alter table public.car_partners add column if not exists weekly_cost numeric(12,2);
alter table public.car_partners add column if not exists minimum_partner_charge numeric(12,2) not null default 0;
alter table public.car_partners add column if not exists delivery_cost numeric(12,2) not null default 0;
alter table public.car_partners add column if not exists other_partner_fees numeric(12,2) not null default 0;

create table if not exists public.vehicle_blocks (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  block_type text not null default 'manual_hold' check (block_type in ('manual_hold', 'maintenance', 'partner_unavailable', 'owner_use', 'photoshoot', 'other')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text not null default '',
  notes text not null default '',
  maintenance_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table if not exists public.vehicle_expenses (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete restrict,
  agreement_id uuid references public.rental_agreements(id) on delete set null,
  expense_scope text not null default 'general' check (expense_scope in ('general', 'reservation')),
  category text not null default 'other' check (category in ('maintenance', 'repair', 'tires', 'detail', 'fuel', 'registration', 'insurance', 'transportation', 'parking', 'tolls', 'other')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  expense_date date not null default current_date,
  vendor text not null default '',
  notes text not null default '',
  receipt_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_maintenance (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete restrict,
  service_type text not null default 'other',
  service_date date not null default current_date,
  mileage integer,
  vendor text not null default '',
  cost numeric(12,2) not null default 0 check (cost >= 0),
  notes text not null default '',
  receipt_path text,
  next_service_date date,
  next_service_mileage integer,
  unavailable_start timestamptz,
  unavailable_end timestamptz,
  status text not null default 'completed' check (status in ('scheduled', 'in_service', 'completed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicle_blocks drop constraint if exists vehicle_blocks_maintenance_id_fkey;
alter table public.vehicle_blocks add constraint vehicle_blocks_maintenance_id_fkey foreign key (maintenance_id) references public.vehicle_maintenance(id) on delete cascade;

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete restrict,
  document_type text not null default 'other' check (document_type in ('registration', 'insurance', 'lease_loan', 'partner_agreement', 'inspection', 'other')),
  file_path text,
  file_name text not null default '',
  effective_date date,
  expiration_date date,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_mileage_history (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete restrict,
  agreement_id uuid references public.rental_agreements(id) on delete set null,
  mileage integer not null check (mileage >= 0),
  source text not null default 'manual',
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.vehicle_activity (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  action text not null,
  detail text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_blocks_overlap_idx on public.vehicle_blocks (car_id, start_at, end_at);
create index if not exists vehicle_expenses_car_date_idx on public.vehicle_expenses (car_id, expense_date desc);
create index if not exists vehicle_maintenance_car_date_idx on public.vehicle_maintenance (car_id, service_date desc);
create index if not exists vehicle_documents_car_expiry_idx on public.vehicle_documents (car_id, expiration_date);
create index if not exists vehicle_mileage_car_idx on public.vehicle_mileage_history (car_id, recorded_at desc);
create index if not exists vehicle_activity_car_idx on public.vehicle_activity (car_id, created_at desc);

drop trigger if exists vehicle_maintenance_touch_updated_at on public.vehicle_maintenance;
create trigger vehicle_maintenance_touch_updated_at before update on public.vehicle_maintenance for each row execute function public.touch_updated_at();
drop trigger if exists vehicle_documents_touch_updated_at on public.vehicle_documents;
create trigger vehicle_documents_touch_updated_at before update on public.vehicle_documents for each row execute function public.touch_updated_at();

alter table public.vehicle_blocks enable row level security;
alter table public.vehicle_expenses enable row level security;
alter table public.vehicle_maintenance enable row level security;
alter table public.vehicle_documents enable row level security;
alter table public.vehicle_mileage_history enable row level security;
alter table public.vehicle_activity enable row level security;

drop policy if exists "Employees manage vehicle blocks" on public.vehicle_blocks;
create policy "Employees manage vehicle blocks" on public.vehicle_blocks for all to authenticated using (public.is_invoice_employee()) with check (public.is_invoice_employee());
drop policy if exists "Employees manage vehicle expenses" on public.vehicle_expenses;
create policy "Employees manage vehicle expenses" on public.vehicle_expenses for all to authenticated using (public.is_invoice_employee()) with check (public.is_invoice_employee());
drop policy if exists "Employees manage vehicle maintenance" on public.vehicle_maintenance;
create policy "Employees manage vehicle maintenance" on public.vehicle_maintenance for all to authenticated using (public.is_invoice_employee()) with check (public.is_invoice_employee());
drop policy if exists "Employees manage vehicle documents" on public.vehicle_documents;
create policy "Employees manage vehicle documents" on public.vehicle_documents for all to authenticated using (public.is_invoice_employee()) with check (public.is_invoice_employee());
drop policy if exists "Employees manage vehicle mileage" on public.vehicle_mileage_history;
create policy "Employees manage vehicle mileage" on public.vehicle_mileage_history for all to authenticated using (public.is_invoice_employee()) with check (public.is_invoice_employee());
drop policy if exists "Employees manage vehicle activity" on public.vehicle_activity;
create policy "Employees manage vehicle activity" on public.vehicle_activity for all to authenticated using (public.is_invoice_employee()) with check (public.is_invoice_employee());

-- Reuse the existing private rental-documents bucket for vehicle documents and receipts.
insert into storage.buckets (id, name, public) values ('rental-documents', 'rental-documents', false)
on conflict (id) do update set public = false;
