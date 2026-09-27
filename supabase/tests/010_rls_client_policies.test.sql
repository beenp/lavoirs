begin;

select plan(14);

-- Split the four fixture users into two groups to test group-level visibility boundaries.
delete from public.group_members
where group_id = '10000000-0000-4000-8000-000000000001'::uuid
  and profile_id in (
    '00000000-0000-4000-8000-000000000003'::uuid,
    '00000000-0000-4000-8000-000000000004'::uuid
  );

insert into public.groups (id, status, started_at)
values ('50000000-0000-4000-8000-000000000001'::uuid, 'active', now());

insert into public.group_members (group_id, profile_id)
values
  ('50000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000003'::uuid),
  ('50000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000004'::uuid);

-- Assume Ava's authenticated browser role and JWT subject for the policy assertions.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

select is(
  (select count(*)::integer from public.interests),
  3,
  'authenticated users can read the interest catalog'
);

select is(
  (select count(*)::integer from public.profiles),
  2,
  'a user can read profiles in their own group only'
);

select is(
  (select count(*)::integer from public.groups),
  1,
  'a user can read their active group only'
);

select is(
  (select count(*)::integer from public.group_members),
  2,
  'a user can read the roster of their active group'
);

select is(
  (select count(*)::integer from public.profile_interests),
  2,
  'a user can read interests for profiles in their own group'
);

select ok(
  not has_table_privilege('authenticated', 'public.match_queue', 'SELECT'),
  'browser clients cannot query match_queue directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.groups', 'INSERT'),
  'browser clients cannot create groups directly'
);

select lives_ok(
  $cmd$
    insert into public.prompt_votes (group_prompt_id, profile_id, vote)
    select assigned_prompt.id, auth.uid(), 'keep'
    from public.group_prompts as assigned_prompt
    where assigned_prompt.group_id = '10000000-0000-4000-8000-000000000001'::uuid
    order by assigned_prompt.position
    limit 1
  $cmd$,
  'a member can vote on a prompt in their group'
);

select throws_ok(
  $cmd$
    insert into public.prompt_votes (group_prompt_id, profile_id, vote)
    select assigned_prompt.id, '00000000-0000-4000-8000-000000000003'::uuid, 'skip'
    from public.group_prompts as assigned_prompt
    where assigned_prompt.group_id = '10000000-0000-4000-8000-000000000001'::uuid
    order by assigned_prompt.position
    limit 1
  $cmd$,
  '42501',
  null,
  'a member cannot cast a vote for another profile'
);

select lives_ok(
  $cmd$
    insert into public.event_responses (recommendation_id, profile_id, response)
    select recommendation.id, auth.uid(), 'interested'
    from public.group_event_recommendations as recommendation
    where recommendation.group_id = '10000000-0000-4000-8000-000000000001'::uuid
    limit 1
  $cmd$,
  'a member can respond to an event recommended to their group'
);

select lives_ok(
  $cmd$
    insert into public.contact_exchange_consents (
      group_id, consenting_profile_id, other_profile_id
    )
    values (
      '10000000-0000-4000-8000-000000000001'::uuid,
      auth.uid(),
      '00000000-0000-4000-8000-000000000002'::uuid
    )
  $cmd$,
  'a member can grant contact consent to another member of their group'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.contact_exchange_consents),
  1,
  'the other participant can see consent addressed to them'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);

select is(
  (select count(*)::integer from public.contact_exchange_consents),
  0,
  'a user outside the group cannot see another group contact consent'
);

select is(
  (select count(*)::integer from public.group_event_recommendations),
  0,
  'a user outside the group cannot read its event recommendations'
);

reset role;
select * from finish();

rollback;
