-- Remove broad default table access from browser roles before granting allowlisted actions.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

-- Restore the profile operations allowed by the owner policies in migrations 007 and 010.
grant select, insert, update on table public.profiles to authenticated;

-- Browser reads are limited to catalogs and data visible through migration 010 policies.
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

-- Browser writes are limited to a user's own votes, responses, and contact consents.
grant select, insert, update on table public.prompt_votes to authenticated;
grant select, insert, update on table public.event_responses to authenticated;
grant select, insert, delete on table public.contact_exchange_consents to authenticated;

-- Trusted backend functions use service_role to operate on matchmaking and other server-owned rows.
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
