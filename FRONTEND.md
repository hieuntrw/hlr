# HLR Running Club - Frontend Guide

## Overview

The frontend is built with **Next.js 14**, **TypeScript**, and **Tailwind CSS v3**. It provides three main pages for managing the running club:

1. **Dashboard** - Top 10 leaderboard with real-time progress
2. **Profile** - User profile, Strava connection, and race history
3. **Rules** - Reward definitions and financial regulations

## Project Structure

```
app/
├── globals.css              # Tailwind CSS setup
├── layout.tsx              # Root layout with navigation
├── page.tsx                # Home page with features overview
├── dashboard/
│   └── page.tsx            # Top 10 leaderboard
├── profile/
│   └── page.tsx            # User profile & race history
├── rules/
│   └── page.tsx            # Rewards & financial rules
└── api/
    └── auth/strava/        # OAuth routes

components/
├── Header.tsx              # Navigation header
├── Footer.tsx              # Footer component
└── LeaderboardRow.tsx      # Reusable leaderboard row
```

## Pages

### 1. Dashboard (`/dashboard`)

**Features:**
- Top 10 members by current month challenge progress
- Color-coded progress bars:
  - 🟢 Green: 100% complete
  - 🔵 Blue: 75-100%
  - 🟡 Amber: 50-75%
  - 🔴 Red: < 50%
- Completion badges and pace display
- Summary stats (total members, completed challenges, total km)
- Responsive grid layout

**Mock Data Structure:**
```typescript
{
  rank: number,
  name: string,
  totalKm: number,
  pace: number,        // in seconds per km
  targetKm: number
}
```

**To Connect to Supabase:**
Replace mock data in `useEffect` with:
```typescript
const { data, error } = await supabase
  .from('challenge_participants')
  .select('*, profiles(full_name)')
  .order('actual_km', { ascending: false })
  .limit(10);
```

### 2. Profile (`/profile`)

**Features:**
- Large profile card with avatar initial
- Strava connection status and connection button
- Contact information display
- Personal best records (HM/FM)
- Race history timeline with:
  - Race name and distance
  - Date, chip time, pace
  - PR (Personal Record) badge for achievements

**To Connect to Supabase:**
```typescript
// Get user profile
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

// Get race results
const { data: races } = await supabase
  .from('race_results')
  .select('*, races(name, distance)')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

### 3. Rules (`/rules`)

**Features:**
- Two-tab interface: "Rewards & Milestones" and "Financial Rules"
- **Rewards Tab:**
  - Half Marathon (21km) milestones with cash prizes
  - Full Marathon (42km) milestones with cash prizes
  - Podium finishes (1st, 2nd, 3rd place overall and by age group)
- **Financial Tab:**
  - Monthly fund contribution rules
  - Non-completion penalties
  - Completion incentives
  - Summary statistics box

**Data Structure:**
```typescript
{
  condition: string,           // e.g., "SUB 130"
  conditionTime: string,       // e.g., "1:30:00"
  prizeDescription: string,
  cashAmount: string           // VND
}
```

## Components

### Header
Navigation bar with links to all main pages. Sticky on scroll.

### LeaderboardRow
Reusable component for displaying individual leaderboard entries.

**Props:**
```typescript
{
  rank: number,
  name: string,
  avatar?: string,
  totalKm: number,
  pace: number,
  targetKm: number
}
```

### Footer
Common footer with links and contact information.

## Styling

### Color Palette
- **Primary:** `text-primary-600` (used for progress bars, links)
- **Success:** `bg-green-500` (100% progress)
- **Info:** `bg-blue-500` (75%+ progress)
- **Warning:** `bg-amber-500` (50-75% progress)
- **Danger:** `bg-red-500` (< 50% progress)
- **Accent:** `bg-orange-500` (Strava connection button)

### Responsive Design
All pages are fully responsive using Tailwind's grid system:
- Mobile (< 640px): Single column
- Tablet (640px - 1024px): 2-3 columns
- Desktop (> 1024px): Full layout

## Development

### Running Dev Server
```bash
npm run dev
# Server runs on http://localhost:3001
```

### Building for Production
```bash
npm run build
npm start
```

### Linting
```bash
npm run lint
```

## Integration Checklist

To make these pages fully functional with Supabase:

- [ ] Replace mock data with Supabase queries in Dashboard
- [ ] Implement real-time subscription for leaderboard updates
- [ ] Connect Profile page to `profiles` and `race_results` tables
- [ ] Add Strava API integration for activity sync
- [ ] Fetch reward definitions from `reward_definitions` table
Note: `reward_definitions` is retained for legacy/lucky-draw usage. New reward flows use `reward_milestones`, `member_milestone_rewards`, `reward_podium_config`, and `member_podium_rewards`.
- [ ] Add authentication check to protected routes
- [ ] Implement error handling and loading states
- [ ] Add pagination for race history

## Known Limitations

- Mock data is hardcoded in components
- No real-time updates (needs Supabase subscriptions)
- Pace calculation is simplified
- No image uploads for profiles
- Rules are static (not fetched from database)

## Future Enhancements

- Add challenge selection dropdown for historical data
- Implement race calendar view
- Add member statistics and trends
- Create admin dashboard for rule management
- Add export functionality (CSV/PDF)
- Implement dark mode toggle
- Add notifications for achievements
