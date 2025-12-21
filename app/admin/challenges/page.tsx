"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole, isAdminRole } from "@/lib/auth/role";

interface Challenge {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  created_by?: string | null;
  profiles?: { full_name?: string | null } | null;
  status: string;
  is_locked: boolean;
  is_hide?: boolean;
  registration_deadline?: string | null;
  challenge_participants?: { id: string }[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function renderRegistrationBadge(dateStr?: string | null) {
  if (!dateStr) return '-';
  try {
    const rd = new Date(dateStr);
    const now = new Date();
    const isPast = rd.getTime() < now.getTime();
    const diffDays = Math.ceil((rd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    let cls = 'inline-flex px-2 py-1 rounded text-sm font-semibold ';
    if (isPast) cls += 'bg-red-100 text-red-800';
    else if (diffDays <= 3) cls += 'bg-yellow-100 text-yellow-800';
    else cls += 'bg-blue-100 text-blue-800';
    return <span className={cls}>{formatDate(dateStr)}</span>;
  } catch {
    return '-';
  }
}

export default function ChallengesAdminPage() {
  const { user, isLoading: authLoading, sessionChecked } = useAuth();
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    start_date: "",
    end_date: "",
    registration_deadline: "",
    min_km: "1",
    min_pace_seconds: "240",
    max_pace_seconds: "780",
    description: "",
    require_map: true,
  });
  const [lastGeneratedPreview, setLastGeneratedPreview] = useState("");
  // registration options were previously loaded from system settings but not used in UI

  const resolvedRole = getEffectiveRole(user) || 'member';
  const isAdminResolved = isAdminRole(resolvedRole);

  // Helpers for pace display and adjustment
  function formatSeconds(sec: number) {
    if (!sec || isNaN(sec)) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Adjust pace (in seconds) for min or max controls
  function adjustPace(
    which: "min" | "max",
    delta: number
  ) {
    try {
      const key = which === "min" ? "min_pace_seconds" : "max_pace_seconds";
      const cur = Number((formData as Record<string, unknown>)[key]) || 0;
      let next = cur + delta;
      next = Math.max(180, Math.min(900, next));
      setFormData((prev) => ({ ...prev, [key]: String(next) }));
    } catch {
      // ignore
    }
  }

  function formatDateInput(dateStr: string | undefined | null, shortMonth = false) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      if (!shortMonth) return `${dd}/${mm}/${yyyy}`;
      // short month (English 3-letter)
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const mmm = months[d.getMonth()] || mm;
      return `${dd}/${mmm}/${yyyy}`;
    } catch {
      return '-';
    }
  }

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/challenges/list', { credentials: 'same-origin' });
      const json = await res.json();
      if (!res.ok) {
        console.error('Error fetching admin challenges list:', json);
        setChallenges([]);
        return;
      }

      // Trust backend shape; cast from unknown to Challenge[] to avoid `any` usage
      const list = (json.challenges || []) as unknown as Challenge[];
      setChallenges(list);
    } catch (err) {
      console.error('Error:', err);
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // checkRole must be declared before useEffect to avoid block-scoped usage errors
  const checkRole = useCallback(async () => {
    if (!user) {
      router.push('/debug-login');
      return;
    }

    const userRole = getEffectiveRole(user);
    if (!userRole || (!isAdminRole(userRole) && userRole !== 'mod_challenge')) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (authLoading || !sessionChecked) return;
    checkRole();
    fetchChallenges();
  }, [authLoading, sessionChecked, checkRole, fetchChallenges]);

  // Auto-fill description from rules/preview unless admin has edited the description manually.
  useEffect(() => {
    const previewText = `Ngày bắt đầu: ${formatDateInput(formData.start_date)}\nNgày kết thúc: ${formatDateInput(formData.end_date)}\nHạn đăng ký: ${formatDateInput(formData.registration_deadline, true)}\nKm tối thiểu: ${formData.min_km || '1'} km\nPace trung bình tối thiểu: ${formatSeconds(Number(formData.min_pace_seconds))}\nPace trung bình tối đa: ${formatSeconds(Number(formData.max_pace_seconds))}\nYêu cầu chạy ngoài trời: ${formData.require_map ? 'yes' : 'no'} (gps)`;

    // If description is empty or previously generated (not manually edited), update it.
    if (!formData.description || formData.description === lastGeneratedPreview) {
      setFormData((prev) => ({ ...prev, description: previewText }));
      setLastGeneratedPreview(previewText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.start_date, formData.end_date, formData.registration_deadline, formData.min_km, formData.min_pace_seconds, formData.max_pace_seconds, formData.require_map]);


  // removed: previous fetchChallenges implementation replaced by stable useCallback above

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.title || !formData.start_date || !formData.end_date) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      const res = await fetch('/api/admin/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            // store dates as YYYY-MM-DD for DB; note UX: start counted from 00:00 and end to 23:59
            start_date: formData.start_date,
            end_date: formData.end_date,
            registration_deadline: formData.registration_deadline || null,
            // send pace in seconds
            min_pace_seconds: Number(formData.min_pace_seconds || 240),
            max_pace_seconds: Number(formData.max_pace_seconds || 720),
              // send min_km as integer
              min_km: Number(formData.min_km || 1),
            description: formData.description || undefined,
            require_map: !!formData.require_map,
          }),
        credentials: 'same-origin',
      });

      const json = await res.json();
      if (!res.ok) {
        console.error('Create challenge error:', json);
        alert(json.error || 'Lỗi khi tạo thử thách');
        return;
      }

      alert('Tạo thử thách thành công!');
      setFormData({ title: '', start_date: '', end_date: '', registration_deadline: '', min_km: '1', min_pace_seconds: '240', max_pace_seconds: '720', description: '', require_map: true });
      setShowForm(false);
      fetchChallenges();
    } catch (err) {
      console.error('Error:', err);
      alert('Có lỗi xảy ra');
    }
  }

  async function handleLockToggle(challengeId: string, lock: boolean) {
    try {
      const res = await fetch(`/api/admin/challenges/${challengeId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lock }),
        credentials: 'same-origin',
      });

      const json = await res.json();
      if (!res.ok) {
        console.error('Lock toggle error:', json);
        alert(json.error || 'Lỗi khi cập nhật');
        return;
      }
      fetchChallenges();
    } catch (err) {
      console.error('Error:', err);
      alert('Có lỗi xảy ra');
    }
  }

  async function handleFinalize(challengeId: string) {
    if (!confirm('Bạn có chắc muốn tổng kết thử thách này? Hành động này sẽ đồng bộ hoạt động và đóng thử thách.')) return;
    try {
      const res = await fetch(`/api/admin/challenges/${challengeId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error('Finalize error:', json);
        alert(json.error || 'Lỗi khi tổng kết thử thách');
        return;
      }

      const completedCount = (json.completed || []).length;
      const finedCount = (json.fined || []).length;
      alert(`Tổng kết hoàn tất. Hoàn thành: ${completedCount}, Bị phạt: ${finedCount}`);
      fetchChallenges();
    } catch (err) {
      console.error('Error:', err);
      alert('Có lỗi xảy ra');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="py-6 px-4 gradient-theme-primary">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-inverse)" }}>🏃 Tạo/Sửa Thử Thách</h1>
            <Link href="/admin" className="hover:opacity-80" style={{ color: "var(--color-text-inverse)" }}>
              ← Quay lại
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Create Button (hidden when form open) */}
        <div className="mb-6">
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-white font-bold py-2 px-4 rounded-lg transition-colors"
              style={{ background: "var(--color-primary)" }}
            >
              ➕ Tạo Thử Thách Mới
            </button>
          )}
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
                  placeholder="VD: Tháng 12 - năm 2025 Challenge"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm text-gray-500">Ghi chú: Ngày bắt đầu được tính từ 00:00 và ngày kết thúc được tính đến 23:59 để bao phủ toàn bộ ngày.</div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày Bắt Đầu</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày Kết Thúc</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Hạn Đăng Ký</label>
                    <input
                      type="date"
                      value={formData.registration_deadline}
                      onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tốc độ trung bình tối thiểu (phút/km)</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => adjustPace('min', -60)} className="px-3 py-1 bg-gray-200 rounded">-1m</button>
                      <button type="button" onClick={() => adjustPace('min', -15)} className="px-2 py-1 bg-gray-100 rounded">-15s</button>
                      <div className="px-3 text-sm font-mono">{formatSeconds(Number(formData.min_pace_seconds))}</div>
                      <button type="button" onClick={() => adjustPace('min', 15)} className="px-2 py-1 bg-gray-100 rounded">+15s</button>
                      <button type="button" onClick={() => adjustPace('min', 60)} className="px-3 py-1 bg-gray-200 rounded">+1m</button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Min mặc định: 4:00, Giá trị hợp lệ 3:00 - 15:00</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tốc độ trung bình tối đa (phút/km)</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => adjustPace('max', -60)} className="px-3 py-1 bg-gray-200 rounded">-1m</button>
                      <button type="button" onClick={() => adjustPace('max', -15)} className="px-2 py-1 bg-gray-100 rounded">-15s</button>
                      <div className="px-3 text-sm font-mono">{formatSeconds(Number(formData.max_pace_seconds))}</div>
                      <button type="button" onClick={() => adjustPace('max', 15)} className="px-2 py-1 bg-gray-100 rounded">+15s</button>
                      <button type="button" onClick={() => adjustPace('max', 60)} className="px-3 py-1 bg-gray-200 rounded">+1m</button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Max mặc định: 13:00, Giá trị hợp lệ 3:00 - 15:00</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="flex items-center gap-3">
                    <input
                      id="require_map"
                      type="checkbox"
                      checked={!!formData.require_map}
                      onChange={(e) => setFormData({ ...formData, require_map: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <label htmlFor="require_map" className="text-sm font-medium text-gray-700">Yêu cầu chạy ngoài trời (GPS)</label>
                  </div>

                  <div className="w-40">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-gray-700">Km tối thiểu</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.min_km}
                        onChange={(e) => setFormData({ ...formData, min_km: e.target.value })}
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1"
                        aria-label="Km tối thiểu"
                      />
                    </div>
                   </div>
                </div>

                {/* Preview removed: description is auto-filled from rules above */}


                <div className="mt-3">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mô tả / Quy định</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 h-40"
                    placeholder="Mô tả ngắn về thử thách, quy định, yêu cầu..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded transition-colors"
                >
                  Tạo
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold px-4 py-2 rounded transition-colors"
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
                        <th className="text-left py-3 px-4 font-bold text-gray-700">Người Tạo</th>
                      <th className="text-center py-3 px-4 font-bold text-gray-700">Số Thành Viên</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Ngày Bắt Đầu</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Ngày Kết Thúc</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Hạn Đăng Ký</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Trạng Thái</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Khóa</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {challenges.map((challenge) => (
                  <tr key={challenge.id} className={`border-b border-gray-200 hover:bg-gray-50 ${challenge.is_hide ? 'opacity-60 bg-gray-50' : ''}`}>
                    <td className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <span>{challenge.title}</span>
                        {challenge.is_hide && (
                          <span className="inline-block text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">Ẩn</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{challenge.profiles?.full_name || challenge.created_by || '-'}</td>
                    <td className="py-3 px-4 text-center">{(challenge.challenge_participants?.length ?? 0)}</td>
                    <td className="py-3 px-4">{formatDate(challenge.start_date)}</td>
                    <td className="py-3 px-4">{formatDate(challenge.end_date)}</td>
                    <td className="py-3 px-4">{renderRegistrationBadge(challenge.registration_deadline)}</td>
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
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/challenges/${challenge.id}`}
                          className="font-semibold"
                          style={{ color: "var(--color-primary)" }}
                        >
                          Xem
                        </Link>
                        <Link
                          href={`/admin/challenges/${challenge.id}/edit`}
                          className="font-semibold"
                          style={{ color: "var(--color-primary)" }}
                        >
                          Sửa
                        </Link>
                        {/* Hide/Unhide button: admin-only. Hiding removes from public lists. */}
                        {isAdminResolved && (
                          <button
                            onClick={async () => {
                              const willHide = !Boolean(challenge.is_hide);
                              const confirmMsg = willHide ? 'Ẩn thử thách này khỏi danh sách công khai?' : 'Bỏ ẩn thử thách này?';
                              if (!confirm(confirmMsg)) return;
                              try {
                                // Use PATCH to set is_hide (admin-only in API)
                                const res = await fetch(`/api/admin/challenges/${challenge.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'same-origin',
                                  body: JSON.stringify({ is_hide: willHide }),
                                });
                                const json = await res.json();
                                if (!res.ok) {
                                  alert(json.error || 'Không thể cập nhật trạng thái ẩn');
                                  return;
                                }
                                alert(willHide ? 'Thử thách đã bị ẩn' : 'Thử thách đã được bỏ ẩn');
                                fetchChallenges();
                              } catch (err) {
                                console.error('Hide/unhide error', err);
                                alert('Lỗi khi cập nhật trạng thái ẩn');
                              }
                            }}
                            className="font-semibold text-red-600"
                          >
                            {challenge.is_hide ? 'Bỏ ẩn' : 'Ẩn'}
                          </button>
                        )}
                        <button
                          onClick={() => handleFinalize(challenge.id)}
                          disabled={!(new Date().getTime() >= (new Date(challenge.end_date).getTime() + 24 * 60 * 60 * 1000))}
                          className={`py-1 px-2 rounded-md text-sm ${new Date().getTime() >= (new Date(challenge.end_date).getTime() + 24 * 60 * 60 * 1000) ? 'bg-yellow-100' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                        >
                          Tổng kết
                        </button>
                        {isAdminResolved ? (
                          <button
                            onClick={() => handleLockToggle(challenge.id, !challenge.is_locked)}
                            className={`py-1 px-2 rounded-md text-sm ${challenge.is_locked ? 'bg-gray-100' : 'bg-indigo-600 text-white'}`}
                          >
                            {challenge.is_locked ? 'Mở Khóa' : 'Khóa'}
                          </button>
                        ) : (
                          new Date().getTime() >= new Date(challenge.end_date).getTime() && (
                            <button
                              onClick={() => handleLockToggle(challenge.id, !challenge.is_locked)}
                              disabled={challenge.status !== 'Closed' && !challenge.is_locked}
                              className={`py-1 px-2 rounded-md text-sm ${challenge.status === 'Closed' ? 'bg-gray-100' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                            >
                              {challenge.is_locked ? 'Mở Khóa' : 'Khóa'}
                            </button>
                          )
                        )}
                      </div>
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
