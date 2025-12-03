import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  timezone: string;
  average_speed: number;
  max_speed: number;
  average_cadence?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  achievement_count: number;
  kudos_count: number;
  athlete_count: number;
  map: {
    summary_polyline?: string;
  };
}

export async function POST(request: NextRequest) {
  console.log("[Strava Sync] Starting activity sync...");

  const cookieStore = await cookies();
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
            // Can't set cookies in API route
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // Can't remove cookies in API route
          }
        },
      },
    }
  );

  try {
    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("[Strava Sync] User not authenticated:", userError);
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    console.log("[Strava Sync] User:", user.id);

    // Get valid Strava access token (auto-refreshes if expired)
    const { getValidStravaToken } = await import("@/lib/strava-token");
    const accessToken = await getValidStravaToken(user.id);

    if (!accessToken) {
      console.error("[Strava Sync] No valid Strava token");
      return NextResponse.json(
        { error: "Strava not connected or token invalid" },
        { status: 400 }
      );
    }

    // Calculate date 40 days ago
    const fortyDaysAgo = new Date();
    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
    const afterTimestamp = Math.floor(fortyDaysAgo.getTime() / 1000);

    console.log("[Strava Sync] Fetching activities after:", fortyDaysAgo.toISOString());

    // Fetch activities from Strava (paginated)
    let page = 1;
    let allActivities: StravaActivity[] = [];
    const perPage = 100; // Max per page

    while (true) {
      const stravaUrl = `https://www.strava.com/api/v3/athlete/activities?after=${afterTimestamp}&per_page=${perPage}&page=${page}`;
      
      const stravaResponse = await fetch(stravaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!stravaResponse.ok) {
        const errorText = await stravaResponse.text();
        console.error("[Strava Sync] Strava API error:", stravaResponse.status, errorText);
        return NextResponse.json(
          { error: "Failed to fetch activities from Strava" },
          { status: stravaResponse.status }
        );
      }

      const activities: StravaActivity[] = await stravaResponse.json();
      
      if (activities.length === 0) {
        break; // No more activities
      }

      allActivities = allActivities.concat(activities);
      console.log(`[Strava Sync] Fetched page ${page}: ${activities.length} activities`);

      if (activities.length < perPage) {
        break; // Last page
      }

      page++;
    }

    console.log(`[Strava Sync] Total activities fetched: ${allActivities.length}`);

    // Filter only Run and Walk activities
    const runWalkActivities = allActivities.filter(
      (activity) => 
        activity.type === "Run" || 
        activity.type === "Walk" ||
        activity.sport_type === "Run" ||
        activity.sport_type === "Walk"
    );

    console.log(`[Strava Sync] Run/Walk activities: ${runWalkActivities.length}`);

    // Get existing activity IDs from database
    const { data: existingActivities } = await supabase
      .from("activities")
      .select("id")
      .eq("user_id", user.id);

    const existingIds = new Set(existingActivities?.map((a) => a.id) || []);
    console.log(`[Strava Sync] Existing activities in DB: ${existingIds.size}`);

    // Filter out activities that already exist
    const newActivities = runWalkActivities.filter(
      (activity) => !existingIds.has(activity.id.toString())
    );

    console.log(`[Strava Sync] New activities to insert: ${newActivities.length}`);

    if (newActivities.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No new activities to sync",
        synced: 0,
        total: allActivities.length,
      });
    }

    // Prepare activities for insertion
    const activitiesToInsert = newActivities.map((activity) => ({
      id: activity.id.toString(),
      user_id: user.id,
      name: activity.name,
      distance: activity.distance,
      moving_time: activity.moving_time,
      elapsed_time: activity.elapsed_time,
      total_elevation_gain: activity.total_elevation_gain,
      type: activity.type || activity.sport_type,
      start_date: activity.start_date,
      average_cadence: activity.average_cadence || null,
      average_heartrate: activity.average_heartrate || null,
      map_summary_polyline: activity.map?.summary_polyline || null,
    }));

    // Insert activities into database
    const { error: insertError } = await supabase
      .from("activities")
      .insert(activitiesToInsert);

    if (insertError) {
      console.error("[Strava Sync] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save activities to database" },
        { status: 500 }
      );
    }

    console.log(`[Strava Sync] Successfully synced ${newActivities.length} activities`);

    return NextResponse.json({
      success: true,
      message: `Synced ${newActivities.length} new activities`,
      synced: newActivities.length,
      total: allActivities.length,
    });
  } catch (error) {
    console.error("[Strava Sync] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
