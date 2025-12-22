"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole, isAdminRole, isModRole } from "@/lib/auth/role";
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
  const { user, profile, isLoading: authLoading, sessionChecked } = useAuth();
  const [localProfile, setLocalProfile] = useState<AdminProfile | null>(null);
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



  const fetchStats = useCallback(async function fetchStats() {
    try {
      const resp = await fetch('/api/admin/overview', { credentials: 'same-origin' });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        console.error('Error fetching overview:', json);
        setLastError(json?.error || resp.statusText);
        setStats({ pendingMembers: 0, pendingPBApprovals: 0, totalFund: 0, monthlyCollection: 0, pendingFines: 0, activeChallenges: 0, totalMembers: 0 });
        return;
      }
      const d = json || {};
      setStats({
        pendingMembers: d.pendingMembers || 0,
        pendingPBApprovals: d.pendingPBApprovals || 0,
        totalFund: d.totalFund || 0,
        monthlyCollection: d.monthlyCollection || 0,
        pendingFines: d.pendingFines || 0,
        activeChallenges: d.activeChallenges || 0,
        totalMembers: d.totalMembers || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
      setLastError(String(err));
      setStats({ pendingMembers: 0, pendingPBApprovals: 0, totalFund: 0, monthlyCollection: 0, pendingFines: 0, activeChallenges: 0, totalMembers: 0 });
    }
  }, []);

  const fetchProfileFromSupabase = useCallback(async function fetchProfileFromSupabase() {
    setLoading(true);

    try {
      // user from AuthContext

      console.log("[Admin Page] User from auth:", user);

      if (!user) {
        console.log("[Admin Page] No user, redirecting to login");
        window.location.href = "/login";
        return;
      }

      // Resolve canonical role from server app_metadata only
      const authRole = getEffectiveRole(user) || "member";
      console.log("[Admin Page] Auth role:", authRole);

      // Check if user has admin/mod permissions
      if (!authRole || (!isAdminRole(authRole) && !isModRole(authRole))) {
        console.log("[Admin Page] Invalid role, redirecting to dashboard");
        window.location.href = "/dashboard";
        return;
      }

      // Trong fetchProfileAndStats, ưu tiên dùng profile từ AuthContext nếu có, chỉ truy vấn Supabase nếu chưa có hoặc cache hết hạn
            try {
        const resp = await fetch('/api/profiles/me', { credentials: 'same-origin' });
        const json = await resp.json().catch(() => null);
        if (resp.ok && json?.profile) {
          const row = json.profile;
          const fullName = row?.full_name || profile?.full_name || (user as unknown as { email?: string })?.email || '';
          setLocalProfile({ id: user.id, full_name: fullName, role: authRole });
        } else {
          setLocalProfile({ id: user.id, full_name: profile?.full_name || (user as unknown as { email?: string })?.email || '', role: authRole });
        }
      } catch {
        setLocalProfile({ id: user.id, full_name: profile?.full_name || (user as unknown as { email?: string })?.email || '', role: authRole });
      }

      // Fetch dashboard statistics
      await fetchStats();
    } catch (err) {
      console.error("[Admin Page] Unexpected error:", err);
      setLastError(String(err));
    } finally {
      setLoading(false);
    }
  }, [fetchStats, user, profile]);

  useEffect(() => {
    // Allow proceeding when auth is still verifying but we already have a cached user
    (async () => {
      if (authLoading && !user) return;
      // Wait until sessionChecked completes to avoid false-positive redirects
      if (!sessionChecked) return;
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setLoading(true);
      try {
        // Use canonical role resolution from app_metadata only
        const resolved = getEffectiveRole(user) || "member";
        if (profile) {
          setLocalProfile({
            id: profile.id,
            full_name: profile.full_name ?? '',
            role: resolved
          });
          // Fetch stats using resolved role
          await fetchStats();
        } else {
          // This function sets loading false in its finally block
          await fetchProfileFromSupabase();
        }
      } catch (err) {
        console.error('[Admin Page] Error during init:', err);
        setLastError(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [user, profile, authLoading, sessionChecked, fetchProfileFromSupabase, fetchStats]);

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderBottomColor: "var(--color-primary)" }}></div>
          <p style={{ color: "var(--color-text-secondary)" }}>Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!localProfile) return null;

  const hasFinanceAccess = isAdminRole(localProfile.role) || localProfile.role === "mod_finance";
  const hasMemberAccess = isAdminRole(localProfile.role) || localProfile.role === "mod_member";
  const hasChallengeAccess = isAdminRole(localProfile.role) || localProfile.role === "mod_challenge";

  return (
    <div className="space-y-6">
      {/* Debug Panel (only visible when lastError exists) */}
      {lastError && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-sm">
          <div className="font-semibold">Debug:</div>
          <div>Role: {localProfile?.role || "unknown"}</div>
          <div>Error: {lastError}</div>
        </div>
      )}
      {/* Header */}
      <div className="rounded-lg shadow-md p-6" style={{ background: "var(--color-bg-secondary)" }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center gradient-theme-primary">
            <Users className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>Dashboard {getRoleLabel(localProfile.role)}</h1>
            <p style={{ color: "var(--color-text-secondary)" }}>Chào mừng trở lại, {localProfile.full_name}!</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Pending Members Widget */}
        {hasMemberAccess && (
          <Link href="/admin/members">
            <div className="rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow cursor-pointer border-l-4" style={{ background: "var(--color-bg-secondary)", borderLeftColor: "var(--color-primary)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "var(--color-bg-primary)" }}>
                  <Users style={{ color: "var(--color-primary)" }} size={24} />
                </div>
                {stats.pendingMembers > 0 && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "var(--color-bg-primary)", color: "var(--color-primary)" }}>
                    {stats.pendingMembers}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>Thành Viên Chờ Duyệt</h3>
              <p className="text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>{stats.pendingMembers}</p>
              {stats.pendingMembers > 0 && (
                <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "var(--color-primary)" }}>
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
            <div className="rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow cursor-pointer border-l-4" style={{ background: "var(--color-bg-secondary)", borderLeftColor: "var(--color-success)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "var(--color-bg-primary)" }}>
                  <CheckCircle style={{ color: "var(--color-success)" }} size={24} />
                </div>
                {stats.pendingPBApprovals > 0 && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "var(--color-bg-primary)", color: "var(--color-success)" }}>
                    {stats.pendingPBApprovals}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>PB Chờ Duyệt</h3>
              <p className="text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>{stats.pendingPBApprovals}</p>
              {stats.pendingPBApprovals > 0 && (
                <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "var(--color-success)" }}>
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
            <div className="rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow cursor-pointer border-l-4" style={{ background: "var(--color-bg-secondary)", borderLeftColor: "var(--color-primary)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "var(--color-bg-primary)" }}>
                  <Wallet style={{ color: "var(--color-primary)" }} size={24} />
                </div>
                <TrendingUp style={{ color: "var(--color-primary)" }} size={20} />
              </div>
              <h3 className="text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>Tổng Quỹ</h3>
              <p className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>{formatCurrency(stats.totalFund)}</p>
              <p className="text-xs mt-2" style={{ color: "var(--color-text-secondary)" }}>
              Có <strong style={{ color: "var(--color-error)" }}>{stats.pendingFines}</strong> khoản chờ xử lý
            </p>
              
            </div>
          </Link>

        )}

        {/* Active Challenges Widget */}
        {hasChallengeAccess && (
          <Link href="/admin/challenges">
            <div className="rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow cursor-pointer border-l-4" style={{ background: "var(--color-bg-secondary)", borderLeftColor: "var(--color-accent)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "var(--color-bg-primary)" }}>
                  <Target style={{ color: "var(--color-primary)" }} size={24} />
                </div>
              </div>
              <h3 className="text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>Thử Thách Đang Diễn Ra</h3>
              <p className="text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>{stats.activeChallenges}</p>
              <p className="text-xs mt-2" style={{ color: "var(--color-primary)" }}>Tổng thành viên: {stats.totalMembers}</p>
            </div>
          </Link>
        )}
      </div>
        {/* System Info */}
        <div className="rounded-lg shadow-md p-6 border-l-4" style={{ background: "var(--color-bg-primary)", borderLeftColor: "var(--color-primary)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-bg-secondary)" }}>
              <Calendar style={{ color: "var(--color-primary)" }} size={20} />
            </div>
            <h3 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>Thông Tin Hệ Thống</h3>
          </div>
          <div className="space-y-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            <p>
              <strong>Tổng thành viên:</strong> {stats.totalMembers}
            </p>
            <p>
              <strong>Thử thách đang chạy:</strong> {stats.activeChallenges}
            </p>
            <p>
              <strong>Vai trò của bạn:</strong> {getRoleLabel(localProfile.role)}
            </p>
          </div>
        </div>
    
    </div>
  );
}
