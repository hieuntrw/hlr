"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { Trophy, Target, Wallet, Star, TrendingUp, Award, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

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
  const searchParams = useSearchParams();
  const connected = searchParams.get("strava_connected");
  const { user, isLoading: authLoading } = useAuth(); // Add auth context with loading
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [personalStats, setPersonalStats] = useState<PersonalStats>({
    totalKm: 0,
    avgPace: null,
    targetKm: 0,
    progressPercent: 0,
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
  const [loading, setLoading] = useState(true);

  // Format time in seconds to MM:SS
  const formatTime = (seconds: number | null): string => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Fetch Hall of Fame (top 3 per distance)
  async function fetchHallOfFame() {
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("full_name, pb_full_marathon_seconds, pb_half_marathon_seconds")
        .order("pb_full_marathon_seconds", { ascending: true, nullsFirst: false })
        .limit(3);

      if (profiles) {
        const fmTop: HallOfFameEntry[] = profiles
          .filter(p => p.pb_full_marathon_seconds)
          .map((p, idx) => ({
            rank: idx + 1,
            name: p.full_name || "Unknown",
            time: formatTime(p.pb_full_marathon_seconds),
            distance: "FM",
          }));
        
        setHallOfFame(fmTop);
      }
    } catch (err) {
      console.error("Failed to fetch hall of fame:", err);
    }
  }

  // Fetch personal challenge stats
  async function fetchPersonalStats() {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
      const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

      if (!user) return;

      // Get current month challenge
      const { data: challengeData } = await supabase
        .from("challenges")
        .select("id, name")
        .gte("start_date", startDate)
        .lte("start_date", endDate)
        .limit(1)
        .maybeSingle();

      if (!challengeData) {
        setPersonalStats((prev) => ({
          ...prev,
          status: "not_joined",
          challengeName: "Chưa có thử thách tháng này",
        }));
        return;
      }

      // Get user's participation
      const { data: participation } = await supabase
        .from("challenge_participants")
        .select("actual_km, avg_pace_seconds, target_km, status")
        .eq("challenge_id", challengeData.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (participation) {
        const totalKm = Number(participation.actual_km) || 0;
        const targetKm = Number(participation.target_km) || 0;
        const avgPaceSeconds = Number(participation.avg_pace_seconds) || 0;

        const avgPace =
          avgPaceSeconds > 0
            ? `${Math.floor(avgPaceSeconds / 60)}:${String(avgPaceSeconds % 60).padStart(2, "0")}`
            : null;

        const progressPercent = targetKm > 0 ? Math.round((totalKm / targetKm) * 100) : 0;

        setPersonalStats({
          totalKm,
          avgPace,
          targetKm,
          progressPercent,
          challengeName: challengeData.name,
          status: participation.status || "in_progress",
        });
      } else {
        setPersonalStats((prev) => ({
          ...prev,
          status: "not_joined",
          challengeName: challengeData.name,
        }));
      }
    } catch (err) {
      console.error("Failed to fetch personal stats:", err);
    }
  }

  // Fetch finance status
  async function fetchFinanceStatus() {
    try {
      // Using user from AuthContext
      if (!user) return;

      // Get all transactions for user
      const { data: transactions } = await supabase
        .from("transactions")
        .select("type, amount, status")
        .eq("user_id", user.id);

      if (transactions) {
        let balance = 0;
        let unpaidFees = 0;
        let unpaidFines = 0;

        transactions.forEach((t) => {
          if (t.status === "approved") {
            if (t.type === "collection") balance += Number(t.amount);
            else if (t.type === "expense" || t.type === "reward") balance -= Number(t.amount);
          }
          if (t.status === "pending") {
            if (t.type === "collection") unpaidFees += Number(t.amount);
            else if (t.type === "fine") unpaidFines += Number(t.amount);
          }
        });

        setFinanceStatus({
          balance,
          unpaidFees,
          unpaidFines,
          hasOutstanding: unpaidFees > 0 || unpaidFines > 0,
        });
      }
    } catch (err) {
      console.error("Failed to fetch finance status:", err);
    }
  }

  // Fetch yearly stats
  async function fetchYearlyStats() {
    try {
      // Using user from AuthContext
      if (!user) return;

      const year = new Date().getFullYear();
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Get all participations for this year
      const { data: participations } = await supabase
        .from("challenge_participants")
        .select("actual_km, status, challenge_id")
        .eq("user_id", user.id)
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (participations) {
        const totalKm = participations.reduce((sum, p) => sum + (Number(p.actual_km) || 0), 0);
        const challengesJoined = participations.length;
        const challengesCompleted = participations.filter((p) => p.status === "completed").length;

        // Get total stars from rewards
        const { data: rewards } = await supabase
          .from("member_rewards")
          .select("quantity")
          .eq("user_id", user.id)
          .gte("earned_at", startDate)
          .lte("earned_at", endDate);

        const totalStars = rewards ? rewards.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0) : 0;

        setYearlyStats({
          totalKm: Math.round(totalKm),
          totalStars,
          challengesJoined,
          challengesCompleted,
        });
      }
    } catch (err) {
      console.error("Failed to fetch yearly stats:", err);
    }
  }

  // Fetch user profile
  async function fetchUserProfile() {
    try {
      // Using user from AuthContext
      if (!user) return;

      console.log("[DEBUG] User ID:", user.id, "Email:", user.email);

      // Truy vấn bảng profiles bằng email - chỉ lấy full_name
      if (user.email) {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("email", user.email)
          .maybeSingle();
        
        console.log("[DEBUG] Truy vấn profile bằng email:", user.email, "Result:", profile, "Error:", error);

        if (profile) {
          setUserProfile({
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            strava_id: null,
            role: undefined,
            pb_5k_seconds: null,
            pb_10k_seconds: null,
            pb_half_marathon_seconds: null,
            pb_full_marathon_seconds: null,
          });
          console.log("[DEBUG] Đã set userProfile với full_name:", profile.full_name);
        } else {
          console.log("[DEBUG] Không tìm thấy profile với email:", user.email);
        }
      }
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
    }
  }

  // Fetch notifications (mock for now)
  async function fetchNotifications() {
    // TODO: Replace with real notifications from database
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
  }

  useEffect(() => {
    (async () => {
      // Wait for auth to finish loading
      if (authLoading) return;
      
      // Using user from AuthContext
      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent("/dashboard")}`);
        return;
      }

      setLoading(true);
      await Promise.all([
        fetchUserProfile(),
        fetchPersonalStats(),
        fetchHallOfFame(),
        fetchFinanceStatus(),
        fetchYearlyStats(),
        fetchNotifications(),
      ]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg-secondary)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--color-primary)" }}></div>
          <p style={{ color: "var(--color-text-secondary)" }}>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Welcome Section */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Xin chào, {userProfile?.full_name}! 👋
          </h1>
          <p className="text-gray-600 mt-1">Chào mừng bạn quay lại với Hải Lăng Runners</p>
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
                  <p className="text-3xl font-bold">{yearlyStats.totalKm}</p>
                </div>

                <div className="backdrop-blur rounded-lg p-4" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Star size={20} />
                    <p className="text-sm opacity-90">Tổng sao</p>
                  </div>
                  <p className="text-3xl font-bold">{yearlyStats.totalStars}</p>
                </div>

                <div className="backdrop-blur rounded-lg p-4" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy size={20} />
                    <p className="text-sm opacity-90">Thử thách tham gia</p>
                  </div>
                  <p className="text-3xl font-bold">{yearlyStats.challengesJoined}</p>
                </div>

                <div className="backdrop-blur rounded-lg p-4" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Award size={20} />
                    <p className="text-sm opacity-90">Thử thách hoàn thành</p>
                  </div>
                  <p className="text-3xl font-bold">{yearlyStats.challengesCompleted}</p>
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
                {hallOfFame.length > 0 ? (
                  hallOfFame.map((entry) => (
                    <div key={entry.rank} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--color-bg-primary)" }}>
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
                    {financeStatus.balance.toLocaleString("vi-VN")} đ
                  </span>
                </div>

                {financeStatus.hasOutstanding && (
                  <div>
                    {financeStatus.unpaidFees > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg mb-2" style={{ background: "var(--color-bg-primary)" }}>
                        <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>Quỹ chưa đóng</span>
                        <span className="font-bold" style={{ color: "var(--color-warning)" }}>
                          {financeStatus.unpaidFees.toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    )}
                    {financeStatus.unpaidFines > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--color-bg-primary)" }}>
                        <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>Phạt chưa đóng</span>
                        <span className="font-bold" style={{ color: "var(--color-error)" }}>
                          {financeStatus.unpaidFines.toLocaleString("vi-VN")} đ
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
                {notifications.map((notif) => (
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
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Admin Quick Actions */}
        {userProfile && (userProfile.role === "admin" || userProfile.role?.startsWith("mod_")) && (
          <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">⚡ Quản trị nhanh</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <a
                href="/admin/finance"
                className="bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg p-4 text-white transition text-center"
              >
                <Wallet className="mx-auto mb-2" size={24} />
                <p className="font-medium text-sm">Thu chi</p>
              </a>
              <a
                href="/admin/pb-approval"
                className="bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg p-4 text-white transition text-center"
              >
                <Trophy className="mx-auto mb-2" size={24} />
                <p className="font-medium text-sm">Duyệt PB</p>
              </a>
              <a
                href="/admin/members"
                className="bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg p-4 text-white transition text-center"
              >
                <Target className="mx-auto mb-2" size={24} />
                <p className="font-medium text-sm">Thành viên</p>
              </a>
              <a
                href="/admin/challenges"
                className="bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg p-4 text-white transition text-center"
              >
                <Award className="mx-auto mb-2" size={24} />
                <p className="font-medium text-sm">Thử thách</p>
              </a>
            </div>
          </div>
        )}
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
