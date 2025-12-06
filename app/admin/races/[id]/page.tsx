"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { checkRaceReward, checkPodiumReward } from "@/lib/services/rewardService";
import { Calendar, MapPin, Activity, User, Medal, Save, Loader2, CheckCircle } from "lucide-react";

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
  official_rank?: number;
  age_group_rank?: number;
  evidence_link?: string;
  is_pr?: boolean;
  approved?: boolean;
  category?: string;
  milestone_name?: string;
  profile?: { full_name: string };
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

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    distance: "21km" as "5km" | "10km" | "21km" | "42km",
    chip_time: "",
    official_rank: "",
    age_group_rank: "",
    evidence_link: "",
    reward_definition_id: "",
    gender: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (raceId) {
      fetchRace();
      fetchMembers();
      fetchResults();
    }
  }, [raceId]);

  async function fetchRace() {
    const { data } = await supabase
      .from("races")
      .select("id, name, race_date, location, image_url")
      .eq("id", raceId)
      .single();
    if (data) setRace(data as Race);
  }

  async function fetchMembers() {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, gender")
      .order("full_name", { ascending: true });
    if (data) setMembers(data as ProfileOption[]);
  }

  // Try to get gender from profiles table; fallback to name-based inference
  function inferGenderFromName(name = "") {
    const n = name.toLowerCase();
    // simple heuristic: look for common tokens that often indicate female names in VN
    const femaleTokens = ["thị", "ngọc", "lan", "hoa", "mai", "thảo", "huệ", "hương", "trang", "anh", "ngân", "thùy", "thi"];
    for (const t of femaleTokens) {
      if (n.includes(t)) return "female";
    }
    // fallback: common male tokens
    const maleTokens = ["anh", "hieu", "minh", "quan", "huy", "duc", "son", "tuan"];
    for (const t of maleTokens) {
      if (n.includes(t)) return "male";
    }
    return "";
  }

  async function handleMemberChange(selectedId: string) {
    setForm({ ...form, user_id: selectedId });
    if (!selectedId) {
      setForm((f) => ({ ...f, gender: "" }));
      return;
    }

    // Prefer stored gender value from profiles table
    try {
      const { data } = await supabase.from("profiles").select("gender, full_name").eq("id", selectedId).single();
      if (data) {
        const g = (data as any).gender as string | null;
        if (g) {
          setForm((f) => ({ ...f, gender: g }));
          return;
        }
        // no stored gender -> infer from name
        const inferred = inferGenderFromName((data as any).full_name || "");
        if (inferred) setForm((f) => ({ ...f, gender: inferred }));
        else setForm((f) => ({ ...f, gender: "" }));
        return;
      }
    } catch (e) {
      console.warn("Failed to fetch profile gender", e);
    }

    // If we didn't get profile, try to infer from members list
    const mem = members.find((m) => m.id === selectedId);
    if (mem) {
      const inferred = inferGenderFromName(mem.full_name);
      setForm((f) => ({ ...f, gender: inferred }));
    } else {
      setForm((f) => ({ ...f, gender: "" }));
    }
  }

  async function fetchResults() {
    const { data } = await supabase
      .from("race_results")
      .select("id, user_id, distance, chip_time_seconds, official_rank, age_group_rank, evidence_link, is_pr, approved, category, milestone_name, profiles(full_name)")
      .eq("race_id", raceId)
      .order("chip_time_seconds", { ascending: true });
    if (data) {
      const mapped = (data as any[]).map((r) => ({
        ...r,
        profile: { full_name: r.profiles?.full_name || "" },
      }));
      setResults(mapped);
    }
  }

  // Rewards available for selection (podium overall / age group)
  const [rewardDefs, setRewardDefs] = useState<any[]>([]);
  useEffect(() => {
    fetchRewardDefinitions();
  }, [race]);

  async function fetchRewardDefinitions() {
    try {
      // Load podium configs (overall + age-group) from reward_podium_config
      const { data } = await supabase
        .from('reward_podium_config')
        .select('id, podium_type, rank, reward_description')
        .eq('is_active', true)
        .order('podium_type', { ascending: true })
        .order('rank', { ascending: true });
      if (data) setRewardDefs(data as any[]);
    } catch (e) {
      console.warn('Failed to fetch reward definitions', e);
    }
  }

  async function updatePBIfNeeded(userId: string, distance: string, chipSeconds: number) {
    if (distance !== "21km" && distance !== "42km") return false;

    const pbField = distance === "21km" ? "pb_hm_seconds" : "pb_fm_seconds";

    const { data: profile } = await supabase
      .from("profiles")
      .select(`${pbField}`)
      .eq("id", userId)
      .single();

    const currentPB = (profile as any)?.[pbField] as number | null;

    if (!currentPB || chipSeconds < currentPB) {
      // Update PB
      await supabase
        .from("profiles")
        .update({ [pbField]: chipSeconds })
        .eq("id", userId);

      // Insert PB history
      await supabase.from("pb_history").insert({
        user_id: userId,
        distance,
        time_seconds: chipSeconds,
        achieved_at: race?.race_date || new Date().toISOString().slice(0, 10),
        race_id: raceId,
      });

      return true;
    }

    return false;
  }

  async function handleSaveResult(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const chipSeconds = timeToSeconds(form.chip_time);

      // 1) Insert race result
      const insertPayload: any = {
        race_id: raceId,
        user_id: form.user_id,
        distance: form.distance,
        chip_time_seconds: chipSeconds,
        official_rank: form.official_rank ? parseInt(form.official_rank, 10) : null,
        age_group_rank: form.age_group_rank ? parseInt(form.age_group_rank, 10) : null,
        evidence_link: form.evidence_link || null,
      };

      const { data: inserted, error } = await supabase
        .from("race_results")
        .insert(insertPayload)
        .select("id")
        .single();

      if (error) throw error;

      const raceResultId = inserted!.id as string;

      // 2) Update PB and mark PR
      const isPR = await updatePBIfNeeded(form.user_id, form.distance, chipSeconds);
      if (isPR) {
        // Mark PR and set approved to true to trigger auto-award milestone
        await supabase.from("race_results").update({ is_pr: true, approved: true }).eq("id", raceResultId);
      }

      // 3) Reward checks: time-based + podium
      await checkRaceReward(form.user_id, {
        id: raceResultId,
        user_id: form.user_id,
        race_id: raceId,
        distance: form.distance,
        chip_time_seconds: chipSeconds,
        official_rank: insertPayload.official_rank || 0,
        age_group_rank: insertPayload.age_group_rank || 0,
      });

      await checkPodiumReward(form.user_id, {
        id: raceResultId,
        user_id: form.user_id,
        race_id: raceId,
        distance: form.distance,
        chip_time_seconds: chipSeconds,
        official_rank: insertPayload.official_rank || 0,
        age_group_rank: insertPayload.age_group_rank || 0,
      }, "overall");

      await checkPodiumReward(form.user_id, {
        id: raceResultId,
        user_id: form.user_id,
        race_id: raceId,
        distance: form.distance,
        chip_time_seconds: chipSeconds,
        official_rank: insertPayload.official_rank || 0,
        age_group_rank: insertPayload.age_group_rank || 0,
      }, "age_group");

      // 4) If admin selected a reward manually, create a member_rewards entry (pending)
      if ((form as any).reward_definition_id) {
        try {
          const { error: mrErr } = await supabase.from('member_rewards').insert({
            user_id: form.user_id,
            race_result_id: raceResultId,
            reward_definition_id: (form as any).reward_definition_id,
            status: 'pending'
          });
          if (mrErr) console.warn('Failed to create member_rewards from admin selection', mrErr);
          else setMessage((prev) => (prev ? prev + ' Giải thưởng đã được ghi nhận (pending).' : 'Giải thưởng đã được ghi nhận (pending).'));
        } catch (e) {
          console.warn('Error inserting member_rewards', e);
        }
      }

      setMessage("Lưu kết quả thành công. Đã kiểm tra PB và phần thưởng.");
      setForm({ ...form, user_id: "", chip_time: "", official_rank: "", age_group_rank: "", evidence_link: "", gender: "" });
      await fetchResults();
    } catch (err: any) {
      console.error("Save result error:", err);
      setMessage(err.message || "Không thể lưu kết quả");
    } finally {
      setSaving(false);
    }
  }

  // Pending rewards list
  const [pendingRewards, setPendingRewards] = useState<any[]>([]);
  useEffect(() => {
    if (raceId) fetchPendingRewards();
  }, [raceId]);

  async function fetchPendingRewards() {
    const { data } = await supabase
      .from("member_rewards")
      .select("id, status, user_id, race_result_id, reward_definition_id, related_transaction_id, profiles(full_name), reward_definitions(prize_description)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data) setPendingRewards(data as any[]);
  }

  async function markRewardDelivered(id: string) {
    // 1) Mark reward delivered
    const { error: rwErr } = await supabase
      .from("member_rewards")
      .update({ status: "delivered" })
      .eq("id", id);

    if (rwErr) {
      console.error("Failed to update member_rewards status:", rwErr);
      await fetchPendingRewards();
      return;
    }

    // 2) Also mark related payout transaction as paid, if linked
    const { data: rw } = await supabase
      .from("member_rewards")
      .select("related_transaction_id")
      .eq("id", id)
      .single();

    const txnId = (rw as any)?.related_transaction_id as string | null;
    if (txnId) {
      const now = new Date().toISOString();
      const { error: txErr } = await supabase
        .from("transactions")
        .update({ payment_status: "paid", paid_at: now })
        .eq("id", txnId);
      if (txErr) {
        console.warn("Could not mark payout as paid (check RLS/admin perms):", txErr);
      }
    }

    await fetchPendingRewards();
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {race ? (
          <>
            {(race as any).image_url && (
              <div className="w-full h-48 overflow-hidden">
                <img
                  src={(race as any).image_url}
                  alt={race.name}
                  className="w-full h-full object-cover"
                />
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
                <Link href="/admin/races" className="font-medium" style={{ color: "var(--color-primary)" }}>← Quay lại</Link>
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
                  onChange={(e) => setForm({ ...form, distance: e.target.value as any })}
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
                  value={(form as any).reward_definition_id}
                  onChange={(e) => setForm({ ...form, reward_definition_id: e.target.value })}
                >
                  <option value="">-- Không chọn --</option>
                  {rewardDefs.map((rd) => (
                    <option key={rd.id} value={rd.id}>
                      {rd.podium_type === 'overall' ? 'Chung cuộc' : rd.podium_type === 'age_group' ? 'Lứa tuổi' : rd.podium_type} + ` - Hạng ${rd.rank}`
                    </option>
                  ))}
                </select>
                {(form as any).reward_definition_id && (
                  <p className="text-sm text-gray-600 mt-2">
                    {(() => {
                      const sel = rewardDefs.find((r) => r.id === (form as any).reward_definition_id);
                      return sel ? sel.reward_description || 'Không có mô tả' : '';
                    })()}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link kết quả</label>
                <input
                  type="url"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="https://official-result.com/..."
                  value={form.evidence_link}
                  onChange={(e) => setForm({ ...form, evidence_link: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={!form.user_id || saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-60"
                style={{ background: "var(--color-primary)" }}
                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Lưu kết quả
              </button>
              {message && <p className="text-sm text-gray-700 mt-2">{message}</p>}
            </form>
          </div>
        </div>

        {/* Results table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Danh sách tham gia</h2>
            {results.length === 0 ? (
              <p className="text-gray-600">Chưa có kết quả.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 px-3">Thành viên</th>
                      <th className="py-2 px-3">Cự ly</th>
                      <th className="py-2 px-3">Chip Time</th>
                      <th className="py-2 px-3">PR</th>
                      <th className="py-2 px-3">Duyệt PB</th>
                      <th className="py-2 px-3">Mốc thưởng</th>
                      <th className="py-2 px-3 text-right">Hành động</th>
                      <th className="py-2 px-3">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id} className="border-b">
                        <td className="py-2 px-3">{r.profile?.full_name}</td>
                        <td className="py-2 px-3">{r.distance}</td>
                        <td className="py-2 px-3">{secondsToTime(r.chip_time_seconds)}</td>
                          {/* official_rank and age_group_rank intentionally not shown here */}
                        <td className="py-2 px-3">{r.is_pr ? <CheckCircle className="text-green-600" size={18} /> : "-"}</td>
                        <td className="py-2 px-3">{r.approved ? <CheckCircle size={18} style={{ color: "var(--color-primary)" }} /> : "-"}</td>
                        <td className="py-2 px-3">{r.milestone_name || "-"}</td>
                        <td className="py-2 px-3 text-right">
                          {(!r.approved) ? (
                            <button
                              className="px-3 py-1.5 text-white rounded text-xs"
                              style={{ background: "var(--color-primary)" }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                              onClick={async () => {
                                try {
                                  await supabase.from("race_results").update({ approved: true, is_pr: true }).eq("id", r.id);
                                  // Fetch back the single result to read milestone annotation
                                  const { data: updated } = await supabase
                                    .from("race_results")
                                    .select("milestone_name")
                                    .eq("id", r.id)
                                    .single();
                                  if (updated?.milestone_name) {
                                    setMessage(`Đã duyệt PB. Mốc thưởng: ${updated.milestone_name}`);
                                  } else {
                                    setMessage('Đã duyệt PB.');
                                  }
                                  await fetchResults();
                                } catch (e) {
                                  console.error("Approve PB error:", e);
                                  alert("Không thể duyệt PB");
                                }
                              }}
                            >
                              Duyệt PB
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {r.evidence_link ? (
                            <a style={{ color: "var(--color-primary)" }} href={r.evidence_link} target="_blank">Link</a>
                          ) : (
                            "-"
                          )}
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

      {/* Pending Rewards */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Danh Sách Cần Trao Thưởng</h2>
        {pendingRewards.length === 0 ? (
          <p className="text-gray-600">Chưa có phần thưởng nào chờ trao.</p>
        ) : (
          <div className="space-y-3">
            {pendingRewards.map((rw) => (
              <div key={rw.id} className="p-4 border rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{rw.profiles?.full_name}</p>
                  <p className="text-sm text-gray-600">{rw.reward_definitions?.prize_description}</p>
                </div>
                <button
                  onClick={() => markRewardDelivered(rw.id)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckCircle size={16} /> Xác nhận đã trao
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
