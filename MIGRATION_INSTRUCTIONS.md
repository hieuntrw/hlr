# Hướng Dẫn Áp Dụng Migration - Thêm Password Field

## Cách nhanh nhất: SQL Editor trên Supabase Dashboard

### Bước 1: Mở Supabase Dashboard
- Truy cập: https://app.supabase.com
- Chọn project `hlr-running-club`

### Bước 2: Vào SQL Editor
- Click tab **SQL Editor** (trên thanh bên trái)
- Click **New Query**

### Bước 3: Chạy Migration SQL
Sao chép toàn bộ SQL dưới đây và dán vào editor, sau đó click **Run**:

```sql
-- Migration: Add password field to profiles table
-- Purpose: Enable local member authentication with email/password
-- Date: 2025-11-29

-- Add password column to profiles table (nullable for now; can be set during member signup)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS password TEXT;

-- Optional: Add a comment to document this field
COMMENT ON COLUMN profiles.password IS 'Hashed password for local authentication (optional; members can also use Supabase auth)';
```

### Bước 4: Xác nhận
- Nếu không có lỗi, bạn sẽ thấy thông báo success
- Bảng `profiles` bây giờ có cột `password`

---

## Cách khác: Dùng Supabase CLI

Nếu bạn đã cài đặt Supabase CLI:

```bash
cd /workspaces/hlr
supabase db push
```

---

## Kiểm tra kết quả

Sau khi migration được áp dụng, bạn có thể xác nhận bằng:

1. **Trên Supabase Dashboard:**
   - Vào **Table Editor**
   - Chọn bảng `profiles`
   - Bạn sẽ thấy cột `password` được thêm vào (kiểu TEXT, nullable)

2. **Hoặc chạy query kiểm tra:**
   ```sql
   SELECT column_name, data_type, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' 
   AND column_name = 'password';
   ```

---

## Tiếp theo

Sau khi migration hoàn thành:
1. Khởi động lại dev server
2. Thử debug login với tài khoản test (tranchihieu.it@gmail.com / 123456)
3. Kết nối Strava và đồng bộ hoạt động
