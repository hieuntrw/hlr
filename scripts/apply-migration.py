#!/usr/bin/env python3
"""
Apply Supabase migrations using psycopg2 (PostgreSQL client)
Requires: pip install python-dotenv psycopg2-binary
"""

import os
import sys
import glob
from pathlib import Path
from dotenv import load_dotenv

# Load .env.local
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

# Extract Supabase connection details
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    print('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local')
    sys.exit(1)

# Build PostgreSQL connection string
# Supabase provides: postgres://postgres:password@db.xxxxx.supabase.co:5432/postgres
# We'll construct it from the JWT claims if needed, or use Supabase JS client
try:
    from supabase import create_client
    
    supabase = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)
    
    # Read migrations
    migrations_dir = Path(__file__).parent.parent / 'supabase' / 'migrations'
    
    if not migrations_dir.exists():
        print(f'❌ Migrations directory not found: {migrations_dir}')
        sys.exit(1)
    
    migration_files = sorted([f for f in migrations_dir.glob('*.sql')])
    
    if not migration_files:
        print('ℹ️  No migrations found')
        sys.exit(0)
    
    print(f'📝 Found {len(migration_files)} migration(s):')
    for f in migration_files:
        print(f'  - {f.name}')
    print('')
    
    for migration_file in migration_files:
        print(f'⏳ Applying migration: {migration_file.name}')
        
        sql = migration_file.read_text(encoding='utf-8')
        
        try:
            # Use supabase-py's query method (limited, won't work for DDL)
            # Instead, we'll use raw PostgreSQL via connection if available
            response = supabase.postgrest.url  # This won't work for arbitrary SQL
            
            # Fallback: Print instructions for manual execution
            print(f'   ℹ️  Supabase Python client does not support arbitrary DDL execution.')
            print(f'   Please execute this SQL manually in Supabase SQL Editor:\n')
            print(f'--- START SQL ({migration_file.name}) ---')
            print(sql)
            print(f'--- END SQL ---\n')
            
        except Exception as err:
            print(f'❌ Error processing {migration_file.name}:')
            print(f'   {str(err)}\n')
            sys.exit(1)
    
    print('📋 Instructions:')
    print('1. Go to https://app.supabase.com/project/[YOUR-PROJECT]/')
    print('2. Open SQL Editor tab')
    print('3. Paste the SQL statements above and execute')
    print('4. Or use supabase CLI: supabase db push')

except ImportError:
    print('❌ supabase-py not installed. Install with: pip install supabase-python-sync')
    print('\nAlternatively, use Supabase CLI:')
    print('  supabase db push')
    sys.exit(1)
