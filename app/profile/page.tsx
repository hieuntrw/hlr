"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { User, Mail, Phone, Cake, Calendar, Watch, Activity, Target, CheckCircle, Clock, Star } from "lucide-react";

import { useAuth } from "@/lib/auth/AuthContext";
interface Profile {
  id: string;
  full_name: string | null;
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
  id: string;
  user_id: string;
  status: string;
  awarded_date: string;
  created_at: string;
  reward_definition_id: string;
  reward_definitions: {
    id: string;
    type: string;
    category: string;
    condition_label: string;
    prize_description: string;
    cash_amount: number;
  } | null;
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
      <div className="rounded-lg shadow-lg max-w-md w-full p-6" style={{ background: "var(--color-bg-secondary)" }}>
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

          <p className="text-sm text-gray-500 p-3 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            ℹ️ Thành tích này sẽ được gửi cho Admin duyệt trước khi cập nhật
          </p>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg transition-colors"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-tertiary)" }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-white rounded-lg transition-colors"
              style={{ backgroundColor: isLoading ? 'var(--color-text-secondary)' : 'var(--color-info)', opacity: isLoading ? 0.6 : 1 }}
              onMouseEnter={(e) => !isLoading && (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => !isLoading && (e.currentTarget.style.opacity = '1')}
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
  const { user, profile, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [localProfile, setLocalProfile] = useState<Profile | null>(null);
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

  // Tách loading cho từng phần dữ liệu
  const [profileLoading, setProfileLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [rewardsLoading, setRewardsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent("/profile")}`);
      return;
    }
    // Ưu tiên dùng profile từ AuthContext nếu có
    if (profile) {
      setLocalProfile(profile);
      setProfileLoading(false);
    } else {
      setProfileLoading(true);
      fetchProfileFromSupabase().finally(() => setProfileLoading(false));
    }
    // Fetch activities
    setActivitiesLoading(true);
    fetchActivities().finally(() => setActivitiesLoading(false));
    // Fetch rewards
    setRewardsLoading(true);
    fetchRewards().finally(() => setRewardsLoading(false));
  }, [user, profile, authLoading]);

  useEffect(() => {
    if (showEditModal && localProfile) {
      setEditFormData({
        phone: localProfile.phone_number || "",
        birth_date: localProfile.dob || "",
        device_name: localProfile.device_name || "",
        pb_hm_time: localProfile.pb_hm_seconds ? formatTime(localProfile.pb_hm_seconds) : "",
        pb_fm_time: localProfile.pb_fm_seconds ? formatTime(localProfile.pb_fm_seconds) : "",
      });
    }
  }, [showEditModal, localProfile]);

  async function fetchProfileFromSupabase() {
    // Wait for auth to finish loading
    if (authLoading) return;
    setLoading(true);

    try {
      // Using user from AuthContext
      if (!user) {
        window.location.href = "/debug-login";
        return;
      }

      // Log session/JWT/token for debugging
      const session = supabase.auth.getSession ? await supabase.auth.getSession() : null;
      console.log("[Profile] User:", user);
      console.log("[Profile] Session:", session);
      if (session && session.data && session.data.session) {
        console.log("[Profile] JWT:", session.data.session.access_token);
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
      setLocalProfile(profileData);
      
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
                fetchProfileFromSupabase();
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

        // Generate full 30-day range (including days with no activities)
        const chartData: ActivityData[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 29; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split("T")[0];
          chartData.push({
            date: dateStr,
            km: aggregatedData[dateStr] || 0
          });
        }

        console.log("[Profile] Chart data (30 days with zeros):", chartData);
        setActivityData(chartData);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("Có lỗi xảy ra: " + String(err));
    } finally {
      setLoading(false);
    }
  }

  async function fetchActivities() {
    if (!user) return;

    try {
      // Fetch recent activities (30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: activitiesData, error: activitiesError } = await supabase
        .from("activities")
        .select("id, name, distance, moving_time, elapsed_time, average_heartrate, average_cadence, total_elevation_gain, start_date, type, map_summary_polyline")
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
          // Use ISO date (YYYY-MM-DD) for proper sorting
          const date = new Date(activity.start_date).toISOString().split("T")[0];
          const kmDistance = activity.distance / 1000;
          aggregatedData[date] = (aggregatedData[date] || 0) + kmDistance;
        });

        // Generate full 30-day range (including days with no activities)
        const chartData: ActivityData[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 29; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split("T")[0];
          chartData.push({
            date: dateStr,
            km: aggregatedData[dateStr] || 0
          });
        }

        setActivityData(chartData);
      }
    } catch (err) {
      console.error("Error fetching activities:", err);
    }
  }

  async function fetchRewards() {
    if (!user) return;

    try {
      // Fetch member rewards (milestone achievements) with join to reward_definitions
      const { data: rewardsData, error: rewardsError } = await supabase
        .from("member_rewards")
        .select(`id, user_id, status, awarded_date, created_at, reward_definition_id, reward_definitions(id, type, category, condition_label, prize_description, cash_amount)`)
        .eq("user_id", user.id)
        .order("awarded_date", { ascending: false });

      if (rewardsError) throw rewardsError;
      if (rewardsData) {
        setRewards(rewardsData as MemberReward[]);
      }
    } catch (err) {
      console.error("Error fetching rewards:", err);
      setRewards([]);
    }
  }

  async function handleStravaToggle() {
    if (stravaConnected) {
      // Disconnect
      // Using user from AuthContext
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
        fetchProfileFromSupabase();
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
          fetchProfileFromSupabase();
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
      // Using user from AuthContext
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
        fetchProfileFromSupabase();
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Có lỗi xảy ra");
    } finally {
      setSubmittingPB(false);
    }
  }

  async function handleUpdateProfile() {
    if (!localProfile) return;
    
    setUpdatingProfile(true);
    try {
      // Using user from AuthContext
      if (!user) return;

      // Update basic profile info
      const { error } = await supabase
        .from("profiles")
        .update({
          phone_number: editFormData.phone || null,
          dob: editFormData.birth_date || null,
          device_name: editFormData.device_name || null,
        })
        .eq("id", localProfile.id);

      if (error) {
        console.error("Error updating profile:", error);
        alert("Lỗi khi cập nhật: " + error.message);
        return;
      }

      // Process PR updates
      const prUpdates = [];

      // Check HM PR update
      if (editFormData.pb_hm_time && editFormData.pb_hm_time !== "--:--:--") {
        const currentHM = localProfile.pb_hm_seconds ? formatTime(localProfile.pb_hm_seconds) : "";
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
        const currentFM = localProfile.pb_fm_seconds ? formatTime(localProfile.pb_fm_seconds) : "";
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
      fetchProfileFromSupabase();
    } catch (err) {
      console.error("Error:", err);
      alert("Có lỗi xảy ra");
    } finally {
      setUpdatingProfile(false);
    }
  }

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

  if (!localProfile) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-secondary)] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg" style={{ color: "var(--color-text-secondary)" }}>Không tìm thấy hồ sơ</p>
        </div>
      </div>
    );
  }

  // Calculate dynamic max value for chart (km with most distance + 10% padding)
  const maxKm = activityData.length > 0 ? Math.max(...activityData.map(d => d.km)) : 0;
  const maxChartValue = maxKm > 0 ? maxKm * 1.1 : 10;

  return (
    <div>
      <div className="min-h-screen bg-[var(--color-bg-secondary)]">
        {/* Header */}
        <div className="px-4 bg-[var(--color-bg-secondary)]">
          <div className="max-w-7xl mx-auto rounded-xl shadow-lg p-4" style={{ background: 'linear-gradient(to right, var(--color-accent-light), var(--color-accent))' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Column 1: Avatar & Basic Info */}
              <div className="rounded-lg border p-4" style={{ background: "rgba(var(--color-bg-secondary-rgb, 255, 255, 255), 0.6)", borderColor: 'var(--color-accent)', backdropFilter: 'blur(10px)' }}>
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 rounded-full flex items-center justify-center border-4 text-5xl shadow-lg flex-shrink-0" style={{ background: "var(--color-bg-primary)", borderColor: 'var(--color-primary)' }}>
                    <User size={64} style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold mb-3 text-gray-900">{localProfile.full_name}</h1>
                    <div className="space-y-1.5 text-base text-gray-700">
                      <p className="flex items-center gap-2"><Cake size={16} /> {formatDate(localProfile.dob)}</p>
                      <p className="flex items-center gap-2"><Watch size={16} /> {localProfile.device_name || "Chưa cập nhật"}</p>
                      <p className="flex items-center gap-2"><Phone size={16} /> {localProfile.phone_number || "Chưa cập nhật"}</p>
                      <p className="flex items-center gap-2"><Calendar size={16} /> Gia nhập: {formatDate(localProfile.join_date)}</p>
                    </div>
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="mt-3 w-full px-4 py-2 text-white rounded-lg font-medium transition-all shadow text-sm"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      📝 Cập nhật thông tin
                    </button>
                  </div>
                </div>
              </div>

              {/* Column 2: Personal Records */}
              <div className="rounded-lg border p-4" style={{ background: "rgba(var(--color-bg-secondary-rgb, 255, 255, 255), 0.6)", borderColor: 'var(--color-accent)', backdropFilter: 'blur(10px)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Star size={18} className="text-yellow-600" fill="currentColor" />
                  <span className="font-bold text-sm text-gray-900">Personal Records</span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-700">HM</span>
                    <span className="text-sm font-mono text-gray-900 px-2 py-0.5">
                      {localProfile.pb_hm_seconds ? formatTime(localProfile.pb_hm_seconds) : "--:--:--"}
                    </span>
                    {localProfile.pb_hm_approved ? (
                      <span className="text-xs" style={{ color: 'var(--color-success)' }}>✓</span>
                    ) : localProfile.pb_hm_seconds ? (
                      <span className="text-xs text-yellow-600">⏳</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-700">FM</span>
                    <span className="text-sm font-mono text-gray-900 px-2 py-0.5">
                      {localProfile.pb_fm_seconds ? formatTime(localProfile.pb_fm_seconds) : "--:--:--"}
                    </span>
                    {localProfile.pb_fm_approved ? (
                      <span className="text-xs" style={{ color: 'var(--color-success)' }}>✓</span>
                    ) : localProfile.pb_fm_seconds ? (
                      <span className="text-xs text-yellow-600">⏳</span>
                    ) : null}
                  </div>
                </div>

                {/* Milestone Rewards */}
                <div className="pt-4 border-t" style={{ borderColor: 'var(--color-accent)' }}>
                  <h4 className="text-sm font-bold mb-2 flex items-center gap-1.5 text-gray-900">
                    <Target size={14} /> Mốc Thành Tích Đạt Được
                  </h4>
                  {rewards.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {rewards.map((reward) => (
                        <div key={reward.id} className="px-2 py-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{reward.reward_name}</span>
                            <span className="font-bold" style={{ color: 'var(--color-success)' }}>
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
                  <div className="backdrop-blur rounded-lg p-4 border" style={{ background: "rgba(var(--color-bg-secondary-rgb, 255, 255, 255), 0.6)", borderColor: 'var(--color-accent)' }}>
                    <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--color-success)' }}>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
                      </svg>
                      <span className="font-bold text-[16px]" style={{ color: 'var(--color-success)' }}>Đã kết nối Strava</span>
                    </div>
                    <div className="text-[16px] text-gray-700 space-y-2 mb-3">
                      <div className="flex items-center gap-3">
                        <User size={16} style={{ color: 'var(--color-success)' }} />
                        <span className="text-gray-600 font-medium w-20 text-sm">Name:</span>
                        <span className="font-semibold text-gray-900">
                          {localProfile.strava_athlete_name || "(Kết nối lại để cập nhật)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4" style={{ color: 'var(--color-success)' }} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        <span className="text-gray-600 font-medium w-20 text-sm">Athlete ID:</span>
                        <span className="font-mono text-gray-900">{localProfile.strava_id}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4" style={{ color: 'var(--color-success)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        <span className="text-gray-600 font-medium w-20 text-sm">Token:</span>
                        <span className="font-mono text-gray-900 truncate">{localProfile.strava_access_token ? `${localProfile.strava_access_token.substring(0, 15)}...` : 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4" style={{ color: 'var(--color-success)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span className="text-gray-600 font-medium w-20 text-sm">Expires:</span>
                        <span className="font-mono text-gray-900">{localProfile.strava_token_expires_at ? new Date(localProfile.strava_token_expires_at * 1000).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleSyncActivities}
                        disabled={syncingActivities}
                        className="px-3 py-2 text-white rounded-lg font-bold transition-all shadow-lg text-xs"
                        style={{ backgroundColor: syncingActivities ? 'var(--color-text-secondary)' : 'var(--color-primary)', opacity: syncingActivities ? 0.6 : 1 }}
                        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.opacity = '0.9')}
                        onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.opacity = '1')}
                      >
                        {syncingActivities ? "⏳ Đang đồng bộ..." : "🔄 Đồng bộ"}
                      </button>
                      <button
                        onClick={handleStravaToggle}
                        className="px-3 py-2 text-white rounded-lg font-bold transition-all shadow-lg text-xs"
                        style={{ backgroundColor: 'var(--color-error, #EF4444)' }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        🔌 Ngắt kết nối
                      </button>
                    </div>
                    {syncMessage && (
                      <p className={`mt-2 text-xs text-center ${syncMessage.includes("✅") ? "" : "text-red-600"}`} style={syncMessage.includes("✅") ? { color: 'var(--color-success)' } : undefined}>
                        {syncMessage}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="backdrop-blur rounded-lg p-4 border" style={{ background: "var(--color-error-bg, #FEE2E2)", borderColor: "var(--color-error, #EF4444)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-3 h-3 rounded-full" style={{ background: "var(--color-error, #EF4444)" }}></span>
                      <span className="font-bold text-sm" style={{ color: "var(--color-error, #B91C1C)" }}>✗ Chưa kết nối Strava</span>
                    </div>
                    <button
                      onClick={handleStravaToggle}
                      className="w-full px-4 py-2 text-white rounded-lg font-bold transition-all shadow-lg text-sm"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
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
        <div className="rounded-lg shadow-md p-6 mb-8" style={{ background: "var(--color-bg-secondary)" }}>
          <h3 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--color-primary)' }}><Activity size={28} style={{ color: 'var(--color-primary)' }} /> Lịch sử hoạt động gần đây</h3>

          {activities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-2 font-bold" style={{ color: 'var(--color-primary)' }}>Ngày</th>
                    <th className="text-left py-3 px-2 font-bold" style={{ color: 'var(--color-primary)' }}>Tên</th>
                    <th className="text-center py-3 px-2 font-bold" style={{ color: 'var(--color-primary)' }}>Loại</th>
                    <th className="text-right py-3 px-2 font-bold" style={{ color: 'var(--color-primary)' }}>KM</th>
                    <th className="text-center py-3 px-2 font-bold" style={{ color: 'var(--color-primary)' }}>GPS</th>
                    <th className="text-right py-3 px-2 font-bold" style={{ color: 'var(--color-primary)' }}>Pace</th>
                    <th className="text-right py-3 px-2 font-bold" style={{ color: 'var(--color-primary)' }}>Moving Time</th>
                    <th className="text-right py-3 px-2 font-bold" style={{ color: 'var(--color-primary)' }}>HR TB</th>
                    <th className="text-right py-3 px-2 font-bold" style={{ color: 'var(--color-primary)' }}>Elevation</th>
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
                      ? "border-b hover:opacity-95 transition-colors"
                      : "border-b transition-colors";
                    
                    const rowStyle = isValid
                      ? { borderColor: "var(--color-border)" }
                      : { borderColor: "var(--color-error)", background: "var(--color-error-bg, #FEE2E2)" };
                    
                    const textClass = isValid ? "text-gray-900" : "text-red-600";
                    
                    return (
                      <tr key={activity.id} className={rowClass} style={rowStyle}>
                        <td className="py-3 px-2 text-gray-600">
                          {formatDate(activity.start_date)}
                        </td>
                        <td className={`py-3 px-2 font-semibold ${textClass}`}>
                          {activity.name}
                          {!isValid && <span className="ml-2 text-xs">⚠️</span>}
                        </td>
                        <td className={`py-3 px-2 text-center ${isRunOrWalk ? "text-gray-900" : "text-red-600"}`}>
                          {activity.type || "N/A"}
                        </td>
                        <td className={`py-3 px-2 text-right ${hasMinDistance ? "text-gray-900" : "text-red-600"}`}>
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
              
              <div className="mt-4 p-3 border rounded text-sm" style={{ background: "var(--color-warning-bg, #FEF3C7)", borderColor: "var(--color-warning, #F59E0B)" }}>
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
          <div className="rounded-lg shadow-md p-6" style={{ background: "var(--color-bg-secondary)" }}>
            <h3 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-primary)' }}>📈 Biểu đồ</h3>

            <div className="relative overflow-hidden">
              {/* Chart area with Y-axis scale */}
              <div className="flex gap-2">
                {/* Y-axis with scale marks */}
                <div className="flex flex-col justify-between h-80 py-2 text-xs text-gray-600 font-semibold" style={{ width: '45px' }}>
                  <span>{maxChartValue.toFixed(1)}</span>
                  <span>{(maxChartValue * 0.75).toFixed(1)}</span>
                  <span>{(maxChartValue * 0.5).toFixed(1)}</span>
                  <span>{(maxChartValue * 0.25).toFixed(1)}</span>
                  <span>0</span>
                </div>

                {/* Chart bars container */}
                <div className="flex-1 overflow-hidden">
                  {/* Bars area */}
                  <div className="h-80 flex items-end justify-between border-l-2 border-b-2 border-gray-300 px-2">
                    {activityData.map((data, idx) => {
                      const heightPercent = maxChartValue > 0 ? (data.km / maxChartValue) * 100 : 0;
                      const dateShort = new Date(data.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                      const dateFull = new Date(data.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center"
                          style={{ minWidth: 0, maxWidth: '28px', height: '100%' }}
                          title={`${dateFull}: ${data.km.toFixed(2)} km`}
                        >
                          <div className="flex-1 flex flex-col justify-end items-center w-full px-0.5">
                            {data.km > 0 && (
                              <div className="text-[8px] font-bold mb-1 whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>
                                {data.km.toFixed(1)}
                              </div>
                            )}
                            <div
                              className="w-full rounded-t transition-all cursor-pointer"
                              style={{ 
                                height: `${heightPercent}%`,
                                minHeight: data.km > 0 ? '3px' : '0px',
                                background: data.km > 0 ? 'linear-gradient(to bottom, var(--color-primary-light), var(--color-primary-dark))' : 'transparent',
                                boxShadow: data.km > 0 ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Date labels below */}
                  <div className="flex justify-between px-2" style={{ height: '48px', marginTop: '4px' }}>
                    {activityData.map((data, idx) => {
                      const dateShort = new Date(data.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                      return (
                        <div
                          key={idx}
                          className="flex-1 flex justify-center items-start"
                          style={{ minWidth: 0, maxWidth: '28px' }}
                        >
                          <div className="text-[9px] font-semibold text-gray-700 text-center whitespace-nowrap transform -rotate-45 origin-top-left" style={{ marginTop: '6px' }}>
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
                  Tổng: <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{activityData.reduce((sum, d) => sum + d.km, 0).toFixed(1)} km</span>
                  {" • "}
                  Trung bình: <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{(activityData.reduce((sum, d) => sum + d.km, 0) / 30).toFixed(1)} km/ngày</span>
                  {" • "}
                  Max: <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{Math.max(...activityData.map(d => d.km)).toFixed(1)} km</span>
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
            <div className="rounded-lg shadow-lg w-full p-6" style={{ maxWidth: '480px', background: "var(--color-bg-secondary)" }}>
              <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--color-primary)' }}>Cập nhật thông tin</h3>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-700" style={{ minWidth: '110px' }}>
                    Số điện thoại:
                  </label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    placeholder="0912345678"
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                    style={{ width: '250px' }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-700" style={{ minWidth: '110px' }}>
                    Ngày sinh:
                  </label>
                  <input
                    type="text"
                    value={editFormData.birth_date ? new Date(editFormData.birth_date).toLocaleDateString('en-GB') : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Convert dd/mm/yyyy to yyyy-mm-dd for storage
                      const parts = value.split('/');
                      if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
                        const isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        setEditFormData({ ...editFormData, birth_date: isoDate });
                      } else {
                        // Allow typing
                        setEditFormData({ ...editFormData, birth_date: value });
                      }
                    }}
                    placeholder="dd/mm/yyyy"
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                    style={{ width: '250px' }}
                    maxLength={10}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-700" style={{ minWidth: '110px' }}>
                    Thiết bị chạy bộ:
                  </label>
                  <input
                    type="text"
                    value={editFormData.device_name}
                    onChange={(e) => setEditFormData({ ...editFormData, device_name: e.target.value })}
                    placeholder="Garmin Forerunner 245"
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                    style={{ width: '250px' }}
                  />
                </div>

                <div style={{ marginLeft: '112px', borderTop: '1px solid var(--color-primary)', opacity: 0.3, marginTop: '12px', marginBottom: '12px', width: '250px' }}></div>

                <div>
                  <h4 className="text-sm font-bold mb-1.5 flex items-center gap-2" style={{ color: 'var(--color-primary)', marginLeft: '112px' }}>
                    <Star size={14} className="text-yellow-500" fill="currentColor" />
                    Personal Records
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-gray-700" style={{ minWidth: '110px' }}>
                        Half Marathon:
                      </label>
                      <input
                        type="text"
                        value={editFormData.pb_hm_time}
                        onChange={(e) => setEditFormData({ ...editFormData, pb_hm_time: e.target.value })}
                        placeholder="01:30:00 (HH:MM:SS)"
                        className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                        style={{ width: '250px' }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-gray-700" style={{ minWidth: '110px' }}>
                        Full Marathon:
                      </label>
                      <input
                        type="text"
                        value={editFormData.pb_fm_time}
                        onChange={(e) => setEditFormData({ ...editFormData, pb_fm_time: e.target.value })}
                        placeholder="03:00:00 (HH:MM:SS)"
                        className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                        style={{ width: '250px' }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1.5" style={{ marginLeft: '112px' }}>⏳ PR mới cần được admin phê duyệt</p>
                </div>

                <div className="flex items-start gap-2">
                  <label className="text-sm font-semibold text-gray-700" style={{ minWidth: '110px', paddingTop: '6px' }}>
                    Lưu ý:
                  </label>
                  <p className="text-[10px] text-gray-500 p-1.5 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)', width: '250px' }}>
                    ℹ️ Email và Họ tên không thể thay đổi. Liên hệ admin nếu cần.
                  </p>
                </div>

                <div className="flex gap-2 pt-2" style={{ marginLeft: '112px' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-1 text-xs rounded transition-colors"
                    style={{ 
                      border: '1px solid var(--color-primary)',
                      color: 'var(--color-primary)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleUpdateProfile}
                    disabled={updatingProfile}
                    className="px-4 py-1 text-xs text-white rounded transition-colors disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                    onMouseEnter={(e) => {
                      if (!updatingProfile) e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      if (!updatingProfile) e.currentTarget.style.opacity = '1';
                    }}
                  >
                    {updatingProfile ? "Đang lưu..." : "Lưu"}
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
