-- Storage policies for race-banners bucket
-- Public read; admin and mod_challenge can upload

-- Ensure storage schema exists (managed by Supabase)
-- Policy: public can read objects in race-banners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.policyname = 'Public read race banners' AND p.schemaname = 'storage' AND p.tablename = 'objects'
  ) THEN
    EXECUTE $policy$CREATE POLICY "Public read race banners" ON storage.objects FOR SELECT TO public USING (bucket_id = 'race-banners')$policy$;
  END IF;
END
$$ LANGUAGE plpgsql;

-- Policy: admins and mod_challenge can insert/upload to race-banners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.policyname = 'Admins/mods upload race banners' AND p.schemaname = 'storage' AND p.tablename = 'objects'
  ) THEN
    EXECUTE $policy$CREATE POLICY "Admins/mods upload race banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'race-banners' AND ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','mod_challenge')))$policy$;
  END IF;
END
$$ LANGUAGE plpgsql;

-- Optional: allow delete/update by admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.policyname = 'Admins manage race banners' AND p.schemaname = 'storage' AND p.tablename = 'objects'
  ) THEN
    EXECUTE $policy$CREATE POLICY "Admins manage race banners" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'race-banners' AND ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin'))) WITH CHECK (bucket_id = 'race-banners' AND ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')))$policy$;
  END IF;
END
$$ LANGUAGE plpgsql;
