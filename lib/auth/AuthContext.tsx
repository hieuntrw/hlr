"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
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
  fullLoadAttempted?: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fullLoadAttempted = useRef(false);
  const [fullLoadAttemptedFlag, setFullLoadAttemptedFlag] = useState(false);

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
    // Fallback: if auth verification stalls, ensure we stop loading and retry earlier
    const timeoutId = setTimeout(() => {
      if (mounted.current) {
        console.warn('[AuthContext] Fallback timeout reached, forcing isLoading=false and triggering load');
        setIsLoading(false);
        // attempt a fresh load to recover, but only once to avoid loops
        try {
          if (!fullLoadAttempted.current) {
            fullLoadAttempted.current = true;
            setFullLoadAttemptedFlag(true);
            loadUserData(mounted).catch(() => {});
          } else {
            console.warn('[AuthContext] Full load already attempted, skipping repeated attempt');
          }
        } catch (e) {
          console.warn('[AuthContext] Error scheduling full load', e);
        }
      }
    }, 5000);

    const cached = getCachedAuth();
    const isRecent = cached && cached.expiresAt && Date.now() < cached.expiresAt;

    if (cached && cached.user && isRecent) {
      console.log('[AuthContext] Using cached auth from localStorage');
      setUser(cached.user);
      setProfile(cached.profile);
      setIsLoading(false);
      // Verify session with Supabase in background without blocking the UI.
      // If the background check fails (network timeout or other), keep using the
      // cached auth since the cookie/local session is still valid.
      try {
        try { clearTimeout(timeoutId); } catch (e) {}
        (async () => {
          try {
            const { data: { user: authUser }, error } = await supabase.auth.getUser();
            if (!mounted.current) return;
            if (error || !authUser) {
              console.warn('[AuthContext] Supabase session invalid during background check, clearing cache');
              setUser(null);
              setProfile(null);
              setIsLoading(false);
              clearCachedAuth();
            } else {
              if (!cached.profile || cached.user.id !== authUser.id) {
                try {
                  const { data: profileData } = await supabase
                    .from("profiles")
                    .select("id, full_name, role")
                    .eq("id", authUser.id)
                    .single();
                  if (!mounted.current) return;
                  const profile = {
                    id: authUser.id,
                    full_name: profileData?.full_name || null,
                    role: authUser.user_metadata?.role || profileData?.role
                  };
                  setProfile(profile);
                  setCachedAuth(authUser, profile);
                } catch (e) {
                  console.warn('[AuthContext] Failed to refresh profile after cached auth', e);
                }
              }
            }
          } catch (e) {
            // Network or other error: keep cached auth and schedule a background refresh
            console.warn('[AuthContext] Background supabase.getUser failed; keeping cached auth', e);
            if (!fullLoadAttempted.current) {
              fullLoadAttempted.current = true;
              setFullLoadAttemptedFlag(true);
              // schedule a non-blocking full reload attempt
              loadUserData(mounted).catch(() => {});
            }
          }
        })();
      } catch (e) {
        console.error('[AuthContext] Unexpected error scheduling background auth check', e);
      }
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

  const value = { user, profile, isLoading, isAdmin, isMod, refreshAuth, fullLoadAttempted: fullLoadAttemptedFlag };

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

// Optional hook: returns context or undefined when not inside provider
export function useAuthOptional() {
  return useContext(AuthContext);
}
