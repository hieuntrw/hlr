import { NextRequest, NextResponse } from "next/server";
import { checkStravaConnection } from "@/lib/strava-token";
import serverDebug from '@/lib/server-debug';

export const dynamic = "force-dynamic";

/**
 * Check if user has valid Strava connection
 * Automatically refreshes token if expired
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing user ID" },
        { status: 400 }
      );
    }

    const status = await checkStravaConnection(userId);

    return NextResponse.json(status);
  } catch (error) {
    serverDebug.error("[Strava Check] Error:", error);
    return NextResponse.json(
      { error: "Failed to check connection" },
      { status: 500 }
    );
  }
}
