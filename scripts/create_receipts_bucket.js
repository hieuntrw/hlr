// Script to create a Supabase storage bucket named 'receipts'
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create_receipts_bucket.js

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
    const bucketId = 'receipts';
    console.log('Creating bucket:', bucketId);
    const { data, error } = await supabase.storage.createBucket(bucketId, { public: true });
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
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

main();
