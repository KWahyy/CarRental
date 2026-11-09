-- Pending migration: apply only with the approved release, not during preview.
begin;
alter table public.cars alter column ownership_type set default 'partner';
alter table public.vehicle_expenses drop constraint if exists vehicle_expenses_category_check;
alter table public.vehicle_expenses add constraint vehicle_expenses_category_check
check (category in ('maintenance','repair','tires','detail','fuel','registration','insurance','car_payment','transportation','parking','tolls','other'));
commit;
