import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { refreshStravaToken } from "@/lib/strava-oauth";
import serverDebug from '@/lib/server-debug'

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      serverDebug.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    // Get current refresh token from profile
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("strava_refresh_token")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.strava_refresh_token) {
      return NextResponse.json({ error: "No refresh token found" }, { status: 404 });
    }

    // Refresh the token via Strava OAuth helper
    const tokenData = await refreshStravaToken(profile.strava_refresh_token);

    // Update profile with new tokens using service role client
    const { error: updateError } = await client
      .from("profiles")
      .update({
        strava_access_token: tokenData.access_token,
        strava_refresh_token: tokenData.refresh_token,
        strava_token_expires_at: tokenData.expires_at,
      })
      .eq("id", userId);

    if (updateError) {
      serverDebug.error("Failed to update tokens:", updateError);
      return NextResponse.json({ error: "Failed to update tokens" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    serverDebug.error("Token refresh error:", error);
    return NextResponse.json({ error: "Token refresh failed" }, { status: 500 });
  }
}
