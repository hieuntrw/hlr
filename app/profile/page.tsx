"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { User, Mail, Phone, Cake, Calendar, Watch, Activity, Target, CheckCircle, Clock, Star } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  join_date?: string;
  device_name?: string;
  strava_id?: string;
  strava_athlete_name?: string;
  strava_access_token?: string;
  strava_refresh_token?: string;
  strava_token_expires_at?: number;
  pb_hm_seconds?: number;
  pb_fm_seconds?: number;
  pb_hm_approved?: boolean;
  pb_fm_approved?: boolean;
  dob?: string;
  phone_number?: string;
  email?: string;
  gender?: string;
}

interface Activity {
  id: string;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time?: number;
  average_heartrate?: number;
  average_cadence?: number;
  total_elevation_gain?: number;
  start_date: string;
  type?: string;
  map_summary_polyline?: string;
}

interface ActivityData {
  date: string;
  km: number;
}

interface MemberReward {
  id: string;
  reward_type: string;
  reward_name: string;
  reward_amount: number;
  awarded_at: string;
  status: string;
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
  const [rewards, setRewards] = useState<MemberReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [showPBModal, setShowPBModal] = useState(false);
  const [submittingPB, setSubmittingPB] = useState(false);
  const [syncingActivities, setSyncingActivities] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    phone: "",
    birth_date: "",
    device_name: "",
    pb_hm_time: "",
    pb_fm_time: "",
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  useEffect(() => {
    if (showEditModal && profile) {
      setEditFormData({
        phone: profile.phone_number || "",
        birth_date: profile.dob || "",
        device_name: profile.device_name || "",
        pb_hm_time: profile.pb_hm_seconds ? formatTime(profile.pb_hm_seconds) : "",
        pb_fm_time: profile.pb_fm_seconds ? formatTime(profile.pb_fm_seconds) : "",
      });
    }
  }, [showEditModal, profile]);

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

      console.log("[Profile] Fetching for user:", user.id, user.email);

      // Fetch profile by ID first, then fallback to email if not found
      let { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, full_name, join_date, device_name, strava_id, strava_athlete_name, strava_access_token, strava_refresh_token, strava_token_expires_at, pb_hm_seconds, pb_fm_seconds, pb_hm_approved, pb_fm_approved, dob, phone_number, email, gender"
        )
        .eq("id", user.id)
        .maybeSingle();

      // If not found by ID, try by email
      if (!profileData && user.email) {
        console.log("[Profile] Not found by ID, trying email:", user.email);
        const result = await supabase
          .from("profiles")
          .select(
            "id, full_name, join_date, device_name, strava_id, strava_athlete_name, strava_access_token, strava_refresh_token, strava_token_expires_at, pb_hm_seconds, pb_fm_seconds, pb_hm_approved, pb_fm_approved, dob, phone_number, email, gender"
          )
          .eq("email", user.email)
          .maybeSingle();
        
        profileData = result.data;
        profileError = result.error;
      }

      if (profileError) {
        console.error("[Profile] Error fetching profile:", profileError);
        alert("Lỗi khi tải hồ sơ: " + profileError.message);
        return;
      }

      if (!profileData) {
        console.error("[Profile] No profile found for user:", user.id, user.email);
        alert("Không tìm thấy hồ sơ. Vui lòng liên hệ admin.");
        return;
      }

      console.log("[Profile] Profile loaded:", profileData);
      setProfile(profileData);
      
      // Check Strava connection and token validity
      const hasStravaId = !!profileData?.strava_id;
      const hasValidToken = profileData?.strava_access_token && profileData?.strava_token_expires_at;
      
      if (hasStravaId && hasValidToken) {
        const tokenExpiresAt = new Date(profileData.strava_token_expires_at * 1000);
        const now = new Date();
        const isTokenValid = tokenExpiresAt > now;
        
        if (isTokenValid) {
          console.log("[Profile] Strava token is valid until:", tokenExpiresAt);
          setStravaConnected(true);
        } else {
          console.log("[Profile] Strava token expired at:", tokenExpiresAt);
          // Try to refresh token if refresh token exists
          if (profileData.strava_refresh_token) {
            console.log("[Profile] Attempting to refresh Strava token...");
            try {
              const refreshResponse = await fetch("/api/strava/refresh-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id }),
              });
              
              if (refreshResponse.ok) {
                console.log("[Profile] Token refreshed successfully");
                setStravaConnected(true);
                // Reload profile data to get new token
                fetchProfileData();
                return;
              } else {
                console.log("[Profile] Token refresh failed");
                setStravaConnected(false);
              }
            } catch (err) {
              console.error("[Profile] Token refresh error:", err);
              setStravaConnected(false);
            }
          } else {
            setStravaConnected(false);
          }
        }
      } else {
        setStravaConnected(false);
      }
      
      // Initialize edit form with current data
      const initialEditData = {
        phone: profileData.phone_number || "",
        birth_date: profileData.dob || "",
        device_name: profileData.device_name || "",
        pb_hm_time: profileData.pb_hm_seconds ? formatTime(profileData.pb_hm_seconds) : "",
        pb_fm_time: profileData.pb_fm_seconds ? formatTime(profileData.pb_fm_seconds) : "",
      };
      setEditFormData(initialEditData);

      // Fetch member rewards (milestone achievements)
      const { data: rewardsData, error: rewardsError } = await supabase
        .from("member_rewards")
        .select(`
          id,
          reward_type,
          reward_name,
          reward_amount,
          awarded_at,
          status
        `)
        .eq("user_id", user.id)
        .eq("reward_type", "milestone")
        .order("awarded_at", { ascending: false });

      if (rewardsData) {
        console.log("[Profile] Rewards loaded:", rewardsData);
        setRewards(rewardsData);
      }

      // Fetch recent activities (30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: activitiesData, error: activitiesError } = await supabase
        .from("activities")
        .select("id, name, distance, moving_time, elapsed_time, average_heartrate, average_cadence, total_elevation_gain, start_date, type, map_summary_polyline")
        .eq("user_id", profileData.id)
        .gte("start_date", thirtyDaysAgo.toISOString())
        .order("start_date", { ascending: false });

      if (activitiesError) {
        console.error("Error fetching activities:", activitiesError);
      } else if (activitiesData) {
        setActivities(activitiesData);

        // Aggregate activities by date for chart
        const aggregatedData: { [key: string]: number } = {};

        activitiesData.forEach((activity) => {
          // Use ISO date (YYYY-MM-DD) for proper sorting
          const date = new Date(activity.start_date).toISOString().split("T")[0];
          const kmDistance = activity.distance / 1000;
          aggregatedData[date] = (aggregatedData[date] || 0) + kmDistance;
        });

        // Convert to array and sort by date (ascending - oldest to newest)
        const chartData = Object.entries(aggregatedData)
          .map(([date, km]) => ({ date, km }))
          .sort((a, b) => a.date.localeCompare(b.date)); // Sort ISO dates

        console.log("[Profile] Chart data (sorted):", chartData);
        setActivityData(chartData);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("Có lỗi xảy ra: " + String(err));
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
            strava_athlete_name: null,
            strava_access_token: null,
            strava_refresh_token: null,
            strava_token_expires_at: null,
          })
          .eq("id", user.id);

        setStravaConnected(false);
        alert("Đã ngắt kết nối Strava");
        // Reload profile to reflect changes
        fetchProfileData();
      }
    } else {
      // Connect
      window.location.href = "/api/auth/strava/login";
    }
  }

  async function handleSyncActivities() {
    if (!stravaConnected) {
      alert("Vui lòng kết nối Strava trước!");
      return;
    }

    setSyncingActivities(true);
    setSyncMessage("Đang đồng bộ...");

    try {
      const response = await fetch("/api/strava/sync-activities", {
        method: "POST",
      });

      const result = await response.json();

      if (response.ok) {
        setSyncMessage(`✅ ${result.message || "Đồng bộ thành công!"}`);
        // Reload activities after sync
        setTimeout(() => {
          fetchProfileData();
          setSyncMessage("");
        }, 2000);
      } else {
        setSyncMessage(`❌ Lỗi: ${result.error || "Không thể đồng bộ"}`);
        setTimeout(() => setSyncMessage(""), 3000);
      }
    } catch (error) {
      console.error("Sync error:", error);
      setSyncMessage("❌ Lỗi kết nối");
      setTimeout(() => setSyncMessage(""), 3000);
    } finally {
      setSyncingActivities(false);
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

  async function handleUpdateProfile() {
    if (!profile) return;
    
    setUpdatingProfile(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Update basic profile info
      const { error } = await supabase
        .from("profiles")
        .update({
          phone_number: editFormData.phone || null,
          dob: editFormData.birth_date || null,
          device_name: editFormData.device_name || null,
        })
        .eq("id", profile.id);

      if (error) {
        console.error("Error updating profile:", error);
        alert("Lỗi khi cập nhật: " + error.message);
        return;
      }

      // Process PR updates
      const prUpdates = [];

      // Check HM PR update
      if (editFormData.pb_hm_time && editFormData.pb_hm_time !== "--:--:--") {
        const currentHM = profile.pb_hm_seconds ? formatTime(profile.pb_hm_seconds) : "";
        if (editFormData.pb_hm_time !== currentHM) {
          const [hours, minutes, seconds] = editFormData.pb_hm_time.split(":").map(Number);
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;
          prUpdates.push({
            user_id: user.id,
            distance: "HM",
            time_seconds: totalSeconds,
            achieved_at: new Date().toISOString().split("T")[0],
            evidence_link: "",
          });
        }
      }

      // Check FM PR update
      if (editFormData.pb_fm_time && editFormData.pb_fm_time !== "--:--:--") {
        const currentFM = profile.pb_fm_seconds ? formatTime(profile.pb_fm_seconds) : "";
        if (editFormData.pb_fm_time !== currentFM) {
          const [hours, minutes, seconds] = editFormData.pb_fm_time.split(":").map(Number);
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;
          prUpdates.push({
            user_id: user.id,
            distance: "FM",
            time_seconds: totalSeconds,
            achieved_at: new Date().toISOString().split("T")[0],
            evidence_link: "",
          });
        }
      }

      // Submit PR updates for approval
      if (prUpdates.length > 0) {
        const { error: prError } = await supabase.from("pb_history").insert(prUpdates);
        if (prError) {
          console.error("Error submitting PR:", prError);
          alert("⚠️ Cập nhật thông tin thành công nhưng PR cần admin duyệt");
        } else {
          alert("✓ Cập nhật thành công! PR mới đã gửi cho admin duyệt.");
        }
      } else {
        alert("✓ Cập nhật thông tin thành công!");
      }

      setShowEditModal(false);
      fetchProfileData();
    } catch (err) {
      console.error("Error:", err);
      alert("Có lỗi xảy ra");
    } finally {
      setUpdatingProfile(false);
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

  // Calculate dynamic max value for chart (km with most distance + 10% padding)
  const maxChartValue = activityData.length > 0 
    ? Math.max(...activityData.map(d => d.km)) * 1.1 
    : 10;

  return (
    <div>
      <div className="min-h-screen bg-[var(--color-bg-secondary)]">
        {/* Header */}
        <div className="bg-gray-50 px-4">
          <div className="max-w-7xl mx-auto bg-gradient-to-r from-orange-200 to-orange-300 rounded-xl shadow-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Column 1: Avatar & Basic Info */}
              <div className="bg-white/60 rounded-lg border border-orange-300 p-4">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center border-4 border-orange-400 text-5xl shadow-lg flex-shrink-0">
                    <User size={64} className="text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold mb-3 text-gray-900">{profile.full_name}</h1>
                    <div className="space-y-1.5 text-base text-gray-700">
                      <p className="flex items-center gap-2"><Cake size={16} /> {formatDate(profile.dob)}</p>
                      <p className="flex items-center gap-2"><Watch size={16} /> {profile.device_name || "Chưa cập nhật"}</p>
                      <p className="flex items-center gap-2"><Phone size={16} /> {profile.phone_number || "Chưa cập nhật"}</p>
                      <p className="flex items-center gap-2"><Calendar size={16} /> Gia nhập: {formatDate(profile.join_date)}</p>
                    </div>
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="mt-3 w-full px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded-lg font-medium transition-all shadow text-sm"
                    >
                      📝 Cập nhật thông tin
                    </button>
                  </div>
                </div>
              </div>

              {/* Column 2: Personal Records */}
              <div className="bg-white/60 rounded-lg border border-orange-300 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star size={18} className="text-yellow-600" fill="currentColor" />
                  <span className="font-bold text-sm text-gray-900">Personal Records</span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-700">HM</span>
                    <span className="text-sm font-mono text-gray-900 px-2 py-0.5">
                      {profile.pb_hm_seconds ? formatTime(profile.pb_hm_seconds) : "--:--:--"}
                    </span>
                    {profile.pb_hm_approved ? (
                      <span className="text-xs text-green-600">✓</span>
                    ) : profile.pb_hm_seconds ? (
                      <span className="text-xs text-yellow-600">⏳</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-700">FM</span>
                    <span className="text-sm font-mono text-gray-900 px-2 py-0.5">
                      {profile.pb_fm_seconds ? formatTime(profile.pb_fm_seconds) : "--:--:--"}
                    </span>
                    {profile.pb_fm_approved ? (
                      <span className="text-xs text-green-600">✓</span>
                    ) : profile.pb_fm_seconds ? (
                      <span className="text-xs text-yellow-600">⏳</span>
                    ) : null}
                  </div>
                </div>

                {/* Milestone Rewards */}
                <div className="pt-4 border-t border-orange-300">
                  <h4 className="text-sm font-bold mb-2 flex items-center gap-1.5 text-gray-900">
                    <Target size={14} /> Mốc Thành Tích Đạt Được
                  </h4>
                  {rewards.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {rewards.map((reward) => (
                        <div key={reward.id} className="px-2 py-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{reward.reward_name}</span>
                            <span className="text-green-600 font-bold">
                              {reward.reward_amount.toLocaleString()} ₫
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-600 mt-0.5">
                            {formatDate(reward.awarded_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 italic">Chưa có mốc nào</p>
                  )}
                </div>
              </div>

              {/* Column 3: Strava Connection */}
              <div>
                {stravaConnected ? (
                  <div className="bg-white/60 backdrop-blur rounded-lg p-4 border border-orange-300">
                    <div className="flex items-center gap-2 text-green-700 mb-3">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
                      </svg>
                      <span className="font-bold text-[16px] text-green-800">Đã kết nối Strava</span>
                    </div>
                    <div className="text-[16px] text-gray-700 space-y-2 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600 font-medium w-20 text-sm">Name:</span>
                        <span className="font-semibold text-gray-900">
                          {profile.strava_athlete_name || "(Kết nối lại để cập nhật)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600 font-medium w-20 text-sm">Athlete ID:</span>
                        <span className="font-mono text-gray-900">{profile.strava_id}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600 font-medium w-20 text-sm">Token:</span>
                        <span className="font-mono text-gray-900 truncate">{profile.strava_access_token ? `${profile.strava_access_token.substring(0, 15)}...` : 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600 font-medium w-20 text-sm">Expires:</span>
                        <span className="font-mono text-gray-900">{profile.strava_token_expires_at ? new Date(profile.strava_token_expires_at * 1000).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleSyncActivities}
                        disabled={syncingActivities}
                        className="px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white rounded-lg font-bold transition-all shadow-lg text-xs"
                      >
                        {syncingActivities ? "⏳ Đang đồng bộ..." : "🔄 Đồng bộ"}
                      </button>
                      <button
                        onClick={handleStravaToggle}
                        className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all shadow-lg text-xs"
                      >
                        🔌 Ngắt kết nối
                      </button>
                    </div>
                    {syncMessage && (
                      <p className={`mt-2 text-xs text-center ${syncMessage.includes("✅") ? "text-green-600" : "text-red-600"}`}>
                        {syncMessage}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-50 backdrop-blur rounded-lg p-4 border border-red-300">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                      <span className="font-bold text-sm text-red-700">✗ Chưa kết nối Strava</span>
                    </div>
                    <button
                      onClick={handleStravaToggle}
                      className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold transition-all shadow-lg text-sm"
                    >
                      🔗 Kết nối Strava
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-1">
        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Activity size={28} /> Lịch Sử Hoạt Động Gần Đây (30 ngày)</h3>

          {activities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-2 font-bold text-gray-700">Ngày</th>
                    <th className="text-left py-3 px-2 font-bold text-gray-700">Tên</th>
                    <th className="text-center py-3 px-2 font-bold text-gray-700">Loại</th>
                    <th className="text-right py-3 px-2 font-bold text-gray-700">KM</th>
                    <th className="text-center py-3 px-2 font-bold text-gray-700">GPS</th>
                    <th className="text-right py-3 px-2 font-bold text-gray-700">Pace</th>
                    <th className="text-right py-3 px-2 font-bold text-gray-700">Moving</th>
                    <th className="text-right py-3 px-2 font-bold text-gray-700">HR TB</th>
                    <th className="text-right py-3 px-2 font-bold text-gray-700">Elevation</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => {
                    const kmDistance = activity.distance / 1000;
                    const pace = activity.distance > 0 ? (activity.moving_time * 1000) / activity.distance : 0;
                    
                    // Validation: highlight invalid activities in red
                    const isRunOrWalk = activity.type === "Run" || activity.type === "Walk";
                    const hasMinDistance = kmDistance >= 1;
                    const hasGPS = !!activity.map_summary_polyline;
                    const isValid = isRunOrWalk && hasMinDistance && hasGPS;
                    
                    const rowClass = isValid 
                      ? "border-b border-gray-200 hover:bg-gray-50 transition-colors"
                      : "border-b border-red-200 bg-red-50 hover:bg-red-100 transition-colors";
                    
                    const textClass = isValid ? "text-gray-900" : "text-red-600";
                    
                    return (
                      <tr key={activity.id} className={rowClass}>
                        <td className="py-3 px-2 text-gray-600">
                          {formatDate(activity.start_date)}
                        </td>
                        <td className={`py-3 px-2 font-semibold ${textClass}`}>
                          {activity.name}
                          {!isValid && <span className="ml-2 text-xs">⚠️</span>}
                        </td>
                        <td className={`py-3 px-2 text-center ${isRunOrWalk ? "text-green-600" : "text-red-600"} font-semibold`}>
                          {activity.type || "N/A"}
                        </td>
                        <td className={`py-3 px-2 text-right font-semibold ${hasMinDistance ? "text-[var(--color-primary)]" : "text-red-600"}`}>
                          {kmDistance.toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {hasGPS ? (
                            <span className="text-green-600 font-bold">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold">✗</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {formatPace(pace)}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {formatTime(activity.moving_time)}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {activity.average_heartrate ? `${Math.round(activity.average_heartrate)}` : "N/A"}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-600">
                          {activity.total_elevation_gain ? `${Math.round(activity.total_elevation_gain)} m` : "N/A"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <p className="text-gray-700 mb-2"><strong>Chú thích:</strong></p>
                <ul className="text-gray-600 space-y-1 text-xs">
                  <li>• <span className="text-red-600 font-semibold">Hoạt động đỏ</span>: Không hợp lệ (không phải Run/Walk, hoặc &lt;1km, hoặc không có GPS)</li>
                  <li>• <span className="text-green-600 font-semibold">✓</span>: Có GPS map | <span className="text-red-600 font-semibold">✗</span>: Không có GPS map</li>
                  <li>• Chỉ hiển thị 30 ngày gần nhất</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Chưa có hoạt động nào trong 30 ngày gần nhất</p>
              <p className="text-sm text-gray-400 mt-2">Nhấn nút "Đồng bộ Activities" để tải hoạt động từ Strava</p>
            </div>
          )}
        </div>

        {/* Activity Chart */}
        {activityData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">📈 Biểu Đồ Hoạt Động 30 Ngày</h3>

            <div className="relative">
              {/* Chart area with Y-axis scale */}
              <div className="flex gap-4">
                {/* Y-axis with scale marks */}
                <div className="flex flex-col justify-between h-80 py-2 text-xs text-gray-600">
                  <span>{maxChartValue.toFixed(0)} km</span>
                  <span>{(maxChartValue * 0.75).toFixed(0)}</span>
                  <span>{(maxChartValue * 0.5).toFixed(0)}</span>
                  <span>{(maxChartValue * 0.25).toFixed(0)}</span>
                  <span>0</span>
                </div>

                {/* Chart bars */}
                <div className="flex-1">
                  <div className="h-80 flex items-end justify-start gap-2 overflow-x-auto pb-8 border-l-2 border-b-2 border-gray-300 pl-2">
                    {activityData.map((data, idx) => {
                      const heightPercent = Math.max((data.km / maxChartValue) * 100, 2);
                      const dateShort = new Date(data.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                      const dateFull = new Date(data.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      return (
                        <div
                          key={idx}
                          className="flex-shrink-0 flex flex-col items-center"
                          title={`${dateFull}: ${data.km.toFixed(2)} km`}
                        >
                          <div className="text-xs font-semibold text-blue-600 mb-1">
                            {data.km.toFixed(1)}
                          </div>
                          <div
                            className="w-8 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all hover:from-blue-600 hover:to-blue-500 cursor-pointer shadow-md"
                            style={{ height: `${heightPercent}%` }}
                          ></div>
                          <div className="text-[10px] text-gray-600 mt-2 w-12 text-center rotate-45 origin-top-left">
                            {dateShort}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* X-axis label */}
                  <div className="text-center mt-2">
                    <span className="text-xs font-semibold text-gray-600">Ngày</span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="text-center pt-4 mt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Tổng: <span className="font-bold text-blue-600">{activityData.reduce((sum, d) => sum + d.km, 0).toFixed(1)} km</span>
                  {" • "}
                  Trung bình: <span className="font-bold text-blue-600">{(activityData.reduce((sum, d) => sum + d.km, 0) / activityData.length).toFixed(1)} km/ngày</span>
                  {" • "}
                  Max: <span className="font-bold text-blue-600">{Math.max(...activityData.map(d => d.km)).toFixed(1)} km</span>
                </p>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* PB Modal */}
        <PBModal
          isOpen={showPBModal}
          onClose={() => setShowPBModal(false)}
          onSubmit={handleSubmitPB}
          isLoading={submittingPB}
        />
        
        {/* Edit Profile Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
              <h3 className="text-2xl font-bold mb-4 text-gray-900">Cập Nhật Thông Tin Cá Nhân</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    placeholder="0912345678"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ngày sinh
                  </label>
                  <input
                    type="date"
                    value={editFormData.birth_date}
                    onChange={(e) => setEditFormData({ ...editFormData, birth_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Thiết bị chạy bộ
                  </label>
                  <input
                    type="text"
                    value={editFormData.device_name}
                    onChange={(e) => setEditFormData({ ...editFormData, device_name: e.target.value })}
                    placeholder="Garmin Forerunner 245"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Star size={18} className="text-yellow-500" fill="currentColor" />
                    Personal Records
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Half Marathon (HH:MM:SS)
                      </label>
                      <input
                        type="text"
                        value={editFormData.pb_hm_time}
                        onChange={(e) => setEditFormData({ ...editFormData, pb_hm_time: e.target.value })}
                        placeholder="01:30:00"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Full Marathon (HH:MM:SS)
                      </label>
                      <input
                        type="text"
                        value={editFormData.pb_fm_time}
                        onChange={(e) => setEditFormData({ ...editFormData, pb_fm_time: e.target.value })}
                        placeholder="03:00:00"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">⏳ PR mới cần được admin phê duyệt</p>
                </div>

                <p className="text-sm text-gray-500 bg-blue-50 p-3 rounded">
                  ℹ️ Email và Họ tên không thể thay đổi. Vui lòng liên hệ admin nếu cần.
                </p>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleUpdateProfile}
                    disabled={updatingProfile}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 transition-colors"
                  >
                    {updatingProfile ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
