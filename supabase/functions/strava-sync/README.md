Supabase Function: strava-sync
=================================

Purpose
-------
This function is a scaffold for a Supabase Scheduled Function (Edge Function) that runs Strava syncs.

Behavior
--------
- If `NEXT_PUBLIC_BASE_URL` is set in the function's environment, the function will proxy a POST to
  the existing Next.js cron endpoint at `/api/cron/strava-sync` and return its response. This makes
  local development and migration simpler.
- Otherwise it will use the Supabase REST API (service role key) to enumerate connected profiles as
  a placeholder for migrating the sync logic here.

Deployment
----------
1. Install Supabase CLI: https://supabase.com/docs/guides/cli
2. From repo root:

```bash
supabase functions deploy strava-sync --project-ref <project-ref>
```

Configuration / Secrets
-----------------------
Set function environment variables (via `supabase secrets set` or the Supabase dashboard):

- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (required for direct DB access fallback)
- `NEXT_PUBLIC_BASE_URL` - (optional) public URL of the Next.js app to call internal cron route
- `CRON_SECRET` - (recommended) secret value required in header `x-internal-secret` when calling

Scheduling
----------
Supabase functions can be invoked from an external scheduler (e.g., GitHub Actions, cron on a VM),
or with Supabase's scheduled triggers where supported. Use your platform scheduler to POST to the
function endpoint with `x-internal-secret: <CRON_SECRET>`.

Migration notes
---------------
- The main sync logic currently lives in `lib/services/stravaService.ts`. To fully migrate to this
  Supabase Edge Function you should port `syncUserActivitiesForCurrentMonth` into `index.ts` (Deno
  compatible) or rework it to use the Supabase REST API + Strava HTTP calls directly.
- Be careful with long-running tasks: Deno functions have execution time limits. For many users,
  consider batching and pagination; keep per-invocation time bounded.
