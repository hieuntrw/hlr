Purpose
-------
This document explains recommended schema changes and strategies to avoid re-aggregating all Strava activities each time the Challenges page loads.

Goals
- Add cached aggregate columns to `challenge_participants` so reads (leaderboard, participant rows) are cheap.
- Provide safe backfill SQL and recommended update patterns (sync-time incremental update, triggers, or scheduled jobs).

Suggested new columns (already added by migration):
- `total_km` (numeric(10,2)) — total valid km for this participant in the challenge
- `avg_pace_seconds` (integer) — average pace seconds-per-km across valid activities
- `valid_activities_count` (integer) — count of valid activities counted toward the challenge
- `completion_rate` (numeric(5,2)) — percent completion = (total_km / target_km) * 100
- `completed` (boolean) — whether participant reached target_km (true/false)
- `last_synced_at` (timestamptz) — last update timestamp for cached aggregates

Why use cached aggregates
- Aggregation across many activities (per member) is expensive when performed on every page load, and causes repeated load on the DB/edge function.
- A cached column lets the UI query a single row per participant and sort by `total_km` for leaderboards quickly (index supported).

How to maintain these values (options)

1) Update during Strava sync (recommended)
- When your background sync fetches activities for a user, compute deltas (new/changed/removed activities) and update the corresponding `challenge_participants` row(s) for that user.
- Advantages: simple, accurate at sync time, no extra DB triggers.
- Implementation sketch (pseudocode):

  - For each fetched activity A for user U:
    - Determine which challenge(s) the activity applies to (date range, require_map flag, min_km, pace rules)
    - For each affected challenge C:
      - Compute activity contribution (distance_km, avg_pace_seconds) and whether activity is valid
      - Update challenge_participants set
          total_km = total_km + delta_km,
          valid_activities_count = valid_activities_count + (is_valid ? 1 : 0),
          avg_pace_seconds = (existing_total_pace_seconds + activity_pace_seconds) / valid_activities_count,
          completion_rate = round((total_km / target_km) * 100, 2),
          completed = (total_km >= target_km),
          last_synced_at = now()

  - Do this in a transaction (or upsert) for each participant to avoid races.

2) Trigger on activities table (alternate)
- Create Postgres `AFTER INSERT OR UPDATE OR DELETE` trigger on the activities table that calls a stored procedure to update `challenge_participants` aggregates for the affected user & challenge(s).
- Advantages: updates are done at DB-level, centralised.
- Disadvantages: may slow writes on the activities table and can be complex if activity validation rules are implemented in app code.

3) Scheduled recompute (materialized view or cron job)
- Build a materialized view or a nightly job that recalculates aggregates for all participants and writes them to `challenge_participants` (bulk upsert). Use when historical corrections are needed.
- Advantage: simple correctness, can be scheduled off-peak.
- Disadvantage: aggregates may be stale between runs.

Backfill example (SQL)
-- WARNING: replace `activities` with your actual activities table name and column names
-- This is a single-run script to compute aggregates from activity records and populate `challenge_participants`.

-- Example backfill: (adjust columns, units as needed)
BEGIN;

WITH agg AS (
  SELECT
    cp.id AS cp_id,
    SUM(a.distance_km) AS total_km,
    AVG(a.avg_pace_seconds) AS avg_pace_seconds,
    COUNT(*) FILTER (WHERE a.is_valid) AS valid_activities_count
  FROM public.challenge_participants cp
  JOIN public.activities a ON a.member_id = cp.member_id
    AND a.activity_date >= cp.challenge_start_date -- adapt to your schema
    AND a.activity_date <= cp.challenge_end_date
  WHERE a.is_valid = true
  GROUP BY cp.id
)
UPDATE public.challenge_participants cp
SET
  total_km = COALESCE(agg.total_km, 0),
  avg_pace_seconds = agg.avg_pace_seconds,
  valid_activities_count = COALESCE(agg.valid_activities_count, 0),
  completion_rate = CASE WHEN cp.target_km > 0 THEN ROUND(COALESCE(agg.total_km, 0) / cp.target_km * 100, 2) ELSE 0 END,
  completed = (COALESCE(agg.total_km, 0) >= cp.target_km),
  last_synced_at = now()
FROM agg
WHERE cp.id = agg.cp_id;

COMMIT;

Notes on units and types
- I recommend storing distances in meters as integers or kilometers with fixed decimal (numeric(10,2)). If you store meters as integer you avoid floating errors.
- Store pace as integer seconds-per-km to simplify averaging.

Indexes
- The migration creates `idx_challenge_participants_challenge_total_km` for fast ORDER BY total_km DESC per challenge.

API considerations
- For operations that must update aggregates from client actions (admin override, manual activity entry), expose server APIs that recalc a participant or recalc a whole challenge (e.g., POST /api/admin/challenges/:id/recalc).
- These APIs should run with service-role credentials or inside a safe transaction.

Concurrency
- Use transactions and `SELECT ... FOR UPDATE` or atomic UPDATE expressions when adjusting totals to avoid lost updates when two sync workers update the same participant simultaneously.

Monitoring
- Add `last_synced_at` and an admin page to surface participants with stale caches.

Summary recommendation (practical)
- Best immediate approach: add cached columns (migration done), then update your existing Strava sync code to compute deltas and update `challenge_participants` when new activities are processed. Add a nightly verification job to re-aggregate everything and correct drift.

New RPC and Admin API
---------------------

This repository now includes a DB-side RPC and an admin HTTP API to help with backfills and on-demand recalculations.

- DB RPC: `public.recalc_challenge_participant_aggregates(p_challenge_id uuid, p_participant_id uuid DEFAULT NULL)`
  - Purpose: Recalculate aggregates for all participants in a challenge or a single participant when `p_participant_id` is provided.
  - Security: created as `SECURITY DEFINER` so it can be invoked by the service role or trusted server contexts.
  - Example (SQL via Supabase SQL editor):

    ```sql
    -- Recalc all participants in a challenge
    select * from public.recalc_challenge_participant_aggregates('11111111-2222-3333-4444-555555555555'::uuid, NULL);

    -- Recalc a single participant
    select * from public.recalc_challenge_participant_aggregates('11111111-2222-3333-4444-555555555555'::uuid, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid);
    ```

  - Example (REST RPC via Supabase REST endpoint using service key):

    ```bash
    curl -sS -X POST \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      "$SUPABASE_URL/rpc/recalc_challenge_participant_aggregates" \
      -d '{"p_challenge_id":"11111111-2222-3333-4444-555555555555","p_participant_id":null}'
    ```

- Admin API: `POST /api/admin/challenges/:id/recalc`
  - Purpose: Server-side endpoint that aggregates activities for participants of a challenge and updates cached columns. This is a convenience wrapper that uses the Supabase service role client and requires an admin session to call from the web UI.
  - Usage (server-side or via browser with admin session cookie):

    ```bash
    # example curl: requires admin session cookie for auth
    curl -X POST "https://your-app.example.com/api/admin/challenges/11111111-2222-3333-4444-555555555555/recalc" \
      -b "__session=<admin_session_cookie>" \
      -H "Content-Type: application/json" \
      -d '{"participant_id": null}'
    ```

  - For automation, use the Supabase service-role directly (the admin API uses service-role internally) or call the DB RPC directly.

Backfill script
---------------

A Node script `scripts/backfill_challenge_aggregates.js` is included for manual backfills. It performs the same aggregation logic as the RPC but runs from Node using the service role key.

Usage:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node scripts/backfill_challenge_aggregates.js <challenge_id>
```

Notes on integration
---------------------
- The Strava sync function in `supabase/functions/strava-sync` has been updated to call the new RPC after syncing activities for a participant. Deploy the updated function so your scheduled syncs recompute cached aggregates automatically.
- Recommended flow:
  1. Apply migrations (adds cached columns + RPC).
  2. Run the Node backfill or call the RPC once to populate historical data.
  3. Deploy updated Strava sync function so new activities update caches automatically.
  4. Optionally schedule a nightly `recalc_challenge_participant_aggregates` run as a safety net.

Safety & performance notes
--------------------------

- The RPC runs server-side and uses SQL aggregates; it is efficient for bulk backfills and will avoid pulling large activity sets into Node memory.
- The Node backfill script is convenient for local runs but may be slower for very large datasets; prefer the RPC for production-scale backfills.

If you want, I can remove the separate addendum file and keep only this merged README.
