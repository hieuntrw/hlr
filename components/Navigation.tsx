"use client";


import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./cn";
import { Home, Trophy, Flag, Calendar, Wallet, User, LogIn } from "lucide-react";

const icons = {
  home: <Home size={24} />,
  trophy: <Trophy size={24} />,
  running: <Flag size={24} />,
  calendar: <Calendar size={24} />,
  wallet: <Wallet size={24} />,
  user: <User size={24} />,
  login: <LogIn size={24} />,
};

const menu = [
  { label: "Trang chủ", href: "/dashboard", icon: icons.home },
  { label: "Bảng Vàng", href: "/hall-of-fame", icon: icons.trophy },
  { label: "Thử thách", href: "/challenges", icon: icons.running },
  { label: "Sự kiện", href: "/events", icon: icons.calendar },
  { label: "Tài chính", href: "/finance", icon: icons.wallet },
  { label: "Cá nhân", href: "/profile", icon: icons.user },
];

export default function Navigation({ isMobile, isLoggedIn }: { isMobile: boolean; isLoggedIn: boolean }) {
  const pathname = usePathname();

  if (!isLoggedIn) {
    return (
      <nav className="fixed bottom-0 left-0 w-full bg-[var(--color-bg)] border-t border-[var(--color-border)] flex justify-center z-50">
        <Link href="/login" className="flex flex-col items-center justify-center py-2 px-6 text-[var(--color-primary)]">
          {icons.login}
          <span className="text-xs mt-1">Đăng nhập</span>
        </Link>
      </nav>
    );
  }

  if (isMobile) {
    // Bottom Navigation
    return (
      <nav className="fixed bottom-0 left-0 w-full bg-[var(--color-bg)] border-t border-[var(--color-border)] flex justify-around z-50 shadow-lg">
        {menu.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center py-2 px-2 text-xs transition-all",
              pathname === item.href
                ? "text-[var(--color-primary)] font-bold"
                : "text-[var(--color-muted)]"
            )}
          >
            {item.icon}
            <span className="mt-1">{item.label}</span>
          </Link>
        ))}
      </nav>
    );
  }

  // Desktop: Sidebar (left) or Topbar
  return (
    <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-20 bg-[var(--color-bg)] border-r border-[var(--color-border)] z-40 shadow-lg">
      {menu.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex flex-col items-center justify-center py-6 text-xs transition-all",
            pathname === item.href
              ? "text-[var(--color-primary)] font-bold"
              : "text-[var(--color-muted)]"
          )}
        >
          {item.icon}
          <span className="mt-2">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
