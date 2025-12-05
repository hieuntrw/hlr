-- Migration: add `user_id` aliases for tables using `member_id` and backfill values
-- This migration is idempotent: it will add `user_id` columns if missing and copy data from `member_id`.

BEGIN;

-- member_milestone_rewards
ALTER TABLE IF EXISTS public.member_milestone_rewards
  ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE public.member_milestone_rewards
SET user_id = member_id
WHERE user_id IS NULL AND member_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'member_milestone_rewards' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.member_milestone_rewards
      ADD CONSTRAINT fk_member_milestone_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- ignore if constraint exists concurrently
  NULL;
END$$;

CREATE INDEX IF NOT EXISTS idx_member_milestone_user ON public.member_milestone_rewards(user_id, status);

-- member_podium_rewards
ALTER TABLE IF EXISTS public.member_podium_rewards
  ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE public.member_podium_rewards
SET user_id = member_id
WHERE user_id IS NULL AND member_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'member_podium_rewards' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.member_podium_rewards
      ADD CONSTRAINT fk_member_podium_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END$$;

CREATE INDEX IF NOT EXISTS idx_member_podium_user ON public.member_podium_rewards(user_id, status);

-- lucky_draw_winners
ALTER TABLE IF EXISTS public.lucky_draw_winners
  ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE public.lucky_draw_winners
SET user_id = member_id
WHERE user_id IS NULL AND member_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'lucky_draw_winners' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.lucky_draw_winners
      ADD CONSTRAINT fk_lucky_draw_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END$$;

CREATE INDEX IF NOT EXISTS idx_lucky_draw_user ON public.lucky_draw_winners(user_id, status);

-- member_rewards
ALTER TABLE IF EXISTS public.member_rewards
  ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE public.member_rewards
SET user_id = member_id
WHERE user_id IS NULL AND member_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'member_rewards' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.member_rewards
      ADD CONSTRAINT fk_member_rewards_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END$$;

CREATE INDEX IF NOT EXISTS idx_member_rewards_user ON public.member_rewards(user_id, status);

COMMIT;
