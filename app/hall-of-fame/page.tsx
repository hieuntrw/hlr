"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { Activity, User, Users, Crown, Medal, Trophy } from "lucide-react";

interface ProfilePB {
  id: string;
  full_name: string;
  gender?: "Male" | "Female";
  pb_fm_seconds?: number;
  pb_fm_approved?: boolean;
  pb_hm_seconds?: number;
  pb_hm_approved?: boolean;
  device_name?: string;
}

type TabType = "fm_male" | "fm_female" | "hm_male" | "hm_female";

const tabs = [
  { id: "fm_male" as TabType, label: "FM Nam", icon: Activity },
  { id: "fm_female" as TabType, label: "FM Nữ", icon: Activity },
  { id: "hm_male" as TabType, label: "HM Nam", icon: Activity },
  { id: "hm_female" as TabType, label: "HM Nữ", icon: Activity },
];

// Format time (seconds) to readable string (HH:MM:SS)
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

// Medal component for top 3
function getMedalIcon(rank: number) {
  const colors = ["text-yellow-400", "text-gray-400", "text-orange-600"];
  return <Medal size={32} className={colors[rank - 1] || "text-gray-300"} />;
}

// Podium component for Top 3
function Podium({ data, pbField }: { data: ProfilePB[]; pbField: string }) {
  if (data.length === 0) {
    return <div className="text-center text-gray-500 py-12">Chưa có dữ liệu</div>;
  }
  // Reorder to 2-1-3 (podium display: second place left, first place center, third place right)
  const podiumOrder = data.length >= 3 ? [data[1], data[0], data[2]] : data;
  return (
    <div className="relative h-80 flex items-end justify-center gap-8 mb-12">
      {podiumOrder.map((person, idx) => {
        const actualRank = [2, 1, 3][idx];
        const height = ["h-32", "h-44", "h-28"][idx];
        const borderColor = [
          "border-4 border-gray-400", // silver
          "border-6 border-yellow-400", // gold
          "border-4 border-amber-700", // bronze
        ][idx];
        const pbValue = person[pbField as keyof ProfilePB] as number || 0;
        return (
          <div key={person.id} className={`flex flex-col items-center relative ${idx === 1 ? "z-10" : "z-0"}`} style={{ marginTop: idx === 1 ? 0 : 24 }}>
            {/* Crown for Top 1 */}
            {actualRank === 1 && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                <Crown size={48} className="text-yellow-400 fill-yellow-300" />
              </div>
            )}
            {/* Avatar */}
            <div className={`w-24 h-24 rounded-full ${borderColor} bg-gradient-to-tr from-yellow-100 to-white flex items-center justify-center overflow-hidden shadow-lg mb-2`}>
              <span className="text-3xl font-bold text-yellow-700">{person.full_name.charAt(0).toUpperCase()}</span>
            </div>
            {/* Name & PB */}
            <div className={"mt-2 text-lg font-bold text-center"}>{person.full_name}</div>
            <div className="text-sm text-gray-700 font-medium">PB: {formatTime(pbValue)}</div>
            {/* Podium step */}
            <div className={`w-24 ${height} ${actualRank === 1 ? "bg-gradient-to-t from-yellow-400 to-yellow-200 shadow-xl" : actualRank === 2 ? "bg-gradient-to-t from-gray-300 to-gray-100 shadow-lg" : "bg-gradient-to-t from-amber-700 to-yellow-100 shadow-md"} rounded-t-lg flex flex-col items-center justify-end pb-3 mt-2`}>
              <span className="font-bold text-white text-sm">Top {actualRank}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Top 4-10 Cards component
function TopCards({ data, pbField }: { data: ProfilePB[]; pbField: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      {data.map((person, idx) => {
        const pbValue = person[pbField as keyof ProfilePB] as number || 0;
        return (
          <div key={person.id} className="flex items-center gap-4 p-4 rounded-xl bg-white shadow border-l-4 border-[var(--color-primary)]">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center text-white font-bold text-2xl">
              {person.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-[var(--color-primary)]">{person.full_name}</div>
              <div className="text-sm text-gray-700">PB: {formatTime(pbValue)}</div>
              <div className="text-xs text-gray-400">Top {idx + 4}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Leaderboard list for 11+
function LeaderboardList({ data, pbField }: { data: ProfilePB[]; pbField: string }) {
  return (
    <div className="space-y-2">
      {data.map((person, idx) => {
        const pbValue = person[pbField as keyof ProfilePB] as number || 0;
        return (
          <div key={person.id} className="flex items-center gap-3 px-3 py-2 rounded bg-gray-50 border border-gray-200">
            <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-sm">
              {person.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-700">{person.full_name}</div>
              <div className="text-xs text-gray-500">PB: {formatTime(pbValue)}</div>
            </div>
            <div className="text-xs text-gray-400">Top {idx + 11}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function HallOfFamePage() {
  const [activeTab, setActiveTab] = useState<TabType>("fm_male");
  const [leaderboard, setLeaderboard] = useState<ProfilePB[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [activeTab]);

  async function fetchLeaderboard() {
    setLoading(true);

    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, gender, pb_fm_seconds, pb_fm_approved, pb_hm_seconds, pb_hm_approved")
        .not("gender", "is", null);

      if (error) {
        console.error("Error fetching profiles:", error);
        setLeaderboard([]);
        return;
      }

      if (!profiles) {
        setLeaderboard([]);
        return;
      }

      // Determine which PB field and approval flag to use
      let pbField: "pb_fm_seconds" | "pb_hm_seconds";
      let approvalField: "pb_fm_approved" | "pb_hm_approved";
      let targetGender: "Male" | "Female";

      if (activeTab === "fm_male") {
        pbField = "pb_fm_seconds";
        approvalField = "pb_fm_approved";
        targetGender = "Male";
      } else if (activeTab === "fm_female") {
        pbField = "pb_fm_seconds";
        approvalField = "pb_fm_approved";
        targetGender = "Female";
      } else if (activeTab === "hm_male") {
        pbField = "pb_hm_seconds";
        approvalField = "pb_hm_approved";
        targetGender = "Male";
      } else {
        // hm_female
        pbField = "pb_hm_seconds";
        approvalField = "pb_hm_approved";
        targetGender = "Female";
      }

      // Filter and sort
      const filtered = profiles
        .filter((p) => {
          const hasPB = p[pbField] !== null && p[pbField] !== undefined && p[pbField] > 0;
          const isApproved = p[approvalField] === true;
          const matchesGender = p.gender === targetGender;
          return hasPB && isApproved && matchesGender;
        })
        .sort((a, b) => {
          const aTime = a[pbField] || Infinity;
          const bTime = b[pbField] || Infinity;
          return aTime - bTime;
        });

      setLeaderboard(filtered);
    } catch (err) {
      console.error("Unexpected error:", err);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  }

  // Determine PB field for current tab
  let pbField: string = "pb_fm_seconds";
  if (activeTab === "fm_female") pbField = "pb_fm_seconds";
  else if (activeTab === "hm_male") pbField = "pb_hm_seconds";
  else if (activeTab === "hm_female") pbField = "pb_hm_seconds";

  const top3 = leaderboard.slice(0, 3);
  const top4_10 = leaderboard.slice(3, 10);
  const top11Plus = leaderboard.slice(10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 flex items-center gap-3"><Trophy size={48} /> Bảng Vàng</h1>
          <p className="text-blue-100 text-lg">Personal Best - Thành tích chạy marathon & nửa marathon</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-white text-gray-700 hover:bg-gray-100 border-2 border-transparent hover:border-blue-300"
                }`}
              >
                <IconComponent size={20} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Đang tải dữ liệu...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {top3.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Trophy size={28} className="text-yellow-500" /> Top 3 - Bục Vinh Quang</h2>
                <Podium data={top3} pbField={pbField} />
              </div>
            )}

            {/* Top 4-10 Cards */}
            {top4_10.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Medal size={28} className="text-blue-500" /> Top 4-10</h2>
                <TopCards data={top4_10} pbField={pbField} />
              </div>
            )}

            {/* Top 11+ List */}
            {top11Plus.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Users size={28} className="text-gray-600" /> Danh Sách Còn Lại</h2>
                <LeaderboardList data={top11Plus} pbField={pbField} />
              </div>
            )}

            {leaderboard.length === 0 && (
              <div className="bg-white rounded-lg p-12 text-center shadow-sm">
                <p className="text-gray-500 text-lg">Chưa có dữ liệu PB được duyệt cho danh mục này</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
