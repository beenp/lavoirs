-- Check whether the signed-in user belongs to an active or waiting group.
create or replace function public.current_user_in_active_group(p_group_id uuid)
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
      and member.left_at is null
      and matched_group.status in ('waiting', 'active')
  );
$$;

-- Check whether a profile shares an active or waiting group with the signed-in user.
create or replace function public.profile_shares_active_group(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members as viewer_member
    join public.group_members as target_member
      on target_member.group_id = viewer_member.group_id
    join public.groups as matched_group
      on matched_group.id = viewer_member.group_id
    where viewer_member.profile_id = auth.uid()
      and viewer_member.left_at is null
      and target_member.profile_id = p_profile_id
      and target_member.left_at is null
      and matched_group.status in ('waiting', 'active')
  );
$$;

-- Keep these policy helpers callable only by signed-in clients.
revoke all on function public.current_user_in_active_group(uuid) from public, anon;
revoke all on function public.profile_shares_active_group(uuid) from public, anon;
grant execute on function public.current_user_in_active_group(uuid) to authenticated;
grant execute on function public.profile_shares_active_group(uuid) to authenticated;

-- Interest names are a read-only catalog for signed-in users.
create policy "Authenticated users can read interests"
on public.interests
for select
to authenticated
using (true);

-- Users can read their selected interests and those of people in their current group.
create policy "Users can read relevant profile interests"
on public.profile_interests
for select
to authenticated
using (
  profile_id = (select auth.uid())
  or public.profile_shares_active_group(profile_id)
);

-- Users can read only groups and members they currently belong to.
create policy "Members can read their active groups"
on public.groups
for select
to authenticated
using (public.current_user_in_active_group(id));

create policy "Members can read their group roster"
on public.group_members
for select
to authenticated
using (public.current_user_in_active_group(group_id));

-- Group members can read one another's profiles during the active conversation.
create policy "Group members can read each other's profiles"
on public.profiles
for select
to authenticated
using (public.profile_shares_active_group(id));

-- Active prompt text is available to signed-in users; prompt writes stay server-side.
create policy "Authenticated users can read active prompts"
on public.prompts
for select
to authenticated
using (is_active);

create policy "Members can read prompts assigned to their group"
on public.group_prompts
for select
to authenticated
using (public.current_user_in_active_group(group_id));

-- Group members can see votes; each user can create or change only their own vote.
create policy "Members can read votes in their group"
on public.prompt_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.group_prompts as assigned_prompt
    where assigned_prompt.id = group_prompt_id
      and public.current_user_in_active_group(assigned_prompt.group_id)
  )
);

create policy "Members can cast their own prompt votes"
on public.prompt_votes
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.group_prompts as assigned_prompt
    where assigned_prompt.id = group_prompt_id
      and public.current_user_in_active_group(assigned_prompt.group_id)
  )
);

create policy "Members can update their own prompt votes"
on public.prompt_votes
for update
to authenticated
using (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.group_prompts as assigned_prompt
    where assigned_prompt.id = group_prompt_id
      and public.current_user_in_active_group(assigned_prompt.group_id)
  )
)
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.group_prompts as assigned_prompt
    where assigned_prompt.id = group_prompt_id
      and public.current_user_in_active_group(assigned_prompt.group_id)
  )
);

-- Event listings are read-only and visible only before their start time.
create policy "Authenticated users can read upcoming events"
on public.events
for select
to authenticated
using (starts_at > now());

create policy "Members can read their group event recommendations"
on public.group_event_recommendations
for select
to authenticated
using (public.current_user_in_active_group(group_id));

-- Members can see and submit only responses tied to their current group's recommendations.
create policy "Members can read event responses in their group"
on public.event_responses
for select
to authenticated
using (
  exists (
    select 1
    from public.group_event_recommendations as recommendation
    where recommendation.id = recommendation_id
      and public.current_user_in_active_group(recommendation.group_id)
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
      and public.current_user_in_active_group(recommendation.group_id)
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
      and public.current_user_in_active_group(recommendation.group_id)
  )
)
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.group_event_recommendations as recommendation
    where recommendation.id = recommendation_id
      and public.current_user_in_active_group(recommendation.group_id)
  )
);

-- Only the two people named in a consent row can see it; users may grant or revoke their own consent.
create policy "Participants can read their contact consents"
on public.contact_exchange_consents
for select
to authenticated
using (
  (consenting_profile_id = (select auth.uid()) or other_profile_id = (select auth.uid()))
  and public.current_user_in_active_group(group_id)
);

create policy "Members can grant their own contact consent"
on public.contact_exchange_consents
for insert
to authenticated
with check (
  consenting_profile_id = (select auth.uid())
  and public.current_user_in_active_group(group_id)
  and exists (
    select 1
    from public.group_members as other_member
    where other_member.group_id = contact_exchange_consents.group_id
      and other_member.profile_id = other_profile_id
      and other_member.left_at is null
  )
);

create policy "Members can revoke their own contact consent"
on public.contact_exchange_consents
for delete
to authenticated
using (
  consenting_profile_id = (select auth.uid())
  and public.current_user_in_active_group(group_id)
);

-- Grant browser roles only the table actions supported by the policies above.
grant select on table
  public.interests,
  public.profile_interests,
  public.groups,
  public.group_members,
  public.prompts,
  public.group_prompts,
  public.events,
  public.group_event_recommendations
to authenticated;

grant select, insert, update on table public.prompt_votes to authenticated;
grant select, insert, update on table public.event_responses to authenticated;
grant select, insert, delete on table public.contact_exchange_consents to authenticated;

-- Server code uses the service role; it is the only role granted broad table and identity-sequence access.
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
