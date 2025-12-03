# Strava Token Lazy Refresh - Implementation Summary

## ✅ Hoàn thành

Hệ thống sử dụng **lazy refresh** - tự động làm mới token khi user sử dụng, không cần cron job hay bên thứ 3.

## 📋 Cơ chế hoạt động

### 1. **Khi user login vào profile/dashboard:**
```
User vào trang → Kiểm tra token → Nếu hết hạn → Tự động refresh → Lưu DB
```

### 2. **Khi sync activities:**
```
Click "Đồng bộ hoạt động" → Kiểm tra token → Auto refresh nếu cần → Gọi Strava API
```

### 3. **Mọi API call đến Strava:**
```
Dùng getValidStravaToken() → Tự động kiểm tra + refresh → Trả về token hợp lệ
```

## 🔧 Files đã implement:

### 1. `/lib/strava-token.ts` (Helper chính)
**Functions:**
- `getValidStravaToken(userId)` - Lấy token hợp lệ, tự động refresh nếu hết hạn
- `checkStravaConnection(userId)` - Kiểm tra trạng thái kết nối Strava

**Logic:**
```typescript
1. Lấy token từ DB
2. Check expiry (với buffer 5 phút)
3. Nếu còn hạn → return token
4. Nếu hết hạn → gọi Strava API refresh → lưu DB → return token mới
```

### 2. `/app/api/strava/check-connection/route.ts`
API endpoint để frontend check connection + auto-refresh

### 3. `/app/profile/page.tsx`
Tự động check và refresh token khi load trang:
```typescript
// Khi load profile
checkStravaConnection() → auto refresh nếu cần → update UI
```

### 4. `/app/api/strava/sync-activities/route.ts`
Simplified với helper:
```typescript
const accessToken = await getValidStravaToken(user.id);
// Token đảm bảo hợp lệ, không cần check thủ công
```

## 🎯 Ưu điểm:

✅ **Đơn giản** - Không cần setup cron job, GitHub Actions, external services  
✅ **Tự động** - User không biết token đang refresh, trải nghiệm mượt mà  
✅ **An toàn** - Chỉ refresh khi cần, buffer 5 phút để tránh race condition  
✅ **Centralized** - Logic refresh tập trung ở `getValidStravaToken()`  
✅ **Maintainable** - Dễ debug, dễ bảo trì

## 📊 Flow diagram:

```
┌─────────────────────────────────────────┐
│ User Login / Click Sync / API Call      │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ getValidStravaToken(userId)             │
│  ↓                                      │
│  1. Query DB: get tokens & expiry       │
│  2. Check: expires_at > now + 5min?     │
│     ├─ YES → return access_token        │
│     └─ NO ↓                             │
│  3. Call Strava API:                    │
│     POST /oauth/token                   │
│     { grant_type: "refresh_token",      │
│       refresh_token: "..." }            │
│  4. Strava returns new tokens           │
│  5. Update DB with new tokens           │
│  6. Return new access_token             │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ Use token for Strava API calls          │
└─────────────────────────────────────────┘
```

## 🧪 Test cases:

### Test 1: Token còn hạn
```bash
# User login, token expires trong 2 giờ nữa
→ Không refresh, dùng token hiện tại
```

### Test 2: Token sắp hết hạn (< 5 phút)
```bash
# User login, token expires trong 3 phút
→ Auto refresh → Lưu token mới → User không biết gì
```

### Test 3: Token đã hết hạn
```bash
# User không login trong 7 giờ, token hết hạn
→ Lần login tiếp theo → Auto refresh → Hoạt động bình thường
```

### Test 4: Refresh token invalid
```bash
# User revoke permission trên Strava
→ Refresh fail → needsReauth: true → Hiện nút "Kết nối lại Strava"
```

## 🚀 Production ready:

- ✅ Error handling đầy đủ
- ✅ Logging chi tiết
- ✅ Buffer 5 phút tránh race condition
- ✅ Fallback khi refresh fail
- ✅ Không cần thêm environment variables
- ✅ Không phụ thuộc external services

## 📝 Usage trong code:

Bất kỳ nơi nào cần gọi Strava API:

```typescript
import { getValidStravaToken } from "@/lib/strava-token";

// Trong API route hoặc server component
const token = await getValidStravaToken(userId);

if (!token) {
  // User chưa kết nối Strava hoặc refresh failed
  return { error: "Please connect Strava" };
}

// Use token
const response = await fetch("https://www.strava.com/api/v3/athlete", {
  headers: { Authorization: `Bearer ${token}` }
});
```

## 🎉 Kết luận:

**Lazy refresh đã hoàn chỉnh!** Token tự động làm mới khi user sử dụng hệ thống, không cần cron job hay setup phức tạp.
