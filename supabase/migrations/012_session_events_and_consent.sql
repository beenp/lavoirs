create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.groups
  add column livekit_terminated_at timestamptz;

create table public.event_interests (
  event_id uuid not null references public.events(id) on delete cascade,
  interest_id bigint not null references public.interests(id) on delete cascade,
  primary key (event_id, interest_id)
);

alter table public.event_interests enable row level security;

create policy "Authenticated users can read interests for upcoming events"
on public.event_interests
for select
to authenticated
using (
  exists (
    select 1
    from public.events as event
    where event.id = event_id
      and event.starts_at > now()
  )
);

grant select on table public.event_interests to authenticated;
grant all privileges on table public.event_interests to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Let group members read recommendations and respond for two weeks after their session ends.
create or replace function public.current_user_can_access_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members as member
    join public.groups as matched_group
      on matched_group.id = member.group_id
    where member.group_id = p_group_id
      and member.profile_id = auth.uid()
      and (
        matched_group.status in ('waiting', 'active')
        or (
          matched_group.status = 'ended'
          and matched_group.ended_at >= now() - interval '14 days'
        )
      )
  );
$$;

revoke all on function public.current_user_can_access_group(uuid) from public, anon;
grant execute on function public.current_user_can_access_group(uuid) to authenticated;

drop policy if exists "Members can read their group event recommendations"
  on public.group_event_recommendations;
create policy "Members can read their group event recommendations"
on public.group_event_recommendations
for select
to authenticated
using (public.current_user_can_access_group(group_id));

drop policy if exists "Members can read event responses in their group"
  on public.event_responses;
drop policy if exists "Members can submit their own event responses"
  on public.event_responses;
drop policy if exists "Members can update their own event responses"
  on public.event_responses;

create policy "Members can read event responses in their group"
on public.event_responses
for select
to authenticated
using (
  exists (
    select 1
    from public.group_event_recommendations as recommendation
    where recommendation.id = recommendation_id
      and public.current_user_can_access_group(recommendation.group_id)
  )
);

create policy "Members can submit their own event responses"
on public.event_responses
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.group_event_recommendations as recommendation
    where recommendation.id = recommendation_id
      and public.current_user_can_access_group(recommendation.group_id)
  )
);

create policy "Members can update their own event responses"
on public.event_responses
for update
to authenticated
using (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.group_event_recommendations as recommendation
    where recommendation.id = recommendation_id
      and public.current_user_can_access_group(recommendation.group_id)
  )
)
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.group_event_recommendations as recommendation
    where recommendation.id = recommendation_id
      and public.current_user_can_access_group(recommendation.group_id)
  )
);

drop policy if exists "Participants can read their contact consents"
  on public.contact_exchange_consents;
create policy "Participants can read their contact consents"
on public.contact_exchange_consents
for select
to authenticated
using (
  (consenting_profile_id = (select auth.uid()) or other_profile_id = (select auth.uid()))
  and public.current_user_can_access_group(group_id)
);

drop policy if exists "Members can grant their own contact consent"
  on public.contact_exchange_consents;
drop policy if exists "Members can revoke their own contact consent"
  on public.contact_exchange_consents;
revoke insert, update, delete on table public.contact_exchange_consents from authenticated;

-- Serialize consent changes for a pair and return true only after both directions exist.
create or replace function public.set_contact_exchange_consent(
  p_group_id uuid,
  p_profile_id uuid,
  p_other_profile_id uuid,
  p_consent boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_profile_id is null or p_other_profile_id is null
     or p_profile_id = p_other_profile_id then
    raise exception 'Two different group members are required.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.groups as matched_group
    where matched_group.id = p_group_id
      and (
        matched_group.status = 'active'
        or (
          matched_group.status = 'ended'
          and matched_group.ended_at >= now() - interval '14 days'
        )
      )
  ) or (
    select count(distinct member.profile_id)
    from public.group_members as member
    where member.group_id = p_group_id
      and member.profile_id in (p_profile_id, p_other_profile_id)
  ) <> 2 then
    raise exception 'Both users must belong to a group open for contact exchange.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_group_id::text || ':' || least(p_profile_id::text, p_other_profile_id::text)
        || ':' || greatest(p_profile_id::text, p_other_profile_id::text),
      0
    )
  );

  if p_consent then
    insert into public.contact_exchange_consents (
      group_id, consenting_profile_id, other_profile_id
    )
    values (p_group_id, p_profile_id, p_other_profile_id)
    on conflict (group_id, consenting_profile_id, other_profile_id) do nothing;
  else
    delete from public.contact_exchange_consents as consent
    where consent.group_id = p_group_id
      and consent.consenting_profile_id = p_profile_id
      and consent.other_profile_id = p_other_profile_id;
  end if;

  return exists (
    select 1
    from public.contact_exchange_consents as own_consent
    where own_consent.group_id = p_group_id
      and own_consent.consenting_profile_id = p_profile_id
      and own_consent.other_profile_id = p_other_profile_id
  ) and exists (
    select 1
    from public.contact_exchange_consents as reciprocal
    where reciprocal.group_id = p_group_id
      and reciprocal.consenting_profile_id = p_other_profile_id
      and reciprocal.other_profile_id = p_profile_id
  );
end;
$$;

revoke all on function public.set_contact_exchange_consent(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_contact_exchange_consent(uuid, uuid, uuid, boolean)
  to service_role;

-- Upsert the signed-in member's vote and skip only after more than half vote to skip.
create or replace function public.vote_on_group_prompt(
  p_group_prompt_id uuid,
  p_vote text
)
returns table (
  skip_vote_count integer,
  group_member_count integer,
  prompt_is_skipped boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_group_id uuid;
  v_skipped_at timestamptz;
  v_skip_count integer;
  v_member_count integer;
begin
  if v_profile_id is null then
    raise exception 'A signed-in user is required.' using errcode = '28000';
  end if;

  if p_vote not in ('skip', 'keep') then
    raise exception 'Vote must be skip or keep.' using errcode = '22023';
  end if;

  select assigned_prompt.group_id, assigned_prompt.skipped_at
  into v_group_id, v_skipped_at
  from public.group_prompts as assigned_prompt
  where assigned_prompt.id = p_group_prompt_id;

  if v_group_id is null then
    raise exception 'Prompt is not assigned to a group.' using errcode = '23503';
  end if;

  if not public.current_user_in_active_group(v_group_id) then
    raise exception 'You are not an active member of this group.' using errcode = '42501';
  end if;

  if v_skipped_at is not null then
    raise exception 'This prompt has already been skipped.' using errcode = '55000';
  end if;

  insert into public.prompt_votes (group_prompt_id, profile_id, vote)
  values (p_group_prompt_id, v_profile_id, p_vote)
  on conflict (group_prompt_id, profile_id) do update
  set vote = excluded.vote,
      voted_at = now();

  select count(*) filter (where vote.vote = 'skip')::integer
  into v_skip_count
  from public.prompt_votes as vote
  where vote.group_prompt_id = p_group_prompt_id;

  select count(*)::integer
  into v_member_count
  from public.group_members as member
  where member.group_id = v_group_id
    and member.left_at is null;

  if v_skip_count > v_member_count / 2 then
    update public.group_prompts as assigned_prompt
    set skipped_at = now()
    where assigned_prompt.id = p_group_prompt_id
      and assigned_prompt.skipped_at is null;
    v_skipped_at := now();
  end if;

  return query select v_skip_count, v_member_count, v_skipped_at is not null;
end;
$$;

revoke all on function public.vote_on_group_prompt(uuid, text) from public, anon;
grant execute on function public.vote_on_group_prompt(uuid, text) to authenticated;
revoke insert, update, delete on table public.prompt_votes from authenticated;

-- Generate up to three upcoming events ranked by interest overlap within a group.
create or replace function public.generate_group_event_recommendations(p_group_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_status text;
  v_existing_count integer;
  v_inserted_count integer;
begin
  select matched_group.status
  into v_group_status
  from public.groups as matched_group
  where matched_group.id = p_group_id;

  if v_group_status is distinct from 'ended' then
    raise exception 'Recommendations are generated after the group ends.' using errcode = '55000';
  end if;

  select count(*)::integer
  into v_existing_count
  from public.group_event_recommendations as recommendation
  where recommendation.group_id = p_group_id;

  if v_existing_count > 0 then
    return v_existing_count;
  end if;

  with ranked_events as (
    select
      event.id as event_id,
      event.starts_at,
      count(distinct member.profile_id)::integer as matching_member_count
    from public.events as event
    join public.event_interests as event_interest
      on event_interest.event_id = event.id
    join public.profile_interests as profile_interest
      on profile_interest.interest_id = event_interest.interest_id
    join public.group_members as member
      on member.profile_id = profile_interest.profile_id
     and member.group_id = p_group_id
     and member.left_at is null
    where event.starts_at >= now()
      and event.starts_at < now() + interval '14 days'
    group by event.id, event.starts_at
  ),
  selected_events as (
    select
      ranked.event_id,
      row_number() over (
        order by ranked.matching_member_count desc, ranked.starts_at, ranked.event_id
      )::smallint as recommendation_rank
    from ranked_events as ranked
    limit 3
  )
  insert into public.group_event_recommendations (
    group_id, event_id, recommendation_rank
  )
  select p_group_id, selected.event_id, selected.recommendation_rank
  from selected_events as selected
  order by selected.recommendation_rank;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

revoke all on function public.generate_group_event_recommendations(uuid) from public, anon, authenticated;
grant execute on function public.generate_group_event_recommendations(uuid) to service_role;

-- Close expired sessions, prepare recommendations, and return rooms until teardown succeeds.
create or replace function public.process_expired_group_sessions()
returns table (
  processed_group_id uuid,
  room_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group record;
begin
  for v_group in
    select matched_group.id, matched_group.status, matched_group.livekit_room_name
    from public.groups as matched_group
    where (
      matched_group.status = 'active'
      and matched_group.started_at <= now() - interval '20 minutes'
    ) or (
      matched_group.status = 'ended'
      and matched_group.livekit_terminated_at is null
    )
    order by matched_group.started_at nulls last, matched_group.id
    for update skip locked
  loop
    if v_group.status = 'active' then
      update public.groups as matched_group
      set status = 'ended',
          ended_at = now()
      where matched_group.id = v_group.id;
    end if;

    perform public.generate_group_event_recommendations(v_group.id);

    processed_group_id := v_group.id;
    room_name := coalesce(v_group.livekit_room_name, v_group.id::text);
    return next;
  end loop;
end;
$$;

revoke all on function public.process_expired_group_sessions() from public, anon, authenticated;
grant execute on function public.process_expired_group_sessions() to service_role;
