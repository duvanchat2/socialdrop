#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# SocialDrop API Integration Tests
# Usage: ./scripts/test-api.sh [BASE_URL]
# Default BASE_URL: http://localhost:3333
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL="${1:-http://localhost:3333}"
USER_ID="demo-user"
PASS=0
FAIL=0
CREATED_POST_ID=""

# ── colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }
section() { echo -e "\n${YELLOW}── $1 ──${NC}"; }

# ── assertion helpers ─────────────────────────────────────────────────────────

assert_status() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    pass "$label (HTTP $actual)"
  else
    fail "$label — expected HTTP $expected, got $actual"
  fi
}

assert_contains() {
  local label="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    pass "$label"
  else
    fail "$label — expected response to contain '$needle', got: $haystack"
  fi
}

# ── wait for API ──────────────────────────────────────────────────────────────

section "Waiting for API at $BASE_URL"
for i in $(seq 1 10); do
  if curl -sf "$BASE_URL/api/stats/overview?userId=$USER_ID" > /dev/null 2>&1; then
    pass "API is reachable"
    break
  fi
  echo "  Attempt $i/10 — waiting 2s..."
  sleep 2
  if [ "$i" -eq 10 ]; then
    fail "API did not become available after 20s"
    exit 1
  fi
done

# ── Stats ─────────────────────────────────────────────────────────────────────

section "Stats"

STATS_BODY=$(curl -sf "$BASE_URL/api/stats/overview?userId=$USER_ID" 2>&1 || echo "CURL_FAILED")
STATS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/stats/overview?userId=$USER_ID")

assert_status "GET /api/stats/overview" 200 "$STATS_STATUS"
assert_contains "Stats response has 'total'" '"total"' "$STATS_BODY"
assert_contains "Stats response has 'published'" '"published"' "$STATS_BODY"
assert_contains "Stats response has 'pending'" '"pending"' "$STATS_BODY"
assert_contains "Stats response has 'failed'" '"failed"' "$STATS_BODY"

# ── Posts – list ──────────────────────────────────────────────────────────────

section "Posts – list"

POSTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/posts?userId=$USER_ID")
assert_status "GET /api/posts" 200 "$POSTS_STATUS"

POSTS_BODY=$(curl -sf "$BASE_URL/api/posts?userId=$USER_ID")
assert_contains "Posts response is a JSON array" '\[' "$POSTS_BODY"

# ── Posts – create ────────────────────────────────────────────────────────────

section "Posts – create"

FUTURE_DATE=$(date -u -d '+1 hour' '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || \
              date -u -v+1H '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || \
              echo "$(date -u '+%Y-%m-%dT')12:00:00Z")

CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/posts?userId=$USER_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"Test post from test-api.sh at $(date -u '+%Y-%m-%dT%H:%M:%SZ')\",
    \"scheduledAt\": \"$FUTURE_DATE\",
    \"platforms\": [\"TWITTER\"]
  }")
CREATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/posts?userId=$USER_ID" \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"Test post 2\", \"scheduledAt\": \"$FUTURE_DATE\", \"platforms\": [\"TWITTER\"]}")

assert_status "POST /api/posts" 201 "$CREATE_STATUS"
assert_contains "Create response has 'id'" '"id"' "$CREATE_RESPONSE"

CREATED_POST_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# ── Posts – get one ───────────────────────────────────────────────────────────

section "Posts – get one"

if [ -n "$CREATED_POST_ID" ]; then
  GET_ONE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/posts/$CREATED_POST_ID")
  assert_status "GET /api/posts/:id" 200 "$GET_ONE_STATUS"
else
  fail "GET /api/posts/:id — skipped (no post was created)"
fi

# ── Posts – update ────────────────────────────────────────────────────────────

section "Posts – update"

if [ -n "$CREATED_POST_ID" ]; then
  PATCH_BODY=$(curl -s -X PATCH "$BASE_URL/api/posts/$CREATED_POST_ID?userId=$USER_ID" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"Updated content from test-api.sh\"}")
  PATCH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PATCH "$BASE_URL/api/posts/$CREATED_POST_ID?userId=$USER_ID" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"Updated 2\"}")
  assert_status "PATCH /api/posts/:id" 200 "$PATCH_STATUS"
  assert_contains "Updated content in response" '"content"' "$PATCH_BODY"
else
  fail "PATCH /api/posts/:id — skipped (no post was created)"
fi

# ── Posts – validation ────────────────────────────────────────────────────────

section "Posts – validation"

BAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/posts?userId=$USER_ID" \
  -H "Content-Type: application/json" \
  -d '{}')
assert_status "POST /api/posts with empty body returns 4xx" 400 "$BAD_STATUS"

NO_USER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/posts")
assert_status "GET /api/posts without userId returns 4xx" 400 "$NO_USER_STATUS"

# ── Posts – delete ────────────────────────────────────────────────────────────

section "Posts – cleanup (delete)"

if [ -n "$CREATED_POST_ID" ]; then
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE "$BASE_URL/api/posts/$CREATED_POST_ID")
  assert_status "DELETE /api/posts/:id" 200 "$DELETE_STATUS"
else
  fail "DELETE /api/posts/:id — skipped (no post was created)"
fi

# ── Integrations ──────────────────────────────────────────────────────────────

section "Integrations"

INT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/integrations?userId=$USER_ID")
assert_status "GET /api/integrations" 200 "$INT_STATUS"

# ── Calendar ──────────────────────────────────────────────────────────────────

section "Calendar"

NOW=$(date -u '+%Y-%m-%d')
NEXT_MONTH=$(date -u -d '+30 days' '+%Y-%m-%d' 2>/dev/null || \
             date -u -v+30d '+%Y-%m-%d' 2>/dev/null || \
             echo "$(date -u '+%Y-%m-')30")

CAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/posts/calendar?userId=$USER_ID&from=${NOW}T00:00:00Z&to=${NEXT_MONTH}T23:59:59Z")
assert_status "GET /api/posts/calendar" 200 "$CAL_STATUS"

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "────────────────────────────────────────"
echo -e "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "────────────────────────────────────────"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
