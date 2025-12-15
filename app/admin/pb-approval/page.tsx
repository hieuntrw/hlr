"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole, isAdminRole } from "@/lib/auth/role";

interface PBRecord {
  id: string;
  user_id: string;
  distance: string;
  time_seconds: number;
  achieved_at: string;
  profile?: {
    full_name: string;
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

function formatPace(seconds: number, distance: string): string {
  const distanceKm = distance === "HM" ? 21 : 42;
  const pacePerKm = (seconds * 1000) / distanceKm;
  const mins = Math.floor(pacePerKm / 60);
  const secs = Math.floor(pacePerKm % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/km`;
}

export default function PBApprovalPage() {
  const { user, profile, isLoading: authLoading, sessionChecked } = useAuth();
  const router = useRouter();
  const [pendingPBs, setPendingPBs] = useState<PBRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingPBs = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch('/api/admin/pb-approval', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load');
      const j = await res.json().catch(() => ({ data: [] }));
      const data = j.data || [];
      setPendingPBs(
        data.map((p: unknown) => {
          const item = p as {
            id: string;
            user_id: string;
            distance: string;
            time_seconds: number;
            achieved_at: string;
            profiles?: { full_name?: string } | null;
          };
          return {
            id: item.id,
            user_id: item.user_id,
            distance: item.distance,
            time_seconds: item.time_seconds,
            achieved_at: item.achieved_at,
            profile: item.profiles,
          };
        }) || []
      );
    } catch (err) {
      console.error('Error:', err);
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
    if (!role || (!isAdminRole(role) && role !== 'mod_member')) {
      router.push('/');
    }
  }, [user, profile, router]);

  useEffect(() => {
    if (authLoading || !sessionChecked) return;
    checkRole();
    fetchPendingPBs();
  }, [user, authLoading, sessionChecked, checkRole, fetchPendingPBs]);

  

  async function handleApprove(pbId: string) {
    try {
      const pbData = pendingPBs.find((p) => p.id === pbId);

      if (!pbData) return;

      const res = await fetch('/api/admin/pb-approval', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pbId }),
      });
      if (!res.ok) throw new Error('Approve failed');

      alert("Đã duyệt thành tích!");
      fetchPendingPBs();
    } catch (err) {
      console.error("Error:", err);
      alert("Lỗi khi duyệt thành tích");
    }
  }

  async function handleReject(pbId: string) {
    try {
      const res = await fetch(`/api/admin/pb-approval?id=${pbId}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok) throw new Error('Delete failed');

      alert("Đã từ chối thành tích!");
      fetchPendingPBs();
    } catch (err) {
      console.error("Error:", err);
      alert("Lỗi khi từ chối");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="py-6 px-4 gradient-theme-primary">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-inverse)" }}>✅ Duyệt PB Chờ Xử Lý</h1>
            <Link href="/admin" className="hover:opacity-80" style={{ color: "var(--color-text-inverse)" }}>
              ← Quay lại
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Đang tải...</p>
            </div>
          ) : pendingPBs.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Thành Viên</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Cự Ly</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">Thời Gian</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">Pace</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Ngày</th>
          
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {pendingPBs.map((pb) => (
                  <tr key={pb.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 font-semibold">{pb.profile?.full_name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex px-2 py-1 rounded text-xs font-semibold" style={{ background: "var(--color-info-bg, #DBEAFE)", color: "var(--color-info, #1E40AF)" }}>
                        {pb.distance === "HM" ? "HM (21km)" : "FM (42km)"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold" style={{ color: "var(--color-primary)" }}>
                      {formatTime(pb.time_seconds)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {formatPace(pb.time_seconds, pb.distance)}
                    </td>
                    <td className="py-3 px-4">{formatDate(pb.achieved_at)}</td>
                    
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprove(pb.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition-colors"
                        >
                          ✓ Duyệt
                        </button>
                        <button
                          onClick={() => handleReject(pb.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded transition-colors"
                        >
                          ✕ Từ Chối
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">Không có thành tích nào chờ duyệt</p>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-600 mt-4">
          ⏳ Chờ duyệt: <span className="font-bold">{pendingPBs.length}</span> thành tích
        </p>
      </div>
    </div>
  );
}
