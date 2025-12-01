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
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfileAndStats();
  }, []);

  async function fetchProfileAndStats() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      console.log("[Admin Page] User from auth:", user);
      console.log("[Admin Page] User metadata:", user?.user_metadata);
      console.log("[Admin Page] User role from metadata:", user?.user_metadata?.role);

      if (!user) {
        console.log("[Admin Page] No user, redirecting to login");
        window.location.href = "/login";
        return;
      }

      // Get role from Supabase Auth metadata
      const authRole = user.user_metadata?.role;
      console.log("[Admin Page] Auth role:", authRole);

      // Check if user has admin/mod permissions
      const validRoles = ["admin", "mod_finance", "mod_challenge", "mod_member"];
      if (!authRole || !validRoles.includes(authRole)) {
        console.log("[Admin Page] Invalid role, redirecting to dashboard");
        window.location.href = "/dashboard";
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData) {
        console.log("[Admin Page] Profile error:", profileError);
        return;
      }

      setProfile({...profileData, role: authRole}); // Use auth role, not profile role

      // Fetch dashboard statistics
      await fetchStats(authRole);
    } catch (err) {
      console.error("[Admin Page] Unexpected error:", err);
      setLastError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats(role: string) {
    try {
      // Fetch total members
      const { count: totalMembersCount, error: membersError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (membersError) {
        console.error("Members count error:", membersError);
        setLastError(`Members: ${membersError.message}`);
      }

      // Fetch active challenges (not locked)
      const { count: activeChallengesCount, error: challengesError } = await supabase
        .from("challenges")
        .select("*", { count: "exact", head: true })
        .eq("is_locked", false);

      if (challengesError) {
        console.error("Challenges count error:", challengesError);
        setLastError(`Challenges: ${challengesError.message}`);
      }

      // Fetch pending transactions
      const { count: pendingTransactionsCount, error: pendingError } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("payment_status", "pending");

      if (pendingError) {
        console.error("Pending transactions error:", pendingError);
        setLastError(`Pending: ${pendingError.message}`);
      }

      // Calculate fund balance from approved transactions
      const { data: fundData, error: fundError } = await supabase
        .from("transactions")
        .select("amount, type")
        .eq("payment_status", "paid");

      if (fundError) {
        console.error("Fund data error:", fundError);
        setLastError(`Fund: ${fundError.message}`);
      }

      let totalFund = 0;
      if (fundData) {
        fundData.forEach((t) => {
          if (t.type === "fund_collection" || t.type === "fine" || t.type === "donation") {
            totalFund += t.amount;
          } else if (t.type === "expense" || t.type === "reward_payout") {
            totalFund -= t.amount;
          }
        });
      }

      setStats({
        pendingMembers: 0, // TODO: implement when status column is added
        pendingPBApprovals: 0, // TODO: implement when approval columns are added
        totalFund: totalFund,
        monthlyCollection: 0, // TODO: calculate current month
        pendingFines: pendingTransactionsCount || 0,
        activeChallenges: activeChallengesCount || 0,
        totalMembers: totalMembersCount || 0,
      });
    } catch (err) {
      console.error("Error fetching stats:", err);
      setLastError(String(err));
      // Set default stats on error
      setStats({
        pendingMembers: 0,
        pendingPBApprovals: 0,
        totalFund: 0,
        monthlyCollection: 0,
        pendingFines: 0,
        activeChallenges: 0,
        totalMembers: 0,
      });
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
      {/* Debug Panel (only visible when lastError exists) */}
      {lastError && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-sm">
          <div className="font-semibold">Debug:</div>
          <div>Role: {profile?.role || "unknown"}</div>
          <div>Error: {lastError}</div>
        </div>
      )}
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <Users className="text-white" size={32} />
          </div>
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
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-orange-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Wallet className="text-orange-600" size={24} />
                </div>
                <TrendingUp className="text-orange-600" size={20} />
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">Tổng Quỹ</h3>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalFund)}</p>
              <p className="text-orange-600 text-xs mt-2">Thu tháng này: {formatCurrency(stats.monthlyCollection)}</p>
            </div>
          </Link>
        )}

        {/* Active Challenges Widget */}
        {hasChallengeAccess && (
          <Link href="/admin/challenges">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-purple-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Target className="text-orange-600" size={24} />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">Thử Thách Đang Diễn Ra</h3>
              <p className="text-3xl font-bold text-gray-900">{stats.activeChallenges}</p>
              <p className="text-orange-600 text-xs mt-2">Tổng thành viên: {stats.totalMembers}</p>
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
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow-md p-6 border-l-4 border-orange-600">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="text-orange-600" size={20} />
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
