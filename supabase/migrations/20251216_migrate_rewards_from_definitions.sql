-- Migration: Backfill legacy member_rewards (reward_definitions) into specialized tables
-- Date: 2025-12-16
-- IMPORTANT: This migration is idempotent and emits NOTICEs for verification.
BEGIN;

-- Safety checks
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reward_definitions') THEN
    RAISE NOTICE 'Skipping migration: table reward_definitions does not exist.';
    RETURN;
  END IF;
END$$;

-- 1) Podium backfill: map legacy member_rewards -> member_podium_rewards
DO $$
DECLARE
  rec RECORD;
  podium_type TEXT;
  inserted_count INT := 0;
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
      COALESCE(rpc.reward_description, rec.prize_description),
      COALESCE(rpc.cash_amount, rec.cash_amount, 0),
      rec.status,
      rec.created_at
    FROM race_results rr
    JOIN reward_podium_config rpc ON rpc.rank = rec.condition_value AND rpc.podium_type = podium_type
    WHERE rr.id = rec.race_result_id
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
  END LOOP;

  RAISE NOTICE 'Podium backfill finished (attempted rows matched existing configs).';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Podium backfill error: %', SQLERRM;
END $$;

-- 2) Milestone backfill: map legacy member_rewards -> reward_milestones and member_milestone_rewards
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
    -- Find existing matching milestone by race_type and time_seconds
    SELECT id INTO chosen_milestone_id FROM reward_milestones
    WHERE race_type = rec.category AND time_seconds = rec.condition_value
    LIMIT 1;

    IF chosen_milestone_id IS NULL THEN
      -- Create a new milestone row derived from the reward_definition (idempotent by unique constraint if present)
      INSERT INTO reward_milestones (race_type, gender, milestone_name, time_seconds, reward_description, cash_amount, priority, is_active, created_at)
      VALUES (rec.category, NULL, COALESCE(rec.condition_label, 'Migrated milestone'), rec.condition_value, COALESCE(rec.prize_description, ''), COALESCE(rec.cash_amount, 0), COALESCE((SELECT COALESCE(MAX(priority),0)+1 FROM reward_milestones rm WHERE rm.race_type = rec.category), 1), TRUE, COALESCE(rec.created_at, NOW()))
      RETURNING id INTO chosen_milestone_id;
    END IF;

    -- Insert mapping into member_milestone_rewards
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

-- 3) Summary counts for verification
DO $$
DECLARE
  cnt_member_rewards INTEGER;
  cnt_podium INTEGER;
  cnt_milestone INTEGER;
BEGIN
  SELECT count(*) INTO cnt_member_rewards FROM member_rewards WHERE reward_definition_id IS NOT NULL;
  SELECT count(*) INTO cnt_podium FROM member_podium_rewards;
  SELECT count(*) INTO cnt_milestone FROM member_milestone_rewards;

  RAISE NOTICE 'Verification counts: legacy member_rewards with reward_definition_id=%; member_podium_rewards_total=%; member_milestone_rewards_total=%', cnt_member_rewards, cnt_podium, cnt_milestone;
END $$;

-- 4) OPTIONAL: rename legacy table (do NOT drop automatically)
-- Recommended manual step after verification: ALTER TABLE reward_definitions RENAME TO reward_definitions_deprecated;

COMMIT;

-- End migration
