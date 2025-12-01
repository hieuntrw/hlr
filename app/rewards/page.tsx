"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { Gift, Trophy, Star, Calendar, CheckCircle, Clock } from "lucide-react";

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
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Milestones data
  const [fmMilestones, setFmMilestones] = useState<MilestoneReward[]>([]);
  const [hmMilestones, setHmMilestones] = useState<MilestoneReward[]>([]);
  const [achievedMilestones, setAchievedMilestones] = useState<MemberMilestone[]>([]);
  
  // Other rewards
  const [podiumRewards, setPodiumRewards] = useState<PodiumReward[]>([]);
  const [luckyDrawWins, setLuckyDrawWins] = useState<LuckyDrawWin[]>([]);
  
  const [activeTab, setActiveTab] = useState<"fm" | "hm" | "podium" | "lucky">("fm");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setUser(user);

      // Get profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(profileData);

      // Load all milestones
      const { data: milestonesData } = await supabase
        .from("reward_milestones")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: true });

      if (milestonesData) {
        setFmMilestones(milestonesData.filter((m: MilestoneReward) => m.race_type === "FM" && m.gender === profileData?.gender));
        setHmMilestones(milestonesData.filter((m: MilestoneReward) => m.race_type === "HM" && m.gender === profileData?.gender));
      }

      // Load achieved milestones
      const { data: achievedData } = await supabase
        .from("member_milestone_rewards")
        .select(`
          *,
          race:races(name, date),
          milestone:reward_milestones(*)
        `)
        .eq("member_id", user.id)
        .order("created_at", { ascending: false });

      if (achievedData) {
        setAchievedMilestones(achievedData);
      }

      // Load podium rewards
      const { data: podiumData } = await supabase
        .from("member_podium_rewards")
        .select(`
          *,
          race:races(name, date)
        `)
        .eq("member_id", user.id)
        .order("created_at", { ascending: false });

      if (podiumData) {
        setPodiumRewards(podiumData);
      }

      // Load lucky draw wins
      const { data: luckyData } = await supabase
        .from("lucky_draw_winners")
        .select(`
          *,
          challenge:challenges(name, month, year)
        `)
        .eq("member_id", user.id)
        .order("created_at", { ascending: false });

      if (luckyData) {
        setLuckyDrawWins(luckyData);
      }

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

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
    const badges: { [key: string]: { label: string; color: string } } = {
      pending: { label: "Chờ duyệt", color: "bg-yellow-100 text-yellow-700" },
      approved: { label: "Đã duyệt", color: "bg-blue-100 text-blue-700" },
      delivered: { label: "Đã trao", color: "bg-green-100 text-green-700" },
      rejected: { label: "Từ chối", color: "bg-red-100 text-red-700" },
    };
    const badge = badges[status] || badges.pending;
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 border-b border-gray-300">
          <button
            onClick={() => setActiveTab("fm")}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
              activeTab === "fm"
                ? "bg-white text-orange-600 border-b-2 border-orange-600"
                : "text-gray-600 hover:bg-white/50"
            }`}
          >
            <Trophy size={20} />
            Mốc FM
          </button>
          <button
            onClick={() => setActiveTab("hm")}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
              activeTab === "hm"
                ? "bg-white text-orange-600 border-b-2 border-orange-600"
                : "text-gray-600 hover:bg-white/50"
            }`}
          >
            <Trophy size={20} />
            Mốc HM
          </button>
          <button
            onClick={() => setActiveTab("podium")}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
              activeTab === "podium"
                ? "bg-white text-orange-600 border-b-2 border-orange-600"
                : "text-gray-600 hover:bg-white/50"
            }`}
          >
            <Star size={20} />
            Đứng bục ({podiumRewards.length})
          </button>
          <button
            onClick={() => setActiveTab("lucky")}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
              activeTab === "lucky"
                ? "bg-white text-orange-600 border-b-2 border-orange-600"
                : "text-gray-600 hover:bg-white/50"
            }`}
          >
            <Gift size={20} />
            Quay số ({luckyDrawWins.length})
          </button>
        </div>

        {/* FM Milestones */}
        {activeTab === "fm" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Mốc Thành Tích Full Marathon</h2>
            {fmMilestones.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
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
                            {achieved && <CheckCircle size={24} className="text-green-500" />}
                          </div>
                          <p className="text-gray-600 mb-2">
                            <strong>Thời gian:</strong> {formatTime(milestone.time_seconds)}
                          </p>
                          <p className="text-gray-800 font-medium mb-1">{milestone.reward_description}</p>
                          {milestone.cash_amount > 0 && (
                            <p className="text-orange-600 font-bold">{formatCurrency(milestone.cash_amount)}</p>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Mốc Thành Tích Half Marathon</h2>
            {hmMilestones.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
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
                            {achieved && <CheckCircle size={24} className="text-green-500" />}
                          </div>
                          <p className="text-gray-600 mb-2">
                            <strong>Thời gian:</strong> {formatTime(milestone.time_seconds)}
                          </p>
                          <p className="text-gray-800 font-medium mb-1">{milestone.reward_description}</p>
                          {milestone.cash_amount > 0 && (
                            <p className="text-orange-600 font-bold">{formatCurrency(milestone.cash_amount)}</p>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Phần Thưởng Đứng Bục</h2>
            {podiumRewards.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                Bạn chưa có phần thưởng đứng bục nào
              </div>
            ) : (
              <div className="grid gap-4">
                {podiumRewards.map((reward) => (
                  <div key={reward.id} className="bg-white rounded-lg p-6 shadow-md">
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
                        <p className="text-orange-600 font-bold">{formatCurrency(reward.cash_amount)}</p>
                      </div>
                      <div>{getStatusBadge(reward.status)}</div>
                    </div>
                    {reward.delivered_at && (
                      <p className="text-sm text-green-600 flex items-center gap-1">
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Quà Tặng Quay Số May Mắn</h2>
            {luckyDrawWins.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                Bạn chưa trúng quay số may mắn nào
              </div>
            ) : (
              <div className="grid gap-4">
                {luckyDrawWins.map((win) => (
                  <div key={win.id} className="bg-white rounded-lg p-6 shadow-md">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Gift size={24} className="text-orange-500" />
                          <h3 className="text-xl font-bold text-gray-900">
                            Thử thách tháng {win.challenge.month}/{win.challenge.year}
                          </h3>
                        </div>
                        <p className="text-gray-800 font-medium mb-2">{win.reward_description}</p>
                      </div>
                      <div>{getStatusBadge(win.status)}</div>
                    </div>
                    {win.delivered_at && (
                      <p className="text-sm text-green-600 flex items-center gap-1">
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
