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

  // Get cached auth data for instant rendering
  const getCachedAuth = () => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = sessionStorage.getItem('hlr_auth_cache');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const setCachedAuth = (userData: User | null, profileData: Profile | null) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem('hlr_auth_cache', JSON.stringify({ 
        user: userData, 
        profile: profileData,
        timestamp: Date.now() 
      }));
    } catch {}
  };

  const clearCachedAuth = () => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem('hlr_auth_cache');
    } catch {}
  };

  const loadUserData = async (mounted: { current: boolean }) => {
    console.log('[AuthContext] Starting loadUserData...');
    try {
      console.log('[AuthContext] Calling supabase.auth.getUser()...');
      const { data: { user: authUser }, error } = await supabase.auth.getUser();
      console.log('[AuthContext] getUser response:', { user: authUser?.id, error: error?.message });
      
      if (!mounted.current) return;
      
      if (error || !authUser) {
        console.log('[AuthContext] No user or error, setting loading to false');
        if (mounted.current) {
          setUser(null);
          setProfile(null);
          setIsLoading(false);
          clearCachedAuth();
        }
        return;
      }

      setUser(authUser);
      console.log('[AuthContext] User set, loading profile...');

      // Load profile data
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", authUser.id)
        .single();

      console.log('[AuthContext] Profile loaded:', profileData?.full_name);

      if (!mounted.current) return;

      const profile: Profile = {
        id: authUser.id,
        full_name: profileData?.full_name || null,
        role: authUser.user_metadata?.role || profileData?.role
      };

      setProfile(profile);
      setCachedAuth(authUser, profile);
      console.log('[AuthContext] Auth context ready');
    } catch (error) {
      console.error('[AuthContext] Error loading user:', error);
      if (mounted.current) {
        setUser(null);
        setProfile(null);
      }
    } finally {
      if (mounted.current) {
        console.log('[AuthContext] Setting isLoading to false');
        setIsLoading(false);
      }
    }
  };

  const refreshAuth = async () => {
    const mounted = { current: true };
    await loadUserData(mounted);
  };

  useEffect(() => {
    const mounted = { current: true };

    // Safety timeout: if loading takes more than 10 seconds, force it to complete
    const timeoutId = setTimeout(() => {
      if (mounted.current) {
        console.warn('[AuthContext] Loading timeout - forcing isLoading to false');
        setIsLoading(false);
      }
    }, 10000);

    // Load cached data immediately for instant rendering
    const cached = getCachedAuth();
    console.log('[AuthContext] Checking cache...', cached ? 'Found' : 'Not found');
    if (cached && cached.user) {
      // Only use cache if less than 5 minutes old
      const isRecent = cached.timestamp && (Date.now() - cached.timestamp < 5 * 60 * 1000);
      console.log('[AuthContext] Cache recent?', isRecent);
      if (isRecent) {
        console.log('[AuthContext] Using cached auth, setting isLoading = false');
        setUser(cached.user);
        setProfile(cached.profile);
        setIsLoading(false); // ✅ Set loading to false immediately when using cache
      }
    }

    // Load fresh data from Supabase (will update cache)
    loadUserData(mounted).then(() => {
      clearTimeout(timeoutId);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted.current) return;

      console.log('[AuthContext] Auth state changed:', event);

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        clearCachedAuth();
      } else if (event === 'SIGNED_IN' && session?.user) {
        await loadUserData(mounted);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Update user data on token refresh
        setUser(session.user);
        // Profile data should still be valid
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

  const isAdmin = user?.user_metadata?.role === 'admin' || profile?.role === 'admin';
  const isMod = user?.user_metadata?.role ? 
    ['admin', 'mod_finance', 'mod_challenge', 'mod_member'].includes(user.user_metadata.role) :
    false;

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, isAdmin, isMod, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Optional: Export a hook that returns null if not in provider (for gradual migration)
export function useAuthOptional() {
  return useContext(AuthContext);
}
