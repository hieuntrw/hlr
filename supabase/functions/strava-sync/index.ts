// Supabase Edge Function (Deno) - Strava Sync scaffold
// This function is a lightweight scheduled runner that either:
// 1) Calls the Next.js internal cron endpoint if `NEXT_PUBLIC_BASE_URL` is set (easier for local/dev),
// 2) Or performs a basic Supabase REST query to enumerate connected profiles (service role) as a placeholder
//    for migrating the full sync logic from `lib/services/stravaService.ts` into this function.

// Deploy with: `supabase functions deploy strava-sync`

const SUPABASE_URL = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const NEXT_BASE = Deno.env.get('NEXT_PUBLIC_BASE_URL');
const CRON_SECRET = Deno.env.get('CRON_SECRET');

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default async function handler(req: Request) {
  try {
    // Protect: require header x-internal-secret matching CRON_SECRET if set
    const headerSecret = req.headers.get('x-internal-secret');
    if (CRON_SECRET && headerSecret !== CRON_SECRET) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // If NEXT app base url is present, prefer calling the existing internal cron route
    if (NEXT_BASE) {
      const cronUrl = `${NEXT_BASE.replace(/\/$/, '')}/api/cron/strava-sync`;
      const resp = await fetch(cronUrl, {
        method: 'POST',
        headers: {
          'x-internal-secret': CRON_SECRET || '',
          'content-type': 'application/json',
        },
      });

      const data = await resp.text();
      return new Response(data, { status: resp.status, headers: { 'content-type': 'application/json' } });
    }

    // Full in-function sync using Supabase REST and Strava API.
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return jsonResponse({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' }, 500);
    }

    const adminHeaders = {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    };

    // Get all active profiles with a Strava connection
    const profilesUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?select=id,strava_access_token,strava_refresh_token,strava_token_expires_at,strava_id&strava_id=not.is.null&is_active=eq.true`;
    const profilesRes = await fetch(profilesUrl, { headers: adminHeaders });
    if (!profilesRes.ok) {
      const text = await profilesRes.text();
      console.error('[supabase/function] profiles fetch failed:', profilesRes.status, text);
      return jsonResponse({ error: 'Failed to fetch profiles' }, 500);
    }

    const profiles = await profilesRes.json();
    const results: any[] = [];

    // Configuration for batching and rate limiting
    const BATCH_SIZE = Number(Deno.env.get('SYNC_BATCH_SIZE') || '5');
    const BATCH_DELAY_MS = Number(Deno.env.get('SYNC_BATCH_DELAY_MS') || '2000');

    // Helper: refresh strava token using client credentials
    async function refreshStravaToken(refreshToken: string) {
      const clientId = Deno.env.get('STRAVA_CLIENT_ID');
      const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
      if (!clientId || !clientSecret) throw new Error('Missing Strava client credentials');

      const resp = await fetch('https://www.strava.com/api/v3/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Strava refresh failed: ${resp.status} ${txt}`);
      }
      return resp.json();
    }

    // Helper to sleep between batches
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    async function processProfile(p: any) {
      try {
        const userId = p.id;

        // 1) Refresh token if needed
        let accessToken = p.strava_access_token;
        const expiresAt = Number(p.strava_token_expires_at) || 0;
        const nowSec = Math.floor(Date.now() / 1000);
        if (!accessToken || expiresAt <= nowSec + 60) {
          try {
            const tokenData = await refreshStravaToken(p.strava_refresh_token);
            accessToken = tokenData.access_token;
            // Persist new tokens to profile
            const updUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${userId}`;
            await fetch(updUrl, {
              method: 'PATCH',
              headers: adminHeaders,
              body: JSON.stringify({
                strava_access_token: tokenData.access_token,
                strava_refresh_token: tokenData.refresh_token,
                strava_token_expires_at: tokenData.expires_at,
              }),
            });
          } catch (re) {
            console.error(`[supabase/function] token refresh failed for ${userId}:`, re);
            return { user_id: userId, success: false, error: 'token_refresh_failed' };
          }
        }

        // 2) Find current month challenge
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
        const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

        const chUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/challenges?select=id,start_date,end_date,is_locked,min_pace_seconds,max_pace_seconds&start_date=gte.${startDate}&start_date=lte.${endDate}&limit=1`;
        const chRes = await fetch(chUrl, { headers: adminHeaders });
        if (!chRes.ok) {
          const txt = await chRes.text();
          console.error('[supabase/function] challenge fetch failed:', chRes.status, txt);
          return { user_id: userId, success: false, error: 'challenge_fetch_failed' };
        }
        const chs = await chRes.json();
        const challenge = chs && chs[0];
        if (!challenge) {
          return { user_id: userId, success: false, error: 'no_challenge' };
        }

        if (challenge.is_locked) {
          return { user_id: userId, success: false, error: 'challenge_locked' };
        }

        // cutoff 10 days after end_date
        const endDt = new Date(challenge.end_date);
        const cutoff = new Date(endDt.getTime() + 10 * 24 * 60 * 60 * 1000);
        if (new Date() > cutoff) {
          return { user_id: userId, success: false, error: 'sync_window_expired' };
        }

        // 3) Ensure user is registered as participant
        const partUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/challenge_participants?select=id,target_km&challenge_id=eq.${challenge.id}&user_id=eq.${userId}`;
        const partRes = await fetch(partUrl, { headers: adminHeaders });
        if (!partRes.ok) {
          const txt = await partRes.text();
          console.error('[supabase/function] participant fetch failed:', partRes.status, txt);
          return { user_id: userId, success: false, error: 'participant_fetch_failed' };
        }
        const parts = await partRes.json();
        const participant = parts && parts[0];
        if (!participant) {
          return { user_id: userId, success: false, error: 'not_registered' };
        }

        // 4) Fetch activities from Strava for the month
        const startTs = Math.floor(new Date(challenge.start_date).getTime() / 1000);
        const endTs = Math.floor(new Date(challenge.end_date).getTime() / 1000) + 24 * 60 * 60;
        let page = 1;
        const perPage = 200;
        let allRuns: any[] = [];
        const minPace = challenge.min_pace_seconds || 240;
        const maxPace = challenge.max_pace_seconds || 720;

        while (true) {
          const url = `https://www.strava.com/api/v3/athlete/activities?after=${startTs}&before=${endTs}&page=${page}&per_page=${perPage}`;
          const sres = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (!sres.ok) {
            const txt = await sres.text();
            throw new Error(`Strava fetch failed: ${sres.status} ${txt}`);
          }
          const items = await sres.json();
          if (!Array.isArray(items) || items.length === 0) break;

          const valid = items.filter((a: any) => {
            if (a.type !== 'Run' && a.type !== 'Walk') return false;
            const distanceMeters = a.distance || 0;
            const moving = a.moving_time || a.elapsed_time || 0;
            if (!distanceMeters || distanceMeters <= 0 || !moving || moving <= 0) return false;
            const pace = Math.round(moving / (distanceMeters / 1000));
            if (pace < minPace || pace > maxPace) return false;
            return true;
          });

          allRuns = allRuns.concat(valid);
          if (items.length < perPage) break;
          page += 1;
        }

        // 5) Aggregate
        const totalMeters = allRuns.reduce((s: number, a: any) => s + (a.distance || 0), 0);
        const totalKm = Math.round((totalMeters / 1000) * 100) / 100;
        const totalSeconds = allRuns.reduce((s: number, a: any) => s + (a.moving_time || a.elapsed_time || 0), 0);
        const totalActivities = allRuns.length;
        const avgPaceSeconds = totalKm > 0 ? Math.round(totalSeconds / totalKm) : 0;

        // 6) Upsert activities into activities table
        if (allRuns.length > 0) {
          const activitiesPayload = allRuns.map((activity: any) => ({
            strava_activity_id: activity.id,
            user_id: userId,
            challenge_participant_id: participant.id,
            name: activity.name,
            type: activity.type || activity.sport_type,
            distance: activity.distance || 0,
            moving_time: activity.moving_time || 0,
            elapsed_time: activity.elapsed_time || 0,
            elevation_gain: activity.total_elevation_gain || null,
            average_heartrate: activity.average_heartrate || null,
            max_heartrate: activity.max_heartrate || null,
            average_cadence: activity.average_cadence || null,
            start_date: activity.start_date,
            raw_json: activity,
          }));

          const actUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/activities?on_conflict=strava_activity_id`;
          const actRes = await fetch(actUrl, {
            method: 'POST',
            headers: { ...adminHeaders, Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(activitiesPayload),
          });
          if (!actRes.ok) {
            const txt = await actRes.text();
            console.error('[supabase/function] activity upsert failed:', actRes.status, txt);
          }
        }

        // 7) Update participant
        // Build update payload: keep existing fields for compatibility
        // and write new cached aggregate columns added by migration.
        const completionRate = participant.target_km
          ? Math.round((totalKm / Number(participant.target_km)) * 10000) / 100
          : 0;

        const isCompleted = participant.target_km ? totalKm >= Number(participant.target_km) : false;

        const updatePayload: any = {
          // canonical fields
          actual_km: totalKm,
          avg_pace_seconds: avgPaceSeconds,
          total_activities: totalActivities,
          status: isCompleted ? 'completed' : undefined,
          last_synced_at: new Date().toISOString(),

          // cached aggregate columns (use canonical DB column names)
          completion_rate: completionRate,
          completed: isCompleted,
        };

        const updPartUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/challenge_participants?id=eq.${participant.id}`;
        const updRes = await fetch(updPartUrl, {
          method: 'PATCH',
          headers: adminHeaders,
          body: JSON.stringify(updatePayload),
        });
        if (!updRes.ok) {
          const txt = await updRes.text();
          console.error('[supabase/function] participant update failed:', updRes.status, txt);
        }

        // 8) Call DB-side RPC to recalc cached aggregates if available
        // Prefer the new RPC `recalc_challenge_participant_aggregates(p_challenge_id, p_participant_id)`
        try {
          const rpcUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rpc/recalc_challenge_participant_aggregates`;
          await fetch(rpcUrl, {
            method: 'POST',
            headers: adminHeaders,
            body: JSON.stringify({ p_challenge_id: challenge.id, p_participant_id: participant.id }),
          });
        } catch (rpcErr) {
          // Fallback: try the older RPC name if present (keeps backward compatibility)
          try {
            const rpcUrlOld = `${SUPABASE_URL.replace(/\/$/, '')}/rpc/recalc_challenge_participant_status`;
            await fetch(rpcUrlOld, {
              method: 'POST',
              headers: adminHeaders,
              body: JSON.stringify({ p_participant_id: participant.id }),
            });
          } catch (e) {
            console.debug('[supabase/function] No recalc RPC available', e);
          }
        }

        return { user_id: userId, success: true, totalKm, totalActivities };
      } catch (err: any) {
        console.error('[supabase/function] Error for user', p.id, err);
        return { user_id: p.id, success: false, error: err?.message || String(err) };
      }
    }

    // Helper to sleep between batches
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    // Process profiles in batches to control concurrency and avoid rate limits
    for (let i = 0; i < (profiles || []).length; i += BATCH_SIZE) {
      const batch = (profiles || []).slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((p: any) => processProfile(p)));
      results.push(...batchResults);
      // Delay between batches to avoid hitting Strava/Supabase rate limits
      if (i + BATCH_SIZE < (profiles || []).length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    return jsonResponse({ success: true, processed: results.length, results });
  } catch (err) {
    console.error('[supabase/function] Exception', err);
    return jsonResponse({ error: String(err) }, 500);
  }
}
