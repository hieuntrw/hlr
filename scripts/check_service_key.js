const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const lines = txt.split(/\r?\n/);
  const env = {};
  for (const l of lines) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      let val = m[2];
      // strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[m[1]] = val;
    }
  }
  return env;
}

(async function main(){
  try {
    const envPath = path.resolve(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) {
      console.error('.env.local not found at', envPath);
      process.exit(2);
    }
    const env = loadEnv(envPath);
    const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
    console.log('Using NEXT_PUBLIC_SUPABASE_URL =', url);
    console.log('Using SUPABASE_SERVICE_ROLE_KEY present:', !!key, 'prefix:', key ? key.slice(0,6)+'...' : null);
    if (!url || !key) {
      console.error('Missing url or service role key in .env.local');
      process.exit(2);
    }

    const client = createClient(url, key, { auth: { persistSession: false } });
    // test: count rows
    console.log('Running select count on member_star_awards...');
    const res = await client.from('member_star_awards').select('id', { count: 'exact' });
    console.log('Result:', JSON.stringify({ count: res.count ?? null, error: res.error }, null, 2));

    // also try selecting pg_tables entry
    try {
      const t = await client.from('pg_tables').select('schemaname, tablename').eq('tablename', 'member_star_awards');
      console.log('pg_tables query:', JSON.stringify({ data: t.data ?? null, error: t.error }, null, 2));
    } catch (e) {
      console.warn('pg_tables query failed:', String(e));
    }

    process.exit(0);
  } catch (err) {
    console.error('check script failed', err);
    process.exit(1);
  }
})();
