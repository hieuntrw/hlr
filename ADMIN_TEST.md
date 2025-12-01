# Hướng dẫn Test Quyền Admin

## 🔒 Cơ chế Authentication mới

### 1. **Middleware với Supabase SSR**
- Sử dụng `@supabase/ssr` package để quản lý cookies tự động
- Không cần custom cookie `sb-access-token` nữa
- Middleware tự động kiểm tra Supabase session và redirect nếu chưa đăng nhập

### 2. **Cookie Management**
- Login: Supabase client tự động set cookies
- Logout: Gọi `/api/auth/logout` để clear cookies + sign out

### 3. **Role-based Access Control**
- **admin**: Full access tất cả admin routes
- **mod_finance**: Access `/admin/finance` và `/admin/finance-report`
- **mod_challenge**: Access `/admin/challenges`
- **mod_member**: Access `/admin/members` và `/admin/pb-approval`
- **member**: Không access được `/admin`

## 🧪 Cách Test

### Test 1: Tạo Admin Account
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hlr.vn",
    "password": "admin123456",
    "full_name": "HLR Admin",
    "role": "admin"
  }'
```

### Test 2: Login với Admin Account
1. Mở browser: http://localhost:3000/login
2. Nhập:
   - Email: `admin@hlr.vn`
   - Password: `admin123456`
3. Sau khi login thành công, sẽ redirect đến `/dashboard`

### Test 3: Truy cập Admin Panel
1. Từ Dashboard, click link "Quản trị" trong Header (desktop) hoặc hamburger menu (mobile)
2. Hoặc trực tiếp vào: http://localhost:3000/admin
3. Sẽ thấy Admin Dashboard với statistics

### Test 4: Test Role Restrictions
**Tạo mod_finance account:**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mod_finance@hlr.vn",
    "password": "mod123456",
    "full_name": "Finance Mod",
    "role": "mod_finance"
  }'
```

**Login với mod_finance:**
- Truy cập `/admin/finance` → OK ✓
- Truy cập `/admin/challenges` → Redirect về `/admin` ✗
- Truy cập `/admin/settings` → Redirect về `/admin` ✗

### Test 5: Test Logout
1. Click nút "Đăng xuất" trong Header
2. Sẽ được redirect về `/login`
3. Cookies được clear
4. Thử truy cập `/admin` → Redirect về `/login` ✓

## 🔧 Troubleshooting

### Lỗi: "Middleware error" trong console
- Kiểm tra `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` trong `.env.local`
- Restart dev server: `npm run dev`

### Lỗi: Admin không thấy link "Quản trị"
- Kiểm tra role trong database:
  ```sql
  SELECT id, email, role FROM profiles WHERE email = 'admin@hlr.vn';
  ```
- Update role nếu cần:
  ```sql
  UPDATE profiles SET role = 'admin' WHERE email = 'admin@hlr.vn';
  ```

### Lỗi: Redirect loop (login → dashboard → login)
- Clear cookies trong browser: DevTools → Application → Cookies → Delete all
- Logout và login lại

### Lỗi: 401 Unauthorized khi login
- Kiểm tra account đã tồn tại trong Supabase Auth
- Check trong Supabase Dashboard → Authentication → Users
- Nếu chưa có, tạo lại bằng signup API

## 📝 Database Setup

### Kiểm tra profiles table có đủ columns:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('id', 'email', 'role', 'full_name', 'is_active');
```

### Tạo admin user trực tiếp trong DB (nếu cần):
```sql
-- Lưu ý: Phải tạo trong Supabase Auth trước, sau đó update profile
UPDATE profiles 
SET role = 'admin', is_active = true 
WHERE email = 'your_email@domain.com';
```

## ✅ Expected Behaviors

### Admin User
- ✓ Thấy link "Quản trị" trong Header
- ✓ Badge "Admin" hiển thị màu đỏ
- ✓ Truy cập tất cả `/admin/*` routes
- ✓ Thấy "Admin Quick Actions" trong Dashboard

### Moderator User
- ✓ Thấy link "Quản trị" trong Header
- ✓ Badge "Mod..." hiển thị màu xanh/cam/tím
- ✓ Truy cập chỉ routes được phép theo role
- ✗ Không truy cập được routes khác
- ✓ Thấy "Admin Quick Actions" trong Dashboard

### Member User
- ✗ Không thấy link "Quản trị"
- ✓ Badge "Thành viên" (hoặc không có badge)
- ✗ Không truy cập được `/admin`
- ✗ Không thấy "Admin Quick Actions" trong Dashboard

## 🚀 Next Steps

Sau khi test xong, các bước tiếp theo:
1. ✅ Todo #5: Fix quyền admin - **HOÀN THÀNH**
2. ⏭️ Todo #6: Thêm chức năng tặng sao cho thử thách
3. ⏭️ Todo #7: Fix tab mặc định trang Thử thách
4. ⏭️ Todo #8: Kiểm tra trang quản trị định nghĩa mốc thưởng
