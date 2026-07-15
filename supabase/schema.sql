create extension if not exists pgcrypto;

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  make text not null,
  model text not null,
  category text not null,
  category_label text not null,
  price integer not null default 0,
  mileage text not null default '100 miles/day',
  seats integer not null default 2,
  color text not null default '',
  summary text not null default '',
  image_url text,
  tags jsonb not null default '[]'::jsonb,
  details jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  is_featured boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cars add column if not exists competitor_price integer;
alter table public.cars add column if not exists competitor_name text not null default '';
alter table public.cars add column if not exists competitor_url text not null default '';
alter table public.cars add column if not exists competitor_checked_at date;

create table if not exists public.car_partners (
  car_id uuid primary key references public.cars(id) on delete cascade,
  partner_name text not null default '',
  partner_phone text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('fleet_page_view', 'card_impression', 'vehicle_detail_view', 'vehicle_detail_click', 'availability_open', 'availability_submit', 'availability_success')),
  car_slug text not null default '',
  session_id text not null default '',
  page_path text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fleet_events_created_at_idx on public.fleet_events (created_at desc);
create index if not exists fleet_events_car_slug_idx on public.fleet_events (car_slug, created_at desc);

create table if not exists public.car_photos (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  position integer not null,
  url text not null,
  created_at timestamptz not null default now(),
  unique (car_id, position)
);

create table if not exists public.car_available_dates (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (car_id, date)
);

create table if not exists public.monthly_specials (
  month text primary key check (month ~ '^\\d{4}-\\d{2}$'),
  headline text not null default '',
  description text not null default '',
  car_slugs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  vehicle text not null default 'Vehicle TBD',
  rental_date date,
  addons jsonb not null default '[]'::jsonb,
  message text not null default '',
  source text not null default 'website',
  page_url text,
  user_agent text,
  notification_status text not null default 'pending',
  notification_error text,
  status text not null default 'new' check (status in ('new', 'checking', 'available', 'alternative', 'approved', 'booked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quote_requests add column if not exists status text not null default 'new';
alter table public.quote_requests add column if not exists updated_at timestamptz not null default now();

create table if not exists public.booking_sales (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid references public.quote_requests(id) on delete set null,
  customer_name text not null,
  customer_phone text not null default '',
  vehicle text not null,
  booked_on date not null default current_date,
  start_date date,
  end_date date,
  rental_days integer not null default 1 check (rental_days > 0),
  daily_rate integer not null default 0 check (daily_rate >= 0),
  delivery_fee integer not null default 0 check (delivery_fee >= 0),
  addons_total integer not null default 0 check (addons_total >= 0),
  discount integer not null default 0 check (discount >= 0),
  partner_cost integer not null default 0 check (partner_cost >= 0),
  total_amount integer not null default 0 check (total_amount >= 0),
  amount_paid integer not null default 0 check (amount_paid >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'partial', 'paid', 'refunded')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_request_id)
);

create index if not exists booking_sales_booked_on_idx on public.booking_sales (booked_on desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_cars_updated_at on public.cars;
create trigger set_cars_updated_at
before update on public.cars
for each row
execute function public.set_updated_at();

drop trigger if exists set_quote_requests_updated_at on public.quote_requests;
create trigger set_quote_requests_updated_at
before update on public.quote_requests
for each row
execute function public.set_updated_at();

drop trigger if exists set_booking_sales_updated_at on public.booking_sales;
create trigger set_booking_sales_updated_at
before update on public.booking_sales
for each row
execute function public.set_updated_at();

alter table public.cars enable row level security;
alter table public.car_photos enable row level security;
alter table public.car_available_dates enable row level security;
alter table public.monthly_specials enable row level security;
alter table public.fleet_events enable row level security;
alter table public.car_partners enable row level security;
alter table public.quote_requests enable row level security;
alter table public.booking_sales enable row level security;

drop policy if exists "Authenticated admin can manage quote requests" on public.quote_requests;
create policy "Authenticated admin can manage quote requests"
on public.quote_requests for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated admin can manage booking sales" on public.booking_sales;
create policy "Authenticated admin can manage booking sales"
on public.booking_sales for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated admin can manage car partners" on public.car_partners;
create policy "Authenticated admin can manage car partners"
on public.car_partners for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read active cars" on public.cars;
create policy "Public can read active cars"
on public.cars for select
using (is_active = true);

drop policy if exists "Authenticated admin can manage cars" on public.cars;
create policy "Authenticated admin can manage cars"
on public.cars for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read car photos" on public.car_photos;
create policy "Public can read car photos"
on public.car_photos for select
using (true);

drop policy if exists "Authenticated admin can manage car photos" on public.car_photos;
create policy "Authenticated admin can manage car photos"
on public.car_photos for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read available dates" on public.car_available_dates;
create policy "Public can read available dates"
on public.car_available_dates for select
using (true);

drop policy if exists "Authenticated admin can manage available dates" on public.car_available_dates;
create policy "Authenticated admin can manage available dates"
on public.car_available_dates for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read monthly specials" on public.monthly_specials;
create policy "Public can read monthly specials"
on public.monthly_specials for select
using (true);

drop policy if exists "Authenticated admin can manage monthly specials" on public.monthly_specials;
create policy "Authenticated admin can manage monthly specials"
on public.monthly_specials for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can record fleet analytics" on public.fleet_events;
create policy "Public can record fleet analytics"
on public.fleet_events for insert
to anon, authenticated
with check (
  event_type in ('fleet_page_view', 'card_impression', 'vehicle_detail_view', 'vehicle_detail_click', 'availability_open', 'availability_submit', 'availability_success')
  and char_length(car_slug) <= 120
  and char_length(session_id) <= 120
  and char_length(page_path) <= 240
);

drop policy if exists "Authenticated admin can read fleet analytics" on public.fleet_events;
create policy "Authenticated admin can read fleet analytics"
on public.fleet_events for select
to authenticated
using (true);

drop policy if exists "Authenticated admin can delete fleet analytics" on public.fleet_events;
create policy "Authenticated admin can delete fleet analytics"
on public.fleet_events for delete
to authenticated
using (true);

insert into storage.buckets (id, name, public)
values ('fleet', 'fleet', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read fleet images" on storage.objects;
create policy "Public can read fleet images"
on storage.objects for select
using (bucket_id = 'fleet');

drop policy if exists "Authenticated admin can upload fleet images" on storage.objects;
create policy "Authenticated admin can upload fleet images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'fleet');

drop policy if exists "Authenticated admin can update fleet images" on storage.objects;
create policy "Authenticated admin can update fleet images"
on storage.objects for update
to authenticated
using (bucket_id = 'fleet')
with check (bucket_id = 'fleet');

drop policy if exists "Authenticated admin can delete fleet images" on storage.objects;
create policy "Authenticated admin can delete fleet images"
on storage.objects for delete
to authenticated
using (bucket_id = 'fleet');
