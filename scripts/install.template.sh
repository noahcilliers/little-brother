#!/bin/sh
# Little Brother connector installer.
#
#   curl -fsSL __LB_ORIGIN__/install.sh | sh
#   curl -fsSL __LB_ORIGIN__/install.sh | sh -s -- join --url <siteUrl> --token <connectToken>
#
# Installs ~/.little-brother/bin/lb.mjs and an `lb` shim in ~/.local/bin. Never uses sudo and never
# edits shell startup files; it prints what to add instead. Safe to re-run: it updates in place.
# Overrides: LB_ORIGIN (download site), LB_HOME (default ~/.little-brother), LB_BIN_DIR (default ~/.local/bin).
#
# Generated from scripts/install.template.sh by scripts/publish-connector.mjs.

# Everything runs inside main, so a truncated download (curl | sh) executes nothing.
main() {
  set -eu

  origin="${LB_ORIGIN:-__LB_ORIGIN__}"
  origin="${origin%/}"
  lb_home="${LB_HOME:-$HOME/.little-brother}"
  bin_dir="${LB_BIN_DIR:-$HOME/.local/bin}"
  target="$lb_home/bin/lb.mjs"
  shim="$bin_dir/lb"
  marker="# little-brother shim"

  say() { printf '%s\n' "$*"; }
  warn() { printf 'warning: %s\n' "$*" >&2; }
  die() {
    printf 'error: %s\n' "$*" >&2
    exit 1
  }

  [ -n "${HOME:-}" ] || die "HOME is not set"
  if [ "$(id -u)" = "0" ]; then
    warn "running as root installs Little Brother for root only; re-run as your own user, without sudo"
  fi

  # Requirements: Node >= 20 runs the connector, git is read by the hooks and `lb verify`.
  command -v node >/dev/null 2>&1 || die "Node.js 20 or newer is required (https://nodejs.org), then re-run"
  node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "$node_major" -ge 20 ] 2>/dev/null || die "Node.js 20 or newer is required, found $(node --version 2>/dev/null || echo unknown)"
  node_path="$(command -v node)"
  command -v git >/dev/null 2>&1 || die "git is required (macOS: xcode-select --install), then re-run"

  if command -v curl >/dev/null 2>&1; then
    fetch() { curl -fsSL --retry 2 -o "$2" "$1"; }
  elif command -v wget >/dev/null 2>&1; then
    fetch() { wget -q -O "$2" "$1"; }
  else
    die "curl or wget is required"
  fi

  mkdir -p "$lb_home/bin" "$lb_home/cache" "$bin_dir"

  # Download next to the target and swap in only a file that runs, so a failed update keeps the old one.
  # The .mjs extension matters: node picks the module format from it.
  tmp="$lb_home/bin/.lb-download-$$.mjs"
  trap 'rm -f "$tmp"' EXIT INT TERM
  say "Downloading $origin/lb.mjs"
  fetch "$origin/lb.mjs" "$tmp" || die "download failed from $origin/lb.mjs (set LB_ORIGIN to the Little Brother site)"
  version="$(node "$tmp" --version 2>/dev/null)" || die "downloaded lb.mjs does not run on $(node --version)"
  chmod 755 "$tmp"
  mv -f "$tmp" "$target"
  trap - EXIT INT TERM

  if [ -e "$shim" ] && ! grep -q "$marker" "$shim" 2>/dev/null; then
    warn "$shim exists and was not written by this installer; leaving it alone"
    warn "remove it and re-run, or point hooks at: node $target"
  else
    # node is looked up on PATH first so nvm/fnm switches apply; the path seen now is the fallback
    # for sessions started with a minimal PATH (IDE, GUI launchers).
    cat >"$shim" <<EOF
#!/bin/sh
$marker (written by $origin/install.sh; safe to delete)
NODE_COMPILE_CACHE="\${NODE_COMPILE_CACHE:-$lb_home/cache/v8}"
export NODE_COMPILE_CACHE
node_bin="\$(command -v node 2>/dev/null || true)"
[ -n "\$node_bin" ] || node_bin="$node_path"
exec "\$node_bin" "$target" "\$@"
EOF
    chmod 755 "$shim"
  fi

  say "Installed lb $version"
  say "  connector: $target"
  say "  shim:      $shim"

  case ":$PATH:" in
    *":$bin_dir:"*)
      found="$(command -v lb 2>/dev/null || true)"
      if [ -n "$found" ] && [ "$found" != "$shim" ]; then
        warn "\`lb\` on your PATH is $found, not $shim; put $bin_dir earlier in PATH"
      fi
      ;;
    *)
      say ""
      say "$bin_dir is not on your PATH. Add it (Claude Code hooks call \`lb\`), then open a new terminal:"
      say "  zsh:  echo 'export PATH=\"$bin_dir:\$PATH\"' >> ~/.zshrc"
      say "  bash: echo 'export PATH=\"$bin_dir:\$PATH\"' >> ~/.bashrc"
      say "  fish: fish_add_path $bin_dir"
      ;;
  esac

  joined=0
  if [ "$#" -gt 0 ]; then
    say ""
    say "Running: lb $*"
    "$shim" "$@"
    [ "$1" = "join" ] && joined=1
  fi

  say ""
  say "Next steps:"
  if [ "$joined" = 0 ]; then
    say "  1. Connect this laptop (copy the command from $origin):"
    say "       lb join --url <siteUrl> --token <connectToken>"
  else
    say "  1. Joined. Check with: lb status"
  fi
  say "  2. Install the Claude Code plugin:"
  say "       claude plugin marketplace add noahcilliers/little-brother"
  say "       claude plugin install little-brother@little-brother"
  say "  3. Start Claude Code in your repo with the task list and channel enabled:"
  say "       export CLAUDE_CODE_ENABLE_TODO_TOOLS=1"
  say "       claude --dangerously-load-development-channels plugin:little-brother@little-brother"
}

main "$@"
