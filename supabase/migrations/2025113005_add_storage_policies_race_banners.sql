-- Storage policies for race-banners bucket
-- Public read; admin and mod_challenge can upload

-- Ensure storage schema exists (managed by Supabase)
-- Policy: public can read objects in race-banners
CREATE POLICY IF NOT EXISTS "Public read race banners"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'race-banners'
  );

-- Policy: admins and mod_challenge can insert/upload to race-banners
CREATE POLICY IF NOT EXISTS "Admins/mods upload race banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'race-banners' AND EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','mod_challenge')
    )
  );

-- Optional: allow delete/update by admins
CREATE POLICY IF NOT EXISTS "Admins manage race banners"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'race-banners' AND EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin')
    )
  )
  WITH CHECK (
    bucket_id = 'race-banners' AND EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin')
    )
  );
