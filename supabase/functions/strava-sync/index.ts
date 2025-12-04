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

    // Fallback: Use Supabase REST to enumerate profiles with strava_id (simple placeholder)
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return jsonResponse({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' }, 500);
    }

    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?select=id,strava_id&strava_id=not.is.null&is_active=eq.true`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[supabase/function] profiles fetch failed:', res.status, text);
      return jsonResponse({ error: 'Failed to fetch profiles' }, 500);
    }

    const profiles = await res.json();

    // Placeholder behaviour: return list length and example ids.
    const ids = (profiles || []).map((p: any) => p.id);
    return jsonResponse({ success: true, count: ids.length, user_ids: ids.slice(0, 50) });
  } catch (err) {
    console.error('[supabase/function] Exception', err);
    return jsonResponse({ error: String(err) }, 500);
  }
}
