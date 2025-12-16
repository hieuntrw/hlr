-- Placeholder migration: DESTRUCTIVE migration was created but is intentionally disabled.
-- Date: 2025-12-16 (modified)
--
-- NOTE: The team decided to keep `reward_definitions` and `member_rewards.reward_definition_id` for
-- the 'lucky draw' / challenge completion use-case. To avoid accidental destructive runs,
-- this file is now a no-op. Do NOT run this file expecting it to remove the legacy table.

-- If you later decide to remove the legacy column/table, replace this file with a
-- reviewed migration that performs the DROP/RENAME steps after backups and verification.

-- Safety: no operations performed.

-- End no-op migration
