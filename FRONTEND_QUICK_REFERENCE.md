# Frontend Quick Reference Card

## URL Routes

| Page | Route | Purpose |
|------|-------|---------|
| Homepage | `/` | Landing page with feature overview |
| Dashboard | `/dashboard` | Top 10 leaderboard |
| Profile | `/profile` | User profile & race history |
| Rules | `/rules` | Rewards & financial regulations |

## Component Imports

```typescript
// Navigation
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// Leaderboard
import LeaderboardRow from "@/components/LeaderboardRow";

// UI Utilities
import {
  UIColors,
  FormattedTime,
  ProgressIndicator,
  MedalBadge,
  DataCard,
  StatBox,
  getProgressColor,
  getProgressBgColor,
} from "@/components/UIUtils";

// Supabase
import { supabase } from "@/lib/supabase-client";
```

## Common Code Patterns

### Progress Bar (100%)
```tsx
<div className="w-full bg-gray-200 rounded-full h-3">
  <div 
    className="h-full bg-green-500"
    style={{ width: `${percentage}%` }}
  ></div>
</div>
```

### Medal Badge
```tsx
<div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white bg-yellow-500">
  🥇
</div>
```

### Data Card
```tsx
<div className="bg-white rounded-lg border border-gray-200 p-6">
  <h3 className="font-semibold text-gray-900">{title}</h3>
  <p className="text-gray-600">{description}</p>
</div>
```

### Gradient Background
```tsx
<div className="bg-gradient-to-br from-primary-400 to-primary-600 rounded-full">
  {/* Content */}
</div>
```

## Tailwind Classes Cheat Sheet

### Colors
```
Text: text-gray-900, text-primary-600, text-green-600
Background: bg-white, bg-gray-50, bg-gradient-to-br from-... to-...
Border: border-gray-200, border-2, border-green-500
```

### Sizing
```
Padding: p-4, p-6, px-6 py-4
Margin: m-4, mb-2, gap-4
Width: w-full, w-12, w-max
Height: h-screen, h-64, h-12
```

### Layout
```
Flex: flex, flex-col, items-center, justify-between
Grid: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3
```

### Effects
```
Shadow: shadow, shadow-lg, hover:shadow-xl
Rounded: rounded, rounded-lg, rounded-full
Hover: hover:bg-blue-600, hover:text-blue-700
```

## Mock Data Template

### Leaderboard Entry
```typescript
{
  rank: 1,
  name: "Name Here",
  totalKm: 285,
  pace: 420,        // seconds/km
  targetKm: 300
}
```

### Race Result
```typescript
{
  id: "1",
  raceName: "Race Name",
  distance: "42km",
  date: "2025-10-26",
  time: "3:28:15",
  pace: "4:56/km",
  isPR: true
}
```

### Profile
```typescript
{
  id: "uuid",
  fullName: "Name",
  email: "email@example.com",
  phoneNumber: "+84...",
  joinDate: "2024-01-15",
  isStravaConnected: true,
  pbHM: "1:35:42",
  pbFM: "3:28:15"
}
```

## Color Palette Reference

| Use Case | Tailwind | Color | Hex |
|----------|----------|-------|-----|
| Success | `bg-green-500` | Green | #10B981 |
| Info | `bg-blue-500` | Blue | #3B82F6 |
| Warning | `bg-amber-500` | Amber | #F59E0B |
| Danger | `bg-red-500` | Red | #EF4444 |
| Primary | `text-primary-600` | - | - |

## Breaking Points

```
Mobile:  < 640px    (sm)
Tablet:  640-1024px (md, lg)
Desktop: > 1024px   (xl, 2xl)
```

**Usage**: `md:grid-cols-2` means 2 columns on tablet and up

## States & Styling

### Loading
```tsx
<div className="flex items-center justify-center h-64">
  <div className="text-gray-500">Đang tải...</div>
</div>
```

### Error
```tsx
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <p className="text-red-900">Lỗi: {error}</p>
</div>
```

### Empty State
```tsx
<div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
  <p className="text-gray-600">Không có dữ liệu</p>
</div>
```

## Response Size Optimization

```
❌ Avoid: Import entire components
✅ Do: Import specific functions

❌ Avoid: Multiple useState for related data
✅ Do: Single object state

❌ Avoid: Unnecessary re-renders
✅ Do: Use useCallback, useMemo for heavy operations
```

## Debugging Tips

```bash
# Check build errors
npm run build

# Type checking
npx tsc --noEmit

# Tailwind classes not working?
# 1. Clear .next folder: rm -rf .next
# 2. Restart dev server
# 3. Check tailwind.config.js content paths

# Component not updating?
# 1. Check useEffect dependencies
# 2. Verify state updates
# 3. Check React DevTools
```

## File Location Quick Links

```
Homepage:  /workspaces/hlr/app/page.tsx
Dashboard: /workspaces/hlr/app/dashboard/page.tsx
Profile:   /workspaces/hlr/app/profile/page.tsx
Rules:     /workspaces/hlr/app/rules/page.tsx

Components: /workspaces/hlr/components/
Styles:     /workspaces/hlr/app/globals.css
Config:     /workspaces/hlr/tailwind.config.js
```

## Commands Cheat Sheet

```bash
# Development
npm run dev              # Start dev server on :3001

# Production
npm run build            # Build for production
npm start               # Run production server

# Quality
npm run lint            # Run ESLint

# Utilities
npm install             # Install dependencies
npm install -D pkg      # Install dev dependency
npm uninstall pkg       # Remove package
npm update              # Update all packages
```

## Resources

- **Tailwind Docs**: https://tailwindcss.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **React Docs**: https://react.dev
- **TypeScript Docs**: https://www.typescriptlang.org/docs

---

**Last Updated**: November 29, 2025
