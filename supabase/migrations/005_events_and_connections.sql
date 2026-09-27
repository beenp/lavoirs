create table public.events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_event_id text,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_name text,
  venue_address text,
  city text not null,
  region text,
  event_url text,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  unique (source, source_event_id)
);

create table public.group_event_recommendations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete restrict,
  recommendation_rank smallint not null check (recommendation_rank between 1 and 3),
  recommended_at timestamptz not null default now(),
  unique (group_id, recommendation_rank),
  unique (group_id, event_id)
);

create table public.event_responses (
  recommendation_id uuid not null references public.group_event_recommendations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  response text not null check (response in ('interested', 'not_interested')),
  responded_at timestamptz not null default now(),
  primary key (recommendation_id, profile_id)
);

create table public.contact_exchange_consents (
  group_id uuid not null references public.groups(id) on delete cascade,
  consenting_profile_id uuid not null references public.profiles(id) on delete cascade,
  other_profile_id uuid not null references public.profiles(id) on delete cascade,
  consented_at timestamptz not null default now(),
  primary key (group_id, consenting_profile_id, other_profile_id),
  check (consenting_profile_id <> other_profile_id)
);
