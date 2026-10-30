-- Replace the original demonstration catalog with the center's service list.
-- Retire old entries rather than deleting appointment/queue history.
update public.services
set is_bookable = false, is_published = false
where slug in ('animal-bite-treatment', 'animal-bite-center', 'maternal-child-care',
               'mental-health-support', 'screening-services');

insert into public.services(slug,name,description,is_published,is_bookable)
select slug,name,description,true,true from (values
('general-consultation','General Consultation','Consult the center about your general health concerns.'),
('pre-natal','Pre-natal','Care and support during pregnancy.'),
('dental','Dental','Consult the center about dental care.'),
('laboratory','Laboratory','Visit the center for available laboratory services.'),
('family-planning','Family Planning','Plan a visit to discuss family planning services.'),
('immunizations','Immunizations (NIP)','National Immunization Program vaccination services.'),
('tb-dots','TB DOTS','Ask about the center’s TB DOTS services.')
) as defaults(slug,name,description)
on conflict(slug) do update
set name=excluded.name, is_published=true, is_bookable=true;
