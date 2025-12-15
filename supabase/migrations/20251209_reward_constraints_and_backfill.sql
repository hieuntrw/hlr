-- Adds uniqueness constraints (via unique indexes) to prevent duplicate reward records
-- and a conservative backfill from legacy `member_rewards` into `member_milestone_rewards` where mapping can be inferred.

-- 1) Unique indexes to prevent double-awarding
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_rewards_unique ON member_rewards(user_id, race_result_id, reward_definition_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_milestone_unique ON member_milestone_rewards(member_id, milestone_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_podium_unique ON member_podium_rewards(member_id, race_result_id, podium_config_id);


-- 2) Conservative backfill: migrate applicable rows in `member_rewards` where the underlying
-- reward definition corresponds to a milestone defined in `reward_milestones`.
-- This attempts to map existing `member_rewards` into `member_milestone_rewards` when we can
-- determine the milestone by matching the reward_definition -> reward_milestones (via category + gender + time thresholds)
-- The insert uses ON CONFLICT DO NOTHING to avoid duplicates.

DO $$
BEGIN
  -- Insert candidate milestone rewards based on reward_definition linkage
  INSERT INTO member_milestone_rewards (member_id, race_id, race_result_id, milestone_id, achieved_time_seconds, reward_description, cash_amount, status, created_at)
  SELECT
    mr.user_id AS member_id,
    rr.race_id,
    mr.race_result_id,
    rm.id AS milestone_id,
    rr.chip_time_seconds AS achieved_time_seconds,
    rm.reward_description,
    rm.cash_amount,
    mr.status,
    mr.created_at
  FROM member_rewards mr
  JOIN reward_definitions rd ON rd.id = mr.reward_definition_id AND rd.type = 'milestone'
  JOIN race_results rr ON rr.id = mr.race_result_id
  JOIN profiles p ON p.id = mr.user_id
  -- Try to pick the most appropriate milestone row for this reward_def -> race result
  JOIN LATERAL (
    SELECT id, reward_description, cash_amount
    FROM reward_milestones
    WHERE reward_milestones.race_type = rd.category
      AND (reward_milestones.gender IS NULL OR reward_milestones.gender = p.gender)
      AND rr.chip_time_seconds <= reward_milestones.time_seconds
    ORDER BY reward_milestones.priority DESC NULLS LAST
    LIMIT 1
  ) rm ON true
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Backfill attempt finished for member_milestone_rewards';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error during backfill: %', SQLERRM;
END $$;

-- Note: This migration is intentionally conservative. It does not attempt to convert
-- all `member_rewards` rows (some reward_definitions may not map cleanly to milestone/podium tables).
-- Run application-level reconciliation later for remaining rows if needed.
