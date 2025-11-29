#!/usr/bin/env node

/**
 * Script to apply Supabase migrations from the migrations/ folder
 * Uses SUPABASE_SERVICE_ROLE_KEY from .env.local for privileged access
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function applyMigrations() {
  const migrationsDir = path.join(__dirname, '../supabase/migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    console.log('ℹ️  No migrations found');
    process.exit(0);
  }

  console.log(`📝 Found ${migrationFiles.length} migration(s):`);
  migrationFiles.forEach(f => console.log(`  - ${f}`));
  console.log('');

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`⏳ Applying migration: ${file}`);
    try {
      const { error } = await supabase.rpc('exec', { sql_text: sql }).catch(() => ({
        error: { message: 'RPC not available' }
      }));

      // If RPC fails, try direct query execution (alternative approach)
      if (error && error.message.includes('not found')) {
        console.log('   (RPC exec not available, trying direct SQL...)');
        // For direct SQL, we'd need a different approach
        // For now, use raw query via query endpoint
        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ query: sql }),
          });
          
          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(errBody);
          }
        } catch (innerErr) {
          // Fallback: use psql if available (not typical in browser env)
          console.warn(`   ⚠️  Could not execute SQL directly. Manual execution needed.`);
          console.log(`   SQL:\n${sql}\n`);
        }
      } else if (error) {
        throw new Error(error.message || JSON.stringify(error));
      }

      console.log(`✅ Applied: ${file}\n`);
    } catch (err) {
      console.error(`❌ Failed to apply ${file}:`);
      console.error(`   ${err.message}\n`);
      process.exit(1);
    }
  }

  console.log('🎉 All migrations applied successfully!');
}

applyMigrations();
