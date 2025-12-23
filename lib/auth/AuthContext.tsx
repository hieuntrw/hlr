"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import AuthVerifying from "@/components/AuthVerifying";
import { supabase } from "@/lib/supabase-client";
import { getEffectiveRole, isAdminRole, isModRole } from "@/lib/auth/role";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  full_name: string | null;
  role?: string;
  avatar_url?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isMod: boolean;
  refreshAuth: () => Promise<void>;
  fullLoadAttempted?: boolean;
  sessionChecked?: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CACHE_KEY = "hlr_auth_cache_v1";
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function getCachedAuth(): { profile?: Profile; expiresAt?: number } | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function setCachedAuth(profile: Profile) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ profile, expiresAt: Date.now() + 5 * 60 * 1000 })); } catch {}
}
function clearCachedAuth() { try { localStorage.removeItem(CACHE_KEY); } catch {} }

function getRoleFromUser(u: User | null): string | undefined {
  if (!u) return undefined;
  const uobj = u as unknown;
  if (!isRecord(uobj)) return undefined;
  const am = (uobj as Record<string, unknown>).app_metadata;
  if (isRecord(am) && typeof (am as Record<string, unknown>).role === "string") return (am as Record<string, unknown>).role as string;
  return undefined;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const fullLoadAttempted = useRef(false);
  const mounted = useRef(true);

  async function fetchProfileForUser(u: User): Promise<Profile> {
    try {
      const res = await fetch(`/api/profiles/${u.id}`, { credentials: "same-origin" });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (isRecord(body) && isRecord(body.profile)) {
          const p = body.profile as Record<string, unknown>;
          const full_name = typeof p.full_name === "string" ? (p.full_name as string) : null;
          const role = getRoleFromUser(u);
          return { id: u.id, full_name, role };
        }
      }
    } catch {}
    const uobj = u as unknown;
    if (isRecord(uobj)) {
      const um = (uobj as Record<string, unknown>).user_metadata;
      const full_name = isRecord(um) && typeof (um as Record<string, unknown>).fullName === "string" ? (um as Record<string, unknown>).fullName as string : null;
      return { id: u.id, full_name, role: getRoleFromUser(u) };
    }
    return { id: u.id, full_name: null };
  }

  const load = async () => {
    if (!mounted.current) return;
    setIsLoading(true);
    try {
      const { data: { user: supUser } } = await supabase.auth.getUser();
      let resolved: User | null = supUser ?? null;
      if (!resolved) {
        try {
          const resp = await fetch("/api/auth/whoami", { credentials: "same-origin" });
          if (resp.ok) {
            const j = await resp.json().catch(() => null);
            if (isRecord(j) && j.ok && isRecord(j.user)) resolved = j.user as unknown as User;
          }
        } catch {}
      }

      // If whoami returned a reconstructed user but the browser supabase client
      // still has no session, try to restore a minimal session using the
      // `sb-access-token` cookie so client PostgREST requests are authorized.
      if (!resolved) {
        // no-op
      } else {
        try {
          const clientUser = await supabase.auth.getUser();
          if (!clientUser.data.user) {
            const r = await fetch('/api/auth/restore', { credentials: 'same-origin' });
            if (r.ok) {
              const body = await r.json().catch(() => null);
              if (isRecord(body) && typeof body.access_token === 'string') {
                try {
                  await supabase.auth.setSession({ access_token: body.access_token, refresh_token: typeof body.refresh_token === 'string' ? body.refresh_token : '' });
                } catch {
                  // ignore setSession failures; we'll still use reconstructed user
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }

      if (!mounted.current) return;
      setUser(resolved);
      if (!resolved) { setProfile(null); clearCachedAuth(); return; }
      const p = await fetchProfileForUser(resolved);
      if (!mounted.current) return;
      setProfile(p);
      setCachedAuth(p);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[AuthContext] load error", err);
    } finally {
      if (!mounted.current) return;
      setIsLoading(false);
      setSessionChecked(true);
      if (!fullLoadAttempted.current) fullLoadAttempted.current = true;
    }
  };

  useEffect(() => {
    mounted.current = true;
    const cached = getCachedAuth();
    const valid = cached && !!cached.expiresAt && Date.now() < cached.expiresAt;
    if (valid && cached?.profile) {
      setProfile(cached.profile as Profile);
      setIsLoading(false);
      // Do not mark sessionChecked true here; wait for `load()` to verify
      // the actual auth session via `/api/auth/whoami` to avoid races where
      // UI redirects run before server-side session reconstruction completes.
      void load();
    } else {
      void load();
    }

    // Allow unused first param from Supabase callback
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted.current) return;
      if (!session) {
        setUser(null);
        setProfile(null);
        clearCachedAuth();
        setIsLoading(false);
      } else {
        void load();
      }
    });

    return () => { mounted.current = false; try { subscription.unsubscribe(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthContextType = {
    user,
    profile,
    isLoading,
    isAdmin: isAdminRole(getEffectiveRole(user)),
    isMod: isModRole(getEffectiveRole(user)),
    refreshAuth: load,
    fullLoadAttempted: fullLoadAttempted.current,
    sessionChecked,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {!sessionChecked ? (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.8)", zIndex: 9999 }}>
          <AuthVerifying />
        </div>
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used within an AuthProvider");
  return c;
}

export function useAuthOptional() { return useContext(AuthContext); }
