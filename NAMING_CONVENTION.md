# Naming Convention - HLR Running Club

## Chuẩn tên gọi thống nhất trong dự án

### Routes và Tên trang

| Tên Tiếng Việt | Route | Tên Component | Mô tả |
|----------------|-------|---------------|-------|
| **Trang chủ** | `/dashboard` | `Dashboard` | Trang chủ hiển thị tổng quan |
| **Thử thách** | `/challenges` | `Challenges` | Danh sách các thử thách chạy bộ |
| **Races** | `/races` | `Races` | Danh sách các giải chạy/race events |
| **Bảng vàng** | `/hall-of-fame` | `HallOfFame` | Bảng xếp hạng thành tích |
| **Quỹ CLB** | `/finance` | `Finance` | Quản lý tài chính CLB |
| **Theo dõi quà tặng** | `/rules` | `Rules` | Theo dõi phần quà tặng & quy định |
| **Thành viên** | `/profile` | `Profile` | Thông tin cá nhân thành viên |
| **Đăng nhập** | `/login` | `Login` | Trang đăng nhập |
| **Quản trị** | `/admin` | `Admin` | Panel quản trị (requires role) |

### Menu Structure

**Header Navigation** (Desktop - horizontal menu):
```
Logo | Trang chủ | Thử thách | Races | Bảng vàng | Quỹ CLB | Theo dõi quà tặng | Thành viên | [Quản trị] | User Profile | Logout
```

**Mobile Navigation** (Hamburger menu):
- Same items as desktop, displayed vertically
- User profile section at top
- Logout button at bottom

### Terminology

- ❌ "Sự kiện" → ✅ "Races" (cho các giải chạy)
- ❌ "Events" → ✅ "Races"
- ❌ "Bảng xếp hạng" → ✅ "Bảng vàng" (trong menu)
- ❌ "Dashboard" (English) → ✅ "Trang chủ" (trong menu)
- ❌ "Hồ sơ cá nhân" → ✅ "Thành viên" (trong menu)
- ❌ "Quy định" → ✅ "Theo dõi quà tặng" (trong menu)
- ❌ "Tài chính" → ✅ "Quỹ CLB" (trong menu)

### Component Files

- **Header**: `/components/Header.tsx` - Global navigation bar
- **Footer**: `/components/Footer.tsx` - Global footer
- **AdminLayout**: `/components/AdminLayout.tsx` - Admin panel sidebar

### Layout Structure

```
RootLayout (app/layout.tsx)
├── Header (global navigation)
├── Main Content (children)
└── Footer (global footer)
```

**Note**: Navigation component (sidebar/bottom bar) đã được loại bỏ, thay thế hoàn toàn bằng Header component.

### Admin Panel Routes

| Tên | Route | Yêu cầu Role |
|-----|-------|--------------|
| Dashboard | `/admin` | admin, mod_* |
| Quản Lý Thu/Chi | `/admin/finance` | admin, mod_finance |
| Báo Cáo Quỹ | `/admin/finance-report` | admin, mod_finance |
| Quản Lý Thử Thách | `/admin/challenges` | admin, mod_challenge |
| Giải Chạy | `/admin/races` | admin, mod_challenge, mod_member |
| Thành Viên | `/admin/members` | admin, mod_member |
| Duyệt PB | `/admin/pb-approval` | admin, mod_member |
| Cài Đặt | `/admin/settings` | admin |

### Color Scheme

- **Primary**: Orange (#f97316)
- **Primary Dark**: Orange (#ea580c)
- **Primary Light**: Orange (#fb923c)
- **Accent**: Orange (#fdba74)
- **Success**: Green
- **Danger**: Red
- **Warning**: Yellow

### Notes for Developers

1. **Luôn dùng tên route chính thức** khi tạo link/navigation
2. **Kiểm tra pathname** với `usePathname()` để highlight active menu
3. **Không hardcode tên hiển thị** - sử dụng constants nếu cần thay đổi nhiều
4. **Footer links** phải match với Header navigation
5. **Mobile menu** phải có đầy đủ items giống desktop

### Migration Notes

- ✅ Đã đổi `/events` → `/races`
- ✅ Đã loại bỏ `Navigation.tsx` (sidebar/bottom bar)
- ✅ Đã consolidate navigation vào `Header.tsx` duy nhất
- ✅ Đã thêm `Footer.tsx` vào root layout
- ✅ Đã chuẩn hóa màu orange cho toàn bộ admin panel
