import { NextRequest, NextResponse } from "next/server";
import { getStravaAuthUrl } from "@/lib/strava-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = request.headers.get("host") || "localhost:3000";
    const redirectUri = `${protocol}://${host}/api/auth/strava/callback`;

    const authUrl = getStravaAuthUrl(redirectUri);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Strava login error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Strava login" },
      { status: 500 }
    );
  }
}
