#!/usr/bin/env bash
set -euo pipefail

# Simple helper to deploy the strava-sync supabase function
# Usage: ./scripts/deploy_supabase_function.sh <project-ref>

if [ -z "${1-}" ]; then
  echo "Usage: $0 <supabase-project-ref>" >&2
  exit 1
fi

PROJECT_REF=$1

echo "Deploying supabase function 'strava-sync' to project ${PROJECT_REF}..."
supabase functions deploy strava-sync --project-ref "${PROJECT_REF}"

echo "Done. Remember to set function secrets (SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, NEXT_PUBLIC_BASE_URL)"
