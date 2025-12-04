-- Migration: remove deprecated password column from challenges
-- Drops the `password` column if present. This column has been deprecated
-- in the application and is no longer used. Keep the migration id-date
-- consistent with repo conventions.

BEGIN;

-- safety: only drop column if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'challenges'
          AND column_name = 'password'
    ) THEN
        ALTER TABLE public.challenges DROP COLUMN password;
    END IF;
END$$;

COMMIT;
