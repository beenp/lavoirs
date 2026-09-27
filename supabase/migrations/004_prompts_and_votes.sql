create table public.prompts (
  id bigint generated always as identity primary key,
  interest_id bigint references public.interests(id) on delete set null,
  prompt_text text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.group_prompts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  prompt_id bigint not null references public.prompts(id) on delete restrict,
  position smallint not null check (position between 1 and 2),
  presented_at timestamptz not null default now(),
  skipped_at timestamptz,
  unique (group_id, position),
  unique (group_id, prompt_id)
);

create table public.prompt_votes (
  group_prompt_id uuid not null references public.group_prompts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  vote text not null check (vote in ('skip', 'keep')),
  voted_at timestamptz not null default now(),
  primary key (group_prompt_id, profile_id)
);
