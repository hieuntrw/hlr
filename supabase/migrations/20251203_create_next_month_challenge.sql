/*
  Migration: Create helper function to auto-create next month's challenge

  This function will be scheduled (see initial migration) to run monthly
  and will insert a new row into `challenges` for the next month if one
  does not already exist for that start_date.

  Safe to run multiple times (idempotent check by start_date).
*/

CREATE OR REPLACE FUNCTION create_next_month_challenge()
RETURNS void AS $$
DECLARE
  v_year INT;
  v_month INT;
  v_start_date DATE;
  v_end_date DATE;
  v_title TEXT;
  v_exists INT;
BEGIN
  -- Compute first/last day of next month
  v_year := (EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month')))::INT;
  v_month := (EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month')))::INT;
  v_start_date := make_date(v_year, v_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  v_title := format('Thử thách %s/%s', lpad(v_month::text,2,'0'), v_year::text);

  SELECT COUNT(1) INTO v_exists FROM challenges WHERE start_date = v_start_date;
  IF v_exists = 0 THEN
    INSERT INTO challenges (title, start_date, end_date, is_locked, created_at)
    VALUES (v_title, v_start_date, v_end_date, FALSE, NOW());
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Note: The initial migration scheduled a cron job to call this function on the 25th of each month.
