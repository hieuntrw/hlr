"use client";

import AdminLayout from "@/components/AdminLayout";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole, isAdminRole } from "@/lib/auth/role";
import { Clock, Gift, Users, CheckCircle } from "lucide-react";
import { useMemo } from "react";

interface RewardRow {
  __type: string;
  id: string;
  member_id: string;
  race_id: string;
  race_result_id?: string | null;
  status: string;
  reward_description?: string | null;
  cash_amount?: number | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
}

interface Race {
  id: string;
  name: string;
  race_date?: string | null;
  location?: string | null;
}

interface LuckyWinner {
  id: string;
  member?: { id?: string; full_name?: string | null; email?: string | null } | null;
  member_id?: string | null;
  reward_description?: string | null;
  challenge?: { id?: string | null; name?: string | null } | null;
  challenge_id?: string | null;
  status?: string | null;
  delivered_at?: string | null;
  delivered_by?: string | null;
}

export default function RewardMonitorPage() {
  const { user, profile, isLoading: authLoading, sessionChecked } = useAuth();
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRace, setSelectedRace] = useState<string>("");
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [luckyWinners, setLuckyWinners] = useState<LuckyWinner[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'milestone'|'podium'|'lucky'>('milestone');
  const [loading, setLoading] = useState(true);
  const [deliveredProfiles, setDeliveredProfiles] = useState<Record<string, { full_name?: string }>>({});

  useEffect(() => {
    if (authLoading || !sessionChecked) return;
    if (!user) {
      window.location.href = "/login";
      return;
    }
    const resolved = getEffectiveRole(user, profile) || "member";
    if (!isAdminRole(resolved)) {
      window.location.href = "/";
      return;
    }

    loadRaces();
  }, [user, profile, authLoading, sessionChecked]);

  const loadRaces = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/races", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load races");
      const j = await res.json().catch(() => null);
      setRaces(j?.data || []);
      if (j?.data && j.data.length > 0) setSelectedRace(String(j.data[0].id));
    } catch (e) {
      console.error("Failed to load races", e);
      alert("Lỗi khi tải danh sách sự kiện");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedRace) return;
    fetchRewards(selectedRace);
  }, [selectedRace]);

  const milestoneList = useMemo(() => rewards.filter(r => r.__type === 'milestone'), [rewards]);
  const podiumList = useMemo(() => rewards.filter(r => r.__type === 'podium'), [rewards]);

  const fetchRewards = async (raceId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/member-rewards?race_id=${encodeURIComponent(raceId)}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load rewards');
      const j = await res.json().catch(() => null);
      const data = j?.data || [];
      const rows = data as RewardRow[];
      setRewards(rows);

      // fetch lucky-draw winners for display (not filtered by race)
      try {
        const lw = await fetch('/api/admin/lucky-draw-winners', { credentials: 'same-origin' });
        if (lw.ok) {
          const lj = await lw.json().catch(() => null);
          setLuckyWinners(lj?.winners || []);
        } else {
          setLuckyWinners([]);
        }
      } catch (e) {
        console.warn('Failed to load lucky winners', e);
        setLuckyWinners([]);
      }

      // fetch delivered_by profiles (admin profiles endpoint returns selected fields)
      const deliveredIds = Array.from(new Set(rows.map(r => (r as unknown as Record<string, unknown>).delivered_by as string | undefined).filter(Boolean)));
      if (deliveredIds.length > 0) {
        try {
          const profRes = await fetch(`/api/admin/profiles?fields=id,full_name`, { credentials: 'same-origin' });
          if (profRes.ok) {
            const pj = await profRes.json().catch(() => null);
            const list = pj?.data || [];
            const map: Record<string, { full_name?: string }> = {};
            list.forEach((p: Record<string, unknown>) => { const pid = String(p.id ?? ''); if (deliveredIds.includes(pid)) map[pid] = { full_name: String(p.full_name ?? '') }; });
            setDeliveredProfiles(map);
          }
        } catch (e) {
          console.warn('Failed to fetch delivered_by profiles', e);
        }
      }
    } catch (e) {
      console.error('Failed to fetch rewards', e);
      alert('Lỗi khi tải phần thưởng');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount?: number | null) => {
    try {
      return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(amount || 0));
    } catch {
      return String(amount ?? 0);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Gift size={28} style={{ color: "var(--color-primary)" }} />
          <h1 className="text-3xl font-bold">Theo dõi giải thưởng</h1>
        </div>

        <div className="rounded-lg p-4 bg-white border">
          <div className="flex items-center gap-4">
            <label className="font-medium">Sự kiện:</label>
            <select
              value={selectedRace}
              onChange={(e) => setSelectedRace(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="">-- Chọn sự kiện --</option>
              {races.map((r) => (
                <option key={r.id} value={r.id}>{r.name} {r.race_date ? `- ${new Date(String(r.race_date)).toLocaleDateString('vi-VN')}` : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: "var(--color-primary)" }}></div>
          </div>
        ) : (
          <div className="space-y-4">
            {rewards.length === 0 && luckyWinners.length === 0 ? (
              <div className="bg-white rounded-lg p-6 text-center text-gray-500">Không có phần thưởng đang chờ cho sự kiện này</div>
            ) : (
              <div>
                <div className="flex gap-2 mb-4">
                  <button className={`px-3 py-1 rounded ${activeTab === 'milestone' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setActiveTab('milestone')}>Giải thưởng theo mốc ({milestoneList.length})</button>
                  <button className={`px-3 py-1 rounded ${activeTab === 'podium' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setActiveTab('podium')}>Giải thưởng đứng bục ({podiumList.length})</button>
                  <button className={`px-3 py-1 rounded ${activeTab === 'lucky' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setActiveTab('lucky')}>Quay thưởng may mắn (chưa)</button>
                </div>

                <div className="mb-3 flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        const checked = e.target.checked;
                        let list: { id: string }[] = [];
                        if (activeTab === 'milestone') list = milestoneList;
                        else if (activeTab === 'podium') list = podiumList;
                        else list = luckyWinners;
                        const next: Record<string, boolean> = { ...selectedIds };
                        list.forEach((it) => { next[it.id] = checked; });
                        setSelectedIds(next);
                      }}
                    /> Chọn tất cả
                  </label>
                  <button
                    className="px-3 py-1 bg-green-600 text-white rounded"
                    onClick={async () => {
                      const ids = Object.keys(selectedIds).filter((id) => selectedIds[id]);
                      if (ids.length === 0) { alert('Chưa chọn phần thưởng'); return; }
                      if (!confirm(`Xác nhận trao ${ids.length} phần thưởng?`)) return;
                      try {
                        for (const id of ids) {
                          if (activeTab === 'lucky') {
                            await fetch('/api/admin/lucky-draw-winners', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'delivered', delivered_at: new Date().toISOString(), delivered_by: user?.id }) });
                          } else {
                            await fetch('/api/admin/member-rewards', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, updates: { status: 'delivered', delivered_at: new Date().toISOString() }, delivered_by: user?.id }) });
                          }
                        }
                        alert('Đã trao xong');
                        fetchRewards(selectedRace);
                        setSelectedIds({});
                      } catch (e) {
                        console.error(e);
                        alert('Lỗi khi trao phần thưởng');
                      }
                    }}
                  >Trao hàng loạt</button>
                </div>

                {(activeTab === 'milestone' ? milestoneList : podiumList).map((r) => (
                  <div key={r.id} className="bg-white rounded-lg p-4 shadow-sm border flex justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={!!selectedIds[r.id]} onChange={(e) => setSelectedIds({ ...selectedIds, [r.id]: e.target.checked })} />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Users size={18} className="text-gray-600" />
                          <div className="font-semibold">{r.profiles?.full_name || r.member_id}</div>
                          <div className="text-sm text-gray-500">{r.profiles?.email ? `(${r.profiles.email})` : ''}</div>
                        </div>
                        <div className="text-sm text-gray-700">{r.reward_description || '—'}</div>
                        <div className="text-sm text-gray-700 font-bold mt-1">{formatCurrency(r.cash_amount)}</div>
                        <div className="text-xs text-gray-500 mt-2">Loại: {r.__type} {r.race_result_id ? `• result ${r.race_result_id}` : ''}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-center gap-2">
                      {r.status === 'pending' ? (
                        <div className="flex flex-col items-end gap-2">
                          <div className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-2">
                            <Clock size={14} /> Chưa trao
                          </div>
                          <button
                            onClick={async () => {
                              if (!confirm('Xác nhận đã trao phần thưởng này?')) return;
                              try {
                                const res = await fetch('/api/admin/member-rewards', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, updates: { status: 'delivered', delivered_at: new Date().toISOString() }, delivered_by: user?.id }) });
                                if (!res.ok) throw new Error('Update failed');
                                alert('Đã đánh dấu đã trao');
                                fetchRewards(selectedRace);
                              } catch (e) {
                                console.error('Failed to mark delivered', e);
                                alert('Lỗi khi cập nhật trạng thái');
                              }
                            }}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition"
                          >
                            Đánh dấu đã trao
                          </button>
                        </div>
                      ) : (
                        <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-2">
                          <CheckCircle size={14} /> Đã trao
                        </div>
                      )}
                      <div className="text-xs text-gray-500">ID: {r.id}</div>
                      { Boolean((r as unknown as Record<string, unknown>).delivered_at) && (
                        <div className="text-xs text-gray-500">Đã trao: {new Date(String((r as unknown as Record<string, unknown>).delivered_at)).toLocaleString('vi-VN')}</div>
                      ) }
                      { Boolean((r as unknown as Record<string, unknown>).delivered_by) && deliveredProfiles[String((r as unknown as Record<string, unknown>).delivered_by)] && (
                        <div className="text-xs text-gray-500">Người trao: {deliveredProfiles[String((r as unknown as Record<string, unknown>).delivered_by)].full_name}</div>
                      ) }
                    </div>
                  </div>
                ))}
                {activeTab === 'lucky' && (
                  <div>
                    {luckyWinners.length === 0 ? (
                      <div className="text-gray-500">Không có người trúng quay thưởng</div>
                    ) : (
                      luckyWinners.map((w) => (
                        <div key={w.id} className="bg-white rounded-lg p-4 shadow-sm border flex justify-between mb-3">
                          <div className="flex items-start gap-3">
                            <input type="checkbox" checked={!!selectedIds[w.id]} onChange={(e) => setSelectedIds({ ...selectedIds, [w.id]: e.target.checked })} />
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Users size={18} className="text-gray-600" />
                                <div className="font-semibold">{w.member?.full_name || w.member_id || w.member?.id}</div>
                                <div className="text-sm text-gray-500">{w.member?.email ? `(${w.member.email})` : ''}</div>
                              </div>
                              <div className="text-sm text-gray-700">{w.reward_description || 'Quay thưởng'}</div>
                              <div className="text-xs text-gray-500 mt-2">Gói: {w.challenge?.name || w.challenge_id}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end justify-center gap-2">
                            {w.status === 'pending' ? (
                              <div className="flex flex-col items-end gap-2">
                                <div className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-2">
                                  <Clock size={14} /> Chưa trao
                                </div>
                                <button
                                  onClick={async () => {
                                    if (!confirm('Xác nhận đã trao phần thưởng này?')) return;
                                    try {
                                      const res = await fetch('/api/admin/lucky-draw-winners', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id, status: 'delivered', delivered_at: new Date().toISOString(), delivered_by: user?.id }) });
                                      if (!res.ok) throw new Error('Update failed');
                                      alert('Đã đánh dấu đã trao');
                                      fetchRewards(selectedRace);
                                    } catch (e) {
                                      console.error('Failed to mark delivered', e);
                                      alert('Lỗi khi cập nhật trạng thái');
                                    }
                                  }}
                                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition"
                                >
                                  Đánh dấu đã trao
                                </button>
                              </div>
                            ) : (
                              <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-2">
                                <CheckCircle size={14} /> Đã trao
                              </div>
                            )}
                            <div className="text-xs text-gray-500">ID: {w.id}</div>
                            {w.delivered_at && <div className="text-xs text-gray-500">Đã trao: {new Date(String(w.delivered_at)).toLocaleString('vi-VN')}</div>}
                            {w.delivered_by && deliveredProfiles[String(w.delivered_by)] && (
                              <div className="text-xs text-gray-500">Người trao: {deliveredProfiles[String(w.delivered_by)].full_name}</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
