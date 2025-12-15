#!/usr/bin/env bash
# Reproduce the form-login -> 303 redirect -> cookie application flow locally.
# Usage:
#   chmod +x scripts/reproduce-login.sh
#   ./scripts/reproduce-login.sh
# You can override defaults by exporting EMAIL, PASSWORD, BASE, or REDIRECT.

set -euo pipefail

EMAIL="${EMAIL:-tranchihieu.it@gmail.com}"
PASSWORD="${PASSWORD:-1234567}"
BASE="${BASE:-http://localhost:3000}"
REDIRECT="${REDIRECT:-/dashboard}"
COOKIE_JAR="/tmp/hlr_cookies.jar"
LOGIN_RESPONSE="/tmp/hlr_login_response.txt"
REDIRECT_RESPONSE="/tmp/hlr_redirect_response.txt"

rm -f "$COOKIE_JAR" "$LOGIN_RESPONSE" "$REDIRECT_RESPONSE"

echo "Checking $BASE..."
if ! curl -sS -I "$BASE" >/dev/null; then
  echo "ERROR: No response from $BASE. Start dev server (e.g. npm run dev) and try again." >&2
  exit 2
fi

echo "Posting login to $BASE/api/auth/email-login?redirect=${REDIRECT} ..."

curl -i -c "$COOKIE_JAR" -X POST "$BASE/api/auth/email-login?redirect=${REDIRECT}" \
  -F "email=${EMAIL}" -F "password=${PASSWORD}" -v -o "$LOGIN_RESPONSE" || true

echo "--- Login response (headers+body saved to $LOGIN_RESPONSE) ---"
cat "$LOGIN_RESPONSE" || true

if [ -f "$COOKIE_JAR" ]; then
  echo "--- Saved cookies ($COOKIE_JAR) ---"
  cat "$COOKIE_JAR" || true
else
  echo "No cookie jar found ($COOKIE_JAR)"
fi

echo "Following redirect to ${REDIRECT} using saved cookies..."

curl -i -b "$COOKIE_JAR" "$BASE${REDIRECT}" -v -o "$REDIRECT_RESPONSE" || true

echo "--- Redirect GET response (saved to $REDIRECT_RESPONSE) ---"
cat "$REDIRECT_RESPONSE" || true

echo "Done. If the login response contains Set-Cookie for sb-access-token and sb-refresh-token and the GET to ${REDIRECT} includes cookies, server-side session reconstruction should work." 
