import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-client";
import { refreshStravaToken } from "@/lib/strava-oauth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing user ID" },
        { status: 400 }
      );
    }

    // Get current refresh token from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("strava_refresh_token")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.strava_refresh_token) {
      return NextResponse.json(
        { error: "No refresh token found" },
        { status: 404 }
      );
    }

    // Refresh the token
    const tokenData = await refreshStravaToken(profile.strava_refresh_token);

    // Update profile with new tokens
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        strava_access_token: tokenData.access_token,
        strava_refresh_token: tokenData.refresh_token,
        strava_token_expires_at: tokenData.expires_at,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update tokens:", updateError);
      return NextResponse.json(
        { error: "Failed to update tokens" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Token refresh failed" },
      { status: 500 }
    );
  }
}
