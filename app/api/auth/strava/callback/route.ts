import { NextRequest, NextResponse } from "next/server";
// no server client needed here
import serverDebug from '@/lib/server-debug'

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  serverDebug.debug("[Strava Callback] Starting...");
  
  // lightweight redirect handler; no cookie operations required here
  const requestUrl = new URL(request.url);

  // No Supabase client needed in this lightweight redirect handler

  try {
    const searchParams = requestUrl.searchParams;
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");

    serverDebug.debug("[Strava Callback] Code:", code ? "present" : "missing");
    serverDebug.debug("[Strava Callback] Error:", oauthError);

    if (oauthError) {
      serverDebug.error("[Strava Callback] OAuth error:", oauthError);
      return NextResponse.redirect(
        new URL(`/profile?error=${encodeURIComponent(String(oauthError))}`, requestUrl.origin)
      );
    }

    if (!code) {
      serverDebug.error("[Strava Callback] No authorization code");
      return NextResponse.redirect(
        new URL("/profile?error=Missing authorization code", requestUrl.origin)
      );
    }

  // Deprecated: redirect to new non-auth Strava connect callback handler
  const redirect = new URL(`/api/strava/connect/callback${requestUrl.search}`, requestUrl.origin);
  return NextResponse.redirect(redirect);
  } catch (error: unknown) {
    serverDebug.error("[Strava Callback] Unexpected error:", String(error));
    return NextResponse.redirect(
      new URL("/profile?error=Authentication failed", requestUrl.origin)
    );
  }
}
