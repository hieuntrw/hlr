// Script to create a Supabase storage bucket named 'race-banners'
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create_race_banners_bucket.js

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const bucketId = 'race-banners';
    const makePublic = (process.env.PUBLIC || 'true').toLowerCase() === 'true';
    console.log(`Creating bucket: ${bucketId} (public=${makePublic})`);
    const { data, error } = await supabase.storage.createBucket(bucketId, { public: makePublic });
    if (error) {
      if (error.message && error.message.includes('already exists')) {
        console.log('Bucket already exists');
      } else {
        console.error('Error creating bucket:', error.message || error);
        process.exit(1);
      }
    } else {
      console.log('Bucket created:', data);
    }
    if (!makePublic) {
      console.log('Bucket created as private. Configure storage policies for admins/mods or serve via signed URLs.');
    } else {
      console.log('\nNext steps:');
      console.log('1. Configure storage policies if needed (Supabase Dashboard > Storage > race-banners > Policies)');
      console.log('2. Example policy for admin uploads:');
      console.log('   CREATE POLICY "Admin can upload race banners" ON storage.objects');
      console.log('   FOR INSERT TO authenticated');
      console.log('   WITH CHECK (bucket_id = \'race-banners\' AND EXISTS (');
      console.log('     SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN (\'admin\', \'mod_challenge\')');
      console.log('   ));');
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

main();
