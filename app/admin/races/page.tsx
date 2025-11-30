"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";
import { Calendar, MapPin, Image as ImageIcon, Plus, Trophy, Loader2, Upload, CheckCircle } from "lucide-react";

interface Race {
  id: string;
  name: string;
  race_date: string;
  location?: string;
  image_url?: string;
}

export default function AdminRacesPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", race_date: "", location: "", image_url: "" });
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchRaces();
  }, []);

  async function fetchRaces() {
    setLoading(true);
    const { data, error } = await supabase
      .from("races")
      .select("id, name, race_date, location, image_url")
      .order("race_date", { ascending: false });
    if (!error && data) setRaces(data as Race[]);
    setLoading(false);
  }

  function canSave(): boolean {
    return !!form.name && !!form.race_date && !!form.location;
  }

  async function handleCreateRace(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave()) return;
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        name: form.name.trim(),
        race_date: form.race_date,
        location: form.location.trim(),
      };
      if (form.image_url) payload.image_url = form.image_url.trim();
      const { error } = await supabase.from("races").insert(payload);
      if (error) throw error;
      setForm({ name: "", race_date: "", location: "", image_url: "" });
      await fetchRaces();
    } catch (err: any) {
      console.error("Create race failed:", err);
      setError(err.message || "Không thể tạo sự kiện");
    } finally {
      setSaving(false);
    }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const bucket = "race-banners";
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      if (pub?.publicUrl) {
        setForm((prev) => ({ ...prev, image_url: pub.publicUrl }));
        setUploadMsg("Đã tải banner lên thành công.");
      } else {
        setUploadMsg("Không thể lấy URL công khai, vui lòng nhập thủ công.");
      }
    } catch (err: any) {
      console.error("Banner upload failed:", err);
      setUploadMsg(err.message || "Tải banner thất bại. Hãy kiểm tra quyền Storage/bucket.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3">
          <Trophy size={28} className="text-yellow-500" />
          <h1 className="text-2xl font-bold text-gray-900">Quản Lý Giải Chạy</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Race */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Tạo Sự Kiện Mới</h2>
            <form className="space-y-4" onSubmit={handleCreateRace}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên giải</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: HCMC Marathon 2026"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày tổ chức</label>
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-gray-500" />
                  <input
                    type="date"
                    className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.race_date}
                    onChange={(e) => setForm({ ...form, race_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa điểm</label>
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-gray-500" />
                  <input
                    type="text"
                    className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="VD: TP. Hồ Chí Minh"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ảnh banner (URL)</label>
                <div className="flex items-center gap-2">
                  <ImageIcon size={18} className="text-gray-500" />
                  <input
                    type="url"
                    className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hoặc tải ảnh lên</label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <Upload size={16} /> Chọn tệp
                      <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                    </label>
                    {uploading && <Loader2 className="animate-spin text-gray-500" size={18} />}
                    {uploadMsg && (
                      <span className="text-sm flex items-center gap-1 text-green-700">
                        <CheckCircle size={14} /> {uploadMsg}
                      </span>
                    )}
                  </div>
                  {form.image_url && (
                    <div className="mt-3">
                      <img src={form.image_url} alt="Race banner preview" className="w-full max-h-40 object-cover rounded" />
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={!canSave() || saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                Tạo Sự Kiện
              </button>
            </form>
          </div>
        </div>

        {/* Race List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Danh Sách Sự Kiện</h2>
            {loading ? (
              <p className="text-gray-600">Đang tải...</p>
            ) : races.length === 0 ? (
              <p className="text-gray-600">Chưa có sự kiện nào.</p>
            ) : (
              <div className="space-y-3">
                {races.map((race) => (
                  <Link key={race.id} href={`/admin/races/${race.id}`} className="block">
                    <div className="p-4 rounded-lg border hover:shadow-md transition flex items-center gap-4">
                      {race.image_url ? (
                        <img
                          src={race.image_url}
                          alt={race.name}
                          className="w-20 h-14 rounded object-cover border"
                        />
                      ) : (
                        <div className="w-20 h-14 rounded bg-gray-100 border flex items-center justify-center text-gray-500 text-xs">
                          No Banner
                        </div>
                      )}
                      <div className="flex-1 flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{race.name}</h3>
                          <p className="text-sm text-gray-600">
                            {new Date(race.race_date).toLocaleDateString("vi-VN")} • {race.location}
                          </p>
                        </div>
                        <span className="text-blue-600 text-sm font-semibold">Quản lý →</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
