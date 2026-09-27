begin;

select plan(14);

-- Verify prompt voting through the authenticated RPC, including the strict-majority rule.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

select ok(
  has_function_privilege('authenticated', 'public.vote_on_group_prompt(uuid,text)', 'EXECUTE'),
  'authenticated members can execute the prompt voting RPC'
);

select is(
  (
    select result.skip_vote_count
    from public.vote_on_group_prompt(
      '20000000-0000-4000-8000-000000000001'::uuid,
      'skip'
    ) as result
  ),
  1,
  'one skip vote is recorded'
);

select ok(
  (select skipped_at is null
   from public.group_prompts
   where id = '20000000-0000-4000-8000-000000000001'::uuid),
  'one vote does not skip a prompt for four members'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is(
  (
    select result.skip_vote_count
    from public.vote_on_group_prompt(
      '20000000-0000-4000-8000-000000000001'::uuid,
      'skip'
    ) as result
  ),
  2,
  'the second skip vote is recorded'
);

select ok(
  (select skipped_at is null
   from public.group_prompts
   where id = '20000000-0000-4000-8000-000000000001'::uuid),
  'a tie does not skip a prompt for four members'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is(
  (
    select result.skip_vote_count
    from public.vote_on_group_prompt(
      '20000000-0000-4000-8000-000000000001'::uuid,
      'skip'
    ) as result
  ),
  3,
  'the third skip vote is recorded'
);

select ok(
  (select skipped_at is not null
   from public.group_prompts
   where id = '20000000-0000-4000-8000-000000000001'::uuid),
  'a strict majority skips the prompt'
);

reset role;

-- Verify contact data cannot be granted by direct browser writes and consent is mutual.
select ok(
  not has_function_privilege(
    'authenticated',
    'public.set_contact_exchange_consent(uuid,uuid,uuid,boolean)',
    'EXECUTE'
  ),
  'browser clients cannot call the privileged contact consent RPC directly'
);

select is(
  public.set_contact_exchange_consent(
    '10000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000002'::uuid,
    true
  ),
  false,
  'one-sided consent is not mutual'
);

select is(
  public.set_contact_exchange_consent(
    '10000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000002'::uuid,
    '00000000-0000-4000-8000-000000000001'::uuid,
    true
  ),
  true,
  'reciprocal consent enables contact exchange'
);

select is(
  public.set_contact_exchange_consent(
    '10000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000002'::uuid,
    false
  ),
  false,
  'revoking either consent ends contact exchange'
);

-- Create a separate expired group so the lifecycle check leaves the seeded active group intact.
insert into public.groups (id, livekit_room_name, status, started_at)
values (
  '60000000-0000-4000-8000-000000000001'::uuid,
  'test-expired-room',
  'active',
  now() - interval '21 minutes'
);

insert into public.group_members (group_id, profile_id)
select '60000000-0000-4000-8000-000000000001'::uuid, fixture.profile_id
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid),
  ('00000000-0000-4000-8000-000000000002'::uuid),
  ('00000000-0000-4000-8000-000000000003'::uuid),
  ('00000000-0000-4000-8000-000000000004'::uuid)
) as fixture(profile_id);

set local role service_role;
create temporary table processed_expired_sessions as
select * from public.process_expired_group_sessions();
reset role;

select ok(
  exists (
    select 1
    from processed_expired_sessions
    where processed_group_id = '60000000-0000-4000-8000-000000000001'::uuid
  ),
  'the lifecycle RPC returns groups past the 20-minute deadline'
);

select is(
  (select status from public.groups
   where id = '60000000-0000-4000-8000-000000000001'::uuid),
  'ended'::text,
  'the lifecycle RPC ends an expired group'
);

select is(
  (select count(*)::integer
   from public.group_event_recommendations
   where group_id = '60000000-0000-4000-8000-000000000001'::uuid),
  1,
  'the lifecycle RPC creates a recommendation from matching event tags'
);

select * from finish();
rollback;
