-- Migration: Insert HLR test members and race results for reward system testing
-- Date: 2025-12-01
-- Description: Thêm dữ liệu thành viên thật và kết quả race để test hệ thống reward

-- ==============================================
-- PART 1: Insert Test Members
-- ==============================================
-- Note: These are sample members. Replace with actual HLR member data.
-- Password for all test accounts: "hlr123456"
-- Important: Run this AFTER creating users via Supabase Auth Dashboard or API

-- Insert sample members (adjust IDs after creating auth users)
-- You'll need to:
-- 1. Create auth users via Supabase Dashboard or /api/admin/create-user
-- 2. Get their UUIDs
-- 3. Update profiles with proper data

-- Sample profile updates (replace UUIDs with actual auth user IDs)
-- UPDATE profiles SET 
--   full_name = 'Nguyễn Văn A',
--   gender = 'male',
--   dob = '1990-05-15',
--   phone_number = '0901234567',
--   device_name = 'Garmin Forerunner 245',
--   join_date = '2024-01-15',
--   is_active = true
-- WHERE email = 'nguyenvana@example.com';

-- ==============================================
-- PART 2: Create Sample Races
-- ==============================================

-- Insert test race 1: HLR Marathon 2024
INSERT INTO races (name, date, location, description, distance_options, created_at)
VALUES (
  'HLR Marathon 2024',
  '2024-11-10',
  'Hồ Hoàn Kiếm, Hà Nội',
  'Giải chạy marathon chính thức của HLR Running Club năm 2024',
  ARRAY['42.195km', '21.097km', '10km'],
  NOW()
) ON CONFLICT DO NOTHING
RETURNING id; -- Save this ID for inserting results

-- Insert test race 2: VM Quy Nhon 2024
INSERT INTO races (name, date, location, description, distance_options, created_at)
VALUES (
  'VnExpress Marathon Quy Nhơn 2024',
  '2024-09-15',
  'Bãi biển Quy Nhơn',
  'VnExpress Marathon tại Quy Nhơn',
  ARRAY['42.195km', '21.097km', '10km', '5km'],
  NOW()
) ON CONFLICT DO NOTHING
RETURNING id;

-- ==============================================
-- PART 3: Insert Sample Race Results with PRs
-- ==============================================
-- Note: Replace user_id and race_id with actual UUIDs from your database
-- This is a TEMPLATE - you need to get actual IDs first

-- Example template for inserting race results:
-- Replace 'USER_UUID_HERE' and 'RACE_UUID_HERE' with actual values

/*
-- Example: Member completes Full Marathon with SUB415 time (4:10:00 = 15000 seconds)
INSERT INTO race_results (
  race_id,
  user_id,
  distance,
  chip_time_seconds,
  gun_time_seconds,
  rank_overall,
  rank_gender,
  rank_age_group,
  age_group,
  is_pr,
  approved,
  created_at
) VALUES (
  'RACE_UUID_HERE',
  'USER_UUID_HERE',
  '42.195km',
  15000, -- 4:10:00 (SUB415 for male FM)
  15020,
  45,
  35,
  5,
  'M40-44',
  TRUE, -- This is a PR
  TRUE, -- Auto-approve to trigger milestone reward
  NOW()
);

-- Example: Member completes Half Marathon with SUB200 time (1:55:00 = 6900 seconds)
INSERT INTO race_results (
  race_id,
  user_id,
  distance,
  chip_time_seconds,
  gun_time_seconds,
  rank_overall,
  rank_gender,
  rank_age_group,
  age_group,
  is_pr,
  approved,
  created_at
) VALUES (
  'RACE_UUID_HERE',
  'USER_UUID_HERE',
  '21.097km',
  6900, -- 1:55:00 (SUB200 for male HM)
  6920,
  28,
  22,
  3,
  'M35-39',
  TRUE,
  TRUE,
  NOW()
);

-- Example: Female member completes Full Marathon first time (5:30:00 = 19800 seconds)
INSERT INTO race_results (
  race_id,
  user_id,
  distance,
  chip_time_seconds,
  gun_time_seconds,
  rank_overall,
  rank_gender,
  rank_age_group,
  age_group,
  is_pr,
  approved,
  created_at
) VALUES (
  'RACE_UUID_HERE',
  'USER_UUID_HERE',
  '42.195km',
  19800, -- 5:30:00 (First time completion for female)
  19850,
  120,
  45,
  8,
  'F30-34',
  TRUE,
  TRUE,
  NOW()
);
*/

-- ==============================================
-- PART 4: Verification Queries
-- ==============================================
-- Use these queries to verify the auto-award system worked:

-- Check created milestone rewards
-- SELECT 
--   mmr.*,
--   p.full_name,
--   rm.milestone_name,
--   r.name as race_name
-- FROM member_milestone_rewards mmr
-- JOIN profiles p ON mmr.member_id = p.id
-- JOIN reward_milestones rm ON mmr.milestone_id = rm.id
-- JOIN races r ON mmr.race_id = r.id
-- ORDER BY mmr.created_at DESC;

-- Check race results with milestone annotations
-- SELECT 
--   rr.*,
--   p.full_name,
--   r.name as race_name,
--   rr.milestone_name
-- FROM race_results rr
-- JOIN profiles p ON rr.user_id = p.id
-- JOIN races r ON rr.race_id = r.id
-- WHERE rr.milestone_name IS NOT NULL
-- ORDER BY rr.created_at DESC;

-- ==============================================
-- INSTRUCTIONS FOR USAGE:
-- ==============================================
-- 1. Create auth users first via /api/admin/create-user or Supabase Dashboard
-- 2. Get their UUIDs from profiles table
-- 3. Get race IDs from races table after inserting test races
-- 4. Uncomment and fill in the INSERT statements above with actual UUIDs
-- 5. Run verification queries to confirm auto-award triggered
-- 6. Check admin pages:
--    - /admin/reward-milestones - view/edit milestones
--    - /admin/races/[id] - see race results with milestone annotations
--    - /rewards - public view of member rewards

-- ==============================================
-- Quick Helper to Get IDs:
-- ==============================================
-- Get user IDs and emails:
-- SELECT id, email, full_name, gender FROM profiles ORDER BY created_at DESC LIMIT 10;

-- Get race IDs:
-- SELECT id, name, date FROM races ORDER BY date DESC;

-- Get milestone IDs for reference:
-- SELECT id, race_type, gender, milestone_name, time_seconds/60 as time_minutes 
-- FROM reward_milestones 
-- WHERE is_active = true
-- ORDER BY race_type, gender, priority DESC;
