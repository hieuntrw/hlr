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
    full_name?: string;
  } | null;
  pb_fm_seconds?: number | null;
  pb_hm_seconds?: number | null;
  pb_fm_approved?: boolean | null;
  pb_hm_approved?: boolean | null;
}

interface IncomingPB {
  id: string;
  user_id: string;
  distance: string;
  time_seconds: number;
  achieved_at: string | null;
  profile?: { full_name?: string } | null;
  pb_fm_seconds?: number | null;
  pb_hm_seconds?: number | null;
  pb_fm_approved?: boolean | null;
  pb_hm_approved?: boolean | null;
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export default function PBApprovalPage() {
  const { user, isLoading: authLoading, sessionChecked } = useAuth();
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
      // API already returns only pending PB rows; map directly
      const incoming = (data as IncomingPB[]) || [];
      setPendingPBs(
        incoming.map((p) => ({
          id: p.id,
          user_id: p.user_id,
          distance: p.distance,
          time_seconds: p.time_seconds,
          achieved_at: p.achieved_at ?? '',
          profile: p.profile ?? null,
          pb_fm_seconds: p.pb_fm_seconds,
          pb_hm_seconds: p.pb_hm_seconds,
          pb_fm_approved: p.pb_fm_approved,
          pb_hm_approved: p.pb_hm_approved,
        })) || []
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
    const role = getEffectiveRole(user);
    if (!role || (!isAdminRole(role))) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (authLoading || !sessionChecked) return;
    checkRole();
    fetchPendingPBs();
  }, [user, authLoading, sessionChecked, checkRole, fetchPendingPBs]);

  

  async function handleApprove(pbId: string) {
    try {
      const pbData = pendingPBs.find((p) => p.id === pbId);

      if (!pbData) return;
      const ok = window.confirm(`Bạn có chắc muốn duyệt PB của ${pbData.profile?.full_name ?? 'thành viên này'}?`);
      if (!ok) return;

      const payload = { user_id: pbData.user_id, distance: pbData.distance };
      const res = await fetch('/api/admin/pb-approval', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Approve failed');

      alert("Đã duyệt thành tích!");
      // remove approved PB from UI list
      setPendingPBs((prev) => prev.filter((p) => p.id !== pbId));
    } catch (err) {
      console.error("Error:", err);
      alert("Lỗi khi duyệt thành tích");
    }
  }

  // Note: per spec, reject is a client-only action and removed from UI

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
                    
                    
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprove(pb.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition-colors"
                        >
                          ✓ Duyệt
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
