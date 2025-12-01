-- Auto-award milestone rewards on approved PB race results
-- Date: 2025-12-01

-- 1) Add columns to race_results to support approval and milestone annotation
ALTER TABLE race_results
  ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS category VARCHAR(2) CHECK (category IN ('HM','FM')),
  ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES reward_milestones(id),
  ADD COLUMN IF NOT EXISTS milestone_name TEXT;

-- Derive category from distance on insert/update if not provided
CREATE OR REPLACE FUNCTION derive_category_from_distance(distance_text TEXT)
RETURNS VARCHAR AS $$
BEGIN
  IF distance_text ILIKE '21%' THEN
    RETURN 'HM';
  ELSIF distance_text ILIKE '42%' THEN
    RETURN 'FM';
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION race_results_set_category()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category IS NULL THEN
    NEW.category := derive_category_from_distance(NEW.distance);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_race_results_set_category ON race_results;
CREATE TRIGGER trg_race_results_set_category
BEFORE INSERT OR UPDATE ON race_results
FOR EACH ROW
EXECUTE FUNCTION race_results_set_category();

-- 2) Auto-evaluate milestones when a result is approved and is PR
CREATE OR REPLACE FUNCTION auto_award_milestone()
RETURNS TRIGGER AS $$
DECLARE
  v_gender TEXT;
  v_member UUID;
  v_milestone RECORD;
BEGIN
  -- Only process when approved and is_pr true and category is HM/FM
  IF NEW.approved IS DISTINCT FROM TRUE OR NEW.is_pr IS DISTINCT FROM TRUE OR NEW.category IS NULL THEN
    RETURN NEW;
  END IF;

  v_member := NEW.user_id;

  -- Get gender from profiles
  SELECT gender INTO v_gender FROM profiles WHERE id = v_member;
  IF v_gender IS NULL THEN
    -- No gender -> skip
    RETURN NEW;
  END IF;

  -- Find highest active milestone matching category + gender and time threshold
  SELECT * INTO v_milestone
  FROM reward_milestones m
  WHERE m.is_active = TRUE
    AND m.race_type = NEW.category
    AND m.gender = v_gender
    AND (
      -- For "Lần đầu hoàn thành" milestone we use very large time_seconds (999999)
      NEW.chip_time_seconds <= m.time_seconds OR m.milestone_name ILIKE 'Lần đầu%'
    )
  ORDER BY m.priority DESC
  LIMIT 1;

  IF v_milestone IS NULL THEN
    RETURN NEW; -- no milestone matched
  END IF;

  -- Check if member already received this milestone
  IF EXISTS (
    SELECT 1 FROM member_milestone_rewards
    WHERE member_id = v_member AND milestone_id = v_milestone.id
  ) THEN
    -- Already awarded this milestone, just annotate race result
    UPDATE race_results
    SET milestone_id = v_milestone.id,
        milestone_name = v_milestone.milestone_name
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- Insert milestone reward (pending)
  INSERT INTO member_milestone_rewards (
    member_id, race_id, race_result_id, milestone_id,
    achieved_time_seconds, reward_description, cash_amount, status
  ) VALUES (
    v_member, NEW.race_id, NEW.id, v_milestone.id,
    NEW.chip_time_seconds, v_milestone.reward_description, COALESCE(v_milestone.cash_amount, 0), 'pending'
  );

  -- Annotate the race result with milestone info
  UPDATE race_results
  SET milestone_id = v_milestone.id,
      milestone_name = v_milestone.milestone_name
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_award_milestone ON race_results;
CREATE TRIGGER trg_auto_award_milestone
AFTER INSERT OR UPDATE ON race_results
FOR EACH ROW
EXECUTE FUNCTION auto_award_milestone();

-- 3) RLS safe updates: allow admin/mod_challenge to set approved
-- Note: existing RLS should already permit admin/mods to update race_results.
-- No additional policy changes if already present.
