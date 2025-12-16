-- Migration: Recreate `category` column on race_results and auto-populate from `distance`
-- Date: 2025-12-16

BEGIN;

-- 1) Add nullable category column (text)
ALTER TABLE IF EXISTS public.race_results
  ADD COLUMN IF NOT EXISTS category TEXT;


-- 3) Create (or replace) trigger function to set category from distance
CREATE OR REPLACE FUNCTION public.set_race_results_category()
RETURNS trigger AS $$
BEGIN
  IF NEW.distance IS NOT NULL THEN
    -- Normalize common formats: '21km', '42km', 'HM', 'FM'
    IF NEW.distance::text ~* '^\s*21' OR NEW.distance::text ILIKE '%21km%' OR upper(NEW.distance::text) = 'HM' THEN
      NEW.category := 'HM';
    ELSIF NEW.distance::text ~* '^\s*42' OR NEW.distance::text ILIKE '%42km%' OR upper(NEW.distance::text) = 'FM' THEN
      NEW.category := 'FM';
    ELSE
      NEW.category := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 4) Create trigger to run before insert or update
DROP TRIGGER IF EXISTS trg_set_race_results_category ON public.race_results;
CREATE TRIGGER trg_set_race_results_category
BEFORE INSERT OR UPDATE ON public.race_results
FOR EACH ROW EXECUTE FUNCTION public.set_race_results_category();

-- 5) Backfill existing rows based on current distance values
UPDATE public.race_results
SET category = CASE
  WHEN distance::text ~* '^\s*21' OR distance::text ILIKE '%21km%' OR upper(distance::text) = 'HM' THEN 'HM'
  WHEN distance::text ~* '^\s*42' OR distance::text ILIKE '%42km%' OR upper(distance::text) = 'FM' THEN 'FM'
  ELSE NULL
END
WHERE category IS DISTINCT FROM (
  CASE
    WHEN distance::text ~* '^\s*21' OR distance::text ILIKE '%21km%' OR upper(distance::text) = 'HM' THEN 'HM'
    WHEN distance::text ~* '^\s*42' OR distance::text ILIKE '%42km%' OR upper(distance::text) = 'FM' THEN 'FM'
    ELSE NULL
  END
);

COMMIT;
