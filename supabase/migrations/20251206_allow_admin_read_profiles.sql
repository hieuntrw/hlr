-- Migration: Allow admins to read all profiles via RLS policy
-- Date: 2025-12-06

BEGIN;

-- Create a SELECT policy that allows admin users (profiles.role = 'admin') to read all profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Admins can read all profiles'
  ) THEN
    CREATE POLICY "Admins can read all profiles"
      ON public.profiles
      FOR SELECT
      USING (
        ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
      );
  END IF;
END $$;

COMMIT;
