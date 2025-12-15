-- Migration: Create comprehensive reward system
-- Date: 2024-12-01
-- Description: Quản lý 3 loại quà tặng: quay số may mắn, mốc thành tích FM/HM, đứng bục

-- 1. Bảng cấu hình mốc thành tích FM/HM (có thể thay đổi)
CREATE TABLE IF NOT EXISTS reward_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_type VARCHAR(10) NOT NULL CHECK (race_type IN ('FM', 'HM')), -- Full Marathon hoặc Half Marathon
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
  milestone_name VARCHAR(50) NOT NULL, -- VD: "SUB415", "SUB400", "Lần đầu hoàn thành"
  time_seconds INTEGER NOT NULL, -- Thời gian mốc tính bằng giây (VD: 415*60 = 24900)
  reward_description TEXT NOT NULL, -- VD: "KNC khung kính A5", "Cúp pha lê + 500k"
  cash_amount INTEGER DEFAULT 0, -- Số tiền mặt (VNĐ)
  priority INTEGER NOT NULL, -- Độ ưu tiên cao hơn = mốc cao hơn (để chỉ nhận 1 lần mốc cao nhất)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index cho tìm kiếm nhanh
CREATE INDEX idx_reward_milestones_race_gender ON reward_milestones(race_type, gender, is_active);

-- 2. Bảng tracking mốc thành tích thành viên đã đạt
CREATE TABLE IF NOT EXISTS member_milestone_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  race_result_id UUID NOT NULL REFERENCES race_results(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES reward_milestones(id) ON DELETE CASCADE,
  achieved_time_seconds INTEGER NOT NULL, -- Thời gian thực tế đạt được
  reward_description TEXT NOT NULL,
  cash_amount INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'delivered', 'rejected')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, milestone_id) -- Mỗi member chỉ nhận 1 lần cho mỗi mốc
);

CREATE INDEX idx_member_milestone_member ON member_milestone_rewards(member_id, status);
CREATE INDEX idx_member_milestone_race ON member_milestone_rewards(race_id);

-- 3. Bảng cấu hình phần thưởng đứng bục (có thể thay đổi)
CREATE TABLE IF NOT EXISTS reward_podium_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  podium_type VARCHAR(20) NOT NULL CHECK (podium_type IN ('overall', 'age_group')), -- Chung cuộc hoặc lứa tuổi
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3), -- Top 1, 2, 3
  reward_description TEXT NOT NULL, -- VD: "Kỉ niệm chương đặc biệt"
  cash_amount INTEGER NOT NULL, -- Số tiền mặt
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

CREATE INDEX idx_member_podium_member ON member_podium_rewards(member_id, status);
CREATE INDEX idx_member_podium_race ON member_podium_rewards(race_id);

-- 5. Bảng quà tặng quay số may mắn (2 người/tháng hoàn thành thử thách)
CREATE TABLE IF NOT EXISTS lucky_draw_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_description TEXT NOT NULL, -- Mô tả quà tặng
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
  delivered_at TIMESTAMPTZ,
  delivered_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lucky_draw_challenge ON lucky_draw_winners(challenge_id);
CREATE INDEX idx_lucky_draw_member ON lucky_draw_winners(member_id, status);

-- Insert dữ liệu mặc định cho mốc thành tích FM
INSERT INTO reward_milestones (race_type, gender, milestone_name, time_seconds, reward_description, cash_amount, priority) VALUES
-- FM Nam
('FM', 'male', 'Lần đầu hoàn thành', 999999, 'KNC khung kính A5', 0, 1),
('FM', 'male', 'SUB400', 400*60, 'Cúp pha lê', 0, 2),
('FM', 'male', 'SUB345', 345*60, 'Bảng gỗ', 0, 3),
('FM', 'male', 'SUB330', 330*60, 'Bảng gỗ + 500k', 500000, 4),
('FM', 'male', 'SUB315', 315*60, 'KNC đặc biệt + 1tr', 1000000, 5),
('FM', 'male', 'SUB300', 300*60, 'KNC đặc biệt + 1tr5', 1500000, 6),
('FM', 'male', 'SUB245', 245*60, 'KNC đặc biệt + 2tr', 2000000, 7),

-- FM Nữ
('FM', 'female', 'Lần đầu hoàn thành', 999999, 'KNC khung kính A5', 0, 1),
('FM', 'female', 'SUB415', 415*60, 'Cúp pha lê', 0, 2),
('FM', 'female', 'SUB400', 400*60, 'Bảng gỗ', 0, 3),
('FM', 'female', 'SUB345', 345*60, 'Bảng gỗ + 500k', 500000, 4),
('FM', 'female', 'SUB330', 330*60, 'KNC đặc biệt + 1tr', 1000000, 5),
('FM', 'female', 'SUB315', 315*60, 'KNC đặc biệt + 1tr5', 1500000, 6),
('FM', 'female', 'SUB300', 300*60, 'KNC đặc biệt + 2tr', 2000000, 7),

-- HM Nam
('HM', 'male', 'SUB200', 200*60, 'KNC khung kính A5', 0, 1),
('HM', 'male', 'SUB145', 145*60, 'Cúp pha lê', 0, 2),
('HM', 'male', 'SUB130', 130*60, 'Bảng gỗ', 0, 3),
('HM', 'male', 'SUB115', 115*60, 'Bảng gỗ + 500k', 500000, 4),
('HM', 'male', 'SUB110', 110*60, 'KNC đặc biệt + 1tr', 1000000, 5),
('HM', 'male', 'SUB105', 105*60, 'KNC đặc biệt + 1tr5', 1500000, 6),

-- HM Nữ
('HM', 'female', 'SUB215', 215*60, 'KNC khung kính A5', 0, 1),
('HM', 'female', 'SUB200', 200*60, 'Cúp pha lê', 0, 2),
('HM', 'female', 'SUB145', 145*60, 'Bảng gỗ', 0, 3),
('HM', 'female', 'SUB130', 130*60, 'Bảng gỗ + 500k', 500000, 4),
('HM', 'female', 'SUB115', 115*60, 'KNC đặc biệt + 1tr', 1000000, 5),
('HM', 'female', 'SUB110', 110*60, 'KNC đặc biệt + 1tr5', 1500000, 6);

-- Insert dữ liệu mặc định cho phần thưởng đứng bục
INSERT INTO reward_podium_config (podium_type, rank, reward_description, cash_amount) VALUES
-- Đứng bục chung cuộc
('overall', 1, 'Kỉ niệm chương đặc biệt + 3tr', 3000000),
('overall', 2, 'Kỉ niệm chương đặc biệt + 2tr', 2000000),
('overall', 3, 'Kỉ niệm chương đặc biệt + 1tr', 1000000),

-- Đứng bục lứa tuổi
('age_group', 1, 'Kỉ niệm chương đặc biệt + 1tr5', 1500000),
('age_group', 2, 'Kỉ niệm chương đặc biệt + 1tr', 1000000),
('age_group', 3, 'Kỉ niệm chương đặc biệt + 500k', 500000);

-- RLS Policies

-- reward_milestones: Public read, admin write
ALTER TABLE reward_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active milestones"
ON reward_milestones FOR SELECT
USING (is_active = TRUE);

CREATE POLICY "Admin can manage milestones"
ON reward_milestones FOR ALL
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- member_milestone_rewards: Users see own, admin see all
ALTER TABLE member_milestone_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own milestone rewards"
ON member_milestone_rewards FOR SELECT
USING (
  member_id = auth.uid() OR
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

CREATE POLICY "Admin can manage milestone rewards"
ON member_milestone_rewards FOR ALL
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- reward_podium_config: Public read, admin write
ALTER TABLE reward_podium_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active podium config"
ON reward_podium_config FOR SELECT
USING (is_active = TRUE);

CREATE POLICY "Admin can manage podium config"
ON reward_podium_config FOR ALL
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- member_podium_rewards: Users see own, admin see all
ALTER TABLE member_podium_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own podium rewards"
ON member_podium_rewards FOR SELECT
USING (
  member_id = auth.uid() OR
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

CREATE POLICY "Admin can manage podium rewards"
ON member_podium_rewards FOR ALL
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- lucky_draw_winners: Users see own, admin see all
ALTER TABLE lucky_draw_winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lucky draw wins"
ON lucky_draw_winners FOR SELECT
USING (
  member_id = auth.uid() OR
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

CREATE POLICY "Admin can manage lucky draw"
ON lucky_draw_winners FOR ALL
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
