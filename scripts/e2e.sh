#!/usr/bin/env bash
# Replays the demo scenario through the real connector + local Convex backend.
# Usage: scripts/e2e.sh            (requires `npx convex dev` running in packages/backend)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="${LB_SITE_URL:-http://127.0.0.1:3211}"
export LB_HOME="${LB_HOME:-/tmp/lb-e2e-home}"
LB="node $ROOT/apps/connector/dist/cli.js"

(cd "$ROOT/packages/backend" && CONVEX_AGENT_MODE=anonymous npx convex run admin:reset >/dev/null)
rm -rf /tmp/lb-demo "$LB_HOME"
"$ROOT/demo/setup.sh" /tmp/lb-demo/shop --worktrees >/dev/null
(cd "$ROOT" && pnpm --filter @lb/connector build >/dev/null)

for who in noah joshua ash; do $LB join --url "$SITE" --as "$who" >/dev/null; done
$LB replay "$ROOT/fixtures/scenario.jsonl" --apply --speed "${SPEED:-4}"
