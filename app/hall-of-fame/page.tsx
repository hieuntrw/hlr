"use client";

import { useState, useEffect } from "react";
// Use server endpoint for leaderboard data
import { Activity, Crown } from "lucide-react";

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
// getMedalIcon removed (unused)

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
          <div key={person.id} className="flex items-center gap-4 p-4 rounded-xl shadow border-l-4" style={{ background: "var(--color-bg-secondary)", borderColor: "var(--color-primary)" }}>
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
    async function fetchLeaderboard() {
    setLoading(true);

    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const resp = await fetch(`${base}/api/hall-of-fame`, { credentials: 'same-origin' });
      const j = await resp.json().catch(() => null);
      if (resp.ok && j?.ok && Array.isArray(j.data)) {
        // j.data is expected to be ordered top->best (time ascending) and include rank,name,time_seconds,distance
        // Map incoming minimal data to ProfilePB shape used by UI
        const mapped = (Array.isArray(j.data) ? j.data : []).map((p: unknown) => {
          const rec = (p as Record<string, unknown>) || {};
          return {
            id: String(rec.id ?? rec.name ?? ''),
            full_name: String(rec.name ?? ''),
            pb_fm_seconds: Number(rec.time_seconds ?? 0),
            gender: undefined,
          } as ProfilePB;
        });
        setLeaderboard(mapped);
      } else {
        console.warn('[HallOfFame] /api/hall-of-fame failed', j);
        setLeaderboard([]);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
    }
    fetchLeaderboard();
  }, [activeTab]);

  // Determine PB field based on active tab for display
  const getPbField = () => {
    if (activeTab === "fm_female" || activeTab === "fm_male") return "pb_fm_seconds";
    return "pb_hm_seconds";
  };

  const pbField = getPbField();
  const top3 = leaderboard.slice(0, 3);
  const top4_10 = leaderboard.slice(3, 10);
  const top11Plus = leaderboard.slice(10);

  return (
    <div>
      <div className="min-h-screen bg-[var(--color-bg-secondary)]">
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
                className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2`}
                style={
                  activeTab === tab.id
                    ? { background: "var(--color-primary)", color: "var(--color-text-inverse)", boxShadow: "var(--shadow-lg)" }
                    : { background: "var(--color-bg-secondary)", color: "var(--color-text-secondary)", border: "2px solid transparent" }
                }
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--color-primary)" }}></div>
              <p style={{ color: "var(--color-text-secondary)" }}>Đang tải dữ liệu...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {top3.length > 0 && (
              <div className="mb-12">
                <div className="rounded-lg p-4 mb-6 shadow-lg gradient-theme-primary">
                  <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--color-text-inverse)" }}>
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    Top 3 - Bục Vinh Quang
                  </h2>
                </div>
                <Podium data={top3} pbField={pbField} />
              </div>
            )}

            {/* Top 4-10 Cards */}
            {top4_10.length > 0 && (
              <div className="mb-12">
                <div className="rounded-lg p-4 mb-6 shadow-lg gradient-theme-primary">
                  <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--color-text-inverse)" }}>
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="8" r="5"/>
                      <path d="M20 21a8 8 0 1 0-16 0"/>
                      <circle cx="18" cy="8" r="3"/>
                      <circle cx="6" cy="8" r="3"/>
                    </svg>
                    Top 4-10
                  </h2>
                </div>
                <TopCards data={top4_10} pbField={pbField} />
              </div>
            )}

            {/* Top 11+ List */}
            {top11Plus.length > 0 && (
              <div className="mb-12">
                <div className="rounded-lg p-4 mb-6 shadow-lg gradient-theme-primary">
                  <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--color-text-inverse)" }}>
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    Danh Sách Còn Lại
                  </h2>
                </div>
                <LeaderboardList data={top11Plus} pbField={pbField} />
              </div>
            )}

            {leaderboard.length === 0 && (
              <div className="rounded-lg p-12 text-center shadow-sm" style={{ background: "var(--color-bg-secondary)" }}>
                <p className="text-lg" style={{ color: "var(--color-text-secondary)" }}>Chưa có dữ liệu PB được duyệt cho danh mục này</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </div>
  );
}
