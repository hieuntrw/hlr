"use client";

import { Activity, LogOut, User, Menu, X, Shield, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth/AuthContext";

// Common Header Component for all pages
export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { darkMode, toggleDarkMode } = useTheme();
  const { user, profile, isLoading } = useAuth(); // Use AuthContext instead of local state

  const handleLogout = async () => {
    try {
      // Clear all caches
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('hlr_user_cache');
          sessionStorage.removeItem('hlr_auth_cache');
        } catch {}
      }
      
      // Call logout API to clear cookies
      await fetch('/api/auth/logout', { method: 'POST' });
      
      // Also sign out from Supabase client (AuthContext will handle state updates)
      await supabase.auth.signOut();
      
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
    // Use empty string, will use inline styles instead
    return "";
  };
  
  const getRoleBadgeStyle = (role: string): React.CSSProperties => {
    const styles: Record<string, React.CSSProperties> = {
      admin: { backgroundColor: 'var(--color-error)', color: 'white', opacity: 0.9 },
      mod_finance: { backgroundColor: 'var(--color-primary)', color: 'white', opacity: 0.85 },
      mod_challenge: { backgroundColor: 'var(--color-info)', color: 'white', opacity: 0.85 },
      mod_member: { backgroundColor: 'var(--color-success)', color: 'white', opacity: 0.85 },
      member: { backgroundColor: 'var(--color-border-dark)', color: 'var(--color-text-primary)' },
    };
    return styles[role] || { backgroundColor: 'var(--color-border-dark)', color: 'var(--color-text-primary)' };
  };

  const isActive = (path: string) => pathname === path;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="/dashboard" className="flex items-center gap-2 shrink-0">
            <Activity size={32} style={{ color: "var(--color-primary)" }} />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 hidden sm:block">Hải Lăng Runners</h1>
            <h1 className="text-xl font-bold text-gray-900 sm:hidden">HLR</h1>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {user ? (
              <>
                <a
                  href="/challenges"
                  className="px-2 py-1.5 rounded-lg text-xs font-medium transition"
                  style={isActive('/challenges') 
                    ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                    : { color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => !isActive('/challenges') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                  onMouseLeave={(e) => !isActive('/challenges') && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Thử thách
                </a>
                <a
                  href="/hall-of-fame"
                  className="px-2 py-1.5 rounded-lg text-xs font-medium transition"
                  style={isActive('/hall-of-fame') 
                    ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                    : { color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => !isActive('/hall-of-fame') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                  onMouseLeave={(e) => !isActive('/hall-of-fame') && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Bảng vàng
                </a>
                <a
                  href="/races"
                  className="px-2 py-1.5 rounded-lg text-xs font-medium transition"
                  style={isActive('/races') 
                    ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                    : { color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => !isActive('/races') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                  onMouseLeave={(e) => !isActive('/races') && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Races
                </a>
                <a
                  href="/rewards"
                  className="px-2 py-1.5 rounded-lg text-xs font-medium transition"
                  style={isActive('/rewards') 
                    ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                    : { color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => !isActive('/rewards') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                  onMouseLeave={(e) => !isActive('/rewards') && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Quà tặng
                </a>
                <a
                  href="/finance"
                  className="px-2 py-1.5 rounded-lg text-xs font-medium transition"
                  style={isActive('/finance') 
                    ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                    : { color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => !isActive('/finance') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                  onMouseLeave={(e) => !isActive('/finance') && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Quỹ CLB
                </a>
                <a
                  href="/rules"
                  className="px-2 py-1.5 rounded-lg text-xs font-medium transition"
                  style={isActive('/rules') 
                    ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                    : { color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => !isActive('/rules') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                  onMouseLeave={(e) => !isActive('/rules') && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Quy định
                </a>
                <a
                  href="/profile"
                  className="px-2 py-1.5 rounded-lg text-xs font-medium transition"
                  style={isActive('/profile') 
                    ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                    : { color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => !isActive('/profile') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                  onMouseLeave={(e) => !isActive('/profile') && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Thành viên
                </a>
                {user?.user_metadata?.role && ["admin", "mod_finance", "mod_challenge", "mod_member"].includes(user.user_metadata.role) && (
                  <a
                    href="/admin"
                    className="ml-2 px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1"
                    style={{ background: "var(--color-primary)", color: "var(--color-text-inverse)" }}
                  >
                    <Shield size={16} />
                    Quản trị
                  </a>
                )}
                <div className="flex flex-col items-end gap-1 ml-4 pl-4 border-l" style={{ borderColor: "var(--color-border)" }}>
                  {/* Row 1: Email + Role Badge */}
                  <div className="flex items-center gap-1.5">
                    <User size={16} style={{ color: "var(--color-text-secondary)" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {user.email}
                    </span>
                    {user?.user_metadata?.role && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={getRoleBadgeStyle(user.user_metadata.role)}>
                        {getRoleLabel(user.user_metadata.role)}
                      </span>
                    )}
                  </div>
                  
                  {/* Row 2: Theme Settings + Dark Mode + Logout */}
                  <div className="flex items-center gap-2">
                    <a
                      href="/profile/theme"
                      className="text-xs hover:opacity-80 transition"
                      style={{ color: "var(--color-text-secondary)" }}
                      title="Cài đặt giao diện"
                    >
                      🎨 Theme
                    </a>
                    <span style={{ color: "var(--color-border)" }}>|</span>
                    <button
                      onClick={toggleDarkMode}
                      className="text-xs hover:opacity-80 transition flex items-center gap-1"
                      style={{ color: "var(--color-text-secondary)" }}
                      title={darkMode ? "Chế độ sáng" : "Chế độ tối"}
                    >
                      {darkMode ? <Sun size={14} /> : <Moon size={14} />}
                      {darkMode ? "Sáng" : "Tối"}
                    </button>
                    <span style={{ color: "var(--color-border)" }}>|</span>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 text-xs hover:opacity-80 transition"
                      style={{ color: "var(--color-error)" }}
                      title="Đăng xuất"
                    >
                      <LogOut size={14} />
                      Thoát
                    </button>
                  </div>
                </div>
              </>
            ) : isLoading ? (
              // Show minimal loading state instead of login button during initial load
              <div className="flex items-center gap-2">
                <div className="w-20 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-border-light)' }}></div>
              </div>
            ) : (
              <a
                href="/login"
                className="px-4 py-2 rounded-lg transition font-semibold"
                style={{ background: "var(--color-primary)", color: "var(--color-text-inverse)" }}
              >
                Đăng nhập
              </a>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 transition"
            style={{ color: "var(--color-text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
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
                      <span className="text-xs px-2 py-0.5 rounded-full" style={getRoleBadgeStyle(user.user_metadata.role)}>
                        {getRoleLabel(user.user_metadata.role)}
                      </span>
                    )}
                    {/* Mobile Theme Settings & Dark Mode */}
                    <div className="flex items-center gap-3 mt-3">
                      <a
                        href="/profile/theme"
                        className="text-sm transition"
                        style={{ color: "var(--color-text-secondary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        🎨 Cài đặt theme
                      </a>
                      <button
                        onClick={toggleDarkMode}
                        className="text-sm transition flex items-center gap-1"
                        style={{ color: "var(--color-text-secondary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
                      >
                        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                        {darkMode ? "Sáng" : "Tối"}
                      </button>
                    </div>
                  </div>
                  <a
                    href="/challenges"
                    className="px-3 py-2 rounded-lg font-medium transition"
                    style={isActive('/challenges') 
                      ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                      : { color: 'var(--color-text-secondary)' }}
                    onMouseEnter={(e) => !isActive('/challenges') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                    onMouseLeave={(e) => !isActive('/challenges') && (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Thử thách
                  </a>
                  <a
                    href="/hall-of-fame"
                    className="px-3 py-2 rounded-lg font-medium transition"
                    style={isActive('/hall-of-fame') 
                      ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                      : { color: 'var(--color-text-secondary)' }}
                    onMouseEnter={(e) => !isActive('/hall-of-fame') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                    onMouseLeave={(e) => !isActive('/hall-of-fame') && (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Bảng vàng
                  </a>
                  <a
                    href="/races"
                    className="px-3 py-2 rounded-lg font-medium transition"
                    style={isActive('/races') 
                      ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                      : { color: 'var(--color-text-secondary)' }}
                    onMouseEnter={(e) => !isActive('/races') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                    onMouseLeave={(e) => !isActive('/races') && (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Races
                  </a>
                  <a
                    href="/rewards"
                    className="px-3 py-2 rounded-lg font-medium transition"
                    style={isActive('/rewards') 
                      ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                      : { color: 'var(--color-text-secondary)' }}
                    onMouseEnter={(e) => !isActive('/rewards') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                    onMouseLeave={(e) => !isActive('/rewards') && (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Quà tặng
                  </a>
                  <a
                    href="/finance"
                    className="px-3 py-2 rounded-lg font-medium transition"
                    style={isActive('/finance') 
                      ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                      : { color: 'var(--color-text-secondary)' }}
                    onMouseEnter={(e) => !isActive('/finance') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                    onMouseLeave={(e) => !isActive('/finance') && (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Quỹ CLB
                  </a>
                  <a
                    href="/rules"
                    className="px-3 py-2 rounded-lg font-medium transition"
                    style={isActive('/rules') 
                      ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                      : { color: 'var(--color-text-secondary)' }}
                    onMouseEnter={(e) => !isActive('/rules') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                    onMouseLeave={(e) => !isActive('/rules') && (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Quy định
                  </a>
                  <a
                    href="/profile"
                    className="px-3 py-2 rounded-lg font-medium transition"
                    style={isActive('/profile') 
                      ? { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-primary)' }
                      : { color: 'var(--color-text-secondary)' }}
                    onMouseEnter={(e) => !isActive('/profile') && (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')}
                    onMouseLeave={(e) => !isActive('/profile') && (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Thành viên
                  </a>
                  {user?.user_metadata?.role && ["admin", "mod_finance", "mod_challenge", "mod_member"].includes(user.user_metadata.role) && (
                    <a
                      href="/admin"
                      className="px-3 py-2 rounded-lg font-semibold text-center flex items-center justify-center gap-1 transition"
                      style={{ background: "var(--color-primary)", color: "var(--color-text-inverse)" }}
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
              ) : isLoading ? (
                // Show loading skeleton for mobile menu during initial load
                <div className="space-y-2">
                  <div className="h-10 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-border-light)' }}></div>
                  <div className="h-10 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-border-light)' }}></div>
                </div>
              ) : (
                <a
                  href="/login"
                  className="px-4 py-2 rounded-lg font-semibold text-center transition"
                  style={{ background: "var(--color-primary)", color: "var(--color-text-inverse)" }}
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
