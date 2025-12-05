"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth/AuthContext";

export default function EditChallengePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = (params && params.id) || "";

  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<any>({
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

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/debug-login");
      return;
    }
    if (!id) return;
    fetchChallenge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, id]);

  async function fetchChallenge() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", id)
        .maybeSingle();
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
          description: formData.description,
          require_map: !!formData.require_map,
        }),
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) {
        console.error('Update error:', json);
        alert(json.error || 'Lỗi khi cập nhật thử thách');
        return;
      }
      alert('Cập nhật thành công');
      router.push('/admin/challenges');
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra');
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Sửa Thử Thách</h1>
        {loading ? (
          <p>Đang tải...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tên</label>
              <input className="w-full border rounded px-3 py-2" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày bắt đầu</label>
                <input type="date" className="w-full border rounded px-3 py-2" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày kết thúc</label>
                <input type="date" className="w-full border rounded px-3 py-2" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Hạn đăng ký</label>
                <input type="date" className="w-full border rounded px-3 py-2" value={formData.registration_deadline} onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả</label>
              <textarea className="w-full border rounded px-3 py-2 h-32" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>

            <div className="flex gap-3">
              <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Lưu</button>
              <button type="button" className="bg-gray-200 px-4 py-2 rounded" onClick={() => router.push('/admin/challenges')}>Hủy</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
