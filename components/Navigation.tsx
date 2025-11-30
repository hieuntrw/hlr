"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  requiredRoles?: string[];
}

const publicNavItems: NavItem[] = [
  { label: "Tổng quan", href: "/dashboard", icon: "📊" },
  { label: "Bảng Vàng", href: "/hall-of-fame", icon: "🏆" },
  { label: "Thử Thách", href: "/challenges", icon: "🏃" },
  { label: "Sự Kiện", href: "/events", icon: "📅" },
  { label: "Hồ Sơ", href: "/profile", icon: "👤" },
];

const adminNavItems: NavItem[] = [
  {
    label: "Quản Trị",
    href: "/admin",
    icon: "⚙️",
    requiredRoles: ["admin", "mod_finance", "mod_challenge", "mod_member"],
  },
];

interface UserProfile {
  id: string;
  role?: string;
}

export default function Navigation() {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Check if mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load user profile
  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUserProfile(profile);
        }
      }
    }

    loadProfile();
  }, []);

  // Filter visible items based on role
  const visibleItems = [
    ...publicNavItems,
    ...adminNavItems.filter((item) => {
      if (!item.requiredRoles) return true;
      return item.requiredRoles.includes(userProfile?.role || "member");
    }),
  ];

  const isActive = (href: string) => pathname === href;

  if (isMobile) {
    // Bottom Bar for Mobile
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg md:hidden">
        <div className="flex justify-around items-center h-16">
          {visibleItems.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive(item.href)
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => setShowMobileMenu(false)}
            >
              <span className="text-xl mb-1">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}

          {/* Menu for additional items */}
          {visibleItems.length > 5 && (
            <div className="relative flex flex-col items-center justify-center flex-1 h-full">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className={`flex flex-col items-center justify-center transition-colors ${
                  showMobileMenu
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span className="text-xl mb-1">⋯</span>
                <span className="text-xs font-medium">More</span>
              </button>

              {/* Dropdown menu */}
              {showMobileMenu && (
                <div className="absolute bottom-full right-0 bg-white border border-gray-200 rounded-lg shadow-lg mb-2 w-40">
                  {visibleItems.slice(5).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block px-4 py-2 transition-colors ${
                        isActive(item.href)
                          ? "text-blue-600 bg-blue-50"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={() => setShowMobileMenu(false)}
                    >
                      {item.icon} {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    );
  }

  // Sidebar for Desktop
  return (
    <nav className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 h-full shadow-sm sticky top-0">
      {/* Logo / Header */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-blue-600">HLR Running</h1>
        <p className="text-xs text-gray-500 mt-1">Running Club</p>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              isActive(item.href)
                ? "bg-blue-100 text-blue-600 font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* User Info Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <p className="font-semibold text-gray-900">
            Role: <span className="text-blue-600 capitalize">{userProfile?.role || "member"}</span>
          </p>
        </div>
      </div>
    </nav>
  );
}
