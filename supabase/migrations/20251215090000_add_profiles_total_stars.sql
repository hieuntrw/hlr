-- Migration: add total_stars to profiles
-- Adds a simple integer counter for member star totals used by rewards

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS total_stars integer NOT NULL DEFAULT 0;

-- Index to allow fast ordering/lookup by star count (optional)
CREATE INDEX IF NOT EXISTS idx_profiles_total_stars ON public.profiles(total_stars);

COMMENT ON COLUMN public.profiles.total_stars IS 'Cached total stars awarded to the member (incremented by server-side reward logic)';
