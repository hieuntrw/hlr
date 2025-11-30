-- Consolidated SQL Migration for HLR Running Club
-- Apply these migrations in order via Supabase Dashboard SQL Editor
-- Project: jvnpxcwjfidrlqlfmuvl
-- Date: 2025-11-30

-- =====================================================
-- Migration 2025113000: Add image_url to races
-- =====================================================
ALTER TABLE races ADD COLUMN IF NOT EXISTS image_url TEXT;

-- =====================================================
-- Migration 2025113002: Add receipt and audit columns
-- =====================================================
ALTER TABLE IF EXISTS public.transactions
ADD COLUMN IF NOT EXISTS receipt_url text,
ADD COLUMN IF NOT EXISTS receipt_uploaded_by uuid,
ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS paid_by uuid,
ADD COLUMN IF NOT EXISTS paid_at timestamptz,
ADD COLUMN IF NOT EXISTS rejected_by uuid,
ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON public.transactions (payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_receipt_uploaded_by ON public.transactions (receipt_uploaded_by);

-- =====================================================
-- Migration 2025113003: RLS for admin transaction updates
-- =====================================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_update_transactions ON public.transactions;
CREATE POLICY admin_update_transactions ON public.transactions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- =====================================================
-- Migration 2025113004: RLS for moderator roles on races/rewards
-- =====================================================

-- races: allow mod_challenge to insert/update
DROP POLICY IF EXISTS "Mods create races" ON races;
CREATE POLICY "Mods create races"
  ON races FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mod_challenge')
    )
  );

DROP POLICY IF EXISTS "Mods update races" ON races;
CREATE POLICY "Mods update races"
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
DROP POLICY IF EXISTS "Mods insert race results" ON race_results;
CREATE POLICY "Mods insert race results"
  ON race_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mod_challenge')
    )
  );

DROP POLICY IF EXISTS "Mods update race results" ON race_results;
CREATE POLICY "Mods update race results"
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
DROP POLICY IF EXISTS "Mods read all rewards" ON member_rewards;
CREATE POLICY "Mods read all rewards"
  ON member_rewards FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mod_member')
    )
  );

DROP POLICY IF EXISTS "Mods update rewards" ON member_rewards;
CREATE POLICY "Mods update rewards"
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

-- =====================================================
-- Migration 2025113005: Storage policies for race-banners
-- =====================================================

-- Policy: public can read objects in race-banners
DROP POLICY IF EXISTS "Public read race banners" ON storage.objects;
CREATE POLICY "Public read race banners"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'race-banners'
  );

-- Policy: admins and mod_challenge can insert/upload to race-banners
DROP POLICY IF EXISTS "Admins/mods upload race banners" ON storage.objects;
CREATE POLICY "Admins/mods upload race banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'race-banners' AND EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','mod_challenge')
    )
  );

-- Policy: allow delete/update by admins
DROP POLICY IF EXISTS "Admins manage race banners" ON storage.objects;
CREATE POLICY "Admins manage race banners"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'race-banners' AND EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin')
    )
  )
  WITH CHECK (
    bucket_id = 'race-banners' AND EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin')
    )
  );

-- =====================================================
-- Migration 2025113006: Link rewards to transactions
-- =====================================================
ALTER TABLE IF EXISTS transactions
  ADD COLUMN IF NOT EXISTS related_member_reward_id UUID REFERENCES member_rewards(id);

ALTER TABLE IF EXISTS member_rewards
  ADD COLUMN IF NOT EXISTS related_transaction_id UUID REFERENCES transactions(id);

-- =====================================================
-- Migration 2025113007: Add rejection_reason to transactions
-- =====================================================
ALTER TABLE IF EXISTS public.transactions
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- =====================================================
-- END OF CONSOLIDATED MIGRATIONS
-- =====================================================
