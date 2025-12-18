const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(2);
}
const client = createClient(url, key, { auth: { persistSession: false } });

async function normRows(rows, relField, relConfigField) {
  if (!rows) return [];
  return rows.map((r) => {
    const rec = { ...r };
    if (!('member_id' in rec) && 'user_id' in rec) rec.member_id = rec.user_id;
    if (!('cash_amount' in rec)) {
      const rel = rec[relConfigField];
      if (rel && typeof rel === 'object' && 'cash_amount' in rel) rec.cash_amount = Number(rel.cash_amount ?? 0);
    } else {
      rec.cash_amount = Number(rec.cash_amount ?? 0);
    }
    return rec;
  });
}

async function run() {
  try {
    // milestone rich select
    let mm = null;
    try {
      const r = await client.from('member_milestone_rewards').select('*, profiles(id,full_name), reward_milestones(id, milestone_name, reward_description, cash_amount)').order('created_at', { ascending: false });
      if (r.error) {
        console.warn('rich milestone select error:', r.error.message);
      } else {
        mm = r.data;
      }
    } catch (e) {
      console.warn('rich milestone exception', e.message || e);
    }
    if (!mm || mm.length === 0) {
      const fb = await client.from('member_milestone_rewards').select('*').order('created_at', { ascending: false }).limit(50);
      if (fb.error) console.warn('fallback milestone select error', fb.error.message);
      mm = fb.data;
    }
    mm = await normRows(mm, 'profiles', 'reward_milestones');

    // podium
    let pr = null;
    try {
      const r2 = await client.from('member_podium_rewards').select('*, profiles(id,full_name), reward_podium_config(id,reward_description,cash_amount)').order('created_at', { ascending: false });
      if (r2.error) console.warn('rich podium select error:', r2.error.message);
      else pr = r2.data;
    } catch (e) {
      console.warn('rich podium exception', e.message || e);
    }
    if (!pr || pr.length === 0) {
      const fb2 = await client.from('member_podium_rewards').select('*').order('created_at', { ascending: false }).limit(50);
      if (fb2.error) console.warn('fallback podium select error', fb2.error.message);
      pr = fb2.data;
    }
    pr = await normRows(pr, 'profiles', 'reward_podium_config');

    const combined = [...(mm || []).map(r => ({ __type: 'milestone', ...r })), ...(pr || []).map(r => ({ __type: 'podium', ...r }))];
    console.log('combined count:', combined.length);
    console.log(JSON.stringify(combined, null, 2));
  } catch (e) {
    console.error('Exception', e);
  }
}

run();
