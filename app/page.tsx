"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth/AuthContext";

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  console.log('[Home] Render - authLoading:', authLoading, 'user:', user?.id);

  useEffect(() => {
    console.log('[Home] useEffect - authLoading:', authLoading, 'user:', user?.id);
    
    // Wait for auth to finish loading
    if (authLoading) {
      console.log('[Home] Still loading auth, waiting...');
      return;
    }
    
    // Check if user is logged in and redirect
    if (user) {
      // User is logged in, redirect to dashboard
      console.log('[Home] User found, redirecting to /dashboard');
      router.push("/dashboard");
    } else {
      // User not logged in, redirect to login
      console.log('[Home] No user, redirecting to /login');
      router.push("/login");
    }
  }, [user, authLoading]); // Remove router from dependencies to avoid re-runs

  // Show loading state while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center gradient-theme-primary">
      <div className="text-center text-white">
        <div className="text-6xl mb-4">🏃‍♀️</div>
        <h1 className="text-3xl font-bold mb-2">Hải Lăng Runners</h1>
        <p className="opacity-80">Đang tải...</p>
      </div>
    </div>
  );
}
