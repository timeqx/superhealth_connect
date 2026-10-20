-- Draft catalog only. No people, documents, capacity, or facility policy are seeded.
insert into public.services(slug,name,description) values
('maternal-child-care','Maternal & Child Care','Support for mothers and growing families.'),
('family-planning','Family Planning','Plan a visit to discuss family planning services.'),
('animal-bite-treatment','Animal Bite Treatment','Ask the center about available animal bite treatment services.'),
('mental-health-support','Mental Health Support','Connect with available mental health support.'),
('immunizations','Immunizations','Plan your visit for available vaccinations.'),
('tb-dots','TB DOTS','Ask about the center’s TB DOTS services.'),
('screening-services','Screening Services','Learn about available health screening services.')
on conflict(slug) do nothing;
