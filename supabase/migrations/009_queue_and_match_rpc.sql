create or replace function public.enqueue_profile_and_match(
  p_interest_ids bigint[],
  p_location_cell text
)
returns table (
  match_status text,
  matched_group_id uuid,
  eligible_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_requested_count integer;
  v_valid_count integer;
  v_interest_id bigint;
  v_candidate_ids uuid[];
  v_group_id uuid;
  v_eligible_count integer := 0;
begin
  if v_profile_id is null then
    raise exception 'A signed-in user is required.' using errcode = '28000';
  end if;

  if p_location_cell is null
     or length(btrim(p_location_cell)) = 0
     or length(p_location_cell) > 200 then
    raise exception 'A valid location cell is required.' using errcode = '22023';
  end if;

  if p_interest_ids is null
     or cardinality(p_interest_ids) = 0
     or cardinality(p_interest_ids) > 20 then
    raise exception 'Select between 1 and 20 interests.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = v_profile_id
  ) then
    raise exception 'Create a profile before joining matchmaking.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.group_members as member
    join public.groups as matched_group
      on matched_group.id = member.group_id
    where member.profile_id = v_profile_id
      and member.left_at is null
      and matched_group.status in ('waiting', 'active')
  ) then
    raise exception 'You are already in an active group.' using errcode = '23505';
  end if;

  select count(*)
  into v_requested_count
  from (
    select distinct requested.interest_id
    from unnest(p_interest_ids) as requested(interest_id)
  ) as requested_interests;

  select count(*)
  into v_valid_count
  from (
    select distinct requested.interest_id
    from unnest(p_interest_ids) as requested(interest_id)
  ) as requested_interests
  join public.interests as interest
    on interest.id = requested_interests.interest_id;

  if v_valid_count <> v_requested_count then
    raise exception 'One or more selected interests do not exist.' using errcode = '22023';
  end if;

  delete from public.profile_interests as saved_interest
  where saved_interest.profile_id = v_profile_id;

  insert into public.profile_interests (profile_id, interest_id)
  select v_profile_id, requested.interest_id
  from (
    select distinct selected.interest_id
    from unnest(p_interest_ids) as selected(interest_id)
  ) as requested;

  insert into public.match_queue as existing_queue (profile_id, location_cell)
  values (v_profile_id, btrim(p_location_cell))
  on conflict (profile_id) do update
  set location_cell = excluded.location_cell,
      queued_at = case
        when existing_queue.location_cell is distinct from excluded.location_cell
          then now()
        else existing_queue.queued_at
      end;

  for v_interest_id in
    select saved_interest.interest_id
    from public.profile_interests as saved_interest
    where saved_interest.profile_id = v_profile_id
    order by saved_interest.interest_id
  loop
    select count(*)
    into v_valid_count
    from public.match_queue as queued
    where queued.location_cell = btrim(p_location_cell)
      and exists (
        select 1
        from public.profile_interests as shared_interest
        where shared_interest.profile_id = queued.profile_id
          and shared_interest.interest_id = v_interest_id
      )
      and not exists (
        select 1
        from public.group_members as member
        join public.groups as matched_group
          on matched_group.id = member.group_id
        where member.profile_id = queued.profile_id
          and member.left_at is null
          and matched_group.status in ('waiting', 'active')
      );

    v_eligible_count := greatest(v_eligible_count, v_valid_count);

    select coalesce(
      array_agg(eligible.profile_id order by eligible.queued_at, eligible.profile_id),
      array[]::uuid[]
    )
    into v_candidate_ids
    from (
      select queued.profile_id, queued.queued_at
      from public.match_queue as queued
      where queued.location_cell = btrim(p_location_cell)
        and exists (
          select 1
          from public.profile_interests as shared_interest
          where shared_interest.profile_id = queued.profile_id
            and shared_interest.interest_id = v_interest_id
        )
        and not exists (
          select 1
          from public.group_members as member
          join public.groups as matched_group
            on matched_group.id = member.group_id
          where member.profile_id = queued.profile_id
            and member.left_at is null
            and matched_group.status in ('waiting', 'active')
        )
      order by queued.queued_at, queued.profile_id
      for update of queued skip locked
      limit 4
    ) as eligible;

    if cardinality(v_candidate_ids) = 4 then
      v_group_id := gen_random_uuid();

      insert into public.groups (id, status, started_at)
      values (v_group_id, 'active', now());

      insert into public.group_members (group_id, profile_id)
      select v_group_id, selected.profile_id
      from unnest(v_candidate_ids) as selected(profile_id);

      delete from public.match_queue as queued
      where queued.profile_id = any(v_candidate_ids);

      return query select 'matched'::text, v_group_id, 4;
      return;
    end if;
  end loop;

  return query select 'queued'::text, null::uuid, v_eligible_count;
end;
$$;

revoke all on function public.enqueue_profile_and_match(bigint[], text) from public;
grant execute on function public.enqueue_profile_and_match(bigint[], text) to authenticated;
