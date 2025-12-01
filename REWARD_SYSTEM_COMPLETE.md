# HỆ THỐNG QUẢN LÝ QUÀ TẶNG - HOÀN THÀNH

## Đã Tạo

### 1. Database Migration
File: `supabase/migrations/20251201_create_reward_system.sql`

**Các bảng mới:**
- `reward_milestones` - Cấu hình mốc thành tích FM/HM (có thể chỉnh sửa)
- `member_milestone_rewards` - Tracking mốc đã đạt của thành viên
- `reward_podium_config` - Cấu hình phần thưởng đứng bục
- `member_podium_rewards` - Tracking phần thưởng đứng bục
- `lucky_draw_winners` - Quà tặng quay số may mắn

**Dữ liệu mặc định:**
- Đã insert 26 mốc thành tích (FM Nam: 7, FM Nữ: 7, HM Nam: 6, HM Nữ: 6)
- Đã insert 6 cấu hình đứng bục (Chung cuộc 3 hạng, Lứa tuổi 3 hạng)
- Đã setup RLS policies cho tất cả bảng

### 2. Trang Công Khai - /rewards
File: `app/rewards/page.tsx`

**Chức năng:**
- Hiển thị mốc FM/HM (đã đạt có check mark xanh)
- Tab "Đứng bục" - lịch sử phần thưởng đứng bục
- Tab "Quay số" - lịch sử trúng quay số may mắn
- Responsive design với orange theme

### 3. Trang Admin - Mốc Thành Tích
File: `app/admin/reward-milestones/page.tsx`

**Chức năng:**
- Xem danh sách mốc theo FM/HM, Nam/Nữ
- Thêm mốc mới
- Bật/tắt mốc
- Xóa mốc
- Chỉnh sửa mốc thông qua form

### 4. Trang Admin - Quay Số May Mắn
File: `app/admin/lucky-draw/page.tsx`

**Chức năng:**
- Thêm người trúng quay số (chọn thử thách, thành viên, mô tả quà)
- Xem danh sách người trúng
- Đánh dấu đã trao quà
- Tracking trạng thái: pending → delivered

### 5. Trang Admin - Phần Thưởng Đứng Bục
File: `app/admin/podium-rewards/page.tsx`

**Chức năng:**
- Hiển thị cấu hình hiện tại (Chung cuộc, Lứa tuổi)
- Thêm phần thưởng đứng bục (chọn race, thành viên, loại giải)
- Xem danh sách phần thưởng
- Đánh dấu đã trao
- Tracking trạng thái

### 6. Cập Nhật AdminLayout
File: `components/AdminLayout.tsx`

**Menu mới:**
- Mốc Thành Tích (Award icon)
- Quay Số May Mắn (Gift icon)
- Phần Thưởng Đứng Bục (Star icon)

### 7. Cập Nhật Navigation
- Menu "Quà tặng" đã được thêm vào Header (vị trí: Thử thách → Bảng vàng → Races → **Quà tặng**)
- Footer đã cập nhật link

## Cần Làm Tiếp

### 1. Apply Migration
```bash
# Cần chạy migration này trên Supabase:
supabase/migrations/20251201_create_reward_system.sql
```

Có thể dùng:
- Supabase Dashboard → SQL Editor → Paste và Run
- Hoặc dùng script apply-migration.js

### 2. Cập Nhật Gender Field
**Lưu ý:** Cần thêm trường `gender` vào bảng `profiles` nếu chưa có:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('male', 'female'));
```

### 3. Logic Tự Động (Tùy chọn - có thể làm sau)
- Auto-detect mốc đạt được khi race result được tạo
- Auto-check PR và tạo reward tự động
- Edge function để sync với race results

## Quy Trình Sử Dụng

### Cho Thành Viên:
1. Vào trang **/rewards**
2. Xem mốc FM/HM (màu xanh = đã đạt, xám = chưa đạt)
3. Tab "Đứng bục" - xem lịch sử đứng bục
4. Tab "Quay số" - xem lịch sử trúng thưởng

### Cho Admin:

#### Quản lý mốc thành tích:
1. Vào **/admin/reward-milestones**
2. Thêm/sửa/xóa/bật-tắt mốc
3. Có thể thay đổi phần thưởng, số tiền

#### Quản lý quay số:
1. Vào **/admin/lucky-draw**
2. Chọn thử thách đã kết thúc
3. Chọn 2 thành viên trúng thưởng
4. Nhập mô tả quà tặng
5. Đánh dấu đã trao khi giao quà

#### Quản lý đứng bục:
1. Vào **/admin/podium-rewards**
2. Chọn race (sự kiện ≥2000 VĐV)
3. Chọn thành viên đứng bục
4. Chọn loại giải (Chung cuộc/Lứa tuổi) và hạng (1/2/3)
5. Đánh dấu đã trao

## Đặc Điểm Kỹ Thuật

### Mốc Thành Tích (Milestone):
- **Nhận 1 lần duy nhất**: Mỗi member chỉ nhận 1 lần cho mỗi mốc
- **Mốc cao nhất**: UNIQUE constraint (member_id, milestone_id)
- **Priority**: Mốc có priority cao hơn = thành tích cao hơn

### Đứng Bục (Podium):
- **Nhận nhiều lần**: Không có constraint unique
- **Điều kiện**: Sự kiện quy mô ≥2000 VĐV
- **Loại**: overall (chung cuộc) và age_group (lứa tuổi)

### Quay Số May Mắn:
- **2 người/tháng**: Hoàn thành thử thách hàng tháng
- **Tracking đơn giản**: pending → delivered

## RLS Policies
- Members: Xem own data
- Admin: Xem và quản lý tất cả
- Public: Đọc configs (milestones, podium_config)

## UI/UX
- **Theme**: Orange (#f97316) primary
- **Icons**: Trophy (mốc), Gift (quay số), Star (đứng bục)
- **Status badges**: Yellow (pending), Green (delivered/approved), Red (rejected)
- **Responsive**: Mobile-friendly với overflow scroll cho tables

## Next Steps (Đề xuất)
1. Apply migration vào Supabase
2. Test toàn bộ flow
3. Thêm field gender vào profiles nếu chưa có
4. (Optional) Tạo edge function auto-detect achievements từ race results
5. (Optional) Notification system khi đạt mốc mới
