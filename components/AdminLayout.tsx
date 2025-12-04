"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth/AuthContext";
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
  LogOut,
  User,
  Home,
  Gift,
  Star,
  Award,
} from "lucide-react";
interface AdminProfile {
  id: string;
  full_name: string;
  role: string;
  avatar_url?: string;
}

interface MenuItem {
  title: string;
  icon: any;
  link: string;
  requiredRoles: string[];
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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
      requiredRoles: ["admin", "mod_finance"],
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
      requiredRoles: ["admin", "mod_member"],
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
      requiredRoles: ["admin"],
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

  const { user, profile: authProfile } = useAuth();

  useEffect(() => {
    fetchProfile();
  }, [user, authProfile]);

  async function fetchProfile() {
    try {
      // If AuthContext already has a profile, prefer that and avoid extra DB call
      if (authProfile) {
        setProfile(authProfile as AdminProfile);
        setLoading(false);
        return;
      }

      const {
        data: { user: supaUser },
      } = await supabase.auth.getUser();

      console.log("[AdminLayout] User:", supaUser?.email);
      console.log("[AdminLayout] User metadata:", supaUser?.user_metadata);

      if (!supaUser) {
        console.log("[AdminLayout] No user, redirecting to login");
        window.location.href = "/login";
        return;
      }

      // Get role from Supabase Auth metadata
      const authRole = supaUser.user_metadata?.role;
      console.log("[AdminLayout] Auth role:", authRole);

      // If no role present, redirect to dashboard (guard)
      if (!authRole) {
        console.log("[AdminLayout] No role in metadata, redirecting to dashboard");
        window.location.href = "/dashboard";
        return;
      }

      // Try to fetch the profiles row but don't block the UI if the DB is slow.
      // Race the DB fetch with a short timeout and fall back to token metadata.
      try {
        const profilePromise = supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", supaUser.id)
          .single();

        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000));
        const result = await Promise.race([profilePromise, timeout]) as any;

        if (!result) {
          setProfile({ id: supaUser.id, full_name: supaUser.user_metadata?.fullName || supaUser.email || 'Admin', role: authRole });
        } else if (result.error) {
          console.error('[AdminLayout] Profile query returned error:', result.error);
          setProfile({ id: supaUser.id, full_name: supaUser.user_metadata?.fullName || supaUser.email || 'Admin', role: authRole });
        } else if (result.data) {
          setProfile({
            ...result.data,
            role: authRole,
          });
        } else {
          setProfile({ id: supaUser.id, full_name: supaUser.user_metadata?.fullName || supaUser.email || 'Admin', role: authRole });
        }
      } catch (e) {
        console.warn('[AdminLayout] Profile fetch failed or timed out, using token metadata fallback', e);
        setProfile({ id: user?.id || '', full_name: user?.user_metadata?.fullName || user?.email || 'Admin', role: authRole });
      }
    } catch (error) {
      console.error("[AdminLayout] Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  }

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

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

  const accessibleMenus = getAccessibleMenus(profile.role);

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
              <div className="w-10 h-10 rounded-lg flex items-center justify-center gradient-theme-primary">
                <LayoutDashboard className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>Admin Panel</h2>
                <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Hải Lăng Runners</p>
              </div>
            </Link>
          </div>

          {/* Profile Section */}
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-primary)" }}>
            <div className="flex items-center gap-3">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-12 h-12 rounded-full object-cover border-2"
                  style={{ borderColor: "var(--color-primary)" }}
                />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center gradient-theme-primary">
                  <User className="text-white" size={24} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{profile.full_name}</p>
                <p className="text-xs font-medium" style={{ color: "var(--color-primary)" }}>{getRoleLabel(profile.role)}</p>
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
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all"
              style={{ color: "var(--color-error)" }}
            >
              <LogOut size={20} />
              <span>Đăng Xuất</span>
            </button>
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
