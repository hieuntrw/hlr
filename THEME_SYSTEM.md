# Theme System Documentation

## 📋 Tổng Quan

Hệ thống theme HLR Running Club cho phép:
- **Admin** tùy chỉnh màu sắc, font chữ, kích thước cho toàn hệ thống
- **User** (tương lai) có thể cá nhân hóa giao diện riêng
- Dễ dàng chuyển đổi giữa các theme preset (Orange, Blue, Green)
- Lưu trữ preferences vào database với Supabase

## 🏗️ Kiến Trúc

### 1. Core Files

```
lib/theme/
├── types.ts              # TypeScript interfaces
├── defaultTheme.ts       # Preset themes (Orange, Blue, Green)
├── ThemeContext.tsx      # React Context Provider
└── index.ts              # Public exports

app/
├── globals.css           # CSS variables
└── layout.tsx            # ThemeProvider wrapper

supabase/migrations/
└── 20251203_add_user_theme_preferences.sql
```

### 2. Theme Structure

```typescript
interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;      // 20+ color variables
  fonts: ThemeFonts;        // Font families, sizes, weights
  spacing: ThemeSpacing;    // Space, radius, shadows
}
```

## 🎨 Sử Dụng Theme

### Basic Usage - Sử dụng CSS Variables

Thay vì hardcode colors, dùng CSS variables:

```tsx
// ❌ Cũ - Hardcoded
<div className="bg-orange-600 text-white">

// ✅ Mới - Theme variables
<div className="bg-theme-primary text-theme-inverse">

// Hoặc inline style
<div style={{ 
  backgroundColor: 'var(--color-primary)',
  color: 'var(--color-text-inverse)'
}}>
```

### Utility Classes

Đã có sẵn các utility classes:

```css
.text-theme-primary      /* color: var(--color-primary) */
.bg-theme-primary        /* background: var(--color-primary) */
.border-theme-primary    /* border-color: var(--color-primary) */
.gradient-theme-primary  /* gradient with primary colors */
.shadow-theme            /* box-shadow: var(--shadow-md) */
.rounded-theme           /* border-radius: var(--radius-lg) */
```

### React Hook - useTheme()

```tsx
import { useTheme } from '@/lib/theme';

function MyComponent() {
  const { theme, setTheme, applyCustomizations } = useTheme();
  
  // Access theme values
  console.log(theme.colors.primary);  // #F97316
  
  // Change entire theme
  setTheme(blueTheme);
  
  // Customize specific values
  applyCustomizations({
    colors: { primary: '#FF0000' }
  });
}
```

## 🔧 Admin Configuration

### Truy cập trang cấu hình:

```
/admin/theme-settings
```

**Quyền truy cập:** Chỉ admin (role = 'admin' trong profiles table)

### Chức năng:

1. **Preset Themes** - Chọn Orange, Blue, hoặc Green theme
2. **Color Picker** - Tùy chỉnh 20+ màu sắc
3. **Font Sizes** - Điều chỉnh 9 size từ xs → 5xl
4. **Live Preview** - Xem preview ngay khi thay đổi
5. **Save to Database** - Lưu vào `user_theme_preferences` table
6. **Reset** - Quay về theme mặc định

## 💾 Database Schema

```sql
CREATE TABLE user_theme_preferences (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    theme_id TEXT DEFAULT 'hlr-default',
    custom_colors JSONB,
    custom_fonts JSONB,
    custom_spacing JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

**RLS Policies:**
- Users: Read/Write own preferences
- Admins: Read all preferences

## 🎯 Roadmap - Tính Năng Tương Lai

### Phase 1 (Hiện tại)
- ✅ Theme system architecture
- ✅ CSS variables
- ✅ Admin theme editor
- ✅ Database storage

### Phase 2 (Tương lai)
- [ ] User personalization (mỗi user có theme riêng)
- [ ] System-wide default theme (admin set cho tất cả users)
- [ ] Theme marketplace (upload/download themes)
- [ ] Dark mode toggle
- [ ] Accessibility presets (high contrast, large text)

### Phase 3 (Nâng cao)
- [ ] Color scheme generator (AI-powered)
- [ ] Theme preview before apply
- [ ] Export/Import theme files
- [ ] Theme versioning & rollback

## 🔄 Migration Guide

### Cập nhật code hiện tại sang theme system:

#### Before (Hardcoded):
```tsx
<div className="bg-orange-600 text-white">
  <h2 className="text-2xl font-bold">Header</h2>
</div>
```

#### After (Theme-aware):
```tsx
<div className="bg-theme-primary text-theme-inverse">
  <h2 style={{ fontSize: 'var(--font-size-2xl)' }} className="font-bold">
    Header
  </h2>
</div>
```

### Gradient Headers:
```tsx
// Thay vì: bg-gradient-to-r from-orange-500 to-orange-600
// Dùng: gradient-theme-primary

<div className="gradient-theme-primary rounded-lg p-4 shadow-lg">
  <h3 className="text-2xl font-bold text-white">Section Title</h3>
</div>
```

## 📊 Performance

- **CSS Variables**: No runtime overhead, pure CSS
- **Context Loading**: Async load from DB, fallback to localStorage
- **Hydration**: Suppressed warnings for theme initialization
- **Bundle Size**: ~5KB added (theme logic + types)

## 🐛 Troubleshooting

### Theme không apply sau khi save?
- Kiểm tra RLS policies trong Supabase
- Xem console có error không
- Verify user_id trong database

### CSS variables không hoạt động?
- Đảm bảo ThemeProvider wrap toàn bộ app
- Check globals.css đã import đúng chưa
- Hard refresh browser (Ctrl+Shift+R)

### Admin page không accessible?
- Verify user có role = 'admin' trong profiles table
- Check RLS policies cho profiles table

## 📞 Support

- **Issues**: Tạo issue trong repo
- **Questions**: Contact admin team
- **Docs**: Đọc code comments trong `/lib/theme/`

---

**Last Updated:** December 3, 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
