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

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
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
      console.error('❌ Error listing users:', listError);
      return;
    }

    const user = users.users.find(u => u.email === email);
    if (!user) {
      console.error(`❌ User not found: ${email}`);
      return;
    }

    console.log(`✓ Found user: ${user.email} (${user.id})`);
    console.log(`Current metadata:`, JSON.stringify(user.user_metadata, null, 2));

    // Update user metadata with role
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          role: role,
        },
      }
    );

    if (updateError) {
      console.error('❌ Error updating user:', updateError);
      return;
    }

    console.log(`\n✅ Successfully set role="${role}" for ${email}`);
    console.log(`Updated metadata:`, JSON.stringify(updatedUser.user.user_metadata, null, 2));

    // Also update profiles table for consistency (optional)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: role })
      .eq('id', user.id);

    if (profileError) {
      console.warn('⚠️  Warning: Could not update profiles table:', profileError.message);
    } else {
      console.log('✓ Also updated profiles table');
    }

    console.log('\n✅ Done! User can now access admin pages.');
  } catch (err) {
    console.error('❌ Unexpected error:', err);
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
