"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
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
      title: "Cài Đặt",
      icon: Settings,
      link: "/admin/settings",
      requiredRoles: ["admin"],
    },
  ];

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const accessibleMenus = getAccessibleMenus(profile.role);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-600 hover:text-gray-900">
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <h1 className="text-lg font-bold text-gray-900">Admin Panel</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 transition-transform duration-300 z-40 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 w-64`}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Brand */}
          <div className="px-6 py-5 border-b border-gray-200">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg flex items-center justify-center">
                <LayoutDashboard className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Admin Panel</h2>
                <p className="text-xs text-gray-500">HLR Running Club</p>
              </div>
            </Link>
          </div>

          {/* Profile Section */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100">
            <div className="flex items-center gap-3">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-orange-300"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <User className="text-white" size={24} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{profile.full_name}</p>
                <p className="text-xs text-blue-600 font-medium">{getRoleLabel(profile.role)}</p>
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Logout Button */}
          <div className="px-3 py-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-all"
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
