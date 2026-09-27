create table public.groups (
  id uuid primary key default gen_random_uuid(),
  livekit_room_name text unique,
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'ended')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (group_id, profile_id)
);