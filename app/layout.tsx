"use client";
import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { useEffect, useState } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    // Check login state via Supabase
    import("@/lib/supabase-client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        setIsLoggedIn(!!data.user);
      });
    });
  }, []);

  return (
    <html lang="vi">
      <body className="bg-gray-50">
        <div className="flex h-screen">
          <Navigation isMobile={isMobile} isLoggedIn={isLoggedIn} />
          <main className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
