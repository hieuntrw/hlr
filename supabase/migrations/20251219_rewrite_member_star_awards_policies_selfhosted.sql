-- Migration: Rewrite RLS policies for member_star_awards (self-hosted PostgREST)
-- Date: 2025-12-19
-- Purpose: For self-hosted setups where SUPABASE_SERVICE_ROLE_KEY is not used,
-- provide policies that use JWT claims via current_setting('jwt.claims.*', true).

ALTER TABLE IF EXISTS public.member_star_awards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies safely
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='member_star_awards' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.member_star_awards;', r.policyname);
  END LOOP;
END$$;

-- Admins: full access when JWT claim `role` = 'admin'
-- Uses current_setting('jwt.claims.role', true) which works with self-hosted PostgREST JWT claims
CREATE POLICY "Admin full access (selfhost)" ON public.member_star_awards
  FOR ALL
  USING ( current_setting('jwt.claims.role', true) = 'admin' );

-- Authenticated sessions: allow SELECT
CREATE POLICY "Authenticated can select (selfhost)" ON public.member_star_awards
  FOR SELECT
  TO authenticated
  USING ( true );

-- Grant SELECT at table-level to authenticated role (helps some PostgREST configs)
GRANT SELECT ON public.member_star_awards TO authenticated;

-- Note: verify that your JWT includes a `role` claim (jwt.claims.role). If your auth layer
-- places role elsewhere, adjust the policy expression accordingly (e.g. jwt.claims.app_metadata_role).
