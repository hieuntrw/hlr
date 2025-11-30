"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";

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
  { id: "fm_male" as TabType, label: "FM Nam", emoji: "🏃‍♂️" },
  { id: "fm_female" as TabType, label: "FM Nữ", emoji: "🏃‍♀️" },
  { id: "hm_male" as TabType, label: "HM Nam", emoji: "🚶‍♂️" },
  { id: "hm_female" as TabType, label: "HM Nữ", emoji: "🚶‍♀️" },
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

// Medal emoji for top 3
function getMedalEmoji(rank: number): string {
  switch (rank) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return "";
  }
}

// Podium component for Top 3
function Podium({ data }: { data: ProfilePB[] }) {
  if (data.length === 0) {
    return <div className="text-center text-gray-500 py-12">Chưa có dữ liệu</div>;
  }

  // Reorder to 2-1-3 (podium display: second place left, first place center, third place right)
  const podiumOrder = data.length >= 3 ? [data[1], data[0], data[2]] : data;

  return (
    <div className="relative h-80 flex items-flex-end justify-center gap-4 mb-12">
      {podiumOrder.map((person, idx) => {
        const actualRank = [2, 1, 3][idx];
        const height = ["h-32", "h-40", "h-28"][idx];
        const medalColor = [
          "ring-2 ring-gray-400", // silver
          "ring-4 ring-yellow-400", // gold
          "ring-2 ring-orange-400", // bronze
        ][idx];

        return (
          <div key={person.id} className={`flex flex-col items-center ${idx === 1 ? "z-10" : ""}`}>
            {/* Medal */}
            <div className="text-5xl mb-2">{getMedalEmoji(actualRank)}</div>

            {/* Avatar with frame */}
            <div
              className={`w-20 h-20 rounded-full ${medalColor} bg-gradient-to-br overflow-hidden mb-3 shadow-lg`}
            >
              <div className="w-full h-full bg-gray-300 flex items-center justify-center text-2xl font-bold text-white">
                {person.full_name.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Rank badge */}
            <div
              className={`absolute top-0 text-lg font-bold px-3 py-1 rounded-full ${
                actualRank === 1
                  ? "bg-yellow-100 text-yellow-800"
                  : actualRank === 2
                    ? "bg-gray-100 text-gray-800"
                    : "bg-orange-100 text-orange-800"
              }`}
            >
              #{actualRank}
            </div>

            {/* Podium step */}
            <div
              className={`w-24 ${height} ${
                actualRank === 1
                  ? "bg-gradient-to-t from-yellow-400 to-yellow-300 shadow-xl"
                  : actualRank === 2
                    ? "bg-gradient-to-t from-gray-300 to-gray-200 shadow-lg"
                    : "bg-gradient-to-t from-orange-400 to-orange-300 shadow-md"
              } rounded-t-lg flex flex-col items-center justify-end pb-3`}
            >
              <p className="font-bold text-white text-sm text-center px-2">{person.full_name}</p>
            </div>

            {/* PB time below podium */}
            <div className="mt-3 text-center">
              <p className="text-xs text-gray-600">PB</p>
              <p className="text-lg font-bold text-gray-900">{formatTime(0)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Top 4-10 Cards component
function TopCards({ data }: { data: ProfilePB[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {data.map((person, idx) => (
        <div
          key={person.id}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow border-2 border-indigo-200"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="text-xl font-bold text-indigo-600 w-8">#{idx + 4}</div>
            <div className="w-12 h-12 rounded-full bg-indigo-300 flex items-center justify-center text-white font-bold text-lg">
              {person.full_name.charAt(0).toUpperCase()}
            </div>
          </div>
          <p className="font-semibold text-gray-900 text-sm mb-1">{person.full_name}</p>
          <p className="text-xs text-gray-600">PB: {formatTime(0)}</p>
        </div>
      ))}
    </div>
  );
}

// Leaderboard list for 11+
function LeaderboardList({ data }: { data: ProfilePB[] }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-gray-100 font-semibold text-sm text-gray-700 border-b">
        <div className="col-span-1">Hạng</div>
        <div className="col-span-1">Avatar</div>
        <div className="col-span-6">Tên</div>
        <div className="col-span-4">PB</div>
      </div>

      <div className="divide-y">
        {data.map((person, idx) => (
          <div
            key={person.id}
            className="grid grid-cols-12 gap-4 px-4 md:px-6 py-4 items-center hover:bg-gray-50 transition-colors"
          >
            <div className="col-span-1 font-bold text-gray-900">#{idx + 11}</div>
            <div className="col-span-1">
              <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-sm">
                {person.full_name.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="col-span-6 md:col-span-6 font-medium text-gray-900">{person.full_name}</div>
            <div className="col-span-4 md:col-span-4 text-sm text-gray-600">{formatTime(0)}</div>
          </div>
        ))}
      </div>
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

  const top3 = leaderboard.slice(0, 3);
  const top4_10 = leaderboard.slice(3, 10);
  const top11Plus = leaderboard.slice(10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">🏆 Bảng Vàng</h1>
          <p className="text-blue-100 text-lg">Personal Best - Thành tích chạy marathon & nửa marathon</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-white text-gray-700 hover:bg-gray-100 border-2 border-transparent hover:border-blue-300"
              }`}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
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
                <h2 className="text-2xl font-bold text-gray-900 mb-6">🥇 Top 3 - Bục Vinh Quang</h2>
                <Podium data={top3} />
              </div>
            )}

            {/* Top 4-10 Cards */}
            {top4_10.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">⭐ Top 4-10</h2>
                <TopCards data={top4_10} />
              </div>
            )}

            {/* Top 11+ List */}
            {top11Plus.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">📋 Danh Sách Còn Lại</h2>
                <LeaderboardList data={top11Plus} />
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
