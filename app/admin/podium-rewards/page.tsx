"use client";

import AdminLayout from "@/components/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
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
  member_id: string;
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

export default function PodiumRewardsPage() {
  const [configs, setConfigs] = useState<PodiumConfig[]>([]);
  const [rewards, setRewards] = useState<PodiumReward[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    race_id: "",
    member_id: "",
    podium_config_id: "",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load configs
      const { data: configsData } = await supabase
        .from("reward_podium_config")
        .select("*")
        .eq("is_active", true)
        .order("podium_type", { ascending: true })
        .order("rank", { ascending: true });

      if (configsData) setConfigs(configsData);

      // Load rewards
      const { data: rewardsData } = await supabase
        .from("member_podium_rewards")
        .select(`
          *,
          race:races(id, name, date, location),
          member:profiles(full_name, email)
        `)
        .order("created_at", { ascending: false });

      if (rewardsData) setRewards(rewardsData);

      // Load races (only events with ≥2000 runners)
      const { data: racesData } = await supabase
        .from("races")
        .select("*")
        .order("date", { ascending: false });

      if (racesData) setRaces(racesData);

      // Load members
      const { data: membersData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true });

      if (membersData) setMembers(membersData);

    } catch (error) {
      console.error("Error loading data:", error);
      alert("Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.race_id || !formData.member_id || !formData.podium_config_id) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      const config = configs.find((c) => c.id === formData.podium_config_id);
      if (!config) {
        alert("Không tìm thấy cấu hình phần thưởng");
        return;
      }

      const { error } = await supabase.from("member_podium_rewards").insert([
        {
          ...formData,
          podium_type: config.podium_type,
          rank: config.rank,
          reward_description: config.reward_description,
          cash_amount: config.cash_amount,
        },
      ]);

      if (error) throw error;

      alert("Thêm phần thưởng đứng bục thành công!");
      setShowAddForm(false);
      setFormData({
        race_id: "",
        member_id: "",
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("member_podium_rewards")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq("id", rewardId);

      if (error) throw error;

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
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
            <Star size={32} className="text-orange-600" />
            <h1 className="text-3xl font-bold text-gray-900">Quản Lý Phần Thưởng Đứng Bục</h1>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition"
          >
            <Plus size={20} />
            Thêm Phần Thưởng
          </button>
        </div>

        {/* Current Configs Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold text-blue-900 mb-2">Cấu hình hiện tại:</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-blue-800">Chung cuộc:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
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
              <h4 className="font-semibold text-blue-800">Lứa tuổi:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
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
                  value={formData.member_id}
                  onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
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
                    <p className="text-orange-600 font-bold">{formatCurrency(reward.cash_amount)}</p>
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
