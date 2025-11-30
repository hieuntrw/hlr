"use client";

import { Activity, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

// Common Header Component for all pages
export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    // Get current user
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Get user profile
        const { data } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();
        setProfile(data);
      } else {
        setProfile(null);
      }
    })();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      } else if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      // Force reload to clear all state
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getRoleLabel = (role: string): string => {
    const labels: { [key: string]: string } = {
      admin: "Admin",
      mod_finance: "Mod Tài Chính",
      mod_challenge: "Mod Thử Thách",
      mod_member: "Mod Thành Viên",
      member: "Thành Viên",
    };
    return labels[role] || role;
  };

  const getRoleBadgeColor = (role: string): string => {
    const colors: { [key: string]: string } = {
      admin: "bg-red-100 text-red-700",
      mod_finance: "bg-blue-100 text-blue-700",
      mod_challenge: "bg-purple-100 text-purple-700",
      mod_member: "bg-green-100 text-green-700",
      member: "bg-gray-100 text-gray-700",
    };
    return colors[role] || "bg-gray-100 text-gray-700";
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={32} className="text-orange-600" />
            <h1 className="text-2xl font-bold text-gray-900">Hải Lăng Runners</h1>
          </div>
          <nav className="flex items-center gap-6">
            {user ? (
              <>
                <a
                  href="/dashboard"
                  className="text-gray-700 hover:text-orange-600 transition font-medium"
                >
                  Bảng xếp hạng
                </a>
                <a
                  href="/challenges"
                  className="text-gray-700 hover:text-orange-600 transition font-medium"
                >
                  Thử thách
                </a>
                <a
                  href="/events"
                  className="text-gray-700 hover:text-orange-600 transition font-medium"
                >
                  Sự kiện
                </a>
                <a
                  href="/hall-of-fame"
                  className="text-gray-700 hover:text-orange-600 transition font-medium"
                >
                  Danh vọng
                </a>
                <a
                  href="/profile"
                  className="text-gray-700 hover:text-orange-600 transition font-medium"
                >
                  Tài khoản
                </a>
                {profile?.role && ["admin", "mod_finance", "mod_challenge", "mod_member"].includes(profile.role) && (
                  <a
                    href="/admin"
                    className="text-white bg-orange-600 hover:bg-orange-700 px-3 py-1.5 rounded-lg transition font-semibold text-sm"
                  >
                    Quản trị
                  </a>
                )}
              </>
            ) : null}
            {user && (
              <div className="flex items-center gap-3 pl-4 border-l border-gray-300">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">
                      {profile?.full_name || user.email}
                    </span>
                  </div>
                  {profile?.role && (
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 ${getRoleBadgeColor(profile.role)}`}>
                      {getRoleLabel(profile.role)}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Đăng xuất"
                >
                  <LogOut size={16} />
                  <span>Thoát</span>
                </button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
