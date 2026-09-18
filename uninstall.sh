#!/bin/sh
set -eu

LAZYDEV_HOME="${LAZYDEV_HOME:-$HOME/.local/share/lazydev}"
LAZYDEV_BIN_DIR="${LAZYDEV_BIN_DIR:-}"
TERMUX_LINUX=0
case "${PREFIX:-}" in
  */com.termux/files/usr|*/com.termux/files/usr/) TERMUX_LINUX=1 ;;
esac
if [ "${TERMUX_VERSION:-}" != "" ]; then TERMUX_LINUX=1; fi
if [ "$TERMUX_LINUX" -eq 1 ]; then
  if command -v getconf >/dev/null 2>&1 && getconf GNU_LIBC_VERSION >/dev/null 2>&1; then
    LAZYDEV_BIN_DIR="${LAZYDEV_BIN_DIR:-${PREFIX:-$HOME/.local}/bin}"
  fi
fi
LAZYDEV_BIN_DIR="${LAZYDEV_BIN_DIR:-$HOME/.local/bin}"
if [ "$(uname -s)" = "Darwin" ]; then
  LAZYDEV_CONFIG_DIR="${LAZYDEV_CONFIG_DIR:-$HOME/Library/Application Support/lazydev}"
  RTK_CONFIG_DIR="$HOME/Library/Application Support/rtk"
else
  LAZYDEV_CONFIG_DIR="${LAZYDEV_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/lazydev}"
  RTK_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/rtk"
fi
KIMI_NATIVE_HOME="$HOME/.kimi-code"
KIMI_LEGACY_HOME="$HOME/.kimi"
KIMI_CONFIG_DIRS="${XDG_CONFIG_HOME:-$HOME/.config}/kimi ${XDG_CONFIG_HOME:-$HOME/.config}/kimi-code $HOME/.config/kimi $HOME/.config/kimi-code"
if [ "$TERMUX_LINUX" -eq 1 ]; then
  ARTIFACT_DIR="${LAZYDEV_ARTIFACT_DIR:-/storage/emulated/0/lazydevfile}"
else
  ARTIFACT_DIR="${LAZYDEV_ARTIFACT_DIR:-$HOME/lazydevfile}"
fi
RTK_DATA_DIR="$HOME/.local/share/rtk"
RTK_CACHE_DIR="$HOME/.cache/rtk"

say() { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
fatal() { printf 'error: %s\n' "$*" >&2; exit 1; }

remove_path_lines() {
  file="$1"
  [ -f "$file" ] || return 0
  tmp="${file}.lazydev-uninstall.$$"
  sed \
    -e '/^[[:space:]]*# Lazy Developer PATH[[:space:]]*$/d' \
    -e '\|^export PATH=.*\.kimi-code/bin.*$|d' \
    -e "\|fish_add_path .*\.kimi-code.*|d" \
    "$file" > "$tmp"
  mv "$tmp" "$file"
}

remove_managed_launchers_from_path() {
  paths="${PATH:-}"
  old_ifs="$IFS"
  IFS=':'
  for dir in $paths; do
    IFS="$old_ifs"
    [ -n "$dir" ] || { IFS=':'; continue; }
    for name in lazydev kimi rtk; do
      candidate="$dir/$name"
      if [ ! -e "$candidate" ] && [ ! -L "$candidate" ]; then continue; fi
      case "$name" in
        lazydev)
          if is_managed_file "$candidate" 'Lazy Developer managed launcher|scripts/lazydev\.mjs|@blizps/lazy-developer|lazy-developer-free-kimi-code'; then rm -f "$candidate" 2>/dev/null || true;
          elif [ -L "$candidate" ]; then
            link_target="$(readlink "$candidate" 2>/dev/null || true)"
            if printf '%s\n' "$link_target" | grep -Eq 'lazydev|lazy-developer-free-kimi-code|scripts/lazydev'; then rm -f "$candidate" 2>/dev/null || true; fi
          fi
          ;;
        kimi)
          if is_managed_file "$candidate" '\.kimi-code|kimi-code|@moonshot-ai/kimi-code'; then rm -f "$candidate" 2>/dev/null || true; fi
          ;;
        rtk)
          if is_managed_file "$candidate" 'rtk-ai/rtk|Rust Token Killer'; then rm -f "$candidate" 2>/dev/null || true; fi
          ;;
      esac
    done
    IFS=':'
  done
  IFS="$old_ifs"
}

is_managed_file() {
  file="$1"; pattern="$2"
  [ -f "$file" ] || [ -L "$file" ] || return 1
  target="$file"
  if [ -L "$target" ] && command -v readlink >/dev/null 2>&1; then
    resolved="$(readlink -f "$target" 2>/dev/null || true)"
    [ -n "$resolved" ] && target="$resolved"
  fi
  if [ -L "$file" ] && command -v readlink >/dev/null 2>&1; then
    link_target="$(readlink "$file" 2>/dev/null || true)"
    if printf '%s\n' "$link_target" | grep -Eq "$pattern"; then return 0; fi
  fi
  [ -f "$target" ] || return 1
  grep -Eq "$pattern" "$target" 2>/dev/null
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
rm -f "$LAZYDEV_BIN_DIR/lazydev" "$LAZYDEV_BIN_DIR/lazydev.cmd" "$LAZYDEV_BIN_DIR/lazydev.ps1"
rm -f "$HOME/.local/bin/lazydev" "$HOME/.local/bin/lazydev.cmd" "$HOME/.local/bin/lazydev.ps1" 2>/dev/null || true
if [ -n "${PREFIX:-}" ]; then rm -f "$PREFIX/bin/lazydev" "$PREFIX/bin/lazydev.cmd" "$PREFIX/bin/lazydev.ps1" 2>/dev/null || true; fi

step "Removing Kimi Code"
rm -rf "$KIMI_NATIVE_HOME" "$KIMI_LEGACY_HOME" 2>/dev/null || true
for dir in $KIMI_CONFIG_DIRS; do rm -rf "$dir" 2>/dev/null || true; done
rm -rf "$HOME/.local/share/kimi-code" "$HOME/.cache/kimi-code" "$HOME/.local/state/kimi-code" 2>/dev/null || true
rm -rf "$HOME/Library/Application Support/kimi-code" "$HOME/Library/Caches/kimi-code" "$HOME/Library/Logs/kimi-code" 2>/dev/null || true
# Remove legacy npm installs when npm happens to be present; npm is not required for uninstall.
if command -v npm >/dev/null 2>&1; then
  npm uninstall -g @blizps/lazy-developer @moonshot-ai/kimi-code >/dev/null 2>&1 || true
fi
# Remove legacy global package directories even when npm itself is unavailable.
for npm_root in \
  "$HOME/.npm-global/lib/node_modules" \
  "$HOME/.local/lib/node_modules" \
  "$HOME/.nvm/versions/node"/*/lib/node_modules \
  "${PREFIX:-}/lib/node_modules" \
  "/usr/local/lib/node_modules" \
  "/usr/lib/node_modules"; do
  [ -d "$npm_root" ] || continue
  rm -rf "$npm_root/@blizps/lazy-developer" "$npm_root/@moonshot-ai/kimi-code" 2>/dev/null || true
done
rm -f "$LAZYDEV_BIN_DIR/kimi" "$LAZYDEV_BIN_DIR/kimi.exe" "$LAZYDEV_BIN_DIR/kimi.cmd" "$HOME/.local/bin/kimi" "$HOME/.local/bin/kimi.exe" "$HOME/.local/bin/kimi.cmd" 2>/dev/null || true

step "Removing RTK"
RTK_PATH="$(command -v rtk 2>/dev/null || true)"
if [ -n "$RTK_PATH" ]; then
  if "$RTK_PATH" gain >/dev/null 2>&1; then
    "$RTK_PATH" init -g --uninstall >/dev/null 2>&1 || true
  fi
fi
rm -f "$LAZYDEV_BIN_DIR/rtk" "$HOME/.local/bin/rtk" "$HOME/.cargo/bin/rtk" 2>/dev/null || true
rm -rf "$RTK_CONFIG_DIR" "$RTK_DATA_DIR" "$RTK_CACHE_DIR" 2>/dev/null || true
rm -rf "$HOME/Library/Application Support/rtk" "$HOME/Library/Caches/rtk" 2>/dev/null || true

step "Removing LazyDev workspace artifacts"
rm -rf "$ARTIFACT_DIR"
remove_managed_launchers_from_path

case "${SHELL:-}" in
  */zsh) remove_path_lines "$HOME/.zshrc" ;;
  */fish) remove_path_lines "$HOME/.config/fish/config.fish" ;;
  *) remove_path_lines "$HOME/.bashrc" ;;
esac

step "Checking cleanup"
for path in "$LAZYDEV_HOME" "$LAZYDEV_CONFIG_DIR" "$KIMI_NATIVE_HOME" "$KIMI_LEGACY_HOME" "$RTK_CONFIG_DIR" "$RTK_DATA_DIR" "$RTK_CACHE_DIR" "$LAZYDEV_BIN_DIR/lazydev" "$HOME/.local/bin/lazydev" "$LAZYDEV_BIN_DIR/rtk" "$ARTIFACT_DIR"; do
  [ ! -e "$path" ] || fatal "Cleanup incomplete: $path still exists."
done

say ""
say "Lazy Developer, Kimi Code, RTK, their managed configuration, sessions, caches, and LazyDev artifacts have been removed."
say "Project folders outside these managed locations were left untouched."
