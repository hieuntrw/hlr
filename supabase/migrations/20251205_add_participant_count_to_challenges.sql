-- Add participant_count cached column to challenges
-- Idempotent migration: safe to run multiple times

BEGIN;

-- Add column if missing
ALTER TABLE IF EXISTS public.challenges
  ADD COLUMN IF NOT EXISTS participant_count integer DEFAULT 0 NOT NULL;

-- Backfill counts for existing rows
-- Use a single UPDATE with subquery for efficiency
WITH counts AS (
  SELECT challenge_id, COUNT(*) AS cnt
  FROM public.challenge_participants
  GROUP BY challenge_id
)
UPDATE public.challenges c
SET participant_count = COALESCE(ct.cnt, 0)
FROM counts ct
WHERE c.id = ct.challenge_id;

-- Ensure rows with zero participants are set to 0
UPDATE public.challenges
SET participant_count = 0
WHERE participant_count IS NULL;

-- Create index for faster ordering/filtering by participant_count
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_challenges_participant_count' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_challenges_participant_count ON public.challenges (participant_count);
  END IF;
END$$;

-- Create trigger function to maintain participant_count on insert/delete
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trg_challenges_participant_count_update') THEN
    CREATE OR REPLACE FUNCTION trg_challenges_participant_count_update()
    RETURNS trigger AS $$
    BEGIN
      IF (TG_OP = 'INSERT') THEN
        UPDATE public.challenges SET participant_count = participant_count + 1 WHERE id = NEW.challenge_id;
        RETURN NEW;
      ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.challenges SET participant_count = GREATEST(participant_count - 1, 0) WHERE id = OLD.challenge_id;
        RETURN OLD;
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END$$;

-- Attach triggers if not already present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_challenge_participants_after_insert') THEN
    CREATE TRIGGER trg_challenge_participants_after_insert
    AFTER INSERT ON public.challenge_participants
    FOR EACH ROW
    EXECUTE FUNCTION trg_challenges_participant_count_update();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_challenge_participants_after_delete') THEN
    CREATE TRIGGER trg_challenge_participants_after_delete
    AFTER DELETE ON public.challenge_participants
    FOR EACH ROW
    EXECUTE FUNCTION trg_challenges_participant_count_update();
  END IF;
END$$;

COMMIT;
