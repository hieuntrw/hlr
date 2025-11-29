import { supabase } from "@/lib/supabase-client";
import {
  refreshStravaToken as oauthRefreshStravaToken,
} from "@/lib/strava-oauth";

const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";

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
    .select("id, start_date, end_date, is_locked")
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

    const runs = items.filter((a: any) => a.type === "Run");
    allRuns = allRuns.concat(runs);

    if (items.length < perPage) break;
    page += 1;
  }

  // 5) Aggregate metrics
  const totalMeters = allRuns.reduce((sum, a) => sum + (a.distance || 0), 0);
  const totalKm = Math.round((totalMeters / 1000) * 100) / 100; // two decimals
  const totalSeconds = allRuns.reduce((sum, a) => sum + (a.moving_time || a.elapsed_time || 0), 0);
  const totalActivities = allRuns.length;

  const avgPaceSeconds = totalKm > 0 ? Math.round(totalSeconds / totalKm) : 0;

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

  return {
    challengeId: challenge.id,
    participantId: participant.id,
    totalKm,
    avgPaceSeconds,
    totalActivities,
  };
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
