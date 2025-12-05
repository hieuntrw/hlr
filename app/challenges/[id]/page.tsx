"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth/AuthContext";
import { ClipboardList, User, Gift, Frown, Lock } from "lucide-react";

interface Challenge {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: "Open" | "Closed";
  is_locked: boolean;
  min_pace_seconds: number;
  max_pace_seconds: number;
  target_km_options?: number[];
}

interface ParticipantWithActivity {
  user_id: string;
  target_km: number;
  actual_km: number;
  avg_pace_seconds: number;
  total_activities: number;
  profile?: {
    full_name: string;
    avatar_url?: string;
    gender?: string;
  };
}

interface LuckyDraw {
  id: string;
  winner_user_id?: string;
  prize_name?: string;
  rank: number;
  winner_profile?: {
    full_name: string;
    avatar_url?: string;
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "--:--:--";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

function formatPace(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/km`;
}

export default function ChallengePage({ params }: { params: { id: string } }) {
  const { user, isLoading: authLoading } = useAuth();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<ParticipantWithActivity[]>([]);
  const [luckyDrawWinners, setLuckyDrawWinners] = useState<LuckyDraw[]>([]);
  const [loading, setLoading] = useState(true);
  const [userParticipation, setUserParticipation] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [failedParticipants, setFailedParticipants] = useState<ParticipantWithActivity[]>([]);

  const [targetOptions, setTargetOptions] = useState<number[]>([70, 100, 150, 200, 250, 300]);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    fetchData();
  }, [params.id, user, authLoading]);

  async function fetchData() {
    setLoading(true);

    // Get current user
    // user from AuthContext
    setCurrentUser(user?.id || null);

    try {
      // Fetch challenge details
      const { data: challengeData, error: challengeError } = await supabase
        .from("challenges")
        .select(
          "id, title, description, start_date, end_date, status, is_locked, min_pace_seconds, max_pace_seconds, created_by, profiles(full_name, avatar_url)"
        )
        .eq("id", params.id)
        .single();

      if (challengeError) {
        console.error("Error fetching challenge:", challengeError);
        return;
      }

      // Load registration level options from system_settings
      try {
        const { data: regSetting } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'challenge_registration_levels')
          .maybeSingle();

        if (regSetting && regSetting.value) {
          const parts = String(regSetting.value).split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
          const nums = parts.map((s: string) => Number(s)).filter((n: number) => !isNaN(n) && n > 0);
          const uniqueSorted = Array.from(new Set(nums)).sort((a: number, b: number) => a - b);
          if (uniqueSorted.length > 0) setTargetOptions(uniqueSorted);
        }
      } catch (e) {
        console.warn('Could not load registration levels, using defaults', e);
      }

      if (challengeData) {
        setChallenge(challengeData as Challenge);
      } else {
        setChallenge(null);
      }

      // Fetch participants with activities directly via Supabase (RLS applies)
      try {
        const { data: participantsData, error: participantsError } = await supabase
          .from('challenge_participants')
          .select('user_id, target_km, actual_km, avg_pace_seconds, total_activities, status, profiles(full_name, avatar_url)')
          .eq('challenge_id', params.id)
          .order('actual_km', { ascending: false });

        if (participantsError) {
          console.error('Failed to load participants via Supabase:', participantsError);
        } else {
          const mapped = (participantsData || []).map((p: any) => ({
            user_id: p.user_id,
            target_km: p.target_km,
            actual_km: p.actual_km,
            avg_pace_seconds: p.avg_pace_seconds,
            total_activities: p.total_activities,
            profile: p.profiles,
          }));
          setParticipants(mapped);

          if (challengeData.status === "Closed") {
            const failed = mapped.filter((p: ParticipantWithActivity) => p.actual_km < p.target_km);
            setFailedParticipants(failed);
          }
        }
      } catch (e) {
        console.error('Participants fetch error', e);
      }

      // Fetch lucky draw winners if challenge is closed
      if (challengeData.status === "Closed") {
        const { data: drawData, error: drawError } = await supabase
          .from("lucky_draws")
          .select(
            `
          id,
          winner_user_id,
          prize_name,
          rank,
          profiles!lucky_draws_winner_user_id_fkey(full_name, avatar_url)
        `
          )
          .eq("challenge_id", params.id)
          .not("winner_user_id", "is", null)
          .order("rank", { ascending: true })
          .limit(2);

        if (drawError) {
          console.error("Error fetching lucky draws:", drawError);
        } else if (drawData) {
          setLuckyDrawWinners(
            drawData.map((d: any) => ({
              id: d.id,
              winner_user_id: d.winner_user_id,
              prize_name: d.prize_name,
              rank: d.rank,
              winner_profile: d.profiles,
            }))
          );
        }
      }

      // Check if user is already registered
      if (user?.id) {
        const { data: existingParticipation } = await supabase
          .from("challenge_participants")
          .select("*")
          .eq("challenge_id", params.id)
          .eq("user_id", user.id)
          .single();

        if (existingParticipation) {
          setUserParticipation(existingParticipation);
          setSelectedTarget(existingParticipation.target_km);
        }
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!selectedTarget || !currentUser) return;

    // Check password if required
    // Do not compare password on the client. Server will validate the password.

    setRegistering(true);

    try {
      // Use server-side API to join/update participation (server validates session)
      const res = await fetch(`/api/challenges/${params.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_km: selectedTarget }),
        credentials: "same-origin",
      });

      const json = await res.json();
      if (!res.ok) {
        console.error("Join API error:", json);
        if (res.status === 401) {
          alert(json.error || "Mật khẩu không đúng");
        } else if (res.status === 403) {
          alert(json.error || "Thử thách đã bị khoá");
        } else {
          alert(json.error || "Lỗi khi đăng ký thử thách");
        }
      } else {
        alert(userParticipation ? "Cập nhật mục tiêu thành công!" : "Đăng ký thử thách thành công!");
        setShowRegisterModal(false);
        // Refresh data to reflect new participation
        await fetchData();
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Có lỗi xảy ra");
    } finally {
      setRegistering(false);
    }
  }

  async function handleLeave() {
    if (!currentUser) return;
    if (!confirm('Bạn có chắc muốn rời thử thách này?')) return;

    setLeaving(true);
    try {
      const res = await fetch(`/api/challenges/${params.id}/leave`, {
        method: 'POST',
        credentials: 'same-origin',
      });

      const json = await res.json();
      if (!res.ok) {
        console.error('Leave API error:', json);
        alert(json.error || 'Lỗi khi rời thử thách');
      } else {
        alert('Bạn đã rời thử thách');
        setUserParticipation(null);
        await fetchData();
      }
    } catch (err) {
      console.error('Leave error:', err);
      alert('Có lỗi xảy ra');
    } finally {
      setLeaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--color-primary)" }}></div>
          <p style={{ color: "var(--color-text-secondary)" }}>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--color-bg-secondary)" }}>
        <div className="text-center">
          <p className="text-lg" style={{ color: "var(--color-text-secondary)" }}>Không tìm thấy thử thách</p>
          <Link href="/challenges" className="mt-4 inline-block hover:underline" style={{ color: "var(--color-primary)" }}>
            ← Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg-secondary)" }}>
      {/* Header */}
      <div className="py-8 px-4 gradient-theme-primary">
        <div className="max-w-7xl mx-auto">
          <Link href="/challenges" className="mb-4 inline-block hover:opacity-80" style={{ color: "var(--color-text-inverse)" }}>
            ← Quay lại
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: "var(--color-text-inverse)" }}>{challenge.title}</h1>
          <p style={{ color: "var(--color-text-inverse)", opacity: 0.9 }}>
            {formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Description & Registration */}
          <div className="lg:col-span-1">
            {/* Description Card */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><ClipboardList size={28} /> Thông Tin</h2>
              <p className="text-gray-700 whitespace-pre-wrap mb-4">{challenge.description}</p>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-gray-700">Người tạo:</span>
                  <span className="text-gray-600"> {challenge?.profiles?.full_name ?? '—'}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Mốc đăng ký:</span>
                  <span className="text-gray-600"> {targetOptions.join(', ')}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Pace Range:</span>
                  <span className="text-gray-600">
                    {" "}
                    {formatPace(challenge.min_pace_seconds)} -{" "}
                    {formatPace(challenge.max_pace_seconds)}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">KM đã thực hiện (bản thân):</span>
                  <span className="text-gray-600"> {userParticipation ? `${userParticipation.actual_km ?? 0} km` : '—'}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Số hoạt động hợp lệ (bản thân):</span>
                  <span className="text-gray-600"> {userParticipation ? `${userParticipation.total_activities ?? 0}` : '—'}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">% Hoàn thành (bản thân):</span>
                  <span className="text-gray-600"> {userParticipation && userParticipation.target_km ? `${Math.round(((userParticipation.actual_km ?? 0) / userParticipation.target_km) * 10000) / 100}%` : '—'}</span>
                </div>
              </div>
            </div>

            {/* Registration Card */}
            {challenge.status === "Open" && !userParticipation && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-md p-6 border-2 border-green-300">
                <h3 className="text-xl font-bold text-green-900 mb-4">🎯 Đăng Ký Tham Gia</h3>
                <p className="text-sm text-gray-700 mb-4">
                  Chọn mốc km và đăng ký ngay để tham gia thử thách!
                </p>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors"
                >
                  Đăng Ký Ngay
                </button>
              </div>
            )}

            {userParticipation && (
              <div className="bg-green-50 rounded-lg shadow-md p-6 border-2 border-green-300">
                <h3 className="text-xl font-bold text-green-900 mb-2">✓ Đã Đăng Ký</h3>
                <p className="text-sm text-gray-700">
                  Mục tiêu: <span className="font-bold">{userParticipation.target_km} km</span>
                </p>
                <p className="text-sm text-gray-700">
                  Đã chạy: <span className="font-bold">{userParticipation.actual_km} km</span>
                </p>
                <p className="text-sm text-gray-700">
                  Số hoạt động hợp lệ: <span className="font-bold">{userParticipation.total_activities ?? 0}</span>
                </p>
                <p className="text-sm text-gray-700">
                  % Hoàn thành: <span className="font-bold">{userParticipation.target_km ? `${Math.round(((userParticipation.actual_km ?? 0) / userParticipation.target_km) * 10000) / 100}%` : '—'}</span>
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Leaderboard & Lucky Draw */}
          <div className="lg:col-span-2">
            {/* Summary Section (if closed) */}
            {challenge.status === "Closed" && (
              <div className="space-y-6 mb-6">
                {/* Lucky Draw Winners */}
                {luckyDrawWinners.length > 0 && (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-2xl font-bold mb-4">🎁 Người Trúng Thưởng</h3>
                    <div className="space-y-4">
                      {luckyDrawWinners.map((draw, idx) => (
                        <div
                          key={draw.id}
                          className={`p-4 rounded-lg border-2 flex items-center gap-4 ${
                            idx === 0
                              ? "bg-yellow-50 border-yellow-400"
                              : "bg-gray-50 border-gray-300"
                          }`}
                        >
                          <div
                            className={`text-4xl font-bold w-12 text-center ${
                              idx === 0 ? "text-yellow-600" : "text-gray-600"
                            }`}
                          >
                            {idx === 0 ? "🥇" : "🥈"}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-900">
                              {draw.winner_profile?.full_name || "Anonymous"}
                            </p>
                            <p className="text-sm text-gray-600">{draw.prize_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failed Participants */}
                {failedParticipants.length > 0 && (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-2xl font-bold mb-4 text-red-600">⚠️ Danh Sách Bị Phạt</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Các thành viên không đạt mục tiêu đã đăng ký
                    </p>
                    <div className="space-y-2">
                      {failedParticipants.map((p) => (
                        <div
                          key={p.user_id}
                          className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg"
                        >
                          <div className="w-10 h-10 rounded-full bg-red-400 flex items-center justify-center text-white font-bold">
                            {p.profile?.full_name?.charAt(0) || "?"}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {p.profile?.full_name || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-600">
                              Đạt {p.actual_km}/{p.target_km} km (
                              {Math.round((p.actual_km / p.target_km) * 100)}%)
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Leaderboard */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-2xl font-bold mb-6">📊 Bảng Xếp Hạng</h3>

              {participants.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-3 px-2 font-bold text-gray-700">#</th>
                        <th className="text-left py-3 px-2 font-bold text-gray-700">Tên</th>
                        <th className="text-right py-3 px-2 font-bold text-gray-700">KM</th>
                        <th className="text-right py-3 px-2 font-bold text-gray-700">Pace</th>
                        <th className="text-right py-3 px-2 font-bold text-gray-700">% Hoàn thành</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p, idx) => {
                        const progressPercent = Math.min(
                          Math.round((p.actual_km / p.target_km) * 100),
                          100
                        );
                        const isSuccess = progressPercent >= 100;
                        return (
                          <tr
                            key={p.user_id}
                            className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                          >
                            <td className="py-4 px-2">
                              <div className="flex items-center justify-center">
                                {idx === 0 ? (
                                  <span className="text-2xl">🥇</span>
                                ) : idx === 1 ? (
                                  <span className="text-2xl">🥈</span>
                                ) : idx === 2 ? (
                                  <span className="text-2xl">🥉</span>
                                ) : (
                                  <span className="font-bold text-gray-600">{idx + 1}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-xs">
                                    {p.profile?.full_name?.charAt(0) || "?"}
                                  </span>
                                </div>
                                <span className="font-semibold text-gray-900">
                                  {p.profile?.full_name || "Unknown"}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-2 text-right">
                              <div className="font-bold" style={{ color: "var(--color-primary)" }}>{p.actual_km} km</div>
                              <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                                Mục tiêu: {p.target_km} km
                              </div>
                            </td>
                            <td className="py-4 px-2 text-right">
                              {formatPace(p.avg_pace_seconds)}
                            </td>
                            <td className="py-4 px-2 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span
                                  className={`font-bold ${
                                    isSuccess ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  {progressPercent}%
                                </span>
                                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      isSuccess ? "bg-green-500" : "bg-red-500"
                                    }`}
                                    style={{ width: `${progressPercent}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Chưa có người tham gia</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-[var(--color-primary)] mb-4">
              Đăng Ký Thử Thách
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chọn mục tiêu (km)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {targetOptions.map((km) => (
                    <button
                      key={km}
                      onClick={() => setSelectedTarget(km)}
                      className={`py-2 px-3 border-2 rounded-lg font-semibold transition-all ${
                        selectedTarget === km
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                          : "border-gray-300 hover:border-[var(--color-primary)]"
                      }`}
                    >
                      {km} km
                    </button>
                  ))}
                </div>
              </div>

              {/* Password protection removed; no password input shown */}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRegisterModal(false)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleRegister}
                disabled={registering || !selectedTarget}
                className="flex-1 py-3 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:opacity-90 disabled:bg-gray-400 transition-colors"
              >
                {registering ? "Đang xử lý..." : "Đăng Ký"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
