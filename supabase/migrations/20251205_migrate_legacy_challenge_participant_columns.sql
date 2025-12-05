-- Migration: migrate legacy challenge_participants columns to canonical names
-- Purpose: Safely migrate old column names `total_km` -> `actual_km` and
-- `valid_activities_count` -> `total_activities`. This migration is idempotent
-- and will either rename columns if canonical ones do not exist, or copy
-- legacy values into canonical columns if both are present.

BEGIN;

-- 1) total_km -> actual_km
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'challenge_participants' AND column_name = 'total_km'
  ) THEN
    -- If canonical column doesn't exist, rename the legacy column
    IF NOT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'challenge_participants' AND column_name = 'actual_km'
    ) THEN
      ALTER TABLE public.challenge_participants RENAME COLUMN total_km TO actual_km;
    ELSE
      -- canonical column exists: copy values where canonical is NULL
      UPDATE public.challenge_participants
      SET actual_km = COALESCE(actual_km, total_km);
      -- NOTE: we intentionally do NOT drop the legacy column automatically here.
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;

-- 2) valid_activities_count -> total_activities
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'challenge_participants' AND column_name = 'valid_activities_count'
  ) THEN
    IF NOT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'challenge_participants' AND column_name = 'total_activities'
    ) THEN
      ALTER TABLE public.challenge_participants RENAME COLUMN valid_activities_count TO total_activities;
    ELSE
      UPDATE public.challenge_participants
      SET total_activities = COALESCE(total_activities, valid_activities_count);
      -- NOTE: do NOT drop legacy column here to allow manual verification.
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;

-- 3) Rename index if present
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_class WHERE relname = 'idx_challenge_participants_challenge_total_km') THEN
    IF NOT EXISTS(SELECT 1 FROM pg_class WHERE relname = 'idx_challenge_participants_challenge_actual_km') THEN
      ALTER INDEX idx_challenge_participants_challenge_total_km RENAME TO idx_challenge_participants_challenge_actual_km;
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;

COMMIT;

-- Post-migration notes:
-- - This migration is cautious: it will not drop legacy columns automatically.
-- - After running and validating that everything behaves correctly, you may
--   optionally remove legacy columns with: ALTER TABLE public.challenge_participants DROP COLUMN IF EXISTS total_km;
--   and similarly for `valid_activities_count`.
