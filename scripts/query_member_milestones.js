const dotenv = require('dotenv');
// prefer .env.local (Next.js uses it); fall back to .env
dotenv.config({ path: '.env.local' });
dotenv.config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(2);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function run() {
  try {
    console.log('Running rich select (with relations)');
    const r = await supabase
      .from('member_milestone_rewards')
      .select('*, profiles(id, full_name, email), reward_milestones(id, milestone_name, reward_description, cash_amount)')
      .order('created_at', { ascending: false })
      .limit(20);
    console.log('rich select error:', r.error ? r.error.message : null);
    console.log('rich select rows:', Array.isArray(r.data) ? r.data.length : r.data);

    console.log('\nRunning simple select (*)');
    const s = await supabase.from('member_milestone_rewards').select('*').order('created_at', { ascending: false }).limit(20);
    console.log('simple select error:', s.error ? s.error.message : null);
    console.log('simple select rows:', Array.isArray(s.data) ? s.data.length : s.data);
    console.log(JSON.stringify(s.data, null, 2));
  } catch (e) {
    console.error('Exception:', e);
  }
}

run();
