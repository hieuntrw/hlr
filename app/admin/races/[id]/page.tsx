"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Calendar, MapPin, Activity, Save, Loader2, CheckCircle } from "lucide-react";
import { asRecord } from "@/lib/error-utils";

interface Race {
  id: string;
  name: string;
  race_date: string;
  location?: string;
  image_url?: string;
}

interface ProfileOption {
  id: string;
  full_name: string;
  gender?: string | null;
}

interface RaceResultRow {
  id: string;
  user_id: string;
  distance: "5km" | "10km" | "21km" | "42km";
  chip_time_seconds: number;
  is_pr?: boolean;
  approved?: boolean;
  podium_config_id?: string | null;
  profile?: { full_name: string; gender?: string };
  milestone_reward?: string | null;
}

function timeToSeconds(t: string): number {
  // Accepts HH:MM:SS or MM:SS
  const parts = t.split(":").map((p) => parseInt(p || "0", 10));
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function secondsToTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AdminRaceDetailPage() {
  const params = useParams();
  const raceId = (params?.id as string) || "";

  const [race, setRace] = useState<Race | null>(null);
  const [members, setMembers] = useState<ProfileOption[]>([]);
  const [results, setResults] = useState<RaceResultRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    distance: "21km" as "5km" | "10km" | "21km" | "42km",
    chip_time: "",
    podium_config_id: "",
    gender: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);
  const [processingResults, setProcessingResults] = useState(false);

  

  const fetchRace = useCallback(async function fetchRace() {
    try {
      const res = await fetch('/api/admin/races', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load races');
      const j = await res.json().catch(() => ({ data: [] }));
      const data = j.data || [];
      const found = (data as Race[]).find((r) => r.id === raceId);
      if (found) setRace(found);
    } catch (e) {
      console.error('Failed to fetch race', e);
    }
  }, [raceId]);

  async function fetchMembers() {
    try {
      const res = await fetch('/api/admin/profiles', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load members');
      const j = await res.json().catch(() => ({ data: [] }));
      const data = j.data || j.profiles || [];
      setMembers(data as ProfileOption[]);
    } catch (e) {
      console.error('Failed to load members', e);
    }
  }

  // Gender resolution: only use `profiles.full_name` -> `gender` mapping.

  async function handleMemberChange(selectedId: string) {
    setForm((f) => ({ ...f, user_id: selectedId }));

    // If no selection, clear gender
    if (!selectedId) {
      setForm((f) => ({ ...f, gender: "" }));
      return;
    }

    // 1) Try direct profile lookup by id
    try {
      const res = await fetch(`/api/admin/profiles/${selectedId}`, { credentials: 'same-origin' });
      const body: unknown = await res.json().catch(() => null);
      const data = body && typeof body === 'object' && 'data' in (body as Record<string, unknown>) ? (body as Record<string, unknown>)['data'] as Record<string, unknown> : (body as Record<string, unknown> | null);
      if (res.ok && data) {
        const g = data && 'gender' in data ? (data['gender'] as string | null) : null;
        if (g) {
          setForm((f) => ({ ...f, gender: String(g) }));
          return;
        }

        // 2) Try to find other profiles with same full_name that may have gender
        const fullName = data && 'full_name' in data ? String(data['full_name'] ?? '') : '';
        if (fullName) {
          try {
            const byNameRes = await fetch(`/api/admin/profiles?full_name=${encodeURIComponent(fullName)}`, { credentials: 'same-origin' });
            if (byNameRes.ok) {
              const byNameJson = await byNameRes.json().catch(() => null) as unknown;
              const list = (byNameJson && typeof byNameJson === 'object') ? ((byNameJson as Record<string, unknown>)['data'] ?? (byNameJson as Record<string, unknown>)['profiles'] ?? byNameJson) : [];
              if (Array.isArray(list) && list.length > 0) {
                const foundWithGender = (list as Array<Record<string, unknown>>).find((p) => p && 'gender' in p && (p as Record<string, unknown>)['gender']);
                if (foundWithGender && (foundWithGender as Record<string, unknown>)['gender']) {
                  setForm((f) => ({ ...f, gender: String((foundWithGender as Record<string, unknown>)['gender']) }));
                  return;
                }
              }
            }
          } catch (e) {
            console.warn('profile lookup by full_name failed', e);
          }
        }
      }
    } catch (e: unknown) {
      console.warn("Failed to fetch profile gender", e);
    }

    // 3) Final fallback: use gender from already-loaded members list if present
    try {
      const m = members.find((m) => m.id === selectedId);
      const memberGender = m && m.gender ? String(m.gender) : "";
      setForm((f) => ({ ...f, gender: memberGender || "" }));
    } catch {
      setForm((f) => ({ ...f, gender: "" }));
    }
  }

  const fetchResults = useCallback(async function fetchResults() {
    try {
      const res = await fetch(`/api/admin/races/${raceId}/results`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load results');
      const j = await res.json().catch(() => ({ data: [] }));
      const data = j.data || [];
      const mapped = (data as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        podium_config_id: (r as Record<string, unknown>).podium_config_id ?? null,
        profile: {
          full_name: ((r as Record<string, unknown>).profiles as Record<string, unknown> | undefined)?.full_name || '',
          gender: ((r as Record<string, unknown>).profiles as Record<string, unknown> | undefined)?.gender || undefined,
        },
        milestone_reward: (r as Record<string, unknown>).milestone_reward ?? null,
      })) as RaceResultRow[];
      setResults(mapped);
    } catch (e: unknown) {
      console.error('Failed to load results', e);
    }
  }, [raceId]);

  useEffect(() => {
    if (raceId) {
      fetchRace();
      fetchMembers();
      fetchResults();
    }
  }, [raceId, fetchRace, fetchResults]);

  // Rewards available for selection (podium overall / age group)
  const [rewardDefs, setRewardDefs] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    fetchRewardDefinitions();
  }, [race]);

  async function fetchRewardDefinitions() {
    try {
      const res = await fetch('/api/admin/podium-rewards', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load reward definitions');
      const j: unknown = await res.json().catch(() => ({}));
      const configs = (j && typeof j === 'object' ? (j as Record<string, unknown>).configs : null) || [];
      if (configs) setRewardDefs(configs as Array<Record<string, unknown>>);
    } catch (e: unknown) {
      console.warn('Failed to fetch reward definitions', e);
    }
  }

  async function handleSaveResult(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const chipSeconds = timeToSeconds(form.chip_time);
      let res: Response;
      if (editingId) {
        // Update existing participant
        res = await fetch(`/api/admin/races/${raceId}/participants/${editingId}`, {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chip_time_seconds: chipSeconds,
            distance: form.distance,
            podium_config_id: (form as Record<string, string>).podium_config_id || null,
            user_id: form.user_id,
          }),
        });
      } else {
        // Add new participant
        const postUrl = `/api/admin/races/${raceId}/participants`;
        const postBody = {
          user_id: form.user_id,
          distance: form.distance,
          chip_time_seconds: chipSeconds,
          podium_config_id: (form as Record<string, string>).podium_config_id || null,
        };
        // Debug: log request details to help diagnose 'Failed to fetch'
        console.debug('[AdminRace] POST', postUrl, postBody);
        res = await fetch(postUrl, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postBody),
        });
      }

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setMessage(j?.error || 'Thành viên đã tồn tại cho cự ly này');
          setMessageType('error');
          return;
        }
        throw new Error(j?.error || 'Failed to save result');
      }

      setMessageType('success');
      setMessage(editingId ? 'Cập nhật thành công!' : 'Thêm thành công!');
      setEditingId(null);
      setForm({ user_id: '', distance: '5km', chip_time: '', podium_config_id: '', gender: '' });
      await fetchResults();
    } catch (err: unknown) {
      console.error("Save result error:", err);
      const msg = err && typeof err === 'object' && 'message' in err ? (err as {message: string}).message : String(err);
      setMessageType('error');
      setMessage(msg || "Không thể lưu kết quả");
    } finally {
      setSaving(false);
    }
  }
  
  // Pending rewards list (data + helpers only — UI removed)
  const [pendingRewards, setPendingRewards] = useState<Array<Record<string, unknown>>>([]);
  const [pendingAuthRedirect, setPendingAuthRedirect] = useState<string | null>(null);
  const fetchPendingRewards = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/member-rewards?race_id=${encodeURIComponent(raceId)}`, { credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        try {
          const redirectPath = window.location.pathname + window.location.search;
          setPendingAuthRedirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
        } catch {
          setPendingAuthRedirect('/login');
        }
        setPendingRewards([]);
        return;
      }

      if (!res.ok) throw new Error('Failed to load pending rewards');
      const j = await res.json().catch(() => ({ data: [] }));
      const data = j.data || [];
      setPendingRewards(data as Array<Record<string, unknown>>);
    } catch (e: unknown) {
      console.error('Failed to load pending rewards', e);
      setPendingRewards([]);
    }
  }, [raceId]);

  useEffect(() => {
    if (raceId) fetchPendingRewards();
  }, [raceId, fetchPendingRewards]);

  const markRewardDelivered = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/admin/member-rewards', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error('Failed to mark delivered');
    } catch (e: unknown) {
      console.error('Failed to mark reward delivered', e);
    }

    await fetchPendingRewards();
  }, [fetchPendingRewards]);

  // Keep these symbols referenced so TypeScript/ESLint don't flag them as unused
  useEffect(() => {
    void pendingRewards;
    void pendingAuthRedirect;
    void markRewardDelivered;
  }, [pendingRewards, pendingAuthRedirect, markRewardDelivered]);

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {race ? (
          <>
            {race.image_url && (
              <div className="w-full h-48 overflow-hidden">
                <Image src={race.image_url} alt={race.name} width={1200} height={400} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center gradient-theme-primary">
                    <Activity style={{ color: "var(--color-text-inverse)" }} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{race.name}</h1>
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <Calendar size={16} /> {new Date(race.race_date).toLocaleDateString("vi-VN")} • <MapPin size={16} /> {race.location}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link href="/admin/races" className="font-medium" style={{ color: "var(--color-primary)" }}>← Quay lại</Link>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6">
            <p className="text-gray-600">Đang tải...</p>
          </div>
        )}
      </div>

      {/* Import Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Thành viên tham gia</h2>
            <form onSubmit={handleSaveResult} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thành viên</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={form.user_id}
                  onChange={(e) => handleMemberChange(e.target.value)}
                >
                  <option value="">-- Chọn thành viên --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Giới tính</label>
                <div className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700">
                  {form.gender === 'male' ? 'Nam' : form.gender === 'female' ? 'Nữ' : form.gender === 'other' ? 'Khác' : '—'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cự ly</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={form.distance}
                  onChange={(e) => setForm({ ...form, distance: e.target.value as "5km" | "10km" | "21km" | "42km" })}
                >
                  <option value="5km">5km</option>
                  <option value="10km">10km</option>
                  <option value="21km">HM (21km)</option>
                  <option value="42km">FM (42km)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thành tích (chiptime) (HH:MM:SS)</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="HH:MM:SS"
                  value={form.chip_time}
                  onChange={(e) => setForm({ ...form, chip_time: e.target.value })}
                />
              </div>
              {/* Ranks removed: official and age-group ranks are not entered here */}
              {/* Reward selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giải thưởng (nếu có)</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={(form as Record<string, string>).podium_config_id || ""}
                  onChange={(e) => setForm({ ...form, podium_config_id: e.target.value })}
                >
                  <option value="">-- Không chọn --</option>
                  {rewardDefs.map((rd) => {
                    const rRec = asRecord(rd);
                    const typeLabel = rRec.podium_type === 'overall' ? 'Chung cuộc' : rRec.podium_type === 'age_group' ? 'Lứa tuổi' : String(rRec.podium_type ?? '');
                    const rankLabel = String(rRec.rank ?? '');
                    return (
                      <option key={String(rRec.id ?? '')} value={String(rRec.id ?? '')}>
                        {`${typeLabel} - Hạng ${rankLabel}`}
                      </option>
                    );
                  })}
                </select>
                {(form as Record<string, string>).podium_config_id && (
                  <p className="text-sm text-gray-600 mt-2">
                    {(() => {
                      const sel = rewardDefs.find((r) => (r as Record<string, unknown>).id === (form as Record<string, string>).podium_config_id);
                      return sel ? ((sel as Record<string, unknown>).reward_description as string) || 'Không có mô tả' : '';
                    })()}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!form.user_id || saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-60"
                  style={{ background: "var(--color-primary)" }}
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {editingId ? 'Cập nhật' : 'Thêm'}
                </button>
                <button
                  type="button"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border"
                  style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)", background: "var(--color-card, white)" }}
                  onClick={() => {
                    setEditingId(null);
                    setMessage(null);
                    setForm({ user_id: "", distance: "5km", chip_time: "", podium_config_id: "", gender: "" });
                  }}
                >
                  Hủy
                </button>
              </div>
              {message && (
                <p className={`text-sm mt-2 ${messageType === 'success' ? 'text-green-700' : messageType === 'error' ? 'text-red-700' : 'text-gray-700'}`}>
                  {message}
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Results table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Danh sách tham gia</h2>
                <div>
                  <button
                    className="inline-flex items-center gap-2 px-3 py-1 rounded text-sm disabled:opacity-60"
                    style={{ background: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}
                    onClick={async () => {
                      if (!raceId) return;
                      setProcessingResults(true);
                      setMessage(null);
                      try {
                        const res = await fetch(`/api/admin/races/${raceId}/process-results`, { method: 'POST' });
                        const body = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          setMessage(body?.error || 'Xử lý thất bại');
                        } else {
                          setMessage('Xử lý xong — ' + (body?.processed?.length || 0) + ' mục đã xử lý');
                          // refresh results
                          await fetchResults();
                        }
                      } catch (e) {
                        console.error('Process results failed', e);
                        setMessage('Lỗi khi gọi API xử lý');
                      } finally {
                        setProcessingResults(false);
                      }
                    }}
                    disabled={processingResults}
                  >
                    {processingResults ? <Loader2 className="animate-spin" size={14} /> : 'Xử lý kết quả'}
                  </button>
                </div>
              </div>
            {results.length === 0 ? (
              <p className="text-gray-600">Chưa có kết quả.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                        <tr className="text-left text-gray-600 border-b">
                          <th className="py-2 px-3">STT</th>
                          <th className="py-2 px-3">Thành viên</th>
                          <th className="py-2 px-3">Giới tính</th>
                          <th className="py-2 px-3">Cự ly</th>
                          <th className="py-2 px-3">Chip Time</th>
                          <th className="py-2 px-3">PR</th>
                          <th className="py-2 px-3">Giải thưởng mốc</th>
                          <th className="py-2 px-3">Podium</th>
                          <th className="py-2 px-3 text-right">Hành động</th>
                        </tr>
                  </thead>
                  <tbody>
                    {results.map((r, idx) => (
                      <tr key={r.id} className="border-b">
                        <td className="py-2 px-3">{idx + 1}</td>
                        <td className="py-2 px-3">{String(r.profile?.full_name ?? '')}</td>
                        <td className="py-2 px-3">{r.profile?.gender === 'male' ? 'Nam' : r.profile?.gender === 'female' ? 'Nữ' : r.profile?.gender === 'other' ? 'Khác' : '—'}</td>
                        <td className="py-2 px-3">{r.distance}</td>
                        <td className="py-2 px-3">{secondsToTime(r.chip_time_seconds)}</td>
                          {/* official_rank and age_group_rank intentionally not shown here */}
                        <td className="py-2 px-3">{r.is_pr ? <CheckCircle className="text-green-600" size={18} /> : "-"}</td>
                        <td className="py-2 px-3">{r.milestone_reward || '-'}</td>

                        <td className="py-2 px-3">{
                          r.podium_config_id ? (
                            (() => {
                              const found = rewardDefs.find((d) => (d as Record<string, unknown>).id === r.podium_config_id);
                              if (found) {
                                const rec = asRecord(found);
                                return String(rec.reward_description ?? rec.prize_description ?? `${rec.podium_type ?? ''} - Hạng ${String(rec.rank ?? '')}`);
                              }
                              return String(r.podium_config_id);
                            })()
                          ) : '-'}
                        </td>

                        <td className="py-2 px-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              className="px-3 py-1.5 text-sm rounded border"
                              onClick={async () => {
                                // populate form for edit
                                setEditingId(r.id);
                                setForm((f) => ({
                                  ...f,
                                  user_id: r.user_id,
                                  distance: r.distance as RaceResultRow['distance'],
                                  chip_time: secondsToTime(r.chip_time_seconds),
                                                            
                                  podium_config_id: r.podium_config_id || '',
                                }));
                                await handleMemberChange(r.user_id);
                              }}
                            >
                              Sửa
                            </button>
                            <button
                              className="px-3 py-1.5 text-sm rounded text-white bg-red-600"
                              onClick={async () => {
                                if (!confirm('Xóa kết quả này?')) return;
                                try {
                                  const res = await fetch('/api/admin/race-results', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) });
                                  if (!res.ok) throw new Error('Delete failed');
                                  setMessage('Đã xóa kết quả');
                                  await fetchResults();
                                } catch (e) {
                                  console.error('Delete error', e);
                                  alert('Không thể xóa');
                                }
                              }}
                            >
                              Xóa
                            </button>
                            {/* Per-row save button removed — use the form's Save button above */}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      
    </div>
  );
}
