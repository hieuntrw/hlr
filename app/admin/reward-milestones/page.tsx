"use client";

import AdminLayout from "@/components/AdminLayout";
import { useEffect, useState } from "react";
import { Trophy, Plus, Edit, Trash2, Save, X } from "lucide-react";
import Link from "next/link";
interface Milestone {
  id: string;
  race_type: string;
  gender: string;
  milestone_name: string;
  time_seconds: number;
  reward_description: string;
  cash_amount: number;
  priority: number;
  is_active: boolean;
}

export default function RewardMilestonesPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editFormData, setEditFormData] = useState<Milestone | null>(null);
  const [formData, setFormData] = useState({
    race_type: "FM",
    gender: "male",
    milestone_name: "",
    time_seconds: 0,
    reward_description: "",
    cash_amount: 0,
    priority: 1,
  });

  useEffect(() => {
    loadMilestones();
  }, []);

  const loadMilestones = async () => {
    try {
      const res = await fetch('/api/admin/reward-milestones', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load');
      const j = await res.json().catch(() => null);
      setMilestones(j?.data || []);
    } catch (error) {
      console.error("Error loading milestones:", error);
      alert("Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.milestone_name || !formData.reward_description) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      const res = await fetch('/api/admin/reward-milestones', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Insert failed');

      alert("Thêm mốc thành công!");
      setShowAddForm(false);
      setFormData({
        race_type: "FM",
        gender: "male",
        milestone_name: "",
        time_seconds: 0,
        reward_description: "",
        cash_amount: 0,
        priority: 1,
      });
      loadMilestones();
    } catch (error) {
      console.error("Error adding milestone:", error);
      alert("Lỗi khi thêm mốc");
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Milestone>) => {
    try {
      const res = await fetch('/api/admin/reward-milestones', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) throw new Error('Update failed');
      alert("Cập nhật thành công!");
      setEditingId(null);
      setEditFormData(null);
      loadMilestones();
    } catch (error) {
      console.error("Error updating milestone:", error);
      alert("Lỗi khi cập nhật");
    }
  };

  const startEdit = (milestone: Milestone) => {
    setEditingId(milestone.id);
    setEditFormData({ ...milestone });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
  };

  const saveEdit = async () => {
    if (!editFormData || !editingId) return;
    await handleUpdate(editingId, {
      milestone_name: editFormData.milestone_name,
      time_seconds: editFormData.time_seconds,
      reward_description: editFormData.reward_description,
      cash_amount: editFormData.cash_amount,
      priority: editFormData.priority,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa mốc này?")) return;

    try {
      const res = await fetch(`/api/admin/reward-milestones?id=${id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok) throw new Error('Delete failed');

      alert("Xóa thành công!");
      loadMilestones();
    } catch (error) {
      console.error("Error deleting milestone:", error);
      alert("Lỗi khi xóa");
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds >= 999999) return "Hoàn thành";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, "0")}:00`;
  };

  const parseTime = (timeStr: string): number => {
    if (timeStr.toLowerCase() === "hoàn thành") return 999999;
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    return hours * 3600 + minutes * 60;
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
   
      <div className="min-h-screen bg-gray-50">

        {/* Header */}
      <div className="py-6 px-4 gradient-theme-primary">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <Trophy size={32} style={{ color: "white" }} />
            <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-inverse)" }}>Quản Lý Mốc Thành Tích</h1>
            
            <Link href="/admin" className="hover:opacity-80" style={{ color: "var(--color-text-inverse)" }}>
              ← Quay lại
            </Link>
          </div>
        </div>
      </div>
      <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium transition"
            style={{ background: "var(--color-primary)" }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <Plus size={20} />
            Thêm Mốc
          </button>

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Thêm Mốc Mới</h2>
              <button onClick={() => setShowAddForm(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
                <select
                  value={formData.race_type}
                  onChange={(e) => setFormData({ ...formData, race_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="FM">Full Marathon</option>
                  <option value="HM">Half Marathon</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giới tính</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên mốc</label>
                <input
                  type="text"
                  value={formData.milestone_name}
                  onChange={(e) => setFormData({ ...formData, milestone_name: e.target.value })}
                  placeholder="VD: SUB400"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian (HH:MM)</label>
                <input
                  type="text"
                  placeholder="VD: 4:00 hoặc 'Hoàn thành'"
                  onChange={(e) => setFormData({ ...formData, time_seconds: parseTime(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phần thưởng</label>
                <input
                  type="text"
                  value={formData.reward_description}
                  onChange={(e) => setFormData({ ...formData, reward_description: e.target.value })}
                  placeholder="VD: KNC khung kính A5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiền mặt (VNĐ)</label>
                <input
                  type="number"
                  value={formData.cash_amount}
                  onChange={(e) => setFormData({ ...formData, cash_amount: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Độ ưu tiên</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
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
        )}

        {/* Milestones List */}
        <div className="space-y-4">
          {["FM", "HM"].map((raceType) => (
            <div key={raceType}>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {raceType === "FM" ? "Full Marathon" : "Half Marathon"}
              </h2>
              {["male", "female"].map((gender) => {
                const items = milestones.filter((m) => m.race_type === raceType && m.gender === gender);
                if (items.length === 0) return null;

                return (
                  <div key={gender} className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">{gender === "male" ? "Nam" : "Nữ"}</h3>
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Mốc</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Thời gian</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Phần thưởng</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Tiền mặt</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Ưu tiên</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Trạng thái</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {items.map((milestone) => {
                            const isEditing = editingId === milestone.id;
                            const editData = isEditing && editFormData ? editFormData : milestone;
                            
                            return (
                              <tr key={milestone.id} className={isEditing ? "" : ""} style={isEditing ? { background: "var(--color-info-bg, #DBEAFE)" } : {}}>
                                <td className="px-4 py-3 text-sm">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={editData.milestone_name}
                                      onChange={(e) =>
                                        setEditFormData({ ...editData, milestone_name: e.target.value })
                                      }
                                      className="w-full px-2 py-1 border border-gray-300 rounded"
                                    />
                                  ) : (
                                    <span className="font-medium text-gray-900">{milestone.milestone_name}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      defaultValue={formatTime(editData.time_seconds)}
                                      onChange={(e) =>
                                        setEditFormData({ ...editData, time_seconds: parseTime(e.target.value) })
                                      }
                                      placeholder="HH:MM hoặc 'Hoàn thành'"
                                      className="w-24 px-2 py-1 border border-gray-300 rounded"
                                    />
                                  ) : (
                                    formatTime(milestone.time_seconds)
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={editData.reward_description}
                                      onChange={(e) =>
                                        setEditFormData({ ...editData, reward_description: e.target.value })
                                      }
                                      className="w-full px-2 py-1 border border-gray-300 rounded"
                                    />
                                  ) : (
                                    milestone.reward_description
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      value={editData.cash_amount}
                                      onChange={(e) =>
                                        setEditFormData({ ...editData, cash_amount: parseInt(e.target.value) || 0 })
                                      }
                                      className="w-28 px-2 py-1 border border-gray-300 rounded"
                                    />
                                  ) : (
                                    `${milestone.cash_amount.toLocaleString()} đ`
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      value={editData.priority}
                                      onChange={(e) =>
                                        setEditFormData({ ...editData, priority: parseInt(e.target.value) || 1 })
                                      }
                                      className="w-16 px-2 py-1 border border-gray-300 rounded"
                                    />
                                  ) : (
                                    milestone.priority
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      milestone.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                                    }`}
                                  >
                                    {milestone.is_active ? "Hoạt động" : "Tắt"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  {isEditing ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={saveEdit}
                                        className="text-green-600 hover:text-green-800"
                                        title="Lưu"
                                      >
                                        <Save size={18} />
                                      </button>
                                      <button
                                        onClick={cancelEdit}
                                        className="text-gray-600 hover:text-gray-800"
                                        title="Hủy"
                                      >
                                        <X size={18} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => startEdit(milestone)}
                                        style={{ color: "var(--color-primary)" }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                        title="Sửa"
                                      >
                                        <Edit size={18} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleUpdate(milestone.id, { is_active: !milestone.is_active })
                                        }
                                        className="text-yellow-600"
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                        title={milestone.is_active ? "Tắt" : "Bật"}
                                      >
                                        {milestone.is_active ? "Tắt" : "Bật"}
                                      </button>
                                      <button
                                        onClick={() => handleDelete(milestone.id)}
                                        className="text-red-600 hover:text-red-800"
                                        title="Xóa"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    
  );
}
