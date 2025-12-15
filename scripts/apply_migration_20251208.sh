#!/usr/bin/env bash
# Apply migration 20251208_add_activities_challenge_participant_id.sql
# Usage:
#   DATABASE_URL="postgres://..." ./scripts/apply_migration_20251208.sh
# or
#   supabase db query < supabase/migrations/20251208_add_activities_challenge_participant_id.sql

set -euo pipefail

MIGRATION_FILE="supabase/migrations/20251208_add_activities_challenge_participant_id.sql"
if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "Migration file not found: $MIGRATION_FILE"
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Applying migration using psql and DATABASE_URL..."
  psql "$DATABASE_URL" -f "$MIGRATION_FILE"
  echo "Migration applied via psql."
  exit 0
fi

if command -v supabase >/dev/null 2>&1; then
  echo "No DATABASE_URL found, attempting to use supabase CLI (must be logged in and project set)."
  supabase db query < "$MIGRATION_FILE"
  echo "Migration applied via supabase CLI."
  exit 0
fi

echo "No DATABASE_URL env var and supabase CLI not found."
echo "Set DATABASE_URL or install supabase CLI and login, then run one of:" 
echo "  DATABASE_URL=\"postgres://...\" ./scripts/apply_migration_20251208.sh"
echo "  supabase db query < $MIGRATION_FILE"
exit 2
