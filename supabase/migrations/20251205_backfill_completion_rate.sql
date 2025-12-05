-- Migration: ensure and backfill completion_rate in challenge_participants
-- Adds the column if missing and backfills values from actual_km / target_km

BEGIN;

ALTER TABLE IF EXISTS public.challenge_participants
ADD COLUMN IF NOT EXISTS completion_rate numeric(5,2) DEFAULT 0;

-- Backfill where we have a target_km and actual_km
UPDATE public.challenge_participants
SET completion_rate = ROUND((COALESCE(actual_km, 0) / NULLIF(target_km, 0)) * 100, 2)
WHERE target_km IS NOT NULL AND target_km > 0;

COMMIT;
