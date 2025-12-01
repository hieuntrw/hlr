"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";

interface PBRecord {
  id: string;
  user_id: string;
  distance: string;
  time_seconds: number;
  achieved_at: string;
  evidence_link: string;
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
  const router = useRouter();
  const [pendingPBs, setPendingPBs] = useState<PBRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkRole();
    fetchPendingPBs();
  }, []);

  async function checkRole() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/debug-login");
      return;
    }
    const role = user.user_metadata?.role;
    if (!role || !["admin", "mod_member"].includes(role)) {
      router.push("/");
    }
  }

  async function fetchPendingPBs() {
    setLoading(true);

    try {
      // Fetch PBs from pb_history where evidence_link is not null (pending approval)
      const { data, error } = await supabase
        .from("pb_history")
        .select("id, user_id, distance, time_seconds, achieved_at, evidence_link, profiles(full_name)")
        .not("evidence_link", "is", null)
        .order("achieved_at", { ascending: false });

      if (error) {
        console.error("Error:", error);
        return;
      }

      setPendingPBs(
        data?.map((p: any) => ({
          id: p.id,
          user_id: p.user_id,
          distance: p.distance,
          time_seconds: p.time_seconds,
          achieved_at: p.achieved_at,
          evidence_link: p.evidence_link,
          profile: p.profiles,
        })) || []
      );
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(pbId: string, distance: string) {
    try {
      const pbData = pendingPBs.find((p) => p.id === pbId);

      if (!pbData) return;

      // Mark corresponding race_result as approved and is_pr to trigger auto-award
      const { error: updateErr } = await supabase
        .from("race_results")
        .update({ approved: true, is_pr: true })
        .eq("user_id", pbData.user_id)
        .eq("race_id", (await supabase.from("pb_history").select("race_id").eq("id", pbId).single()).data?.race_id)
        .eq("chip_time_seconds", pbData.time_seconds);

      if (updateErr) throw updateErr;

      alert("Đã duyệt thành tích!");
      fetchPendingPBs();
    } catch (err) {
      console.error("Error:", err);
      alert("Lỗi khi duyệt thành tích");
    }
  }

  async function handleReject(pbId: string) {
    try {
      // Delete the record
      await supabase.from("pb_history").delete().eq("id", pbId);

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
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">✅ Duyệt Thành Tích Cá Nhân</h1>
            <Link href="/admin" className="text-blue-100 hover:text-white">
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
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Bằng Chứng</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {pendingPBs.map((pb) => (
                  <tr key={pb.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 font-semibold">{pb.profile?.full_name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-semibold">
                        {pb.distance === "HM" ? "HM (21km)" : "FM (42km)"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-orange-600">
                      {formatTime(pb.time_seconds)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {formatPace(pb.time_seconds, pb.distance)}
                    </td>
                    <td className="py-3 px-4">{formatDate(pb.achieved_at)}</td>
                    <td className="py-3 px-4 text-center">
                      <a
                        href={pb.evidence_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-800 font-semibold"
                      >
                        🔗 Xem
                      </a>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprove(pb.id, pb.distance)}
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
