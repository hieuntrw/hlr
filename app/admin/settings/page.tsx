"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";

interface SystemSetting {
  key: string;
  value: string;
  description: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  useEffect(() => {
    checkRole();
    fetchSettings();
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

    if (profile?.role !== "admin") {
      router.push("/");
    }
  }

  async function fetchSettings() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value, description");

      if (error) {
        console.error("Error:", error);
        return;
      }

      setSettings(data || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(key: string) {
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({ value: editingValue })
        .eq("key", key);

      if (error) {
        console.error("Error:", error);
        alert("Lỗi khi lưu cài đặt");
        return;
      }

      alert("Đã lưu cài đặt!");
      setEditingKey(null);
      fetchSettings();
    } catch (err) {
      console.error("Error:", err);
      alert("Có lỗi xảy ra");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">⚙️ Cài Đặt Hệ Thống</h1>
            <Link href="/admin" className="text-blue-100 hover:text-white">
              ← Quay lại
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-600 mb-6">
          🔐 <strong>Super Admin Only:</strong> Cấu hình các giá trị toàn hệ thống
        </p>

        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Đang tải...</p>
            </div>
          ) : settings.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Khóa</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Mô Tả</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Giá Trị</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((setting) => (
                  <tr key={setting.key} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-blue-600">{setting.key}</td>
                    <td className="py-3 px-4 text-gray-700">{setting.description}</td>
                    <td className="py-3 px-4">
                      {editingKey === setting.key ? (
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1"
                        />
                      ) : (
                        <span className="font-bold text-gray-900">{setting.value}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {editingKey === setting.key ? (
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleSave(setting.key)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition-colors"
                          >
                            ✓ Lưu
                          </button>
                          <button
                            onClick={() => setEditingKey(null)}
                            className="px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white text-xs font-semibold rounded transition-colors"
                          >
                            ✕ Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingKey(setting.key);
                            setEditingValue(setting.value);
                          }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors"
                        >
                          ✏️ Sửa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">Không có cài đặt nào</p>
            </div>
          )}
        </div>

        <div className="mt-8 bg-blue-50 rounded-lg p-6 border-l-4 border-blue-500">
          <h3 className="font-bold text-blue-900 mb-2">📌 Cài Đặt Hiện Có</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>monthly_fund_fee:</strong> Mức đóng quỹ hàng tháng (VND)</li>
            <li>• <strong>challenge_fine_fee:</strong> Mức phạt không hoàn thành thử thách (VND)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
