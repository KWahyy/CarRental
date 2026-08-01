-- Run once in Supabase SQL Editor to add quote follow-up, pricing, and activity tools.
alter table public.quote_requests add column if not exists follow_up_at timestamptz;
alter table public.quote_requests add column if not exists quote_daily_rate integer not null default 0;
alter table public.quote_requests add column if not exists quote_days integer not null default 1;
alter table public.quote_requests add column if not exists quote_delivery_fee integer not null default 0;
alter table public.quote_requests add column if not exists quote_addons_total integer not null default 0;
alter table public.quote_requests add column if not exists quote_discount integer not null default 0;
alter table public.quote_requests add column if not exists quote_deposit integer not null default 0;
alter table public.quote_requests add column if not exists quote_total integer not null default 0;
alter table public.quote_requests add column if not exists quote_expires_at date;

create table if not exists public.quote_activities (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  activity_type text not null default 'note' check (activity_type in ('note', 'call', 'email', 'status', 'follow_up', 'pricing')),
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quote_activities_request_idx on public.quote_activities (quote_request_id, created_at desc);

alter table public.quote_activities enable row level security;
drop policy if exists "Authenticated admin can manage quote activities" on public.quote_activities;
create policy "Authenticated admin can manage quote activities"
on public.quote_activities for all
to authenticated
using (true)
with check (true);
