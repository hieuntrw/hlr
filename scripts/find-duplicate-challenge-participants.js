'use strict';

// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/find-duplicate-challenge-participants.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_URL_LOCAL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

(async function main() {
  try {
    console.log('Fetching challenge_participants rows (this may take a while)...');
    const { data, error } = await supabase
      .from('challenge_participants')
      .select('id,challenge_id,user_id')
      .limit(10000);

    if (error) throw error;
    if (!data) {
      console.log('No rows returned.');
      return;
    }

    const map = new Map();
    for (const row of data) {
      const key = `${row.challenge_id}::${row.user_id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row.id);
    }

    const duplicates = [];
    for (const [key, ids] of map.entries()) {
      if (ids.length > 1) duplicates.push({ key, ids });
    }

    if (duplicates.length === 0) {
      console.log('No duplicate (challenge_id, user_id) entries found.');
      return;
    }

    console.log(`Found ${duplicates.length} duplicated (challenge_id,user_id) groups:`);
    for (const d of duplicates) {
      const [challenge_id, user_id] = d.key.split('::');
      console.log('\n---');
      console.log('challenge_id:', challenge_id);
      console.log('user_id:', user_id);
      console.log('row ids:', d.ids.join(', '));
      console.log('SQL to inspect:');
      console.log(`SELECT * FROM challenge_participants WHERE id IN (${d.ids.join(',')});`);
      console.log('SQL to delete extras (keep first id):');
      const keep = d.ids[0];
      const deleteIds = d.ids.slice(1);
      console.log(`DELETE FROM challenge_participants WHERE id IN (${deleteIds.join(',')}); -- keeps id ${keep}`);
    }

    console.log('\nReview the SQL above and run it against your database (psql / Supabase SQL editor) to remove duplicates.');
  } catch (err) {
    console.error('Error while scanning duplicates:', err.message || err);
    process.exit(2);
  }
})();
