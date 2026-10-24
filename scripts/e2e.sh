#!/usr/bin/env bash
# Replays the demo scenario through the real connector + local Convex backend.
# Usage: scripts/e2e.sh            (requires `npx convex dev` running in packages/backend)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="${LB_SITE_URL:-http://127.0.0.1:3211}"
export LB_HOME="${LB_HOME:-/tmp/lb-e2e-home}"
# Every replayed Claude session joins one session; open mode creates it on first use.
export LB_SESSION="${LB_SESSION:-e2e001}"
LB="node $ROOT/apps/connector/dist/cli.js"

# Local dev deployment only: the shared invite code is disabled unless LB_ALLOW_INVITE=1.
(cd "$ROOT/packages/backend" && CONVEX_AGENT_MODE=anonymous npx convex env set LB_ALLOW_INVITE 1 >/dev/null)
(cd "$ROOT/packages/backend" && CONVEX_AGENT_MODE=anonymous npx convex run admin:reset >/dev/null)
rm -rf /tmp/lb-demo "$LB_HOME"
"$ROOT/demo/setup.sh" /tmp/lb-demo/shop --worktrees >/dev/null
(cd "$ROOT" && pnpm --filter @lb/connector build >/dev/null)

for who in noah joshua ash maya leo priya; do $LB join --url "$SITE" --invite "${LB_INVITE_CODE:-calhacks}" --as "$who" >/dev/null; done
$LB replay "$ROOT/fixtures/scenario.jsonl" --apply --parallel --speed "${SPEED:-1}"
