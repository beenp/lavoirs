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

-- Create one stable active group for the four fixture profiles.
insert into public.groups (id, livekit_room_name, status, started_at)
values (
  '10000000-0000-4000-8000-000000000001'::uuid,
  'demo-board-games-4',
  'active',
  now()
)
on conflict (id) do update
set livekit_room_name = excluded.livekit_room_name,
    status = excluded.status,
    started_at = excluded.started_at,
    ended_at = null;

-- Add each fixture profile to the same group; the composite key prevents duplicates.
insert into public.group_members (group_id, profile_id, left_at)
select
  '10000000-0000-4000-8000-000000000001'::uuid,
  fixture_profiles.id,
  null
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid),
  ('00000000-0000-4000-8000-000000000002'::uuid),
  ('00000000-0000-4000-8000-000000000003'::uuid),
  ('00000000-0000-4000-8000-000000000004'::uuid)
) as fixture_profiles(id)
on conflict (group_id, profile_id) do update
set left_at = null;

-- Add two active ice-breaker prompts, finding the interest by its stable name.
insert into public.prompts (interest_id, prompt_text)
select board_games.id, fixture_prompts.prompt_text
from public.interests as board_games
cross join (values
  ('What is a game you could teach someone in five minutes?'),
  ('What makes a great cooperative game night?')
) as fixture_prompts(prompt_text)
where board_games.name = 'board games'
  and not exists (
    select 1
    from public.prompts as existing_prompts
    where existing_prompts.prompt_text = fixture_prompts.prompt_text
      and existing_prompts.interest_id = board_games.id
  );

-- Assign the two prompts in positions 1 and 2, looking up identity IDs by prompt text.
insert into public.group_prompts (id, group_id, prompt_id, position)
select
  fixture_assignments.id,
  '10000000-0000-4000-8000-000000000001'::uuid,
  prompts.id,
  fixture_assignments.position
from (values
  ('20000000-0000-4000-8000-000000000001'::uuid, 1::smallint, 'What is a game you could teach someone in five minutes?'),
  ('20000000-0000-4000-8000-000000000002'::uuid, 2::smallint, 'What makes a great cooperative game night?')
) as fixture_assignments(id, position, prompt_text)
join public.prompts as prompts
  on prompts.prompt_text = fixture_assignments.prompt_text
join public.interests as board_games
  on board_games.id = prompts.interest_id
 and board_games.name = 'board games'
on conflict (group_id, position) do update
set prompt_id = excluded.prompt_id;

-- Add a local-fixture event one week from seed time, updating it by stable source values.
insert into public.events (
  id,
  source,
  source_event_id,
  title,
  description,
  starts_at,
  ends_at,
  venue_name,
  venue_address,
  city,
  region,
  event_url
)
values (
  '30000000-0000-4000-8000-000000000001'::uuid,
  'local_fixture',
  'demo-board-game-night',
  'Seattle Board Game Night',
  'A sample in-person meetup for the board game group fixture.',
  date_trunc('day', now()) + interval '7 days' + interval '18 hours',
  date_trunc('day', now()) + interval '7 days' + interval '21 hours',
  'Community Game Cafe',
  '123 Example Street',
  'Seattle',
  'WA',
  'https://example.test/events/demo-board-game-night'
)
on conflict (source, source_event_id) do update
set title = excluded.title,
    description = excluded.description,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    venue_name = excluded.venue_name,
    venue_address = excluded.venue_address,
    city = excluded.city,
    region = excluded.region,
    event_url = excluded.event_url;

-- Recommend the event at rank 1, resolving its ID by the stable source and event key.
insert into public.group_event_recommendations (
  id,
  group_id,
  event_id,
  recommendation_rank
)
select
  '40000000-0000-4000-8000-000000000001'::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  events.id,
  1
from public.events
where events.source = 'local_fixture'
  and events.source_event_id = 'demo-board-game-night'
on conflict (group_id, recommendation_rank) do update
set event_id = excluded.event_id;
