"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase-client";

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
  phoneNumber?: string | null;
  joinDate?: string | null;
  isStravaConnected: boolean;
  stravaId?: string | null;
  pbHM?: string | null;
  pbFM?: string | null;
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [races, setRaces] = useState<RaceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    // Fetch real profile from Supabase
    async function loadProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select(
            `id, full_name, email, phone_number, join_date, strava_id, pb_hm_seconds, pb_fm_seconds`
          )
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Failed to load profile:", error);
          setLoading(false);
          return;
        }

        if (!profile) {
          setLoading(false);
          return;
        }

        const mapped: UserProfile = {
          id: profile.id,
          fullName: profile.full_name || user.email || "",
          email: profile.email || user.email || "",
          phoneNumber: profile.phone_number || null,
          joinDate: profile.join_date || null,
          isStravaConnected: !!profile.strava_id,
          stravaId: profile.strava_id || null,
          pbHM: profile.pb_hm_seconds ? secondsToTimeString(profile.pb_hm_seconds) : null,
          pbFM: profile.pb_fm_seconds ? secondsToTimeString(profile.pb_fm_seconds) : null,
        };

        setProfile(mapped);
        setLoading(false);
      } catch (err) {
        console.error("Profile load error:", err);
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function secondsToTimeString(sec?: number | null) {
    if (!sec) return null;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  const handleConnectStrava = async () => {
    setConnecting(true);
    // Redirect to Strava login
    window.location.href = "/api/auth/strava/login";
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Đang tải...</div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
                <span className="text-5xl text-white font-bold">
                  {profile?.fullName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {profile?.fullName}
                </h1>
                <p className="text-gray-600">
                  Tham gia từ{" "}
                  {new Date(profile?.joinDate || "").toLocaleDateString("vi-VN")}
                </p>
              </div>
            </div>

            {/* Strava Connection Status */}
            {profile?.isStravaConnected ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-green-600 font-semibold">
                  ✓ Đã kết nối Strava
                </span>
              </div>
            ) : (
              <button
                onClick={handleConnectStrava}
                disabled={connecting}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
              >
                {connecting ? "Đang kết nối..." : "Kết nối Strava"}
              </button>
            )}
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
            <div>
              <p className="text-sm text-gray-600 mb-1">Email</p>
              <p className="font-semibold text-gray-900">{profile?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Số điện thoại</p>
              <p className="font-semibold text-gray-900">
                {profile?.phoneNumber}
              </p>
            </div>
          </div>

          {/* Personal Bests */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Thành tích cá nhân
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-gray-600 mb-1">
                  Kỷ lục bán marathon (21km)
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {profile?.pbHM || "—"}
                </p>
                {profile?.pbHM && (
                  <p className="text-xs text-gray-500 mt-1">
                    Trung bình: {(parseInt(profile.pbHM.split(":")[0]) * 60 + parseInt(profile.pbHM.split(":")[1])) / 21}:00 /km
                  </p>
                )}
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <p className="text-sm text-gray-600 mb-1">
                  Kỷ lục marathon (42km)
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  {profile?.pbFM || "—"}
                </p>
                {profile?.pbFM && (
                  <p className="text-xs text-gray-500 mt-1">
                    Trung bình: {(parseInt(profile.pbFM.split(":")[0]) * 60 + parseInt(profile.pbFM.split(":")[1])) / 42}:00 /km
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Race History */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Lịch sử giải đấu
          </h2>

          {races.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">
                Chưa có kết quả giải đấu nào được ghi nhận
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {races.map((race) => (
                <div
                  key={race.id}
                  className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {race.raceName}
                        </h3>
                        {race.isPR && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
                            ⭐ PB
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {race.distance} • {new Date(race.date).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {race.time}
                      </p>
                      <p className="text-sm text-gray-600">{race.pace}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
