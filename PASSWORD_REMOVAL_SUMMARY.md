# Đã xóa trường password khỏi profiles

## Thay đổi:

### 1. Database Migration
✅ Tạo file: `supabase/migrations/20251202_remove_password_from_profiles.sql`
✅ Cập nhật: `supabase/APPLY_MIGRATIONS.sql` - thêm migration xóa password

**Migration:**
```sql
ALTER TABLE profiles DROP COLUMN IF EXISTS password;
```

### 2. Admin Members Page (`app/admin/members/page.tsx`)
✅ Xóa `password` khỏi `formData` state
✅ Xóa input field "Mật khẩu" khỏi form tạo thành viên
✅ Xóa `password` khỏi API call body
✅ Xóa `password` khỏi form reset
✅ Xóa `password` khỏi `openEditForm()`

### 3. API Create User (`app/api/admin/create-user/route.ts`)
✅ Xóa `password` parameter
✅ Generate password ngẫu nhiên tự động khi tạo auth user:
```typescript
password: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
```

### 4. Files GIỮ NGUYÊN
- `app/api/debug/login/route.ts` - dùng cho debug với Supabase auth
- `app/admin/challenges/page.tsx` - password cho challenges table (không phải profiles)
- `app/debug-login/page.tsx` - debug UI cho Supabase auth

## Lý do:

Authentication giờ hoàn toàn thông qua:
1. **Strava OAuth** - primary method
2. **Supabase Auth** - backend authentication system

Không cần lưu password trong profiles table nữa vì:
- Users authenticate qua Strava
- Supabase Auth quản lý credentials
- Password được generate tự động khi tạo user (cho Supabase auth system)

## Cách tạo thành viên mới:

### Qua Admin UI (`/admin/members`)
1. Nhập email, họ tên (bắt buộc)
2. Chọn role, nhập thông tin bổ sung (tùy chọn)
3. Click "Tạo thành viên"
4. ✅ Password tự động generate ở backend
5. Member login qua Strava OAuth

### Flow authentication:
```
User → Click "Kết nối Strava" 
     → Strava OAuth consent 
     → Callback lưu tokens 
     → Authenticated ✅
```

## Testing:

1. **Chạy migration:**
   ```bash
   # Trong Supabase SQL Editor
   ALTER TABLE profiles DROP COLUMN IF EXISTS password;
   ```

2. **Test tạo member mới:**
   - Vào `/admin/members`
   - Click "Thêm thành viên mới"
   - Điền thông tin (không có field password)
   - Submit
   - ✅ Member được tạo thành công

3. **Verify database:**
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' AND column_name = 'password';
   -- Kết quả: 0 rows (cột đã bị xóa)
   ```

## Notes:

⚠️ **Sau khi chạy migration, không thể rollback** - đảm bảo backup database trước
✅ Tất cả authentication flows hiện tại vẫn hoạt động bình thường
✅ Không ảnh hưởng đến members hiện có
