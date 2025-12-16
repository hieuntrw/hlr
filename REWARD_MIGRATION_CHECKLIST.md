# Reward Definitions Cleanup — Migration Checklist

Purpose: Safely backfill legacy `member_rewards` entries that reference `reward_definitions` into the new specialized tables (`member_podium_rewards`, `member_milestone_rewards`) and prepare for deprecation of `reward_definitions`.

Files added:
- `supabase/migrations/20251216_migrate_rewards_from_definitions.sql`

Pre-reqs:
- Create a full DB backup/snapshot of the target database (staging first).
- Ensure you have the Supabase service role key or DB superuser credentials.
- Run on staging and verify before production.

Run (example using psql):
```bash
# From environment where DATABASE_URL is set to staging DB
psql "$DATABASE_URL" -f supabase/migrations/20251216_migrate_rewards_from_definitions.sql
```

Verification steps (staging):
1. Check migration run output for NOTICE messages showing counts.
2. Validate sample rows:
   - Verify several `member_podium_rewards` rows referencing the correct `podium_config_id` and `race_result_id`.
   - Verify several `member_milestone_rewards` rows reference a `milestone_id` and that `reward_description`/`cash_amount` are populated.
3. Cross-check counts against legacy rows:
   - SELECT COUNT(*) FROM member_rewards WHERE reward_definition_id IS NOT NULL;
   - SELECT COUNT(*) FROM member_podium_rewards WHERE created_at >= '<migration run time>';
   - SELECT COUNT(*) FROM member_milestone_rewards WHERE created_at >= '<migration run time>';
4. Application smoke tests:
   - Load admin member rewards UI: `/admin/member-rewards` and confirm pending list and new specialized tables are reflected.
   - Load an affected race detail page and confirm milestone/podium descriptions appear as expected.
5. Manual spot-check for a few users that had legacy rewards: verify delivered/pending statuses and related transactions.

Post-verification steps (manual):
1. Rename `reward_definitions` to keep it for audit (recommended):
   ```sql
   ALTER TABLE reward_definitions RENAME TO reward_definitions_deprecated;
   ```
2. If all verification passes after a retention period, drop `reward_definitions_deprecated`.

Rollback plan:
- Restore DB from snapshot if critical mismatch discovered.

Notes:
- The migration inserts are idempotent (use `ON CONFLICT DO NOTHING`).
- This migration does NOT automatically drop legacy schema — renaming is provided as an explicit manual step.

Note: We are intentionally keeping `reward_definitions` in the database for the "lucky draw" and other legacy prize usages recorded in `member_rewards`. The checklist assumes `reward_definitions` may remain; if you later decide to remove it, follow the manual rename/drop steps after additional verification.

If you'd like, I can also prepare a follow-up migration to drop/clean columns referencing `reward_definition_id` after you confirm counts.
