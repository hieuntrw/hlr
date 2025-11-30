/*
  Migration: Update profiles, add activities, update challenges, add lucky_draws and reward_matrix
  Date: 2025-11-30

  Changes:
  - profiles: extend role values and add pb_* approval flags
  - activities: new table to store Strava activity details
  - challenge_participants: add `type` column (Run/Walk)
  - challenges: add pace limits and status column
  - lucky_draws: new table to store challenge lucky draw results
  - reward_matrix: new table to store configurable reward rules

  Notes:
  - This migration attempts to remove an existing CHECK constraint on `profiles.role`
    (if present) before adding a new, broader CHECK constraint.
  - `challenges.status` is set with a DEFAULT computed at INSERT time based on current_date.
    If you need it to auto-update as time passes, consider a view or a scheduled job.
*/

-- 1) PROFILES: add PB approval flags and expand role enum
ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS pb_hm_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pb_fm_approved BOOLEAN DEFAULT FALSE;

-- Safely drop any existing CHECK constraints on profiles.role, then add broader constraint
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE t.relname = 'profiles' AND a.attname = 'role' AND c.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', rec.conname);
  END LOOP;
END
$$;

-- Add new role constraint allowing detailed roles
ALTER TABLE IF EXISTS profiles
  ALTER COLUMN role SET DEFAULT 'member';

ALTER TABLE IF EXISTS profiles
  ADD CONSTRAINT profiles_role_allowed CHECK (role IN ('admin','mod_finance','mod_challenge','mod_member','member'));

-- 2) ACTIVITIES: new table to store individual Strava activities
CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  strava_activity_id BIGINT UNIQUE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_participant_id UUID REFERENCES challenge_participants(id) ON DELETE SET NULL,
  name TEXT,
  -- type: Run or Walk
  type TEXT DEFAULT 'Run' CHECK (type IN ('Run','Walk')),

  distance NUMERIC(10,2) DEFAULT 0, -- meters
  moving_time INTEGER, -- seconds
  elapsed_time INTEGER, -- seconds
  elevation_gain NUMERIC(8,2), -- meters
  average_heartrate NUMERIC(6,2),
  max_heartrate NUMERIC(6,2),
  average_cadence NUMERIC(6,2),

  start_date TIMESTAMPTZ,
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_strava_activity_id ON activities(strava_activity_id);

-- 3) EXTEND challenge_participants: add type column (Run/Walk)
ALTER TABLE IF EXISTS challenge_participants
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Run' CHECK (type IN ('Run','Walk'));

-- 4) CHALLENGES: add pace configuration and status
-- pace stored as seconds per km (integer). Default 4:00 -> 240, 12:00 -> 720
ALTER TABLE IF EXISTS challenges
  ADD COLUMN IF NOT EXISTS min_pace_seconds INTEGER DEFAULT 240,
  ADD COLUMN IF NOT EXISTS max_pace_seconds INTEGER DEFAULT 720,
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('Open','Closed'));

-- Populate status for existing rows based on current date
UPDATE challenges
SET status = CASE WHEN (current_date BETWEEN start_date AND end_date) THEN 'Open' ELSE 'Closed' END
WHERE status IS NULL;

-- Trigger function to set status on INSERT/UPDATE (cannot reference other columns in DEFAULT)
CREATE OR REPLACE FUNCTION set_challenge_status()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL) THEN
    IF current_date BETWEEN NEW.start_date AND NEW.end_date THEN
      NEW.status := 'Open';
    ELSE
      NEW.status := 'Closed';
    END IF;
  ELSE
    NEW.status := 'Closed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_challenge_status'
  ) THEN
    CREATE TRIGGER trg_set_challenge_status
    BEFORE INSERT OR UPDATE ON challenges
    FOR EACH ROW
    EXECUTE FUNCTION set_challenge_status();
  END IF;
END$$;

-- 5) lucky_draws: store results of challenge lucky-draws
CREATE TABLE IF NOT EXISTS lucky_draws (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  winner_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  prize_name TEXT,
  is_awarded BOOLEAN DEFAULT FALSE,
  drawn_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6) reward_matrix: configurable reward rules for complex prize logic
CREATE TABLE IF NOT EXISTS reward_matrix (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('HM','FM')),
  gender TEXT CHECK (gender IN ('Male','Female')),
  condition_type TEXT NOT NULL CHECK (condition_type IN ('Time','Rank')),
  -- condition_value: e.g. time in seconds (integer) or rank (integer)
  condition_value INTEGER NOT NULL,
  prize_desc TEXT,
  cash_amount NUMERIC(14,2) DEFAULT 0,
  priority INTEGER DEFAULT 100,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful index to find matching rewards quickly
CREATE INDEX IF NOT EXISTS idx_reward_matrix_category_active ON reward_matrix(category, active);

-- End of migration
