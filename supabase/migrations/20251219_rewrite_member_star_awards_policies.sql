-- Migration: Rewrite RLS policies for member_star_awards
-- Date: 2025-12-19
-- Purpose: Remove existing policies and re-create a clean set where
--  - Admins (JWT app_metadata.role = 'admin') have full access (FOR ALL)
--  - Authenticated sessions have table-level SELECT (subject to RLS, but here open)

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.member_star_awards ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies on this table (dynamic drop to avoid name assumptions)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='member_star_awards' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.member_star_awards;', r.policyname);
  END LOOP;
END$$;

-- Admins: full access (CREATE/SELECT/UPDATE/DELETE) when JWT role is 'admin'
CREATE POLICY "Admin full access" ON public.member_star_awards
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Authenticated sessions: allow SELECT (table-level read for authenticated)
CREATE POLICY "Authenticated can select" ON public.member_star_awards
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure the `authenticated` role has table-level SELECT privilege (helps in some PostgREST setups)
GRANT SELECT ON public.member_star_awards TO authenticated;

-- Note: service_role client bypasses RLS entirely. Adjust policies if you have other moderator roles
-- you want to grant broader access to (e.g. mod_finance, mod_member) using a similar expression.
