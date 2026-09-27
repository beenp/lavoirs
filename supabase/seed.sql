-- Create four synthetic Auth users for local fixtures.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'ava@example.test', '{"display_name":"Ava"}'::jsonb),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'ben@example.test', '{"display_name":"Ben"}'::jsonb),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'cam@example.test', '{"display_name":"Cam"}'::jsonb),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'dee@example.test', '{"display_name":"Dee"}'::jsonb);

-- Add matching profile rows; each profile ID must match an Auth user ID.
insert into public.profiles (id, display_name, description)
values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'Ava', 'Likes tabletop games'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'Ben', 'Enjoys cooperative games'),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'Cam', 'Collects board games'),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'Dee', 'Looking for new game groups');

-- Add catalog interests.
insert into public.interests (name)
values ('board games'), ('indie games'), ('hiking');

-- Give all four profiles the shared "board games" interest.
insert into public.profile_interests (profile_id, interest_id)
select p.id, i.id
from public.profiles p
cross join public.interests i
where p.id in (
  '00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000002'::uuid,
  '00000000-0000-4000-8000-000000000003'::uuid,
  '00000000-0000-4000-8000-000000000004'::uuid
)
and i.name = 'board games';

-- Put the four profiles in the same coarse-location queue area.
insert into public.match_queue (profile_id, location_cell)
select id, 'demo-seattle-central'
from public.profiles
where id in (
  '00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000002'::uuid,
  '00000000-0000-4000-8000-000000000003'::uuid,
  '00000000-0000-4000-8000-000000000004'::uuid
);