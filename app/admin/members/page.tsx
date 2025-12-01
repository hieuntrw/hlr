"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";
import { Edit, Trash2, UserPlus, X, Save } from "lucide-react";

interface Member {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  join_date: string;
  leave_date: string | null;
  phone_number: string | null;
  dob: string | null;
  device_name: string | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MembersAdminPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "member",
    phone_number: "",
    dob: "",
    device_name: "",
  });
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    checkRole();
    fetchMembers();
  }, []);

  useEffect(() => {
    // Filter members by email
    if (searchEmail.trim() === "") {
      setFilteredMembers(members);
    } else {
      const filtered = members.filter((m) =>
        m.email.toLowerCase().includes(searchEmail.toLowerCase())
      );
      setFilteredMembers(filtered);
    }
  }, [searchEmail, members]);

  async function checkRole() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/debug-login");
      return;
    }
    // Chỉ kiểm tra quyền qua Supabase Auth metadata
    const role = user.user_metadata?.role;
    if (!role || !["admin", "mod_member"].includes(role)) {
      router.push("/");
    }
  }

  async function fetchMembers() {
    setLoading(true);

    try {
      console.log("[Members Page] Fetching members...");
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active, join_date, leave_date, phone_number, dob, device_name")
        .order("join_date", { ascending: false });

      console.log("[Members Page] Query result:", { data, error });

      if (error) {
        console.error("[Members Page] Error:", error);
        alert("Lỗi khi tải danh sách: " + error.message);
        return;
      }

      console.log("[Members Page] Loaded members:", data?.length || 0);
      setMembers(data || []);
    } catch (err) {
      console.error("[Members Page] Exception:", err);
      alert("Lỗi: " + String(err));
    } finally {
      setLoading(false);
    }
  }

  const getRoleLabel = (role: string): string => {
    const labels: { [key: string]: string } = {
      admin: "Super Admin",
      mod_finance: "Mod Tài Chính",
      mod_challenge: "Mod Thử Thách",
      mod_member: "Mod Thành Viên",
      member: "Thành Viên",
    };
    return labels[role] || role;
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage(null);

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.full_name,
          role: formData.role,
          phoneNumber: formData.phone_number,
          dob: formData.dob,
          deviceName: formData.device_name,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setFormMessage(body.error || "Tạo tài khoản thất bại");
      } else {
        setFormMessage("✓ Tài khoản đã được tạo thành công!");
        setFormData({ email: "", password: "", full_name: "", role: "member", phone_number: "", dob: "", device_name: "" });
        setTimeout(() => {
          setShowAddForm(false);
          setFormMessage(null);
          fetchMembers();
        }, 1500);
      }
    } catch (err: any) {
      setFormMessage(err?.message || "Lỗi khi tạo tài khoản");
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    
    setFormLoading(true);
    setFormMessage(null);

    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone_number: formData.phone_number || null,
          dob: formData.dob || null,
          device_name: formData.device_name || null,
          role: formData.role,
        })
        .eq("id", editingMember.id);

      if (profileError) throw profileError;

      // Update auth metadata via API
      const res = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingMember.id,
          role: formData.role,
          fullName: formData.full_name,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Cập nhật auth thất bại");
      }

      setFormMessage("✓ Cập nhật thành công!");
      setTimeout(() => {
        setShowEditForm(false);
        setEditingMember(null);
        setFormMessage(null);
        fetchMembers();
      }, 1500);
    } catch (err: any) {
      setFormMessage(err?.message || "Lỗi khi cập nhật");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm("Bạn có chắc muốn đánh dấu thành viên này đã rời CLB?")) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_active: false,
          leave_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", memberId);

      if (error) throw error;

      alert("✓ Đã đánh dấu thành viên rời CLB");
      fetchMembers();
    } catch (err: any) {
      alert("Lỗi: " + (err?.message || "Không thể cập nhật"));
    }
  };

  const openEditForm = (member: Member) => {
    setEditingMember(member);
    setFormData({
      email: member.email,
      password: "",
      full_name: member.full_name,
      role: member.role,
      phone_number: member.phone_number || "",
      dob: member.dob || "",
      device_name: member.device_name || "",
    });
    setShowEditForm(true);
    setFormMessage(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">👥 Quản Lý Thành Viên</h1>
            <Link href="/admin" className="text-blue-100 hover:text-white">
              ← Quay lại
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Add Member Button */}
        <div className="mb-6">
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowEditForm(false);
              setFormMessage(null);
            }}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 shadow-md transition flex items-center gap-2"
          >
            <UserPlus size={20} />
            {showAddForm ? "Đóng Form" : "Thêm Thành Viên Mới"}
          </button>
        </div>

        {/* Add Member Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Tạo Tài Khoản Thành Viên Mới</h2>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="example@gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Họ và Tên <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mật khẩu <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Tối thiểu 6 ký tự"
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vai trò
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="member">Thành Viên</option>
                    <option value="mod_finance">Mod Tài Chính</option>
                    <option value="mod_challenge">Mod Thử Thách</option>
                    <option value="mod_member">Mod Thành Viên</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="0912345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thiết bị</label>
                  <input
                    type="text"
                    value={formData.device_name}
                    onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Garmin Forerunner"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-md"
                >
                  {formLoading ? "Đang tạo..." : "Tạo Tài Khoản"}
                </button>
                {formMessage && (
                  <div
                    className={`text-sm px-4 py-2 rounded-lg ${
                      formMessage.includes("✓")
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {formMessage}
                  </div>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Edit Member Form */}
        {showEditForm && editingMember && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-2 border-orange-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Chỉnh Sửa Thành Viên</h2>
              <button onClick={() => setShowEditForm(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleEditMember} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email (không thể đổi)</label>
                  <input
                    type="email"
                    disabled
                    value={formData.email}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-100 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Họ và Tên <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="member">Thành Viên</option>
                    <option value="mod_finance">Mod Tài Chính</option>
                    <option value="mod_challenge">Mod Thử Thách</option>
                    <option value="mod_member">Mod Thành Viên</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thiết bị</label>
                <input
                  type="text"
                  value={formData.device_name}
                  onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-md flex items-center gap-2"
                >
                  <Save size={16} />
                  {formLoading ? "Đang lưu..." : "Lưu Thay Đổi"}
                </button>
                {formMessage && (
                  <div
                    className={`text-sm px-4 py-2 rounded-lg ${
                      formMessage.includes("✓")
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {formMessage}
                  </div>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Members Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Search Bar */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Tìm theo Email:</label>
              <input
                type="text"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Nhập email để tìm kiếm..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              {searchEmail && (
                <button
                  onClick={() => setSearchEmail("")}
                  className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg"
                >
                  Xóa
                </button>
              )}
              <span className="text-sm text-gray-600">
                {filteredMembers.length} / {members.length} thành viên
              </span>
            </div>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Đang tải...</p>
            </div>
          ) : filteredMembers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Tên</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Email</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">SĐT</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Ngày sinh</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Thiết bị</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Vai Trò</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Gia Nhập</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Rời CLB</th>
                    <th className="text-center py-3 px-4 font-bold text-gray-700">Trạng Thái</th>
                    <th className="text-center py-3 px-4 font-bold text-gray-700">Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className={`border-b border-gray-200 hover:bg-gray-50 ${!member.is_active ? 'bg-red-50' : ''}`}>
                      <td className="py-3 px-4 font-semibold">{member.full_name}</td>
                      <td className="py-3 px-4">{member.email}</td>
                      <td className="py-3 px-4">{member.phone_number || 'N/A'}</td>
                      <td className="py-3 px-4">{formatDate(member.dob)}</td>
                      <td className="py-3 px-4">{member.device_name || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                            member.role.includes("admin")
                              ? "bg-red-100 text-red-800"
                              : member.role.includes("mod")
                              ? "bg-orange-100 text-orange-800"
                              : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          {getRoleLabel(member.role)}
                        </span>
                      </td>
                      <td className="py-3 px-4">{formatDate(member.join_date)}</td>
                      <td className="py-3 px-4">{formatDate(member.leave_date)}</td>
                      <td className="py-3 px-4 text-center">
                        {member.is_active ? (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            ✓ Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            ✕ Đã rời
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => openEditForm(member)}
                            className="text-orange-600 hover:text-orange-800 font-semibold flex items-center gap-1"
                            title="Sửa thông tin"
                          >
                            <Edit size={16} />
                            Sửa
                          </button>
                          {member.is_active && (
                            <button 
                              onClick={() => handleDeleteMember(member.id)}
                              className="text-red-600 hover:text-red-800 font-semibold flex items-center gap-1"
                              title="Đánh dấu rời CLB"
                            >
                              <Trash2 size={16} />
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">
                {searchEmail ? "Không tìm thấy thành viên nào khớp với email" : "Không có thành viên nào"}
              </p>
            </div>
          )}
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-600">
            💡 Tổng: <span className="font-bold">{members.length}</span> thành viên 
            ({members.filter(m => m.is_active).length} đang hoạt động)
          </p>
        </div>
      </div>
    </div>
  );
}
