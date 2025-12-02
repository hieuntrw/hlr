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
-- Migration 20251201: Create Reward System
-- =====================================================
-- Quản lý 3 loại quà tặng: quay số may mắn, mốc thành tích FM/HM, đứng bục

-- 1. Bảng cấu hình mốc thành tích FM/HM (có thể thay đổi)
CREATE TABLE IF NOT EXISTS reward_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_type VARCHAR(10) NOT NULL CHECK (race_type IN ('FM', 'HM')),
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
  milestone_name VARCHAR(50) NOT NULL,
  time_seconds INTEGER NOT NULL,
  reward_description TEXT NOT NULL,
  cash_amount INTEGER DEFAULT 0,
  priority INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_milestones_race_gender ON reward_milestones(race_type, gender, is_active);

-- 2. Bảng tracking mốc thành tích thành viên đã đạt
CREATE TABLE IF NOT EXISTS member_milestone_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  race_result_id UUID NOT NULL REFERENCES race_results(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES reward_milestones(id) ON DELETE CASCADE,
  achieved_time_seconds INTEGER NOT NULL,
  reward_description TEXT NOT NULL,
  cash_amount INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'delivered', 'rejected')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, milestone_id)
);

CREATE INDEX IF NOT EXISTS idx_member_milestone_member ON member_milestone_rewards(member_id, status);
CREATE INDEX IF NOT EXISTS idx_member_milestone_race ON member_milestone_rewards(race_id);

-- 3. Bảng cấu hình phần thưởng đứng bục (có thể thay đổi)
CREATE TABLE IF NOT EXISTS reward_podium_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  podium_type VARCHAR(20) NOT NULL CHECK (podium_type IN ('overall', 'age_group')),
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  reward_description TEXT NOT NULL,
  cash_amount INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(podium_type, rank)
);

-- 4. Bảng tracking phần thưởng đứng bục (nhận nhiều lần)
CREATE TABLE IF NOT EXISTS member_podium_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  race_result_id UUID NOT NULL REFERENCES race_results(id) ON DELETE CASCADE,
  podium_config_id UUID NOT NULL REFERENCES reward_podium_config(id) ON DELETE CASCADE,
  podium_type VARCHAR(20) NOT NULL,
  rank INTEGER NOT NULL,
  reward_description TEXT NOT NULL,
  cash_amount INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'delivered', 'rejected')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_podium_member ON member_podium_rewards(member_id, status);
CREATE INDEX IF NOT EXISTS idx_member_podium_race ON member_podium_rewards(race_id);

-- 5. Bảng quà tặng quay số may mắn (2 người/tháng hoàn thành thử thách)
CREATE TABLE IF NOT EXISTS lucky_draw_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_description TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
  delivered_at TIMESTAMPTZ,
  delivered_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lucky_draw_challenge ON lucky_draw_winners(challenge_id);
CREATE INDEX IF NOT EXISTS idx_lucky_draw_member ON lucky_draw_winners(member_id, status);
/*
-- Insert dữ liệu mặc định cho mốc thành tích FM nam
INSERT INTO reward_milestones (race_type, gender, milestone_name, time_seconds, reward_description, cash_amount, priority)
VALUES
    ('FM', 'male', 'SUB245', 9900, 'KNC đặc biệt + 2tr', 2000000, 7),
  ('FM', 'male', 'SUB300', 10800, 'KNC đặc biệt + 1tr5', 1500000, 6),
  ('FM', 'male', 'SUB315', 11700, 'KNC đặc biệt + 1tr', 1000000, 5),
  ('FM', 'male', 'SUB330', 12600, 'Bảng gỗ + 500k', 500000, 4),
  ('FM', 'male', 'SUB345', 13500, 'Bảng gỗ', 0, 3),
  ('FM', 'male', 'SUB400', 14400, 'KNC khung kính A5', 0, 2),
  ('FM', 'male', 'Lần đầu hoàn thành', 999999, 'KNC A5 lần đầu', 0, 1)
ON CONFLICT DO NOTHING;

-- Insert dữ liệu mặc định cho mốc thành tích FM nữ
INSERT INTO reward_milestones (race_type, gender, milestone_name, time_seconds, reward_description, cash_amount, priority)
VALUES
  ('FM', 'female', 'SUB300', 10800, 'KNC đặc biệt + 2tr', 2000000, 7),
  ('FM', 'female', 'SUB315', 11700, 'KNC đặc biệt + 1tr5', 1500000, 6),
  ('FM', 'female', 'SUB330', 12600, 'KNC đặc biệt + 1tr', 1000000, 5),
  ('FM', 'female', 'SUB345', 13500, 'Bảng gỗ + 500k', 500000, 4),
  ('FM', 'female', 'SUB400', 14400, 'Bảng gỗ', 0, 3),
  ('FM', 'female', 'SUB415', 15300, 'KNC khung kính A5', 0, 2),
  ('FM', 'female', 'Lần đầu hoàn thành', 999999, 'KNC khung kính A5', 0, 1)
ON CONFLICT DO NOTHING;

-- Insert dữ liệu mặc định cho mốc thành tích HM nam
INSERT INTO reward_milestones (race_type, gender, milestone_name, time_seconds, reward_description, cash_amount, priority)
VALUES
    ('HM', 'female', 'SUB215', 8100, 'KNC khung kính A5', 0, 1),
  ('HM', 'female', 'SUB200', 7200, 'Cúp pha lê', 0, 2),
  ('HM', 'female', 'SUB145', 6300, 'Bảng gỗ', 0, 3),
  ('HM', 'female', 'SUB130', 5400, 'Bảng gỗ + 500k', 500000, 4),
  ('HM', 'female', 'SUB115', 4500, 'KNC đặc biệt + 1tr', 1000000, 5),
  ('HM', 'female', 'SUB110', 4200, 'KNC đặc biệt + 1tr5', 1500000, 6)
ON CONFLICT DO NOTHING;

-- Insert dữ liệu mặc định cho mốc thành tích HM nữ
INSERT INTO reward_milestones (race_type, gender, milestone_name, time_seconds, reward_description, cash_amount, priority)
VALUES
  ('HM', 'male', 'SUB200', 7200, 'KNC khung kính A5', 0, 1),
  ('HM', 'male', 'SUB145', 6300, 'Cúp pha lê', 0, 2),
  ('HM', 'male', 'SUB130', 5400, 'Bảng gỗ', 0, 3),
  ('HM', 'male', 'SUB115', 4500, 'Bảng gỗ + 500k', 500000, 4),
  ('HM', 'male', 'SUB110', 4200, 'KNC đặc biệt + 1tr', 1000000, 5),
  ('HM', 'male', 'SUB105', 3900, 'KNC đặc biệt + 1tr5', 1500000, 6)
ON CONFLICT DO NOTHING;

-- Insert dữ liệu mặc định cho phần thưởng đứng bục
INSERT INTO reward_podium_config (podium_type, rank, reward_description, cash_amount)
VALUES
  ('overall', 1, 'Kỉ niệm chương đặc biệt + 1tr', 1000000),
  ('overall', 2, 'Kỉ niệm chương đặc biệt + 2tr', 2000000),
  ('overall', 3, 'Kỉ niệm chương đặc biệt + 3tr', 3000000),
  ('age_group', 1, 'Kỉ niệm chương đặc biệt + 500k', 500000),
  ('age_group', 2, 'Kỉ niệm chương đặc biệt + 1tr', 1000000),
  ('age_group', 3, 'Kỉ niệm chương đặc biệt + 1tr5', 1500000)
ON CONFLICT DO NOTHING;
*/
-- RLS policies cho bảng reward_milestones (public read, admin manage)
ALTER TABLE reward_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active milestones" ON reward_milestones;
CREATE POLICY "Public can view active milestones" ON reward_milestones FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admin can manage milestones" ON reward_milestones;
CREATE POLICY "Admin can manage milestones" ON reward_milestones FOR ALL TO authenticated
USING ((auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin')
WITH CHECK ((auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin');

-- RLS policies cho member_milestone_rewards
ALTER TABLE member_milestone_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view own milestone rewards" ON member_milestone_rewards;
CREATE POLICY "Members view own milestone rewards" ON member_milestone_rewards FOR SELECT TO authenticated
USING (member_id = auth.uid() OR (auth.jwt()->>'user_metadata')::jsonb->>'role' IN ('admin', 'mod_member'));

DROP POLICY IF EXISTS "Admin manage milestone rewards" ON member_milestone_rewards;
CREATE POLICY "Admin manage milestone rewards" ON member_milestone_rewards FOR ALL TO authenticated
USING ((auth.jwt()->>'user_metadata')::jsonb->>'role' IN ('admin', 'mod_member'))
WITH CHECK ((auth.jwt()->>'user_metadata')::jsonb->>'role' IN ('admin', 'mod_member'));

-- RLS policies cho reward_podium_config
ALTER TABLE reward_podium_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view podium config" ON reward_podium_config;
CREATE POLICY "Public can view podium config" ON reward_podium_config FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admin manage podium config" ON reward_podium_config;
CREATE POLICY "Admin manage podium config" ON reward_podium_config FOR ALL TO authenticated
USING ((auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin')
WITH CHECK ((auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin');

-- RLS policies cho member_podium_rewards
ALTER TABLE member_podium_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view own podium rewards" ON member_podium_rewards;
CREATE POLICY "Members view own podium rewards" ON member_podium_rewards FOR SELECT TO authenticated
USING (member_id = auth.uid() OR (auth.jwt()->>'user_metadata')::jsonb->>'role' IN ('admin', 'mod_member'));

DROP POLICY IF EXISTS "Admin manage podium rewards" ON member_podium_rewards;
CREATE POLICY "Admin manage podium rewards" ON member_podium_rewards FOR ALL TO authenticated
USING ((auth.jwt()->>'user_metadata')::jsonb->>'role' IN ('admin', 'mod_member', 'mod_challenge'))
WITH CHECK ((auth.jwt()->>'user_metadata')::jsonb->>'role' IN ('admin', 'mod_member', 'mod_challenge'));

-- RLS policies cho lucky_draw_winners
ALTER TABLE lucky_draw_winners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view own lucky draw" ON lucky_draw_winners;
CREATE POLICY "Members view own lucky draw" ON lucky_draw_winners FOR SELECT TO authenticated
USING (member_id = auth.uid() OR (auth.jwt()->>'user_metadata')::jsonb->>'role' IN ('admin', 'mod_member'));

DROP POLICY IF EXISTS "Admin manage lucky draw" ON lucky_draw_winners;
CREATE POLICY "Admin manage lucky draw" ON lucky_draw_winners FOR ALL TO authenticated
USING ((auth.jwt()->>'user_metadata')::jsonb->>'role' IN ('admin', 'mod_member'))
WITH CHECK ((auth.jwt()->>'user_metadata')::jsonb->>'role' IN ('admin', 'mod_member'));

-- =====================================================
-- Migration 20251201: Auto-award milestone on approved PB
-- =====================================================

-- Add columns to race_results to support approval and milestone annotation
ALTER TABLE race_results
  ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS category VARCHAR(2) CHECK (category IN ('HM','FM')),
  ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES reward_milestones(id),
  ADD COLUMN IF NOT EXISTS milestone_name TEXT;

-- Derive category from distance on insert/update if not provided
CREATE OR REPLACE FUNCTION derive_category_from_distance(distance_text TEXT)
RETURNS VARCHAR AS $$
BEGIN
  IF distance_text ILIKE '21%' THEN
    RETURN 'HM';
  ELSIF distance_text ILIKE '42%' THEN
    RETURN 'FM';
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION race_results_set_category()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category IS NULL THEN
    NEW.category := derive_category_from_distance(NEW.distance);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_race_results_set_category ON race_results;
CREATE TRIGGER trg_race_results_set_category
BEFORE INSERT OR UPDATE ON race_results
FOR EACH ROW
EXECUTE FUNCTION race_results_set_category();

-- Auto-evaluate milestones when a result is approved and is PR
CREATE OR REPLACE FUNCTION auto_award_milestone()
RETURNS TRIGGER AS $$
DECLARE
  v_gender TEXT;
  v_member UUID;
  v_milestone RECORD;
BEGIN
  -- Only process when approved and is_pr true and category is HM/FM
  IF NEW.approved IS DISTINCT FROM TRUE OR NEW.is_pr IS DISTINCT FROM TRUE OR NEW.category IS NULL THEN
    RETURN NEW;
  END IF;

  v_member := NEW.user_id;

  -- Get gender from profiles
  SELECT gender INTO v_gender FROM profiles WHERE id = v_member;
  IF v_gender IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find highest active milestone matching category + gender and time threshold
  SELECT * INTO v_milestone
  FROM reward_milestones m
  WHERE m.is_active = TRUE
    AND m.race_type = NEW.category
    AND m.gender = v_gender
    AND (
      NEW.chip_time_seconds <= m.time_seconds OR m.milestone_name ILIKE 'Lần đầu%'
    )
  ORDER BY m.priority DESC
  LIMIT 1;

  IF v_milestone IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if member already received this milestone
  IF EXISTS (
    SELECT 1 FROM member_milestone_rewards
    WHERE member_id = v_member AND milestone_id = v_milestone.id
  ) THEN
    -- Already awarded, just annotate race result
    UPDATE race_results
    SET milestone_id = v_milestone.id,
        milestone_name = v_milestone.milestone_name
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- Insert milestone reward (pending)
  INSERT INTO member_milestone_rewards (
    member_id, race_id, race_result_id, milestone_id,
    achieved_time_seconds, reward_description, cash_amount, status
  ) VALUES (
    v_member, NEW.race_id, NEW.id, v_milestone.id,
    NEW.chip_time_seconds, v_milestone.reward_description, COALESCE(v_milestone.cash_amount, 0), 'pending'
  );

  -- Annotate the race result with milestone info
  UPDATE race_results
  SET milestone_id = v_milestone.id,
      milestone_name = v_milestone.milestone_name
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_award_milestone ON race_results;
CREATE TRIGGER trg_auto_award_milestone
AFTER INSERT OR UPDATE ON race_results
FOR EACH ROW
EXECUTE FUNCTION auto_award_milestone();

-- =====================================================
-- Migration 20251202: Add gender to profiles
-- =====================================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('male', 'female'));

CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender) WHERE gender IS NOT NULL;

COMMENT ON COLUMN profiles.gender IS 'Member gender for milestone reward calculation (male/female)';

-- =====================================================
-- Migration 20251202: Remove password from profiles
-- =====================================================
-- Authentication now exclusively through Supabase Auth (Strava OAuth)
ALTER TABLE profiles DROP COLUMN IF EXISTS password;

-- =====================================================
-- END OF CONSOLIDATED MIGRATIONS
-- =====================================================
