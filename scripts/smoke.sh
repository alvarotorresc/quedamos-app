#!/usr/bin/env bash
# Smoke test of production after a deploy. Read-only: four GET requests.
#
#   WEB_URL   web app            (default https://quedamos.alvarotc.com)
#   API_URL   API base URL       (default https://quedamos.api.alvarotc.com)
#
# Run from deploy.yml after the API container is replaced, from smoke-web.yml after a
# Vercel production deployment, or by hand: `bash scripts/smoke.sh`.
set -euo pipefail

WEB_URL="${WEB_URL:-https://quedamos.alvarotc.com}"
API_URL="${API_URL:-https://quedamos.api.alvarotc.com}"
# The fresh API container needs a moment: 20 x 6 s, the same two-minute budget the
# old "Verify /health" step had.
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-20}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-6}"
RETRIES="${RETRIES:-3}"
RETRY_INTERVAL="${RETRY_INTERVAL:-5}"

CURL=(curl -sS --max-time 10)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

# retry <label> <command...>: run the command up to RETRIES times.
retry() {
  local label=$1
  shift
  local attempt
  for attempt in $(seq 1 "$RETRIES"); do
    if "$@"; then
      return 0
    fi
    if [[ $attempt -lt $RETRIES ]]; then
      echo "  $label: attempt $attempt failed, retrying in ${RETRY_INTERVAL}s"
      sleep "$RETRY_INTERVAL"
    fi
  done
  return 1
}

# status <url> [curl args...]: HTTP status code, 000 when the connection fails.
status() {
  local url=$1
  shift
  "${CURL[@]}" -o /dev/null -w '%{http_code}' "$@" "$url" || true
}

echo "1. $API_URL/health -> status ok, Firebase initialised"
healthy=0
for attempt in $(seq 1 "$HEALTH_ATTEMPTS"); do
  body=$("${CURL[@]}" -f "$API_URL/health" || true)
  if [[ $body == *'"status":"ok"'* && $body == *'"firebaseInitialized":true'* ]]; then
    echo "  ok: $body"
    healthy=1
    break
  fi
  echo "  attempt $attempt/$HEALTH_ATTEMPTS: ${body:-no response}"
  if [[ $attempt -lt $HEALTH_ATTEMPTS ]]; then
    sleep "$HEALTH_INTERVAL"
  fi
done
[[ $healthy == 1 ]] || fail "the API did not report a healthy, Firebase-initialised state"

check_home() {
  local body
  body=$("${CURL[@]}" -f "$WEB_URL/") || return 1
  [[ $body == *'<div id="root"'* ]]
}
echo "2. $WEB_URL/ -> 200 with the app mount point"
retry home check_home || fail "$WEB_URL/ is not serving the app"
echo "  ok"

check_join() {
  [[ $(status "$API_URL/join/12345678") == 404 ]]
}
echo "3. $API_URL/join/12345678 -> 404"
retry join check_join || fail "expected 404 for an unknown invite code"
echo "  ok"

check_groups() {
  [[ $(status "$API_URL/groups") == 401 ]]
}
echo "4. $API_URL/groups without a token -> 401"
retry groups check_groups || fail "expected 401 for /groups without a token"
echo "  ok"

echo "smoke: all checks passed"
