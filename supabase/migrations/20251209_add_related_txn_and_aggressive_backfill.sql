-- Add related_transaction_id to specialized reward tables and perform an aggressive backfill

-- 1) Add `related_transaction_id` columns if not exists
ALTER TABLE IF EXISTS member_milestone_rewards
  ADD COLUMN IF NOT EXISTS related_transaction_id UUID REFERENCES transactions(id);

ALTER TABLE IF EXISTS member_podium_rewards
  ADD COLUMN IF NOT EXISTS related_transaction_id UUID REFERENCES transactions(id);

-- Indexes to speed up lookups
CREATE INDEX IF NOT EXISTS idx_member_milestone_related_tx ON member_milestone_rewards(related_transaction_id);
CREATE INDEX IF NOT EXISTS idx_member_podium_related_tx ON member_podium_rewards(related_transaction_id);

-- 2) Aggressive backfill from member_rewards -> member_podium_rewards (podium types)
DO $$
DECLARE
  rec RECORD;
  podium_type TEXT;
BEGIN
  FOR rec IN
    SELECT mr.id as member_reward_id, mr.user_id, mr.race_result_id, rd.type as rd_type, rd.condition_value, rd.prize_description, rd.cash_amount, mr.status, mr.created_at
    FROM member_rewards mr
    JOIN reward_definitions rd ON rd.id = mr.reward_definition_id
    WHERE rd.type IN ('podium_overall', 'podium_age')
  LOOP
    podium_type := CASE WHEN rec.rd_type = 'podium_overall' THEN 'overall' ELSE 'age_group' END;

    INSERT INTO member_podium_rewards (member_id, race_id, race_result_id, podium_config_id, podium_type, rank, reward_description, cash_amount, status, created_at)
    SELECT
      rec.user_id,
      rr.race_id,
      rec.race_result_id,
      rpc.id,
      rpc.podium_type,
      rpc.rank,
      rpc.reward_description,
      rpc.cash_amount,
      rec.status,
      rec.created_at
    FROM race_results rr
    JOIN reward_podium_config rpc ON rpc.rank = rec.condition_value AND rpc.podium_type = podium_type
    WHERE rr.id = rec.race_result_id
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Podium backfill finished';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Podium backfill error: %', SQLERRM;
END $$;

-- 3) Aggressive backfill for milestones: map reward_definitions -> reward_milestones or create new milestone entries
DO $$
DECLARE
  rec RECORD;
  chosen_milestone_id UUID;
BEGIN
  FOR rec IN
    SELECT mr.id as member_reward_id, mr.user_id, mr.race_result_id, rd.id as rd_id, rd.category, rd.condition_value, rd.condition_label, rd.prize_description, rd.cash_amount, mr.status, mr.created_at
    FROM member_rewards mr
    JOIN reward_definitions rd ON rd.id = mr.reward_definition_id
    WHERE rd.type = 'milestone'
  LOOP
    -- Try to find an existing reward_milestones row matching category + time + prize
    SELECT id INTO chosen_milestone_id FROM reward_milestones
    WHERE race_type = rec.category AND time_seconds = rec.condition_value
    LIMIT 1;

    IF chosen_milestone_id IS NULL THEN
      -- Create a new milestone row derived from the reward_definition
      INSERT INTO reward_milestones (race_type, gender, milestone_name, time_seconds, reward_description, cash_amount, priority, is_active, created_at)
      VALUES (rec.category, NULL, COALESCE(rec.condition_label, 'Mốc chuyển đổi'), rec.condition_value, COALESCE(rec.prize_description, ''), COALESCE(rec.cash_amount, 0), COALESCE((SELECT COALESCE(MAX(priority),0)+1 FROM reward_milestones rm WHERE rm.race_type = rec.category), 1), TRUE, COALESCE(rec.created_at, NOW()))
      RETURNING id INTO chosen_milestone_id;
    END IF;

    -- Insert into member_milestone_rewards
    INSERT INTO member_milestone_rewards (member_id, race_id, race_result_id, milestone_id, achieved_time_seconds, reward_description, cash_amount, status, created_at)
    SELECT
      rec.user_id,
      rr.race_id,
      rec.race_result_id,
      chosen_milestone_id,
      rr.chip_time_seconds,
      (SELECT reward_description FROM reward_milestones WHERE id = chosen_milestone_id),
      (SELECT cash_amount FROM reward_milestones WHERE id = chosen_milestone_id),
      rec.status,
      rec.created_at
    FROM race_results rr
    WHERE rr.id = rec.race_result_id
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Milestone backfill finished';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Milestone backfill error: %', SQLERRM;
END $$;

-- 4) For remaining member_rewards rows not mapped above (other types), leave as-is for manual reconciliation
