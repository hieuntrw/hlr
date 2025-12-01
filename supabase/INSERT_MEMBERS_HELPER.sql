-- Quick Insert Script for Real HLR Members
-- Copy this to Supabase SQL Editor after creating auth users

-- ========================================
-- STEP 1: Create races if not exists
-- ========================================
INSERT INTO races (name, date, location, description, distance_options)
VALUES 
  ('HLR Marathon 2024', '2024-11-10', 'Hồ Hoàn Kiếm, Hà Nội', 'Giải chạy marathon HLR 2024', ARRAY['42.195km', '21.097km']),
  ('VM Quy Nhơn 2024', '2024-09-15', 'Quy Nhơn', 'VnExpress Marathon Quy Nhơn', ARRAY['42.195km', '21.097km', '10km']),
  ('VM Huế 2024', '2024-04-21', 'Huế', 'VnExpress Marathon Huế', ARRAY['42.195km', '21.097km', '5km'])
ON CONFLICT DO NOTHING;

-- ========================================
-- STEP 2: Get race IDs
-- ========================================
-- Run this query to get race UUIDs:
SELECT id, name, date FROM races ORDER BY date DESC;

-- ========================================
-- STEP 3: Get member UUIDs  
-- ========================================
-- Run this to see all members and their IDs:
SELECT id, email, full_name, gender FROM profiles WHERE is_active = true ORDER BY full_name;

-- ========================================
-- STEP 4: Insert race results
-- ========================================
-- Template for bulk insert - replace with actual UUIDs:

/*
INSERT INTO race_results (race_id, user_id, distance, chip_time_seconds, gun_time_seconds, rank_overall, rank_gender, age_group, is_pr, approved)
VALUES
-- Example entries - REPLACE UUIDs and times with real data
('RACE_ID_1', 'USER_ID_1', '42.195km', 14400, 14450, 23, 18, 'M35-39', true, true), -- 4:00:00 SUB400
('RACE_ID_1', 'USER_ID_2', '42.195km', 15600, 15650, 45, 35, 'M40-44', true, true), -- 4:20:00 SUB445
('RACE_ID_1', 'USER_ID_3', '21.097km', 6600, 6650, 12, 10, 'M30-34', true, true),  -- 1:50:00 SUB200
('RACE_ID_2', 'USER_ID_4', '42.195km', 18000, 18100, 78, 45, 'F30-34', true, true), -- 5:00:00 SUB500
('RACE_ID_2', 'USER_ID_5', '21.097km', 7200, 7250, 34, 22, 'F35-39', true, true);  -- 2:00:00 SUB200
*/

-- ========================================
-- STEP 5: Verify auto-awards were created
-- ========================================
-- Check milestone rewards:
SELECT 
  p.full_name,
  rm.milestone_name,
  r.name as race_name,
  mmr.reward_description,
  mmr.cash_amount,
  mmr.status,
  mmr.created_at
FROM member_milestone_rewards mmr
JOIN profiles p ON mmr.member_id = p.id
JOIN reward_milestones rm ON mmr.milestone_id = rm.id
JOIN races r ON mmr.race_id = r.id
ORDER BY mmr.created_at DESC;

-- Check race results with annotations:
SELECT 
  p.full_name,
  r.name as race_name,
  rr.distance,
  rr.chip_time_seconds/60 as time_minutes,
  rr.milestone_name,
  rr.approved,
  rr.is_pr
FROM race_results rr
JOIN profiles p ON rr.user_id = p.id
JOIN races r ON rr.race_id = r.id
WHERE rr.approved = true
ORDER BY rr.created_at DESC;

-- ========================================
-- EXAMPLE TIME CALCULATIONS
-- ========================================
-- Use this to convert times to seconds:
-- 4:00:00 FM = 4 * 3600 = 14400
-- 4:15:00 FM = 4 * 3600 + 15 * 60 = 15300
-- 4:30:00 FM = 4 * 3600 + 30 * 60 = 16200
-- 1:50:00 HM = 1 * 3600 + 50 * 60 = 6600
-- 2:00:00 HM = 2 * 3600 = 7200
-- 2:15:00 HM = 2 * 3600 + 15 * 60 = 8100

-- ========================================
-- MILESTONE REFERENCE (Male)
-- ========================================
-- FM Male:
--   SUB330 = 19800s (5:30) - 1M VND
--   SUB345 = 20700s (5:45) - 500K
--   SUB400 = 24000s (4:00) - 300K
--   SUB415 = 24900s (4:15) - 200K
--   SUB445 = 26700s (4:45) - 0
--   First completion = 999999s - 0

-- HM Male:
--   SUB145 = 6300s (1:45) - 500K
--   SUB200 = 7200s (2:00) - 300K
--   SUB215 = 8100s (2:15) - 200K
--   SUB230 = 9000s (2:30) - 150K
--   SUB245 = 9900s (2:45) - 0
--   First completion = 999999s - 0

-- ========================================
-- MILESTONE REFERENCE (Female)
-- ========================================
-- FM Female:
--   SUB400 = 24000s (4:00) - 1M VND
--   SUB430 = 25800s (4:30) - 500K
--   SUB500 = 30000s (5:00) - 300K
--   SUB530 = 31800s (5:30) - 200K
--   SUB600 = 36000s (6:00) - 0
--   First completion = 999999s - 0

-- HM Female:
--   SUB200 = 7200s (2:00) - 500K
--   SUB215 = 8100s (2:15) - 300K
--   SUB230 = 9000s (2:30) - 200K
--   SUB245 = 9900s (2:45) - 150K
--   SUB300 = 10800s (3:00) - 0
--   First completion = 999999s - 0
