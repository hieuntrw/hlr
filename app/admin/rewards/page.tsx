"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { Trophy, Plus, Edit, Trash2, Save, X } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";

interface RewardDefinition {
  id: string;
  category: "HM" | "FM";
  type: "milestone" | "podium_overall" | "podium_age";
  condition_value: number;
  condition_label: string;
  prize_description: string;
  cash_amount: number;
  priority_level: number;
  quantity?: number; // For challenge stars
}

export default function AdminRewardsPage() {
  const [rewards, setRewards] = useState<RewardDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<RewardDefinition>>({
    category: "HM",
    type: "milestone",
    condition_value: 0,
    condition_label: "",
    prize_description: "",
    cash_amount: 0,
    priority_level: 100,
  });

  useEffect(() => {
    fetchRewards();
  }, []);

  async function fetchRewards() {
    setLoading(true);
    const { data, error } = await supabase
      .from("reward_definitions")
      .select("*")
      .order("category", { ascending: true })
      .order("priority_level", { ascending: true });

    if (error) {
      console.error("Error fetching rewards:", error);
    } else {
      setRewards(data || []);
    }
    setLoading(false);
  }

  async function handleSave(reward: Partial<RewardDefinition>) {
    if (editing) {
      // Update existing
      const { error } = await supabase
        .from("reward_definitions")
        .update(reward)
        .eq("id", editing);

      if (error) {
        alert("Lỗi cập nhật: " + error.message);
      } else {
        setEditing(null);
        fetchRewards();
      }
    } else {
      // Create new
      const { error } = await supabase
        .from("reward_definitions")
        .insert([reward]);

      if (error) {
        alert("Lỗi tạo mới: " + error.message);
      } else {
        setShowAddForm(false);
        setFormData({
          category: "HM",
          type: "milestone",
          condition_value: 0,
          condition_label: "",
          prize_description: "",
          cash_amount: 0,
          priority_level: 100,
        });
        fetchRewards();
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Xác nhận xóa mốc thưởng này?")) return;

    const { error } = await supabase
      .from("reward_definitions")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Lỗi xóa: " + error.message);
    } else {
      fetchRewards();
    }
  }

  const getCategoryLabel = (cat: string) => {
    return cat === "HM" ? "Half Marathon" : "Full Marathon";
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "milestone": return "Mốc thời gian";
      case "podium_overall": return "Podium chung";
      case "podium_age": return "Podium nhóm tuổi";
      default: return type;
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Đang tải...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trophy size={32} style={{ color: "var(--color-primary)" }} />
            <h1 className="text-3xl font-bold text-gray-900">Quản lý Mốc Thưởng</h1>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition"
            style={{ background: "var(--color-primary)" }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <Plus size={20} />
            Thêm mốc thưởng
          </button>
        </div>

        {showAddForm && (
          <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Thêm mốc thưởng mới</h2>
            <RewardForm
              data={formData}
              onChange={setFormData}
              onSave={() => handleSave(formData)}
              onCancel={() => {
                setShowAddForm(false);
                setFormData({
                  category: "HM",
                  type: "milestone",
                  condition_value: 0,
                  condition_label: "",
                  prize_description: "",
                  cash_amount: 0,
                  priority_level: 100,
                });
              }}
            />
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Loại</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Danh mục</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Điều kiện</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Mô tả giải thưởng</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Tiền thưởng</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rewards.map((reward) => (
                <tr key={reward.id} className="border-b border-gray-100 hover:bg-gray-50">
                  {editing === reward.id ? (
                    <td colSpan={6} className="px-4 py-4">
                      <RewardForm
                        data={reward}
                        onChange={(updated) => {
                          const idx = rewards.findIndex((r) => r.id === reward.id);
                          const newRewards = [...rewards];
                          newRewards[idx] = { ...reward, ...updated };
                          setRewards(newRewards);
                        }}
                        onSave={() => handleSave(reward)}
                        onCancel={() => {
                          setEditing(null);
                          fetchRewards();
                        }}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm text-gray-900">{getCategoryLabel(reward.category)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{getTypeLabel(reward.type)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono">{reward.condition_label}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{reward.prize_description}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                        {reward.cash_amount.toLocaleString("vi-VN")} đ
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setEditing(reward.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded transition mr-2"
                          style={{ color: "var(--color-primary)" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(var(--color-primary-rgb, 249 115 22), 0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <Edit size={16} />
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(reward.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded transition"
                        >
                          <Trash2 size={16} />
                          Xóa
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {rewards.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Trophy className="mx-auto mb-3 text-gray-300" size={48} />
              <p>Chưa có mốc thưởng nào. Nhấn "Thêm mốc thưởng" để bắt đầu.</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function RewardForm({
  data,
  onChange,
  onSave,
  onCancel,
}: {
  data: Partial<RewardDefinition>;
  onChange: (updated: Partial<RewardDefinition>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
        <select
          value={data.category || "HM"}
          onChange={(e) => onChange({ ...data, category: e.target.value as "HM" | "FM" })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="HM">Half Marathon</option>
          <option value="FM">Full Marathon</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
        <select
          value={data.type || "milestone"}
          onChange={(e) => onChange({ ...data, type: e.target.value as any })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="milestone">Mốc thời gian</option>
          <option value="podium_overall">Podium chung</option>
          <option value="podium_age">Podium nhóm tuổi</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Giá trị điều kiện (giây hoặc hạng)</label>
        <input
          type="number"
          value={data.condition_value || 0}
          onChange={(e) => onChange({ ...data, condition_value: parseInt(e.target.value) })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nhãn điều kiện (vd: SUB 130)</label>
        <input
          type="text"
          value={data.condition_label || ""}
          onChange={(e) => onChange({ ...data, condition_label: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
          placeholder="SUB 130, Top 3, v.v."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả giải thưởng</label>
        <input
          type="text"
          value={data.prize_description || ""}
          onChange={(e) => onChange({ ...data, prize_description: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
          placeholder="Giải nhì"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tiền thưởng (VND)</label>
        <input
          type="number"
          value={data.cash_amount || 0}
          onChange={(e) => onChange({ ...data, cash_amount: parseFloat(e.target.value) })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mức ưu tiên</label>
        <input
          type="number"
          value={data.priority_level || 100}
          onChange={(e) => onChange({ ...data, priority_level: parseInt(e.target.value) })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>

      <div className="col-span-2 flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          <X size={16} />
          Hủy
        </button>
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition"
          style={{ background: "var(--color-primary)" }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <Save size={16} />
          Lưu
        </button>
      </div>
    </div>
  );
}
