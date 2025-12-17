-- Migration: Drop legacy lucky_draws and the sessions helper
-- Date: 2025-12-17

BEGIN;

-- Remove server-side helper functions created earlier (if present)
DROP FUNCTION IF EXISTS run_lucky_draw(UUID, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS populate_lucky_draw_entries_for_challenge(UUID);

-- Drop session table (we no longer use sessions; flow uses entries + winners)
DROP TABLE IF EXISTS lucky_draw_sessions CASCADE;

-- Drop legacy lucky_draws table (redundant)
DROP TABLE IF EXISTS lucky_draws CASCADE;

COMMIT;
