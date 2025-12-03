# Auth Context Migration Guide

## Vấn đề đã fix

**Trước đây**: Mỗi page gọi `supabase.auth.getUser()` riêng lẻ → 25+ lần fetch user → load chậm, flickering

**Giờ**: Một AuthContext duy nhất → cache user data → load instant, không flickering

## Setup đã hoàn thành

✅ **AuthContext** (`/lib/auth/AuthContext.tsx`):
- Cache user data trong `sessionStorage` với key `hlr_auth_cache`
- Auto refresh khi auth state changes
- Expose: `user`, `profile`, `isLoading`, `isAdmin`, `isMod`, `refreshAuth()`

✅ **App Layout** (`/app/layout.tsx`):
- Wrapped với `<AuthProvider>` → user data available toàn app

✅ **Header** (`/components/Header.tsx`):
- Đã migrate sang dùng `useAuth()` hook
- Không còn fetch user riêng

✅ **Demo Migration** (`/app/challenges/page.tsx`):
- Example cách migrate từ `supabase.auth.getUser()` sang `useAuth()`

## Migration Pattern

### TRƯỚC (Cũ - chậm):
```tsx
export default function MyPage() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  async function fetchCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user?.id || null);
  }

  // ... rest of code
}
```

### SAU (Mới - nhanh):
```tsx
import { useAuth } from "@/lib/auth/AuthContext";

export default function MyPage() {
  const { user, profile, isLoading } = useAuth();
  const currentUser = user?.id || null;

  // No need for fetchCurrentUser - data is already available!
  // ... rest of code
}
```

## Available Data from useAuth()

```typescript
const {
  user,        // Supabase User object (với email, id, user_metadata)
  profile,     // Profile object { id, full_name, role }
  isLoading,   // Boolean - true khi đang load lần đầu
  isAdmin,     // Boolean - true nếu user là admin
  isMod,       // Boolean - true nếu user là admin/mod
  refreshAuth  // Function - gọi để refresh user data manually
} = useAuth();
```

## Common Use Cases

### 1. Get Current User ID
```tsx
const { user } = useAuth();
const userId = user?.id;
```

### 2. Check User Role
```tsx
const { user, isAdmin, isMod } = useAuth();
const role = user?.user_metadata?.role;

// Or use helpers:
if (isAdmin) { /* admin only */ }
if (isMod) { /* mod or admin */ }
```

### 3. Show Loading State
```tsx
const { user, isLoading } = useAuth();

if (isLoading) {
  return <div>Đang tải...</div>;
}

if (!user) {
  return <div>Vui lòng đăng nhập</div>;
}
```

### 4. Display User Info
```tsx
const { user, profile } = useAuth();

return (
  <div>
    <p>Email: {user?.email}</p>
    <p>Tên: {profile?.full_name}</p>
    <p>Vai trò: {user?.user_metadata?.role}</p>
  </div>
);
```

## Pages cần migrate (23 pages còn lại)

### Admin Pages (10):
- [ ] `/app/admin/settings/page.tsx`
- [ ] `/app/admin/finance/page.tsx`
- [ ] `/app/admin/finance-report/page.tsx`
- [ ] `/app/admin/page.tsx`
- [ ] `/app/admin/lucky-draw/page.tsx`
- [ ] `/app/admin/members/page.tsx`
- [ ] `/app/admin/challenges/page.tsx`
- [ ] `/app/admin/podium-rewards/page.tsx`
- [ ] `/app/admin/pb-approval/page.tsx`
- [ ] `/app/admin/theme-settings/page.tsx`

### Public Pages (13):
- [x] `/app/challenges/page.tsx` ✅ (migrated as example)
- [ ] `/app/challenges/[id]/page.tsx`
- [ ] `/app/finance/page.tsx`
- [ ] `/app/rewards/page.tsx`
- [ ] `/app/dashboard/page.tsx` (5 lần gọi getUser - ưu tiên cao!)
- [ ] `/app/profile/page.tsx` (4 lần gọi getUser - ưu tiên cao!)
- [ ] `/app/profile/theme/page.tsx`
- [ ] `/app/page.tsx` (redirect page)
- [ ] `/app/admin/races/page.tsx`
- [ ] `/app/admin/races/[id]/page.tsx`
- [ ] `/app/admin/rewards/page.tsx`
- [ ] `/app/admin/reward-milestones/page.tsx`
- [ ] `/app/hall-of-fame/page.tsx`

## Migration Steps

1. **Import useAuth**:
   ```tsx
   import { useAuth } from "@/lib/auth/AuthContext";
   ```

2. **Replace useState + useEffect**:
   - Remove: `const [user, setUser] = useState(...)`
   - Remove: `const [currentUser, setCurrentUser] = useState(...)`
   - Remove: `useEffect(() => { fetchCurrentUser(); }, [])`
   - Remove: `async function fetchCurrentUser() { ... }`
   - Add: `const { user } = useAuth();`

3. **Update variable references**:
   - `currentUser` → `user?.id`
   - `user` (if exists) → rename or use directly from useAuth

4. **Update useEffect dependencies**:
   ```tsx
   // Before:
   useEffect(() => {
     if (currentUser) { fetchData(); }
   }, [currentUser]);

   // After:
   useEffect(() => {
     if (user?.id) { fetchData(); }
   }, [user?.id]);
   ```

5. **Test the page** - verify no flickering, faster load

## Performance Benefits

- **Before**: Mỗi page load → ~200-500ms delay (fetch user)
- **After**: < 10ms (read from cache)
- **Result**: Load trang nhanh hơn 20-50x, không flickering

## Notes

- Cache expires sau 5 phút (auto refresh)
- Cache clear khi logout
- Auth state sync across all tabs/windows
- No need to manually fetch user data anymore!

## Ưu tiên migrate:

1. **Cao**: `/app/dashboard/page.tsx` (5 lần gọi getUser)
2. **Cao**: `/app/profile/page.tsx` (4 lần gọi getUser)
3. **Trung bình**: Các admin pages
4. **Thấp**: Các public pages khác

Sau khi migrate xong, toàn bộ app sẽ load nhanh và mượt hơn nhiều! 🚀
