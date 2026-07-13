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

alter table public.cars enable row level security;
alter table public.car_photos enable row level security;
alter table public.car_available_dates enable row level security;
alter table public.monthly_specials enable row level security;

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
