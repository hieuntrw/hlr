-- Migration: Add challenge_participant_id to activities and backfill
-- Adds a nullable FK to `challenge_participants` and a simple backfill that assigns
-- activities to participants when the activity date falls within the challenge date range
-- and the user_id matches. Review/back up DB before running on production.

BEGIN;

-- 1) Add column and index
ALTER TABLE IF EXISTS public.activities
  ADD COLUMN IF NOT EXISTS challenge_participant_id uuid REFERENCES public.challenge_participants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_challenge_participant_id ON public.activities(challenge_participant_id);

-- 2) Backfill existing activities (conservative approach)
-- This assigns an activity to a participant when:
--  - activities.challenge_participant_id IS NULL
--  - activity.user_id = challenge_participants.user_id
--  - activity.start_date::date BETWEEN challenges.start_date::date AND challenges.end_date::date
-- NOTE: If a user has multiple participants overlapping the same day-range, the UPDATE may choose an arbitrary matching participant.
-- If you need deterministic behavior pick the intended participant via additional business rules (e.g. target_km, created_at ordering).

UPDATE public.activities a
SET challenge_participant_id = cp.id
FROM public.challenge_participants cp
JOIN public.challenges ch ON cp.challenge_id = ch.id
WHERE a.challenge_participant_id IS NULL
  AND a.user_id = cp.user_id
  AND a.start_date::date BETWEEN ch.start_date::date AND ch.end_date::date;

COMMIT;

-- End of migration
