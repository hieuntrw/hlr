"use client";

import AdminLayout from "@/components/AdminLayout";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole, isAdminRole } from "@/lib/auth/role";
import { Clock, CheckCircle } from "lucide-react";
import { useMemo } from "react";

interface RewardRow {
  __type: string;
  id: string;
  member_id: string;
  race_id: string;
  milestone_id?: string | null;
  race_result_id?: string | null;
  status: string;
  reward_description?: string | null;
  cash_amount?: number | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  delivered_at?: string | null;
  delivered_by?: string | null;
  member?: { full_name?: string | null } | null;
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
  cash_amount?: number | null;
}

interface RaceRow { id: string; name?: string | null }
interface MilestoneRow { id: string; milestone_name?: string | null; race_type?: string | null }

export default function RewardMonitorPage() {
  const { user, profile, isLoading: authLoading, sessionChecked } = useAuth();
  // No race selector: show all tabs independently
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [luckyWinners, setLuckyWinners] = useState<LuckyWinner[]>([]);
  const [starAwards, setStarAwards] = useState<Array<Record<string, unknown>>>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'milestone'|'podium'|'lucky'|'star'>('milestone');
  const [loading, setLoading] = useState(true);
  const [deliveredProfiles, setDeliveredProfiles] = useState<Record<string, { full_name?: string }>>({});
  const [raceMap, setRaceMap] = useState<Record<string, { name?: string }>>({});
  const [milestoneMap, setMilestoneMap] = useState<Record<string, { milestone_name?: string; race_type?: string }>>({});

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

    // initial load handled by tab effect
  }, [user, profile, authLoading, sessionChecked]);


  useEffect(() => {
    // Fetch when active tab changes
    fetchRewards();
  }, [activeTab]);

  const milestoneList = useMemo(() => rewards.filter(r => r.__type === 'milestone'), [rewards]);
  const podiumList = useMemo(() => rewards.filter(r => r.__type === 'podium'), [rewards]);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      // Always fetch all four types explicitly so we have full lists client-side.
      const [mRes, pRes, lRes, sRes] = await Promise.all([
        fetch('/api/admin/member-rewards?type=milestone', { credentials: 'same-origin' }),
        fetch('/api/admin/member-rewards?type=podium', { credentials: 'same-origin' }),
        fetch('/api/admin/member-rewards?type=lucky', { credentials: 'same-origin' }),
        fetch('/api/admin/member-rewards?type=star', { credentials: 'same-origin' }),
      ]);
      if (!mRes.ok || !pRes.ok || !lRes.ok || !sRes.ok) throw new Error('Failed to load rewards');
      const mj = await mRes.json().catch(() => null);
      const pj = await pRes.json().catch(() => null);
      const lj = await lRes.json().catch(() => null);
      const sj = await sRes.json().catch(() => null);
      const mRows = (mj?.data || []) as RewardRow[];
      const pRows = (pj?.data || []) as RewardRow[];
      const lRows = (lj?.data || []) as LuckyWinner[];
      const sRows = (sj?.data || []) as Array<Record<string, unknown>>;

      const sortList = <T extends Record<string, unknown>>(arr: T[]) => {
        return arr.sort((a, b) => {
          const aa = a as Record<string, unknown>;
          const bb = b as Record<string, unknown>;
          const sa = String(aa.status ?? '') === 'pending' ? 0 : 1;
          const sb = String(bb.status ?? '') === 'pending' ? 0 : 1;
          if (sa !== sb) return sa - sb; // pending first
          const ra = String(aa.race_id ?? aa.challenge_id ?? '');
          const rb = String(bb.race_id ?? bb.challenge_id ?? '');
          if (ra !== rb) return ra.localeCompare(rb);
          const na = String((aa.profiles as Record<string, unknown>)?.full_name ?? (aa.member as Record<string, unknown>)?.full_name ?? (aa.member_id ?? ''));
          const nb = String((bb.profiles as Record<string, unknown>)?.full_name ?? (bb.member as Record<string, unknown>)?.full_name ?? (bb.member_id ?? ''));
          return na.localeCompare(nb);
        }) as T[];
      };

      // attach milestone_name and normalize race name via lookups after fetching

      // fetch races and milestones in parallel (admin endpoints)
      try {
        const [racesRes, msRes] = await Promise.all([
          fetch('/api/races', { credentials: 'same-origin' }),
          fetch('/api/admin/reward-milestones', { credentials: 'same-origin' }),
        ]);
        if (racesRes.ok) {
          const jr = await racesRes.json().catch(() => null);
          const list: unknown[] = Array.isArray(jr) ? jr : (jr?.data || []);
          const rm: Record<string, { name?: string }> = {};
          list.forEach((rr: unknown) => { const R = rr as RaceRow; if (R && R.id) rm[R.id] = { name: R.name ?? undefined }; });
          setRaceMap(rm);
        }
        if (msRes.ok) {
          const jm = await msRes.json().catch(() => null);
          const mlist: unknown[] = Array.isArray(jm) ? jm : (jm?.data || []);
          const mm: Record<string, { milestone_name?: string; race_type?: string }> = {};
          mlist.forEach((mmr: unknown) => { const M = mmr as MilestoneRow; if (M && M.id) mm[M.id] = { milestone_name: M.milestone_name ?? undefined, race_type: M.race_type ?? undefined }; });
          setMilestoneMap(mm);
        }
      } catch (e) {
        console.warn('Failed to fetch races or milestones', e);
      }

      setRewards(sortList([...mRows.map(r => ({ ...r, __type: 'milestone' })), ...pRows.map(r => ({ ...r, __type: 'podium' }))]));
      setLuckyWinners(sortList(lRows as unknown as Array<Record<string, unknown>>) as unknown as LuckyWinner[]);
      setStarAwards(sortList(sRows as Array<Record<string, unknown>>));

      // fetch delivered_by profiles for any delivered_by values across all lists
      const allDeliveredBy = Array.from(new Set([
        ...mRows.map(r => String(r.delivered_by ?? '')),
        ...pRows.map(r => String(r.delivered_by ?? '')),
        ...lRows.map(r => String(r.delivered_by ?? '')),
        ...sRows.map(r => String((r as Record<string, unknown>).delivered_by ?? '')),
      ].filter(Boolean)));
      if (allDeliveredBy.length > 0) {
        try {
          const profRes = await fetch(`/api/admin/profiles?fields=id,full_name`, { credentials: 'same-origin' });
          if (profRes.ok) {
            const pj2 = await profRes.json().catch(() => null);
            const list = pj2?.data || [];
            const map: Record<string, { full_name?: string }> = {};
            list.forEach((p: Record<string, unknown>) => { const pid = String(p.id ?? ''); if (allDeliveredBy.includes(pid)) map[pid] = { full_name: String(p.full_name ?? '') }; });
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
      

        {/* Tabs-only UI (no race selector) */}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: "var(--color-primary)" }}></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
                <div className="flex gap-2 mb-4">
                <button
                  className="px-3 py-1 rounded"
                  style={activeTab === 'milestone' ? { background: 'var(--color-primary)', color: 'var(--color-text-inverse)' } : { background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
                  onClick={() => setActiveTab('milestone')}
                >Giải thưởng theo mốc ({milestoneList.length})</button>
                <button
                  className="px-3 py-1 rounded"
                  style={activeTab === 'podium' ? { background: 'var(--color-primary)', color: 'var(--color-text-inverse)' } : { background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
                  onClick={() => setActiveTab('podium')}
                >Giải thưởng đứng bục ({podiumList.length})</button>
                <button
                  className="px-3 py-1 rounded"
                  style={activeTab === 'lucky' ? { background: 'var(--color-primary)', color: 'var(--color-text-inverse)' } : { background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
                  onClick={() => setActiveTab('lucky')}
                >Quay thưởng may mắn ({luckyWinners.length})</button>
                <button
                  className="px-3 py-1 rounded"
                  style={activeTab === 'star' ? { background: 'var(--color-primary)', color: 'var(--color-text-inverse)' } : { background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
                  onClick={() => setActiveTab('star')}
                >Thưởng sao ({starAwards.length})</button>
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
                        else if (activeTab === 'lucky') list = luckyWinners as unknown as { id: string }[];
                        else if (activeTab === 'star') list = starAwards as { id: string }[];
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
                        // Use the unified bulk endpoint for member-rewards which handles milestone/podium/lucky/star
                        const payload: Record<string, unknown> = {
                          ids,
                          updates: { status: 'delivered', delivered_at: new Date().toISOString() },
                          delivered_by: user?.id,
                        };
                        const res = await fetch('/api/admin/member-rewards', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                        if (!res.ok) throw new Error('Bulk update failed');
                        const j = await res.json().catch(() => null);
                        console.log('bulk deliver result', j);
                        alert('Đã trao xong');
                        fetchRewards();
                        setSelectedIds({});
                      } catch (e) {
                        console.error(e);
                        alert('Lỗi khi trao phần thưởng');
                      }
                    }}
                  >Trao hàng loạt</button>
                </div>

                {/* Table view for milestone / podium */}
                {(activeTab === 'milestone' || activeTab === 'podium') && (
                  <div className="overflow-auto bg-white rounded-lg border">
                    {((activeTab === 'milestone' ? milestoneList : podiumList).length === 0) ? (
                      <div className="p-4 text-gray-500">Không có phần thưởng đang chờ</div>
                    ) : (
                      <table className="min-w-full divide-y">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left"><input type="checkbox" onChange={(e) => {
                              const checked = e.target.checked;
                              const list = activeTab === 'milestone' ? milestoneList : podiumList;
                              const next: Record<string, boolean> = { ...selectedIds };
                              list.forEach((it) => { next[it.id] = checked; });
                              setSelectedIds(next);
                            }} /></th>
                            <th className="px-3 py-2 text-left">Thành viên</th>
                            <th className="px-3 py-2 text-left">Loại</th>
                            <th className="px-3 py-2 text-left">Mốc</th>
                            <th className="px-3 py-2 text-left">Hiện vật</th>
                            <th className="px-3 py-2 text-right">Tiền mặt</th>
                            <th className="px-3 py-2 text-left">Race</th>
                            <th className="px-3 py-2 text-left">Trạng thái</th>
                            <th className="px-3 py-2 text-left">Đã trao</th>
                            <th className="px-3 py-2 text-left">Người trao</th>
                            <th className="px-3 py-2 text-left">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(activeTab === 'milestone' ? milestoneList : podiumList).map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2"><input type="checkbox" checked={!!selectedIds[r.id]} onChange={(e) => setSelectedIds({ ...selectedIds, [r.id]: e.target.checked })} /></td>
                              <td className="px-3 py-2">
                                <div className="font-semibold">{r.profiles?.full_name || r.member_id}</div>
                                <div className="text-sm text-gray-500">{r.profiles?.email || ''}</div>
                              </td>
                              <td className="px-3 py-2 text-sm">{r.milestone_id ? (milestoneMap[String(r.milestone_id)]?.race_type ?? '') : ''}</td>
                              <td className="px-3 py-2 text-sm">{r.milestone_id ? (milestoneMap[String(r.milestone_id)]?.milestone_name ?? '') : ''}</td>
                              <td className="px-3 py-2 text-sm">{r.reward_description || '—'}</td>
                              <td className="px-3 py-2 text-right font-semibold">{formatCurrency(r.cash_amount)}</td>
                              <td className="px-3 py-2 text-sm">{r.race_id ? (raceMap[String(r.race_id)]?.name ?? '') : ''}</td>
                              <td className="px-3 py-2 text-sm">
                                {r.status === 'pending' ? <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 inline-flex items-center gap-1"><Clock size={12} />Chưa trao</span> : <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 inline-flex items-center gap-1"><CheckCircle size={12} />Đã trao</span>}
                              </td>
                              <td className="px-3 py-2 text-sm">{r.delivered_at ? new Date(String(r.delivered_at)).toLocaleString('vi-VN') : ''}</td>
                              <td className="px-3 py-2 text-sm">{r.delivered_by ? deliveredProfiles[String(r.delivered_by)]?.full_name || String(r.delivered_by) : ''}</td>
                              <td className="px-3 py-2">
                                {r.status === 'pending' ? (
                                  <button
                                    onClick={async () => {
                                      if (!confirm('Xác nhận đã trao phần thưởng này?')) return;
                                      try {
                                        const res = await fetch('/api/admin/member-rewards', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, updates: { status: 'delivered', delivered_at: new Date().toISOString() }, delivered_by: user?.id }) });
                                        if (!res.ok) throw new Error('Update failed');
                                        alert('Đã đánh dấu đã trao');
                                        fetchRewards();
                                      } catch (e) {
                                        console.error('Failed to mark delivered', e);
                                        alert('Lỗi khi cập nhật trạng thái');
                                      }
                                    }}
                                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition"
                                  >Đánh dấu đã trao</button>
                                ) : (
                                  <div className="text-xs text-gray-500">—</div>
                                )}
                                {/* reward ID intentionally hidden per UI preference */}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
                {activeTab === 'lucky' && (
                  <div className="overflow-auto bg-white rounded-lg border">
                    {luckyWinners.length === 0 ? (
                      <div className="p-4 text-gray-500">Không có người trúng quay thưởng</div>
                    ) : (
                      <table className="min-w-full divide-y">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2"><input type="checkbox" onChange={(e) => {
                              const checked = e.target.checked;
                              const next: Record<string, boolean> = { ...selectedIds };
                              luckyWinners.forEach((it) => { next[it.id] = checked; });
                              setSelectedIds(next);
                            }} /></th>
                            <th className="px-3 py-2 text-left">Thành viên</th>
                            <th className="px-3 py-2 text-left">Mô tả</th>
                            <th className="px-3 py-2 text-right">Tiền</th>
                            <th className="px-3 py-2 text-left">Gói</th>
                            <th className="px-3 py-2 text-left">Trạng thái</th>
                            <th className="px-3 py-2 text-left">Đã trao</th>
                            <th className="px-3 py-2 text-left">Người trao</th>
                            <th className="px-3 py-2 text-left">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {luckyWinners.map((w) => (
                            <tr key={w.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2"><input type="checkbox" checked={!!selectedIds[w.id]} onChange={(e) => setSelectedIds({ ...selectedIds, [w.id]: e.target.checked })} /></td>
                              <td className="px-3 py-2">
                                <div className="font-semibold">{w.member?.full_name || w.member_id || w.member?.id}</div>
                                <div className="text-sm text-gray-500">{w.member?.email || ''}</div>
                              </td>
                              <td className="px-3 py-2 text-sm">{w.reward_description || 'Quay thưởng'}</td>
                              <td className="px-3 py-2 text-right font-semibold">{formatCurrency(w.cash_amount)}</td>
                              <td className="px-3 py-2 text-sm">{w.challenge?.name || w.challenge_id}</td>
                              <td className="px-3 py-2 text-sm">{w.status === 'pending' ? <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 inline-flex items-center gap-1"><Clock size={12} />Chưa trao</span> : <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 inline-flex items-center gap-1"><CheckCircle size={12} />Đã trao</span>}</td>
                              <td className="px-3 py-2 text-sm">{w.delivered_at ? new Date(String(w.delivered_at)).toLocaleString('vi-VN') : ''}</td>
                              <td className="px-3 py-2 text-sm">{w.delivered_by ? deliveredProfiles[String(w.delivered_by)]?.full_name || String(w.delivered_by) : ''}</td>
                              <td className="px-3 py-2">
                                {w.status === 'pending' ? (
                                  <button
                                    onClick={async () => {
                                      if (!confirm('Xác nhận đã trao phần thưởng này?')) return;
                                      try {
                                        const res = await fetch('/api/admin/member-rewards', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id, updates: { status: 'delivered', delivered_at: new Date().toISOString() }, delivered_by: user?.id }) });
                                        if (!res.ok) throw new Error('Update failed');
                                        alert('Đã đánh dấu đã trao');
                                        fetchRewards();
                                      } catch (e) {
                                        console.error('Failed to mark delivered', e);
                                        alert('Lỗi khi cập nhật trạng thái');
                                      }
                                    }}
                                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition"
                                  >Đánh dấu đã trao</button>
                                ) : (
                                  <div className="text-xs text-gray-500">—</div>
                                )}
                                <div className="text-xs text-gray-400 mt-1">ID: {w.id}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
                {activeTab === 'star' && (
                  <div className="overflow-auto bg-white rounded-lg border">
                    {starAwards.length === 0 ? (
                      <div className="p-4 text-gray-500">Không có phần thưởng sao đang chờ</div>
                    ) : (
                      <table className="min-w-full divide-y">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2"><input type="checkbox" onChange={(e) => {
                              const checked = e.target.checked;
                              const next: Record<string, boolean> = { ...selectedIds };
                              starAwards.forEach((it) => { next[String(it.id)] = checked; });
                              setSelectedIds(next);
                            }} /></th>
                            <th className="px-3 py-2 text-left">Thành viên</th>
                            <th className="px-3 py-2 text-left">Mô tả</th>
                            <th className="px-3 py-2 text-left">Số lượng</th>
                            <th className="px-3 py-2 text-left">Trạng thái</th>
                            <th className="px-3 py-2 text-left">Đã trao</th>
                            <th className="px-3 py-2 text-left">Người trao</th>
                            <th className="px-3 py-2 text-left">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {starAwards.map((s) => {
                            const sRec = s as Record<string, unknown>;
                            const profiles = (sRec.profiles as Record<string, unknown> | undefined) ?? null;
                            return (
                              <tr key={String(sRec.id)} className="hover:bg-gray-50">
                                <td className="px-3 py-2"><input type="checkbox" checked={!!selectedIds[String(sRec.id)]} onChange={(e) => setSelectedIds({ ...selectedIds, [String(sRec.id)]: e.target.checked })} /></td>
                                <td className="px-3 py-2">
                                  <div className="font-semibold">{String(profiles?.full_name ?? sRec.member_id ?? '')}</div>
                                </td>
                                <td className="px-3 py-2 text-sm">{String(sRec.reward_description ?? '')}</td>
                                <td className="px-3 py-2 text-sm">{String(sRec.quantity ?? '')}</td>
                                <td className="px-3 py-2 text-sm">{String(sRec.status ?? '') === 'pending' ? <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 inline-flex items-center gap-1"><Clock size={12} />Chưa trao</span> : <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 inline-flex items-center gap-1"><CheckCircle size={12} />Đã trao</span>}</td>
                                <td className="px-3 py-2 text-sm">{sRec.delivered_at ? new Date(String(sRec.delivered_at)).toLocaleString('vi-VN') : ''}</td>
                                <td className="px-3 py-2 text-sm">{sRec.delivered_by ? deliveredProfiles[String(sRec.delivered_by)]?.full_name || String(sRec.delivered_by) : ''}</td>
                                <td className="px-3 py-2">
                                  {String(sRec.status ?? '') === 'pending' ? (
                                    <button
                                      onClick={async () => {
                                        if (!confirm('Xác nhận đã trao phần thưởng này?')) return;
                                        try {
                                          const res = await fetch('/api/admin/member-rewards', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sRec.id, updates: { status: 'delivered', delivered_at: new Date().toISOString() }, delivered_by: user?.id }) });
                                          if (!res.ok) throw new Error('Update failed');
                                          alert('Đã đánh dấu đã trao');
                                          fetchRewards();
                                        } catch (e) {
                                          console.error('Failed to mark delivered', e);
                                          alert('Lỗi khi cập nhật trạng thái');
                                        }
                                      }}
                                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition"
                                    >Đánh dấu đã trao</button>
                                  ) : (
                                    <div className="text-xs text-gray-500">—</div>
                                  )}
                                  <div className="text-xs text-gray-400 mt-1">ID: {String(sRec.id)}</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
          
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
