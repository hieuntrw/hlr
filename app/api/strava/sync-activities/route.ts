import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from 'next/cache';
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import serverDebug from '@/lib/server-debug'
import { createClient } from '@supabase/supabase-js';

export const dynamic = "force-dynamic";

// Removed unused StravaActivity interface; keep runtime-flexible handling below.

export async function POST(request: NextRequest) {
  serverDebug.debug("[Strava Sync] Starting activity sync...");

  const cookieStore = await cookies();
  void request; // request may be unused in some flows; reference it to avoid lint unused-var
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value, ...(options || {}) });
          } catch {
            // Can't set cookies in API route
          }
        },
        remove(name: string, options?: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value: "", ...(options || {}) });
          } catch {
            // Can't remove cookies in API route
          }
        },
      },
    }
  );

  try {
    // Reconstruct session/user using shared helper (handles sb-session fallback)
    const { getUserFromAuthClient } = await import('@/lib/server-auth');
    const user = await getUserFromAuthClient(supabase, (name: string) => cookieStore.get(name)?.value);
    if (!user) {
      serverDebug.error('[Strava Sync] User not authenticated after reconstruction');
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    serverDebug.debug('[Strava Sync] User:', user.id);

    // Get valid Strava access token (auto-refreshes if expired)
    const { getValidStravaToken } = await import("@/lib/strava-token");
    const accessToken = await getValidStravaToken(user.id);

    if (!accessToken) {
      serverDebug.error("[Strava Sync] No valid Strava token for user:", user.id);
      try {
        const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY! , { auth: { persistSession: false } });
        const { data: profile, error: pErr } = await svc.from('profiles').select('id,strava_id,strava_access_token,strava_refresh_token,strava_token_expires_at').eq('id', user.id).limit(1).maybeSingle();
        serverDebug.debug('[Strava Sync] profile snapshot for user', { userId: user.id, profile, profileError: pErr?.message ?? null });
      } catch (e) {
        serverDebug.warn('[Strava Sync] failed to snapshot profile for debug', e);
      }
      return NextResponse.json(
        { error: "Strava not connected or token invalid" },
        { status: 400 }
      );
    }

    // Delegate to the canonical service which enforces challenge bounds,
    // pace filters, upserts activities and updates challenge_participants.
    // This prevents duplicating filter logic here and ensures VN timezone rules
    // are applied consistently.
    const { syncUserActivitiesForCurrentMonth } = await import("@/lib/services/stravaService");

    try {
      const result = await syncUserActivitiesForCurrentMonth(user.id);
      try {
        revalidatePath('/challenges');
        revalidatePath('/dashboard');
      } catch (e) {
        serverDebug.warn('[Strava Sync] revalidatePath failed', String(e));
      }
      return NextResponse.json({ success: true, message: 'Synced via service', data: result });
      } catch (err: unknown) {
        serverDebug.error('[Strava Sync] Service sync failed:', String(err));
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
  } catch (error) {
    serverDebug.error("[Strava Sync] Unexpected error:", String(error));
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
