-- Allow admin users to read/manage all profiles via RLS policy
-- This migration adds explicit admin policies for the `profiles` table

ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Admins can select all profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.policyname = 'Admins can read all profiles' AND p.schemaname = 'public' AND p.tablename = 'profiles'
  ) THEN
    CREATE POLICY "Admins can read all profiles"
      ON profiles FOR SELECT
      TO authenticated
      USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  END IF;

  -- Admins can manage (insert/update/delete) profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.policyname = 'Admins can manage profiles' AND p.schemaname = 'public' AND p.tablename = 'profiles'
  ) THEN
    CREATE POLICY "Admins can manage profiles"
      ON profiles FOR ALL
      TO authenticated
      USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
      WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  END IF;
END $$;

-- Note: Postgres will allow access if any policy evaluates to true. Existing
-- 'Users can read own profile' remains intact; adding admin policies enables
-- admin users (per app_metadata.role) to view/manage all profiles from client-side.
