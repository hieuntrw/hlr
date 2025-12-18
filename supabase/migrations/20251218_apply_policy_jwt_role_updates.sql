-- Migration: Update RLS policies to use JWT app_metadata role instead of profiles.role
-- Date: 2025-12-18
-- Applies ALTER POLICY for known policies that referenced profiles.role.

BEGIN;

-- Replace ALTER POLICY with DROP+CREATE using JWT app_metadata role checks.
-- All policies below are created FOR ALL to ensure INSERT/SELECT/UPDATE/DELETE semantics
-- use the same app_metadata role expression.

-- Helper note: verify these in staging before prod.

-- challenges
DROP POLICY IF EXISTS "Admins create challenges" ON challenges;
CREATE POLICY "Admins create challenges" ON challenges
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins update challenges" ON challenges;
CREATE POLICY "Admins update challenges" ON challenges
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- challenge_participants admin policies
DROP POLICY IF EXISTS "Admins read all challenge participations" ON challenge_participants;
CREATE POLICY "Admins read all challenge participations" ON challenge_participants
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins manage all participations" ON challenge_participants;
CREATE POLICY "Admins manage all participations" ON challenge_participants
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- transactions
DROP POLICY IF EXISTS "Admins read all transactions" ON transactions;
CREATE POLICY "Admins read all transactions" ON transactions
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins create transactions" ON transactions;
CREATE POLICY "Admins create transactions" ON transactions
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins update transactions" ON transactions;
CREATE POLICY "Admins update transactions" ON transactions
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- races
DROP POLICY IF EXISTS "Admins create races" ON races;
CREATE POLICY "Admins create races" ON races
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins update races" ON races;
CREATE POLICY "Admins update races" ON races
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- race_results admin policies
DROP POLICY IF EXISTS "Admins manage all results" ON race_results;
CREATE POLICY "Admins manage all results" ON race_results
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- reward_definitions
DROP POLICY IF EXISTS "Admin can manage reward definitions" ON reward_definitions;
CREATE POLICY "Admin can manage reward definitions" ON reward_definitions
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins manage reward definitions" ON reward_definitions;
CREATE POLICY "Admins manage reward definitions" ON reward_definitions
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- member_rewards/admin policies
DROP POLICY IF EXISTS "Admins update rewards" ON member_rewards;
CREATE POLICY "Admins update rewards" ON member_rewards
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins read all rewards" ON member_rewards;
CREATE POLICY "Admins read all rewards" ON member_rewards
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- pb_history
DROP POLICY IF EXISTS "Admins manage pb history" ON pb_history;
CREATE POLICY "Admins manage pb history" ON pb_history
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins read all pb history" ON pb_history;
CREATE POLICY "Admins read all pb history" ON pb_history
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins update pb history" ON pb_history;
CREATE POLICY "Admins update pb history" ON pb_history
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- theme & preferences
DROP POLICY IF EXISTS "Admins can manage theme presets" ON theme_presets;
CREATE POLICY "Admins can manage theme presets" ON theme_presets
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can read all activities" ON activities;
CREATE POLICY "Admins can read all activities" ON activities
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can update system theme settings" ON system_theme_settings;
CREATE POLICY "Admins can update system theme settings" ON system_theme_settings
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can view all theme preferences" ON user_theme_preferences;
CREATE POLICY "Admins can view all theme preferences" ON user_theme_preferences
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- storage objects (banners)
DROP POLICY IF EXISTS "Admin can upload race banners" ON storage.objects;
CREATE POLICY "Admin can upload race banners" ON storage.objects
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins manage race banners" ON storage.objects;
CREATE POLICY "Admins manage race banners" ON storage.objects
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins/mods upload race banners" ON storage.objects;
CREATE POLICY "Admins/mods upload race banners" ON storage.objects
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'));

-- Mods policies (allow admin+mods)
DROP POLICY IF EXISTS "Mods create races" ON races;
CREATE POLICY "Mods create races" ON races
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'));

DROP POLICY IF EXISTS "Mods insert race results" ON race_results;
CREATE POLICY "Mods insert race results" ON race_results
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'));

DROP POLICY IF EXISTS "Mods read all rewards" ON member_rewards;
CREATE POLICY "Mods read all rewards" ON member_rewards
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'));

DROP POLICY IF EXISTS "Mods update race results" ON race_results;
CREATE POLICY "Mods update race results" ON race_results
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'));

DROP POLICY IF EXISTS "Mods update races" ON races;
CREATE POLICY "Mods update races" ON races
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'));

DROP POLICY IF EXISTS "Mods update rewards" ON member_rewards;
CREATE POLICY "Mods update rewards" ON member_rewards
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'));

-- admin_update_transactions (explicit name)
DROP POLICY IF EXISTS admin_update_transactions ON transactions;
CREATE POLICY admin_update_transactions ON transactions
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

COMMIT;
