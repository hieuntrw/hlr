-- Link transactions to member_rewards and vice versa for payout reconciliation
ALTER TABLE IF EXISTS transactions
  ADD COLUMN IF NOT EXISTS related_member_reward_id UUID REFERENCES member_rewards(id);

ALTER TABLE IF EXISTS member_rewards
  ADD COLUMN IF NOT EXISTS related_transaction_id UUID REFERENCES transactions(id);
