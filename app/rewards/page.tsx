"use client";

import { useEffect, useState, useCallback } from "react";
// Use server endpoint to fetch rewards data to avoid client direct DB calls
import { useAuth } from "@/lib/auth/AuthContext";
import { Gift, Trophy, Star, Calendar, CheckCircle } from "lucide-react";

interface MilestoneReward {
  id: string;
  race_type: string;
  gender: string;
  milestone_name: string;
  time_seconds: number;
  reward_description: string;
  cash_amount: number;
  priority: number;
}

interface MemberMilestone {
  id: string;
  race_id: string;
  milestone_id: string;
  achieved_time_seconds: number;
  reward_description: string;
  cash_amount: number;
  status: string;
  delivered_at: string | null;
  race: {
    name: string;
    date: string;
  };
  milestone: MilestoneReward;
}

interface PodiumReward {
  id: string;
  race_id: string;
  podium_type: string;
  rank: number;
  reward_description: string;
  cash_amount: number;
  status: string;
  delivered_at: string | null;
  race: {
    name: string;
    date: string;
  };
}

interface LuckyDrawWin {
  id: string;
  challenge_id: string;
  reward_description: string;
  status: string;
  delivered_at: string | null;
  challenge: {
    name: string;
    month: number;
    year: number;
  };
}

export default function RewardsPage() {
  const { user, isLoading: authLoading, profile: authProfile, sessionChecked } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Milestones data
  const [fmMilestones, setFmMilestones] = useState<MilestoneReward[]>([]);
  const [hmMilestones, setHmMilestones] = useState<MilestoneReward[]>([]);
  const [achievedMilestones, setAchievedMilestones] = useState<MemberMilestone[]>([]);
  
  // Other rewards
  const [podiumRewards, setPodiumRewards] = useState<PodiumReward[]>([]);
  const [luckyDrawWins, setLuckyDrawWins] = useState<LuckyDrawWin[]>([]);
  
  const [activeTab, setActiveTab] = useState<"fm" | "hm" | "podium" | "lucky">("fm");

  const loadData = useCallback(async () => {
    // Wait for auth to finish loading and sessionChecked (whoami) to complete
    if (authLoading || !sessionChecked) return;

    try {
      if (!user && !authProfile) {
        window.location.href = "/login";
        return;
      }

      // Call server endpoint that aggregates rewards-related data for the authenticated user
      const resp = await fetch('/api/profile/rewards-summary', { credentials: 'same-origin' });
      const j = await resp.json().catch(() => null);
      if (!resp.ok || !j?.ok) {
        console.error('[Rewards] rewards-summary API failed', j);
        // keep authProfile from AuthContext; no local profile state needed
        setFmMilestones([]);
        setHmMilestones([]);
        setAchievedMilestones([]);
        setPodiumRewards([]);
        setLuckyDrawWins([]);
      } else {
        const profileRow = j.profile || authProfile || null;
        const allMilestones = Array.isArray(j.milestones) ? j.milestones : [];
        setFmMilestones((allMilestones as unknown[]).filter((m: unknown) => {
          const rec = (m as Record<string, unknown>) || {};
          return String(rec.race_type ?? '') === 'FM' && String(rec.gender ?? '') === String(profileRow?.gender ?? '');
        }) as MilestoneReward[]);
        setHmMilestones((allMilestones as unknown[]).filter((m: unknown) => {
          const rec = (m as Record<string, unknown>) || {};
          return String(rec.race_type ?? '') === 'HM' && String(rec.gender ?? '') === String(profileRow?.gender ?? '');
        }) as MilestoneReward[]);
        setAchievedMilestones(Array.isArray(j.achieved) ? (j.achieved as MemberMilestone[]) : []);
        setPodiumRewards(Array.isArray(j.podium) ? (j.podium as PodiumReward[]) : []);
        setLuckyDrawWins(Array.isArray(j.lucky) ? (j.lucky as LuckyDrawWin[]) : []);
      }
    } catch (error) {
      console.error("Error loading rewards data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading, sessionChecked, authProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatTime = (seconds: number) => {
    if (seconds >= 999999) return "Hoàn thành";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const isMilestoneAchieved = (milestoneId: string) => {
    return achievedMilestones.some(m => m.milestone_id === milestoneId);
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { label: string; style: React.CSSProperties } } = {
      pending: { label: "Chờ duyệt", style: { backgroundColor: 'var(--color-warning)', color: 'white', opacity: 0.9 } },
      approved: { label: "Đã duyệt", style: { backgroundColor: 'var(--color-info)', color: 'white', opacity: 0.9 } },
      delivered: { label: "Đã trao", style: { backgroundColor: 'var(--color-success)', color: 'white', opacity: 0.9 } },
      rejected: { label: "Từ chối", style: { backgroundColor: 'var(--color-error)', color: 'white', opacity: 0.9 } },
    };
    const badge = badges[status] || badges.pending;
    return <span className="px-2 py-1 rounded-full text-xs font-medium" style={badge.style}>{badge.label}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-secondary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--color-primary)" }}></div>
          <p style={{ color: "var(--color-text-secondary)" }}>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 border-b border-gray-300">
          <button
            onClick={() => setActiveTab("fm")}
            className="flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap"
            style={
              activeTab === "fm"
                ? { background: "var(--color-bg-secondary)", color: "var(--color-primary)", borderBottom: "2px solid var(--color-primary)" }
                : { color: "var(--color-text-secondary)", background: "transparent" }
            }
          >
            <Trophy size={20} />
            Mốc FM
          </button>
          <button
            onClick={() => setActiveTab("hm")}
            className="flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap"
            style={
              activeTab === "hm"
                ? { background: "var(--color-bg-secondary)", color: "var(--color-primary)", borderBottom: "2px solid var(--color-primary)" }
                : { color: "var(--color-text-secondary)", background: "transparent" }
            }
          >
            <Trophy size={20} />
            Mốc HM
          </button>
          <button
            onClick={() => setActiveTab("podium")}
            className="flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap"
            style={
              activeTab === "podium"
                ? { background: "var(--color-bg-secondary)", color: "var(--color-primary)", borderBottom: "2px solid var(--color-primary)" }
                : { color: "var(--color-text-secondary)", background: "transparent" }
            }
          >
            <Star size={20} />
            Đứng bục ({podiumRewards.length})
          </button>
          <button
            onClick={() => setActiveTab("lucky")}
            className="flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap"
            style={
              activeTab === "lucky"
                ? { background: "var(--color-bg-secondary)", color: "var(--color-primary)", borderBottom: "2px solid var(--color-primary)" }
                : { color: "var(--color-text-secondary)", background: "transparent" }
            }
          >
            <Gift size={20} />
            Quay số ({luckyDrawWins.length})
          </button>
        </div>

        {/* FM Milestones */}
        {activeTab === "fm" && (
          <div className="space-y-4">
            <div className="rounded-lg p-4 mb-6 shadow-lg gradient-theme-primary">
              <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--color-text-inverse)" }}>
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" style={{ color: "var(--color-text-inverse)" }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Mốc Thành Tích Full Marathon
              </h2>
            </div>
            {fmMilestones.length === 0 ? (
              <div className="rounded-lg p-8 text-center" style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-secondary)" }}>
                Chưa có cấu hình mốc thành tích
              </div>
            ) : (
              <div className="grid gap-4">
                {fmMilestones.map((milestone) => {
                  const achieved = isMilestoneAchieved(milestone.id);
                  return (
                    <div
                      key={milestone.id}
                      className={`bg-white rounded-lg p-6 shadow-md border-l-4 ${
                        achieved ? "border-green-500" : "border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-900">{milestone.milestone_name}</h3>
                            {achieved && <CheckCircle size={24} style={{ color: 'var(--color-success)' }} />}
                          </div>
                          <p className="text-gray-600 mb-2">
                            <strong>Thời gian:</strong> {formatTime(milestone.time_seconds)}
                          </p>
                          <p className="text-gray-800 font-medium mb-1">{milestone.reward_description}</p>
                          {milestone.cash_amount > 0 && (
                            <p className="font-bold" style={{ color: 'var(--color-primary)' }}>{formatCurrency(milestone.cash_amount)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* HM Milestones */}
        {activeTab === "hm" && (
          <div className="space-y-4">
            <div className="rounded-lg p-4 mb-6 shadow-lg gradient-theme-primary">
              <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--color-text-inverse)" }}>
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" style={{ color: "var(--color-text-inverse)" }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Mốc Thành Tích Half Marathon
              </h2>
            </div>
            {hmMilestones.length === 0 ? (
              <div className="rounded-lg p-8 text-center" style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-secondary)" }}>
                Chưa có cấu hình mốc thành tích
              </div>
            ) : (
              <div className="grid gap-4">
                {hmMilestones.map((milestone) => {
                  const achieved = isMilestoneAchieved(milestone.id);
                  return (
                    <div
                      key={milestone.id}
                      className={`bg-white rounded-lg p-6 shadow-md border-l-4 ${
                        achieved ? "border-green-500" : "border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-900">{milestone.milestone_name}</h3>
                            {achieved && <CheckCircle size={24} style={{ color: 'var(--color-success)' }} />}
                          </div>
                          <p className="text-gray-600 mb-2">
                            <strong>Thời gian:</strong> {formatTime(milestone.time_seconds)}
                          </p>
                          <p className="text-gray-800 font-medium mb-1">{milestone.reward_description}</p>
                          {milestone.cash_amount > 0 && (
                            <p className="font-bold" style={{ color: 'var(--color-primary)' }}>{formatCurrency(milestone.cash_amount)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Podium Rewards */}
        {activeTab === "podium" && (
          <div className="space-y-4">
            <div className="rounded-lg p-4 mb-6 shadow-lg gradient-theme-primary">
              <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--color-text-inverse)" }}>
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" style={{ color: "var(--color-text-inverse)" }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Phần Thưởng Đứng Bục
              </h2>
            </div>
            {podiumRewards.length === 0 ? (
              <div className="rounded-lg p-8 text-center" style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-secondary)" }}>
                Bạn chưa có phần thưởng đứng bục nào
              </div>
            ) : (
              <div className="grid gap-4">
                {podiumRewards.map((reward) => (
                  <div key={reward.id} className="rounded-lg p-6 shadow-md" style={{ background: "var(--color-bg-secondary)" }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Star size={24} className="text-yellow-500" />
                          <h3 className="text-xl font-bold text-gray-900">
                            Top {reward.rank} - {reward.podium_type === "overall" ? "Chung cuộc" : "Lứa tuổi"}
                          </h3>
                        </div>
                        <p className="text-gray-600 mb-2 flex items-center gap-2">
                          <Calendar size={16} />
                          {reward.race.name} - {new Date(reward.race.date).toLocaleDateString("vi-VN")}
                        </p>
                        <p className="text-gray-800 font-medium mb-1">{reward.reward_description}</p>
                        <p className="font-bold" style={{ color: 'var(--color-primary)' }}>{formatCurrency(reward.cash_amount)}</p>
                      </div>
                      <div>{getStatusBadge(reward.status)}</div>
                    </div>
                    {reward.delivered_at && (
                      <p className="text-sm flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
                        <CheckCircle size={16} />
                        Đã trao: {new Date(reward.delivered_at).toLocaleDateString("vi-VN")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lucky Draw Wins */}
        {activeTab === "lucky" && (
          <div className="space-y-4">
            <div className="rounded-lg p-4 mb-6 shadow-lg gradient-theme-primary">
              <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--color-text-inverse)" }}>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "var(--color-text-inverse)" }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <path d="M3 9h18"/>
                  <path d="M9 21V9"/>
                </svg>
                Quà Tặng Quay Số May Mắn
              </h2>
            </div>
            {luckyDrawWins.length === 0 ? (
              <div className="rounded-lg p-8 text-center" style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-secondary)" }}>
                Bạn chưa trúng quay số may mắn nào
              </div>
            ) : (
              <div className="grid gap-4">
                {luckyDrawWins.map((win) => (
                  <div key={win.id} className="rounded-lg p-6 shadow-md" style={{ background: "var(--color-bg-secondary)" }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Gift size={24} style={{ color: 'var(--color-primary)' }} />
                          <h3 className="text-xl font-bold text-gray-900">
                            Thử thách tháng {win.challenge.month}/{win.challenge.year}
                          </h3>
                        </div>
                        <p className="text-gray-800 font-medium mb-2">{win.reward_description}</p>
                      </div>
                      <div>{getStatusBadge(win.status)}</div>
                    </div>
                    {win.delivered_at && (
                      <p className="text-sm var(--color-success) flex items-center gap-1">
                        <CheckCircle size={16} />
                        Đã trao: {new Date(win.delivered_at).toLocaleDateString("vi-VN")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
