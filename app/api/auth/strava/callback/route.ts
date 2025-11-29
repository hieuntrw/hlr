import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-client";
import { exchangeCodeForToken } from "@/lib/strava-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/?error=Missing authorization code", request.url)
      );
    }

    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = request.headers.get("host") || "localhost:3000";
    const redirectUri = `${protocol}://${host}/api/auth/strava/callback`;

    const tokenData = await exchangeCodeForToken(code, redirectUri);

    // Get current session user
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.redirect(
        new URL("/?error=User not authenticated", request.url)
      );
    }

    const userId = session.user.id;
    const athleteName = `${tokenData.athlete.firstname || ""} ${tokenData.athlete.lastname || ""}`.trim();
    const athleteCity = tokenData.athlete.city || "";

    // Save Strava credentials to profile
    const { error: updateError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          strava_id: tokenData.athlete.id.toString(),
          strava_access_token: tokenData.access_token,
          strava_refresh_token: tokenData.refresh_token,
          strava_token_expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
          full_name: athleteName || session.user.email,
          city: athleteCity,
        },
        { onConflict: "id" }
      );

    if (updateError) {
      console.error("Failed to save Strava tokens:", updateError);
      return NextResponse.redirect(
        new URL("/?error=Failed to save Strava connection", request.url)
      );
    }

    return NextResponse.redirect(new URL("/dashboard?strava_connected=true", request.url));
  } catch (error) {
    console.error("Strava callback error:", error);
    return NextResponse.redirect(
      new URL("/?error=Authentication failed", request.url)
    );
  }
}
