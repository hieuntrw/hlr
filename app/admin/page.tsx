"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import Link from "next/link";
import {
  Users,
  CheckCircle,
  Wallet,
  TrendingUp,
  AlertCircle,
  Calendar,
  Target,
} from "lucide-react";

interface AdminProfile {
  id: string;
  full_name: string;
  role: string;
  avatar_url?: string;
}

interface DashboardStats {
  pendingMembers: number;
  pendingPBApprovals: number;
  totalFund: number;
  monthlyCollection: number;
  pendingFines: number;
  activeChallenges: number;
  totalMembers: number;
}

export default function AdminPage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    pendingMembers: 0,
    pendingPBApprovals: 0,
    totalFund: 0,
    monthlyCollection: 0,
    pendingFines: 0,
    activeChallenges: 0,
    totalMembers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfileAndStats();
  }, []);

  async function fetchProfileAndStats() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData) return;

      setProfile(profileData);

      // Fetch dashboard statistics
      await fetchStats(profileData.role);
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats(role: string) {
    try {
      // Fetch pending members (status = 'pending' or null)
      const { count: pendingMembersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .or("status.is.null,status.eq.pending");

      // Fetch pending PB approvals
      const { count: pendingHMCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .not("pb_hm_seconds", "is", null)
        .eq("pb_hm_approved", false);

      const { count: pendingFMCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .not("pb_fm_seconds", "is", null)
        .eq("pb_fm_approved", false);

      // Fetch fund status (sum of all approved transactions)
      const { data: fundData } = await supabase
        .from("transactions")
        .select("amount, type")
        .eq("status", "approved");

      let totalFund = 0;
      let monthlyCollection = 0;

      if (fundData) {
        fundData.forEach((t) => {
          if (t.type === "collection" || t.type === "fine" || t.type === "donation") {
            totalFund += t.amount;
          } else if (t.type === "expense" || t.type === "reward") {
            totalFund -= t.amount;
          }
        });

        // Calculate this month's collection
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const { data: monthlyData } = await supabase
          .from("transactions")
          .select("amount")
          .eq("type", "collection")
          .eq("status", "approved")
          .gte("created_at", firstDayOfMonth.toISOString());

        if (monthlyData) {
          monthlyCollection = monthlyData.reduce((sum, t) => sum + t.amount, 0);
        }
      }

      // Fetch pending fines
      const { count: pendingFinesCount } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("type", "fine")
        .eq("status", "pending");

      // Fetch active challenges
      const { count: activeChallengesCount } = await supabase
        .from("challenges")
        .select("*", { count: "exact", head: true })
        .eq("status", "Open");

      // Fetch total members
      const { count: totalMembersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      setStats({
        pendingMembers: pendingMembersCount || 0,
        pendingPBApprovals: (pendingHMCount || 0) + (pendingFMCount || 0),
        totalFund,
        monthlyCollection,
        pendingFines: pendingFinesCount || 0,
        activeChallenges: activeChallengesCount || 0,
        totalMembers: totalMembersCount || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }

  const getRoleLabel = (role: string): string => {
    const labels: { [key: string]: string } = {
      admin: "Super Admin",
      mod_finance: "Mod Tài Chính",
      mod_challenge: "Mod Thử Thách",
      mod_member: "Mod Thành Viên",
    };
    return labels[role] || role;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const hasFinanceAccess = ["admin", "mod_finance"].includes(profile.role);
  const hasMemberAccess = ["admin", "mod_member"].includes(profile.role);
  const hasChallengeAccess = ["admin", "mod_challenge"].includes(profile.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="w-16 h-16 rounded-full object-cover border-4 border-blue-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Users className="text-white" size={32} />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard {getRoleLabel(profile.role)}</h1>
            <p className="text-gray-600">Chào mừng trở lại, {profile.full_name}!</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Pending Members Widget */}
        {hasMemberAccess && (
          <Link href="/admin/members">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-orange-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Users className="text-orange-600" size={24} />
                </div>
                {stats.pendingMembers > 0 && (
                  <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    {stats.pendingMembers}
                  </span>
                )}
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">Thành Viên Chờ Duyệt</h3>
              <p className="text-3xl font-bold text-gray-900">{stats.pendingMembers}</p>
              {stats.pendingMembers > 0 && (
                <p className="text-orange-600 text-xs mt-2 flex items-center gap-1">
                  <AlertCircle size={14} />
                  Cần xử lý
                </p>
              )}
            </div>
          </Link>
        )}

        {/* Pending PB Approvals Widget */}
        {hasMemberAccess && (
          <Link href="/admin/pb-approval">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-green-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="text-green-600" size={24} />
                </div>
                {stats.pendingPBApprovals > 0 && (
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    {stats.pendingPBApprovals}
                  </span>
                )}
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">PB Chờ Duyệt</h3>
              <p className="text-3xl font-bold text-gray-900">{stats.pendingPBApprovals}</p>
              {stats.pendingPBApprovals > 0 && (
                <p className="text-green-600 text-xs mt-2 flex items-center gap-1">
                  <AlertCircle size={14} />
                  Cần xử lý
                </p>
              )}
            </div>
          </Link>
        )}

        {/* Fund Status Widget */}
        {hasFinanceAccess && (
          <Link href="/admin/finance">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Wallet className="text-blue-600" size={24} />
                </div>
                <TrendingUp className="text-blue-600" size={20} />
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">Tổng Quỹ</h3>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalFund)}</p>
              <p className="text-blue-600 text-xs mt-2">Thu tháng này: {formatCurrency(stats.monthlyCollection)}</p>
            </div>
          </Link>
        )}

        {/* Active Challenges Widget */}
        {hasChallengeAccess && (
          <Link href="/admin/challenges">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-purple-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Target className="text-purple-600" size={24} />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">Thử Thách Đang Diễn Ra</h3>
              <p className="text-3xl font-bold text-gray-900">{stats.activeChallenges}</p>
              <p className="text-purple-600 text-xs mt-2">Tổng thành viên: {stats.totalMembers}</p>
            </div>
          </Link>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Fines */}
        {hasFinanceAccess && stats.pendingFines > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="text-red-600" size={20} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Phạt Chờ Xử Lý</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Có <strong className="text-red-600">{stats.pendingFines}</strong> khoản phạt đang chờ phê duyệt
            </p>
            <Link
              href="/admin/finance"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Xử lý ngay →
            </Link>
          </div>
        )}

        {/* System Info */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md p-6 border-l-4 border-blue-600">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="text-blue-600" size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Thông Tin Hệ Thống</h3>
          </div>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <strong>Tổng thành viên:</strong> {stats.totalMembers}
            </p>
            <p>
              <strong>Thử thách đang chạy:</strong> {stats.activeChallenges}
            </p>
            <p>
              <strong>Vai trò của bạn:</strong> {getRoleLabel(profile.role)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
