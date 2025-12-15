#!/usr/bin/env node
/**
 * Mass-migration script: move role from user_metadata -> app_metadata for all users
 * Options:
 *   --dry-run        : show what would change, don't make updates
 *   --invalidate     : invalidate refresh tokens for migrated users (if supported)
 *   --batch=<n>      : number of users per page (default 100)
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-all-roles-to-app-metadata.js --dry-run
 */

const { createClient } = require('@supabase/supabase-js');
const argv = require('minimist')(process.argv.slice(2));

const DRY_RUN = !!argv['dry-run'];
const INVALIDATE = !!argv['invalidate'];
const PER_PAGE = parseInt(argv['batch'] || argv['per_page'] || '100', 10);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment');
  process.exit(1);
}

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listUsersPage(page = 1, perPage = PER_PAGE) {
  // supabase-js v2 admin.listUsers supports pagination
  const res = await supabaseAdmin.auth.admin.listUsers({ per_page: perPage, page });
  if (res.error) throw res.error;
  return res;
}

async function migrateAll() {
  console.log('Starting migration', { DRY_RUN, INVALIDATE, PER_PAGE });
  let page = 1;
  let totalMigrated = 0;
  while (true) {
    console.log(`Fetching users page ${page}`);
    const { data } = await listUsersPage(page, PER_PAGE);
    const users = data || [];
    if (!users.length) break;

    for (const u of users) {
      const uid = u.id;
      const userMeta = u.user_metadata || {};
      const appMeta = u.app_metadata || {};

      // Prefer role from raw_app_meta_data (if present), fall back to user_metadata.role
      let roleFromRawApp = null;
      try {
        const raw = u.raw_app_meta_data;
        if (raw) {
          if (typeof raw === 'object') {
            roleFromRawApp = raw.role;
          } else if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              roleFromRawApp = parsed && parsed.role;
            } catch (e) {
              // fallback to regex extraction from string
              const m = raw.match(/"role"\s*:\s*"([^\"]+)"/);
              if (m) roleFromRawApp = m[1];
            }
          }
        }
      } catch (e) {
        console.warn('Error parsing raw_app_meta_data for', uid, e.message || e);
      }

      const roleInUserMeta = userMeta.role;
      const role = roleFromRawApp || roleInUserMeta;
      if (!role) continue; // nothing to do

      console.log(`User ${u.email} (${uid}) role source: ${roleFromRawApp ? 'raw_app_meta_data' : 'user_metadata'} role=${role}`);
      if (DRY_RUN) {
        console.log('DRY RUN: would set app_metadata.role=', roleInUserMeta, 'and remove user_metadata.role');
        continue;
      }

      const newUserMeta = { ...userMeta };
      delete newUserMeta.role;
      const newAppMeta = { ...appMeta, role };

      // Preserve original raw_app_meta_data (provenance) as legacy_raw in app_metadata
      // if it's not already present. Do not overwrite existing legacy_raw.
      try {
        if (!newAppMeta.legacy_raw) {
          if (u.raw_app_meta_data) {
            newAppMeta.legacy_raw = u.raw_app_meta_data;
          } else if (u.raw_user_meta_data) {
            newAppMeta.legacy_raw = u.raw_user_meta_data;
          }
        }
      } catch (e) {
        console.warn('Could not attach legacy_raw for', uid, e.message || e);
      }

      const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(uid, {
        user_metadata: newUserMeta,
        app_metadata: newAppMeta,
      });

      if (updateErr) {
        console.error('Failed to update user', uid, updateErr);
        continue;
      }

      console.log('Updated auth user metadata for', uid);

      // Optionally invalidate refresh tokens
      if (INVALIDATE) {
        try {
          if (supabaseAdmin.auth.admin.invalidateUserRefreshTokens) {
            const invalidRes = await supabaseAdmin.auth.admin.invalidateUserRefreshTokens(uid);
            if (invalidRes.error) {
              console.warn('Failed to invalidate refresh tokens for', uid, invalidRes.error.message || invalidRes.error);
            } else {
              console.log('Invalidated refresh tokens for', uid);
            }
          } else {
            console.warn('Invalidate method not available in this SDK version; skip invalidation');
          }
        } catch (e) {
          console.warn('Exception invalidating refresh tokens for', uid, e.message || e);
        }
      }

      totalMigrated++;
    }

    if (users.length < PER_PAGE) break;
    page++;
  }

  console.log('Migration complete. Total migrated:', totalMigrated);
}

migrateAll().catch((e) => {
  console.error('Migration failed', e);
  process.exit(1);
});
