#!/usr/bin/env bash
set -euo pipefail
# Backfill avatar_url from a CSV file with columns: id,avatar_url
# Usage: SUPABASE_DB_URL=postgres://user:pass@host:5432/db ./tools/backfill_avatars.sh avatars.csv

if [ "$#" -lt 1 ]; then
  echo "Usage: SUPABASE_DB_URL=postgres://user:pass@host:5432/db $0 <csv-file>"
  exit 1
fi

CSV_FILE="$1"
if [ ! -f "$CSV_FILE" ]; then
  echo "CSV file not found: $CSV_FILE"
  exit 2
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Please set SUPABASE_DB_URL env var (postgres connection string)"
  exit 3
fi

echo "Backfilling avatars from $CSV_FILE"

# Expect header row id,avatar_url
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'PSQL'
\copy (SELECT id, avatar_url FROM (VALUES ('dummy','dummy')) AS t(id, avatar_url) LIMIT 0) TO STDOUT
PSQL

# Use psql to read CSV and update
python3 - <<'PY'
import csv, os, sys, subprocess
db = os.environ.get('SUPABASE_DB_URL')
if not db:
    print('SUPABASE_DB_URL not set')
    sys.exit(1)
csvf = sys.argv[1]
with open(csvf) as fh:
    reader = csv.DictReader(fh)
    rows = list(reader)
for r in rows:
    uid = r.get('id')
    avatar = r.get('avatar_url')
    if not uid or not avatar:
        continue
    sql = f"UPDATE profiles SET avatar_url = %s WHERE id = %s"
    # Use psql with parameter substitution via env-safe approach
    cmd = [
        'psql', db, '-v', 'ON_ERROR_STOP=1', '-c', f"UPDATE profiles SET avatar_url = '{avatar.replace("'","''")}' WHERE id = '{uid}';"
    ]
    subprocess.run(cmd, check=True)
print('Done')
PY
