#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    console.error('Missing SUPABASE service role env vars (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Try to find a pending reward in order: member_milestone_rewards, member_podium_rewards, lucky_draw_winners, member_star_awards
  const tables = ['member_milestone_rewards','member_podium_rewards','lucky_draw_winners','member_star_awards'];
  let found = null;
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').eq('status','pending').limit(1).order('created_at', { ascending: false });
    if (error) {
      console.warn('Error querying', t, error.message || error);
      continue;
    }
    if (data && data.length > 0) { found = { table: t, row: data[0] }; break; }
  }
  if (!found) {
    console.log('No pending reward found in any table.');
    process.exit(0);
  }

  console.log('Found pending:', found.table, 'id=', found.row.id);
  const testDeliverer = process.env.TEST_DELIVERER_ID || '00000000-0000-0000-0000-000000000000';
  const updates = { status: 'delivered', delivered_at: new Date().toISOString(), delivered_by: testDeliverer };
  const { data: before } = await supabase.from(found.table).select('*').eq('id', found.row.id).maybeSingle();
  console.log('Before:', before);
  const { data: updated, error: updErr } = await supabase.from(found.table).update(updates).eq('id', found.row.id).select().maybeSingle();
  if (updErr) {
    console.error('Update error:', updErr.message || updErr);
    process.exit(2);
  }
  console.log('After:', updated);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(3); });
