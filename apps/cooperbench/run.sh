#!/usr/bin/env bash
# Runs one arm of the CooperBench comparison, then grades it with `cooperbench eval`.
#
# Usage:  apps/cooperbench/run.sh <baseline|lb> [extra cooperbench run args...]
# Env:    COOPERBENCH_DIR (default ~/CooperBench), MODEL, SUBSET (default flash_10), TAG, CONCURRENCY
#
# baseline = CooperBench's stock claude_code adapter in coop mode (their Redis messaging).
# lb       = the same adapter with the Little Brother plugin loaded (claude_code_lb).
set -euo pipefail

ARM="${1:?usage: run.sh <baseline|lb> [cooperbench run args...]}"
shift
HERE="$(cd "$(dirname "$0")" && pwd)"
CB="${COOPERBENCH_DIR:-$HOME/CooperBench}"
MODEL="${MODEL:-claude-sonnet-4-5}"
SUBSET="${SUBSET:-flash_10}"
TAG="${TAG:-$(date +%Y%m%d-%H%M)}"
CONCURRENCY="${CONCURRENCY:-3}"

case "$ARM" in
  baseline) AGENT=claude_code ;;
  lb) AGENT=claude_code_lb ;;
  *) echo "arm must be baseline or lb" >&2; exit 2 ;;
esac

NAME="${SUBSET}-${ARM}-${TAG}"
export PYTHONPATH="$HERE${PYTHONPATH:+:$PYTHONPATH}"
export COOPERBENCH_EXTERNAL_AGENTS=lb_cooperbench.adapter

cd "$CB"
uv run cooperbench run -n "$NAME" -s "$SUBSET" -m "$MODEL" -a "$AGENT" --setting coop \
  --backend docker -c "$CONCURRENCY" --agent-config "$HERE/agent-config.yaml" --no-auto-eval "$@"
uv run cooperbench eval -n "$NAME" --backend docker -c "$CONCURRENCY"
echo "logs: $CB/logs/$NAME"
