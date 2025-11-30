"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // User is logged in, redirect to dashboard
        router.push("/dashboard");
      } else {
        // User not logged in, redirect to login
        router.push("/login");
      }
    })();
  }, [router]);

  // Show loading state while checking auth
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="text-6xl mb-4">🏃‍♀️</div>
        <h1 className="text-3xl font-bold mb-2">Hải Lăng Runners</h1>
        <p className="text-orange-100">Đang tải...</p>
      </div>
    </div>
  );
}
