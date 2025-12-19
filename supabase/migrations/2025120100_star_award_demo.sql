-- Demo: test auto_award_challenge_stars trigger and backfill
-- Usage: run this against your development DB. It creates a test profile and a
-- challenge_participant, updates it to 'completed' to fire the trigger, then
-- selects any member_star_awards inserted for verification.

BEGIN;

-- Ensure mapping is set in system_settings (adjust values as desired)
INSERT INTO system_settings (key, value)
VALUES ('challenge_star_milestones', '{"70":1,"100":1,"150":1,"200":2,"250":2,"300":3}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Create a test profile and challenge_participant, then update to trigger award
WITH p AS (
  INSERT INTO profiles (id, full_name, email, created_at, updated_at)
  VALUES (gen_random_uuid(), 'Star Test User', 'star-test@example.com', NOW(), NOW())
  RETURNING id
), cp AS (
  INSERT INTO challenge_participants (id, user_id, target_km, actual_km, status, created_at, updated_at)
  SELECT gen_random_uuid(), p.id, 200, 0, 'in_progress', NOW(), NOW() FROM p
  RETURNING id
)
-- Update to completed to fire trigger
UPDATE challenge_participants
SET status = 'completed', actual_km = 200, updated_at = NOW()
WHERE id = (SELECT id FROM cp);

-- Give the trigger a moment, then inspect member_star_awards
SELECT msa.* FROM member_star_awards msa
WHERE msa.challenge_participant_id = (SELECT id FROM cp);

-- To clean up (optional): delete the demo rows below
-- DELETE FROM member_star_awards WHERE challenge_participant_id IN (SELECT id FROM challenge_participants WHERE user_id IN (SELECT id FROM profiles WHERE email = 'star-test@example.com'));
-- DELETE FROM challenge_participants WHERE user_id IN (SELECT id FROM profiles WHERE email = 'star-test@example.com');
-- DELETE FROM profiles WHERE email = 'star-test@example.com';

COMMIT;

-- End of demo
