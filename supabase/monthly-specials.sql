-- Run this once in Supabase Dashboard > SQL Editor.
-- It adds admin-managed monthly homepage specials without changing fleet data.

create table if not exists public.monthly_specials (
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  headline text not null default '',
  description text not null default '',
  car_slugs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.monthly_specials enable row level security;

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
