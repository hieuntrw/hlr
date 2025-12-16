"use client";

import AdminLayout from "@/components/AdminLayout";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole, isAdminRole } from "@/lib/auth/role";
import { Clock, Gift, Users, CheckCircle } from "lucide-react";

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

export default function RewardMonitorPage() {
  const { user, profile, isLoading: authLoading, sessionChecked } = useAuth();
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRace, setSelectedRace] = useState<string>("");
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  const fetchRewards = async (raceId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/member-rewards?race_id=${encodeURIComponent(raceId)}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load rewards');
      const j = await res.json().catch(() => null);
      const data = j?.data || [];
      setRewards(data as RewardRow[]);
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
            {rewards.length === 0 ? (
              <div className="bg-white rounded-lg p-6 text-center text-gray-500">Không có phần thưởng đang chờ cho sự kiện này</div>
            ) : (
              rewards.map((r) => (
                <div key={r.id} className="bg-white rounded-lg p-4 shadow-sm border flex justify-between">
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
                              const res = await fetch('/api/admin/member-rewards', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, updates: { status: 'delivered', delivered_at: new Date().toISOString() } }) });
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
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
