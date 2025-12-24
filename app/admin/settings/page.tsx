"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole, isAdminRole } from "@/lib/auth/role";
// Create opening balance via server API

interface SystemSetting {
  key: string;
  value: string;
  description: string;
}

export default function SettingsPage() {
  const { user, isLoading: authLoading, sessionChecked } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const checkRole = useCallback(async function checkRole() {
    if (!user) {
      router.push("/debug-login");
      return;
    }
    const role = getEffectiveRole(user);
    if (!isAdminRole(role || '')) {
      router.push("/");
      return;
    }

    fetchSettings();
  }, [user, router]);

  useEffect(() => {
    if (authLoading || !sessionChecked) return;
    checkRole();
  }, [authLoading, sessionChecked, checkRole]);

  async function fetchSettings() {
    setLoading(true);
    setLoadError(null);

    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${base}/api/admin/settings`, { credentials: 'same-origin' });
      if (!res.ok) {
        const txt = await res.text();
        console.error('Failed to load settings', txt);
        setLoadError(`Failed to load settings: ${res.status} ${res.statusText} - ${txt}`);
        return;
      }
      const json = await res.json();
      setSettings(json.settings || []);
    } catch (err) {
      console.error('Error:', err);
      setLoadError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(key: string) {
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${base}/api/admin/settings`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: editingValue }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error('Save failed', txt);
        alert(`Lỗi khi lưu cài đặt: ${res.status} ${res.statusText} - ${txt}`);
        return;
      }

      alert('Đã lưu cài đặt!');
      setEditingKey(null);
      fetchSettings();
    } catch (err) {
      console.error('Error:', err);
      alert('Có lỗi xảy ra');
    }
  }

  // Year settlement (create opening balance)
  const currentYear = new Date().getFullYear();
  const [settleYear, setSettleYear] = useState<number>(currentYear - 1);
  const [settling, setSettling] = useState(false);
  const [settleMessage, setSettleMessage] = useState<string | null>(null);

  async function handleSettle() {
    if (!confirm(`Xác nhận quyết toán số dư cuối năm ${settleYear} thành đầu kỳ ${settleYear + 1}?`)) return;
    setSettling(true);
    setSettleMessage(null);
    try {
      const res = await fetch('/api/finance/totals', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prev_year: settleYear }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        console.error('Quyết toán thất bại', res.status, json);
        setSettleMessage(`Lỗi khi quyết toán: ${res.status}`);
      } else {
        setSettleMessage(`Đã quyết toán thành công số dư ${settleYear} → đầu kỳ ${settleYear + 1}`);
        fetchSettings();
      }
    } catch (err) {
      console.error('Quyết toán thất bại', err);
      setSettleMessage(String(err) || 'Lỗi khi quyết toán');
    } finally {
      setSettling(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="py-6 px-4 gradient-theme-primary">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-inverse)" }}>⚙️ Cài Đặt Hệ Thống</h1>
            <Link href="/admin" className="hover:opacity-80" style={{ color: "var(--color-text-inverse)" }}>
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
          {loadError && (
            <div className="p-4 bg-red-50 text-red-800 border border-red-100">{loadError}</div>
          )}
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
                    <td className="py-3 px-4 font-mono" style={{ color: "var(--color-primary)" }}>{setting.key}</td>
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
                            className="px-3 py-1 text-white text-xs font-semibold rounded transition-colors"
                            style={{ background: 'var(--color-primary)' }}
                          >
                            ✓ Lưu
                          </button>
                          <button
                            onClick={() => setEditingKey(null)}
                            className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-xs font-semibold rounded transition-colors"
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
                          className="px-3 py-1 text-white text-xs font-semibold rounded transition-colors"
                          style={{ background: 'var(--color-primary)' }}
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

        

        <div className="mt-8 rounded-lg p-6 border-l-4" style={{ background: "var(--color-info-bg, #FEF3C7)", borderColor: "var(--color-primary)" }}>
          <h3 className="font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>📌 Cài Đặt Hiện Có</h3>
          <ul className="text-sm space-y-1" style={{ color: "var(--color-text-secondary)" }}>
            <li>• <strong>monthly_fund_fee:</strong> Mức đóng quỹ hàng tháng (VND)</li>
            <li>• <strong>challenge_fine_fee:</strong> Mức phạt không hoàn thành thử thách (VND)</li>
            <li>• <strong>challenge_registration_levels:</strong> Danh sách mốc (km) khả dụng khi đăng ký thử tháchphân tách bằng dấu phẩy. Ví dụ: 70,100,150,200. Các mốc này sẽ được hiển thị cho người dùng khi họ đăng ký thử thách và được chuẩn hóa (loại bỏ trùng lặp và sắp xếp tăng dần) khi lưu.</li>
          </ul>
        </div>


        {/* Year settlement card: quyết toán tài chính cuối năm */}
        <div className="mt-6 rounded-lg shadow-md p-6 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>Quyết Toán Tài Chính Cuối Năm</h3>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Đưa số dư cuối năm thành đầu kỳ năm sau.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Chọn năm để quyết toán:</label>
            <select
              value={settleYear}
              onChange={(e) => setSettleYear(Number(e.target.value))}
              className="border rounded px-2 py-1"
            >
              <option value={currentYear - 1}>{currentYear - 1} (Năm vừa qua)</option>
              <option value={currentYear}>{currentYear} (Năm hiện tại)</option>
            </select>

            <button
              onClick={handleSettle}
              disabled={settling}
              className="ml-auto px-4 py-2 text-white font-semibold rounded"
              style={{ background: 'var(--color-primary)' }}
            >
              {settling ? 'Đang xử lý...' : 'Quyết toán'}
            </button>
          </div>

          {settleMessage && (
            <div className="mt-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>{settleMessage}</div>
          )}
        </div>

      </div>
    </div>
  );
}

// RegistrationLevelsEditor removed — managed via the main settings table and the admin API.
