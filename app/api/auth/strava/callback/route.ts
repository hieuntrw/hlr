import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { exchangeCodeForToken } from "@/lib/strava-oauth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  console.log("[Strava Callback] Starting...");
  
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
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Can't set cookies in middleware/edge
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // Can't remove cookies in middleware/edge
          }
        },
      },
    }
  );

  try {
    const searchParams = requestUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    console.log("[Strava Callback] Code:", code ? "present" : "missing");
    console.log("[Strava Callback] Error:", error);

    if (error) {
      console.error("[Strava Callback] OAuth error:", error);
      return NextResponse.redirect(
        new URL(`/profile?error=${encodeURIComponent(error)}`, requestUrl.origin)
      );
    }

    if (!code) {
      console.error("[Strava Callback] No authorization code");
      return NextResponse.redirect(
        new URL("/profile?error=Missing authorization code", requestUrl.origin)
      );
    }

    // Get current session user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("[Strava Callback] Current user:", user?.id, user?.email);

    if (userError || !user) {
      console.error("[Strava Callback] User not authenticated:", userError);
      return NextResponse.redirect(
        new URL("/login?error=Please login first&redirect=/profile", requestUrl.origin)
      );
    }

    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = request.headers.get("host") || "localhost:3000";
    const redirectUri = `${protocol}://${host}/api/auth/strava/callback`;

    console.log("[Strava Callback] Exchanging code for token...");
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    console.log("[Strava Callback] Token received for athlete:", tokenData.athlete.id);

    const userId = user.id;
    const athleteName = `${tokenData.athlete.firstname || ""} ${tokenData.athlete.lastname || ""}`.trim();

    console.log("[Strava Callback] Saving tokens for user:", userId);

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
      console.error("[Strava Callback] Failed to save tokens:", updateError);
      return NextResponse.redirect(
        new URL("/profile?error=Failed to save Strava connection", requestUrl.origin)
      );
    }

    console.log("[Strava Callback] Success! Redirecting to profile...");
    return NextResponse.redirect(new URL("/profile?strava_connected=true", requestUrl.origin));
  } catch (error) {
    console.error("[Strava Callback] Unexpected error:", error);
    return NextResponse.redirect(
      new URL("/profile?error=Authentication failed", requestUrl.origin)
    );
  }
}
