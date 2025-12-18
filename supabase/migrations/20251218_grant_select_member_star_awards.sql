-- Migration: Grant SELECT to authenticated on member_star_awards
-- Date: 2025-12-18
-- Purpose: Allow authenticated sessions (subject to RLS) to perform SELECT on member_star_awards

GRANT SELECT ON public.member_star_awards TO authenticated;

-- Note: This grants table-level SELECT; RLS policies will still filter rows appropriately.
