-- Migration: Insert default lucky_draw_winner_threshold into system_settings
-- Date: 2025-12-17

BEGIN;

-- Ensure system_settings exists then insert default if missing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_settings') THEN
    INSERT INTO system_settings (key, value, description)
    SELECT 'lucky_draw_winner_threshold', '2', 'Số lượng quà may mắn thử thách hàng tháng'
    WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'lucky_draw_winner_threshold');
  END IF;
END;
$$;

COMMIT;
