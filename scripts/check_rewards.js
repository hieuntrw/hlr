#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(2);
}
const supabase = createClient(url, key);
(async () => {
  try {
    const tables = [
      { name: 'member_milestone_rewards' },
      { name: 'member_podium_rewards' },
      { name: 'lucky_draw_winners' },
      { name: 'member_star_awards' },
    ];
    for (const t of tables) {
      const { data, error } = await supabase.from(t.name).select('id, member_id, status, reward_description, cash_amount').limit(5);
      if (error) {
        console.error('[ERROR]', t.name, error.message || error);
      } else {
        console.log('Table:', t.name, 'sample_count:', (data || []).length);
        console.log((data || []).slice(0,3));
      }
    }
  } catch (e) {
    console.error('Exception', e);
    process.exit(1);
  }
  process.exit(0);
})();
