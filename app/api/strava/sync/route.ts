import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { syncUserActivitiesForCurrentMonth } from "@/lib/services/stravaService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - User not authenticated" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const result = await syncUserActivitiesForCurrentMonth(userId);

    const total_km = result.totalKm ?? 0;
    const avgPaceSeconds = result.avgPaceSeconds ?? 0;

    const pace = avgPaceSeconds
      ? `${Math.floor(avgPaceSeconds / 60)}:${String(avgPaceSeconds % 60).padStart(2, "0")}`
      : null;

    return NextResponse.json({
      success: true,
      message: "Đồng bộ thành công",
      data: {
        total_km,
        pace,
        avg_pace_seconds: avgPaceSeconds,
        total_activities: result.totalActivities ?? 0,
        progress_percent: result.progressPercent ?? null,
      },
    });
  } catch (err: any) {
    console.error("Strava sync error:", err);
    const errorMessage = err?.message || String(err);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
