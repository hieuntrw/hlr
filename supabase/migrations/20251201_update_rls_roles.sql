-- RLS policies aligning five roles: admin, mod_finance, mod_challenge, mod_member, member
-- Identity: Supabase Auth; Authorization: role via profiles + JWT metadata

begin;

-- Helper SQL expressions
create or replace function public.has_role(target_roles text[])
returns boolean language sql stable as $$
  -- Determine the caller's role from the JWT app_metadata and check membership
  select (auth.jwt() -> 'app_metadata' ->> 'role') = any(target_roles);
$$;

-- PROFILES
-- Members can read own profile (already added separately), mods/admin can read all minimal fields
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Mods/Admin can read profiles'
  ) then
    create policy "Mods/Admin can read profiles"
      on public.profiles for select
      using ( has_role(ARRAY['admin','mod_member']) );
  end if;
end $$;

-- TRANSACTIONS
alter table public.transactions enable row level security;

-- Read own transactions
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='transactions' and policyname='Members read own transactions'
  ) then
    create policy "Members read own transactions"
      on public.transactions for select
      using ( user_id = auth.uid() );
  end if;
end $$;

-- Finance mods/admin read all
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='transactions' and policyname='Finance read all'
  ) then
    create policy "Finance read all"
      on public.transactions for select
      using ( has_role(ARRAY['admin','mod_finance']) );
  end if;
end $$;

-- Finance mods/admin manage payments (insert/update)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='transactions' and policyname='Finance write'
  ) then
    create policy "Finance write"
      on public.transactions for insert
      with check ( has_role(ARRAY['admin','mod_finance']) );
    create policy "Finance update"
      on public.transactions for update
      using ( has_role(ARRAY['admin','mod_finance']) )
      with check ( has_role(ARRAY['admin','mod_finance']) );
  end if;
end $$;

-- CHALLENGES
alter table public.challenges enable row level security;

-- Public read
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='challenges' and policyname='Challenges public read'
  ) then
    create policy "Challenges public read"
      on public.challenges for select
      using ( true );
  end if;
end $$;

-- Admin/mod_challenge manage
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='challenges' and policyname='Challenges write'
  ) then
    create policy "Challenges write"
      on public.challenges for insert
      with check ( has_role(ARRAY['admin','mod_challenge']) );
    create policy "Challenges update"
      on public.challenges for update
      using ( has_role(ARRAY['admin','mod_challenge']) )
      with check ( has_role(ARRAY['admin','mod_challenge']) );
  end if;
end $$;

-- CHALLENGE PARTICIPANTS
alter table public.challenge_participants enable row level security;

-- Members read own
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='challenge_participants' and policyname='Participants read own'
  ) then
    create policy "Participants read own"
      on public.challenge_participants for select
      using ( user_id = auth.uid() );
  end if;
end $$;

-- Admin/mod_challenge read all & update
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='challenge_participants' and policyname='Participants mod read'
  ) then
    create policy "Participants mod read"
      on public.challenge_participants for select
      using ( has_role(ARRAY['admin','mod_challenge']) );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='challenge_participants' and policyname='Participants mod update'
  ) then
    create policy "Participants mod update"
      on public.challenge_participants for update
      using ( has_role(ARRAY['admin','mod_challenge']) )
      with check ( has_role(ARRAY['admin','mod_challenge']) );
  end if;
end $$;

commit;
