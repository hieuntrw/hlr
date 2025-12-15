"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
// Server APIs are used for protected operations; avoid client-side Supabase here.
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole, isAdminRole, isModRole } from "@/lib/auth/role";
import { Edit, Trash2 } from "lucide-react";

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
  gender: string | null;
  pb_hm_seconds: number | null;
  pb_fm_seconds: number | null;
  pb_hm_approved: boolean;
  pb_fm_approved: boolean;
  strava_id: string | null;
  strava_access_token: string | null;
  strava_refresh_token: string | null;
  strava_token_expires_at: string | null;
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

// Hiển thị dạng: "dd/mm/yyyy"
function formatDateSimple(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Chuyển từ yyyy-mm-dd sang dd/mm/yyyy để hiển thị trong input
function dateToDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [yyyy, mm, dd] = dateStr.split('-');
  if (!yyyy || !mm || !dd) return "";
  return `${dd}/${mm}/${yyyy}`;
}

// Chuyển từ dd/mm/yyyy sang yyyy-mm-dd để lưu vào DB
function displayToDate(displayStr: string): string {
  if (!displayStr) return "";
  const [dd, mm, yyyy] = displayStr.split('/');
  if (!dd || !mm || !yyyy) return "";
  return `${yyyy}-${mm}-${dd}`;
}

function formatTime(seconds: number | null): string {
  if (!seconds) return "Chưa có";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function timeToSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length !== 3) return null;
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const seconds = parseInt(parts[2]);
  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function maskToken(token: string | null): string {
  if (!token) return "Chưa kết nối";
  if (token.length <= 10) return "***" + token.slice(-4);
  return token.slice(0, 6) + "..." + token.slice(-4);
}

function formatTokenExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "N/A";
  const date = new Date(expiresAt);
  const now = new Date();
  const isExpired = date < now;
  const formatted = date.toLocaleString("vi-VN");
  return isExpired ? `❌ Hết hạn: ${formatted}` : `✅ Còn hạn: ${formatted}`;
}

export default function MembersAdminPage() {
  const { user, profile, isLoading: authLoading, sessionChecked } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    role: "member",
    phone_number: "",
    dob: "",
    gender: "",
    device_name: "",
    join_date: new Date().toISOString().split('T')[0],
    pb_hm_time: "", // Format: HH:MM:SS
    pb_fm_time: "", // Format: HH:MM:SS
    password: "",
  });
  const [joinDateDisplay, setJoinDateDisplay] = useState(dateToDisplay(new Date().toISOString().split('T')[0]));
  const [dobDisplay, setDobDisplay] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      console.log("[Members Page] Fetching members...");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let res: Response;
      try {
        res = await fetch('/api/admin/profiles', { signal: controller.signal, credentials: 'same-origin' });
      } finally {
        clearTimeout(timeout);
      }

      const bodyRaw = await res.json().catch(() => ({})) as unknown;
      if (!res.ok) {
        const bodyObj = bodyRaw as { error?: string };
        console.error('[Members Page] API error:', bodyObj?.error || res.statusText);
        setFetchError('Lỗi khi tải danh sách: ' + (bodyObj?.error || res.statusText));
        return;
      }

      const bodyObj = bodyRaw as { data?: unknown[] };
      const data = (bodyObj.data || []) as unknown as Member[];
      console.log('[Members Page] Loaded members (API):', data.length || 0);
      setMembers(data);
    } catch (err) {
      console.error('[Members Page] Exception:', err);
      const e = err as { name?: string; message?: string };
      if (e?.name === 'AbortError') {
        setFetchError('Yêu cầu bị hủy do thời gian chờ. Vui lòng thử lại.');
      } else {
        setFetchError('Lỗi: ' + String(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const checkRole = useCallback(async () => {
    if (!user) {
      router.push('/debug-login');
      return;
    }
    const role = getEffectiveRole(user, profile);
    if (!role || !["admin", "mod_member"].includes(role)) {
      router.push('/');
    }
  }, [user, profile, router]);

  useEffect(() => {
    if (authLoading || !sessionChecked) return;
    console.log('[Members Page] authLoading:', authLoading, 'user:', user?.id, 'profile:', profile?.id);
    checkRole();
    fetchMembers();
  }, [user, profile, authLoading, sessionChecked, checkRole, fetchMembers]);

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

  // Ensure we don't stay in a loading spinner forever — show retry UI after timeout
  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => {
      if (loading) {
        console.warn('[Members Page] loading exceeded timeout, showing retry UI');
        setFetchError('Yêu cầu quá lâu. Vui lòng thử lại.');
        setLoading(false);
      }
    }, 12000); // 12s
    return () => clearTimeout(id);
  }, [loading]);

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
      // Validate required fields
      if (!formData.email || !formData.password || !formData.full_name || !formData.gender) {
        setFormMessage("Vui lòng điền đầy đủ các trường bắt buộc");
        setFormLoading(false);
        return;
      }

      console.log("Sending create member request:", {
        email: formData.email,
        fullName: formData.full_name,
        role: formData.role,
        gender: formData.gender,
        joinDate: formData.join_date,
        dob: formData.dob,
        hasPassword: !!formData.password
      });

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.full_name,
          role: formData.role,
          phoneNumber: formData.phone_number,
          dob: formData.dob || null,
          gender: formData.gender,
          deviceName: formData.device_name,
          joinDate: formData.join_date || new Date().toISOString().split('T')[0],
          pbHmSeconds: timeToSeconds(formData.pb_hm_time),
          pbFmSeconds: timeToSeconds(formData.pb_fm_time),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setFormMessage(body.error || "Tạo tài khoản thất bại");
      } else {
        setFormMessage("✓ Tài khoản đã được tạo thành công!");
        setFormData({ email: "", password: "", full_name: "", role: "member", phone_number: "", dob: "", gender: "", device_name: "", join_date: new Date().toISOString().split('T')[0], pb_hm_time: "", pb_fm_time: "" });
        setJoinDateDisplay(dateToDisplay(new Date().toISOString().split('T')[0]));
        setDobDisplay("");
        setEditingMember(null);
        // Reload danh sách ngay lập tức
        fetchMembers();
        // Clear message sau 2s
        setTimeout(() => {
          setFormMessage(null);
        }, 2000);
      }
    } catch (err: unknown) {
      console.error("Create member error:", err);
      const e = err as { message?: string };
      setFormMessage("Lỗi kết nối: " + (e?.message || "Không thể kết nối đến server"));
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
      // Convert PB times to seconds
      const pbHmSeconds = timeToSeconds(formData.pb_hm_time);
      const pbFmSeconds = timeToSeconds(formData.pb_fm_time);

      // Update profiles via server-side API to respect RLS and avoid exposing keys
      const updRes = await fetch(`/api/admin/profiles/${editingMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          full_name: formData.full_name,
          phone_number: formData.phone_number || null,
          dob: formData.dob || null,
          gender: formData.gender || null,
          device_name: formData.device_name || null,
          join_date: formData.join_date || null,
          role: formData.role,
          pb_hm_seconds: pbHmSeconds,
          pb_fm_seconds: pbFmSeconds,
          pb_hm_approved: pbHmSeconds !== null,
          pb_fm_approved: pbFmSeconds !== null,
        }),
      });

      if (!updRes.ok) {
        const errBody = await updRes.json().catch(() => ({}));
        throw new Error(errBody.error || updRes.statusText || 'Failed to update profile');
      }

      // Update auth metadata via API
      const res = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'same-origin',
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
      // Reload danh sách ngay lập tức
      fetchMembers();
      // Reset form và clear message sau 2s
      setTimeout(() => {
        setEditingMember(null);
        setFormData({ email: "", password: "", full_name: "", role: "member", phone_number: "", dob: "", gender: "", device_name: "", join_date: new Date().toISOString().split('T')[0], pb_hm_time: "", pb_fm_time: "" });
        setJoinDateDisplay(dateToDisplay(new Date().toISOString().split('T')[0]));
        setDobDisplay("");
        setFormMessage(null);
      }, 2000);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFormMessage(e?.message || "Lỗi khi cập nhật");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm("Bạn có chắc muốn đánh dấu thành viên này đã rời CLB?")) return;

    try {
      // Use server API to mark member as left (soft-delete)
      const delRes = await fetch(`/api/admin/profiles/${memberId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!delRes.ok) {
        const errBody = await delRes.json().catch(() => ({}));
        alert('Lỗi: ' + (errBody.error || delRes.statusText || 'Không thể cập nhật'));
        return;
      }
      alert('✓ Đã đánh dấu thành viên rời CLB');
      fetchMembers();
    } catch (err: unknown) {
      const e = err as { message?: string };
      alert("Lỗi: " + (e?.message || "Không thể cập nhật"));
    }
  };

  const openEditForm = (member: Member) => {
    setEditingMember(member);
    const joinDate = member.join_date || new Date().toISOString().split('T')[0];
    const dob = member.dob || "";
    setFormData({
      email: member.email,
      password: "",
      full_name: member.full_name,
      role: member.role,
      phone_number: member.phone_number || "",
      dob: dob,
      gender: member.gender || "",
      device_name: member.device_name || "",
      join_date: joinDate,
      pb_hm_time: member.pb_hm_seconds ? formatTime(member.pb_hm_seconds) : "",
      pb_fm_time: member.pb_fm_seconds ? formatTime(member.pb_fm_seconds) : "",
    });
    setJoinDateDisplay(dateToDisplay(joinDate));
    setDobDisplay(dob ? dateToDisplay(dob) : "");
    setFormMessage(null);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="py-6 px-4 gradient-theme-primary">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-inverse)" }}>👥 Quản Lý Thành Viên</h1>
            <Link href="/admin" className="hover:opacity-80" style={{ color: "var(--color-text-inverse)" }}>
              ← Quay lại
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Member Form (Create/Edit) - Always Visible */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              {editingMember ? `✏️ Chỉnh Sửa: ${editingMember.full_name || editingMember.email}` : "➕ Thêm Thành Viên Mới"}
            </h2>
            <form onSubmit={editingMember ? handleEditMember : handleAddMember} className="space-y-4">
              {/* Row 1: Email + Password + Vai trò + Ngày gia nhập (4 cột) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    disabled={!!editingMember}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 ${editingMember ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    placeholder="example@gmail.com"
                  />
                </div>
                <div>
                  {!editingMember ? (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mật khẩu <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2"
                        placeholder="Ít nhất 6 ký tự"
                      />
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                      <div className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-500">
                        Chỉ nhập khi tạo mới
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2"
                  >
                    <option value="member">Thành Viên</option>
                    <option value="mod_finance">Mod Tài Chính</option>
                    <option value="mod_challenge">Mod Thử Thách</option>
                    <option value="mod_member">Mod Thành Viên</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày gia nhập</label>
                  <input
                    type="text"
                    value={joinDateDisplay}
                    onChange={(e) => {
                      const val = e.target.value;
                      setJoinDateDisplay(val);
                      // Chỉ cập nhật formData nếu format hợp lệ dd/mm/yyyy
                      if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
                        const converted = displayToDate(val);
                        setFormData({ ...formData, join_date: converted });
                      } else if (val === "") {
                        // Nếu xóa trống, set về ngày hiện tại
                        setFormData({ ...formData, join_date: new Date().toISOString().split('T')[0] });
                      }
                    }}
                    onBlur={() => {
                      // Khi rời khỏi input, nếu trống thì set về ngày hiện tại
                      if (!joinDateDisplay) {
                        const today = new Date().toISOString().split('T')[0];
                        setFormData({ ...formData, join_date: today });
                        setJoinDateDisplay(dateToDisplay(today));
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2"
                    placeholder="dd/mm/yyyy"
                  />
                </div>
              </div>

              {/* Row 2: Họ và Tên + Giới tính + Số điện thoại + Ngày sinh (4 cột) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Họ và Tên <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Giới tính <span className="text-red-600">*</span>
                  </label>
                  <select
                    required
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2"
                  >
                    <option value="">Chọn giới tính</option>
                    <option value="male">👨 Nam</option>
                    <option value="female">👩 Nữ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2"
                    placeholder="0912345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
                  <input
                    type="text"
                    value={dobDisplay}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDobDisplay(val);
                      // Chỉ cập nhật formData nếu format hợp lệ dd/mm/yyyy
                      if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
                        const converted = displayToDate(val);
                        setFormData({ ...formData, dob: converted });
                      } else if (val === "") {
                        // Nếu xóa trống, set về rỗng
                        setFormData({ ...formData, dob: "" });
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2"
                    placeholder="dd/mm/yyyy"
                  />
                </div>
              </div>

              {/* Row 4: Thiết bị + PB HM + PB FM */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thiết bị</label>
                  <input
                    type="text"
                    value={formData.device_name}
                    onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2"
                    placeholder="Garmin, Apple Watch, Coros..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PB HM <span className="text-xs text-gray-500">(HH:MM:SS)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.pb_hm_time}
                    onChange={(e) => setFormData({ ...formData, pb_hm_time: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2"
                    placeholder="1:45:30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PB FM <span className="text-xs text-gray-500">(HH:MM:SS)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.pb_fm_time}
                    onChange={(e) => setFormData({ ...formData, pb_fm_time: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2"
                    placeholder="3:45:30"
                  />
                </div>
              </div>

              {/* Strava Info - Compact version (only when editing) */}
              {editingMember && (
                <div className="rounded-lg p-4" style={{ background: "linear-gradient(to right, #FEF3C7, #FDE68A)", border: "1px solid #FCD34D" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚴</span>
                      <h3 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Strava Connection</h3>
                    </div>
                    {editingMember.strava_id && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">✓ Connected</span>
                    )}
                  </div>
                  
                  {editingMember.strava_id ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white rounded p-2" style={{ border: "1px solid #E5E7EB" }}>
                        <div className="text-gray-500 mb-1">Strava ID</div>
                        <div className="font-mono font-semibold text-gray-900">{editingMember.strava_id}</div>
                      </div>
                      <div className="bg-white rounded p-2" style={{ border: "1px solid #E5E7EB" }}>
                        <div className="text-gray-500 mb-1">Token Status</div>
                        <div className="font-medium">{formatTokenExpiry(editingMember.strava_token_expires_at)}</div>
                      </div>
                      <div className="bg-white rounded p-2" style={{ border: "1px solid #E5E7EB" }}>
                        <div className="text-gray-500 mb-1">Access Token</div>
                        <div className="font-mono text-gray-900">{maskToken(editingMember.strava_access_token)}</div>
                      </div>
                      <div className="bg-white rounded p-2" style={{ border: "1px solid #E5E7EB" }}>
                        <div className="text-gray-500 mb-1">Refresh Token</div>
                        <div className="font-mono text-gray-900">{maskToken(editingMember.strava_refresh_token)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2 flex items-center gap-2 text-xs">
                      <span>⚠️</span>
                      <span className="text-yellow-800">Chưa kết nối Strava. Thành viên có thể kết nối qua trang Profile.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Info note - Compact */}
              <div className="rounded-lg p-3 text-xs" style={{ background: "#DBEAFE", border: "1px solid #93C5FD", color: "#1E40AF" }}>
                💡 <strong>PB:</strong> Admin nhập = tự động duyệt. Member tự nhập = chờ duyệt.
                {!editingMember && <span className="ml-2">🚴 <strong>Strava:</strong> Tự động đồng bộ sau khi member kết nối.</span>}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2 text-white font-semibold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition shadow-md"
                  style={{ background: "var(--color-primary)" }}
                  onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  {formLoading ? (editingMember ? "Đang lưu..." : "Đang tạo...") : (editingMember ? "💾 Lưu Thay Đổi" : "➕ Tạo Tài Khoản")}
                </button>
                {editingMember && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMember(null);
                      setFormData({
                        email: "",
                        password: "",
                        full_name: "",
                        role: "member",
                        phone_number: "",
                        dob: "",
                        gender: "",
                        device_name: "",
                        join_date: new Date().toISOString().split("T")[0],
                        pb_hm_time: "",
                        pb_fm_time: "",
                      });
                      setJoinDateDisplay(dateToDisplay(new Date().toISOString().split('T')[0]));
                      setDobDisplay("");
                      setFormMessage(null);
                    }}
                    className="px-6 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition"
                  >
                    ❌ Hủy Chỉnh Sửa
                  </button>
                )}
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
        </div>

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
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2"
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
            fetchError ? (
              <div className="p-8 text-center">
                <p className="text-red-600 mb-3">{fetchError}</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => fetchMembers()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                  >Thử lại</button>
                  <button
                    onClick={() => { setFetchError(null); setLoading(false); }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg"
                  >Đóng</button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-600">Đang tải...</p>
              </div>
            )
          ) : filteredMembers.length > 0 ? (
            <div className="w-full overflow-hidden">
              <table className="w-full text-sm table-auto">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Tên</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Email</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Giới tính</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">SĐT</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Ngày sinh</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">PB HM</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">PB FM</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Vai Trò</th>
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Gia Nhập</th>
                    <th className="text-center py-3 px-4 font-bold text-gray-700">Trạng Thái</th>
                    <th className="text-center py-3 px-4 font-bold text-gray-700" style={{ width: '8rem' }}>Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className={`border-b border-gray-200 hover:bg-gray-50 ${!member.is_active ? 'bg-red-50' : ''}`}>
                      <td className="py-3 px-4 font-semibold text-sm whitespace-nowrap truncate max-w-[220px]" title={member.full_name}>
                        {member.full_name}
                      </td>
                      <td className="py-3 px-4 text-sm whitespace-nowrap truncate max-w-[260px]" title={member.email}>{member.email}</td>
                      <td className="py-3 px-4 min-w-0 text-sm">{member.gender === 'male' ? '👨 Nam' : member.gender === 'female' ? '👩 Nữ' : 'N/A'}</td>
                      <td className="py-3 px-4 min-w-0 break-words whitespace-normal">{member.phone_number || 'N/A'}</td>
                      <td className="py-3 px-4 min-w-0 text-sm">{formatDateSimple(member.dob)}</td>
                      <td className="py-3 px-4 min-w-0 text-sm">
                        <span className={member.pb_hm_approved ? 'text-green-700 font-semibold' : 'text-yellow-600'}>
                          {formatTime(member.pb_hm_seconds)}
                          {member.pb_hm_seconds && !member.pb_hm_approved && ' ⏳'}
                        </span>
                      </td>
                      <td className="py-3 px-4 min-w-0 text-sm break-words">
                        <span className={member.pb_fm_approved ? 'text-green-700 font-semibold' : 'text-yellow-600'}>
                          {formatTime(member.pb_fm_seconds)}
                          {member.pb_fm_seconds && !member.pb_fm_approved && ' ⏳'}
                        </span>
                      </td>
                      <td className="py-3 px-4 min-w-0 break-words">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                              isAdminRole(member.role)
                                ? "bg-red-100 text-red-800"
                                : isModRole(member.role)
                                ? "bg-blue-100 text-blue-800"
                                : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {getRoleLabel(member.role)}
                        </span>
                      </td>
                      <td className="py-3 px-4">{formatDateSimple(member.join_date)}</td>
                      <td className="py-3 px-4 text-center">
                        {member.is_active ? (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            ✓ Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            ✕ Rời {formatDate(member.leave_date)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => openEditForm(member)}
                            className="font-semibold flex items-center gap-1"
                            style={{ color: "var(--color-primary)" }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
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
