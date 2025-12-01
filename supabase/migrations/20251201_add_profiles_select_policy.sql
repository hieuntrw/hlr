-- Ensure RLS allows users to read their own profile (role, etc.)
-- This migration is idempotent: it checks for existing policy before creating.

begin;

-- Enable RLS on profiles (safe if already enabled)
alter table public.profiles enable row level security;

-- Create SELECT policy for own row if not exists
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can read own profile'
  ) then
    create policy "Users can read own profile"
      on public.profiles
      for select
      using (auth.uid() = id);
  end if;
end $$;

commit;
