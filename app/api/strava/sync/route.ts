import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { syncUserActivitiesForCurrentMonth } from "@/lib/services/stravaService";
import serverDebug from '@/lib/server-debug'

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Get access token from cookie
    const cookieStore = cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - No session token" },
        { status: 401 }
      );
    }

    // Create Supabase client with access token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

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
    // Fetch profile role (if present) and determine admin status
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const sessionAppMeta = (session.user as unknown as { app_metadata?: Record<string, unknown> })?.app_metadata;
    const isAdmin = (profileRow && profileRow.role === 'admin') || (session.user && typeof sessionAppMeta === 'object' && (sessionAppMeta as Record<string, unknown>).role === 'admin');

    // Allow debug flag via JSON body { debug: true } or query ?debug=true
    let debug = false;
    try {
      const bodyRaw = await request.json();
      if (bodyRaw && typeof bodyRaw === 'object' && 'debug' in (bodyRaw as Record<string, unknown>) && (bodyRaw as Record<string, unknown>).debug === true) {
        debug = true;
      }
    } catch {
      // ignore if no JSON body or invalid JSON
    }
    try {
      if (request.nextUrl && request.nextUrl.searchParams.get('debug') === 'true') debug = true;
    } catch {
      // ignore
    }

    // Require caller to be a participant of the current month's challenge or admin.
    // Determine current month/year and find challenge
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));
    const startISO = startDate.toISOString().slice(0, 10);
    const endISO = endDate.toISOString().slice(0, 10);

    const { data: challenges } = await supabase
      .from('challenges')
      .select('id')
      .gte('start_date', startISO)
      .lte('start_date', endISO)
      .limit(1);

    const currentChallenge = challenges && challenges[0];

    if (!isAdmin) {
      if (!currentChallenge) {
        return NextResponse.json({ success: false, error: 'No current challenge found' }, { status: 400 });
      }

      const { data: participantRow } = await supabase
        .from('challenge_participants')
        .select('id')
        .eq('challenge_id', currentChallenge.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!participantRow) {
        return NextResponse.json({ success: false, error: 'Forbidden - not a participant' }, { status: 403 });
      }
    }

    const result = await syncUserActivitiesForCurrentMonth(userId, debug);

    const actual_km = result.totalKm ?? 0;
    const avgPaceSeconds = result.avgPaceSeconds ?? 0;

    const pace = avgPaceSeconds
      ? `${Math.floor(avgPaceSeconds / 60)}:${String(avgPaceSeconds % 60).padStart(2, "0")}`
      : null;

    const base = {
      actual_km,
      pace,
      avg_pace_seconds: avgPaceSeconds,
      total_activities: result.totalActivities ?? 0,
      progress_percent: result.progressPercent ?? null,
    };

    if (debug && result && typeof result === 'object' && 'filteredActivities' in (result as Record<string, unknown>)) {
      return NextResponse.json({ success: true, message: 'Đồng bộ thành công (debug)', data: base, filtered: (result as Record<string, unknown>).filteredActivities });
    }

    return NextResponse.json({ success: true, message: 'Đồng bộ thành công', data: base });
  } catch (err: unknown) {
    serverDebug.error("Strava sync error:", String(err));
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
