"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
// Use server APIs instead of direct client Supabase to avoid PostgREST/Kong issues
import { Trophy, Target, Star, Award } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole } from "@/lib/auth/role";
import { supabase } from "@/lib/supabase-client";

interface UserProfile {
  id: string;
  full_name: string | null;
  strava_id: string | null;
  role?: string;
  email?: string | null;
  pb_5k_seconds: number | null;
  pb_10k_seconds: number | null;
  pb_half_marathon_seconds: number | null;
  pb_full_marathon_seconds: number | null;
}

interface PersonalStats {
  totalKm: number;
  avgPace: string | null;
  targetKm: number;
  progressPercent: number;
  completionRate?: number;
  challengeName: string;
  status: "not_joined" | "in_progress" | "completed" | "failed";
}

interface HallOfFameEntry {
  rank: number;
  name: string;
  time: string;
  distance: string;
}

interface FinanceStatus {
  balance: number;
  unpaidFees: number;
  unpaidFines: number;
  hasOutstanding: boolean;
}

interface YearlyStats {
  totalKm: number;
  totalStars: number;
  challengesJoined: number;
  challengesCompleted: number;
}

interface Notification {
  id: string;
  message: string;
  type: "info" | "warning" | "success";
  date: string;
}


function DashboardContent() {
  const router = useRouter();
  const { user, profile, isLoading: authLoading, sessionChecked } = useAuth(); // Thêm profile từ AuthContext

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [personalStats, setPersonalStats] = useState<PersonalStats>({
    totalKm: 0,
    avgPace: null,
    targetKm: 0,
    progressPercent: 0,
    completionRate: 0,
    challengeName: "",
    status: "not_joined",
  });
  const [hallOfFame, setHallOfFame] = useState<HallOfFameEntry[]>([]);
  const [financeStatus, setFinanceStatus] = useState<FinanceStatus>({
    balance: 0,
    unpaidFees: 0,
    unpaidFines: 0,
    hasOutstanding: false,
  });
  const [yearlyStats, setYearlyStats] = useState<YearlyStats>({
    totalKm: 0,
    totalStars: 0,
    challengesJoined: 0,
    challengesCompleted: 0,
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [, setPersonalStatsLoading] = useState(true);
  const [hallOfFameLoading, setHallOfFameLoading] = useState(true);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [yearlyStatsLoading, setYearlyStatsLoading] = useState(true);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  // Format time in seconds to HH:MM:SS
  const formatTime = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) return "—";
    const secNum = Math.max(0, Math.floor(Number(seconds)));
    const h = Math.floor(secNum / 3600);
    const m = Math.floor((secNum % 3600) / 60);
    const s = secNum % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isFullMarathon = (distance: string) => {
    if (!distance) return false;
    const d = distance.toLowerCase();
    if (d === "fm" || d === "full marathon") return true;
    if (d.includes("full") && d.includes("marathon")) return true;
    if (d.includes("42") || d.includes("42.195")) return true;
    return false;
  };

  // Fetch Hall of Fame (top 3 per distance)
  const fetchHallOfFame = useCallback(async () => {
    try {
      setHallOfFameLoading(true);
      try {
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        const resp = await fetch(`${base}/api/hall-of-fame`, { credentials: 'same-origin', cache: 'no-store' });
        const j = await resp.json().catch(() => null);
          if (resp.ok && j?.ok && Array.isArray(j.data)) {
            const mapped = j.data.map((r: unknown) => {
              const row = r as Record<string, unknown>;
              return {
                rank: Number(row.rank ?? 0),
                name: String(row.name ?? ''),
                time: formatTime(Number(row.time_seconds ?? 0)),
                distance: String(row.distance ?? ''),
              } as HallOfFameEntry;
            });
            // Prioritize Full Marathon (FM) entries first, then by rank
            const sorted = mapped.sort((a: HallOfFameEntry, b: HallOfFameEntry) => {
              const aFM = isFullMarathon(a.distance) ? 0 : 1;
              const bFM = isFullMarathon(b.distance) ? 0 : 1;
              if (aFM !== bFM) return aFM - bFM;
              return a.rank - b.rank;
            });
            // Take top 3 FM and top 3 HM to show concise Hall of Fame on dashboard
            const fmEntries = sorted.filter((e: HallOfFameEntry) => isFullMarathon(e.distance)).slice(0, 3);
            const hmEntries = sorted.filter((e: HallOfFameEntry) => !isFullMarathon(e.distance)).slice(0, 3);
            // Recompute ranks per-distance so FM shows 1..n and HM shows 1..n
            const fmMapped = fmEntries.map((e: HallOfFameEntry, i: number) => ({ ...e, rank: i + 1 }));
            const hmMapped = hmEntries.map((e: HallOfFameEntry, i: number) => ({ ...e, rank: i + 1 }));
            setHallOfFame([...fmMapped, ...hmMapped]);
          } else {
          console.warn('[Dashboard] hall-of-fame API failed', j);
        }
      } catch (e) {
        console.error('[Dashboard] hall-of-fame fetch error', e);
      }
    } catch (err) {
      console.error("Failed to fetch hall of fame:", err);
    } finally {
      setHallOfFameLoading(false);
    }
  }, []);

  // Fetch personal challenge stats
  const fetchPersonalStats = useCallback(async () => {
    try {
      setPersonalStatsLoading(true);
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
      const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

      if (!user) return;

      // Prefer server endpoints to fetch the current challenge and participation
      // to avoid client-side direct PostgREST calls which may fail in dev.
      try {
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        const listResp = await fetch(`${base}/api/challenges?my=true`, { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (!listResp.ok) {
          console.warn('Failed to fetch my challenges for personal stats', listResp.status);
          setPersonalStats((prev) => ({ ...prev, status: 'not_joined', challengeName: 'Chưa có thử thách tháng này' }));
          return;
        }
        const listJson = await listResp.json().catch(() => null);
        const myChallenges = (listJson?.challenges || []) as unknown[];
        // Find this month's challenge among the returned participations
        const current = (myChallenges.find((c: unknown) => {
          const row = c as Record<string, unknown>;
          const s = typeof row.start_date === 'string' ? row.start_date.slice(0,10) : undefined;
          return typeof s === 'string' && s >= startDate && s <= endDate;
        }) || null) as Record<string, unknown> | null;

        if (!current) {
          // Not joined or no challenge this month
          // Try to fetch public challenge name for display
          const pubResp = await fetch(`${base}/api/challenges`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
          let pubName = 'Chưa có thử thách tháng này';
          if (pubResp.ok) {
            const pubJson = await pubResp.json().catch(() => null);
            const foundArr = (pubJson?.challenges || []) as unknown[];
            const found = foundArr.find((c: unknown) => {
              const row = c as Record<string, unknown>;
              const s = typeof row.start_date === 'string' ? row.start_date.slice(0,10) : undefined;
              return typeof s === 'string' && s >= startDate && s <= endDate;
            });
            if (found) {
              const rf = found as Record<string, unknown>;
              pubName = String(rf.title ?? rf.name ?? pubName);
            }
          }
          setPersonalStats((prev) => ({ ...prev, status: 'not_joined', challengeName: pubName }));
          return;
        }

        // current contains participant-augmented challenge data
        const totalKm = Number(current.actual_km) || 0;
        const targetKm = Number(current.target_km) || 0;
        const avgPaceSeconds = Number(current.avg_pace_seconds) || 0;
        const avgPace = avgPaceSeconds > 0 ? `${Math.floor(avgPaceSeconds / 60)}:${String(avgPaceSeconds % 60).padStart(2,'0')}` : null;

        let completionRate = 0;
        if (current.completion_rate !== undefined && current.completion_rate !== null) {
          completionRate = Number(current.completion_rate) || 0;
        } else {
          completionRate = targetKm > 0 ? (totalKm / targetKm) : 0;
        }
        const progressPercent = Math.round(completionRate);

        setPersonalStats({
          totalKm,
          avgPace,
          targetKm,
          progressPercent,
          completionRate,
          challengeName: String((current as Record<string, unknown>)?.title ?? (current as Record<string, unknown>)?.name ?? 'Thử thách tháng này'),
          status: Boolean((current as Record<string, unknown>)?.completed) ? 'completed' : (Boolean((current as Record<string, unknown>)?.user_participates) ? 'in_progress' : 'not_joined'),
        });
      } catch (e) {
        console.error('Failed to compute personal stats via server endpoints', e);
        setPersonalStats((prev) => ({ ...prev, status: 'not_joined', challengeName: 'Chưa có thử thách tháng này' }));
      }
    } catch (err) {
      console.error("Failed to fetch personal stats:", err);
    } finally {
      setPersonalStatsLoading(false);
    }
  }, [user]);

  // Fetch finance status
  const fetchFinanceStatus = useCallback(async () => {
    try {
      setFinanceLoading(true);
      // Using user from AuthContext
      if (!user) return;
      try {
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        const resp = await fetch(`${base}/api/profile/transactions`, { credentials: 'same-origin' });
        const j = await resp.json().catch(() => null);
        if (resp.ok && j?.ok) {
          const summary = j.summary || { balance: 0, unpaidFees: 0, unpaidFines: 0 };
          setFinanceStatus({
            balance: Number(summary.balance || 0),
            unpaidFees: Number(summary.unpaidFees || 0),
            unpaidFines: Number(summary.unpaidFines || 0),
            hasOutstanding: (Number(summary.unpaidFees || 0) > 0) || (Number(summary.unpaidFines || 0) > 0),
          });
        } else {
          console.warn('[Dashboard] transactions API failed', j);
        }
      } catch (e) {
        console.error('[Dashboard] transactions fetch error', e);
      }
    } catch (err) {
      console.error("Failed to fetch finance status:", err);
    } finally {
      setFinanceLoading(false);
    }
  }, [user]);

  // Fetch yearly stats
  const fetchYearlyStats = useCallback(async () => {
    try {
      setYearlyStatsLoading(true);
      // Using user from AuthContext
      if (!user) return;

      const year = new Date().getFullYear();
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Get all participations for this year
       const { data: participations } = await supabase
         .from("challenge_participants")
         .select("actual_km, status, challenge_id, challenges(start_date)")
         .eq("user_id", user.id);

      if (participations) {
         const filtered = (participations || []).filter((p: unknown) => {
           const pi = p as Record<string, unknown>;
           const ch = pi.challenges as Record<string, unknown> | undefined;
           if (!ch || !ch.start_date) return false;
           const sd = String(ch.start_date).slice(0, 10);
           return sd >= startDate && sd <= endDate;
         });
         const totalKm = filtered.reduce((sum, p) => sum + (Number(p.actual_km) || 0), 0);
        const challengesJoined = participations.length;
        const challengesCompleted = participations.filter((p) => p.status === "completed").length;

        // Get total stars via server summary endpoint (avoids direct PostgREST queries)
        let totalStars = 0;
        try {
          const base = typeof window !== 'undefined' ? window.location.origin : '';
          const resp = await fetch(`${base}/api/profile/rewards-summary?start=${startDate}&end=${endDate}`, { credentials: 'same-origin', cache: 'no-store' });
          const j = await resp.json().catch(() => null);
          if (resp.ok && j?.ok) {
            totalStars = Number(j.star_total || 0);
          } else {
            console.warn('[Dashboard] rewards-summary API failed', j);
          }
        } catch (e) {
          console.error('[Dashboard] rewards-summary fetch error', e);
        }
        setYearlyStats({ totalKm: Math.round(totalKm), totalStars, challengesJoined, challengesCompleted });
      }
    } catch (err) {
      console.error("Failed to fetch yearly stats:", err);
    } finally {
      setYearlyStatsLoading(false);
    }
  }, [user]);

  const fetchUserProfile = useCallback(async () => {
    try {
      if (!user) return;
      // Prefer lookup by email (more reliable across migrations), then by id.
      if (user.email) {
                 const { data: byEmail } = await supabase
                   .from("profiles")
                   .select(
                     "id, full_name, email, phone, birth_date, avatar_url, pb_hm_seconds, pb_fm_seconds, strava_id"
                   )
                   .eq("email", user.email)
                   .maybeSingle();
                 if (byEmail) return byEmail;
               }
      console.log("[DEBUG] User ID:", user.id, "Email:", user.email);

      // Truy vấn bảng profiles theo user.id (trường id của bảng profiles tương ứng với auth user id)
      // Nếu không tìm thấy bằng id thì fallback sang tìm bằng email.
      let profileResult: Record<string, unknown> | null = null;

      const { data: profileById, error: errById } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      if (errById) console.warn('[DEBUG] Error fetching profile by id', errById);

      if (profileById) {
        profileResult = profileById as Record<string, unknown>;
      } else if (user.email) {
        const { data: profileByEmail, error: errByEmail } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("email", user.email)
          .maybeSingle();

        if (errByEmail) console.warn('[DEBUG] Error fetching profile by email', errByEmail);

        if (profileByEmail) {
          profileResult = profileByEmail as Record<string, unknown>;
        }
      }

      console.log("[DEBUG] Profile lookup result:", profileResult);

      if (profileResult) {
        setUserProfile({
          id: String(profileResult['id'] ?? ''),
          full_name: (profileResult['full_name'] as string) ?? null,
          email: user.email ?? null,
          strava_id: null,
          role: getEffectiveRole(user as unknown as Record<string, unknown>) || 'member',
          pb_5k_seconds: null,
          pb_10k_seconds: null,
          pb_half_marathon_seconds: null,
          pb_full_marathon_seconds: null,
        });
        console.log("[DEBUG] Đã set userProfile với full_name:", profileResult.full_name);
      } else {
        console.log("[DEBUG] Không tìm thấy profile cho user:", user.id, user.email);
      }
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  // Fetch notifications (mock for now)
  const fetchNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setTimeout(() => {
      setNotifications([
        {
          id: "1",
          message: "Giải chạy HLR Marathon sắp diễn ra ngày 15/12!",
          type: "info",
          date: new Date().toISOString(),
        },
        {
          id: "2",
          message: "Nhắc nhở: Đóng quỹ tháng 12 trước ngày 10/12",
          type: "warning",
          date: new Date().toISOString(),
        },
        {
          id: "3",
          message: "Chúc mừng 5 thành viên đạt PB mới tuần này!",
          type: "success",
          date: new Date().toISOString(),
        },
      ]);
      setNotificationsLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    if (authLoading || !sessionChecked) return;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent("/dashboard")}`);
      return;
    }
    // Ưu tiên dùng profile từ AuthContext nếu có
    if (profile) {
      setUserProfile({
        id: profile.id,
        full_name: profile.full_name,
        email: user.email ?? null,
        strava_id: null,
        role: getEffectiveRole(user as unknown as Record<string, unknown>) || 'member',
        pb_5k_seconds: null,
        pb_10k_seconds: null,
        pb_half_marathon_seconds: null,
        pb_full_marathon_seconds: null,
      });
      setProfileLoading(false);
    } else {
      fetchUserProfile();
    }
    fetchPersonalStats();
    fetchHallOfFame();
    fetchFinanceStatus();
    fetchYearlyStats();
    fetchNotifications();
  }, [user, profile, authLoading, sessionChecked, router, fetchPersonalStats, fetchHallOfFame, fetchFinanceStatus, fetchYearlyStats, fetchUserProfile, fetchNotifications]);

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return "bg-green-600";
    if (percent >= 80) return "bg-green-500";
    if (percent >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">✓ Hoàn thành</span>;
      case "in_progress":
        return <span className="px-2 py-1 text-xs rounded-full" style={{ background: "var(--color-info-bg, #DBEAFE)", color: "var(--color-info, #1E40AF)" }}>⏳ Đang thực hiện</span>;
      case "failed":
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">✗ Chưa đạt</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">Chưa tham gia</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Welcome Section */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Xin chào, {profileLoading ? (
                <span className="h-6 w-32 bg-gray-200 rounded animate-pulse inline-block" />
              ) : (
                (profile?.full_name ?? userProfile?.full_name ?? user?.email ?? "Thành viên")
              )}! 👋
            </h1>
            <p className="text-gray-600 mt-1">Chào mừng bạn quay lại với Hải Lăng Runners</p>
          </div>

        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          {/* Left Column - Personal Challenge & Yearly Stats */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Personal Challenge Widget */}
            <div className="rounded-xl shadow-lg border p-6" style={{ background: "var(--color-bg-secondary)", borderColor: "var(--color-border)" }}>
              <div className="rounded-lg p-4 mb-6 shadow-lg gradient-theme-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                    <h2 className="text-xl font-bold text-white">Thử thách tháng này</h2>
                  </div>
                  <a
                    href="/challenges"
                    className="text-sm font-medium px-3 py-1 rounded-lg"
                    style={{ color: "var(--color-text-inverse)", background: "rgba(255,255,255,0.2)" }}
                  >
                    Chi tiết →
                  </a>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{personalStats.challengeName}</h3>
                  {getStatusBadge(personalStats.status)}
                </div>
              </div>

              {personalStats.status === "not_joined" ? (
                <div className="text-center py-8">
                  <p className="mb-4" style={{ color: "var(--color-text-secondary)" }}>Bạn chưa tham gia thử thách tháng này</p>
                  <a
                    href="/challenges"
                    className="inline-block px-6 py-2 rounded-lg transition"
                    style={{ background: "var(--color-primary)", color: "var(--color-text-inverse)" }}
                  >
                    Tham gia ngay
                  </a>
                </div>
              ) : (
                <div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="rounded-lg p-3" style={{ background: "var(--color-bg-secondary)" }}>
                      <p className="text-xs mb-1" style={{ color: "var(--color-text-secondary)" }}>Tổng KM</p>
                      <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{personalStats.totalKm.toFixed(1)}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: "var(--color-bg-secondary)" }}>
                      <p className="text-xs mb-1" style={{ color: "var(--color-text-secondary)" }}>Mục tiêu</p>
                      <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{personalStats.targetKm}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: "var(--color-bg-secondary)" }}>
                      <p className="text-xs mb-1" style={{ color: "var(--color-text-secondary)" }}>Pace TB</p>
                      <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{personalStats.avgPace || "—"}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Tiến độ</span>
                      <span className="text-sm font-semibold text-gray-900">{personalStats.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getProgressColor(personalStats.progressPercent)}`}
                        style={{ width: `${Math.min(personalStats.progressPercent, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {personalStats.progressPercent >= 100
                        ? "🎉 Xuất sắc! Bạn đã hoàn thành mục tiêu!"
                        : personalStats.progressPercent >= 80
                        ? "💪 Sắp đến đích rồi!"
                        : personalStats.progressPercent >= 50
                        ? "⚡ Tiếp tục phấn đấu!"
                        : "🏃 Hãy cố gắng hơn nữa!"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Yearly Stats Widget */}
            <div className="rounded-xl shadow-lg p-6 gradient-theme-primary" style={{ color: "var(--color-text-inverse)" }}>
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                <h2 className="text-xl font-bold">Thống kê năm {new Date().getFullYear()}</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="backdrop-blur rounded-lg p-4" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={20} />
                    <p className="text-sm opacity-90">Tổng KM chạy</p>
                  </div>
                  <p className="text-3xl font-bold">{yearlyStatsLoading ? (
                    <span className="h-8 w-32 bg-gray-200 rounded animate-pulse inline-block" />
                  ) : (
                    yearlyStats.totalKm
                  )}</p>
                </div>

                <div className="backdrop-blur rounded-lg p-4" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Star size={20} />
                    <p className="text-sm opacity-90">Tổng sao</p>
                  </div>
                  <p className="text-3xl font-bold">{yearlyStatsLoading ? (
                    <span className="h-8 w-32 bg-gray-200 rounded animate-pulse inline-block" />
                  ) : (
                    yearlyStats.totalStars
                  )}</p>
                </div>

                <div className="backdrop-blur rounded-lg p-4" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy size={20} />
                    <p className="text-sm opacity-90">Thử thách tham gia</p>
                  </div>
                  <p className="text-3xl font-bold">{yearlyStatsLoading ? (
                    <span className="h-8 w-32 bg-gray-200 rounded animate-pulse inline-block" />
                  ) : (
                    yearlyStats.challengesJoined
                  )}</p>
                </div>

                <div className="backdrop-blur rounded-lg p-4" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Award size={20} />
                    <p className="text-sm opacity-90">Thử thách hoàn thành</p>
                  </div>
                  <p className="text-3xl font-bold">{yearlyStatsLoading ? (
                    <span className="h-8 w-32 bg-gray-200 rounded animate-pulse inline-block" />
                  ) : (
                    yearlyStats.challengesCompleted
                  )}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Hall of Fame, Finance, Notifications */}
          <div className="space-y-6">
            
            {/* Hall of Fame Widget */}
            <div className="rounded-xl shadow-lg p-6" style={{ background: "var(--color-bg-secondary)", borderColor: "var(--color-border)", border: "1px solid" }}>
              <div className="rounded-lg p-3 mb-4 shadow-lg gradient-theme-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" style={{ color: "var(--color-text-inverse)" }}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <h2 className="text-lg font-bold" style={{ color: "var(--color-text-inverse)" }}>Bảng vàng</h2>
                  </div>
                  <a
                    href="/hall-of-fame"
                    className="text-sm font-medium px-3 py-1 rounded-lg"
                    style={{ color: "var(--color-text-inverse)", background: "rgba(255,255,255,0.2)" }}
                  >
                    Xem tất cả →
                  </a>
                </div>
              </div>

              <div className="space-y-3">
                {hallOfFameLoading ? (
                  <div className="animate-pulse">
                    {[...Array(3)].map((_, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--color-bg-primary)" }}>
                        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm bg-gray-200 rounded animate-pulse h-4 w-3/4"></p>
                          <p className="text-xs bg-gray-200 rounded animate-pulse h-3 w-1/2"></p>
                        </div>
                        <p className="font-bold bg-gray-200 rounded animate-pulse h-4 w-1/4"></p>
                      </div>
                    ))}
                  </div>
                ) : hallOfFame.length > 0 ? (
                  hallOfFame.map((entry) => (
                    <div key={`${entry.rank}-${entry.name}-${entry.distance}`} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--color-bg-primary)" }}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        entry.rank === 1 ? "bg-yellow-400 text-yellow-900" :
                        entry.rank === 2 ? "bg-gray-300 text-gray-800" :
                        ""
                      }`}
                      style={entry.rank === 3 ? { background: "var(--color-primary)", color: "var(--color-text-inverse)" } : {}}
                      >
                        {entry.rank}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{entry.name}</p>
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{entry.distance}</p>
                      </div>
                      <p className="font-bold" style={{ color: "var(--color-primary)" }}>{entry.time}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>Chưa có dữ liệu</p>
                )}
              </div>
            </div>

            {/* Finance Status Widget */}
            <div className="rounded-xl shadow-lg p-6" style={{ background: "var(--color-bg-secondary)", borderColor: "var(--color-border)", border: "1px solid" }}>
              <div className="rounded-lg p-3 mb-4 shadow-lg gradient-theme-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "var(--color-text-inverse)" }}>
                      <rect x="2" y="5" width="20" height="14" rx="2"/>
                      <path d="M2 10h20"/>
                    </svg>
                    <h2 className="text-lg font-bold" style={{ color: "var(--color-text-inverse)" }}>Tình hình quỹ</h2>
                  </div>
                  <a
                    href="/finance"
                    className="text-sm font-medium px-3 py-1 rounded-lg"
                    style={{ color: "var(--color-text-inverse)", background: "rgba(255,255,255,0.2)" }}
                  >
                    Chi tiết →
                  </a>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--color-bg-primary)" }}>
                  <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>Số dư hiện tại</span>
                  <span className="font-bold" style={{ color: "var(--color-success)" }}>
                    {financeLoading ? (
                      <span className="h-4 w-24 bg-gray-200 rounded animate-pulse inline-block" />
                    ) : (
                      financeStatus.balance.toLocaleString("vi-VN")
                    )} đ
                  </span>
                </div>

                {financeStatus.hasOutstanding && (
                  <div>
                    {financeStatus.unpaidFees > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg mb-2" style={{ background: "var(--color-bg-primary)" }}>
                        <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>Quỹ chưa đóng</span>
                        <span className="font-bold" style={{ color: "var(--color-warning)" }}>
                          {financeLoading ? (
                            <span className="h-4 w-24 bg-gray-200 rounded animate-pulse inline-block" />
                          ) : (
                            financeStatus.unpaidFees.toLocaleString("vi-VN")
                          )} đ
                        </span>
                      </div>
                    )}
                    {financeStatus.unpaidFines > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--color-bg-primary)" }}>
                        <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>Phạt chưa đóng</span>
                        <span className="font-bold" style={{ color: "var(--color-error)" }}>
                          {financeLoading ? (
                            <span className="h-4 w-24 bg-gray-200 rounded animate-pulse inline-block" />
                          ) : (
                            financeStatus.unpaidFines.toLocaleString("vi-VN")
                          )} đ
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {!financeStatus.hasOutstanding && (
                  <div className="text-center py-2">
                    <p className="text-sm" style={{ color: "var(--color-success)" }}>✓ Bạn đã hoàn thành nghĩa vụ tài chính</p>
                  </div>
                )}
              </div>
            </div>

            {/* Notifications Widget */}
            <div className="rounded-xl shadow-lg p-6" style={{ background: "var(--color-bg-secondary)", borderColor: "var(--color-border)", border: "1px solid" }}>
              <div className="rounded-lg p-3 mb-4 shadow-lg gradient-theme-primary">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "var(--color-text-inverse)" }}>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  <h2 className="text-lg font-bold" style={{ color: "var(--color-text-inverse)" }}>Thông báo</h2>
                </div>
              </div>

              <div className="space-y-3">
                {notificationsLoading ? (
                  <div className="animate-pulse">
                    {[...Array(3)].map((_, idx) => (
                      <div key={idx} className="p-3 rounded-lg" style={{ background: "var(--color-bg-primary)" }}>
                        <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="p-3 rounded-lg border-l-4"
                      style={{
                        background: "var(--color-bg-primary)",
                        borderLeftColor: notif.type === "warning" ? "var(--color-warning)" : notif.type === "success" ? "var(--color-success)" : "var(--color-info)"
                      }}
                    >
                      <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Admin Quick Actions removed as requested */}
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-gray-500">Đang tải...</div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
