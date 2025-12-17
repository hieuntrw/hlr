-- Migration: Add lucky_draw_completed to challenges and trigger to set it
-- Date: 2025-12-17

BEGIN;

-- 1) Add column to challenges to mark that the lucky-draw has been completed
ALTER TABLE IF EXISTS challenges
  ADD COLUMN IF NOT EXISTS lucky_draw_completed BOOLEAN DEFAULT FALSE;

-- 2) Function to mark challenge as drawn when winners reach threshold
CREATE OR REPLACE FUNCTION mark_challenge_drawn()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  winner_count INTEGER;
  required INTEGER; -- threshold (read from system_settings with fallback)
BEGIN
  -- Read threshold from system_settings.key = 'lucky_draw_winner_threshold'
  -- Expect value to be an integer; fallback to 2 when missing or invalid
  BEGIN
    SELECT COALESCE((SELECT value::int FROM system_settings WHERE key = 'lucky_draw_winner_threshold' LIMIT 1), 2) INTO required;
  EXCEPTION WHEN others THEN
    required := 2;
  END;

  SELECT COUNT(*) INTO winner_count FROM lucky_draw_winners WHERE challenge_id = NEW.challenge_id;

  IF winner_count >= required THEN
    UPDATE challenges SET lucky_draw_completed = TRUE WHERE id = NEW.challenge_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Create trigger on lucky_draw_winners to call function after insert
DROP TRIGGER IF EXISTS trg_mark_drawn ON lucky_draw_winners;
CREATE TRIGGER trg_mark_drawn
AFTER INSERT ON lucky_draw_winners
FOR EACH ROW
EXECUTE FUNCTION mark_challenge_drawn();

COMMIT;
