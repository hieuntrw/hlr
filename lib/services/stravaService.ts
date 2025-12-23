import { getSupabaseServiceClient } from "@/lib/supabase-service-client";
const supabase = getSupabaseServiceClient();
import serverDebug from "@/lib/server-debug";
import {
  refreshStravaToken as oauthRefreshStravaToken,
} from "@/lib/strava-oauth";
import { getValidStravaToken } from "@/lib/strava-token";
import { createClient } from "@supabase/supabase-js";

// --- Strava types and runtime helpers ---
type StravaMap = { summary_polyline?: string } | null;

export type StravaActivity = {
  id?: number | string;
  name?: string;
  type?: string;
  sport_type?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  average_heartrate?: number;
  average_cadence?: number;
  total_elevation_gain?: number;
  map?: StravaMap;
  map_summary_polyline?: string | null;
  start_date?: string | null;
  start_date_local?: string | null;
  timezone?: string | null;
  [key: string]: unknown;
};

export type StravaDetailedActivity = StravaActivity & {
  // detailed endpoint often contains the same fields but more reliably
  max_heartrate?: number;
  elevation_gain?: number;
  [key: string]: unknown;
};

function toStravaActivity(v: unknown): StravaActivity {
  return (v as unknown) as StravaActivity;
}


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing Supabase server env for admin client");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";

// Default pace limits (in seconds per km): 4:00 min, 12:00 max
const DEFAULT_MIN_PACE_SECONDS = 240; // 4:00
const DEFAULT_MAX_PACE_SECONDS = 720; // 12:00

/**
 * Calculate pace (seconds per km) from distance and time.
 * Returns null if distance is 0 or invalid.
 */
export function calculatePacePerKm(distanceMeters: number, movingTimeSeconds: number): number | null {
  if (!distanceMeters || distanceMeters <= 0 || !movingTimeSeconds || movingTimeSeconds <= 0) {
    return null;
  }
  const distanceKm = distanceMeters / 1000;
  return Math.round(movingTimeSeconds / distanceKm);
}

/**
 * Check if pace falls within acceptable range.
 */
export function isPaceWithinRange(
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
  // Fetch profile (use maybeSingle to avoid PostgREST single coercion errors)
  const getProfileRes = await supabase
    .from("profiles")
    .select("id, strava_refresh_token, strava_access_token, strava_token_expires_at")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  const profile = getProfileRes.data ?? null;
  const profileError = getProfileRes.error;

  if (profileError) {
    // Diagnostic: list matching rows to help debug duplicate/ambiguous results
    try {
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, strava_refresh_token, strava_access_token, strava_token_expires_at')
        .eq('id', userId);
      serverDebug.error('[stravaService] Failed to load profile (maybeMultiple). Matching rows count:', Array.isArray(allProfiles) ? allProfiles.length : 0, 'sample:', Array.isArray(allProfiles) && allProfiles.length ? allProfiles[0] : null);
    } catch (listErr) {
      serverDebug.warn('[stravaService] Failed to list matching profiles for diagnostics', listErr);
    }

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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to refresh Strava token: ${msg}`);
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
  year: number,
  debug: boolean = false
) {
  // TEMP DEBUG: verify adminSupabase availability and service key presence
  try {
    serverDebug.debug('[stravaService] Temp debug: admin client presence', { hasServiceKey: !!SUPABASE_SERVICE_KEY, supabaseUrl: SUPABASE_URL ? 'present' : 'missing' });
    console.debug('[stravaService] Temp debug: admin client presence', { hasServiceKey: !!SUPABASE_SERVICE_KEY, supabaseUrl: SUPABASE_URL ? 'present' : 'missing' });
    const { data: auditSample, error: auditErr } = await adminSupabase
      .from('admin__rls_audit')
      .select('id')
      .limit(1)
      .maybeSingle();
    serverDebug.debug('[stravaService] Temp debug: admin__rls_audit probe', { auditSample: auditSample ?? null, auditErr: auditErr?.message ?? null });
    console.debug('[stravaService] Temp debug: admin__rls_audit probe', { auditSample: auditSample ?? null, auditErr: auditErr?.message ?? null });
  } catch (e) {
    serverDebug.error('[stravaService] Temp debug: adminSupabase probe failed', e);
    console.error('[stravaService] Temp debug: adminSupabase probe failed', e);
  }

  // 3) Ensure we have a valid access token (uses admin-safe helper that
  // refreshes tokens using the service-role key so this route works even
  // when the request does not carry a Supabase session cookie).
  const accessToken = await getValidStravaToken(userId);
  if (!accessToken) {
    throw new Error("User does not have a valid Strava connection");
  }

  // 4) Query Strava activities for the month (paging up to 200 per page)
  // Ensure we fetch at least the last 30 days of activities to cover
  // users who expect '30 ngày gần nhất' even if the challenge window is smaller.
  // Fetch activities from the last 30 days by default
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const after = thirtyDaysAgo;
  const before = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // now + buffer

  let page = 1;
  const perPage = 200;
  let allRuns: StravaActivity[] = [];
  // Accumulate filtered activities across pages when debug=true
  const filteredActivities: Partial<Record<string, unknown>>[] = [];

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

    // Collect runs and walks only; do not filter by challenge date or pace here.
    const validActivities: StravaActivity[] = [];
    for (const a of items) {
      const aRec = toStravaActivity(a);
      if (aRec.type !== "Run" && aRec.type !== "Walk" && aRec.sport_type !== "Run" && aRec.sport_type !== "Walk") {
        if (debug) filteredActivities.push({ id: aRec.id, reason: 'type_not_run_walk', type: aRec.type || aRec.sport_type });
        continue;
      }
      validActivities.push(aRec);
    }

    allRuns = allRuns.concat(validActivities);

    if (items.length < perPage) break;
    page += 1;
  }

  // 5) Aggregate metrics
  const totalMeters = allRuns.reduce((sum: number, a: StravaActivity) => {
    return sum + Number(a.distance ?? 0);
  }, 0);
  const totalKm = Math.round((totalMeters / 1000) * 100) / 100; // two decimals
  const totalSeconds = allRuns.reduce((sum: number, a: StravaActivity) => {
    return sum + Number(a.moving_time ?? a.elapsed_time ?? 0);
  }, 0);
  const totalActivities = allRuns.length;

  const avgPaceSeconds = totalKm > 0 ? Math.round(totalSeconds / totalKm) : 0;

  // Calculate aggregate heartrate, cadence, elevation
  const avgHeartrate = totalActivities > 0
    ? Math.round(
        allRuns.reduce((sum: number, a: StravaActivity) => sum + Number(a.average_heartrate ?? 0), 0) / totalActivities * 100
      ) / 100
    : null;
  const avgCadence = totalActivities > 0
    ? Math.round(
        allRuns.reduce((sum: number, a: StravaActivity) => sum + Number(a.average_cadence ?? 0), 0) / totalActivities * 100
      ) / 100
    : null;
  const totalElevation = Math.round(
    allRuns.reduce((sum: number, a: StravaActivity) => sum + Number(a.total_elevation_gain ?? 0), 0) * 100
  ) / 100;

  // 5b) Insert activities into `activities` table for detailed tracking
  // Probe which optional columns exist in the `activities` table so we can
  // avoid inserting unknown columns (some deployments have older schema).
  const optionalColumns = [
    "id",
    "strava_activity_id",
    "total_elevation_gain",
    "average_cadence",
    "average_heartrate",
    "max_heartrate",
    "map_summary_polyline",
    "raw_json",
    "start_date_local",
    "timezone",
  ];

  const allowedColumns = new Set<string>();
  await Promise.all(optionalColumns.map(async (col) => {
    try {
      const { error } = await adminSupabase.from("activities").select(col).limit(1);
      if (!error) allowedColumns.add(col);
    } catch (err: unknown) {
      // If the column doesn't exist, PostgREST will return an error; ignore it
      // Log permission errors for diagnostics
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('permission denied')) {
        serverDebug.warn('[stravaService] Permission denied when probing activities columns:', col, msg);
        console.warn('[stravaService] Permission denied when probing activities columns:', col, msg);
      }
    }
  }));
  // Counter for how many new rows were inserted during this sync
  let newInsertedCount = 0;
  for (const activity of allRuns) {
    // Track whether this activity resulted in a new DB row
    let insertedNewRow = false;
    const participantId = null;
    // If Strava summary omitted some rich fields (HR/cadence/elevation/polyline),
    // fetch the detailed activity endpoint which commonly contains them.
    let detailedActivity: StravaDetailedActivity | StravaActivity = activity;
    const needsDetail = (
      (activity.total_elevation_gain === undefined || activity.total_elevation_gain === null) ||
      (activity.average_cadence === undefined || activity.average_cadence === null) ||
      (activity.average_heartrate === undefined || activity.average_heartrate === null) ||
      (((activity.map as StravaMap)?.summary_polyline === undefined || (activity.map as StravaMap)?.summary_polyline === null) && (activity.map_summary_polyline === undefined || activity.map_summary_polyline === null))
    );

    if (needsDetail) {
      try {
        const detUrl = `${STRAVA_ACTIVITIES_URL}/${activity.id}`;
        const detRes = await fetch(detUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (detRes.ok) {
          const detJson = await detRes.json();
          // merge detail over summary so we prefer detail values when present
          detailedActivity = { ...activity, ...(detJson as Partial<StravaDetailedActivity>) } as StravaDetailedActivity;
        } else {
          const txt = await detRes.text().catch(() => "");
          serverDebug.debug(`[stravaService] Activity detail fetch failed ${activity.id}: ${detRes.status} ${txt}`);
          console.debug(`[stravaService] Activity detail fetch failed ${activity.id}: ${detRes.status} ${txt}`);
        }
      } catch (err: unknown) {
        serverDebug.warn(`[stravaService] Exception fetching detail for activity ${String((activity as Record<string, unknown>).id)}:`, String(err));
        console.warn(`[stravaService] Exception fetching detail for activity ${String((activity as Record<string, unknown>).id)}:`, String(err));
      }
    }

    // Debug presence of rich fields after possible detail fetch
    try {
      const det = detailedActivity as StravaDetailedActivity;
      const hasElevation = det.total_elevation_gain !== undefined && det.total_elevation_gain !== null;
      const hasCadence = det.average_cadence !== undefined && det.average_cadence !== null;
      const hasHeartrate = det.average_heartrate !== undefined && det.average_heartrate !== null;
      const hasPolyline = ((det.map as StravaMap)?.summary_polyline) || det.map_summary_polyline;
      serverDebug.debug('[stravaService] Rich fields presence', {
        activityId: activity.id,
        hasElevation,
        hasCadence,
        hasHeartrate,
        hasPolyline,
      });
      console.debug('[stravaService] Rich fields presence', JSON.stringify({ activityId: activity.id, hasElevation, hasCadence, hasHeartrate, hasPolyline }));
    } catch (dbgErr: unknown) {
      serverDebug.warn('[stravaService] Failed to compute rich-field presence for activity', (activity as Record<string, unknown>).id, String(dbgErr));
      console.warn('[stravaService] Failed to compute rich-field presence for activity', (activity as Record<string, unknown>).id, String(dbgErr));
    }

    // Build a rich payload with fields commonly used in our schema. If the
    // DB doesn't have some optional columns, the upsert will fail with a
    // PGRST204 (missing column) and we'll fall back to the minimal payload
    // variants implemented earlier.
    const richPayload: Record<string, unknown> = {
      user_id: userId,
      challenge_participant_id: participantId,
      name: detailedActivity.name,
      type: detailedActivity.type || "Run",
      distance: detailedActivity.distance || 0,
      moving_time: detailedActivity.moving_time || 0,
      elapsed_time: detailedActivity.elapsed_time || 0,
      start_date: detailedActivity.start_date,
    };

    if (allowedColumns.has("strava_activity_id")) richPayload.strava_activity_id = detailedActivity.id;
    if (allowedColumns.has("id")) richPayload.id = String(detailedActivity.id);
    if (allowedColumns.has("total_elevation_gain")) richPayload.total_elevation_gain = detailedActivity.total_elevation_gain ?? detailedActivity.elevation_gain ?? null;
    if (allowedColumns.has("average_heartrate")) richPayload.average_heartrate = detailedActivity.average_heartrate ?? null;
    if (allowedColumns.has("max_heartrate")) richPayload.max_heartrate = detailedActivity.max_heartrate ?? null;
    if (allowedColumns.has("average_cadence")) richPayload.average_cadence = detailedActivity.average_cadence ?? null;
    if (allowedColumns.has("map_summary_polyline")) richPayload.map_summary_polyline = detailedActivity.map?.summary_polyline ?? detailedActivity.map_summary_polyline ?? null;
    if (allowedColumns.has("start_date_local")) richPayload.start_date_local = detailedActivity.start_date_local ?? null;
    if (allowedColumns.has("timezone")) richPayload.timezone = detailedActivity.timezone ?? null;
    if (allowedColumns.has("raw_json")) richPayload.raw_json = detailedActivity;

    // Minimal fallback payloads (keeps compatibility with older DBs)
    const minimalA: Record<string, unknown> = {
      strava_activity_id: activity.id,
      user_id: userId,
      challenge_participant_id: participantId,
      name: activity.name,
      type: activity.type || "Run",
      distance: activity.distance || 0,
      moving_time: activity.moving_time || 0,
      elapsed_time: activity.elapsed_time || 0,
      start_date: activity.start_date,
    };

    const minimalB: Record<string, unknown> = {
      id: String(activity.id),
      user_id: userId,
      challenge_participant_id: participantId,
      name: activity.name,
      type: activity.type || "Run",
      distance: activity.distance || 0,
      moving_time: activity.moving_time || 0,
      elapsed_time: activity.elapsed_time || 0,
      start_date: activity.start_date,
    };

    // Try rich payload first (will update existing rows). If the DB schema
    // doesn't support some fields, fallback to minimal variants.
      try {
      // If an activity already exists, update only non-null fields to avoid
      // overwriting existing values with nulls from Strava.
      const { data: existing } = await adminSupabase
        .from("activities")
        .select("*")
        .eq("id", activity.id)
        .limit(1)
        .maybeSingle();
      if (existing) {
        const merged: Record<string, unknown> = { ...(existing as Record<string, unknown>) };
        for (const k of Object.keys(richPayload)) {
          const v = richPayload[k as keyof typeof richPayload];
          // Only overwrite columns that already exist in the fetched row to
          // avoid adding unknown columns that would cause PostgREST errors.
          if ((k in merged) && v !== null && v !== undefined) (merged as Record<string, unknown>)[k] = v;
        }

        const { error: updErr } = await adminSupabase
          .from("activities")
          .update(merged)
          .eq("id", activity.id);

        if (updErr) {
          serverDebug.debug(`[stravaService] Update existing activity failed ${activity.id}:`, (updErr as { message?: string }).message);
          console.error(`[stravaService] Update existing activity failed ${activity.id}: ${(updErr as { message?: string }).message}`);
        }
      } else {
        // Insert new row with rich payload
        const { data: insData, error: insErr } = await adminSupabase
          .from("activities")
          .insert([richPayload]);

        if (insErr) {
          serverDebug.debug(`[stravaService] Rich insert failed for activity ${activity.id}:`, (insErr as { message?: string }).message);
          console.error(`[stravaService] Rich insert failed for activity ${activity.id}: ${(insErr as { message?: string }).message}`);

          // If schema missing columns, write audit and fallback
          if (((insErr as { code?: string }).code === "PGRST204") || (((insErr as { message?: string }).message || "").toLowerCase().includes("could not find"))) {
            try {
              await adminSupabase.from("admin__rls_audit").insert({
                table_name: "activities",
                operation: "insert",
                user_id: userId,
                attempted_by: "syncUserActivities.richInsert",
                error_code: (insErr as { code?: string }).code,
                message: (insErr as { message?: string }).message,
                payload: richPayload,
              });
            } catch (auditErr: unknown) {
              serverDebug.warn('[stravaService] Failed to write schema-missing audit entry', String(auditErr));
              console.warn('[stravaService] Failed to write schema-missing audit entry', String(auditErr));
            }
          }

          // Try minimal variants
          const { error: minErrA } = await adminSupabase
            .from("activities")
            .upsert([minimalA], { onConflict: "strava_activity_id" });

          if (minErrA) {
            serverDebug.debug(`[stravaService] Minimal A upsert failed for activity ${activity.id}:`, (minErrA as { message?: string }).message);
            console.error(`[stravaService] Minimal A upsert failed for activity ${activity.id}: ${(minErrA as { message?: string }).message}`);
            const { error: minErrB } = await adminSupabase
              .from("activities")
              .upsert([minimalB], { onConflict: "id" });

            if (minErrB) {
              serverDebug.error(`[stravaService] Minimal B upsert failed for activity ${activity.id}:`, minErrB);
              console.error(`[stravaService] Minimal B upsert failed for activity ${activity.id}:`, minErrB);
            } else {
              // MinimalB succeeded and likely inserted
              insertedNewRow = true;
            }
          } else {
            // MinimalA succeeded
            insertedNewRow = true;
          }
        } else {
          // rich insert succeeded
          if (insData && Array.isArray(insData) && (insData as unknown[]).length > 0) insertedNewRow = true;
        }
      }
    } catch (e: unknown) {
      serverDebug.error(`[stravaService] Unexpected error inserting/updating activity ${String((activity as Record<string, unknown>).id)}:`, String(e));
      console.error(`[stravaService] Unexpected error inserting/updating activity ${String((activity as Record<string, unknown>).id)}:`, String(e));
    }

    if (insertedNewRow) {
      newInsertedCount++;
    }
  }

  // 6) Completed: activities are inserted/updated in `activities` table.
  // DB triggers will assign activities to challenge participants and apply
  // challenge rules (pace, date window, require_map, etc.). Return basic aggregates.
  const baseResult = {
    totalKm,
    avgPaceSeconds,
    totalActivities,
    avgHeartrate,
    avgCadence,
    totalElevation,
    totalInserted: allRuns.length,
    newInserted: newInsertedCount,
    recalcFailedCount: 0,
  };
  // After inserting/updating activities, trigger DB-side recalculation for
  // any challenge participants that belong to this user so cached aggregates
  // (actual_km, total_activities, avg_pace_seconds) are updated.
  // Counter for RPC failures during recalculation
  /*let recalcFailedCount = 0;

  try {
    const { data: parts, error: partsErr } = await adminSupabase
      .from('challenge_participants')
      .select('id,challenge_id')
      .eq('user_id', userId);

    if (partsErr) {
      serverDebug.warn('[stravaService] Failed to load challenge_participants for user', userId, partsErr.message ?? partsErr);
      recalcFailedCount++;
    } else if (Array.isArray(parts) && parts.length > 0) {
      for (const p of parts) {
        try {
          const { error: rpcErr } = await adminSupabase.rpc('recalc_challenge_participant_aggregates', {
            p_challenge_id: p.challenge_id,
            p_participant_id: p.id,
          });
          if (rpcErr) {
            serverDebug.warn('[stravaService] recalc_challenge_participant_aggregates rpc error', { challenge_id: p.challenge_id, participant_id: p.id, message: rpcErr.message ?? rpcErr });
            recalcFailedCount++;
          }
        } catch (rpcEx) {
          serverDebug.warn('[stravaService] recalc_challenge_participant_aggregates rpc failed', rpcEx);
          recalcFailedCount++;
        }
      }
    }
  } catch (e) {
    serverDebug.warn('[stravaService] Error during post-sync recalculation', e);
    recalcFailedCount++;
  }
*/
  // Attach recalc status to result
//  baseResult.recalcFailedCount = recalcFailedCount;

  if (debug) {
    return { ...baseResult, filteredActivities };
  }

  return baseResult;
}

/**
 * Check if any activity is a race (event) and updates PBs if personal records are set.
 * For race activities, determines distance (HM/FM) and checks if time is a new PB.
 * If PB detected, updates profile with pb_hm_approved/pb_fm_approved = FALSE (pending approval).
 */
/*
export async function checkAndUpdatePBs(userId: string, activities: StravaActivity[]) {
  if (!activities || activities.length === 0) return;

  // Fetch current profile PBs
  const { data: profile, error: pErr } = await adminSupabase
    .from("profiles")
    .select("id, pb_hm_seconds, pb_fm_seconds, pb_hm_approved, pb_fm_approved")
    .eq("id", userId)
    .maybeSingle();

  if (pErr) {
    serverDebug.error(`[stravaService] Failed to load profile for PB check:`, pErr);
    return;
  }

  const currentPBHM = profile?.pb_hm_seconds ?? null;
  const currentPBFM = profile?.pb_fm_seconds ?? null;

  // Filter race activities (has race_type field or event_type indicator)
  const raceActivities = activities.filter((a) => {
    const r = a as StravaActivity;
    return !!(r.event_type || r.workout_type === 3 || r.flagged);
  });

  for (const race of raceActivities) {
    const r = race as StravaActivity;
    // Try to infer distance from activity name or metadata
    // Common patterns: "HM", "21k", "Half Marathon" -> HM, "FM", "42k", "Marathon" -> FM
    const name = String(r.name ?? "").toUpperCase();
    const distance = Number(r.distance ?? 0);
    const movingTime = Number(r.moving_time ?? 0);

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
      serverDebug.warn(`[stravaService] Race activity ${r.id} could not be classified (${name})`);
      continue;
    }

    // Check if this is a new PB
    const currentPB = raceDistance === "HM" ? currentPBHM : currentPBFM;
    const isNewPB = !currentPB || movingTime < currentPB;

    if (isNewPB) {
      serverDebug.debug(
        `[stravaService] New PB detected: ${raceDistance} = ${movingTime}s (old: ${currentPB}s)`
      );

      // Update profile with new PB time, but mark as pending approval
      const approvalField = raceDistance === "HM" ? "pb_hm_approved" : "pb_fm_approved";
      const pbField = raceDistance === "HM" ? "pb_hm_seconds" : "pb_fm_seconds";

      const updatePayload: Record<string, unknown> = {};
      updatePayload[pbField] = movingTime;
      updatePayload[approvalField] = false; // pending approval

      const { error: updateErr } = await adminSupabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", userId);

      if (updateErr) {
        serverDebug.error(`[stravaService] Failed to update PB:`, updateErr);
      } else {
        serverDebug.debug(`[stravaService] Profile updated with pending ${raceDistance} PB`);
      }

      // Add entry to pb_history
      const achievedAt = new Date(String(r.start_date ?? new Date())).toISOString().slice(0, 10);
      const { error: histErr } = await adminSupabase.from("pb_history").insert({
        user_id: userId,
        distance: raceDistance,
        time_seconds: movingTime,
        achieved_at: achievedAt,
        race_id: null, // could link to races table if this activity has race metadata
      });

      if (histErr) {
        serverDebug.error(`[stravaService] Failed to insert pb_history:`, histErr);
      }
    }
  }
}
*
/**
 * Wrapper to sync activities for the current month for a given userId.
 * - determines current month/year
 * - calls the month/year sync implementation
 * - computes progress percent based on participant.target_km and returns it
 */
export async function syncUserActivitiesForCurrentMonth(userId: string, debug: boolean = false) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // call the general sync function
  const result = await syncUserActivities(userId, month, year, debug);
  // Participant/challenge aggregation is handled by DB triggers; progress percent
  // is not computed here.
  return { ...result, progressPercent: null };
}

const stravaService = {
  refreshStravaToken,
  syncUserActivities,
};

export default stravaService;
