"use client";

import AdminLayout from "@/components/AdminLayout";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole, isAdminRole } from "@/lib/auth/role";
import { Star, Plus, CheckCircle, Clock, Calendar, User } from "lucide-react";

interface Race {
  id: string;
  name: string;
  date: string;
  location: string;
}

interface PodiumConfig {
  id: string;
  podium_type: string;
  rank: number;
  reward_description: string;
  cash_amount: number;
  is_active: boolean;
}

interface PodiumReward {
  id: string;
  race_id: string;
  user_id: string;
  podium_config_id: string;
  podium_type: string;
  rank: number;
  reward_description: string;
  cash_amount: number;
  status: string;
  delivered_at: string | null;
  notes: string | null;
  race: Race;
  member: {
    full_name: string;
    email: string;
  };
}

interface Member {
  id: string;
  full_name: string;
  email: string;
}

export default function PodiumRewardsPage() {
  const { user, profile, isLoading: authLoading, sessionChecked } = useAuth();
  const [configs, setConfigs] = useState<PodiumConfig[]>([]);
  const [rewards, setRewards] = useState<PodiumReward[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    race_id: "",
    user_id: "",
    podium_config_id: "",
    notes: "",
  });

  useEffect(() => {
    if (authLoading || !sessionChecked) return;
    // Ensure only admins load this page
    if (!user) {
      window.location.href = '/login';
      return;
    }
    const resolved = getEffectiveRole(user, profile) || 'member';
    if (!isAdminRole(resolved)) {
      window.location.href = '/';
      return;
    }
    loadData();
  }, [user, profile, authLoading, sessionChecked]);

  const loadData = async () => {
    try {
      const res = await fetch('/api/admin/podium-rewards', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load');
      const j = await res.json().catch(() => null);
      setConfigs(j?.configs || []);
      setRewards(j?.rewards || []);
      setRaces(j?.races || []);
      setMembers(j?.members || []);

    } catch (error) {
      console.error("Error loading data:", error);
      alert("Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.race_id || !formData.user_id || !formData.podium_config_id) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      const config = configs.find((c) => c.id === formData.podium_config_id);
      if (!config) {
        alert("Không tìm thấy cấu hình phần thưởng");
        return;
      }

      const payload = {
        race_id: formData.race_id,
        member_id: formData.user_id,
        podium_config_id: formData.podium_config_id,
        notes: formData.notes,
        podium_type: config.podium_type,
        rank: config.rank,
        reward_description: config.reward_description,
        cash_amount: config.cash_amount,
        status: 'pending',
      };
      const r = await fetch('/api/admin/podium-rewards', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('Insert failed');

      alert("Thêm phần thưởng đứng bục thành công!");
      setShowAddForm(false);
      setFormData({
        race_id: "",
        user_id: "",
        podium_config_id: "",
        notes: "",
      });
      loadData();
    } catch (error) {
      console.error("Error adding reward:", error);
      alert("Lỗi khi thêm phần thưởng");
    }
  };

  const handleMarkDelivered = async (rewardId: string) => {
    try {
      // user from AuthContext
if (!user) return;

      const r = await fetch('/api/admin/podium-rewards', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rewardId, status: 'delivered', delivered_at: new Date().toISOString(), approved_by: user.id }) });
      if (!r.ok) throw new Error('Update failed');

      alert("Đã đánh dấu đã trao!");
      loadData();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Lỗi khi cập nhật trạng thái");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: "var(--color-primary)" }}></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star size={32} style={{ color: "var(--color-primary)" }} />
            <h1 className="text-3xl font-bold text-gray-900">Quản Lý Phần Thưởng Đứng Bục</h1>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium transition"
            style={{ background: "var(--color-primary)" }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <Plus size={20} />
            Thêm Phần Thưởng
          </button>
        </div>

        {/* Current Configs Info */}
        <div className="rounded-lg p-4" style={{ background: "#DBEAFE", border: "1px solid #93C5FD" }}>
          <h3 className="font-bold mb-2" style={{ color: "#1E3A8A" }}>Cấu hình hiện tại:</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold" style={{ color: "#1E40AF" }}>Chung cuộc:</h4>
              <ul className="text-sm space-y-1" style={{ color: "#1D4ED8" }}>
                {configs
                  .filter((c) => c.podium_type === "overall")
                  .map((c) => (
                    <li key={c.id}>
                      Top {c.rank}: {c.reward_description} - {formatCurrency(c.cash_amount)}
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold" style={{ color: "#1E40AF" }}>Lứa tuổi:</h4>
              <ul className="text-sm space-y-1" style={{ color: "#1D4ED8" }}>
                {configs
                  .filter((c) => c.podium_type === "age_group")
                  .map((c) => (
                    <li key={c.id}>
                      Top {c.rank}: {c.reward_description} - {formatCurrency(c.cash_amount)}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Thêm Phần Thưởng Đứng Bục</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sự kiện (Race)</label>
                <select
                  value={formData.race_id}
                  onChange={(e) => setFormData({ ...formData, race_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">-- Chọn sự kiện --</option>
                  {races.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} - {new Date(r.date).toLocaleDateString("vi-VN")} ({r.location})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thành viên</label>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">-- Chọn thành viên --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại giải & hạng</label>
                <select
                  value={formData.podium_config_id}
                  onChange={(e) => setFormData({ ...formData, podium_config_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">-- Chọn loại giải --</option>
                  <optgroup label="Chung cuộc">
                    {configs
                      .filter((c) => c.podium_type === "overall")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          Top {c.rank} - {c.reward_description} - {formatCurrency(c.cash_amount)}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Lứa tuổi">
                    {configs
                      .filter((c) => c.podium_type === "age_group")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          Top {c.rank} - {c.reward_description} - {formatCurrency(c.cash_amount)}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (tùy chọn)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ghi chú thêm..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
                >
                  Lưu
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rewards List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Danh Sách Phần Thưởng</h2>
          {rewards.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center text-gray-500">
              Chưa có phần thưởng đứng bục nào
            </div>
          ) : (
            rewards.map((reward) => (
              <div key={reward.id} className="bg-white rounded-lg p-6 shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Star size={24} className="text-yellow-500" />
                      <h3 className="text-xl font-bold text-gray-900">
                        Top {reward.rank} - {reward.podium_type === "overall" ? "Chung cuộc" : "Lứa tuổi"}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar size={18} className="text-gray-500" />
                      <span className="text-gray-700 font-medium">
                        {reward.race.name} - {new Date(reward.race.date).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <User size={18} className="text-gray-500" />
                      <span className="text-gray-700 font-medium">{reward.member.full_name}</span>
                      <span className="text-gray-500">({reward.member.email})</span>
                    </div>
                    <p className="text-gray-800 mb-1">{reward.reward_description}</p>
                    <p className="font-bold" style={{ color: "var(--color-primary)" }}>{formatCurrency(reward.cash_amount)}</p>
                    {reward.notes && (
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Ghi chú:</strong> {reward.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {reward.status === "pending" ? (
                      <>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700 flex items-center gap-1">
                          <Clock size={16} />
                          Chưa trao
                        </span>
                        <button
                          onClick={() => handleMarkDelivered(reward.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition"
                        >
                          Đánh dấu đã trao
                        </button>
                      </>
                    ) : (
                      <div>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 flex items-center gap-1">
                          <CheckCircle size={16} />
                          Đã trao
                        </span>
                        {reward.delivered_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(reward.delivered_at).toLocaleDateString("vi-VN")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
