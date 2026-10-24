#!/usr/bin/env bash
# Creates and resets the lb-demo-store git repo (Quill & Kettle) used for the live demo scenarios in
# demo/store-scenarios.md.
#
#   demo/store.sh init  [target-dir] [--worktrees] [--install]
#   demo/store.sh reset [target-dir]
#
#   target-dir   the repo (default: ~/lb-demo-store); init refuses an existing one
#   --worktrees  also add one worktree per agent next to the repo: <parent>/{noah,joshua,ash}, each on
#                <handle>/work. Use this to rehearse all three agents on one machine.
#   --install    run `npm ci` in the repo and in each worktree
#
# reset puts the repo and every worktree back on main: it discards uncommitted changes and untracked files
# (node_modules stays). Run it between scenarios.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
handles=(noah joshua ash)

cmd="${1:-}"
[ $# -gt 0 ] && shift
target="$HOME/lb-demo-store"
worktrees=false
install=false
for arg in "$@"; do
  case "$arg" in
    --worktrees) worktrees=true ;;
    --install) install=true ;;
    -*) echo "unknown flag: $arg" >&2; exit 2 ;;
    *) target="$arg" ;;
  esac
done

init() {
  if [ -e "$target" ]; then
    echo "refusing to overwrite existing $target" >&2
    exit 1
  fi
  mkdir -p "$target"
  target="$(cd "$target" && pwd)"
  rsync -a --exclude node_modules --exclude dist "$here/store/" "$target/"

  git -C "$target" init -q -b main
  git -C "$target" add -A
  # A fixed date gives the same main SHA on every laptop. The classifier only blocks line overlaps
  # between agents on the same base commit, so separate inits must agree.
  GIT_AUTHOR_DATE="2026-10-01T09:00:00Z" GIT_COMMITTER_DATE="2026-10-01T09:00:00Z" \
    git -C "$target" -c user.name="lb-demo" -c user.email="demo@little-brother.dev" \
    commit -q -m "Quill & Kettle: catalog, cart, checkout and storefront"

  local dirs=("$target")
  for handle in "${handles[@]}"; do
    git -C "$target" branch "$handle/work"
    if $worktrees; then
      local dir
      dir="$(dirname "$target")/$handle"
      git -C "$target" worktree add -q "$dir" "$handle/work"
      dirs+=("$dir")
    fi
  done

  if $install; then
    for dir in "${dirs[@]}"; do (cd "$dir" && npm ci --silent); done
  fi

  echo "lb-demo-store ready at $target"
  git -C "$target" worktree list | sed 's/^/  /'
  echo "next: cd $target && npm install && npm run dev   # http://localhost:5173"
}

reset() {
  if [ ! -d "$target/.git" ]; then
    echo "no lb-demo-store repo at $target" >&2
    exit 1
  fi
  git -C "$target" checkout -q main
  git -C "$target" reset -q --hard main
  git -C "$target" clean -qfd
  for handle in "${handles[@]}"; do
    git -C "$target" branch -f "$handle/work" main 2>/dev/null || true
  done
  # Worktrees have their branch checked out, so `branch -f` skips them; reset them in place.
  git -C "$target" worktree list --porcelain | sed -n 's/^worktree //p' | while read -r dir; do
    [ "$dir" = "$target" ] && continue
    git -C "$dir" reset -q --hard main
    git -C "$dir" clean -qfd
  done
  echo "reset to main:"
  git -C "$target" worktree list | sed 's/^/  /'
}

case "$cmd" in
  init) init ;;
  reset) reset ;;
  *) sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; exit 2 ;;
esac
