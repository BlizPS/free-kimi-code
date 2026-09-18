#!/bin/sh
set -eu

LAZYDEV_HOME="${LAZYDEV_HOME:-$HOME/.local/share/lazydev}"
LAZYDEV_BIN_DIR="${LAZYDEV_BIN_DIR:-$HOME/.local/bin}"
if [ "$(uname -s)" = "Darwin" ]; then
  LAZYDEV_CONFIG_DIR="${LAZYDEV_CONFIG_DIR:-$HOME/Library/Application Support/lazydev}"
  RTK_CONFIG_DIR="$HOME/Library/Application Support/rtk"
else
  LAZYDEV_CONFIG_DIR="${LAZYDEV_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/lazydev}"
  RTK_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/rtk"
fi
KIMI_NATIVE_HOME="$HOME/.kimi-code"
ARTIFACT_DIR="$HOME/lazydevfile"

say() { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
fatal() { printf 'error: %s\n' "$*" >&2; exit 1; }

remove_path_lines() {
  file="$1"
  [ -f "$file" ] || return 0
  tmp="${file}.lazydev-uninstall.$$"
  sed \
    -e '/^[[:space:]]*# Lazy Developer PATH[[:space:]]*$/d' \
    -e '\|export PATH="[^"]*\.kimi-code/bin:[^"]*"$|d' \
    -e "\|fish_add_path '$LAZYDEV_BIN_DIR' '$HOME/.kimi-code/bin'|d" \
    "$file" > "$tmp"
  mv "$tmp" "$file"
}

process_running() {
  pattern="$1"
  if command -v pgrep >/dev/null 2>&1; then
    pgrep -f "$pattern" >/dev/null 2>&1
  else
    return 1
  fi
}

assert_stopped() {
  running=""
  process_running 'scripts/lazydev\.mjs' && running="$running lazydev"
  process_running '(^|/)kimi([[:space:]]|$)' && running="$running kimi"
  process_running '(^|/)rtk([[:space:]]|$)' && running="$running rtk"
  [ -z "$running" ] || fatal "Stop running${running} processes before uninstalling."
}

step "Checking running processes"
assert_stopped

step "Removing Lazy Developer"
rm -rf "$LAZYDEV_HOME" "$LAZYDEV_HOME.previous" "$LAZYDEV_CONFIG_DIR"
rm -f "$LAZYDEV_BIN_DIR/lazydev"

step "Removing Kimi Code"
rm -rf "$KIMI_NATIVE_HOME" 2>/dev/null || true
# LazyDev's Kimi data directory lives under its config root and was removed above.
# Remove legacy npm installs when npm happens to be present; npm is not required for uninstall.
if command -v npm >/dev/null 2>&1; then
  npm uninstall -g @blizps/lazy-developer @moonshot-ai/kimi-code >/dev/null 2>&1 || true
fi
rm -f "$LAZYDEV_BIN_DIR/kimi" "$LAZYDEV_BIN_DIR/kimi.cmd" 2>/dev/null || true

step "Removing RTK"
rm -f "$LAZYDEV_BIN_DIR/rtk"
rm -rf "$RTK_CONFIG_DIR"
# Clean the RTK binary only when it is the user-local copy this installer targets.
if [ -x "$HOME/.cargo/bin/rtk" ] && [ "$(command -v rtk 2>/dev/null || true)" = "$HOME/.cargo/bin/rtk" ]; then
  rm -f "$HOME/.cargo/bin/rtk"
fi

step "Removing LazyDev workspace artifacts"
rm -rf "$ARTIFACT_DIR"

case "${SHELL:-}" in
  */zsh) remove_path_lines "$HOME/.zshrc" ;;
  */fish) remove_path_lines "$HOME/.config/fish/config.fish" ;;
  *) remove_path_lines "$HOME/.bashrc" ;;
esac

step "Checking cleanup"
for path in "$LAZYDEV_HOME" "$LAZYDEV_CONFIG_DIR" "$KIMI_NATIVE_HOME" "$RTK_CONFIG_DIR" "$LAZYDEV_BIN_DIR/lazydev" "$LAZYDEV_BIN_DIR/rtk" "$ARTIFACT_DIR"; do
  [ ! -e "$path" ] || fatal "Cleanup incomplete: $path still exists."
done

say ""
say "Lazy Developer, Kimi Code, RTK, their managed configuration, sessions, caches, and LazyDev artifacts have been removed."
say "Project folders outside these managed locations were left untouched."
