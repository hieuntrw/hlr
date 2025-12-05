-- Add participant_count cached column to challenges
-- Idempotent migration: safe to run multiple times

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

-- Create index for faster ordering/filtering by participant_count (idempotent)
CREATE INDEX IF NOT EXISTS idx_challenges_participant_count ON public.challenges (participant_count);

-- Create or replace trigger function to maintain participant_count on insert/delete
CREATE OR REPLACE FUNCTION trg_challenges_participant_count_update()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.challenges SET participant_count = participant_count + 1 WHERE id = NEW.challenge_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.challenges SET participant_count = GREATEST(participant_count - 1, 0) WHERE id = OLD.challenge_id;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Handle moves between challenges if challenge_id changed
    IF (OLD.challenge_id IS DISTINCT FROM NEW.challenge_id) THEN
      UPDATE public.challenges SET participant_count = GREATEST(participant_count - 1, 0) WHERE id = OLD.challenge_id;
      UPDATE public.challenges SET participant_count = participant_count + 1 WHERE id = NEW.challenge_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers: drop if exist then create to be idempotent
DROP TRIGGER IF EXISTS trg_challenge_participants_after_insert ON public.challenge_participants;
CREATE TRIGGER trg_challenge_participants_after_insert
AFTER INSERT ON public.challenge_participants
FOR EACH ROW
EXECUTE FUNCTION trg_challenges_participant_count_update();

DROP TRIGGER IF EXISTS trg_challenge_participants_after_delete ON public.challenge_participants;
CREATE TRIGGER trg_challenge_participants_after_delete
AFTER DELETE ON public.challenge_participants
FOR EACH ROW
EXECUTE FUNCTION trg_challenges_participant_count_update();

-- Also attach update trigger to handle moved participants
DROP TRIGGER IF EXISTS trg_challenge_participants_after_update ON public.challenge_participants;
CREATE TRIGGER trg_challenge_participants_after_update
AFTER UPDATE OF challenge_id ON public.challenge_participants
FOR EACH ROW
WHEN (OLD.challenge_id IS DISTINCT FROM NEW.challenge_id)
EXECUTE FUNCTION trg_challenges_participant_count_update();
