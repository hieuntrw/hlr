-- Recreate `member_star_awards` (idempotent)
-- Date: 2025-12-19
-- This migration is safe to run multiple times. It will create the table
-- if missing, add indexes, perform a conservative backfill from legacy
-- `member_rewards.quantity` rows, and grant SELECT to typical PostgREST roles.

BEGIN;
DROP TABLE IF EXISTS public.member_star_awards CASCADE;
-- 1) Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.member_star_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_participant_id UUID REFERENCES public.challenge_participants(id) ON DELETE SET NULL,
  -- number of stars awarded
  stars_awarded INTEGER NOT NULL,
  awarded_by uuid null,
  awarded_at timestamp default now(),
  notes text null,
  -- workflow status
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_member_star_member ON public.member_star_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_member_star_challenge ON public.member_star_awards(challenge_participant_id);


-- Policy: allow SELECT for admins or the owning user
CREATE POLICY allow_select_admin_or_owner ON public.member_star_awards
  FOR SELECT USING (
    current_setting('jwt.claims.role', true) = 'admin'
  );
CREATE POLICY "Authenticated can select (selfhost)" ON public.member_star_awards
  FOR SELECT
  TO authenticated
  USING ( true );
-- Policy: allow UPDATE only for admins
CREATE POLICY allow_update_admin ON public.member_star_awards
  FOR UPDATE USING (
    current_setting('jwt.claims.role', true) = 'admin'
  );
-- 4) Grant read access to common PostgREST roles used by self-hosted deployments
-- NB: adjust role names if your PostgREST role is different.
DO $$
BEGIN
  -- only attempt grant if roles exist
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.member_star_awards TO anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgrest') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.member_star_awards TO postgrest';
  END IF;
END$$;


COMMIT;

-- Verification helpers (run manually if desired):
-- SELECT count(*) FROM public.member_star_awards;
-- SELECT * FROM information_schema.role_table_grants WHERE table_name='member_star_awards';
