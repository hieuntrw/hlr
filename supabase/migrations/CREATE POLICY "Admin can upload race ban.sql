CREATE POLICY "Admin can upload race banners" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'race-banners' AND EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'mod_challenge')
));