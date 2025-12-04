This addendum documents the new DB RPC and admin API added to the repository to support cached aggregate backfills and on-demand recalculation.

DB RPC
------

- Function: `public.recalc_challenge_participant_aggregates(p_challenge_id uuid, p_participant_id uuid DEFAULT NULL)`
  - Purpose: Recalculate aggregates for all participants in a challenge or a single participant when `p_participant_id` is provided.
  - Security: Implemented as `SECURITY DEFINER` so it can be invoked by the service role or from trusted server contexts.

  Example (SQL via Supabase SQL editor):

  ```sql
  -- Recalc all participants in a challenge
  select * from public.recalc_challenge_participant_aggregates('11111111-2222-3333-4444-555555555555'::uuid, NULL);

  -- Recalc a single participant
  select * from public.recalc_challenge_participant_aggregates('11111111-2222-3333-4444-555555555555'::uuid, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid);
  ```

  Example (REST RPC via Supabase REST endpoint using service key):

  ```bash
  curl -sS -X POST \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    "$SUPABASE_URL/rpc/recalc_challenge_participant_aggregates" \
    -d '{"p_challenge_id":"11111111-2222-3333-4444-555555555555","p_participant_id":null}'
  ```

Admin API
---------

- Endpoint: `POST /api/admin/challenges/:id/recalc`
  - Purpose: Server-side endpoint that aggregates activities for participants of a challenge and updates cached columns. This is a convenience wrapper that uses the Supabase service role client and requires an admin session to call from the web UI.
  - Usage (server-side or via browser with admin session cookie):

  ```bash
  # example curl: requires admin session cookie for auth
  curl -X POST "https://your-app.example.com/api/admin/challenges/11111111-2222-3333-4444-555555555555/recalc" \
    -b "__session=<admin_session_cookie>" \
    -H "Content-Type: application/json" \
    -d '{"participant_id": null}'
  ```

  For automation, call the DB RPC directly using the service-role key or call the Supabase REST RPC endpoint.

Backfill script
---------------

A Node script `scripts/backfill_challenge_aggregates.js` is included for manual backfills. It performs the same aggregation logic as the RPC but runs from Node using the service role key.

Usage:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node scripts/backfill_challenge_aggregates.js <challenge_id>
```

Integration notes
-----------------

- The Strava sync function (`supabase/functions/strava-sync`) has been updated to call this RPC after syncing activities for a participant. Deploy your updated function so scheduled syncs recompute cached aggregates automatically.
- Recommended flow:
  1. Apply migrations (adds cached columns + RPC).
  2. Run the Node backfill or call the RPC once to populate historical data.
  3. Deploy updated Strava sync function so new activities update caches automatically.
  4. Optionally schedule a nightly `recalc_challenge_participant_aggregates` run as a safety net.

Safety & performance notes
--------------------------

- The RPC runs server-side and uses SQL aggregates; it is efficient for bulk backfills and will avoid pulling large activity sets into Node memory.
- The Node backfill script is convenient for local runs but may be slower for very large datasets; prefer the RPC for production-scale backfills.

If you want, I can merge this addendum into `README_challenge_aggregates.md` (edit in place) or create a short bundled section instead. Let me know which you prefer.
