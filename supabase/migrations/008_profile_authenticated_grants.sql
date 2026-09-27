-- Allow signed-in users to use the profile operations protected by migration 007.
grant select, insert, update on table public.profiles to authenticated;
