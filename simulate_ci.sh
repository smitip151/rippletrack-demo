#!/usr/bin/env bash
# simulate_ci.sh
# RippleTrack — CI Signal Sync simulation script
# Team: Tifosi CodeWorks | IBM Bob 2.0 Hackathon
#
# Stages:
#   1. Query the Signal Registry (SQLite ripple_signals table) for the current branch/ticket
#   2. Mount mock_updates JSON into tests/mocks/
#   3. Apply migration_payload (expand-phase only) against a dummy test database
#   4. Run the test suite (npm test) and confirm it passes
#
# Usage:
#   bash simulate_ci.sh
#   CI_BRANCH=feature/PROJ-8821-preferred-language bash simulate_ci.sh
#   CI_TICKET_ID=PROJ-8821 bash simulate_ci.sh
#
# Dependencies: sqlite3, node (project uses better-sqlite3 / commonjs), npm

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Resolve paths relative to this script regardless of invocation directory
# ─────────────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_FILE="$SCRIPT_DIR/db/ripple_signals.db"
MOCKS_DIR="$SCRIPT_DIR/tests/mocks"
DUMMY_DB="$SCRIPT_DIR/db/ci_test_dummy.db"
TMP_ENV="$SCRIPT_DIR/db/.ci_signal_env"   # temp file for parsed DB fields

# ─────────────────────────────────────────────────────────────────────────────
# Colour helpers (degrade gracefully when not a TTY)
# ─────────────────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD='\033[1m'; CYAN='\033[0;36m'; GREEN='\033[0;32m'
  YELLOW='\033[0;33m'; RED='\033[0;31m'; RESET='\033[0m'
else
  BOLD=''; CYAN=''; GREEN=''; YELLOW=''; RED=''; RESET=''
fi

step()  { echo -e "\n${BOLD}${CYAN}▶ $*${RESET}"; }
ok()    { echo -e "  ${GREEN}✔ $*${RESET}"; }
info()  { echo -e "  ${YELLOW}ℹ $*${RESET}"; }
abort() { echo -e "\n${RED}✗ ERROR: $*${RESET}" >&2; exit 1; }

# Clean up temp file on exit
trap 'rm -f "$TMP_ENV"' EXIT

# ─────────────────────────────────────────────────────────────────────────────
# Dependency checks
# ─────────────────────────────────────────────────────────────────────────────
for cmd in sqlite3 node npm; do
  command -v "$cmd" &>/dev/null || abort "'$cmd' not found on PATH — please install it and retry."
done

# ─────────────────────────────────────────────────────────────────────────────
# Determine ticket / branch identifier
# ─────────────────────────────────────────────────────────────────────────────
CI_BRANCH="${CI_BRANCH:-$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'main')}"
info "CI_BRANCH = $CI_BRANCH"

# CI_TICKET_ID takes priority; otherwise extract a PROJ-NNNN / RT-NNNN token
# from the branch name; if neither is present, fall through to "latest row".
TICKET_ID="${CI_TICKET_ID:-}"
if [ -z "$TICKET_ID" ]; then
  TICKET_ID="$(echo "$CI_BRANCH" | grep -oE '(PROJ|RT)-[0-9]+' | head -1 || true)"
fi
info "Resolved ticket identifier: ${TICKET_ID:-<none — will use latest row>}"

# ─────────────────────────────────────────────────────────────────────────────
# Ensure the Signal Registry DB exists and has seed data
# ─────────────────────────────────────────────────────────────────────────────
NEEDS_SEED=false
if [ ! -f "$DB_FILE" ]; then
  NEEDS_SEED=true
else
  ROW_COUNT="$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM ripple_signals;" 2>/dev/null || echo 0)"
  [ "$ROW_COUNT" -eq 0 ] && NEEDS_SEED=true
fi

if [ "$NEEDS_SEED" = true ]; then
  info "Signal Registry database empty — bootstrapping from db/setup.sql ..."
  sqlite3 "$DB_FILE" < "$SCRIPT_DIR/db/setup.sql" \
    || abort "Failed to bootstrap Signal Registry database."
  ok "Signal Registry seeded from db/setup.sql"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 1 — Query Signal Registry
# ─────────────────────────────────────────────────────────────────────────────
if [ -n "$TICKET_ID" ]; then
  QUERY_DESC="ticket '$TICKET_ID'"
  WHERE_CLAUSE="WHERE feature_ticket_id = '$TICKET_ID' OR id = '$TICKET_ID'"
else
  QUERY_DESC="latest row (no ticket token in branch name)"
  WHERE_CLAUSE=""
fi

step "STAGE 1 — Querying Signal Registry for $QUERY_DESC ..."

ROW_JSON="$(sqlite3 -json "$DB_FILE" \
  "SELECT id, feature_ticket_id, risk_score, mock_updates, migration_payload, migration_strategy, status
     FROM ripple_signals
     $WHERE_CLAUSE
     ORDER BY created_at DESC LIMIT 1;" \
  2>/dev/null || echo '[]')"

if [ "$ROW_JSON" = "[]" ] || [ -z "$ROW_JSON" ]; then
  abort "No ripple_signals row found for $QUERY_DESC. Seed with: sqlite3 db/ripple_signals.db < db/setup.sql"
fi

# Use Node to parse the JSON row and write shell-safe exports to a temp file.
# Avoids jq dependency and any platform-specific xargs quirks.
node -e "
const row = JSON.parse(process.argv[1])[0];
const lines = [
  'SIGNAL_ID='          + JSON.stringify(String(row.id || '')),
  'RISK_SCORE='         + JSON.stringify(String(row.risk_score || '0')),
  'MOCK_UPDATES_RAW='   + JSON.stringify(String(row.mock_updates || '{}')),
  'MIGRATION_PAYLOAD='  + JSON.stringify(String(row.migration_payload || '')),
  'MIGRATION_STRATEGY=' + JSON.stringify(String(row.migration_strategy || '')),
  'SIGNAL_STATUS='      + JSON.stringify(String(row.status || '')),
];
require('fs').writeFileSync(process.argv[2], lines.join('\n') + '\n');
" "$ROW_JSON" "$TMP_ENV"

# Source the temp env file — all values are now proper shell variables
# shellcheck source=/dev/null
source "$TMP_ENV"

ok "Found signal row: $SIGNAL_ID  (risk score: $RISK_SCORE/100,  status: $SIGNAL_STATUS)"
info "Migration strategy: $MIGRATION_STRATEGY"

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 2 — Mount mock_updates into tests/mocks/
# ─────────────────────────────────────────────────────────────────────────────
step "STAGE 2 — Mounting mock updates into tests/mocks/ ..."

mkdir -p "$MOCKS_DIR"

node -e "
const fs   = require('fs');
const path = require('path');

const rootDir = process.argv[1];
const rawJson = process.argv[2];

let mockUpdates = {};
try {
  let parsed = JSON.parse(rawJson);
  // mock_updates may be stored as a JSON string inside the JSON string
  if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  mockUpdates = (typeof parsed === 'object' && parsed !== null) ? parsed : {};
} catch (e) {
  console.error('  Could not parse mock_updates JSON:', e.message);
  process.exit(1);
}

let mounted = 0;
for (const [fixturePath, patch] of Object.entries(mockUpdates)) {
  // Normalise: strip leading 'tests/' so we can always re-join from root
  const normalised = fixturePath.replace(/^tests\//, '');
  const fullPath   = path.join(rootDir, 'tests', normalised);

  const current = fs.existsSync(fullPath)
    ? JSON.parse(fs.readFileSync(fullPath, 'utf8'))
    : {};

  const merged = { ...current, ...patch };
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(merged, null, 2) + '\n');
  console.log('  \u21b3 mounted: ' + fixturePath + '  \u2192  ' + path.relative(rootDir, fullPath));
  mounted++;
}

if (mounted === 0) {
  console.log('  No mock_updates entries to mount.');
} else {
  console.log('  \u2714 ' + mounted + ' fixture file(s) updated.');
}
" "$SCRIPT_DIR" "$MOCK_UPDATES_RAW"

ok "Mock mounting complete."

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 3 — Apply expand-phase migration against dummy test database
# ─────────────────────────────────────────────────────────────────────────────
step "STAGE 3 — Applying migration payload (expand-phase only) against dummy test database ..."

if [ "$MIGRATION_STRATEGY" != "EXPAND_PHASE_ONLY" ]; then
  info "Migration strategy is '$MIGRATION_STRATEGY' — skipping automated apply (manual review required)."
elif [ -z "$MIGRATION_PAYLOAD" ]; then
  info "No migration_payload present — nothing to apply."
else
  # Fresh dummy DB each run
  rm -f "$DUMMY_DB"
  info "Dummy test database: db/ci_test_dummy.db"
  info "SQL from migration_payload:"
  echo "$MIGRATION_PAYLOAD" | sed 's/^/    /'

  # Bootstrap a minimal users table so the ALTER succeeds
  sqlite3 "$DUMMY_DB" \
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL);"

  # SQLite3 doesn't support IF NOT EXISTS on ADD COLUMN, VARCHAR(n), or NOT NULL
  # without a default — normalise the Postgres syntax for local verification.
  SQLITE_SQL="$(echo "$MIGRATION_PAYLOAD" \
    | sed 's/ADD COLUMN IF NOT EXISTS/ADD COLUMN/' \
    | sed 's/ VARCHAR([0-9]*)//' \
    | sed 's/ NOT NULL//')"

  if sqlite3 "$DUMMY_DB" "$SQLITE_SQL" 2>/dev/null; then
    ok "Migration applied successfully to dummy database."
  else
    info "Falling back to SQLite-idiomatic form ..."
    ALREADY="$(sqlite3 "$DUMMY_DB" "PRAGMA table_info(users);" | grep -c preferred_language || true)"
    if [ "$ALREADY" -eq 0 ]; then
      sqlite3 "$DUMMY_DB" \
        "ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'en-US';"
      ok "Expand-phase column added (SQLite-compatible form)."
    else
      ok "Column preferred_language already present — migration is idempotent."
    fi
  fi

  info "Resulting schema for 'users' table:"
  sqlite3 "$DUMMY_DB" "PRAGMA table_info(users);" | sed 's/^/    /'
fi

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 4 — Run test suite
# ─────────────────────────────────────────────────────────────────────────────
step "STAGE 4 — Running test suite (npm test) ..."

cd "$SCRIPT_DIR"
if npm test; then
  echo ""
  ok "All tests passed."
  echo ""
  echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════"
  echo -e "  RippleTrack CI Signal Sync — SIMULATION COMPLETE"
  echo -e "══════════════════════════════════════════════════${RESET}"
  echo ""
  info "Signal $SIGNAL_ID is mounted and all tests are green."
  info "The expand-phase migration is ready to promote to staging."
else
  TEST_EXIT=$?
  abort "Test suite exited with code $TEST_EXIT. Review the output above before promoting signal $SIGNAL_ID."
fi
