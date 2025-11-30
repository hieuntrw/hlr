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
