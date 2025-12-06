#!/usr/bin/env bash
set -euo pipefail
# Usage: SUPABASE_DB_URL=postgres://user:pass@host:5432/db ./tools/apply-migration.sh supabase/migrations/20251206_add_avatar_url_to_profiles.sql

if [ "$#" -lt 1 ]; then
  echo "Usage: SUPABASE_DB_URL=postgres://user:pass@host:5432/db $0 <sql-file>"
  exit 1
fi

SQL_FILE="$1"

if [ ! -f "$SQL_FILE" ]; then
  echo "SQL file not found: $SQL_FILE"
  exit 2
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Please set SUPABASE_DB_URL env var (postgres connection string)"
  exit 3
fi

echo "Applying migration: $SQL_FILE -> $SUPABASE_DB_URL"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
echo "Migration applied successfully."
