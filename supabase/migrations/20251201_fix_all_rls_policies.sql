-- Fix all RLS policies to use Auth metadata instead of profiles.role
-- This prevents infinite recursion errors across all tables

-- ========================================
-- CHALLENGES TABLE
-- ========================================
DROP POLICY IF EXISTS "Admins create challenges" ON challenges;
DROP POLICY IF EXISTS "Admins update challenges" ON challenges;
DROP POLICY IF EXISTS "Admins and mod_challenge can update challenges" ON challenges;

CREATE POLICY "Admins create challenges"
  ON challenges FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins and mod_challenge can update challenges"
  ON challenges FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_challenge')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_challenge')
  );

-- ========================================
-- CHALLENGE_PARTICIPANTS TABLE
-- ========================================
DROP POLICY IF EXISTS "Admins read all challenge participations" ON challenge_participants;
DROP POLICY IF EXISTS "Admins and mods read all challenge participations" ON challenge_participants;

CREATE POLICY "Admins and mods read all challenge participations"
  ON challenge_participants FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_challenge') OR
    user_id = auth.uid()
  );

-- ========================================
-- TRANSACTIONS TABLE
-- ========================================
DROP POLICY IF EXISTS "Admins read all transactions" ON transactions;
DROP POLICY IF EXISTS "Admins create transactions" ON transactions;
DROP POLICY IF EXISTS "Admins update transactions" ON transactions;
DROP POLICY IF EXISTS "Admins delete transactions" ON transactions;
DROP POLICY IF EXISTS "Admins and mod_finance read all transactions" ON transactions;
DROP POLICY IF EXISTS "Admins and mod_finance create transactions" ON transactions;
DROP POLICY IF EXISTS "Admins and mod_finance update transactions" ON transactions;

CREATE POLICY "Admins and mod_finance read all transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_finance') OR
    user_id = auth.uid()
  );

CREATE POLICY "Admins and mod_finance create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_finance')
  );

CREATE POLICY "Admins and mod_finance update transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_finance')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_finance')
  );

CREATE POLICY "Admins delete transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ========================================
-- RACES TABLE
-- ========================================
DROP POLICY IF EXISTS "Admins create races" ON races;
DROP POLICY IF EXISTS "Admins update races" ON races;
DROP POLICY IF EXISTS "Admins delete races" ON races;
DROP POLICY IF EXISTS "Admins and mod_challenge create races" ON races;
DROP POLICY IF EXISTS "Admins and mod_challenge update races" ON races;

CREATE POLICY "Admins and mod_challenge create races"
  ON races FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_challenge')
  );

CREATE POLICY "Admins and mod_challenge update races"
  ON races FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_challenge')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_challenge')
  );

CREATE POLICY "Admins delete races"
  ON races FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ========================================
-- RACE_RESULTS TABLE
-- ========================================
DROP POLICY IF EXISTS "Admins manage race results" ON race_results;
DROP POLICY IF EXISTS "Admins create race results" ON race_results;
DROP POLICY IF EXISTS "Admins update race results" ON race_results;
DROP POLICY IF EXISTS "Admins and mods create race results" ON race_results;
DROP POLICY IF EXISTS "Admins and mods update race results" ON race_results;
DROP POLICY IF EXISTS "Admins delete race results" ON race_results;

CREATE POLICY "Admins and mods create race results"
  ON race_results FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_challenge', 'mod_member')
  );

CREATE POLICY "Admins and mods update race results"
  ON race_results FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_challenge', 'mod_member')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_challenge', 'mod_member')
  );

CREATE POLICY "Admins delete race results"
  ON race_results FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ========================================
-- MEMBER_REWARDS TABLE
-- ========================================
DROP POLICY IF EXISTS "Admins manage rewards" ON member_rewards;
DROP POLICY IF EXISTS "Admins and mods manage rewards" ON member_rewards;

CREATE POLICY "Admins and mods manage rewards"
  ON member_rewards FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_member') OR
    user_id = auth.uid()
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_member')
  );

-- ========================================
-- PB_HISTORY TABLE
-- ========================================
DROP POLICY IF EXISTS "Admins manage pb_history" ON pb_history;
DROP POLICY IF EXISTS "Admins and mod_member manage pb_history" ON pb_history;

CREATE POLICY "Admins and mod_member manage pb_history"
  ON pb_history FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_member') OR
    user_id = auth.uid()
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_member') OR
    user_id = auth.uid()
  );
