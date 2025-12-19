/*
  Migration: Add Challenge Star Rewards System
  Date: 2025-12-01 (revised 2025-12-17)

  Changes:
  - Create `member_star_awards` table to store challenge star awards
  - Add `calculate_challenge_stars` helper
  - Create `auto_award_challenge_stars` trigger to award stars when a participant completes
    a challenge. The trigger reads `system_settings.challenge_star_milestones` JSON mapping
    when present and falls back to a sensible default rule.
  - Backfill existing completed `challenge_participants` into `member_star_awards` idempotently

  Important: This migration no longer references `member_rewards` (legacy table removed).
*/

-- 1) Create `member_star_awards` table (idempotent)
CREATE TABLE IF NOT EXISTS member_star_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_participant_id UUID REFERENCES challenge_participants(id) ON DELETE SET NULL,
  stars_awarded INTEGER NOT NULL,
  awarded_by uuid null,
  awarded_at timestamp default now(),
  notes text null,  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_star_member ON member_star_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_member_star_challenge ON member_star_awards(challenge_participant_id);

-- 2) Create function to calculate stars based on target (default rule)
-- Note: star counts are determined solely by `system_settings.challenge_star_milestones`.
-- No local fallback function is provided; if the setting is not defined, no stars
-- will be awarded automatically.

-- 3) Create function to auto-award challenge stars (reads system_settings.challenge_star_milestones)
CREATE OR REPLACE FUNCTION auto_award_challenge_stars()
RETURNS TRIGGER AS $auto_award$
DECLARE
  stars_to_award INTEGER := 0;
  mapping JSONB;
  k TEXT;
  candidate INT;
  best_key INT := NULL;
  existing_id UUID;
  target_km_int INT;
BEGIN
  -- Only proceed if status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Check if actual_km >= target_km
    IF NEW.actual_km >= NEW.target_km THEN
      -- Try to read mapping from system_settings as JSONB
      BEGIN
        SELECT value::jsonb INTO mapping FROM system_settings WHERE key = 'challenge_star_milestones' LIMIT 1;
      EXCEPTION WHEN OTHERS THEN
        mapping := NULL;
      END;

      IF mapping IS NOT NULL THEN
        -- Cast target_km to integer to match mapping keys like "70", "100", ...
        BEGIN
          target_km_int := (NEW.target_km::numeric)::INT;
        EXCEPTION WHEN OTHERS THEN
          target_km_int := NULL;
        END;

        IF target_km_int IS NOT NULL THEN
          -- exact match
          IF mapping ? target_km_int::text THEN
            stars_to_award := (mapping ->> target_km_int::text)::INT;
          ELSE
            -- find largest mapping key <= target_km
            FOR k IN SELECT * FROM jsonb_object_keys(mapping) LOOP
              BEGIN
                candidate := k::INT;
                IF candidate <= target_km_int THEN
                  IF best_key IS NULL OR candidate > best_key THEN
                    best_key := candidate;
                  END IF;
                END IF;
              EXCEPTION WHEN OTHERS THEN
                CONTINUE;
              END;
            END LOOP;
            IF best_key IS NOT NULL THEN
              stars_to_award := (mapping ->> best_key::text)::INT;
            END IF;
          END IF;
        END IF;
      END IF;

      -- If mapping not present or yields 0, do not award (require configured mapping)
      IF stars_to_award IS NULL OR stars_to_award = 0 THEN
        RETURN NEW;
      END IF;

      -- Upsert into member_star_awards by challenge_participant_id
      SELECT id INTO existing_id FROM member_star_awards WHERE challenge_participant_id = NEW.id LIMIT 1;
      IF existing_id IS NULL THEN
        INSERT INTO member_star_awards (user_id, challenge_participant_id, stars_awarded, awarded_by, awarded_at, notes, created_at, updated_at)
        VALUES (NEW.user_id, NEW.id, stars_to_award, NULL, NOW(), NULL, NOW(), NOW());
      ELSE
        UPDATE member_star_awards
        SET stars_awarded = GREATEST(COALESCE(stars_awarded,0), stars_to_award), awarded_at = NOW(), updated_at = NOW()
        WHERE id = existing_id;
      END IF;

      -- Best-effort: update profiles.total_stars if column exists
      BEGIN
        UPDATE profiles SET total_stars = COALESCE(total_stars, 0) + stars_to_award WHERE id = NEW.user_id;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;

    END IF;
  END IF;
  RETURN NEW;
END;
$auto_award$ LANGUAGE plpgsql;

-- 4) Create trigger on challenge_participants
DROP TRIGGER IF EXISTS trg_auto_award_challenge_stars ON challenge_participants;

CREATE TRIGGER trg_auto_award_challenge_stars
AFTER UPDATE OF status, actual_km ON challenge_participants
FOR EACH ROW
EXECUTE FUNCTION auto_award_challenge_stars();

-- 5) Backfill stars for existing completed challenges (idempotent)
-- Backfill using mapping from `system_settings.challenge_star_milestones` only.
-- Rows without a configured mapping (exact or lower bound) are skipped.
INSERT INTO member_star_awards (user_id, challenge_participant_id, stars_awarded, awarded_by, awarded_at, notes, created_at, updated_at)
SELECT
  cp.user_id,
  cp.id,
  (
    COALESCE(
      (ms.mapping ->> ((cp.target_km::numeric)::INT)::text)::INT,
      (
        SELECT (ms.mapping ->> k)::INT
        FROM jsonb_object_keys(ms.mapping) AS k
        WHERE (k::INT) <= (cp.target_km::numeric)::INT
        ORDER BY (k::INT) DESC
        LIMIT 1
      )
    )
  )::INT AS stars_awarded,
  NULL,
  COALESCE(cp.last_synced_at::timestamp, NOW()),
  COALESCE(cp.last_synced_at::timestamp, NOW())
FROM challenge_participants cp
JOIN LATERAL (SELECT value::jsonb AS mapping FROM system_settings WHERE key = 'challenge_star_milestones') ms ON TRUE
WHERE cp.status = 'completed'
  AND cp.actual_km >= cp.target_km
  AND NOT EXISTS (
    SELECT 1 FROM member_star_awards msa
    WHERE msa.challenge_participant_id = cp.id
  )
  AND (
    (ms.mapping ? cp.target_km::text) OR
    EXISTS (SELECT 1 FROM jsonb_object_keys(ms.mapping) AS k WHERE (k::INT) <= cp.target_km)
  );

-- End of migration
