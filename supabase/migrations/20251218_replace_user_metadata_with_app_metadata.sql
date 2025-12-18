-- Migration: Replace remaining policies referencing user_metadata with app_metadata
-- Date: 2025-12-18

BEGIN;

-- lucky_draw_winners
DROP POLICY IF EXISTS "Admin can manage lucky draw" ON lucky_draw_winners;
CREATE POLICY "Admin can manage lucky draw" ON lucky_draw_winners
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admin manage lucky draw" ON lucky_draw_winners;
CREATE POLICY "Admin manage lucky draw" ON lucky_draw_winners
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_member'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_member'));

DROP POLICY IF EXISTS "Members view own lucky draw" ON lucky_draw_winners;
CREATE POLICY "Members view own lucky draw" ON lucky_draw_winners
  FOR SELECT
  USING ((member_id = uid()) OR ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_member')));

DROP POLICY IF EXISTS "Users can view own lucky draw wins" ON lucky_draw_winners;
CREATE POLICY "Users can view own lucky draw wins" ON lucky_draw_winners
  FOR SELECT
  USING ((member_id = uid()) OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));


-- member_milestone_rewards
DROP POLICY IF EXISTS "Admin can manage milestone rewards" ON member_milestone_rewards;
CREATE POLICY "Admin can manage milestone rewards" ON member_milestone_rewards
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admin manage milestone rewards" ON member_milestone_rewards;
CREATE POLICY "Admin manage milestone rewards" ON member_milestone_rewards
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_member'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_member'));

DROP POLICY IF EXISTS "Members view own milestone rewards" ON member_milestone_rewards;
CREATE POLICY "Members view own milestone rewards" ON member_milestone_rewards
  FOR SELECT
  USING ((member_id = uid()) OR ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_member')));

DROP POLICY IF EXISTS "Users can view own milestone rewards" ON member_milestone_rewards;
CREATE POLICY "Users can view own milestone rewards" ON member_milestone_rewards
  FOR SELECT
  USING ((member_id = uid()) OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));


-- member_podium_rewards
DROP POLICY IF EXISTS "Admin can manage podium rewards" ON member_podium_rewards;
CREATE POLICY "Admin can manage podium rewards" ON member_podium_rewards
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admin manage podium rewards" ON member_podium_rewards;
CREATE POLICY "Admin manage podium rewards" ON member_podium_rewards
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_member','mod_challenge'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_member','mod_challenge'));

DROP POLICY IF EXISTS "Members view own podium rewards" ON member_podium_rewards;
CREATE POLICY "Members view own podium rewards" ON member_podium_rewards
  FOR SELECT
  USING ((member_id = uid()) OR ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_member')));

DROP POLICY IF EXISTS "Users can view own podium rewards" ON member_podium_rewards;
CREATE POLICY "Users can view own podium rewards" ON member_podium_rewards
  FOR SELECT
  USING ((member_id = uid()) OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));


-- profiles
DROP POLICY IF EXISTS "Admins and mods can read all profiles" ON profiles;
CREATE POLICY "Admins and mods can read all profiles" ON profiles
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_finance','mod_challenge','mod_member'));

DROP POLICY IF EXISTS "Admins and mods can update profiles" ON profiles;
CREATE POLICY "Admins and mods can update profiles" ON profiles
  FOR UPDATE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_member'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_member'));

DROP POLICY IF EXISTS "Admins can insert any profile" ON profiles;
CREATE POLICY "Admins can insert any profile" ON profiles
  FOR INSERT
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');


-- reward_milestones
DROP POLICY IF EXISTS "Admin can manage milestones" ON reward_milestones;
CREATE POLICY "Admin can manage milestones" ON reward_milestones
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');


-- reward_podium_config
DROP POLICY IF EXISTS "Admin can manage podium config" ON reward_podium_config;
CREATE POLICY "Admin can manage podium config" ON reward_podium_config
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admin manage podium config" ON reward_podium_config;
CREATE POLICY "Admin manage podium config" ON reward_podium_config
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

COMMIT;
