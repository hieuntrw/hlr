# Supabase Integration Guide for Frontend Pages

This guide shows how to replace mock data with real Supabase queries in each page.

## Dashboard Page Integration

### Current Mock Implementation
```typescript
// Replace the useEffect in app/dashboard/page.tsx
const mockData: LeaderboardEntry[] = [
  { rank: 1, name: "Nguyễn Hải Đăng", totalKm: 285, pace: 420, targetKm: 300 },
  // ... more entries
];
```

### Real Supabase Query
```typescript
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import Header from "@/components/Header";
import LeaderboardRow from "@/components/LeaderboardRow";

interface LeaderboardEntry {
  rank: number;
  name: string;
  totalKm: number;
  pace: number;
  targetKm: number;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const connected = searchParams.get("strava_connected");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [challenge, setChallenge] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      
      // Get current challenge (latest by start_date)
      const { data: challengeData, error: challengeError } = await supabase
        .from("challenges")
        .select("id, title")
        .order("start_date", { ascending: false })
        .limit(1)
        .single();

      if (challengeError) throw challengeError;

      // Get top 10 participants
      const { data: participantsData, error: participantsError } = await supabase
        .from("challenge_participants")
        .select(
          `
          id,
          user_id,
          actual_km,
          avg_pace_seconds,
          target_km,
          profiles:user_id(full_name)
          `
        )
        .eq("challenge_id", challengeData.id)
        .order("actual_km", { ascending: false })
        .limit(10);

      if (participantsError) throw participantsError;

      // Format data for display
      const formattedLeaderboard = participantsData.map((item, index) => ({
        rank: index + 1,
        name: item.profiles.full_name,
        totalKm: item.actual_km || 0,
        pace: item.avg_pace_seconds || 600,
        targetKm: item.target_km,
      }));

      setChallenge(challengeData.title);
      setLeaderboard(formattedLeaderboard);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load leaderboard";
      setError(message);
      console.error("Leaderboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Rest of component remains the same...
}
```

### Real-Time Updates (Optional)
```typescript
// Add this to listen for live updates
useEffect(() => {
  const subscription = supabase
    .channel("challenge_participants")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "challenge_participants",
      },
      () => {
        fetchLeaderboard(); // Refresh when data changes
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

---

## Profile Page Integration

### Current Mock Implementation
```typescript
const mockProfile: UserProfile = {
  id: "user-123",
  fullName: "Nguyễn Hải Đăng",
  // ... more fields
};

const mockRaces: RaceResult[] = [
  { id: "1", raceName: "HLR Marathon 2025", ... },
  // ... more races
];
```

### Real Supabase Query
```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import Header from "@/components/Header";

interface RaceResult {
  id: string;
  raceName: string;
  distance: string;
  date: string;
  time: string;
  pace: string;
  isPR: boolean;
}

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  joinDate: string;
  isStravaConnected: boolean;
  stravaId?: string;
  pbHM?: string;
  pbFM?: string;
}

export default function Profile() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [races, setRaces] = useState<RaceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/");
        return;
      }

      // Get user profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      // Get race results with race information
      const { data: racesData, error: racesError } = await supabase
        .from("race_results")
        .select(
          `
          id,
          chip_time_seconds,
          distance,
          is_pr,
          races:race_id(name, race_date)
          `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (racesError) throw racesError;

      // Format profile data
      const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.round(seconds % 60);
        return `${hours}:${mins.toString().padStart(2, "0")}:${secs
          .toString()
          .padStart(2, "0")}`;
      };

      setProfile({
        id: profileData.id,
        fullName: profileData.full_name,
        email: profileData.email,
        phoneNumber: profileData.phone_number,
        joinDate: profileData.join_date,
        isStravaConnected: !!profileData.strava_id,
        stravaId: profileData.strava_id,
        pbHM: profileData.pb_hm_seconds
          ? formatTime(profileData.pb_hm_seconds)
          : undefined,
        pbFM: profileData.pb_fm_seconds
          ? formatTime(profileData.pb_fm_seconds)
          : undefined,
      });

      // Format races
      const formattedRaces = racesData.map((race) => ({
        id: race.id,
        raceName: race.races.name,
        distance: race.distance,
        date: race.races.race_date,
        time: formatTime(race.chip_time_seconds),
        pace: `${(race.chip_time_seconds / (parseInt(race.distance) * 1000)).toFixed(2)}/km`,
        isPR: race.is_pr,
      }));

      setRaces(formattedRaces);
    } catch (err) {
      console.error("Profile error:", err);
      // Show error UI
    } finally {
      setLoading(false);
    }
  };

  const handleConnectStrava = async () => {
    setConnecting(true);
    window.location.href = "/api/auth/strava/login";
  };

  // Rest of component remains the same...
}
```

---

## Rules Page Integration

### Current Static Implementation
```typescript
const hmRewards = [
  { condition: "SUB 130", conditionTime: "1:30:00", ... },
  // ... more static data
];
```

### Real Supabase Query (Optional)
```typescript
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import Header from "@/components/Header";

export default function Rules() {
  const [activeTab, setActiveTab] = useState<"rewards" | "fees">("rewards");
  const [hmRewards, setHmRewards] = useState([]);
  const [fmRewards, setFmRewards] = useState([]);
  const [fundingRules, setFundingRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRulesData();
  }, []);

  const fetchRulesData = async () => {
    try {
      // Get reward definitions
      const { data: rewards, error: rewardsError } = await supabase
        .from("reward_definitions")
        .select("*")
        .order("category, priority_level");

      if (rewardsError) throw rewardsError;

      // Separate HM and FM rewards
      const hm = rewards.filter((r) => r.category === "HM");
      const fm = rewards.filter((r) => r.category === "FM");

      setHmRewards(hm);
      setFmRewards(fm);

      // Get system settings
      const { data: settings, error: settingsError } = await supabase
        .from("system_settings")
        .select("key, value");

      if (settingsError) throw settingsError;

      // Format funding rules from settings
      const settingsMap = Object.fromEntries(
        settings.map((s) => [s.key, s.value])
      );

      setFundingRules([
        {
          title: "Đóng quỹ hàng tháng",
          amount: `${settingsMap.monthly_fund_fee} VND`,
          description:
            "Mỗi thành viên hoạt động phải đóng quỹ mỗi tháng",
          details: "Dùng để tổ chức các giải đấu và quản lý CLB",
        },
        {
          title: "Phạt không hoàn thành thách thức",
          amount: `${settingsMap.challenge_fine_fee} VND`,
          description: "Nếu không đạt mục tiêu km hàng tháng sẽ bị phạt",
          details:
            "Mục tiêu mặc định: 100km/tháng (có thể chọn các mục tiêu khác)",
        },
        // ... more rules
      ]);
    } catch (err) {
      console.error("Rules error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Rest of component remains the same...
}
```

---

## Common Patterns

### Format Time Seconds to HH:MM:SS
```typescript
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  return `${hours}:${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};
```

### Format Pace (seconds per km)
```typescript
const formatPace = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/km`;
};
```

### Check User Authentication
```typescript
useEffect(() => {
  const checkAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/"); // Redirect to home if not logged in
    }
  };
  checkAuth();
}, []);
```

### Handle Supabase Errors
```typescript
try {
  const { data, error } = await supabase
    .from("table_name")
    .select("*");

  if (error) {
    console.error("Supabase error:", error.message);
    setError("Failed to load data");
    return;
  }

  // Process data...
} catch (err) {
  console.error("Unexpected error:", err);
  setError("An unexpected error occurred");
}
```

---

## Testing Queries with SQL Editor

Test these queries in Supabase SQL editor before integrating:

### Get Top 10 Leaderboard for Current Challenge
```sql
SELECT 
  ROW_NUMBER() OVER (ORDER BY cp.actual_km DESC) as rank,
  p.full_name,
  cp.actual_km,
  cp.avg_pace_seconds,
  cp.target_km
FROM challenge_participants cp
JOIN profiles p ON cp.user_id = p.id
JOIN challenges c ON cp.challenge_id = c.id
WHERE c.id = (
  SELECT id FROM challenges 
  ORDER BY start_date DESC 
  LIMIT 1
)
ORDER BY cp.actual_km DESC
LIMIT 10;
```

### Get User Profile and Race History
```sql
SELECT 
  p.*,
  rr.id as race_id,
  rr.chip_time_seconds,
  rr.distance,
  rr.is_pr,
  r.name as race_name,
  r.race_date
FROM profiles p
LEFT JOIN race_results rr ON p.id = rr.user_id
LEFT JOIN races r ON rr.race_id = r.id
WHERE p.id = $1
ORDER BY r.race_date DESC;
```

---

## Environment Variables Required

Make sure these are in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

**Next Steps**:
1. Start with Dashboard integration (highest impact)
2. Move to Profile page (user-specific data)
3. Keep Rules page static (reference data, can be fetched later)
4. Implement error boundaries and loading states
5. Add real-time subscriptions for live updates
