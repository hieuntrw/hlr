import { NextRequest, NextResponse } from "next/server";
import { getStravaAuthUrl } from "@/lib/strava-oauth";
import { cookies } from "next/headers";
import crypto from "crypto";
import serverDebug from '@/lib/server-debug'

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Generate a state token to store in cookies (for CSRF protection)
    const stateToken = crypto.randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    
    // Store state for verification in callback
    cookieStore.set("strava_oauth_state", stateToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
    });

    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = request.headers.get("host") || "localhost:3000";
    const redirectUri = `${protocol}://${host}/api/strava/connect/callback`;

    const authUrl = getStravaAuthUrl(redirectUri);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    serverDebug.error("Strava connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Strava connect" },
      { status: 500 }
    );
  }
}
