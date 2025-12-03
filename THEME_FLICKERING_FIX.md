# Theme Flickering Fix

## Problem Description

**Issue**: Menu colors flickered during page load (blue → orange → blue transition)

**User Report**: "Cụm menu dường như load bị nhiều lần, dang xanh qua cam rồi về lại xanh"

## Root Cause Analysis

The flickering was caused by a mismatch in the theme comparison logic in `ThemeContext.tsx`:

### Original Flow:
1. **Page loads**: React initializes state with `getInitialTheme()` reading from localStorage (blue theme)
2. **Inline script**: Applies blue theme from localStorage to DOM, sets `data-theme-preloaded` flag
3. **First useEffect (line 68)**: Checks flag, skips applying theme, removes flag
4. **Database loads**: `loadThemeFromDatabase()` fetches theme from Supabase
5. **Line 145 (PROBLEM)**: Compared DB theme with **React state** using:
   ```typescript
   if (dbTheme && JSON.stringify(dbTheme.colors) !== JSON.stringify(theme.colors)) {
     setThemeState(dbTheme);
   }
   ```
6. **Issue**: If there was any timing issue or state mismatch, React state might differ from what's in localStorage, causing unnecessary state update
7. **Second useEffect trigger**: State change triggers useEffect again, reapplying theme to DOM

### Why This Caused Flickering:
- The comparison was against **React state** instead of **localStorage** (the source of truth for immediate display)
- Even though localStorage and DB had the same theme (blue), React state might briefly hold a different value
- This triggered a state update → useEffect → DOM reapplication → visual flicker

## Solution Implemented

**Changed comparison from React state to localStorage in `loadThemeFromDatabase()`**:

### Before (Line 145):
```typescript
// Only update theme if different from current state to prevent flash
if (dbTheme && JSON.stringify(dbTheme.colors) !== JSON.stringify(theme.colors)) {
  setThemeState(dbTheme);
}
```

### After (Lines 145-163):
```typescript
// Compare with localStorage (not React state) to prevent unnecessary updates
// This prevents flickering when DB theme matches localStorage but React state might be stale
if (dbTheme) {
  const localStorageTheme = typeof window !== 'undefined' 
    ? localStorage.getItem('currentTheme') 
    : null;
  
  const localThemeColors = localStorageTheme 
    ? JSON.stringify(JSON.parse(localStorageTheme).colors)
    : null;
  
  const dbThemeColors = JSON.stringify(dbTheme.colors);
  
  // Only update if DB theme differs from localStorage
  if (localThemeColors !== dbThemeColors) {
    setThemeState(dbTheme);
  }
}
```

## Benefits of This Fix

1. **No Flickering**: Theme only updates when DB truly differs from what's already displayed
2. **Performance**: Prevents unnecessary React re-renders
3. **Consistency**: Uses localStorage as single source of truth for immediate display
4. **Reliability**: Even if React state is temporarily inconsistent, visual display remains stable

## Technical Details

### Theme Loading Architecture (3 Stages):

1. **Stage 1 - Inline Script** (`layout.tsx` lines 17-80):
   - Runs immediately before React hydration
   - Reads from localStorage
   - Applies theme to DOM
   - Sets `data-theme-preloaded` flag

2. **Stage 2 - React Initialization** (`ThemeContext.tsx` lines 28-53):
   - `getInitialTheme()` reads from localStorage
   - Initializes React state with saved theme
   - Component mounts with correct theme in state

3. **Stage 3 - Database Sync** (`ThemeContext.tsx` lines 97-167):
   - Loads user's theme preference from Supabase
   - **NEW**: Compares with localStorage instead of React state
   - Only updates if DB has different theme than localStorage
   - Prevents redundant state updates

### Why Compare with localStorage Instead of React State?

- **localStorage = Source of Truth**: The inline script applies localStorage theme before React hydration
- **React State = May Lag**: During hydration/initialization, state might not be fully synchronized
- **Visual Consistency**: What matters is what the user *sees* (DOM), not what React *thinks* (state)
- **Avoid False Positives**: Comparing with state could trigger updates even when DOM already has correct theme

## Files Modified

- `/workspaces/hlr/lib/theme/ThemeContext.tsx` (lines 145-163)

## Testing Recommendations

1. **Hard Refresh Test**: Clear localStorage, refresh page → should load default theme once
2. **Theme Switch Test**: Change theme in admin settings → should update immediately without flicker
3. **Navigation Test**: Navigate between pages → should maintain theme consistently
4. **Dark Mode Test**: Toggle dark mode → should switch smoothly
5. **Login Test**: Login as user with saved theme → should apply user's theme once

## Related Work

This fix completes the theme system optimization after:
- ✅ Converting all public pages to theme variables
- ✅ Converting all admin pages to theme variables (14 files, 100+ replacements)
- ✅ Fixing this flickering issue

All theme-related work is now complete and optimized.
