-- Ensure auto_award_milestone respects existing milestone priority
-- Date: 2025-12-16

CREATE OR REPLACE FUNCTION auto_award_milestone()
RETURNS TRIGGER AS $$
DECLARE
  v_gender TEXT;
  v_member UUID;
  v_milestone RECORD;
  v_existing_priority INTEGER;
BEGIN
  -- Only process when approved and is_pr true and category is HM/FM
  IF NEW.status IS DISTINCT FROM TRUE OR NEW.is_pr IS DISTINCT FROM TRUE OR NEW.category IS NULL THEN
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
    AND (m.gender IS NULL OR m.gender = v_gender)
    AND (
      NEW.chip_time_seconds <= m.time_seconds OR m.milestone_name ILIKE 'Lần đầu%'
    )
  ORDER BY m.priority DESC
  LIMIT 1;

  IF v_milestone IS NULL THEN
    RETURN NEW; -- no milestone matched
  END IF;

  -- Check if member already received this specific milestone
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

  -- Check highest existing milestone priority for this member and race_type
  SELECT rm.priority INTO v_existing_priority
  FROM member_milestone_rewards mm
  JOIN reward_milestones rm ON rm.id = mm.milestone_id
  WHERE mm.member_id = v_member
    AND rm.race_type = v_milestone.race_type
  ORDER BY rm.priority DESC
  LIMIT 1;

  IF v_existing_priority IS NOT NULL AND v_existing_priority >= v_milestone.priority THEN
    -- Member already has an equal or higher priority milestone for this race_type -> skip awarding lower/equal
    -- Annotate race result with the found milestone (optional: do not overwrite if you prefer)
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

-- Recreate trigger to point to the updated function
DROP TRIGGER IF EXISTS trg_auto_award_milestone ON race_results;
CREATE TRIGGER trg_auto_award_milestone
AFTER INSERT OR UPDATE ON race_results
FOR EACH ROW
EXECUTE FUNCTION auto_award_milestone();
