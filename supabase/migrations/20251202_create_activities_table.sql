-- Tạo bảng activities để lưu hoạt động đã đồng bộ từ Strava
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT,
  distance NUMERIC, -- meters
  moving_time INTEGER, -- seconds
  elapsed_time INTEGER, -- seconds
  total_elevation_gain NUMERIC, -- meters
  type TEXT, -- Run, Walk, etc.
  start_date TIMESTAMPTZ,
  start_date_local TIMESTAMPTZ,
  timezone TEXT,
  average_speed NUMERIC,
  max_speed NUMERIC,
  average_cadence NUMERIC,
  average_heartrate NUMERIC,
  max_heartrate NUMERIC,
  achievement_count INTEGER,
  kudos_count INTEGER,
  athlete_count INTEGER,
  map_summary_polyline TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS activities_user_id_idx ON activities(user_id);
CREATE INDEX IF NOT EXISTS activities_start_date_idx ON activities(start_date DESC);
CREATE INDEX IF NOT EXISTS activities_user_date_idx ON activities(user_id, start_date DESC);

-- RLS Policies
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Users can read their own activities
CREATE POLICY "Users can read own activities"
  ON activities FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admin/mods can read all activities
CREATE POLICY "Admins and mods can read all activities"
  ON activities FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'mod_finance', 'mod_challenge', 'mod_member')
  );

-- System can insert activities (will be used by Strava sync function)
CREATE POLICY "System can insert activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own activities
CREATE POLICY "Users can delete own activities"
  ON activities FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE activities IS 'Lưu hoạt động chạy/đi bộ đã đồng bộ từ Strava API';
