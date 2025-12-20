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

// MemberMilestone shape is represented in admin endpoints; local interface removed as unused

interface PodiumReward {
  id: string;
  race_id: string;
  podium_type: string;
  rank: number;
  reward_description?: string | null;
  cash_amount?: number | null;
  status?: string | null;
  delivered_at?: string | null;
  race?: {
    name?: string;
    date?: string;
  } | null;
  achieved_time_seconds?: number | null;
}

interface LuckyDrawWin {
  id: string;
  challenge_id?: string;
  reward_description?: string | null;
  status?: string | null;
  delivered_at?: string | null;
  challenge?: {
    name?: string;
    month?: number | null;
    year?: number | null;
    lucky_draw_completed?: boolean | null;
  } | null;
}

interface StarAward {
  challenge_id?: string;
  challenge?: { name?: string; month?: number | null; year?: number | null } | null;
  stars_count?: number;
}

interface ProfileRow {
  id?: string;
  full_name?: string;
  name?: string;
  gender?: string;
}

interface MemberListEntry {
  id: string;
  name: string;
  gender?: string;
  statuses: Record<string, string>;
}

export default function RewardsPage() {
  const { user, isLoading: authLoading, profile: authProfile, sessionChecked } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Milestones data
  // legacy single-profile lists removed; use gender buckets instead
  const [fmByGender, setFmByGender] = useState<Record<string, MilestoneReward[]>>({});
  const [hmByGender, setHmByGender] = useState<Record<string, MilestoneReward[]>>({});
  const [membersList, setMembersList] = useState<MemberListEntry[]>([]);
  const [profileRow, setProfileRow] = useState<ProfileRow | null>(null);
  
  // Other rewards
  const [podiumRewards, setPodiumRewards] = useState<PodiumReward[]>([]);
  const [luckyDrawWins, setLuckyDrawWins] = useState<LuckyDrawWin[]>([]);
  const [starAwards, setStarAwards] = useState<StarAward[]>([]);
  
  const [activeTab, setActiveTab] = useState<"milestone" | "podium" | "lucky" | "star">("milestone");

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
        setFmByGender({});
        setHmByGender({});
        setPodiumRewards([]);
        setLuckyDrawWins([]);
      } else {
        const profileRow = j.profile || authProfile || null;
        setProfileRow(profileRow as ProfileRow | null);
          const allMilestones = Array.isArray(j.milestones) ? (j.milestones as MilestoneReward[]) : [];
          // Build gender-specific buckets for FM/HM milestones
          const fmBuckets: Record<string, MilestoneReward[]> = {};
          const hmBuckets: Record<string, MilestoneReward[]> = {};
          allMilestones.forEach((m) => {
            const g = String(m.gender ?? '');
            if (String(m.race_type ?? '') === 'FM') {
              fmBuckets[g] = fmBuckets[g] || [];
              fmBuckets[g].push(m);
            }
            if (String(m.race_type ?? '') === 'HM') {
              hmBuckets[g] = hmBuckets[g] || [];
              hmBuckets[g].push(m);
            }
          });
          // sort each bucket by priority ascending (1 -> 7)
          Object.keys(fmBuckets).forEach(k => fmBuckets[k].sort((a,b)=> (a.priority ?? 0) - (b.priority ?? 0)));
          Object.keys(hmBuckets).forEach(k => hmBuckets[k].sort((a,b)=> (a.priority ?? 0) - (b.priority ?? 0)));
          setFmByGender(fmBuckets);
          setHmByGender(hmBuckets);
          // also keep current-profile-specific lists for backwards compatibility (not stored)
          setPodiumRewards(Array.isArray(j.podium) ? (j.podium as PodiumReward[]) : []);
          setLuckyDrawWins(Array.isArray(j.lucky) ? (j.lucky as LuckyDrawWin[]) : []);
          setStarAwards(Array.isArray(j.stars) ? (j.stars as StarAward[]) : []);

          // Fetch all members (admin endpoint) to ensure we render everyone
          let allProfiles: Record<string, unknown>[] = [];
          try {
            const pResp = await fetch('/api/admin/profiles', { credentials: 'same-origin' });
            const pj = await pResp.json().catch(() => null);
            allProfiles = Array.isArray(pj?.data) ? pj.data as Record<string, unknown>[] : [];
          } catch {
            allProfiles = [];
          }

          // Fetch admin view of member rewards to get historical statuses per member
          let adminMilestones: Record<string, unknown>[] = [];
          try {
            const amResp = await fetch('/api/admin/member-rewards', { credentials: 'same-origin' });
            const amj = await amResp.json().catch(() => null);
            adminMilestones = Array.isArray(amj?.milestones) ? amj.milestones as Record<string, unknown>[] : [];
          } catch {
            adminMilestones = [];
          }

          // Build members map from allProfiles, then overlay statuses from adminMilestones
          const membersMap: Record<string, MemberListEntry> = {};
          allProfiles.forEach((p: Record<string, unknown>) => {
            const id = String(p['id'] ?? '');
            membersMap[id] = { id, name: String(p['full_name'] ?? p['name'] ?? id), gender: String(p['gender'] ?? ''), statuses: {} };
          });

          adminMilestones.forEach((r: Record<string, unknown>) => {
            const profilesObj = r['profiles'] as Record<string, unknown> | undefined;
            const memberId = String(r['member_id'] ?? profilesObj?.['id'] ?? profilesObj?.['member_id'] ?? profilesObj?.['user_id'] ?? '');
            if (!memberId) return;
            if (!membersMap[memberId]) {
              membersMap[memberId] = { id: memberId, name: String(profilesObj?.['full_name'] ?? memberId), gender: String(profilesObj?.['gender'] ?? ''), statuses: {} };
            }
            const rewardMilObj = r['reward_milestones'] as Record<string, unknown> | undefined;
            const milestoneObj = r['milestone'] as Record<string, unknown> | undefined;
            const milestoneId = String(rewardMilObj?.['id'] ?? r['milestone_id'] ?? milestoneObj?.['id'] ?? '');
            const status = String(r['status'] ?? '').toLowerCase() || 'pending';
            membersMap[memberId].statuses[milestoneId] = status;
          });

          // Ensure current profile present
          const currentId = String(profileRow?.id ?? profileRow?.member_id ?? profileRow?.user_id ?? '');
          if (currentId && !membersMap[currentId]) {
            membersMap[currentId] = { id: currentId, name: String(profileRow?.full_name ?? profileRow?.name ?? currentId), gender: String(profileRow?.gender ?? ''), statuses: {} };
          }

          setMembersList(Object.values(membersMap));
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

  const statusColor = (status: string) => {
    if (status === 'delivered') return { text: 'var(--color-success)', background: 'var(--color-success)' };
    if (status === 'pending') return { text: 'var(--color-warning)', background: 'var(--color-warning)' };
    return { text: 'gray', background: 'gray' };
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
            onClick={() => setActiveTab("milestone")}
            className="flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap"
            style={
              activeTab === "milestone"
                ? { background: "var(--color-bg-secondary)", color: "var(--color-primary)", borderBottom: "2px solid var(--color-primary)" }
                : { color: "var(--color-text-secondary)", background: "transparent" }
            }
          >
            <Trophy size={20} />
            Quà mốc
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
          <button
            onClick={() => setActiveTab("star")}
            className="flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap"
            style={
              activeTab === "star"
                ? { background: "var(--color-bg-secondary)", color: "var(--color-primary)", borderBottom: "2px solid var(--color-primary)" }
                : { color: "var(--color-text-secondary)", background: "transparent" }
            }
          >
            <CheckCircle size={20} />
            Sao ({starAwards.length})
          </button>
        </div>

        {/* Milestone tab: show FM and HM axes side-by-side (or stacked on small screens) */}
        {activeTab === "milestone" && (
          <div className="space-y-4">
            <div className="rounded-lg p-4 mb-6 shadow-lg gradient-theme-primary">
              <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--color-text-inverse)" }}>
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" style={{ color: "var(--color-text-inverse)" }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Quà mốc
              </h2>
            </div>

                <div>
              <div className="mb-2">
                </div>
                {/* Members list with FM/HM horizontal milestone rows (single column) */}
                <div className="space-y-4">
                  {membersList.length === 0 ? (
                    <div className="rounded-lg p-6 text-center" style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-secondary)" }}>
                      Chưa có dữ liệu thành viên
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {membersList.map((member) => (
                        <div key={member.id} className="rounded-lg p-2 shadow-sm bg-white border border-gray-200">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-black">{member.name}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs font-semibold text-blue-600">FM</div>
                              <div className="flex items-center gap-1">
                                {((fmByGender[member.gender ?? profileRow?.gender ?? ''] || fmByGender['']) as MilestoneReward[] || []).map((m) => {
                                  const st = (member.statuses && member.statuses[String(m.id)]) || 'not_received';
                                  const sc = statusColor(st);
                                  return (
                                    <div key={m.id} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: sc.background, color: '#000' }}>
                                      {m.milestone_name}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="text-xs font-semibold text-indigo-600 ml-2">HM</div>
                              <div className="flex items-center gap-1">
                                {((hmByGender[member.gender ?? profileRow?.gender ?? ''] || hmByGender['']) as MilestoneReward[] || []).map((m) => {
                                  const st = (member.statuses && member.statuses[String(m.id)]) || 'not_received';
                                  const sc = statusColor(st);
                                  return (
                                    <div key={m.id} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: sc.background, color: '#000' }}>
                                      {m.milestone_name}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            </div>
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
              <div className="space-y-4">
                {podiumRewards
                  .slice()
                  .sort((a,b)=> {
                    const ad = a.race?.date ? new Date(a.race.date).getTime() : 0;
                    const bd = b.race?.date ? new Date(b.race.date).getTime() : 0;
                    return bd - ad;
                  })
                  .map((reward) => (
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
                          {reward.race?.name || '—'} - {reward.race?.date ? new Date(reward.race.date).toLocaleDateString("vi-VN") : '—'}
                        </p>
                        {reward.achieved_time_seconds != null && (
                          <p className="text-sm text-gray-600 mb-1">Thời gian đạt: {formatTime(Number(reward.achieved_time_seconds))}</p>
                        )}
                        <p className="text-gray-800 font-medium mb-1">{reward.reward_description}</p>
                        {reward.cash_amount != null && (
                          <p className="font-bold" style={{ color: 'var(--color-primary)' }}>{formatCurrency(Number(reward.cash_amount))}</p>
                        )}
                      </div>
                      <div>{getStatusBadge(String(reward.status || 'pending'))}</div>
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
              <div className="space-y-3">
                {luckyDrawWins.slice().sort((a,b)=>{
                  const ay = a.challenge?.year ?? 0; const am = a.challenge?.month ?? 0;
                  const by = b.challenge?.year ?? 0; const bm = b.challenge?.month ?? 0;
                  if (by !== ay) return by - ay;
                  return (bm ?? 0) - (am ?? 0);
                }).map(win => (
                  <div key={win.id} className="rounded-lg p-6 shadow-md" style={{ background: "var(--color-bg-secondary)" }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Gift size={24} style={{ color: 'var(--color-primary)' }} />
                          <h3 className="text-xl font-bold text-gray-900">
                            {win.challenge?.name || `Thử thách ${win.challenge?.month || ''}/${win.challenge?.year || ''}`}
                          </h3>
                        </div>
                        <p className="text-gray-800 font-medium mb-2">{win.reward_description}</p>
                        {win.challenge?.lucky_draw_completed === false && (
                          <div className="text-sm text-yellow-700">Chờ quay số</div>
                        )}
                      </div>
                      <div>{getStatusBadge(String(win.status || 'pending'))}</div>
                    </div>
                    {win.delivered_at && (
                      <p className="text-sm text-success flex items-center gap-1">
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

        {/* Star awards: grouped by challenge */}
        {activeTab === "star" && (
          <div className="space-y-4">
            <div className="rounded-lg p-4 mb-6 shadow-lg gradient-theme-primary">
              <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--color-text-inverse)" }}>
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" style={{ color: "var(--color-text-inverse)" }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Sao được nhận
              </h2>
            </div>
            {starAwards.length === 0 ? (
              <div className="rounded-lg p-8 text-center" style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-secondary)" }}>
                Chưa có sao nào được nhận
              </div>
            ) : (
              <div className="space-y-3">
                {starAwards.slice().sort((a,b)=>{
                  const ay = a.challenge?.year ?? 0; const am = a.challenge?.month ?? 0;
                  const by = b.challenge?.year ?? 0; const bm = b.challenge?.month ?? 0;
                  if (by !== ay) return by - ay;
                  return (bm ?? 0) - (am ?? 0);
                }).map((s,idx)=> (
                  <div key={s.challenge_id || idx} className="rounded-lg p-4 shadow-sm flex items-center justify-between" style={{ background: 'white' }}>
                    <div>
                      <div className="font-semibold">{s.challenge?.name || `Thử thách ${s.challenge?.month || ''}/${s.challenge?.year || ''}`}</div>
                      <div className="text-sm text-gray-600">Số sao: {s.stars_count ?? 0}</div>
                    </div>
                    <div className="text-sm text-gray-700">{s.challenge?.month}/{s.challenge?.year}</div>
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
