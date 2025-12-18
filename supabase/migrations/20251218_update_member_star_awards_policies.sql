-- Migration: Update RLS for member_star_awards to include admin-like roles
-- Date: 2025-12-18
-- Purpose: Allow admin and moderator roles to SELECT star awards while keeping manage actions admin-only.

ALTER TABLE IF EXISTS member_star_awards ENABLE ROW LEVEL SECURITY;

-- Users can view their own star awards, admins and finance/mods can view all
DROP POLICY IF EXISTS "Users can view own star awards" ON member_star_awards;
CREATE POLICY "Users can view own star awards" ON member_star_awards
  FOR SELECT
  USING (
    (user_id = auth.uid()) OR
    ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_finance', 'mod_member'))
  );

-- Admins manage all actions on star awards
DROP POLICY IF EXISTS "Admin manage star awards" ON member_star_awards;
CREATE POLICY "Admin manage star awards" ON member_star_awards
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Note: apply with care in production. If you use a service_role key in your server
-- code the service client bypasses RLS entirely and is not affected by these policies.
