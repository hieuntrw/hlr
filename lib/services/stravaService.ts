import { supabase } from "@/lib/supabase-client";
import {
  refreshStravaToken as oauthRefreshStravaToken,
} from "@/lib/strava-oauth";

const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";

// Default pace limits (in seconds per km): 4:00 min, 12:00 max
const DEFAULT_MIN_PACE_SECONDS = 240; // 4:00
const DEFAULT_MAX_PACE_SECONDS = 720; // 12:00

/**
 * Calculate pace (seconds per km) from distance and time.
 * Returns null if distance is 0 or invalid.
 */
function calculatePacePerKm(distanceMeters: number, movingTimeSeconds: number): number | null {
  if (!distanceMeters || distanceMeters <= 0 || !movingTimeSeconds || movingTimeSeconds <= 0) {
    return null;
  }
  const distanceKm = distanceMeters / 1000;
  return Math.round(movingTimeSeconds / distanceKm);
}

/**
 * Check if pace falls within acceptable range.
 */
function isPaceWithinRange(
  paceSeconds: number,
  minPaceSeconds: number = DEFAULT_MIN_PACE_SECONDS,
  maxPaceSeconds: number = DEFAULT_MAX_PACE_SECONDS
): boolean {
  return paceSeconds >= minPaceSeconds && paceSeconds <= maxPaceSeconds;
}

/**
 * Refresh Strava token for a user if expired.
 * Returns updated token data or null if no Strava connection.
 */
export async function refreshStravaToken(userId: string) {
  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("strava_refresh_token, strava_access_token, strava_token_expires_at")
    .eq("id", userId)
    .single();

  if (profileError) {
    throw new Error(`Failed to load profile: ${profileError.message}`);
  }

  if (!profile || !profile.strava_refresh_token) {
    // No Strava connection for this user
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = Number(profile.strava_token_expires_at) || 0;

  if (expiresAt > now + 60) {
    // Token still valid (give 60s buffer)
    return {
      access_token: profile.strava_access_token,
      refresh_token: profile.strava_refresh_token,
      expires_at: expiresAt,
    };
  }

  // Token expired or about to expire — refresh via Strava API
  try {
    const tokenData = await oauthRefreshStravaToken(profile.strava_refresh_token);

    // Persist new tokens
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        strava_access_token: tokenData.access_token,
        strava_refresh_token: tokenData.refresh_token,
        strava_token_expires_at: tokenData.expires_at,
      })
      .eq("id", userId);

    if (updateError) {
      throw new Error(`Failed to update profile tokens: ${updateError.message}`);
    }

    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
    };
  } catch (err: any) {
    throw new Error(`Failed to refresh Strava token: ${err?.message || err}`);
  }
}

/**
 * Sync user's Strava Run activities for a given month/year into challenge_participants.
 * - only syncs if the related challenge is within allowed window (not >10 days past end)
 * - calculates total km, average pace (seconds/km) and total activities
 */
export async function syncUserActivities(
  userId: string,
  month: number,
  year: number
) {
  // 1) Find challenge for the month
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));

  const startISO = startDate.toISOString().slice(0, 10);
  const endISO = endDate.toISOString().slice(0, 10);

  const { data: challenges, error: chError } = await supabase
    .from("challenges")
    .select("id, start_date, end_date, is_locked, min_pace_seconds, max_pace_seconds")
    .gte("start_date", startISO)
    .lte("start_date", endISO)
    .limit(1);

  if (chError) {
    throw new Error(`Failed to load challenge: ${chError.message}`);
  }

  const challenge = challenges && challenges[0];

  if (!challenge) {
    throw new Error("No challenge found for the requested month/year");
  }

  // If challenge explicitly locked, disallow sync
  if (challenge.is_locked) {
    throw new Error("Challenge is locked and cannot be synced");
  }

  // Disallow sync if more than 10 days after challenge end_date
  const end = new Date(challenge.end_date);
  const cutoff = new Date(end.getTime() + 10 * 24 * 60 * 60 * 1000);
  const now = new Date();
  if (now > cutoff) {
    throw new Error("Sync window expired (more than 10 days after challenge end)");
  }

  // 2) Ensure user is participant
  const { data: participant, error: partError } = await supabase
    .from("challenge_participants")
    .select("id, target_km")
    .eq("challenge_id", challenge.id)
    .eq("user_id", userId)
    .single();

  if (partError) {
    throw new Error(`Failed to load participant: ${partError.message}`);
  }

  if (!participant) {
    throw new Error("User is not registered for the challenge");
  }

  // 3) Ensure we have a valid access token (refresh if needed)
  const tokenInfo = await refreshStravaToken(userId);
  if (!tokenInfo || !tokenInfo.access_token) {
    throw new Error("User does not have a valid Strava connection");
  }

  const accessToken = tokenInfo.access_token;

  // 4) Query Strava activities for the month (paging up to 200 per page)
  const after = Math.floor(startDate.getTime() / 1000);
  const before = Math.floor(endDate.getTime() / 1000) + 24 * 60 * 60; // include end day

  let page = 1;
  const perPage = 200;
  let allRuns: any[] = [];

  // Get pace limits from challenge (or use defaults)
  const minPaceSeconds = challenge.min_pace_seconds ?? DEFAULT_MIN_PACE_SECONDS;
  const maxPaceSeconds = challenge.max_pace_seconds ?? DEFAULT_MAX_PACE_SECONDS;

  while (true) {
    const url = `${STRAVA_ACTIVITIES_URL}?after=${after}&before=${before}&page=${page}&per_page=${perPage}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Strava activities fetch failed: ${res.status} ${txt}`);
    }

    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) break;

    // Filter: only runs/walks, and only within pace range
    const validActivities = items.filter((a: any) => {
      if (a.type !== "Run" && a.type !== "Walk") return false;

      const pace = calculatePacePerKm(a.distance, a.moving_time);
      if (pace === null) return false; // skip if cannot calculate pace

      if (!isPaceWithinRange(pace, minPaceSeconds, maxPaceSeconds)) {
        console.warn(
          `[stravaService] Activity ${a.id} filtered out: pace ${pace}s/km outside range [${minPaceSeconds}-${maxPaceSeconds}]`
        );
        return false;
      }

      return true;
    });

    allRuns = allRuns.concat(validActivities);

    if (items.length < perPage) break;
    page += 1;
  }

  // 5) Aggregate metrics
  const totalMeters = allRuns.reduce((sum, a) => sum + (a.distance || 0), 0);
  const totalKm = Math.round((totalMeters / 1000) * 100) / 100; // two decimals
  const totalSeconds = allRuns.reduce((sum, a) => sum + (a.moving_time || a.elapsed_time || 0), 0);
  const totalActivities = allRuns.length;

  const avgPaceSeconds = totalKm > 0 ? Math.round(totalSeconds / totalKm) : 0;

  // Calculate aggregate heartrate, cadence, elevation
  const avgHeartrate = totalActivities > 0 
    ? Math.round(
        allRuns.reduce((sum, a) => sum + (a.average_heartrate || 0), 0) / totalActivities * 100
      ) / 100
    : null;
  const avgCadence = totalActivities > 0
    ? Math.round(
        allRuns.reduce((sum, a) => sum + (a.average_cadence || 0), 0) / totalActivities * 100
      ) / 100
    : null;
  const totalElevation = Math.round(
    allRuns.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0) * 100
  ) / 100;

  // 5b) Insert activities into `activities` table for detailed tracking
  for (const activity of allRuns) {
    const activityPayload = {
      strava_activity_id: activity.id,
      user_id: userId,
      challenge_participant_id: participant.id,
      name: activity.name,
      type: activity.type || "Run",
      distance: activity.distance || 0,
      moving_time: activity.moving_time || 0,
      elapsed_time: activity.elapsed_time || 0,
      elevation_gain: activity.total_elevation_gain || null,
      average_heartrate: activity.average_heartrate || null,
      max_heartrate: activity.max_heartrate || null,
      average_cadence: activity.average_cadence || null,
      start_date: activity.start_date,
      raw_json: activity, // store full response for audit/reference
    };

    // Use upsert (insert or ignore if strava_activity_id exists)
    const { error: actError } = await supabase
      .from("activities")
      .upsert([activityPayload], { onConflict: "strava_activity_id" });

    if (actError) {
      console.error(`[stravaService] Failed to insert activity ${activity.id}:`, actError);
    }
  }

  // 6) Update challenge_participants
  const updatePayload: any = {
    actual_km: totalKm,
    avg_pace_seconds: avgPaceSeconds,
    total_activities: totalActivities,
    last_synced_at: new Date().toISOString(),
  };

  // Optionally mark completed if reached target
  if (participant.target_km && totalKm >= Number(participant.target_km)) {
    updatePayload.status = "completed";
  }

  const { error: updateError } = await supabase
    .from("challenge_participants")
    .update(updatePayload)
    .eq("id", participant.id);

  if (updateError) {
    throw new Error(`Failed to update participant: ${updateError.message}`);
  }

  // 7) Check for PB if any activity is a race event
  await checkAndUpdatePBs(userId, allRuns, challenge.id);

  return {
    challengeId: challenge.id,
    participantId: participant.id,
    totalKm,
    avgPaceSeconds,
    totalActivities,
    avgHeartrate,
    avgCadence,
    totalElevation,
  };
}

/**
 * Check if any activity is a race (event) and updates PBs if personal records are set.
 * For race activities, determines distance (HM/FM) and checks if time is a new PB.
 * If PB detected, updates profile with pb_hm_approved/pb_fm_approved = FALSE (pending approval).
 */
async function checkAndUpdatePBs(userId: string, activities: any[], challengeId: string) {
  if (!activities || activities.length === 0) return;

  // Fetch current profile PBs
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, pb_hm_seconds, pb_fm_seconds, pb_hm_approved, pb_fm_approved")
    .eq("id", userId)
    .single();

  if (pErr) {
    console.error(`[stravaService] Failed to load profile for PB check:`, pErr);
    return;
  }

  const currentPBHM = profile?.pb_hm_seconds ?? null;
  const currentPBFM = profile?.pb_fm_seconds ?? null;

  // Filter race activities (has race_type field or event_type indicator)
  const raceActivities = activities.filter((a) => a.event_type || a.workout_type === 3 || a.flagged);

  for (const race of raceActivities) {
    // Try to infer distance from activity name or metadata
    // Common patterns: "HM", "21k", "Half Marathon" -> HM, "FM", "42k", "Marathon" -> FM
    const name = (race.name || "").toUpperCase();
    const distance = race.distance || 0;
    const movingTime = race.moving_time || 0;

    let raceDistance: "HM" | "FM" | null = null;

    if (name.includes("HALF") || name.includes("HM") || name.includes("21")) {
      raceDistance = "HM";
    } else if (name.includes("MARATHON") || name.includes("FM") || name.includes("42")) {
      raceDistance = "FM";
    } else if (distance >= 20000 && distance < 22000) {
      raceDistance = "HM";
    } else if (distance >= 41000 && distance < 43000) {
      raceDistance = "FM";
    }

    if (!raceDistance) {
      console.warn(`[stravaService] Race activity ${race.id} could not be classified (${name})`);
      continue;
    }

    // Check if this is a new PB
    const currentPB = raceDistance === "HM" ? currentPBHM : currentPBFM;
    const isNewPB = !currentPB || movingTime < currentPB;

    if (isNewPB) {
      console.log(
        `[stravaService] New PB detected: ${raceDistance} = ${movingTime}s (old: ${currentPB}s)`
      );

      // Update profile with new PB time, but mark as pending approval
      const updatePayload: any = {};
      const approvalField = raceDistance === "HM" ? "pb_hm_approved" : "pb_fm_approved";
      const pbField = raceDistance === "HM" ? "pb_hm_seconds" : "pb_fm_seconds";

      updatePayload[pbField] = movingTime;
      updatePayload[approvalField] = false; // pending approval

      const { error: updateErr } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", userId);

      if (updateErr) {
        console.error(`[stravaService] Failed to update PB:`, updateErr);
      } else {
        console.log(`[stravaService] Profile updated with pending ${raceDistance} PB`);
      }

      // Add entry to pb_history
      const { error: histErr } = await supabase.from("pb_history").insert({
        user_id: userId,
        distance: raceDistance,
        time_seconds: movingTime,
        achieved_at: new Date(race.start_date || new Date()).toISOString().slice(0, 10),
        race_id: null, // could link to races table if this activity has race metadata
      });

      if (histErr) {
        console.error(`[stravaService] Failed to insert pb_history:`, histErr);
      }
    }
  }
}

/**
 * Wrapper to sync activities for the current month for a given userId.
 * - determines current month/year
 * - calls the month/year sync implementation
 * - computes progress percent based on participant.target_km and returns it
 */
export async function syncUserActivitiesForCurrentMonth(userId: string) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // call the general sync function
  const result = await syncUserActivities(userId, month, year);

  // fetch participant to compute progress percent (target_km)
  const { data: participant, error: pErr } = await supabase
    .from("challenge_participants")
    .select("id, target_km, actual_km")
    .eq("id", result.participantId)
    .single();

  if (pErr) {
    // return result without percent if unable to fetch
    return { ...result, progressPercent: null };
  }

  const target = Number(participant.target_km) || 0;
  const actual = Number(participant.actual_km) || Number(result.totalKm) || 0;
  const progressPercent = target > 0 ? Math.round((actual / target) * 100) : 0;

  return { ...result, progressPercent };
}

export default {
  refreshStravaToken,
  syncUserActivities,
};
