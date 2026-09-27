begin;

select plan(5);

-- Simulate Ava's signed-in JWT identity for this rollback-only database test.
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

-- Remove the seed's prebuilt group so matchmaking can use the four queued fixtures.
delete from public.groups
where id = '10000000-0000-4000-8000-000000000001'::uuid;

-- Save the RPC result in a temporary table so the following assertions share its group ID.
create temporary table matchmaking_result on commit drop as
select *
from public.enqueue_profile_and_match(
  array(select id from public.interests where name = 'board games'),
  'demo-seattle-central'
);

select is(
  (select match_status from matchmaking_result),
  'matched'::text,
  'four queued fixture users produce a match'
);

select is(
  (select eligible_count from matchmaking_result),
  4,
  'the match contains exactly four eligible users'
);

select is(
  (
    select count(*)::integer
    from public.group_members as member
    where member.group_id = (select matched_group_id from matchmaking_result)
      and member.left_at is null
  ),
  4,
  'exactly four active members are assigned to the generated group'
);

select is(
  (
    select count(*)::integer
    from public.match_queue as queued
    where queued.profile_id in (
      '00000000-0000-4000-8000-000000000001'::uuid,
      '00000000-0000-4000-8000-000000000002'::uuid,
      '00000000-0000-4000-8000-000000000003'::uuid,
      '00000000-0000-4000-8000-000000000004'::uuid
    )
  ),
  0,
  'matched users are removed from the queue'
);

select is(
  (
    select count(*)::integer
    from public.profile_interests as saved_interest
    join public.interests as interest
      on interest.id = saved_interest.interest_id
    where saved_interest.profile_id = '00000000-0000-4000-8000-000000000001'::uuid
      and interest.name = 'board games'
  ),
  1,
  'the caller selection is saved through the same RPC'
);

select * from finish();

rollback;
