-- Create `member_star_awards` and backfill from legacy `member_rewards.quantity` rows
-- Date: 2025-12-17
-- Idempotent: safe to run multiple times

BEGIN;

-- 1) Create table for member star awards
CREATE TABLE IF NOT EXISTS member_star_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_participant_id UUID REFERENCES challenge_participants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) DEFAULT 'awarded' CHECK (status IN ('awarded', 'pending', 'revoked')),
  legacy_member_reward_id UUID UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_star_member ON member_star_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_member_star_challenge ON member_star_awards(challenge_participant_id);

-- 2) Backfill: insert rows from member_rewards where quantity is not null
WITH src AS (
  SELECT mr.* FROM member_rewards mr WHERE mr.quantity IS NOT NULL
), to_insert AS (
  SELECT s.* FROM src s
  LEFT JOIN member_star_awards msa ON msa.legacy_member_reward_id = s.id
  WHERE msa.id IS NULL
)
INSERT INTO member_star_awards (user_id, challenge_participant_id, quantity, status, legacy_member_reward_id, created_at, updated_at)
SELECT
  ti.user_id,
  ti.challenge_id,
  COALESCE(ti.quantity, 1)::INTEGER,
  COALESCE(ti.status, 'awarded')::text,
  ti.id,
  ti.created_at,
  ti.created_at
FROM to_insert ti
ON CONFLICT DO NOTHING;

-- 3) Summary notice (psql will show notices if run interactively)
-- SELECT count(*) FROM member_star_awards WHERE created_at >= now() - interval '1 hour';

COMMIT;

-- Verification queries:
-- SELECT count(*) FROM member_rewards WHERE quantity IS NOT NULL;
-- SELECT count(*) FROM member_star_awards WHERE legacy_member_reward_id IS NOT NULL;
