"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import LeaderboardRow from "@/components/LeaderboardRow";
import { supabase } from "@/lib/supabase-client";
import { User, Bell, Target, TrendingUp } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  name: string;
  totalKm: number;
  pace: number;
  targetKm: number;
}

interface PersonalStats {
  totalKm: number;
  avgPace: string | null;
  targetKm: number;
  progressPercent: number;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  strava_id: string | null;
  role?: string;
}

function Avatar({ url, name }: { url?: string; name: string }) {
  return (
    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center overflow-hidden shadow-lg">
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <User className="text-white" size={28} />
      )}
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const connected = searchParams.get("strava_connected");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [challenge, setChallenge] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [personalStats, setPersonalStats] = useState<PersonalStats>({
    totalKm: 0,
    avgPace: null,
    targetKm: 0,
    progressPercent: 0,
  });
  const [notifications, setNotifications] = useState<string[]>([]);

  // fetch leaderboard (mocked here; replace with Supabase query in production)
  async function fetchLeaderboard() {
    setLoading(true);

    const mockData: LeaderboardEntry[] = [
      {
        rank: 1,
        name: "Nguyễn Hải Đăng",
        totalKm: 285,
        pace: 420,
        targetKm: 300,
      },
      {
        rank: 2,
        name: "Trần Quốc Việt",
        totalKm: 270,
        pace: 450,
        targetKm: 300,
      },
      { rank: 3, name: "Phạm Thị Hương", totalKm: 255, pace: 480, targetKm: 300 },
      {
        rank: 4,
        name: "Bùi Anh Tuấn",
        totalKm: 240,
        pace: 435,
        targetKm: 250,
      },
      {
        rank: 5,
        name: "Lê Minh Hòa",
        totalKm: 235,
        pace: 465,
        targetKm: 300,
      },
      {
        rank: 6,
        name: "Hoàng Minh Khánh",
        totalKm: 220,
        pace: 500,
        targetKm: 250,
      },
      { rank: 7, name: "Đỗ Thị Lan", totalKm: 210, pace: 510, targetKm: 200 },
      {
        rank: 8,
        name: "Vũ Quang Huy",
        totalKm: 195,
        pace: 520,
        targetKm: 250,
      },
      {
        rank: 9,
        name: "Lý Tuấn Anh",
        totalKm: 180,
        pace: 540,
        targetKm: 200,
      },
      {
        rank: 10,
        name: "Trịnh Minh Đức",
        totalKm: 165,
        pace: 560,
        targetKm: 200,
      },
    ];

    setChallenge("Thách thức tháng 11/2025");
    setLeaderboard(mockData);
    setLoading(false);
  }

  // fetch personal stats from current user's challenge participation
  async function fetchPersonalStats() {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
      const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get current month challenge
      const { data: challengeData } = await supabase
        .from("challenges")
        .select("id")
        .gte("start_date", startDate)
        .lte("start_date", endDate)
        .limit(1)
        .maybeSingle();

      if (!challengeData) return;

      // Get user's participation
      const { data: participation } = await supabase
        .from("challenge_participants")
        .select("actual_km, avg_pace_seconds, target_km")
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
        });
      }
    } catch (err) {
      console.error("Failed to fetch personal stats:", err);
    }
  }

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return "bg-purple-600";
    if (percent >= 80) return "bg-green-600";
    if (percent >= 50) return "bg-yellow-500";
    return "bg-red-600";
  };

  // Fetch current user profile
  async function fetchUserProfile() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, strava_id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        setUserProfile(profile);
      }
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
    }
  }

  useEffect(() => {
    // Check auth on mount
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent("/dashboard")}`);
        return;
      }

      // Auto-fetch leaderboard and user profile on mount
      fetchLeaderboard();
      fetchUserProfile();
      fetchPersonalStats();
      setNotifications([
        "Sắp có giải chạy HLR tháng 12!",
        "Nhắc đóng quỹ tháng này trước 10/12.",
        "Chúc mừng thành viên đạt PB mới!",
      ]);

      // Auto-sync once when page loads
      (async function autoSync() {
        try {
          setSyncLoading(true);
          setLastSyncMessage(null);
          const res = await fetch("/api/strava/sync", { method: "POST" });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            setLastSyncMessage(body?.error || "Đồng bộ thất bại");
          } else {
            const body = await res.json();
            setLastSyncMessage("Đồng bộ thành công");
            // reload leaderboard data to reflect latest sync
            await fetchLeaderboard();
            await fetchPersonalStats();
          }
        } catch (err) {
          setLastSyncMessage("Đồng bộ thất bại");
        } finally {
          setSyncLoading(false);
        }
      })();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSync = async () => {
    setSyncLoading(true);
    setLastSyncMessage(null);
    try {
      const res = await fetch("/api/strava/sync", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLastSyncMessage(body?.error || "Đồng bộ thất bại");
      } else {
        const body = await res.json();
        setLastSyncMessage("Đồng bộ thành công");
        await fetchLeaderboard();
        await fetchPersonalStats();
      }
    } catch (err) {
      setLastSyncMessage("Đồng bộ thất bại");
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Block */}
      {userProfile && (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-bg)] shadow-md mb-6">
          <Avatar url={undefined} name={userProfile.full_name || "?"} />
          <div>
            <h2 className="text-xl font-bold text-[var(--color-primary)]">Xin chào, {userProfile.full_name || "thành viên"}!</h2>
            <p className="text-sm text-[var(--color-muted)]">Chúc bạn một ngày chạy vui vẻ!</p>
          </div>
        </div>
      )}

      {/* Notifications Block */}
      <div className="p-4 rounded-xl bg-gradient-to-tr from-[var(--color-accent)] to-[var(--color-bg)] shadow-md mb-6">
        <h3 className="font-semibold text-[var(--color-primary)] mb-2">Thông báo mới</h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {notifications.map((note, idx) => (
            <div key={idx} className="min-w-[180px] px-3 py-2 bg-white/80 rounded-lg shadow text-[var(--color-primary)] text-sm font-medium">
              {note}
            </div>
          ))}
        </div>
      </div>

      {/* Current Challenge Block */}
      <div className="p-4 rounded-xl bg-[var(--color-bg)] shadow-md mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-[var(--color-primary)]">Thử thách hiện tại</h3>
          <a href="/challenges" className="text-xs text-[var(--color-accent)] underline">Chi tiết</a>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">{challenge}</p>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] h-3 rounded-full"
              style={{ width: `${personalStats.progressPercent || 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[var(--color-muted)]">
            <span>Tổng KM: <span className="font-bold text-[var(--color-primary)]">{personalStats.totalKm ?? "-"}</span></span>
            <span>Pace TB: <span className="font-bold text-[var(--color-primary)]">{personalStats.avgPace ?? "-"} min/km</span></span>
            <span>Hoàn thành: <span className="font-bold text-[var(--color-primary)]">{personalStats.progressPercent ?? 0}%</span></span>
          </div>
        </div>
      </div>

      {/* Admin Shortcuts Block */}
      {userProfile && (userProfile.role === "admin" || userProfile.role?.startsWith("mod_")) && (
        <div className="p-4 rounded-xl bg-[var(--color-bg)] shadow-md flex gap-4 mb-6">
          <a href="/admin/finance" className="flex-1 py-3 px-4 bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-accent)] text-white rounded-lg font-semibold shadow text-center">Quản lý Thu chi</a>
          <a href="/admin/pb-approval" className="flex-1 py-3 px-4 bg-gradient-to-tr from-[var(--color-accent)] to-[var(--color-primary)] text-white rounded-lg font-semibold shadow text-center">Duyệt PB</a>
        </div>
      )}

        {userProfile && !userProfile.strava_id && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-orange-900">Chưa kết nối Strava</h3>
              <p className="text-sm text-orange-700">Bạn đã đăng nhập nhưng chưa liên kết tài khoản Strava. Nhấn nút bên để bắt đầu liên kết (Strava OAuth).</p>
            </div>
            <div>
              <a href="/api/auth/strava/login" className="px-4 py-2 bg-orange-500 text-white rounded-md">Kết nối Strava</a>
            </div>
          </div>
        )}

        {connected && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <span className="text-2xl">✓</span>
            <div>
              <h3 className="font-semibold text-green-900">Kết nối Strava thành công!</h3>
              <p className="text-sm text-green-700">Dữ liệu hoạt động của bạn sẽ được cập nhật tự động</p>
            </div>
          </div>
        )}

        {/* Personal Stats Card */}
        <div className="mb-8 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg border border-primary-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Thống kê cá nhân tháng này</h3>
            <button
              onClick={handleManualSync}
              disabled={syncLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:brightness-95 disabled:opacity-60 transition"
            >
              {syncLoading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.6)" strokeWidth="4"></circle>
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4v4m0 8v4M4 12h4m8 0h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              )}
              <span>{syncLoading ? "Đang đồng bộ..." : "Đồng bộ ngay"}</span>
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Tổng KM tháng này</p>
              <p className="text-3xl font-bold text-primary-600">{personalStats.totalKm.toFixed(1)}</p>
              <p className="text-xs text-gray-500 mt-1">/ {personalStats.targetKm} km</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Pace trung bình</p>
              <p className="text-3xl font-bold text-primary-600">{personalStats.avgPace || "—"}</p>
              <p className="text-xs text-gray-500 mt-1">phút / km</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">% Hoàn thành</p>
              <p className="text-3xl font-bold text-primary-600">{personalStats.progressPercent}%</p>
              <p className="text-xs text-gray-500 mt-1">của mục tiêu</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Tiến độ</p>
              <p className="text-sm text-gray-600">{personalStats.totalKm.toFixed(1)} / {personalStats.targetKm} km</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getProgressColor(personalStats.progressPercent)}`}
                style={{ width: `${Math.min(personalStats.progressPercent, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {personalStats.progressPercent >= 100
                ? "🎉 Bạn đã vượt quá mục tiêu!"
                : personalStats.progressPercent >= 80
                ? "✓ Gần hoàn thành!"
                : personalStats.progressPercent >= 50
                ? "Tiếp tục cố gắng!"
                : "Bắt đầu nào!"}
            </p>
          </div>

          {lastSyncMessage && (
            <p className="text-sm text-gray-600 mt-4 text-center">{lastSyncMessage}</p>
          )}
        </div>

        {/* Challenge Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{challenge}</h2>
          <p className="text-gray-600">Top 10 thành viên với tiến độ hoàn thành cao nhất</p>
        </div>

        {/* Leaderboard */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Đang tải dữ liệu...</div>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry) => (
              <LeaderboardRow key={entry.rank} {...entry} />
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-2">Tổng thành viên</div>
            <div className="text-3xl font-bold text-gray-900">10</div>
            <div className="text-xs text-gray-500 mt-2">đang tham gia</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-2">Hoàn thành thách thức</div>
            <div className="text-3xl font-bold text-green-600">3</div>
            <div className="text-xs text-gray-500 mt-2">30% hoàn thành</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-2">Tổng km chạy</div>
            <div className="text-3xl font-bold text-primary-600">2,255</div>
            <div className="text-xs text-gray-500 mt-2">từ tất cả thành viên</div>
          </div>
        </div>
      </main>
    </>
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
