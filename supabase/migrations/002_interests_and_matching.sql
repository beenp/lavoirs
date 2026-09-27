create table public.interests (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.profile_interests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest_id bigint not null references public.interests(id) on delete cascade,
  primary key (profile_id, interest_id)
);

create table public.match_queue (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  location_cell text not null,
  queued_at timestamptz not null default now()
);