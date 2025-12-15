-- Migration: remove unused columns from race_results and add podium_config_id
BEGIN;

ALTER TABLE IF EXISTS public.race_results
  DROP COLUMN IF EXISTS milestone_name,
  DROP COLUMN IF EXISTS age_group_rank,
  DROP COLUMN IF EXISTS official_rank,
  DROP COLUMN IF EXISTS category;

-- Add foreign key to reward_podium_config (podium config used for race results if admin selected)
ALTER TABLE IF EXISTS public.race_results
  ADD COLUMN IF NOT EXISTS podium_config_id uuid;

COMMIT;
