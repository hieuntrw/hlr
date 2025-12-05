"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth/AuthContext";

interface FormState {
  title: string;
  start_date: string;
  end_date: string;
  registration_deadline: string;
  min_km: string;
  min_pace_seconds: string;
  max_pace_seconds: string;
  description: string;
  require_map: boolean;
}

export default function EditChallengePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = (params && params.id) || "";

  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<FormState>({
    title: "",
    start_date: "",
    end_date: "",
    registration_deadline: "",
    min_km: "1",
    min_pace_seconds: "240",
    max_pace_seconds: "720",
    description: "",
    require_map: true,
  });

  const [lastGeneratedPreview, setLastGeneratedPreview] = useState("");
  const [registrationOptions, setRegistrationOptions] = useState<number[]>([70, 100, 150, 200, 250, 300]);

  function formatSeconds(sec: number) {
    if (!sec || isNaN(sec)) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function adjustPace(which: "min" | "max", delta: number) {
    const key = which === "min" ? "min_pace_seconds" : "max_pace_seconds";
    const cur = Number((formData as any)[key]) || 0;
    let next = cur + delta;
    next = Math.max(180, Math.min(900, next));
    setFormData((prev) => ({ ...prev, [key]: String(next) } as FormState));
  }

  function formatDateInput(dateStr: string | undefined | null, shortMonth = false) {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      if (!shortMonth) return `${dd}/${mm}/${yyyy}`;
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mmm = months[d.getMonth()] || mm;
      return `${dd}/${mmm}/${yyyy}`;
    } catch (e) {
      return "-";
    }
  }

  // Auto-fill description from rules/preview unless admin has edited the description manually.
  useEffect(() => {
    const previewText = `Ngày bắt đầu: ${formatDateInput(formData.start_date)}\nNgày kết thúc: ${formatDateInput(formData.end_date)}\nHạn đăng ký: ${formatDateInput(formData.registration_deadline, true)}\nKm tối thiểu: ${formData.min_km || '1'} km\nPace trung bình tối thiểu: ${formatSeconds(Number(formData.min_pace_seconds))}\nPace trung bình tối đa: ${formatSeconds(Number(formData.max_pace_seconds))}\nYêu cầu chạy ngoài trời: ${formData.require_map ? 'yes' : 'no'} (gps)`;

    if (!formData.description || formData.description === lastGeneratedPreview) {
      setFormData((prev) => ({ ...prev, description: previewText }));
      setLastGeneratedPreview(previewText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.start_date, formData.end_date, formData.registration_deadline, formData.min_km, formData.min_pace_seconds, formData.max_pace_seconds, formData.require_map]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/debug-login");
      return;
    }
    if (!id) return;
    fetchChallenge();
    fetchRegistrationOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, id]);

  async function fetchRegistrationOptions() {
    try {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "challenge_registration_levels").maybeSingle();
      if (data && data.value) {
        const arr = String(data.value).split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n));
        if (arr.length > 0) setRegistrationOptions(arr);
      }
    } catch (e) {
      console.warn("[Challenges] could not load registration options:", e);
    }
  }

  async function fetchChallenge() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
      if (error) {
        console.error("Fetch challenge error:", error);
        return;
      }
      if (data) {
        setFormData({
          title: data.title || "",
          start_date: data.start_date ? data.start_date.split("T")[0] : "",
          end_date: data.end_date ? data.end_date.split("T")[0] : "",
          registration_deadline: data.registration_deadline ? data.registration_deadline.split("T")[0] : "",
          min_km: data.min_km != null ? String(data.min_km) : "1",
          min_pace_seconds: data.min_pace_seconds != null ? String(data.min_pace_seconds) : "240",
          max_pace_seconds: data.max_pace_seconds != null ? String(data.max_pace_seconds) : "720",
          description: data.description || "",
          require_map: data.require_map ?? true,
        });
      }
    } catch (err) {
      console.error(err);
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
      const res = await fetch(`/api/admin/challenges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          start_date: formData.start_date,
          end_date: formData.end_date,
          registration_deadline: formData.registration_deadline || null,
          min_km: Number(formData.min_km || 1),
          min_pace_seconds: Number(formData.min_pace_seconds || 240),
          max_pace_seconds: Number(formData.max_pace_seconds || 720),
          description: formData.description || undefined,
          require_map: !!formData.require_map,
        }),
        credentials: "same-origin",
      });

      const json = await res.json();
      if (!res.ok) {
        console.error("Update error:", json);
        alert(json.error || "Lỗi khi cập nhật thử thách");
        return;
      }

      alert("Cập nhật thử thách thành công!");
      router.push("/admin/challenges");
    } catch (err) {
      console.error("Error:", err);
      alert("Có lỗi xảy ra");
    }
  }

  if (!id) {
    return (
      <div className="p-8">
        <p>Không tìm thấy ID thử thách.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-6 px-4 gradient-theme-primary">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-inverse)" }}>✏️ Sửa Thử Thách</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          {loading ? (
            <p>Đang tải...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tên Thử Thách</label>
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
                      <button type="button" onClick={() => adjustPace("min", -60)} className="px-3 py-1 bg-gray-200 rounded">-1m</button>
                      <button type="button" onClick={() => adjustPace("min", -15)} className="px-2 py-1 bg-gray-100 rounded">-15s</button>
                      <div className="px-3 text-sm font-mono">{formatSeconds(Number(formData.min_pace_seconds))}</div>
                      <button type="button" onClick={() => adjustPace("min", 15)} className="px-2 py-1 bg-gray-100 rounded">+15s</button>
                      <button type="button" onClick={() => adjustPace("min", 60)} className="px-3 py-1 bg-gray-200 rounded">+1m</button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Min mặc định: 4:00, Giá trị hợp lệ 3:00 - 15:00</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tốc độ trung bình tối đa (phút/km)</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => adjustPace("max", -60)} className="px-3 py-1 bg-gray-200 rounded">-1m</button>
                      <button type="button" onClick={() => adjustPace("max", -15)} className="px-2 py-1 bg-gray-100 rounded">-15s</button>
                      <div className="px-3 text-sm font-mono">{formatSeconds(Number(formData.max_pace_seconds))}</div>
                      <button type="button" onClick={() => adjustPace("max", 15)} className="px-2 py-1 bg-gray-100 rounded">+15s</button>
                      <button type="button" onClick={() => adjustPace("max", 60)} className="px-3 py-1 bg-gray-200 rounded">+1m</button>
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
                  Lưu
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/admin/challenges')}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold px-4 py-2 rounded transition-colors"
                >
                  Hủy
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
