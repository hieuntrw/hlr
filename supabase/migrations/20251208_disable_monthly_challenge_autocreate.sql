-- Migration: Disable automatic monthly challenge creation
-- Actions:
-- 1) Unschedule the cron job named 'create-monthly-challenge' if it exists
-- 2) Drop the helper function create_next_month_challenge to avoid accidental runs

DO $$
BEGIN
  -- Unschedule job if exists
  BEGIN
    PERFORM cron.unschedule('create-monthly-challenge');
  EXCEPTION WHEN OTHERS THEN
    -- If unschedule not available or job missing, ignore
    RAISE NOTICE 'cron.unschedule failed or job not present: %', SQLERRM;
  END;

  -- Drop function if exists
  BEGIN
    DROP FUNCTION IF EXISTS create_next_month_challenge();
    RAISE NOTICE 'Dropped function create_next_month_challenge if it existed.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to drop function create_next_month_challenge: %', SQLERRM;
  END;
END$$;
