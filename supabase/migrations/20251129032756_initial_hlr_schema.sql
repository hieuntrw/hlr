/*
  # HLR Running Club Database Schema - Initial Setup

  ## Overview
  Complete database schema for HLR Running Club management system including:
  - Member profiles with Strava integration and Personal Bests tracking
  - Monthly running challenges with automatic creation and participant tracking
  - Financial management (fund collection, fines, donations, expenses, rewards)
  - Race results and PR tracking
  - Reward system for milestones and podium finishes
  
  ## New Tables
  
  ### 1. `system_settings`
  System configuration for customizable fees and thresholds
  - `key` (text, primary key) - Setting identifier
  - `value` (text) - Setting value
  - `description` (text) - Human-readable description
  
  ### 2. `profiles`
  Member profiles with Strava integration and personal records
  - `id` (uuid, primary key) - Links to auth.users
  - `full_name` (text) - Full name
  - `dob` (date) - Date of birth
  - `phone_number` (text) - Contact number
  - `email` (text) - Email address
  - `device_name` (text) - Running watch/device
  - `join_date` (date) - Club join date
  - `leave_date` (date) - Club leave date (nullable)
  - `strava_id` (text, unique) - Strava user ID
  - `strava_access_token` (text) - OAuth access token
  - `strava_refresh_token` (text) - OAuth refresh token
  - `strava_token_expires_at` (bigint) - Token expiry timestamp
  - `pb_hm_seconds` (integer) - Half marathon personal best in seconds
  - `pb_fm_seconds` (integer) - Full marathon personal best in seconds
  - `is_active` (boolean) - Active membership status
  - `role` (text) - User role (admin/member)
  - `created_at` (timestamptz) - Account creation timestamp
  
  ### 3. `challenges`
  Monthly running challenges (auto-created on 25th of each month)
  - `id` (uuid, primary key)
  - `title` (text) - Challenge name
  - `start_date` (date) - Challenge start date
  - `end_date` (date) - Challenge end date
  - `password` (text) - Registration password
  - `is_locked` (boolean) - Locked after 10 days
  - `created_at` (timestamptz) - Creation timestamp
  
  ### 4. `challenge_participants`
  Challenge participant registration and progress tracking
  - `id` (uuid, primary key)
  - `challenge_id` (uuid) - References challenges
  - `user_id` (uuid) - References profiles
  - `target_km` (integer) - Target distance (70/100/150/200/250/300)
  - `actual_km` (numeric) - Actual distance synced from Strava
  - `avg_pace_seconds` (integer) - Average pace
  - `total_activities` (integer) - Total runs
  - `status` (text) - Status (registered/completed/failed)
  - `last_synced_at` (timestamptz) - Last Strava sync time
  
  ### 5. `transactions`
  Financial tracking (income and expenses)
  - `id` (uuid, primary key)
  - `user_id` (uuid) - References profiles (nullable for general expenses)
  - `type` (text) - Transaction type (fund_collection/fine/donation/expense/reward_payout)
  - `amount` (numeric) - Amount in VND
  - `description` (text) - Transaction description
  - `transaction_date` (date) - Transaction date
  - `payment_status` (text) - Payment status (pending/paid/cancelled)
  - `related_challenge_id` (uuid) - Related challenge reference
  - `created_at` (timestamptz) - Creation timestamp
  
  ### 6. `races`
  Running race events
  - `id` (uuid, primary key)
  - `name` (text) - Race name
  - `race_date` (date) - Race date
  - `location` (text) - Race location
  - `created_at` (timestamptz) - Creation timestamp
  
  ### 7. `race_results`
  Individual race results
  - `id` (uuid, primary key)
  - `race_id` (uuid) - References races
  - `user_id` (uuid) - References profiles
  - `distance` (text) - Distance (5km/10km/21km/42km)
  - `chip_time_seconds` (integer) - Chip time in seconds
  - `official_rank` (integer) - Overall ranking
  - `age_group_rank` (integer) - Age group ranking
  - `evidence_link` (text) - Link to official results
  - `is_pr` (boolean) - Personal record flag
  
  ### 8. `reward_definitions`
  Reward criteria definitions (milestone times and podium positions)
  - `id` (uuid, primary key)
  - `category` (text) - Race category (HM/FM)
  - `type` (text) - Reward type (milestone/podium_overall/podium_age)
  - `condition_value` (integer) - Time in seconds or ranking position
  - `condition_label` (text) - Display label (e.g., "SUB 130")
  - `prize_description` (text) - Prize description
  - `cash_amount` (numeric) - Cash prize amount
  - `priority_level` (integer) - Priority for milestone comparison
  
  ### 9. `member_rewards`
  Reward distribution tracking
  - `id` (uuid, primary key)
  - `user_id` (uuid) - References profiles
  - `race_result_id` (uuid) - References race_results
  - `reward_definition_id` (uuid) - References reward_definitions
  - `awarded_date` (date) - Award date
  - `status` (text) - Delivery status (pending/delivered)
  - `created_at` (timestamptz) - Creation timestamp
  
  ### 10. `pb_history`
  Personal best history for performance tracking
  - `id` (uuid, primary key)
  - `user_id` (uuid) - References profiles
  - `distance` (text) - Race distance
  - `time_seconds` (integer) - Time in seconds
  - `achieved_at` (date) - Achievement date
  - `race_id` (uuid) - References races
  
  ## Initial Data
  
  - Default system settings for monthly fund fee (50,000 VND) and challenge fine (100,000 VND)
  
  ## Security
  
  Row Level Security will be configured in a subsequent migration for all tables.
*/

-- 1. BẢNG CẤU HÌNH HỆ THỐNG (Để tùy biến mức thu/phạt sau này)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT
);

INSERT INTO system_settings (key, value, description) VALUES
('monthly_fund_fee', '50000', 'Mức đóng quỹ hàng tháng'),
('challenge_fine_fee', '100000', 'Mức phạt không hoàn thành thử thách')
ON CONFLICT (key) DO NOTHING;

-- 2. BẢNG THÀNH VIÊN (PROFILES)
-- Lưu thông tin cá nhân và chỉ số PB
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    dob DATE,
    phone_number TEXT,
    email TEXT,
    device_name TEXT,
    join_date DATE DEFAULT CURRENT_DATE,
    leave_date DATE,
    
    -- Strava Integration 
    strava_id TEXT UNIQUE,
    strava_access_token TEXT,
    strava_refresh_token TEXT,
    strava_token_expires_at BIGINT,
    
    -- Personal Bests (Cập nhật từ kết quả giải)
    pb_hm_seconds INTEGER,
    pb_fm_seconds INTEGER,
    
    is_active BOOLEAN DEFAULT TRUE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. QUẢN LÝ THỬ THÁCH (CHALLENGES)
-- Tự động tạo ngày 25 hàng tháng
CREATE TABLE IF NOT EXISTS challenges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    password TEXT,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chi tiết thành viên tham gia thử thách
CREATE TABLE IF NOT EXISTS challenge_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_id UUID REFERENCES challenges(id),
    user_id UUID REFERENCES profiles(id),
    
    target_km INTEGER CHECK (target_km IN (70, 100, 150, 200, 250, 300)),
    
    -- Dữ liệu sync từ Strava 
    actual_km NUMERIC(10, 2) DEFAULT 0,
    avg_pace_seconds INTEGER DEFAULT 0,
    total_activities INTEGER DEFAULT 0,
    
    status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'completed', 'failed')),
    last_synced_at TIMESTAMPTZ,
    
    UNIQUE(challenge_id, user_id)
);

-- 4. QUẢN LÝ TÀI CHÍNH (THU/CHI)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    
    type TEXT CHECK (type IN ('fund_collection', 'fine', 'donation', 'expense', 'reward_payout')),
    
    amount NUMERIC(12, 0) NOT NULL,
    description TEXT,
    
    transaction_date DATE DEFAULT CURRENT_DATE,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
    
    related_challenge_id UUID REFERENCES challenges(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. GIẢI CHẠY & KẾT QUẢ (RACES)
CREATE TABLE IF NOT EXISTS races (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    race_date DATE NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS race_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    race_id UUID REFERENCES races(id),
    user_id UUID REFERENCES profiles(id),
    
    distance TEXT CHECK (distance IN ('5km', '10km', '21km', '42km')),
    chip_time_seconds INTEGER NOT NULL,
    official_rank INTEGER,
    age_group_rank INTEGER,
    
    evidence_link TEXT,
    is_pr BOOLEAN DEFAULT FALSE,
    
    UNIQUE(race_id, user_id, distance)
);

-- 6. HỆ THỐNG KHEN THƯỞNG (REWARDS)
-- Bảng định nghĩa các mốc thưởng (Cấu hình bảng 20 & 22)
CREATE TABLE IF NOT EXISTS reward_definitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT CHECK (category IN ('HM', 'FM')),
    type TEXT CHECK (type IN ('milestone', 'podium_overall', 'podium_age')),
    
    condition_value INTEGER,
    condition_label TEXT,
    
    prize_description TEXT,
    cash_amount NUMERIC(12, 0) DEFAULT 0,
    
    priority_level INTEGER
);

-- Lịch sử nhận thưởng (Để kiểm soát việc nhận 1 lần)
CREATE TABLE IF NOT EXISTS member_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    race_result_id UUID REFERENCES race_results(id),
    reward_definition_id UUID REFERENCES reward_definitions(id),
    
    awarded_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. LỊCH SỬ PB (Để vẽ biểu đồ phong độ)
CREATE TABLE IF NOT EXISTS pb_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    distance TEXT,
    time_seconds INTEGER,
    achieved_at DATE,
    race_id UUID REFERENCES races(id)
);
-- 1. Bật Extension pg_cron (Yêu cầu quyền Superuser/Admin trên Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Tạo hàm để gọi Edge Function (API Sync)
-- Giả sử Bolt đã tạo API route tại: /api/cron/sync-strava
-- Chúng ta dùng pg_net để gọi API này định kỳ từ bên trong Database

CREATE OR REPLACE FUNCTION invoke_sync_strava()
RETURNS void AS $$
DECLARE
  project_url text := 'https://localhost:3000/api/cron/sync-strava'; -- Thay domain thật
  service_role_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2bnB4Y3dqZmlkcmxxbGZtdXZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDM4MjcxNSwiZXhwIjoyMDc5OTU4NzE1fQ.r7wDDaDNZ5zLQbsynuXM9MRD4PdBg-enxRkDIU0U3nk'; -- Lấy trong Supabase Settings > API
BEGIN
  PERFORM net.http_post(
    url := project_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    )
  );
END;
$$ LANGUAGE plpgsql;

-- 3. Lên lịch chạy mỗi 6 tiếng (Theo yêu cầu Bolt)
-- Cú pháp Cron: Phút Giờ Ngày Tháng Thứ
SELECT cron.schedule('sync-strava-job', '0 */6 * * *', $$SELECT invoke_sync_strava()$$);

-- Ghi chú: Logic này đáp ứng yêu cầu về việc cập nhật dữ liệu.
-- Ngoài ra, source [15] yêu cầu tạo thử thách vào ngày 25 hàng tháng.
-- Ta tạo thêm 1 job cho việc đó:
SELECT cron.schedule('create-monthly-challenge', '0 0 25 * *', $$SELECT create_next_month_challenge()$$);