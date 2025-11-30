-- Extend RLS policies to allow moderator roles to manage races/results and rewards delivery

-- races: allow mod_challenge to insert/update
CREATE POLICY IF NOT EXISTS "Mods create races"
  ON races FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mod_challenge')
    )
  );

CREATE POLICY IF NOT EXISTS "Mods update races"
  ON races FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mod_challenge')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mod_challenge')
    )
  );

-- race_results: allow mod_challenge to insert/update results for any user
CREATE POLICY IF NOT EXISTS "Mods insert race results"
  ON race_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mod_challenge')
    )
  );

CREATE POLICY IF NOT EXISTS "Mods update race results"
  ON race_results FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mod_challenge')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mod_challenge')
    )
  );

-- member_rewards: allow mod_member to read all and update status (delivery)
CREATE POLICY IF NOT EXISTS "Mods read all rewards"
  ON member_rewards FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mod_member')
    )
  );

CREATE POLICY IF NOT EXISTS "Mods update rewards"
  ON member_rewards FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mod_member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mod_member')
    )
  );
