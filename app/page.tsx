"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

export default function Home() {
  const { user, profile, isLoading: authLoading, sessionChecked } = useAuth();
  const router = useRouter();

  console.log('[Home] Render - authLoading:', authLoading, 'user:', user?.id);

  useEffect(() => {
    console.log('[Home] useEffect - authLoading:', authLoading, 'user:', user?.id);
    
    // Wait for auth verification to complete (including server whoami)
    if (authLoading || !sessionChecked) {
      console.log('[Home] Still loading auth or session check pending, waiting...', { authLoading, sessionChecked });
      return;
    }
    
    // Check if user (or a cached profile) is present and redirect
    // Use `profile` as an authoritative client-side indicator when the
    // Supabase client hasn't yet reconstructed a full `user` object from
    // HttpOnly cookies (whoami fallback / server session reconstruction).
    if (user || profile) {
      // User is logged in, redirect to dashboard
      console.log('[Home] User found, redirecting to /dashboard');
      router.push("/dashboard");
    } else {
      // User not logged in, redirect to login
      console.log('[Home] No user, redirecting to /login');
      router.push("/login");
    }
  }, [user, profile, authLoading, sessionChecked, router]);

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
