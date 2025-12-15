/**
 * Script để set role admin cho user trong Supabase Auth metadata
 * 
 * Sử dụng:
 * node scripts/set-user-admin-role.js <email>
 * 
 * Ví dụ:
 * node scripts/set-user-admin-role.js admin@example.com
 */

const { createClient } = require('@supabase/supabase-js');

const DEBUG = process.env.DEBUG_SERVER_LOGS === '1';
const log = {
  debug: (...args) => { if (DEBUG) console.debug(...args); },
  info: (...args) => { if (DEBUG) console.info(...args); },
  warn: (...args) => { if (DEBUG) console.warn(...args); },
  error: (...args) => { console.error(...args); },
};

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  log.error('❌ Missing environment variables!');
  log.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setUserRole(email, role = 'admin') {
  try {
    console.log(`\n🔍 Searching for user: ${email}...`);

    // Get user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      log.error('❌ Error listing users:', listError);
      return;
    }

    const user = users.users.find(u => u.email === email);
    if (!user) {
      console.error(`❌ User not found: ${email}`);
      return;
    }

    console.log(`✓ Found user: ${user.email} (${user.id})`);
    console.log(`Current app_metadata:`, JSON.stringify(user.app_metadata, null, 2));

    // Update user: set app_metadata.role and remove role from user_metadata
    const newUserMetadata = { ...(user.user_metadata || {}) };
    delete newUserMetadata.role;
    const newAppMetadata = { ...(user.app_metadata || {}), role };

    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: newUserMetadata,
        app_metadata: newAppMetadata,
      }
    );

    if (updateError) {
      log.error('❌ Error updating user:', updateError);
      return;
    }

    console.log(`\n✅ Successfully set role="${role}" for ${email}`);
    console.log(`Updated app_metadata:`, JSON.stringify(updatedUser.user.app_metadata, null, 2));

    console.log('\n✅ Done! User app_metadata updated; role removed from user_metadata.');
  } catch (err) {
    log.error('❌ Unexpected error:', err);
  }
}

// Get email from command line
const email = process.argv[2];
const role = process.argv[3] || 'admin';

if (!email) {
  console.error('Usage: node scripts/set-user-admin-role.js <email> [role]');
  console.error('Example: node scripts/set-user-admin-role.js admin@example.com admin');
  console.error('\nAvailable roles: admin, mod_finance, mod_challenge, mod_member, member');
  process.exit(1);
}

setUserRole(email, role);
