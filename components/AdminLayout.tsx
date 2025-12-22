"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
// Admin layout uses server endpoints for auth/profile; avoid direct browser PostgREST calls.
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole } from "@/lib/auth/role";
import {
  LayoutDashboard,
  Wallet,
  BarChart3,
  Flag,
  Trophy,
  Users,
  CheckCircle,
  Settings,
  Menu,
  X,
  Home,
  Gift,
  Star,
  Award,
} from "lucide-react";
interface AdminProfile {
  id: string;
  full_name: string;
  role: string;
  avatar_url?: string | null;
}

interface MenuItem {
  title: string;
  icon: React.ElementType;
  link: string;
  requiredRoles: string[];
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoAvailable, setLogoAvailable] = useState(true);

  const menuItems: MenuItem[] = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      link: "/admin",
      requiredRoles: ["admin", "mod_finance", "mod_challenge", "mod_member"],
    },
    {
      title: "Quản Lý Thu/Chi",
      icon: Wallet,
      link: "/admin/finance",
      requiredRoles: ["admin", "mod_finance"],
    },
    {
      title: "Báo Cáo Quỹ",
      icon: BarChart3,
      link: "/admin/finance-report",
      requiredRoles: ["admin", "mod_finance", "mod_challenge", "mod_member"],
    },
    {
      title: "Quản Lý Thử Thách",
      icon: Flag,
      link: "/admin/challenges",
      requiredRoles: ["admin", "mod_challenge"],
    },
    {
      title: "Giải Chạy",
      icon: Trophy,
      link: "/admin/races",
      requiredRoles: ["admin", "mod_challenge", "mod_member"],
    },
    {
      title: "Thành Viên",
      icon: Users,
      link: "/admin/members",
      requiredRoles: ["admin", "mod_member"],
    },
    {
      title: "Duyệt PB",
      icon: CheckCircle,
      link: "/admin/pb-approval",
      requiredRoles: ["admin"],
    },
    {
      title: "Mốc Thành Tích",
      icon: Award,
      link: "/admin/reward-milestones",
      requiredRoles: ["admin"],
    },
    {
      title: "Quay Số May Mắn",
      icon: Gift,
      link: "/admin/lucky-draw",
      requiredRoles: ["admin", "mod_challenge"],
    },
    {
      title: "Theo Dõi Phần Thưởng",
      icon: Award,
      link: "/admin/reward-monitor",
      requiredRoles: ["admin", "mod_finance","mod_challenge", "mod_member"],
    },
    {
      title: "Phần Thưởng Đứng Bục",
      icon: Star,
      link: "/admin/podium-rewards",
      requiredRoles: ["admin"],
    },
    {
      title: "Cài Đặt",
      icon: Settings,
      link: "/admin/settings",
      requiredRoles: ["admin"],
    },
  ];

  const { user, profile: authProfile, sessionChecked } = useAuth();

  const fetchProfile = useCallback(async function fetchProfile() {
    try {
      // If AuthContext already has a profile, prefer that and avoid extra fetch
      if (authProfile) {
        setProfile(authProfile as AdminProfile);
        setLoading(false);
        return;
      }

      // Fetch minimal profile info from server-side endpoint which reconstructs
      // the session from HttpOnly cookies and respects RLS.
      const res = await fetch('/api/profiles/me', { credentials: 'same-origin' });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        console.warn('[AdminLayout] /api/profiles/me returned non-OK', res.status);
        setLoading(false);
        return;
      }

      const json = await res.json().catch(() => null);
      const prof = json?.profile;
      if (prof) {
        setProfile({ id: prof.id, full_name: prof.full_name || (user?.email || 'Admin'), avatar_url: prof.avatar_url || null, role: prof.role || 'admin' });
      } else {
        // Fallback to authProfile or basic user info
        if (user?.id) {
          setProfile({ id: user.id, full_name: user?.email || 'Admin', role: 'admin' });
        }
      }
    } catch (error) {
      console.error('[AdminLayout] Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [authProfile, user]);

  useEffect(() => {
    if (!sessionChecked) return;
    fetchProfile();
  }, [sessionChecked, fetchProfile]);

  const getAccessibleMenus = (role: string): MenuItem[] => {
    return menuItems.filter((item) => item.requiredRoles.includes(role));
  };

  const getRoleLabel = (role: string): string => {
    const labels: { [key: string]: string } = {
      admin: "Super Admin",
      mod_finance: "Mod Tài Chính",
      mod_challenge: "Mod Thử Thách",
      mod_member: "Mod Thành Viên",
    };
    return labels[role] || role;
  };

  // Sidebar no longer contains a logout action; header handles logout flow.

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--color-bg-primary)" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderBottomColor: "var(--color-primary)" }}></div>
          <p style={{ color: "var(--color-text-secondary)" }}>Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const resolvedRole = getEffectiveRole(user as unknown as Record<string, unknown>) || null;
  const accessibleMenus = resolvedRole ? getAccessibleMenus(resolvedRole) : [];

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg-primary)" }}>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 px-4 py-3" style={{ background: "var(--color-bg-secondary)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center justify-between">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ color: "var(--color-text-secondary)" }}>
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <h1 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>Admin Panel</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full transition-transform duration-300 z-40 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 w-64`}
        style={{ background: "var(--color-bg-secondary)", borderRight: "1px solid var(--color-border)" }}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Brand */}
          <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <Link href="/admin" className="flex items-center gap-2">
              <Image
                src="/media/logo/logo.svg"
                alt="HLR"
                width={48}
                height={48}
                className="w-12 h-12 object-contain p-0"
                style={{ display: logoAvailable ? 'block' : 'none' }}
                onError={() => setLogoAvailable(false)}
                onLoad={() => setLogoAvailable(true)}
              />
              {!logoAvailable && (
                <div className="w-12 h-12 flex items-center justify-center gradient-theme-primary">
                  <LayoutDashboard className="text-white" size={24} />
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>Admin Panel</h2>
                <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Hải Lăng Runners</p>
              </div>
            </Link>
          </div>

          {/* Profile Section */}
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-primary)" }}>
            <div className="flex items-center gap-3">
              <Image
                src={profile.avatar_url || '/media/avatars/avatar-placeholder.svg'}
                alt={profile.full_name}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover border-2"
                style={{ borderColor: "var(--color-primary)" }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{profile.full_name}</p>
                <p className="text-xs font-medium" style={{ color: "var(--color-primary)" }}>{resolvedRole ? getRoleLabel(resolvedRole) : 'Member'}</p>
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto py-4">
            <div className="px-3 space-y-1">
              {accessibleMenus.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.link;
                return (
                  <Link
                    key={item.link}
                    href={item.link}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all"
                    style={isActive ? {
                      background: "var(--color-primary)",
                      color: "var(--color-text-inverse)",
                      boxShadow: "var(--shadow-md)"
                    } : {
                      color: "var(--color-text-secondary)"
                    }}
                  >
                    <Icon size={20} />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Actions */}
          <div className="px-3 py-4 space-y-2" style={{ borderTop: "1px solid var(--color-border)" }}>
            <Link
              href="/dashboard"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all"
              style={{ color: "var(--color-primary)" }}
            >
              <Home size={20} />
              <span>Trang Chủ</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
