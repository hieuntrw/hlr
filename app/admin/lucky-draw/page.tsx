"use client";

import AdminLayout from "@/components/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Gift, Plus, CheckCircle, Clock, User } from "lucide-react";

interface Challenge {
  id: string;
  name: string;
  month: number;
  year: number;
}

interface LuckyDrawWinner {
  id: string;
  challenge_id: string;
  user_id: string;
  reward_description: string;
  status: string;
  delivered_at: string | null;
  delivered_by: string | null;
  notes: string | null;
  created_at: string;
  challenge: Challenge;
  member: {
    full_name: string;
    email: string;
  };
}

export default function LuckyDrawPage() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [winners, setWinners] = useState<LuckyDrawWinner[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    challenge_id: "",
    user_id: "",
    reward_description: "",
  });

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [user, authLoading]);

  const loadData = async () => {
    try {
      // Load challenges
      const { data: challengesData } = await supabase
        .from("challenges")
        .select("id, name, month, year")
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (challengesData) setChallenges(challengesData);

      // Load winners
      const { data: winnersData } = await supabase
        .from("lucky_draw_winners")
        .select(`
          *,
          challenge:challenges(id, name, month, year),
          member:profiles(full_name, email)
        `)
        .order("created_at", { ascending: false });

      if (winnersData) setWinners(winnersData);

      // Load all members
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
    if (!formData.challenge_id || !formData.user_id || !formData.reward_description) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      // Insert using existing DB column `member_id` for compatibility while
      // migration is applied. We keep form state using `user_id`.
      const { error } = await supabase.from("lucky_draw_winners").insert([{
        challenge_id: formData.challenge_id,
        member_id: formData.user_id,
        reward_description: formData.reward_description,
      }]);
      if (error) throw error;

      alert("Thêm người trúng thưởng thành công!");
      setShowAddForm(false);
      setFormData({
        challenge_id: "",
        user_id: "",
        reward_description: "",
      });
      loadData();
    } catch (error) {
      console.error("Error adding winner:", error);
      alert("Lỗi khi thêm người trúng thưởng");
    }
  };

  const handleMarkDelivered = async (winnerId: string) => {
    try {
      // user from AuthContext
if (!user) return;

      const { error } = await supabase
        .from("lucky_draw_winners")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
          delivered_by: user.id,
        })
        .eq("id", winnerId);

      if (error) throw error;

      alert("Đã đánh dấu đã trao!");
      loadData();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Lỗi khi cập nhật trạng thái");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-8">
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
            <Gift size={32} style={{ color: "var(--color-primary)" }} />
            <h1 className="text-3xl font-bold text-gray-900">Quản Lý Quay Số May Mắn</h1>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium transition"
            style={{ background: "var(--color-primary)" }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <Plus size={20} />
            Thêm Người Trúng
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Thêm Người Trúng Quay Số</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thử thách</label>
                <select
                  value={formData.challenge_id}
                  onChange={(e) => setFormData({ ...formData, challenge_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">-- Chọn thử thách --</option>
                  {challenges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.month}/{c.year})
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Quà tặng</label>
                <textarea
                  value={formData.reward_description}
                  onChange={(e) => setFormData({ ...formData, reward_description: e.target.value })}
                  placeholder="Mô tả quà tặng..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
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

        {/* Winners List */}
        <div className="space-y-4">
          {winners.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center text-gray-500">
              Chưa có người trúng quay số nào
            </div>
          ) : (
            winners.map((winner) => (
              <div key={winner.id} className="bg-white rounded-lg p-6 shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift size={24} style={{ color: "var(--color-primary)" }} />
                      <h3 className="text-xl font-bold text-gray-900">
                        {winner.challenge.name} - Tháng {winner.challenge.month}/{winner.challenge.year}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <User size={18} className="text-gray-500" />
                      <span className="text-gray-700 font-medium">{winner.member.full_name}</span>
                      <span className="text-gray-500">({winner.member.email})</span>
                    </div>
                    <p className="text-gray-800 mb-2">
                      <strong>Quà tặng:</strong> {winner.reward_description}
                    </p>
                    {winner.notes && (
                      <p className="text-sm text-gray-600">
                        <strong>Ghi chú:</strong> {winner.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {winner.status === "pending" ? (
                      <>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700 flex items-center gap-1">
                          <Clock size={16} />
                          Chưa trao
                        </span>
                        <button
                          onClick={() => handleMarkDelivered(winner.id)}
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
                        {winner.delivered_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(winner.delivered_at).toLocaleDateString("vi-VN")}
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
