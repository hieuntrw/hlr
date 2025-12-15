import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { exchangeCodeForToken } from "@/lib/strava-oauth";
import { cookies } from "next/headers";
import serverDebug from '@/lib/server-debug'

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  serverDebug.debug("[Strava Connect Callback] Starting...");
  
  const cookieStore = await cookies();
  const requestUrl = new URL(request.url);

  // Create Supabase client with cookies
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
                // Can't set cookies in middleware/edge
              }
        },
            remove(name: string, options?: Record<string, unknown>) {
              try {
                cookieStore.set({ name, value: "", ...(options || {}) });
              } catch {
                // Can't remove cookies in middleware/edge
              }
        },
      },
    }
  );

  try {
    const searchParams = requestUrl.searchParams;
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");

    serverDebug.debug("[Strava Connect Callback] Code:", code ? "present" : "missing");
    serverDebug.debug("[Strava Connect Callback] Error:", oauthError);

    if (oauthError) {
      serverDebug.error("[Strava Connect Callback] OAuth error:", oauthError);
      return NextResponse.redirect(
        new URL(`/profile?error=${encodeURIComponent(String(oauthError))}`, requestUrl.origin)
      );
    }

    if (!code) {
      serverDebug.error("[Strava Connect Callback] No authorization code");
      return NextResponse.redirect(
        new URL("/profile?error=Missing authorization code", requestUrl.origin)
      );
    }

    // Get current session user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    serverDebug.debug("[Strava Connect Callback] Current user (initial):", user?.id, user?.email);

    // If no user from initial getUser(), try to reconstruct session from sb- cookies
    if (userError || !user) {
      serverDebug.debug('[Strava Connect Callback] No user from getUser(), attempting session reconstruction from cookies');
      try {
        const acc = cookieStore.get('sb-access-token')?.value;
        const ref = cookieStore.get('sb-refresh-token')?.value;
        serverDebug.debug('[Strava Connect Callback] sb-access-token present:', !!acc, 'sb-refresh-token present:', !!ref);
        if (acc && ref) {
          await supabase.auth.setSession({ access_token: acc, refresh_token: ref });
          const retry = await supabase.auth.getUser();
          if (retry?.data?.user) {
            serverDebug.debug('[Strava Connect Callback] Session reconstructed, user:', retry.data.user.id);
          }
        }
      } catch (reconErr: unknown) {
        serverDebug.warn('[Strava Connect Callback] session reconstruction failed', String(reconErr));
      }
    }

    const {
      data: { user: finalUser },
    } = await supabase.auth.getUser();

    serverDebug.debug('[Strava Connect Callback] Current user (after reconstruction):', finalUser?.id, finalUser?.email);

    if (!finalUser) {
      serverDebug.error('[Strava Connect Callback] User not authenticated after reconstruction');
      return NextResponse.redirect(new URL('/login?error=Please login first&redirect=/profile', requestUrl.origin));
    }

    const userId = finalUser.id;

    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = request.headers.get("host") || "localhost:3000";
    const redirectUri = `${protocol}://${host}/api/strava/connect/callback`;

    serverDebug.debug("[Strava Connect Callback] Exchanging code for token...");
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    serverDebug.debug("[Strava Connect Callback] Token received for athlete:", tokenData.athlete.id);
    const athleteName = `${tokenData.athlete.firstname || ""} ${tokenData.athlete.lastname || ""}`.trim();

    serverDebug.debug("[Strava Connect Callback] Saving tokens for user:", userId);

    // Update existing profile with Strava credentials (do not create new profile)
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        strava_id: tokenData.athlete.id.toString(),
        strava_access_token: tokenData.access_token,
        strava_refresh_token: tokenData.refresh_token,
        strava_token_expires_at: tokenData.expires_at,
        strava_athlete_name: athleteName || "Unknown",
      })
      .eq("id", userId);

    if (updateError) {
      serverDebug.error("[Strava Connect Callback] Failed to save tokens:", updateError);
      return NextResponse.redirect(
        new URL("/profile?error=Failed to save Strava connection", requestUrl.origin)
      );
    }

    serverDebug.debug("[Strava Connect Callback] Success! Redirecting to profile...");
    return NextResponse.redirect(new URL("/profile?strava_connected=true", requestUrl.origin));
  } catch (error: unknown) {
    serverDebug.error("[Strava Connect Callback] Unexpected error:", String(error));
    return NextResponse.redirect(
      new URL("/profile?error=Authentication failed", requestUrl.origin)
    );
  }
}
