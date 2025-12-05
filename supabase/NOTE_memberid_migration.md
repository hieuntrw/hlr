Migration summary: member_id -> user_id

What I did
- Added `user_id` alias columns and backfilled them from `member_id` (migration: `20251206_add_user_id_aliases.sql`).
- Updated UI and server code to use `user_id` while still writing `member_id` for backward compatibility.
- Added a guarded migration to *deprecate* `member_id` by renaming it to `member_id_deprecated` so the old data remains available for manual inspection: `20251207_deprecate_member_id_columns.sql`.

Rollout plan
1. Run `20251206_add_user_id_aliases.sql` on production. This will add `user_id` and copy from `member_id` where present.
2. Deploy server + frontend which now read/write `user_id` (and still write `member_id` for compatibility).
3. Monitor logs and verify no missing data/errors for a release cycle.
4. Run `20251207_deprecate_member_id_columns.sql`. This will:
   - Ensure `user_id` exists and backfill any remaining rows from `member_id`.
   - Rename `member_id` -> `member_id_deprecated` (keeps data but removes the live `member_id` column). This is reversible: you can rename back if needed.
5. After another release cycle, and once you are confident, drop `member_id_deprecated` with a small maintenance window. I can prepare that SQL when you're ready.

Notes
- The migration scripts are idempotent and include guards to avoid failing when a column doesn't exist.
- I intentionally renamed `member_id` to `member_id_deprecated` instead of dropping it immediately to avoid data loss and to provide an easy rollback path.
- If you prefer an immediate drop instead of rename, tell me and I will prepare a drop migration (but I recommend the rename-first approach).