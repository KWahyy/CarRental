-- Adds popup call tracking to an existing fleet analytics installation.
begin;

alter table public.fleet_events drop constraint if exists fleet_events_event_type_check;
alter table public.fleet_events add constraint fleet_events_event_type_check
check (event_type in ('fleet_page_view', 'card_impression', 'vehicle_detail_view', 'vehicle_detail_click', 'availability_open', 'availability_submit', 'availability_success', 'call_prompt_click'));

alter policy "Public can record fleet analytics" on public.fleet_events
with check (
  event_type in ('fleet_page_view', 'card_impression', 'vehicle_detail_view', 'vehicle_detail_click', 'availability_open', 'availability_submit', 'availability_success', 'call_prompt_click')
  and char_length(car_slug) <= 120
  and char_length(session_id) <= 120
  and char_length(page_path) <= 240
);

create index if not exists fleet_events_call_prompt_idx on public.fleet_events (created_at) include (session_id)
where event_type = 'call_prompt_click';

create or replace function public.popup_call_metrics(since timestamptz)
returns table (tap_count bigint, session_count bigint)
language sql stable security invoker set search_path = ''
as $$
  select count(*), count(distinct nullif(e.session_id, ''))
  from public.fleet_events as e
  where e.event_type = 'call_prompt_click' and e.created_at >= $1;
$$;
revoke all on function public.popup_call_metrics(timestamptz) from public, anon;
grant execute on function public.popup_call_metrics(timestamptz) to authenticated, service_role;

commit;
