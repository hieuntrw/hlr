-- Migration: Add additional fields and indexes for challenges and participants
-- Purpose: provide metadata (description, created_by, locked_at), indexes for performance,
-- and participant bookkeeping (joined_at, approved) to support challenge features.

ALTER TABLE challenges
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS capacity INTEGER;

-- Ensure we don't accidentally create duplicate challenges for same month
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'challenges' AND indexname = 'idx_challenges_start_date'
  ) THEN
    CREATE INDEX idx_challenges_start_date ON challenges (start_date);
  END IF;
END$$;

-- Participant bookkeeping
ALTER TABLE challenge_participants
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'challenge_participants' AND indexname = 'idx_cp_user_challenge'
  ) THEN
    CREATE INDEX idx_cp_user_challenge ON challenge_participants (user_id, challenge_id);
  END IF;
END$$;

-- Add a small function to recalculate participant status based on actual_km vs target_km
CREATE OR REPLACE FUNCTION recalc_challenge_participant_status(p_participant_id UUID)
RETURNS VOID AS $$
DECLARE
  v_target NUMERIC;
  v_actual NUMERIC;
BEGIN
  SELECT target_km, actual_km INTO v_target, v_actual FROM challenge_participants WHERE id = p_participant_id;
  IF v_target IS NULL THEN
    RETURN;
  END IF;
  IF v_actual >= v_target THEN
    UPDATE challenge_participants SET status = 'completed' WHERE id = p_participant_id;
  ELSE
    -- Keep registered or failed depending on business rules; keep as registered for now
    UPDATE challenge_participants SET status = 'registered' WHERE id = p_participant_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
