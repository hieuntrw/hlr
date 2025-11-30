"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";

interface Challenge {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  password?: string;
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
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<ParticipantWithActivity[]>([]);
  const [luckyDrawWinners, setLuckyDrawWinners] = useState<LuckyDraw[]>([]);
  const [loading, setLoading] = useState(true);
  const [userParticipation, setUserParticipation] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);

  const TARGET_OPTIONS = [70, 100, 150, 200, 250, 300];

  useEffect(() => {
    fetchData();
  }, [params.id]);

  async function fetchData() {
    setLoading(true);

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUser(user?.id || null);

    try {
      // Fetch challenge details
      const { data: challengeData, error: challengeError } = await supabase
        .from("challenges")
        .select(
          "id, title, description, start_date, end_date, password, status, is_locked, min_pace_seconds, max_pace_seconds"
        )
        .eq("id", params.id)
        .single();

      if (challengeError) {
        console.error("Error fetching challenge:", challengeError);
        return;
      }

      setChallenge(challengeData);

      // Fetch participants with activities
      const { data: participantsData, error: participantsError } = await supabase
        .from("challenge_participants")
        .select(
          `
          user_id,
          target_km,
          actual_km,
          avg_pace_seconds,
          total_activities,
          profiles(full_name, avatar_url, gender)
        `
        )
        .eq("challenge_id", params.id)
        .order("actual_km", { ascending: false });

      if (participantsError) {
        console.error("Error fetching participants:", participantsError);
      } else if (participantsData) {
        setParticipants(
          participantsData.map((p: any) => ({
            user_id: p.user_id,
            target_km: p.target_km,
            actual_km: p.actual_km,
            avg_pace_seconds: p.avg_pace_seconds,
            total_activities: p.total_activities,
            profile: p.profiles,
          }))
        );
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

    setRegistering(true);

    try {
      if (userParticipation) {
        // Update existing participation
        const { error } = await supabase
          .from("challenge_participants")
          .update({ target_km: selectedTarget })
          .eq("id", userParticipation.id);

        if (error) {
          console.error("Error updating participation:", error);
          alert("Lỗi khi cập nhật mục tiêu");
        } else {
          alert("Cập nhật mục tiêu thành công!");
          setUserParticipation({ ...userParticipation, target_km: selectedTarget });
        }
      } else {
        // Create new participation
        const { error } = await supabase.from("challenge_participants").insert({
          challenge_id: params.id,
          user_id: currentUser,
          target_km: selectedTarget,
          actual_km: 0,
          avg_pace_seconds: 0,
          total_activities: 0,
        });

        if (error) {
          console.error("Error registering:", error);
          alert("Lỗi khi đăng ký thử thách");
        } else {
          alert("Đăng ký thử thách thành công!");
          fetchData();
        }
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Có lỗi xảy ra");
    } finally {
      setRegistering(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Không tìm thấy thử thách</p>
          <Link href="/challenges" className="text-blue-600 hover:underline mt-4 inline-block">
            ← Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <Link href="/challenges" className="text-blue-100 hover:text-white mb-4 inline-block">
            ← Quay lại
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-2">{challenge.title}</h1>
          <p className="text-blue-100">
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
              <h2 className="text-2xl font-bold mb-4">📋 Thông Tin</h2>
              <p className="text-gray-700 whitespace-pre-wrap mb-4">{challenge.description}</p>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-gray-700">Pace Range:</span>
                  <span className="text-gray-600">
                    {" "}
                    {formatPace(challenge.min_pace_seconds)} -{" "}
                    {formatPace(challenge.max_pace_seconds)}
                  </span>
                </div>
              </div>
            </div>

            {/* Registration Card */}
            {challenge.status === "Open" && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-md p-6 border-2 border-green-300">
                <h3 className="text-xl font-bold text-green-900 mb-4">🎯 Chọn Mục Tiêu</h3>

                <div className="space-y-3 mb-6">
                  {TARGET_OPTIONS.map((km) => (
                    <label
                      key={km}
                      className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedTarget === km
                          ? "border-green-600 bg-green-100"
                          : "border-green-200 hover:border-green-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="target"
                        value={km}
                        checked={selectedTarget === km}
                        onChange={() => setSelectedTarget(km)}
                        className="w-4 h-4"
                      />
                      <span className="ml-3 font-semibold text-green-900">{km} km</span>
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleRegister}
                  disabled={registering || !selectedTarget}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors"
                >
                  {registering ? "Đang xử lý..." : userParticipation ? "Cập nhật" : "Đăng ký"}
                </button>

                {userParticipation && (
                  <p className="text-sm text-green-700 mt-3 text-center">
                    ✓ Bạn đã đăng ký với mục tiêu {userParticipation.target_km} km
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Leaderboard & Lucky Draw */}
          <div className="lg:col-span-2">
            {/* Lucky Draw Winners (if closed) */}
            {challenge.status === "Closed" && luckyDrawWinners.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-2xl font-bold mb-4">🎁 Quay Thưởng May Mắn</h3>

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
                        <th className="text-right py-3 px-2 font-bold text-gray-700">
                          Quãng Đường
                        </th>
                        <th className="text-right py-3 px-2 font-bold text-gray-700">
                          Pace Avg
                        </th>
                        <th className="text-right py-3 px-2 font-bold text-gray-700">Hoạt động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p, idx) => (
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
                              {p.profile?.avatar_url ? (
                                <img
                                  src={p.profile.avatar_url}
                                  alt={p.profile.full_name}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-xs">👤</span>
                                </div>
                              )}
                              <span className="font-semibold text-gray-900">
                                {p.profile?.full_name || "Unknown"}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-2 text-right">
                            <div className="font-bold text-blue-600">{p.actual_km} km</div>
                            <div className="text-xs text-gray-500">Target: {p.target_km} km</div>
                          </td>
                          <td className="py-4 px-2 text-right">
                            {formatPace(p.avg_pace_seconds)}
                          </td>
                          <td className="py-4 px-2 text-right text-gray-600">
                            {p.total_activities}
                          </td>
                        </tr>
                      ))}
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
    </div>
  );
}
