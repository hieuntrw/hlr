-- Idempotent migration: create transactions for cash prizes in reward tables
-- Date: 2025-12-17
-- For any member_milestone_rewards or member_podium_rewards with cash_amount > 0
-- and no related_transaction_id, insert a corresponding transaction and link it.

BEGIN;

-- Ensure related_transaction_id columns exist (no-op if already present)
ALTER TABLE IF EXISTS member_milestone_rewards
  ADD COLUMN IF NOT EXISTS related_transaction_id UUID REFERENCES transactions(id);

ALTER TABLE IF EXISTS member_podium_rewards
  ADD COLUMN IF NOT EXISTS related_transaction_id UUID REFERENCES transactions(id);

-- 1) Create transactions for milestone rewards
WITH candidates AS (
  SELECT id, member_id, cash_amount, created_at
  FROM member_milestone_rewards
  WHERE cash_amount > 0 AND (related_transaction_id IS NULL)
), inserted AS (
  INSERT INTO transactions (user_id, type, amount, description, transaction_date, payment_status, created_at)
  SELECT
    c.member_id,
    'reward_payout',
    c.cash_amount,
    format('Auto-created payout for member_milestone_rewards id=%s', c.id::text),
    now()::date,
    'paid',
    now()
  FROM candidates c
  RETURNING id, created_at
)
-- Update member_milestone_rewards to reference the newly created transactions.
-- We match by description since RETURNING does not carry candidate id; perform UPDATE using a join on transactions.description.
UPDATE member_milestone_rewards mm
SET related_transaction_id = t.id
FROM transactions t
WHERE mm.related_transaction_id IS NULL
  AND t.type = 'reward_payout'
  AND t.description = format('Auto-created payout for member_milestone_rewards id=%s', mm.id::text)
  AND mm.cash_amount > 0;

-- 2) Create transactions for podium rewards
WITH candidates2 AS (
  SELECT id, member_id, cash_amount, created_at
  FROM member_podium_rewards
  WHERE cash_amount > 0 AND (related_transaction_id IS NULL)
)
INSERT INTO transactions (user_id, type, amount, description, transaction_date, payment_status, created_at)
SELECT
  c2.member_id,
  'reward_payout',
  c2.cash_amount,
  format('Auto-created payout for member_podium_rewards id=%s', c2.id::text),
  now()::date,
  'paid',
  now()
FROM candidates2 c2
ON CONFLICT DO NOTHING;

UPDATE member_podium_rewards mp
SET related_transaction_id = t.id
FROM transactions t
WHERE mp.related_transaction_id IS NULL
  AND t.type = 'reward_payout'
  AND t.description = format('Auto-created payout for member_podium_rewards id=%s', mp.id::text)
  AND mp.cash_amount > 0;

COMMIT;

-- Verification queries:
-- SELECT count(*) FROM member_milestone_rewards WHERE cash_amount > 0 AND related_transaction_id IS NOT NULL;
-- SELECT count(*) FROM member_podium_rewards WHERE cash_amount > 0 AND related_transaction_id IS NOT NULL;
