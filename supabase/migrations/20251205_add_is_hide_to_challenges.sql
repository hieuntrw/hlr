-- Migration: add `is_hide` boolean column to `challenges` to support soft-hide (not shown publicly)
BEGIN;

ALTER TABLE IF EXISTS public.challenges
  ADD COLUMN IF NOT EXISTS is_hide boolean DEFAULT false;

-- Ensure existing rows are explicit
UPDATE public.challenges SET is_hide = false WHERE is_hide IS NULL;

COMMIT;
