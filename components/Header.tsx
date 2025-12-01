"use client";

import { Activity, LogOut, User, Menu, X, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { usePathname } from "next/navigation";

// Common Header Component for all pages
export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Get current user
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[Header] User loaded:', user?.email, 'Role:', user?.user_metadata?.role);
      setUser(user);

      if (user) {
        // Get user profile for display info (full_name only)
        const { data } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        console.log('[Header] Profile loaded:', data?.full_name);
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
        console.log('[Header] User signed in:', session.user?.email, 'Role:', session.user?.user_metadata?.role);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      // Call logout API to clear cookies
      await fetch('/api/auth/logout', { method: 'POST' });
      
      // Also sign out from Supabase client
      await supabase.auth.signOut();
      
      setUser(null);
      setProfile(null);
      
      // Force reload to clear all state
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Even on error, try to redirect
      window.location.href = '/login';
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
      mod_finance: "bg-orange-100 text-orange-700",
      mod_challenge: "bg-purple-100 text-purple-700",
      mod_member: "bg-green-100 text-green-700",
      member: "bg-gray-100 text-gray-700",
    };
    return colors[role] || "bg-gray-100 text-gray-700";
  };

  const isActive = (path: string) => pathname === path;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="/dashboard" className="flex items-center gap-2 shrink-0">
            <Activity size={32} className="text-orange-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 hidden sm:block">Hải Lăng Runners</h1>
            <h1 className="text-xl font-bold text-gray-900 sm:hidden">HLR</h1>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {user ? (
              <>
                <a
                  href="/challenges"
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive('/challenges') 
                      ? 'bg-orange-50 text-orange-600' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Thử thách
                </a>
                <a
                  href="/hall-of-fame"
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive('/hall-of-fame') 
                      ? 'bg-orange-50 text-orange-600' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Bảng vàng
                </a>
                <a
                  href="/races"
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive('/races') 
                      ? 'bg-orange-50 text-orange-600' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Races
                </a>
                <a
                  href="/rewards"
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive('/rewards') 
                      ? 'bg-orange-50 text-orange-600' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Quà tặng
                </a>
                <a
                  href="/finance"
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive('/finance') 
                      ? 'bg-orange-50 text-orange-600' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Quỹ CLB
                </a>
                <a
                  href="/rules"
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive('/rules') 
                      ? 'bg-orange-50 text-orange-600' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Quy định
                </a>
                <a
                  href="/profile"
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive('/profile') 
                      ? 'bg-orange-50 text-orange-600' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Thành viên
                </a>
                {user?.user_metadata?.role && ["admin", "mod_finance", "mod_challenge", "mod_member"].includes(user.user_metadata.role) && (
                  <a
                    href="/admin"
                    className="ml-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1"
                  >
                    <Shield size={16} />
                    Quản trị
                  </a>
                )}
                <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">
                        {profile?.full_name || user.email}
                      </span>
                    </div>
                    {user?.user_metadata?.role && (
                      <span className={`text-xs px-2 py-0.5 rounded-full mt-1 ${getRoleBadgeColor(user.user_metadata.role)}`}>
                        {getRoleLabel(user.user_metadata.role)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Đăng xuất"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              </>
            ) : (
              <a
                href="/login"
                className="text-white bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg transition font-semibold"
              >
                Đăng nhập
              </a>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden text-gray-700 hover:text-orange-600 p-2"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute left-0 right-0 top-full bg-white border-b border-gray-200 shadow-lg">
            <nav className="flex flex-col p-4 space-y-2">
              {user ? (
                <>
                  <div className="pb-3 mb-3 border-b border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <User size={20} className="text-gray-600" />
                      <span className="font-medium text-gray-900">
                        {profile?.full_name || user.email}
                      </span>
                    </div>
                    {user?.user_metadata?.role && (
                      <span className={`inline-block text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(user.user_metadata.role)}`}>
                        {getRoleLabel(user.user_metadata.role)}
                      </span>
                    )}
                  </div>
                  <a
                    href="/challenges"
                    className={`px-3 py-2 rounded-lg font-medium ${
                      isActive('/challenges')
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Thử thách
                  </a>
                  <a
                    href="/hall-of-fame"
                    className={`px-3 py-2 rounded-lg font-medium ${
                      isActive('/hall-of-fame')
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Bảng vàng
                  </a>
                  <a
                    href="/races"
                    className={`px-3 py-2 rounded-lg font-medium ${
                      isActive('/races')
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Races
                  </a>
                  <a
                    href="/rewards"
                    className={`px-3 py-2 rounded-lg font-medium ${
                      isActive('/rewards')
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Quà tặng
                  </a>
                  <a
                    href="/finance"
                    className={`px-3 py-2 rounded-lg font-medium ${
                      isActive('/finance')
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Quỹ CLB
                  </a>
                  <a
                    href="/rules"
                    className={`px-3 py-2 rounded-lg font-medium ${
                      isActive('/rules')
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Quy định
                  </a>
                  <a
                    href="/profile"
                    className={`px-3 py-2 rounded-lg font-medium ${
                      isActive('/profile')
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Thành viên
                  </a>
                  {user?.user_metadata?.role && ["admin", "mod_finance", "mod_challenge", "mod_member"].includes(user.user_metadata.role) && (
                    <a
                      href="/admin"
                      className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold text-center flex items-center justify-center gap-1"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Shield size={16} />
                      Quản trị
                    </a>
                  )}
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition font-medium mt-2"
                  >
                    <LogOut size={18} />
                    <span>Đăng xuất</span>
                  </button>
                </>
              ) : (
                <a
                  href="/login"
                  className="text-white bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg font-semibold text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Đăng nhập
                </a>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
