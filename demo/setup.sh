#!/usr/bin/env bash
# Creates the lb-demo-shop git repo used in the Little Brother demo.
#
#   demo/setup.sh [target-dir] [--worktrees] [--install]
#
#   target-dir   where to create the repo (default: ~/lb-demo-shop); must not exist
#   --worktrees  also add one worktree per agent next to the repo:
#                <parent>/noah (noah/auth), <parent>/joshua (joshua/checkout), <parent>/ash (ash/frontend)
#                e.g. `demo/setup.sh /tmp/lb-demo/shop --worktrees` gives the cwds used by fixtures/scenario.jsonl
#   --install    run `npm ci` in the repo (and in each worktree with --worktrees)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target="$HOME/lb-demo-shop"
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

if [ -e "$target" ]; then
  echo "refusing to overwrite existing $target" >&2
  exit 1
fi

mkdir -p "$target"
target="$(cd "$target" && pwd)"
# rsync keeps the copy clean of local installs; fall back to cp + rm when rsync is missing.
if command -v rsync >/dev/null; then
  rsync -a --exclude node_modules --exclude dist "$here/shop/" "$target/"
else
  cp -R "$here/shop/." "$target/"
  rm -rf "$target/node_modules" "$target/dist"
fi

git -C "$target" init -q -b main
git -C "$target" add -A
git -C "$target" -c user.name="lb-demo" -c user.email="demo@little-brother.dev" \
  commit -q -m "lb-demo-shop: API + storefront skeleton"

branches=(noah/auth joshua/checkout ash/frontend)
for branch in "${branches[@]}"; do
  git -C "$target" branch "$branch"
done

dirs=("$target")
if $worktrees; then
  parent="$(dirname "$target")"
  for branch in "${branches[@]}"; do
    dir="$parent/${branch%%/*}"
    git -C "$target" worktree add -q "$dir" "$branch"
    dirs+=("$dir")
  done
fi

if $install; then
  for dir in "${dirs[@]}"; do (cd "$dir" && npm ci --silent); done
fi

echo "lb-demo-shop ready at $target"
git -C "$target" branch --list | sed 's/^/  /'
$worktrees && git -C "$target" worktree list | sed 's/^/  /'
echo "next: cd $target && npm install && npm run test:integration   # fails on main until auth + checkout agree"
