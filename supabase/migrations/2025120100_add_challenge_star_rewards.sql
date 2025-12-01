/*
  Migration: Add Challenge Star Rewards System
  Date: 2025-12-01

  Changes:
  - Add `quantity` column to member_rewards (số sao)
  - Add `challenge_id` column to member_rewards to link challenge stars
  - Add `reward_type` column to distinguish between race rewards and challenge stars
  - Create function to auto-award stars based on challenge completion
  - Create trigger to call function when challenge_participants status changes

  Star Award Logic:
  - Target ≤ 100km → 1 star
  - Target ≤ 200km → 2 stars
  - Target ≤ 300km → 3 stars
  - Only awarded when status = 'completed' and actual_km >= target_km
*/

-- 1) Extend member_rewards table for challenge stars
ALTER TABLE IF EXISTS member_rewards
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenges(id),
  ADD COLUMN IF NOT EXISTS reward_type TEXT DEFAULT 'race' CHECK (reward_type IN ('race', 'challenge_star'));

-- Update existing rows to have reward_type = 'race'
UPDATE member_rewards SET reward_type = 'race' WHERE reward_type IS NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_member_rewards_challenge_id ON member_rewards(challenge_id);
CREATE INDEX IF NOT EXISTS idx_member_rewards_user_reward_type ON member_rewards(user_id, reward_type);

-- 2) Update reward_definitions to support challenge stars
ALTER TABLE IF EXISTS reward_definitions
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- 3) Create function to calculate stars based on target
CREATE OR REPLACE FUNCTION calculate_challenge_stars(target_km INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF target_km <= 100 THEN
    RETURN 1;
  ELSIF target_km <= 200 THEN
    RETURN 2;
  ELSIF target_km <= 300 THEN
    RETURN 3;
  ELSE
    RETURN 3; -- Max 3 stars for any challenge
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4) Create function to auto-award challenge stars
CREATE OR REPLACE FUNCTION auto_award_challenge_stars()
RETURNS TRIGGER AS $$
DECLARE
  stars_to_award INTEGER;
  existing_reward_id UUID;
BEGIN
  -- Only proceed if status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Check if actual_km >= target_km
    IF NEW.actual_km >= NEW.target_km THEN
      
      -- Calculate stars based on target
      stars_to_award := calculate_challenge_stars(NEW.target_km);
      
      -- Check if reward already exists for this user + challenge
      SELECT id INTO existing_reward_id
      FROM member_rewards
      WHERE user_id = NEW.user_id
        AND challenge_id = NEW.challenge_id
        AND reward_type = 'challenge_star';
      
      -- If no existing reward, create one
      IF existing_reward_id IS NULL THEN
        INSERT INTO member_rewards (
          user_id,
          challenge_id,
          reward_type,
          quantity,
          awarded_date,
          status
        ) VALUES (
          NEW.user_id,
          NEW.challenge_id,
          'challenge_star',
          stars_to_award,
          CURRENT_DATE,
          'delivered' -- Stars are automatically delivered
        );
        
        RAISE NOTICE 'Awarded % stars to user % for challenge %', stars_to_award, NEW.user_id, NEW.challenge_id;
      ELSE
        -- Update existing reward if stars increased
        UPDATE member_rewards
        SET quantity = stars_to_award,
            awarded_date = CURRENT_DATE
        WHERE id = existing_reward_id
          AND quantity < stars_to_award; -- Only update if more stars
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5) Create trigger on challenge_participants
DROP TRIGGER IF EXISTS trg_auto_award_challenge_stars ON challenge_participants;

CREATE TRIGGER trg_auto_award_challenge_stars
AFTER UPDATE OF status, actual_km ON challenge_participants
FOR EACH ROW
EXECUTE FUNCTION auto_award_challenge_stars();

-- 6) Backfill stars for existing completed challenges (optional)
-- This awards stars to participants who completed challenges before this migration
INSERT INTO member_rewards (user_id, challenge_id, reward_type, quantity, awarded_date, status)
SELECT 
  cp.user_id,
  cp.challenge_id,
  'challenge_star',
  calculate_challenge_stars(cp.target_km),
  COALESCE(cp.last_synced_at::date, CURRENT_DATE),
  'delivered'
FROM challenge_participants cp
WHERE cp.status = 'completed'
  AND cp.actual_km >= cp.target_km
  AND NOT EXISTS (
    SELECT 1 FROM member_rewards mr
    WHERE mr.user_id = cp.user_id
      AND mr.challenge_id = cp.challenge_id
      AND mr.reward_type = 'challenge_star'
  );

-- End of migration
