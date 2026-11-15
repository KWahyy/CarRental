-- Read-only business partner access. Does not create or invite any user.
-- Apply after the existing CRM migrations, before assigning the viewer role.
begin;
alter table public.admin_profiles drop constraint if exists admin_profiles_role_check;
alter table public.admin_profiles add constraint admin_profiles_role_check
  check (role in ('owner','manager','staff','viewer'));

create or replace function public.is_dashboard_viewer()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.admin_profiles where user_id=auth.uid() and role='viewer'); $$;
revoke all on function public.is_dashboard_viewer() from public;
grant execute on function public.is_dashboard_viewer() to authenticated;

-- Existing permissive policies include authenticated-user writes. Restrictive
-- policies are necessary: adding a SELECT policy alone would not stop writes.
do $$
declare t text;
begin
  foreach t in array array[
    'admin_profiles','cars','car_partners','car_photos','car_available_dates',
    'fleet_events','monthly_specials','quote_requests','quote_activities','booking_sales',
    'crm_customers','quotes','quote_events','quote_revisions','invoices','invoice_payments',
    'invoice_events','rental_agreements','rental_agreement_events','agreement_templates',
    'vehicle_blocks','vehicle_expenses','vehicle_maintenance','vehicle_documents',
    'vehicle_mileage_history','vehicle_activity'
  ] loop
    if to_regclass('public.' || t) is null then
      -- The retired quote-activities module was never installed in production.
      if t = 'quote_activities' then continue; end if;
      raise exception 'Missing CRM table: %. Apply prerequisite migrations first.', t;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Dashboard viewer read" on public.%I', t);
    execute format('create policy "Dashboard viewer read" on public.%I for select to authenticated using (public.is_dashboard_viewer())',t);
    execute format('drop policy if exists "Viewer cannot insert" on public.%I', t);
    execute format('create policy "Viewer cannot insert" on public.%I as restrictive for insert to authenticated with check (public.is_invoice_employee())',t);
    execute format('drop policy if exists "Viewer cannot update" on public.%I', t);
    execute format('create policy "Viewer cannot update" on public.%I as restrictive for update to authenticated using (public.is_invoice_employee()) with check (public.is_invoice_employee())',t);
    execute format('drop policy if exists "Viewer cannot delete" on public.%I', t);
    execute format('create policy "Viewer cannot delete" on public.%I as restrictive for delete to authenticated using (public.is_invoice_employee())',t);
  end loop;
end $$;

drop policy if exists "Dashboard viewer documents" on storage.objects;
create policy "Dashboard viewer documents" on storage.objects for select to authenticated
using (public.is_dashboard_viewer() and bucket_id in ('fleet','invoice-pdfs','rental-documents'));
drop policy if exists "Viewer cannot upload" on storage.objects;
create policy "Viewer cannot upload" on storage.objects as restrictive for insert to authenticated with check (public.is_invoice_employee());
drop policy if exists "Viewer cannot replace files" on storage.objects;
create policy "Viewer cannot replace files" on storage.objects as restrictive for update to authenticated using (public.is_invoice_employee()) with check (public.is_invoice_employee());
drop policy if exists "Viewer cannot delete files" on storage.objects;
create policy "Viewer cannot delete files" on storage.objects as restrictive for delete to authenticated using (public.is_invoice_employee());
commit;
