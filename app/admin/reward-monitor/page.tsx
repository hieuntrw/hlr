"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useTheme } from "@/lib/theme";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole, isAdminRole } from "@/lib/auth/role";

type GenericRecord = Record<string, unknown>;

interface BaseReward {
  id: string;
  member_id?: string | null;
  user_id?: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  reward_description?: string | null;
  cash_amount?: number | null;
  race_id?: string | null;
  status?: string | null;
  delivered_by?: string | null;
  awarded_by?: string | null;
  awarded_at?: string | null;
  stars_awarded?: number | null;
  notes?: string | null;
  race_type?: string | null;
  milestone_name?: string | null;
}

type RewardItem = BaseReward | GenericRecord;

const asRec = (r: RewardItem) => r as Record<string, unknown>;
const getId = (r: RewardItem) => String(asRec(r).id ?? "");
const getProfileName = (r: RewardItem) => String(((asRec(r).profiles as Record<string, unknown> | undefined)?.full_name) ?? "");
const getMemberId = (r: RewardItem) => String(asRec(r).member_id ?? "");
// removed unused getRaceType; prefer getRaceTypePreferMilestone
const getMilestoneName = (r: RewardItem) => {
  const rm = asRec(r).reward_milestones ?? asRec(r).reward_milestone ?? asRec(r).milestone;
  const mObj = Array.isArray(rm) ? (rm[0] as Record<string, unknown> | undefined) : (rm as Record<string, unknown> | undefined);
  const name = mObj?.milestone_name ?? mObj?.milestoneName ?? asRec(r).milestone_name ?? asRec(r).milestoneName ?? "";
  return String(name);
};
const getRewardDescription = (r: RewardItem) => String(asRec(r).reward_description ?? "");
const getCashAmount = (r: RewardItem) => Number(asRec(r).cash_amount ?? 0);
const getRaceId = (r: RewardItem) => String(asRec(r).race_id ?? asRec(r).challenge_id ?? "");
const getStatus = (r: RewardItem) => String(asRec(r).status ?? "");
const isDelivered = (r: RewardItem) => String(getStatus(r) || "").toLowerCase() === 'delivered';
const getDeliveredBy = (r: RewardItem) => String(asRec(r).delivered_by ?? "");
const getUserId = (r: RewardItem) => String(asRec(r).user_id ?? asRec(r).member_id ?? "");
const getStarsAwarded = (r: RewardItem) => Number(asRec(r).stars_awarded ?? asRec(r).quantity ?? 0);
const getAwardedBy = (r: RewardItem) => String(asRec(r).awarded_by ?? asRec(r).delivered_by ?? "");
const getAwardedAt = (r: RewardItem) => {
  const v = asRec(r).awarded_at ?? asRec(r).delivered_at ?? null;
  if (!v) return "";
  try { return new Date(String(v)).toLocaleString("vi-VN"); } catch { return String(v); }
};
const getNotes = (r: RewardItem) => String(asRec(r).notes ?? "");
// displayNameForId is defined inside the component where deliveredProfiles state exists

// Prefer race_type coming from joined reward_milestones (PostgREST uses 'reward_milestones')
const getRaceTypePreferMilestone = (r: RewardItem) => {
  const rm = asRec(r).reward_milestones ?? asRec(r).reward_milestone ?? asRec(r).milestone;
  const mObj = Array.isArray(rm) ? (rm[0] as Record<string, unknown> | undefined) : (rm as Record<string, unknown> | undefined);
  const mRaceType = mObj?.race_type ?? mObj?.raceType ?? null;
  return String(mRaceType ?? asRec(r).milestone_race_type ?? asRec(r).race_type ?? "");
};

// removed unused getRaceName; use displayRaceName which prefers joined races and racesMap

export default function RewardMonitorPage() {
  const { user, profile, isLoading: authLoading, sessionChecked } = useAuth();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<"milestone" | "podium" | "lucky" | "star">("milestone");
  const [loading, setLoading] = useState(true);

  const [milestones, setMilestones] = useState<BaseReward[]>([]);
  const [podiums, setPodiums] = useState<BaseReward[]>([]);
  const [luckies, setLuckies] = useState<BaseReward[]>([]);
  const [stars, setStars] = useState<BaseReward[]>([]);
  const [racesMap, setRacesMap] = useState<Record<string, string>>({});

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [deliveredProfiles, setDeliveredProfiles] = useState<Record<string, { full_name?: string | null; email?: string | null }>>({});

  const displayNameForId = (id: string) => {
    if (!id) return "";
    return deliveredProfiles[id]?.full_name ?? id;
  };

  const displayMemberName = (r: RewardItem) => {
    const mid = getMemberId(r) || getUserId(r);
    // 1) try nested profile returned by PostgREST (common aliasing)
    const pCandidates = [
      (asRec(r).profiles as Record<string, unknown> | undefined)?.full_name,
      (asRec(r)['profiles_member_milestone_rewards_member_id_fkey'] as Record<string, unknown> | undefined)?.full_name,
      (asRec(r).profile as Record<string, unknown> | undefined)?.full_name,
    ];
    for (const c of pCandidates) if (c) return String(c);

    // 1b) scan for any nested key that contains full_name
    try {
      for (const k of Object.keys(asRec(r))) {
        if (k.toLowerCase().includes('full_name') && asRec(r)[k]) return String(asRec(r)[k]);
        const v = asRec(r)[k] as Record<string, unknown> | unknown;
        if (v && typeof v === 'object') {
          const inner = v as Record<string, unknown>;
          if (inner.full_name) return String(inner.full_name);
        }
      }
    } catch {
      // ignore
    }

    // 2) preloaded via `/api/profiles/{id}`
    if (mid && deliveredProfiles[mid]?.full_name) return deliveredProfiles[mid].full_name ?? mid;

    // 3) fallback to any inline profile field
    const fromRow = getProfileName(r);
    return fromRow || mid || "-";
  };

  const displayRaceName = (r: RewardItem) => {
    const rid = getRaceId(r);
    if (!rid) return "";
    if (racesMap[rid]) return racesMap[rid];
    // try nested race object
    const raceObj = (asRec(r).races ?? asRec(r).race) as Record<string, unknown> | unknown;
    if (raceObj) {
      const candidate = Array.isArray(raceObj) ? (raceObj[0] as Record<string, unknown> | undefined) : (raceObj as Record<string, unknown>);
      if (candidate && candidate.name) return String(candidate.name);
    }
    return rid;
  };

  // email display removed — we don't show email under member name anymore

  const renderStatusBadge = (statusRaw: string) => {
    const s = String(statusRaw || "").toLowerCase();
    if (!s) return <span>-</span>;
    if (s === 'pending') {
      return <span style={{ color: theme.colors.error, fontWeight: 600 }}>{statusRaw}</span>;
    }
    if (s === 'delivered') {
      return <span style={{ color: theme.colors.success, fontWeight: 600 }}>{statusRaw}</span>;
    }
    return <span>{statusRaw}</span>;
  };

  const fetchProfiles = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const uniq = Array.from(new Set(ids.filter(Boolean)));
    const profilesMap: Record<string, { full_name?: string | null; email?: string | null }> = {};
    await Promise.all(uniq.map(async (id) => {
      try {
        const res = await fetch(`/api/profiles/${id}`, { credentials: "same-origin" });
        if (!res.ok) return;
        const pj = await res.json().catch(() => null);
        if (pj && pj.data) profilesMap[id] = { full_name: pj.data.full_name ?? null, email: pj.data.email ?? null };
      } catch {
        /* ignore per-id failures */
      }
    }));
    if (Object.keys(profilesMap).length > 0) setDeliveredProfiles((prev) => ({ ...prev, ...profilesMap }));
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, pRes, lRes, sRes] = await Promise.all([
        fetch("/api/admin/member-rewards?type=milestone", { credentials: "same-origin", cache: 'no-store' }),
        fetch("/api/admin/member-rewards?type=podium", { credentials: "same-origin", cache: 'no-store' }),
        fetch("/api/admin/member-rewards?type=lucky", { credentials: "same-origin", cache: 'no-store' }),
        fetch("/api/admin/member-rewards?type=star", { credentials: "same-origin", cache: 'no-store' }),
      ]);
      const mj = await (mRes.ok ? mRes.json().catch(() => null) : Promise.resolve(null));
      const pj = await (pRes.ok ? pRes.json().catch(() => null) : Promise.resolve(null));
      const lj = await (lRes.ok ? lRes.json().catch(() => null) : Promise.resolve(null));
      const sj = await (sRes.ok ? sRes.json().catch(() => null) : Promise.resolve(null));

      // Support multiple response shapes:
      // - normalized API: { milestones, podiums, lucky, stars }
      // - supabase-like: { data: [...] }
      // - raw array: [...]
      const extractArray = (obj: unknown, key?: string): BaseReward[] => {
        if (!obj) return [];
        if (Array.isArray(obj)) return obj as unknown as BaseReward[];
        const o = obj as Record<string, unknown>;
        if (key) {
          const v = o[key];
          if (Array.isArray(v)) return v as unknown as BaseReward[];
        }
        const d = o['data'];
        if (Array.isArray(d)) return d as unknown as BaseReward[];
        return [];
      };

      const milestonesList = extractArray(mj, 'milestones');
      const podiumsList = extractArray(pj, 'podiums');
      const luckiesList = extractArray(lj, 'lucky');
      const starsList = extractArray(sj, 'stars');

      setMilestones(milestonesList);
      setPodiums(podiumsList);
      setLuckies(luckiesList);
      setStars(starsList);

      // Preload races map for Race column (call general races API and map by id)
      try {
        const racesRes = await fetch('/api/races', { credentials: 'same-origin', cache: 'no-store' });
        if (racesRes.ok) {
          const racesJson = await racesRes.json().catch(() => null);
          if (Array.isArray(racesJson)) {
            const map: Record<string, string> = {};
            (racesJson as Array<Record<string, unknown>>).forEach((rr) => { if (rr.id) map[String(rr.id)] = String(rr.name ?? ''); });
            setRacesMap(map);
          }
        }
      } catch {
        // ignore race preload failures
      }

      // Collect profile IDs to preload names (member/user ids and awarded/delivered by)
      const collectIds = new Set<string>();
      const pushFrom = (it: RewardItem) => {
        const uid = getUserId(it); if (uid) collectIds.add(uid);
        const mid = getMemberId(it); if (mid) collectIds.add(mid);
        const db = getDeliveredBy(it); if (db) collectIds.add(db);
        const ab = getAwardedBy(it); if (ab) collectIds.add(ab);
      };
      [...milestonesList, ...podiumsList, ...luckiesList, ...starsList].forEach((r: RewardItem) => pushFrom(r));

      await fetchProfiles(Array.from(collectIds));
    } catch (e) {
      console.error("Failed to load rewards", e);
      alert("Lỗi khi tải phần thưởng");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !sessionChecked) return;
    if (!user) {
      window.location.href = "/login";
      return;
    }
    const role = getEffectiveRole(user) || "member";
    if (!isAdminRole(role)) {
      window.location.href = "/";
      return;
    }
    fetchAll();
  }, [user, profile, authLoading, sessionChecked, fetchAll]);

  const currentList = useMemo(() => {
    switch (activeTab) {
      case "milestone":
        return milestones;
      case "podium":
        return podiums;
      case "lucky":
        return luckies;
      case "star":
        return stars;
      default:
        return [] as unknown as GenericRecord[];
    }
  }, [activeTab, milestones, podiums, luckies, stars]);

  const toggleSelectAll = (checked: boolean) => {
    const next = { ...selected };
    (currentList as RewardItem[]).forEach((it) => { const id = getId(it); if (id && !isDelivered(it)) next[id] = checked; });
    setSelected(next);
  };

  const bulkDeliver = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) return alert("Chưa chọn phần thưởng");
    if (!confirm(`Xác nhận trao ${ids.length} phần thưởng?`)) return;
    try {
      const payload = { ids, updates: { status: "delivered", delivered_at: new Date().toISOString() }, delivered_by: user?.id };
      const res = await fetch("/api/admin/member-rewards", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await (res.ok ? res.json().catch(() => null) : res.json().catch(() => null));
      if (!res.ok) {
        console.error('Bulk deliver failed', body);
        return alert('Lỗi khi trao phần thưởng: ' + (body?.error ?? 'server error'));
      }
      // API returns { results: [...] } where individual items may have an error
      if (body && Array.isArray(body.results)) {
        const errs = body.results.filter((r: unknown) => Boolean((r as Record<string, unknown>)?.error));
        if (errs.length > 0) {
          console.error('Bulk deliver returned errors', errs);
          return alert('Một số phần thưởng không thể trao: ' + errs.map((x: unknown) => `${String((x as Record<string, unknown>).id ?? '')}:${String((x as Record<string, unknown>).error ?? '')}`).join(', '));
        }
      }
      alert("Đã trao xong");
      setSelected({});
      fetchAll();
    } catch (e) {
      console.error(e);
      alert("Lỗi khi trao phần thưởng");
    }
  };

  const singleDeliver = async (id: string) => {
    if (!confirm("Xác nhận đã trao phần thưởng này?")) return;
    try {
      const payload = { id, updates: { status: "delivered", delivered_at: new Date().toISOString() }, delivered_by: user?.id };
      const res = await fetch("/api/admin/member-rewards", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await (res.ok ? res.json().catch(() => null) : res.json().catch(() => null));
      if (!res.ok) {
        console.error('Single deliver failed', body);
        return alert('Lỗi khi cập nhật trạng thái: ' + (body?.error ?? 'server error'));
      }
      if (body && Array.isArray(body.results)) {
        const item = body.results[0] as unknown;
        if (item && (item as Record<string, unknown>).error) {
          console.error('Single deliver returned error', item);
          return alert('Không thể trao phần thưởng: ' + String((item as Record<string, unknown>).error));
        }
      }
      alert("Đã đánh dấu đã trao");
      fetchAll();
    } catch (e) {
      console.error(e);
      alert("Lỗi khi cập nhật trạng thái");
    }
  };

  const formatCurrency = (amount?: number | null) => {
    try { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(amount || 0)); } catch { return String(amount ?? 0); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-6 px-4 gradient-theme-primary">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-inverse)" }}>Theo dõi phần thưởng</h1>
          <Link href="/admin" className="hover:opacity-80" style={{ color: "var(--color-text-inverse)" }}>← Quay lại</Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="flex gap-2 mb-4">
          {(() => {
            const activeStyle = { background: theme.colors.primary, color: theme.colors.textInverse } as React.CSSProperties;
            const inactiveStyle = { background: theme.colors.bgSecondary, color: theme.colors.textPrimary } as React.CSSProperties;
            return (
              <>
                <button style={activeTab === "milestone" ? activeStyle : inactiveStyle} className="px-3 py-1 rounded" onClick={() => setActiveTab("milestone")}>Giải thưởng theo mốc ({milestones.length})</button>
                <button style={activeTab === "podium" ? activeStyle : inactiveStyle} className="px-3 py-1 rounded" onClick={() => setActiveTab("podium")}>Giải thưởng đứng bục ({podiums.length})</button>
                <button style={activeTab === "lucky" ? activeStyle : inactiveStyle} className="px-3 py-1 rounded" onClick={() => setActiveTab("lucky")}>Quay thưởng may mắn ({luckies.length})</button>
                <button style={activeTab === "star" ? activeStyle : inactiveStyle} className="px-3 py-1 rounded" onClick={() => setActiveTab("star")}>Thưởng sao ({stars.length})</button>
              </>
            );
          })()}
        </div>

        <div className="mb-4 flex items-center gap-3">
          <label className="flex items-center gap-2"><input type="checkbox" onChange={(e) => toggleSelectAll(e.target.checked)} /> Chọn tất cả</label>
          <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={bulkDeliver}>Trao hàng loạt</button>
        </div>

        <div className="overflow-auto bg-white rounded-lg border">
          {loading ? (
            <div className="p-6 text-center">Đang tải...</div>
          ) : (
            <>
              {activeTab === "milestone" && (
                <div>
                  {milestones.length === 0 ? (
                    <div className="p-4 text-gray-500">Không có phần thưởng theo mốc</div>
                  ) : (
                    <table className="min-w-full divide-y">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">STT</th>
                          <th className="px-3 py-2 text-left">Thành viên</th>
                          <th className="px-3 py-2 text-left">Loại</th>
                          <th className="px-3 py-2 text-left">Mốc</th>
                          <th className="px-3 py-2 text-left">Hiện vật</th>
                          <th className="px-3 py-2 text-right">Tiền mặt</th>
                          <th className="px-3 py-2 text-left">Race</th>
                          <th className="px-3 py-2 text-left">Trạng thái</th>
                          <th className="px-3 py-2 text-left">Người trao</th>
                          <th className="px-3 py-2 text-left">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {milestones.map((row, i) => (
                          <tr key={getId(row)} className="hover:bg-gray-50">
                            <td className="px-3 py-2">{i + 1}</td>
                            <td className="px-3 py-2">
                              <div className="font-semibold">{displayMemberName(row)}</div>
                            </td>
                            <td className="px-3 py-2 text-sm">{getRaceTypePreferMilestone(row)}</td>
                            <td className="px-3 py-2 text-sm">{getMilestoneName(row)}</td>
                            <td className="px-3 py-2 text-sm">{getRewardDescription(row) || "—"}</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(getCashAmount(row))}</td>
                            <td className="px-3 py-2 text-sm">{displayRaceName(row) || getRaceId(row)}</td>
                            <td className="px-3 py-2 text-sm">{renderStatusBadge(getStatus(row))}</td>
                            <td className="px-3 py-2 text-sm">{displayNameForId(getDeliveredBy(row))}</td>
                            <td className="px-3 py-2 text-sm">
                              {isDelivered(row) ? (
                                <span className="text-sm text-gray-500">Đã trao</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input type="checkbox" checked={!!selected[getId(row)]} onChange={(e) => setSelected({ ...selected, [getId(row)]: e.target.checked })} />
                                  <button className="px-2 py-1 bg-green-600 text-white rounded text-sm" onClick={() => singleDeliver(getId(row))}>Trao thưởng</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === "podium" && (
                <div>
                  {podiums.length === 0 ? (
                    <div className="p-4 text-gray-500">Không có phần thưởng podium</div>
                  ) : (
                    <table className="min-w-full divide-y">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">STT</th>
                          <th className="px-3 py-2 text-left">Thành viên</th>
                          <th className="px-3 py-2 text-left">Loại</th>
                          <th className="px-3 py-2 text-left">Hiện vật</th>
                          <th className="px-3 py-2 text-right">Tiền mặt</th>
                          <th className="px-3 py-2 text-left">Race</th>
                          <th className="px-3 py-2 text-left">Trạng thái</th>
                          <th className="px-3 py-2 text-left">Người trao</th>
                          <th className="px-3 py-2 text-left">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {podiums.map((row, i) => (
                          <tr key={getId(row)} className="hover:bg-gray-50">
                            <td className="px-3 py-2">{i + 1}</td>
                            <td className="px-3 py-2">
                              <div className="font-semibold">{getProfileName(row) || getMemberId(row) || "-"}</div>
                            </td>
                            <td className="px-3 py-2 text-sm">Podium</td>
                            <td className="px-3 py-2 text-sm">{getRewardDescription(row) || "—"}</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(getCashAmount(row))}</td>
                            <td className="px-3 py-2 text-sm">{getRaceId(row)}</td>
                            <td className="px-3 py-2 text-sm">{getStatus(row)}</td>
                            <td className="px-3 py-2 text-sm">{displayNameForId(getDeliveredBy(row))}</td>
                            <td className="px-3 py-2 text-sm">
                              {isDelivered(row) ? (
                                <span className="text-sm text-gray-500">Đã trao</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input type="checkbox" checked={!!selected[getId(row)]} onChange={(e) => setSelected({ ...selected, [getId(row)]: e.target.checked })} />
                                  <button className="px-2 py-1 bg-green-600 text-white rounded text-sm" onClick={() => singleDeliver(getId(row))}>Đã trao</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === "lucky" && (
                <div>
                  {luckies.length === 0 ? (
                    <div className="p-4 text-gray-500">Không có người trúng quay thưởng</div>
                  ) : (
                    <table className="min-w-full divide-y">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">STT</th>
                          <th className="px-3 py-2 text-left">Thành viên</th>
                          <th className="px-3 py-2 text-left">Mô tả</th>
                          <th className="px-3 py-2 text-right">Tiền</th>
                          <th className="px-3 py-2 text-left">Gói</th>
                          <th className="px-3 py-2 text-left">Trạng thái</th>
                          <th className="px-3 py-2 text-left">Người trao</th>
                          <th className="px-3 py-2 text-left">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {luckies.map((row, i) => (
                          <tr key={getId(row)} className="hover:bg-gray-50">
                            <td className="px-3 py-2">{i + 1}</td>
                            <td className="px-3 py-2">
                              <div className="font-semibold">{getProfileName(row) || getMemberId(row) || "-"}</div>
                            </td>
                            <td className="px-3 py-2 text-sm">{getRewardDescription(row) || "Quay thưởng"}</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(getCashAmount(row))}</td>
                            <td className="px-3 py-2 text-sm">{String(((asRec(row).challenge as Record<string, unknown> | undefined)?.name) ?? (asRec(row).challenge_id ?? ""))}</td>
                            <td className="px-3 py-2 text-sm">{getStatus(row)}</td>
                            <td className="px-3 py-2 text-sm">{displayNameForId(getDeliveredBy(row))}</td>
                            <td className="px-3 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <input type="checkbox" checked={!!selected[getId(row)]} onChange={(e) => setSelected({ ...selected, [getId(row)]: e.target.checked })} />
                                <button className="px-2 py-1 bg-green-600 text-white rounded text-sm" onClick={() => singleDeliver(getId(row))}>Đã trao</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === "star" && (
                <div>
                  {stars.length === 0 ? (
                    <div className="p-4 text-gray-500">Không có phần thưởng sao đang chờ</div>
                  ) : (
                    <table className="min-w-full divide-y">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">STT</th>
                          <th className="px-3 py-2 text-left">Thành viên</th>
                          <th className="px-3 py-2 text-left">Số sao</th>
                          <th className="px-3 py-2 text-left">Ghi chú</th>
                          <th className="px-3 py-2 text-left">Thời gian</th>
                          <th className="px-3 py-2 text-left">Người trao</th>
                          <th className="px-3 py-2 text-left">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {stars.map((s, i) => {
                          const id = getId(s);
                          return (
                            <tr key={id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">{i + 1}</td>
                              <td className="px-3 py-2"><div className="font-semibold">{getProfileName(s) || getUserId(s) || "-"}</div></td>
                              <td className="px-3 py-2 text-sm font-semibold">{String(getStarsAwarded(s))}</td>
                              <td className="px-3 py-2 text-sm">{getNotes(s) || "—"}</td>
                              <td className="px-3 py-2 text-sm">{getAwardedAt(s)}</td>
                              <td className="px-3 py-2 text-sm">{displayNameForId(getAwardedBy(s))}</td>
                              <td className="px-3 py-2 text-sm">
                                {isDelivered(s) ? (
                                  <span className="text-sm text-gray-500">Đã trao</span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={!!selected[id]} onChange={(e) => setSelected({ ...selected, [id]: e.target.checked })} />
                                    <button className="px-2 py-1 bg-green-600 text-white rounded text-sm" onClick={() => singleDeliver(id)}>Đã trao</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
