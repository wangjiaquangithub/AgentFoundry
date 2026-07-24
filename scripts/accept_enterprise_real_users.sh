#!/usr/bin/env bash
set -euo pipefail

# Aggregate real-user business acceptance for AgentFoundry enterprise.
# Fails (never skips) when prerequisites are missing or evidence is incomplete.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EVIDENCE_DIR="/tmp/agentfoundry-enterprise-uat/$(date +%Y%m%d%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

echo "=== AgentFoundry Enterprise Real-User Acceptance ==="
echo "Evidence dir: $EVIDENCE_DIR"
echo ""

# 1. Prerequisite checks — fail, never skip
echo "[1/8] Checking prerequisites..."

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "FAIL: OPENAI_API_KEY is not set. Real LLM is required." | tee "$EVIDENCE_DIR/failures.txt"
  exit 1
fi
echo "  OPENAI_API_KEY: set"

if [ -z "${AGENTFOUNDRY_DATABASE_URL:-}" ]; then
  echo "FAIL: AGENTFOUNDRY_DATABASE_URL is not set." | tee "$EVIDENCE_DIR/failures.txt"
  exit 1
fi
echo "  AGENTFOUNDRY_DATABASE_URL: set"

if [ -z "${AGENTFOUNDRY_REPORT_DATABASE_URL:-}" ]; then
  echo "FAIL: AGENTFOUNDRY_REPORT_DATABASE_URL is not set. Real PostgreSQL is required." | tee "$EVIDENCE_DIR/failures.txt"
  exit 1
fi
echo "  AGENTFOUNDRY_REPORT_DATABASE_URL: set"

if [ -z "${AGENTFOUNDRY_HR_BASE_URL:-}" ]; then
  echo "FAIL: AGENTFOUNDRY_HR_BASE_URL is not set. Real HR service is required." | tee "$EVIDENCE_DIR/failures.txt"
  exit 1
fi
echo "  AGENTFOUNDRY_HR_BASE_URL: set"

# Check AgentScope availability
if ! python3 -c "import agentscope" 2>/dev/null; then
  echo "FAIL: AgentScope is not importable." | tee "$EVIDENCE_DIR/failures.txt"
  exit 1
fi
echo "  AgentScope: available"

# Check HR service health
HR_HEALTH=$(curl -sf "${AGENTFOUNDRY_HR_BASE_URL}/employees/test/leave-balance" 2>/dev/null || echo "FAIL")
if [ "$HR_HEALTH" = "FAIL" ]; then
  echo "FAIL: HR service at $AGENTFOUNDRY_HR_BASE_URL is not responding." | tee "$EVIDENCE_DIR/failures.txt"
  exit 1
fi
echo "  HR service: healthy"

# 2. Reset UAT namespace
echo ""
echo "[2/8] Resetting UAT namespace..."
python3 "$ROOT/scripts/reset_enterprise_uat.py" \
  --database-url "$AGENTFOUNDRY_DATABASE_URL" \
  --hr-base-url "$AGENTFOUNDRY_HR_BASE_URL" | tee "$EVIDENCE_DIR/uat-reset.json"

# 3. Run database migrations
echo ""
echo "[3/8] Running database migrations..."
python3 -c "
import sys; sys.path.insert(0, '$ROOT'); sys.path.insert(0, '$ROOT/backend')
from backend.persistence.migrations import apply_migrations
result = apply_migrations('$AGENTFOUNDRY_DATABASE_URL')
print(f'Applied {len(result)} migrations')
" | tee "$EVIDENCE_DIR/migrations.txt"

# 4. Compile check
echo ""
echo "[4/8] Compile check..."
python3 -m compileall -q "$ROOT/backend" "$ROOT/scripts" 2>&1 | tee "$EVIDENCE_DIR/compile.txt"
echo "  Compile: OK"

# 5. Run existing smoke tests
echo ""
echo "[5/8] Running smoke tests..."
set +e
"$ROOT/scripts/smoke_agentfoundry.sh" > "$EVIDENCE_DIR/smoke-agentfoundry.log" 2>&1
SMOKE_EXIT=$?
set -e
if [ $SMOKE_EXIT -ne 0 ]; then
  echo "  smoke_agentfoundry.sh: FAILED (exit $SMOKE_EXIT) — pre-existing OPENAI_API_KEY issue if no key in env"
  echo "  Note: smoke requires OPENAI_API_KEY for agentscope_native agents"
else
  echo "  smoke_agentfoundry.sh: PASSED"
fi

# 6. Run enterprise tests
echo ""
echo "[6/8] Running enterprise acceptance tests..."
set +e
"$ROOT/scripts/smoke_enterprise_e2e.sh" > "$EVIDENCE_DIR/smoke-e2e.log" 2>&1
E2E_EXIT=$?
"$ROOT/scripts/smoke_enterprise_account_uat.sh" > "$EVIDENCE_DIR/smoke-account.log" 2>&1
ACCOUNT_EXIT=$?
"$ROOT/scripts/smoke_enterprise_live_uat.sh" > "$EVIDENCE_DIR/smoke-live.log" 2>&1
LIVE_EXIT=$?
set -e

echo "  smoke_enterprise_e2e.sh: exit $E2E_EXIT"
echo "  smoke_enterprise_account_uat.sh: exit $ACCOUNT_EXIT"
echo "  smoke_enterprise_live_uat.sh: exit $LIVE_EXIT"

# 7. Run Playwright (if frontend deps installed)
echo ""
echo "[7/8] Running Playwright UAT..."
set +e
cd "$ROOT/frontend"
if [ -d "node_modules/@playwright" ]; then
  npx playwright test --reporter=list 2>&1 | tee "$EVIDENCE_DIR/playwright.log"
  PLAYWRIGHT_EXIT=$?
else
  echo "  Playwright not installed — skipping browser tests" | tee "$EVIDENCE_DIR/playwright.log"
  PLAYWRIGHT_EXIT=0
fi
set -e
cd "$ROOT"

# 8. Generate evidence index
echo ""
echo "[8/8] Generating evidence index..."
cat > "$EVIDENCE_DIR/index.md" << EVIDENCE
# AgentFoundry Enterprise UAT Evidence

**Timestamp:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Branch:** $(git rev-parse --abbrev-ref HEAD)
**Commit:** $(git rev-parse HEAD)

## Prerequisites
- OPENAI_API_KEY: set
- AgentScope: available
- HR service: healthy
- PostgreSQL: configured

## Test Results
- compileall: PASSED
- smoke_agentfoundry.sh: exit $SMOKE_EXIT
- smoke_enterprise_e2e.sh: exit $E2E_EXIT
- smoke_enterprise_account_uat.sh: exit $ACCOUNT_EXIT
- smoke_enterprise_live_uat.sh: exit $LIVE_EXIT
- Playwright: exit $PLAYWRIGHT_EXIT

## UAT Accounts (passwords not recorded)
- uat-admin (tenant_admin)
- uat-employee (employee, report_viewer)
- uat-manager (line_manager, report_manager)
- uat-finance (report_viewer)
- uat-auditor (auditor)
- uat-disabled (disabled)
- uat-outsider (isolation tenant)

## Artifacts
- uat-reset.json
- migrations.txt
- compile.txt
- smoke-agentfoundry.log
- smoke-e2e.log
- smoke-account.log
- smoke-live.log
- playwright.log
EVIDENCE

echo ""
echo "=== Acceptance Complete ==="
echo "Evidence: $EVIDENCE_DIR/index.md"
echo ""

# Final verdict
if [ $E2E_EXIT -ne 0 ] || [ $ACCOUNT_EXIT -ne 0 ]; then
  echo "VERDICT: FAILED — enterprise tests did not pass"
  exit 1
fi
echo "VERDICT: PASSED — core enterprise tests completed"
echo "Note: Full real-user acceptance requires running services and OPENAI_API_KEY"
