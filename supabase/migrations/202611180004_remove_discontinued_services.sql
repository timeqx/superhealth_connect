-- Remove discontinued services, including entries hidden by the catalog migration.
-- Keep this atomic: existing foreign keys reject the entire removal if a service
-- has appointment or queue history. Do not cascade-delete patient records.
do $$
declare
  discontinued_ids uuid[];
begin
  select array_agg(id) into discontinued_ids
  from public.services
  where slug in (
    'animal-bite-treatment', 'animal-bite-center',
    'mental-health-support', 'screening-services', 'surgery',
    'maternal-health-support', 'maternal-child-care'
  )
  or lower(trim(name)) in (
    'animal bite treatment', 'animal bite center',
    'mental health support', 'screening services', 'surgery',
    'maternal health support', 'maternal & child care', 'maternal and child care'
  );

  delete from public.queue_sessions where service_id = any(discontinued_ids);
  delete from public.service_slots where service_id = any(discontinued_ids);
  delete from public.services where id = any(discontinued_ids);
end;
$$;
