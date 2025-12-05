-- Migration: safe deprecation of `member_id` -> rename to `member_id_deprecated`
-- Approach:
-- 1. For each target table: if `member_id` exists, ensure `user_id` exists and is backfilled.
-- 2. Rename `member_id` -> `member_id_deprecated` (idempotent) so old data is preserved.
-- 3. Leave `member_id_deprecated` in place for manual verification and eventual drop.

BEGIN;

-- Helper: process each table in turn

-- member_milestone_rewards
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_milestone_rewards' AND column_name='member_id') THEN
    -- ensure user_id exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_milestone_rewards' AND column_name='user_id') THEN
      ALTER TABLE public.member_milestone_rewards ADD COLUMN user_id UUID;
    END IF;
    -- backfill user_id where missing
    EXECUTE 'UPDATE public.member_milestone_rewards SET user_id = member_id WHERE user_id IS NULL AND member_id IS NOT NULL';

    -- drop FK on member_id if exists (best effort), then rename
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name='member_milestone_rewards' AND column_name='member_id') THEN
        -- try to drop any fk constraint referencing member_id
        FOR c IN SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name='member_milestone_rewards' AND column_name='member_id' LOOP
          EXECUTE format('ALTER TABLE public.member_milestone_rewards DROP CONSTRAINT IF EXISTS %I', c.constraint_name);
        END LOOP;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- ignore
      NULL;
    END;

    -- rename column if not already renamed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_milestone_rewards' AND column_name='member_id_deprecated') THEN
      EXECUTE 'ALTER TABLE public.member_milestone_rewards RENAME COLUMN member_id TO member_id_deprecated';
    END IF;
  END IF;
END$$;

-- member_podium_rewards
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_podium_rewards' AND column_name='member_id') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_podium_rewards' AND column_name='user_id') THEN
      ALTER TABLE public.member_podium_rewards ADD COLUMN user_id UUID;
    END IF;
    EXECUTE 'UPDATE public.member_podium_rewards SET user_id = member_id WHERE user_id IS NULL AND member_id IS NOT NULL';

    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name='member_podium_rewards' AND column_name='member_id') THEN
        FOR c IN SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name='member_podium_rewards' AND column_name='member_id' LOOP
          EXECUTE format('ALTER TABLE public.member_podium_rewards DROP CONSTRAINT IF EXISTS %I', c.constraint_name);
        END LOOP;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_podium_rewards' AND column_name='member_id_deprecated') THEN
      EXECUTE 'ALTER TABLE public.member_podium_rewards RENAME COLUMN member_id TO member_id_deprecated';
    END IF;
  END IF;
END$$;

-- lucky_draw_winners
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lucky_draw_winners' AND column_name='member_id') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lucky_draw_winners' AND column_name='user_id') THEN
      ALTER TABLE public.lucky_draw_winners ADD COLUMN user_id UUID;
    END IF;
    EXECUTE 'UPDATE public.lucky_draw_winners SET user_id = member_id WHERE user_id IS NULL AND member_id IS NOT NULL';

    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name='lucky_draw_winners' AND column_name='member_id') THEN
        FOR c IN SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name='lucky_draw_winners' AND column_name='member_id' LOOP
          EXECUTE format('ALTER TABLE public.lucky_draw_winners DROP CONSTRAINT IF EXISTS %I', c.constraint_name);
        END LOOP;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lucky_draw_winners' AND column_name='member_id_deprecated') THEN
      EXECUTE 'ALTER TABLE public.lucky_draw_winners RENAME COLUMN member_id TO member_id_deprecated';
    END IF;
  END IF;
END$$;

-- member_rewards
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_rewards' AND column_name='member_id') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_rewards' AND column_name='user_id') THEN
      ALTER TABLE public.member_rewards ADD COLUMN user_id UUID;
    END IF;
    EXECUTE 'UPDATE public.member_rewards SET user_id = member_id WHERE user_id IS NULL AND member_id IS NOT NULL';

    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name='member_rewards' AND column_name='member_id') THEN
        FOR c IN SELECT constraint_name FROM information_schema.key_column_usage WHERE table_name='member_rewards' AND column_name='member_id' LOOP
          EXECUTE format('ALTER TABLE public.member_rewards DROP CONSTRAINT IF EXISTS %I', c.constraint_name);
        END LOOP;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_rewards' AND column_name='member_id_deprecated') THEN
      EXECUTE 'ALTER TABLE public.member_rewards RENAME COLUMN member_id TO member_id_deprecated';
    END IF;
  END IF;
END$$;

COMMIT;
