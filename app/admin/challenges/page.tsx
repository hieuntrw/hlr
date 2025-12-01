"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";

interface Challenge {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  is_locked: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ChallengesAdminPage() {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    checkRole();
    fetchChallenges();
  }, []);

  async function checkRole() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log('[Challenges Page] Checking role for user:', user?.email, 'Role:', user?.user_metadata?.role);

    if (!user) {
      router.push("/debug-login");
      return;
    }

    // Get role from Auth metadata
    const userRole = user.user_metadata?.role;

    if (!userRole || !["admin", "mod_challenge"].includes(userRole)) {
      console.log('[Challenges Page] Unauthorized role:', userRole);
      router.push("/");
    } else {
      console.log('[Challenges Page] Role authorized:', userRole);
    }
  }

  async function fetchChallenges() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("challenges")
        .select("id, title, start_date, end_date, status, is_locked")
        .order("start_date", { ascending: false });

      if (error) {
        console.error("Error:", error);
        return;
      }

      setChallenges(data || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.title || !formData.start_date || !formData.end_date) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      const { error } = await supabase.from("challenges").insert({
        title: formData.title,
        start_date: formData.start_date,
        end_date: formData.end_date,
        password: Math.random().toString(36).substring(7),
      });

      if (error) {
        console.error("Error:", error);
        alert("Lỗi khi tạo thử thách");
        return;
      }

      alert("Tạo thử thách thành công!");
      setFormData({ title: "", start_date: "", end_date: "" });
      setShowForm(false);
      fetchChallenges();
    } catch (err) {
      console.error("Error:", err);
      alert("Có lỗi xảy ra");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">🏃 Tạo/Sửa Thử Thách</h1>
            <Link href="/admin" className="text-blue-100 hover:text-white">
              ← Quay lại
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Create Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {showForm ? "✕ Đóng Form" : "➕ Tạo Thử Thách Mới"}
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4">Tạo Thử Thách Mới</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tên Thử Thách
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="VD: Tháng 12 - 300km Challenge"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ngày Bắt Đầu
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ngày Kết Thúc
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition-colors"
                >
                  Tạo Thử Thách
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold py-2 rounded-lg transition-colors"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Challenges List */}
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Đang tải...</p>
            </div>
          ) : challenges.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Tên Thử Thách</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Ngày Bắt Đầu</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Ngày Kết Thúc</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Trạng Thái</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Khóa</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {challenges.map((challenge) => (
                  <tr key={challenge.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 font-semibold">{challenge.title}</td>
                    <td className="py-3 px-4">{formatDate(challenge.start_date)}</td>
                    <td className="py-3 px-4">{formatDate(challenge.end_date)}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                          challenge.status === "Open"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {challenge.status === "Open" ? "🟢 Mở" : "🔴 Đóng"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {challenge.is_locked ? (
                        <span className="text-lg">🔒</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/challenges/${challenge.id}`}
                        className="text-orange-600 hover:text-orange-800 font-semibold"
                      >
                        Xem
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">Không có thử thách nào</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
