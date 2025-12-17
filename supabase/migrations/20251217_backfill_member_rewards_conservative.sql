-- Conservative, idempotent backfill for legacy `member_rewards`.
-- Date: 2025-12-17
-- Goal: Move clear, mappable legacy rows into `member_milestone_rewards` while
-- leaving `member_rewards.reward_definition_id` rows untouched (those are used
-- for lucky-draw definitions per project decision).
-- This script is safe to run multiple times.

DO $$
DECLARE
  migrated_count INTEGER := 0;
BEGIN
  -- 1) Insert into member_milestone_rewards for legacy rows that reference a race_result
  -- and do not reference a reward_definition (we assume these are milestone/podium related)
  WITH candidates AS (
    SELECT mr.id as legacy_id, mr.user_id, mr.race_result_id, mr.created_at
    FROM member_rewards mr
    WHERE mr.race_result_id IS NOT NULL
      AND mr.reward_definition_id IS NULL
  ), to_insert AS (
    SELECT c.legacy_id, c.user_id, c.race_result_id
    FROM candidates c
    LEFT JOIN member_milestone_rewards mmr ON mmr.race_result_id = c.race_result_id
    WHERE mmr.id IS NULL -- only insert when no existing mapping
  )
  INSERT INTO member_milestone_rewards (member_id, race_id, race_result_id, milestone_id, achieved_time_seconds, reward_description, cash_amount, status, created_at)
  SELECT
    ti.user_id,
    rr.race_id,
    ti.race_result_id,
    NULL::UUID, -- unknown milestone_id: keep NULL for manual reconciliation
    NULL::INTEGER,
    'Migrated from legacy member_rewards (needs review)',
    0,
    'pending',
    NOW()
  FROM to_insert ti
  JOIN race_results rr ON rr.id = ti.race_result_id
  ON CONFLICT DO NOTHING
  RETURNING id INTO migrated_count;

  RAISE NOTICE 'Inserted % milestones from legacy member_rewards', COALESCE(migrated_count, 0);

  -- 2) Notes / manual reconciliation guidance
  RAISE NOTICE 'Conservative backfill finished. Rows with reward_definition_id were NOT migrated (reserved for lucky-draw).\nReview inserted member_milestone_rewards (milestone_id=NULL) and fill milestone_id/achieved_time_seconds as appropriate.';
END$$;

-- Verification helpers (run after migration manually):
-- SELECT count(*) FROM member_rewards WHERE race_result_id IS NOT NULL AND reward_definition_id IS NULL;
-- SELECT count(*) FROM member_milestone_rewards WHERE created_at >= now() - interval '1 hour' ORDER BY created_at DESC;

-- Important: This script intentionally does NOT try to interpret reward_definition_id rows.
-- Those legacy rows should be handled by mapping them to lucky_draw_winners or keeping them
-- in `member_rewards` for historical accuracy depending on your chosen migration strategy.
