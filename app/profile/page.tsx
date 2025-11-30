"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { User, Mail, Phone, Cake, Calendar, Watch, Activity, Target, CheckCircle, Clock } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  join_date?: string;
  device_name?: string;
  strava_id?: string;
  pb_hm_seconds?: number;
  pb_fm_seconds?: number;
  pb_hm_approved?: boolean;
  pb_fm_approved?: boolean;
  birth_date?: string;
  phone?: string;
  email?: string;
  last_sync_at?: string;
}

interface Activity {
  id: string;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time?: number;
  average_heartrate?: number;
  average_cadence?: number;
  elevation_gain?: number;
  start_date: string;
}

interface ActivityData {
  date: string;
  km: number;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return "--:--:--";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

function formatPace(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/km`;
}

function PBModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { distance: string; time: string; evidence_link: string }) => void;
  isLoading: boolean;
}) {
  const [distance, setDistance] = useState("21");
  const [time, setTime] = useState("01:30:00");
  const [evidenceLink, setEvidenceLink] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!time || !evidenceLink) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }
    onSubmit({ distance, time, evidence_link: evidenceLink });
    setTime("01:30:00");
    setEvidenceLink("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        <h3 className="text-2xl font-bold mb-4">Cập Nhật Thành Tích Cá Nhân</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cự Ly
            </label>
            <select
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="21">Half Marathon (21 km)</option>
              <option value="42">Full Marathon (42 km)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Thời gian (HH:MM:SS)
            </label>
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="01:30:00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Link Bằng Chứng (Result Page)
            </label>
            <input
              type="url"
              value={evidenceLink}
              onChange={(e) => setEvidenceLink(e.target.value)}
              placeholder="https://example.com/results"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <p className="text-sm text-gray-500 bg-blue-50 p-3 rounded">
            ℹ️ Thành tích này sẽ được gửi cho Admin duyệt trước khi cập nhật
          </p>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {isLoading ? "Đang gửi..." : "Gửi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [showPBModal, setShowPBModal] = useState(false);
  const [submittingPB, setSubmittingPB] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  async function fetchProfileData() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/debug-login";
        return;
      }

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, full_name, avatar_url, join_date, device_name, strava_id, pb_hm_seconds, pb_fm_seconds, pb_hm_approved, pb_fm_approved, birth_date, phone, email, last_sync_at"
        )
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        return;
      }

      setProfile(profileData);
      setStravaConnected(!!profileData?.strava_id);

      // Fetch recent activities (30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: activitiesData, error: activitiesError } = await supabase
        .from("activities")
        .select("id, name, distance, moving_time, elapsed_time, average_heartrate, average_cadence, elevation_gain, start_date")
        .eq("user_id", user.id)
        .gte("start_date", thirtyDaysAgo.toISOString())
        .order("start_date", { ascending: false });

      if (activitiesError) {
        console.error("Error fetching activities:", activitiesError);
      } else if (activitiesData) {
        setActivities(activitiesData);

        // Aggregate activities by date for chart
        const aggregatedData: { [key: string]: number } = {};

        activitiesData.forEach((activity) => {
          const date = new Date(activity.start_date).toLocaleDateString("vi-VN");
          const kmDistance = activity.distance / 1000;
          aggregatedData[date] = (aggregatedData[date] || 0) + kmDistance;
        });

        // Convert to array and sort
        const chartData = Object.entries(aggregatedData)
          .map(([date, km]) => ({ date, km }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setActivityData(chartData);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStravaToggle() {
    if (stravaConnected) {
      // Disconnect
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            strava_id: null,
            strava_access_token: null,
            strava_refresh_token: null,
            strava_token_expires_at: null,
          })
          .eq("id", user.id);

        setStravaConnected(false);
        alert("Đã ngắt kết nối Strava");
      }
    } else {
      // Connect
      window.location.href = "/api/auth/strava/login";
    }
  }

  async function handleSubmitPB(data: { distance: string; time: string; evidence_link: string }) {
    setSubmittingPB(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Parse time to seconds
      const [hours, minutes, seconds] = data.time.split(":").map(Number);
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;

      // Insert into pb_history (pending approval)
      const { error } = await supabase.from("pb_history").insert({
        user_id: user.id,
        distance: data.distance === "21" ? "HM" : "FM",
        time_seconds: totalSeconds,
        achieved_at: new Date().toISOString().split("T")[0],
        evidence_link: data.evidence_link,
      });

      if (error) {
        console.error("Error submitting PB:", error);
        alert("Lỗi khi gửi thành tích");
      } else {
        alert("Thành tích đã được gửi cho Admin duyệt!");
        setShowPBModal(false);
        fetchProfileData();
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Có lỗi xảy ra");
    } finally {
      setSubmittingPB(false);
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

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Không tìm thấy hồ sơ</p>
        </div>
      </div>
    );
  }

  const maxChartValue = Math.max(...activityData.map((d) => d.km), 10);

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4 flex-1">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-white/30 flex items-center justify-center border-4 border-white text-5xl shadow-lg">
                  <User size={80} className="text-[var(--color-primary)]" />
                </div>
              )}

              <div className="flex-1">
                <h1 className="text-4xl font-bold mb-3">{profile.full_name}</h1>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-blue-100">
                  <p className="flex items-center gap-2"><Mail size={16} /> Email: {profile.email || "Chưa cập nhật"}</p>
                  <p className="flex items-center gap-2"><Phone size={16} /> SĐT: {profile.phone || "Chưa cập nhật"}</p>
                  <p className="flex items-center gap-2"><Cake size={16} /> Ngày sinh: {formatDate(profile.birth_date)}</p>
                  <p className="flex items-center gap-2"><Calendar size={16} /> Gia nhập: {formatDate(profile.join_date)}</p>
                  <p className="col-span-2 flex items-center gap-2"><Watch size={16} /> Thiết bị: {profile.device_name || "Chưa cập nhật"}</p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <button
                onClick={handleStravaToggle}
                className={`px-6 py-3 rounded-lg font-bold transition-all whitespace-nowrap shadow-lg ${
                  stravaConnected
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-green-500 hover:bg-green-600"
                }`}
              >
                {stravaConnected ? "🔗 Ngắt kết nối Strava" : "🔗 Kết nối Strava"}
              </button>
            </div>
          </div>

          {/* Strava Status */}
          <div className="mt-6 pt-6 border-t border-white/20">
            {stravaConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-100">
                  <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                  <span>✓ Kết nối Strava: {profile.strava_id}</span>
                </div>
                {profile.last_sync_at && (
                  <span className="text-blue-100 text-sm">
                    Đồng bộ gần nhất: {formatDate(profile.last_sync_at)}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-100">
                <span className="w-3 h-3 bg-red-400 rounded-full"></span>
                <span>✗ Chưa kết nối Strava</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* PB Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* HM PB */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-8 border-2 border-blue-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[var(--color-primary)] flex items-center gap-2"><Activity size={28} /> Half Marathon</h3>
              <span className="text-sm text-gray-600">21 km</span>
            </div>

            <div className="text-center py-8">
              {profile.pb_hm_seconds ? (
                <div>
                  <div className="text-6xl font-bold text-[var(--color-primary)] mb-3">
                    {formatTime(profile.pb_hm_seconds)}
                  </div>
                  <div className="text-lg text-gray-700 mb-6">
                    Pace: <span className="font-semibold">{formatPace((profile.pb_hm_seconds * 1000) / 21000)}</span>
                  </div>
                  {profile.pb_hm_approved ? (
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                      ✓ Đã duyệt
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">
                      ⏳ Chờ duyệt
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-lg">Chưa có thành tích</p>
              )}
            </div>
          </div>

          {/* FM PB */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-lg p-8 border-2 border-purple-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-purple-600 flex items-center gap-2"><Activity size={28} /> Full Marathon</h3>
              <span className="text-sm text-gray-600">42 km</span>
            </div>

            <div className="text-center py-8">
              {profile.pb_fm_seconds ? (
                <div>
                  <div className="text-6xl font-bold text-purple-600 mb-3">
                    {formatTime(profile.pb_fm_seconds)}
                  </div>
                  <div className="text-lg text-gray-700 mb-6">
                    Pace: <span className="font-semibold">{formatPace((profile.pb_fm_seconds * 1000) / 42000)}</span>
                  </div>
                  {profile.pb_fm_approved ? (
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                      ✓ Đã duyệt
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">
                      ⏳ Chờ duyệt
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-lg">Chưa có thành tích</p>
              )}
            </div>
          </div>
        </div>

        {/* Update PB Button */}
        <div className="mb-8">
          <button
            onClick={() => setShowPBModal(true)}
            className="w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:opacity-90 text-white font-bold py-4 rounded-xl transition-all shadow-lg"
          >
            ✏️ Cập Nhật Thành Tích Cá Nhân (PB)
          </button>
        </div>

        {/* Activity Chart */}
        {activityData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">📈 Hoạt Động 30 Ngày Gần Nhất</h3>

            <div className="h-80 flex items-end justify-start gap-1 overflow-x-auto pb-4">
              {activityData.map((data, idx) => {
                const heightPercent = (data.km / maxChartValue) * 100;
                return (
                  <div
                    key={idx}
                    className="flex-shrink-0 flex flex-col items-center"
                    title={`${data.date}: ${data.km.toFixed(1)} km`}
                  >
                    <div
                      className="w-6 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all hover:from-blue-600 hover:to-blue-500 cursor-pointer"
                      style={{ height: `${heightPercent}%`, minHeight: "4px" }}
                    ></div>
                    <div className="text-xs text-gray-600 mt-2 w-12 text-center truncate">
                      {data.km.toFixed(0)}km
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Tổng: <span className="font-bold text-blue-600">{activityData.reduce((sum, d) => sum + d.km, 0).toFixed(1)} km</span>
              </p>
            </div>
          </div>
        )}

        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Activity size={28} /> Lịch Sử Hoạt Động Gần Đây</h3>

          {activities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-2 font-bold text-gray-700">Tên</th>
                    <th className="text-right py-3 px-2 font-bold text-gray-700">KM</th>
                    <th className="text-right py-3 px-2 font-bold text-gray-700">Pace</th>
                    <th className="text-right py-3 px-2 font-bold text-gray-700">Moving</th>
                    <th className="text-right py-3 px-2 font-bold text-gray-700">Elapsed</th>
                    <th className="text-right py-3 px-2 font-bold text-gray-700">HR TB</th>
                    <th className="text-right py-3 px-2 font-bold text-gray-700">Cadence</th>
                    <th className="text-right py-3 px-2 font-bold text-gray-700">Elevation</th>
                    <th className="text-left py-3 px-2 font-bold text-gray-700">Ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => {
                    const kmDistance = activity.distance / 1000;
                    const pace = activity.distance > 0 ? (activity.moving_time * 1000) / activity.distance : 0;
                    return (
                      <tr
                        key={activity.id}
                        className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-2 font-semibold text-gray-900">{activity.name}</td>
                        <td className="py-3 px-2 text-right text-[var(--color-primary)] font-semibold">
                          {kmDistance.toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {formatPace(pace)}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {formatTime(activity.moving_time)}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-500 text-sm">
                          {activity.elapsed_time ? formatTime(activity.elapsed_time) : "N/A"}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {activity.average_heartrate ? `${Math.round(activity.average_heartrate)}` : "N/A"}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {activity.average_cadence ? `${Math.round(activity.average_cadence)}` : "N/A"}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {activity.elevation_gain ? `${Math.round(activity.elevation_gain)} m` : "N/A"}
                        </td>
                        <td className="py-3 px-2 text-gray-600">
                          {formatDate(activity.start_date)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Chưa có hoạt động nào trong 30 ngày gần nhất</p>
            </div>
          )}
        </div>
      </div>

      {/* PB Modal */}
      <PBModal
        isOpen={showPBModal}
        onClose={() => setShowPBModal(false)}
        onSubmit={handleSubmitPB}
        isLoading={submittingPB}
      />
    </div>
  );
}
