"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";

interface Member {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  join_date: string;
}

function formatDate(dateStr: string): string {
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
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "member",
  });
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    checkRole();
    fetchMembers();
  }, []);

  async function checkRole() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/debug-login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile?.role || !["admin", "mod_member"].includes(profile.role)) {
      router.push("/");
    }
  }

  async function fetchMembers() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active, join_date")
        .order("join_date", { ascending: false });

      if (error) {
        console.error("Error:", error);
        return;
      }

      setMembers(data || []);
    } catch (err) {
      console.error("Error:", err);
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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const body = await res.json();

      if (!res.ok) {
        setFormMessage(body.error || "Tạo tài khoản thất bại");
      } else {
        setFormMessage("✓ Tài khoản đã được tạo thành công!");
        setFormData({ email: "", password: "", full_name: "", role: "member" });
        setTimeout(() => {
          setShowAddForm(false);
          fetchMembers();
        }, 1500);
      }
    } catch (err: any) {
      setFormMessage(err?.message || "Lỗi khi tạo tài khoản");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">👥 Thêm/Sửa Thành Viên</h1>
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
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 shadow-md transition"
          >
            {showAddForm ? "✕ Đóng Form" : "+ Thêm Thành Viên Mới"}
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="member">Thành Viên</option>
                    <option value="mod_finance">Mod Tài Chính</option>
                    <option value="mod_challenge">Mod Thử Thách</option>
                    <option value="mod_member">Mod Thành Viên</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-md"
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

        {/* Members Table */}
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Đang tải...</p>
            </div>
          ) : members.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Tên</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Vai Trò</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Gia Nhập</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Trạng Thái</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 font-semibold">{member.full_name}</td>
                    <td className="py-3 px-4">{member.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                          member.role.includes("admin")
                            ? "bg-red-100 text-red-800"
                            : member.role.includes("mod")
                            ? "bg-orange-100 text-orange-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {getRoleLabel(member.role)}
                      </span>
                    </td>
                    <td className="py-3 px-4">{formatDate(member.join_date)}</td>
                    <td className="py-3 px-4 text-center">
                      {member.is_active ? (
                        <span className="text-green-600 font-semibold">✓ Hoạt động</span>
                      ) : (
                        <span className="text-red-600 font-semibold">✕ Không hoạt động</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button className="text-blue-600 hover:text-blue-800 font-semibold">
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">Không có thành viên nào</p>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-600 mt-4">
          💡 Tổng cộng: <span className="font-bold">{members.length}</span> thành viên
        </p>
      </div>
    </div>
  );
}
