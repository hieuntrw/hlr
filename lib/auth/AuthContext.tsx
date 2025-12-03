"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase-client";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  full_name: string | null;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isMod: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use localStorage for persistent session (30 days)
  const CACHE_KEY = 'hlr_auth_cache';
  const CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  const getCachedAuth = () => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      // Check expiresAt
      if (!parsed.expiresAt || Date.now() > parsed.expiresAt) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const setCachedAuth = (userData: User | null, profileData: Profile | null) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        user: userData,
        profile: profileData,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_DURATION_MS
      }));
    } catch {}
  };

  const clearCachedAuth = () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
  };

  const loadUserData = async (mounted: { current: boolean }) => {
    const startAll = performance.now();
    console.log('[AuthContext] PERF: loadUserData start', startAll);
    try {
      // Use cache if available and recent
      const cached = getCachedAuth();
      const isRecent = cached && cached.timestamp && (Date.now() - cached.timestamp < 5 * 60 * 1000);
      if (cached && cached.user && isRecent) {
        setUser(cached.user);
        setProfile(cached.profile);
        setIsLoading(false);
        console.log('[AuthContext] PERF: used cached auth, duration:', (performance.now() - startAll).toFixed(2), 'ms');
        return;
      }
      // Only fetch if cache is missing or expired
      const startGetUser = performance.now();
      const { data: { user: authUser }, error } = await supabase.auth.getUser();
      const endGetUser = performance.now();
      console.log('[AuthContext] PERF: getUser end', endGetUser, 'duration:', (endGetUser - startGetUser).toFixed(2), 'ms');
      if (!mounted.current) return;
      if (error || !authUser) {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        clearCachedAuth();
        return;
      }
      setUser(authUser);
      const startProfile = performance.now();
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", authUser.id)
        .single();
      const endProfile = performance.now();
      console.log('[AuthContext] PERF: profile query end', endProfile, 'duration:', (endProfile - startProfile).toFixed(2), 'ms');
      if (!mounted.current) return;
      const profile = {
        id: authUser.id,
        full_name: profileData?.full_name || null,
        role: authUser.user_metadata?.role || profileData?.role
      };
      setProfile(profile);
      setCachedAuth(authUser, profile);
    } catch (error) {
      setUser(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
      console.log('[AuthContext] PERF: loadUserData end', performance.now(), 'total duration:', (performance.now() - startAll).toFixed(2), 'ms');
    }
  };

  const refreshAuth = async () => {
    const mounted = { current: true };
    await loadUserData(mounted);
  };

  // OPTIMIZED: Always verify session with Supabase on app load, even if cache is valid
  useEffect(() => {
    const mounted = { current: true };
    const timeoutId = setTimeout(() => {
      if (mounted.current) {
        setIsLoading(false);
      }
    }, 10000);

    const cached = getCachedAuth();
    const isRecent = cached && cached.expiresAt && Date.now() < cached.expiresAt;

    if (cached && cached.user && isRecent) {
      setUser(cached.user);
      setProfile(cached.profile);
      setIsLoading(false);
      // Xác thực lại session với Supabase để đảm bảo hợp lệ
      supabase.auth.getUser().then(({ data: { user: authUser }, error }) => {
        if (!mounted.current) return;
        if (error || !authUser) {
          // Session không hợp lệ, xóa cache và yêu cầu đăng nhập lại
          setUser(null);
          setProfile(null);
          setIsLoading(false);
          clearCachedAuth();
        } else {
          // Nếu user hợp lệ, có thể cập nhật lại profile nếu cần
          // (Chỉ fetch profile nếu user id khác hoặc cache hết hạn)
          if (!cached.profile || cached.user.id !== authUser.id) {
            supabase
              .from("profiles")
              .select("id, full_name, role")
              .eq("id", authUser.id)
              .single()
              .then(({ data: profileData }) => {
                if (!mounted.current) return;
                const profile = {
                  id: authUser.id,
                  full_name: profileData?.full_name || null,
                  role: authUser.user_metadata?.role || profileData?.role
                };
                setProfile(profile);
                setCachedAuth(authUser, profile);
              });
          }
        }
      });
    } else {
      // Không có cache hoặc cache hết hạn, xác thực lại như cũ
      loadUserData(mounted).then(() => {
        clearTimeout(timeoutId);
      });
    }

    // Lắng nghe sự kiện Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted.current) return;
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        clearCachedAuth();
      } else if (event === 'SIGNED_IN' && session?.user) {
        await loadUserData(mounted);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
        if (profile) {
          setCachedAuth(session.user, profile);
        }
      }
    });

    return () => {
      mounted.current = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = user?.user_metadata?.role === 'admin';
  const isMod = user?.user_metadata?.role === 'mod';

  const value = { user, profile, isLoading, isAdmin, isMod, refreshAuth };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
