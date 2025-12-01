# Hướng Dẫn Test Hệ Thống Reward

## Tóm tắt các thay đổi đã thực hiện

### 1. ✅ Cho phép cập nhật mốc thưởng từ trang admin
- **Trang:** `/admin/reward-milestones`
- **Chức năng:** 
  - Click icon **Sửa** (Edit) để chỉnh sửa inline
  - Có thể cập nhật: Tên mốc, Thời gian (SUB), Phần thưởng, Tiền mặt, Độ ưu tiên
  - Click **Lưu** để lưu hoặc **X** để hủy
  - Toggle **Bật/Tắt** để kích hoạt/vô hiệu hóa mốc
  - Xóa mốc không cần thiết

**Lưu ý về thời gian SUB:**
- SUB có nghĩa là "**dưới**" (sub = under)
- SUB400 = hoàn thành dưới 4 giờ (< 4:00:00)
- SUB200 = hoàn thành dưới 2 giờ (< 2:00:00)
- "Lần đầu hoàn thành" = hoàn thành bất kỳ thời gian nào (milestone đặc biệt)

### 2. ✅ Sửa trang thành viên để tìm kiếm theo email
- **Trang:** `/admin/members`
- **Chức năng:**
  - Thanh tìm kiếm ở đầu bảng
  - Gõ email để lọc danh sách thành viên
  - Hiển thị số lượng kết quả: "X / Y thành viên"
  - Click "Xóa" để reset tìm kiếm

### 3. ✅ Chào tên thành viên ở trang chủ
- **Trang:** `/dashboard`
- **Hiển thị:** "Xin chào, [Họ và Tên]! 👋"
- **Dữ liệu:** Lấy từ `profiles.full_name`

### 4. ✅ Scripts để thêm dữ liệu thành viên và race results
- **File 1:** `supabase/migrations/20251201_insert_test_members_and_results.sql`
  - Template đầy đủ với hướng dẫn chi tiết
  - Bao gồm các verification queries
  
- **File 2:** `supabase/INSERT_MEMBERS_HELPER.sql`
  - Script quick reference với bảng tính thời gian
  - Danh sách tất cả milestones và cash amounts
  - Template INSERT cho race results

## Hướng dẫn Test End-to-End

### Bước 1: Tạo thành viên test
Sử dụng trang admin:
```
1. Truy cập: http://localhost:3000/admin/members
2. Click "Thêm Thành Viên Mới"
3. Điền thông tin:
   - Email: test1@hlr.com
   - Họ và Tên: Nguyễn Văn Test
   - Mật khẩu: hlr123456
   - Giới tính: (cần set sau trong Supabase)
   - Ngày sinh, SĐT, Thiết bị (optional)
4. Click "Tạo Tài Khoản"
```

### Bước 2: Set giới tính cho thành viên
Trong Supabase SQL Editor:
```sql
-- Lấy ID của user vừa tạo
SELECT id, email, full_name FROM profiles WHERE email = 'test1@hlr.com';

-- Set gender (QUAN TRỌNG cho auto-award)
UPDATE profiles 
SET gender = 'male' 
WHERE email = 'test1@hlr.com';
```

### Bước 3: Tạo race test
Trong Supabase SQL Editor:
```sql
-- Tạo race
INSERT INTO races (name, date, location, description, distance_options)
VALUES (
  'HLR Test Race',
  '2024-12-01',
  'Hà Nội',
  'Race để test reward system',
  ARRAY['42.195km', '21.097km']
)
RETURNING id;

-- Copy ID này để dùng ở bước sau
```

### Bước 4: Nhập kết quả race với PR
Có 2 cách:

**Cách 1: Qua Admin UI (Khuyến nghị)**
```
1. Truy cập: http://localhost:3000/admin/races
2. Click vào race "HLR Test Race"
3. Chọn thành viên: Nguyễn Văn Test
4. Nhập kết quả:
   - Distance: 42.195km (FM)
   - Chip Time: 04:10:00 (= 15000 seconds, đạt SUB415)
   - Gun Time: 04:10:20
   - Overall Rank: 45
   - Gender Rank: 35
   - Age Group: M35-39
   - Age Group Rank: 5
   - ✅ Tick "Là PB" (is_pr)
5. Click "Lưu kết quả"
6. Sau khi lưu, click nút "Duyệt PB" trong bảng kết quả
7. Sẽ thấy message: "PB đã được duyệt! Đạt mốc: SUB415"
```

**Cách 2: Qua SQL**
```sql
-- Lấy user_id và race_id
SELECT id FROM profiles WHERE email = 'test1@hlr.com';
SELECT id FROM races WHERE name = 'HLR Test Race';

-- Insert race result (thay USER_ID và RACE_ID)
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
  approved
) VALUES (
  'RACE_ID',
  'USER_ID',
  '42.195km',
  15000, -- 4:10:00 (SUB415)
  15020,
  45,
  35,
  5,
  'M35-39',
  TRUE,
  TRUE  -- Auto-approve để trigger reward
);
```

### Bước 5: Verify auto-award
Kiểm tra trong Supabase:
```sql
-- 1. Kiểm tra milestone rewards được tạo
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
WHERE p.email = 'test1@hlr.com'
ORDER BY mmr.created_at DESC;

-- 2. Kiểm tra race_results có milestone_name annotation
SELECT 
  p.full_name,
  r.name as race_name,
  rr.distance,
  rr.chip_time_seconds/60.0 as time_minutes,
  rr.milestone_name,  -- Nên có giá trị 'SUB415'
  rr.approved,
  rr.is_pr
FROM race_results rr
JOIN profiles p ON rr.user_id = p.id
JOIN races r ON rr.race_id = r.id
WHERE p.email = 'test1@hlr.com'
ORDER BY rr.created_at DESC;
```

### Bước 6: Xem kết quả trên UI
```
1. Admin view:
   - http://localhost:3000/admin/races/[race-id]
   - Xem cột "Mốc thưởng" có "SUB415"
   - Xem cột "Duyệt PB" có checkbox tích

2. Public rewards page:
   - http://localhost:3000/rewards
   - Tab "Full Marathon" sẽ hiển thị milestone "SUB415" đã đạt (màu xanh)
   
3. Dashboard:
   - http://localhost:3000/dashboard
   - Sẽ thấy "Xin chào, Nguyễn Văn Test! 👋"
```

## Test Cases

### Test Case 1: Male FM SUB415
- **Thời gian:** 4:10:00 (15000s)
- **Expected:** Nhận "SUB415" + 200,000 VND
- **Verify:** `milestone_name = 'SUB415'`, `cash_amount = 200000`

### Test Case 2: Male FM SUB400  
- **Thời gian:** 3:55:00 (14100s)
- **Expected:** Nhận "SUB400" + 300,000 VND (ưu tiên cao hơn SUB415)
- **Verify:** `milestone_name = 'SUB400'`, `cash_amount = 300000`

### Test Case 3: Male HM SUB200
- **Thời gian:** 1:55:00 (6900s)
- **Expected:** Nhận "SUB200" + 300,000 VND
- **Verify:** `milestone_name = 'SUB200'`, `cash_amount = 300000`

### Test Case 4: Female FM First Time
- **Thời gian:** 5:30:00 (19800s)
- **Expected:** Nhận "Lần đầu hoàn thành"
- **Verify:** `milestone_name = 'Lần đầu hoàn thành'`, `cash_amount = 0`

### Test Case 5: Không đạt mốc nào
- **Thời gian:** 5:00:00 (18000s) - male FM
- **Expected:** Không nhận reward (vượt tất cả milestones)
- **Verify:** `milestone_name = NULL`, no row in `member_milestone_rewards`

### Test Case 6: Update milestone configuration
```
1. Go to /admin/reward-milestones
2. Click Edit on "SUB415" milestone
3. Change cash_amount to 250000
4. Click Save
5. Insert new race result with SUB415 time
6. Verify new reward has 250000 VND
```

## Troubleshooting

### Không tạo được reward
**Nguyên nhân:**
1. Thiếu `gender` trong profiles → Set gender trước
2. `approved = false` hoặc `is_pr = false` → Set cả 2 = true
3. `category` không match (HM/FM) → Kiểm tra distance format
4. Milestone đã được nhận trước đó → Mỗi milestone chỉ nhận 1 lần

**Giải pháp:**
```sql
-- Check profile has gender
SELECT id, email, full_name, gender FROM profiles WHERE email = 'test@hlr.com';

-- Update if missing
UPDATE profiles SET gender = 'male' WHERE email = 'test@hlr.com';

-- Check race result flags
SELECT id, approved, is_pr, category, milestone_name 
FROM race_results 
WHERE user_id = 'USER_ID';

-- Re-trigger by updating
UPDATE race_results 
SET approved = true, is_pr = true 
WHERE id = 'RESULT_ID';
```

### Milestone_name null sau khi approve
**Nguyên nhân:** Trigger không chạy hoặc không match milestone

**Debug:**
```sql
-- Check milestones available
SELECT * FROM reward_milestones 
WHERE race_type = 'FM' 
  AND gender = 'male' 
  AND is_active = true
ORDER BY priority DESC;

-- Check if time qualifies
-- Example: 15000s should qualify for SUB415 (24900s) and SUB445 (26700s)
SELECT milestone_name, time_seconds 
FROM reward_milestones 
WHERE race_type = 'FM' 
  AND gender = 'male'
  AND time_seconds >= 15000
ORDER BY priority DESC;
```

### Search email không hoạt động
- Đảm bảo đang gõ đúng format email
- Check console log xem có lỗi không
- Thử refresh trang

## Bảng Tham Chiếu Thời Gian

| Time | HH:MM:SS | Seconds | Milestone Examples |
|------|----------|---------|-------------------|
| 3:30:00 | 3:30:00 | 12600 | SUB330 FM Male |
| 4:00:00 | 4:00:00 | 14400 | SUB400 FM |
| 4:15:00 | 4:15:00 | 15300 | SUB415 FM Male |
| 4:30:00 | 4:30:00 | 16200 | SUB430 FM Female |
| 4:45:00 | 4:45:00 | 17100 | SUB445 FM Male |
| 5:00:00 | 5:00:00 | 18000 | SUB500 FM Female |
| 1:45:00 | 1:45:00 | 6300 | SUB145 HM Male |
| 2:00:00 | 2:00:00 | 7200 | SUB200 HM |
| 2:15:00 | 2:15:00 | 8100 | SUB215 HM |
| 2:30:00 | 2:30:00 | 9000 | SUB230 HM |

## Admin URLs

- **Members:** http://localhost:3000/admin/members
- **Milestones:** http://localhost:3000/admin/reward-milestones
- **Races:** http://localhost:3000/admin/races
- **Race Detail:** http://localhost:3000/admin/races/[id]
- **Lucky Draw:** http://localhost:3000/admin/lucky-draw
- **Podium Rewards:** http://localhost:3000/admin/podium-rewards

## Public URLs

- **Dashboard:** http://localhost:3000/dashboard
- **Rewards:** http://localhost:3000/rewards
- **Races:** http://localhost:3000/races
- **Challenges:** http://localhost:3000/challenges

## Notes

- Auto-award chỉ chạy khi **cả** `approved = true` VÀ `is_pr = true`
- Mỗi milestone chỉ có thể nhận **1 lần** (UNIQUE constraint)
- Trigger tự động chọn milestone **ưu tiên cao nhất** (priority DESC)
- Nếu đã nhận milestone cao hơn, không được nhận milestone thấp hơn
- "Lần đầu hoàn thành" luôn match nếu không có milestone nào khác match

## Next Steps

Sau khi test xong:
1. Import dữ liệu thành viên thật
2. Import race results lịch sử
3. Configure podium rewards
4. Setup lucky draw cho challenges
5. Test notification system
6. Deploy to production
