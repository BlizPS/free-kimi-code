#!/bin/sh
set -eu

REPO="BlizPS/free-kimi-code"
BRANCH="${LAZYDEV_BRANCH:-main}"
LAZYDEV_VERSION="1.0.3"
REPO_ARCHIVE_URL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"
GITHUB_API_URL="https://api.github.com/repos/${REPO}/commits/${BRANCH}"
KIMI_INSTALL_URL="https://code.kimi.com/kimi-code/install.sh"
KIMI_RELEASE_API_URL="https://api.github.com/repos/MoonshotAI/kimi-code/releases/latest"
CODEX_INSTALL_URL="https://chatgpt.com/codex/install.sh"
CODEX_RELEASE_API_URL="https://api.github.com/repos/openai/codex/releases/latest"
ANTIGRAVITY_INSTALL_URL="https://antigravity.google/cli/install.sh"
ANTIGRAVITY_RELEASE_API_URL="https://api.github.com/repos/google-antigravity/antigravity-cli/releases/latest"
CLAUDE_INSTALL_URL="https://claude.ai/install.sh"
RTK_INSTALL_URL="https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh"
DEEPSEEK_HARNESS_PACKAGE="@deepseek-ai/dsh"
DEEPSEEK_HARNESS_DESKTOP_VERSION="${LAZYDEV_DSH_VERSION:-0.1.5-rc.2}"
DEEPSEEK_HARNESS_TERMUX_VERSION="0.1.2-rc.1"

LAZYDEV_HOME="${LAZYDEV_HOME:-$HOME/.local/share/lazydev}"
LAZYDEV_CONFIG_DIR="${LAZYDEV_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/lazydev}"
LAZYDEV_BIN_DIR="${LAZYDEV_BIN_DIR:-$HOME/.local/bin}"
LAZYDEV_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}/lazydev"
LAZYDEV_STATE_FILE="$LAZYDEV_STATE_HOME/install-state"
LAZYDEV_CLI_REGISTRY_FILE="$LAZYDEV_STATE_HOME/cli-paths"
KIMI_BIN_DIR="${KIMI_BIN_DIR:-$HOME/.kimi-code/bin}"
RTK_BIN_DIR="${RTK_BIN_DIR:-$LAZYDEV_BIN_DIR}"
CODEX_BIN_DIR="${CODEX_BIN_DIR:-$HOME/.local/bin}"
LAZYDEV_UI_HOME="${LAZYDEV_UI_RUNTIME:-$LAZYDEV_CONFIG_DIR/ui-runtime}"
LAZYDEV_UI_PACKAGE="@poppinss/cliui"
LAZYDEV_UI_VERSION="6.8.1"
DEEPSEEK_HARNESS_RUNTIME="${LAZYDEV_DSH_RUNTIME:-${XDG_DATA_HOME:-$HOME/.local/share}/lazydev/deepseek-harness-runtime}"

TERMUX=0
ANDROID_TERMUX=0
case "${PREFIX:-}" in */com.termux/files/usr|*/com.termux/files/usr/) TERMUX=1;; esac
if [ -n "${TERMUX_VERSION:-}" ]; then TERMUX=1; fi
if uname -a 2>/dev/null | grep -qi android; then ANDROID_TERMUX=1; fi

say() { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
fatal() { printf 'error: %s\n' "$*" >&2; exit 1; }

require_command() {
  command -v "$1" >/dev/null 2>&1 || fatal "$1 is required. Install it first, then rerun LazyDev installer."
}

extract_semver() {
  printf '%s\n' "$1" | sed -n 's/.*\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' | tail -n 1
}

version_at_least() {
  awk -v c="$1" -v r="$2" 'function v(s,a){n=split(s,a,".");return(a[1]+0)*1000000+(a[2]+0)*1000+(a[3]+0)}BEGIN{gsub(/^v/,"",c);gsub(/^v/,"",r);exit !(v(c)>=v(r))}'
}

find_cmd() {
  for name in "$@"; do
    path="$(command -v "$name" 2>/dev/null || true)"
    if [ -n "$path" ]; then printf '%s\n' "$path"; return 0; fi
  done
  return 1
}

get_json_value() {
  file="$1"; key="$2"
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$file" | head -n 1
}

latest_release_version() {
  url="$1"; out="$2"
  if curl -fsSL --connect-timeout 10 --max-time 45 --retry 4 --retry-delay 1 \
      -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' \
      -H 'User-Agent: free-kimi-code-installer/1.0.3' "$url" -o "$out" 2>/dev/null; then
    get_json_value "$out" tag_name | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | tail -n 1
  fi
}

latest_kimi_version() { latest_release_version "$KIMI_RELEASE_API_URL" "$TMP_DIR/kimi-release.json"; }
latest_codex_version() { latest_release_version "$CODEX_RELEASE_API_URL" "$TMP_DIR/codex-release.json"; }
latest_antigravity_version() { latest_release_version "$ANTIGRAVITY_RELEASE_API_URL" "$TMP_DIR/antigravity-release.json"; }

get_remote_revision() {
  response="$TMP_DIR/revision.json"
  if curl -fsSL --connect-timeout 10 --max-time 45 --retry 4 --retry-delay 1 \
      -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' \
      -H 'User-Agent: free-kimi-code-installer/1.0.3' "$GITHUB_API_URL" -o "$response" 2>/dev/null; then
    get_json_value "$response" sha
  fi
}

find_kimi() {
  if [ -n "${LAZYDEV_KIMI_COMMAND:-}" ] && [ -x "$LAZYDEV_KIMI_COMMAND" ]; then printf '%s\n' "$LAZYDEV_KIMI_COMMAND"; return 0; fi
  find_cmd kimi kimi-code
}
find_codex() { find_cmd codex; }
find_antigravity() { find_cmd antigravity; }
find_claude() { find_cmd claude; }
find_rtk() { find_cmd rtk; }

find_deepseek_harness() {
  path="$(find_cmd dsh 2>/dev/null || true)"
  if [ -n "$path" ]; then printf '%s\n' "$path"; return 0; fi
  for candidate in "$DEEPSEEK_HARNESS_RUNTIME/node_modules/.bin/dsh" "$DEEPSEEK_HARNESS_RUNTIME/node_modules/@deepseek-ai/dsh/bin/dsh.js"; do
    [ -f "$candidate" ] && printf '%s\n' "$candidate" && return 0
  done
  return 1
}

command_version() {
  "$1" --version 2>/dev/null || true
}

prompt_yn() {
  label="$1"
  printf '%s [Y/n]: ' "$label"
  IFS= read -r answer || true
  case "${answer:-}" in n|N|no|NO|No) return 1;; *) return 0;; esac
}

ask_install_ui() { prompt_yn "$1"; }

load_state() {
  if [ -f "$LAZYDEV_STATE_FILE" ]; then
    sed -n 's/^bin_dir=//p' "$LAZYDEV_STATE_FILE" | head -n 1
  fi
}

write_state() {
  mkdir -p "$LAZYDEV_STATE_HOME"
  tmp="$LAZYDEV_STATE_FILE.tmp.$$"
  {
    printf 'version=%s\n' "$LAZYDEV_VERSION"
    printf 'revision=%s\n' "${REMOTE_REVISION:-unknown}"
    printf 'bin_dir=%s\n' "$LAZYDEV_BIN_DIR"
    printf 'kimi_bin_dir=%s\n' "$KIMI_BIN_DIR"
    printf 'kimi_command=%s\n' "${KIMI_COMMAND:-}"
    printf 'codex_command=%s\n' "${CODEX_COMMAND:-}"
    printf 'antigravity_command=%s\n' "${AGY_COMMAND:-}"
    printf 'claude_command=%s\n' "${CLAUDE_COMMAND:-}"
    printf 'deepseek_harness_command=%s\n' "${DEEPSEEK_HARNESS_COMMAND:-}"
    printf 'rtk_command=%s\n' "${RTK_COMMAND:-}"
  } > "$tmp"
  mv "$tmp" "$LAZYDEV_STATE_FILE"
}

add_path_entry() {
  case ":${PATH:-}:" in *:"$1":*) ;; *) PATH="$1${PATH:+:$PATH}"; export PATH;; esac
}

refresh_path() {
  add_path_entry "$LAZYDEV_BIN_DIR"
  add_path_entry "$CODEX_BIN_DIR"
  add_path_entry "$RTK_BIN_DIR"
  add_path_entry "$KIMI_BIN_DIR"
  add_path_entry "$HOME/.local/bin"
}

ensure_python() {
  if find_cmd python3 python >/dev/null 2>&1; then return 0; fi
  if ! find_cmd uv >/dev/null 2>&1; then
    say 'Python not detected — installing standalone uv.'
    curl -fsSL https://astral.sh/uv/install.sh | sh || fatal 'Could not install uv.'
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
  fi
  find_cmd python3 python uv >/dev/null 2>&1 || fatal 'Python 3.10+ or uv is required.'
}

validate_source() {
  dir="$1"
  [ -f "$dir/package.json" ] || return 1
  [ -f "$dir/cli/lazydev.py" ] || return 1
  [ -f "$dir/runtime/lazydev-dev-mcp.py" ] || return 1
  [ -f "$dir/scripts/lazydev.mjs" ] || return 1
  [ -f "$dir/skills/lazy-developer/SKILL.md" ] || return 1
  [ -f "$dir/skills/lazy-debug/SKILL.md" ] || return 1
  [ -f "$dir/skills/lazy-review/SKILL.md" ] || return 1
  [ -f "$dir/skills/lazy-test/SKILL.md" ] || return 1
  grep -Fq 'lazydev resume' "$dir/cli/lazydev.py" || return 1
  grep -Fq 'return chat(resume=True)' "$dir/cli/lazydev.py" || return 1
  grep -Fq 'def find_kimi(' "$dir/cli/lazydev.py" || return 1
  grep -Fq 'def find_codex(' "$dir/cli/lazydev.py" || return 1
  grep -Fq 'def find_claude(' "$dir/cli/lazydev.py" || return 1
  return 0
}

install_lazydev() {
  archive="$TMP_DIR/lazydev.tar.gz"
  extract="$TMP_DIR/lazydev-source"
  stage="$TMP_DIR/lazydev-stage"
  mkdir -p "$extract" "$stage"
  step "Installing/updating Lazy Developer $LAZYDEV_VERSION"
  curl -fsSL --connect-timeout 20 --max-time 1800 --retry 6 --retry-delay 2 "$REPO_ARCHIVE_URL" -o "$archive" || fatal 'Could not download Lazy Developer from GitHub.'
  tar -xzf "$archive" -C "$extract" || fatal 'Could not unpack Lazy Developer archive.'
  source_dir="$(find "$extract" -mindepth 1 -maxdepth 2 -type f -name package.json -print | sed 's#/package.json$##' | head -n 1)"
  [ -n "$source_dir" ] || fatal 'Downloaded Lazy Developer source could not be located.'
  validate_source "$source_dir" || fatal 'Downloaded Lazy Developer source failed capability validation.'
  source_version="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$source_dir/package.json" | head -n 1)"
  [ "$source_version" = "$LAZYDEV_VERSION" ] || fatal "Repository version is $source_version; expected $LAZYDEV_VERSION."
  cp -R "$source_dir/." "$stage/"
  rm -rf "$stage/.git" "$stage/node_modules" 2>/dev/null || true
  find "$stage" -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true
  find "$stage" -type f -name '*.pyc' -delete 2>/dev/null || true
  printf '%s\n' "${REMOTE_REVISION:-unknown}" > "$stage/.lazydev-revision"
  mkdir -p "$(dirname "$LAZYDEV_HOME")" "$LAZYDEV_BIN_DIR"
  if [ -d "$LAZYDEV_HOME" ]; then rm -rf "$LAZYDEV_HOME.previous"; mv "$LAZYDEV_HOME" "$LAZYDEV_HOME.previous"; fi
  mv "$stage" "$LAZYDEV_HOME"
  cat > "$LAZYDEV_BIN_DIR/lazydev" <<EOF
#!/bin/sh
set -eu
LAZYDEV_ROOT="$LAZYDEV_HOME"
PYTHON_BIN="\$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)"
if [ -n "\$PYTHON_BIN" ]; then exec "\$PYTHON_BIN" "\$LAZYDEV_ROOT/cli/lazydev.py" "\$@"; fi
UV_BIN="\$(command -v uv 2>/dev/null || true)"
if [ -n "\$UV_BIN" ]; then exec "\$UV_BIN" run --no-project --python 3.13 "\$LAZYDEV_ROOT/cli/lazydev.py" "\$@"; fi
echo 'LazyDev requires Python 3.10+ or uv.' >&2
exit 1
EOF
  chmod 755 "$LAZYDEV_BIN_DIR/lazydev"
  rm -rf "$LAZYDEV_HOME.previous" 2>/dev/null || true
  refresh_path
  say "✓ Lazy Developer $LAZYDEV_VERSION ready"
}

install_rtk() {
  step RTK
  if RTK_COMMAND="$(find_rtk 2>/dev/null || true)"; then :; fi
  if [ -z "${RTK_COMMAND:-}" ]; then
    say 'RTK not found — installing the official Rust Token Killer.'
    mkdir -p "$RTK_BIN_DIR"
    curl -fsSL "$RTK_INSTALL_URL" | RTK_INSTALL_DIR="$RTK_BIN_DIR" RTK_TELEMETRY_DISABLED=1 sh || fatal 'RTK installation failed.'
    refresh_path
    RTK_COMMAND="$(find_rtk 2>/dev/null || true)"
  fi
  [ -n "$RTK_COMMAND" ] || fatal 'RTK did not install a usable launcher.'
  "$RTK_COMMAND" --version >/dev/null 2>&1 || fatal 'Installed RTK could not be executed.'
  RTK_CURRENT_VERSION="$(extract_semver "$(command_version "$RTK_COMMAND")")"
  say "✓ RTK ${RTK_CURRENT_VERSION:-installed} ready"
}

install_cliui_runtime() {
  if ! NODE_BIN="$(find_cmd node nodejs 2>/dev/null || true)"; then NODE_BIN=''; fi
  NPM_BIN="$(find_cmd npm 2>/dev/null || true)"
  if [ -z "$NODE_BIN" ] || [ -z "$NPM_BIN" ]; then
    say "CLI UI helper $LAZYDEV_UI_VERSION — skipped (Node.js/npm not available)."
    return 0
  fi
  pkg="$LAZYDEV_UI_HOME/node_modules/@poppinss/cliui/package.json"
  installed=''
  [ -f "$pkg" ] && installed="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$pkg" | head -n 1)"
  if [ "$installed" = "$LAZYDEV_UI_VERSION" ]; then
    say "CLI UI helper $LAZYDEV_UI_VERSION is already current — skipped."
    return 0
  fi
  step "Installing CLI UI helper $LAZYDEV_UI_VERSION"
  mkdir -p "$LAZYDEV_UI_HOME"
  cat > "$LAZYDEV_UI_HOME/package.json" <<EOF
{"name":"@blizps/lazydev-ui-runtime","private":true,"dependencies":{"$LAZYDEV_UI_PACKAGE":"$LAZYDEV_UI_VERSION"}}
EOF
  (cd "$LAZYDEV_UI_HOME" && "$NPM_BIN" install --no-package-lock --ignore-scripts --omit=dev) || {
    say 'CLI UI helper installation failed — native AI UIs remain available.'
    return 0
  }
  if [ -f "$LAZYDEV_HOME/runtime/lazydev-ui.mjs" ]; then cp "$LAZYDEV_HOME/runtime/lazydev-ui.mjs" "$LAZYDEV_UI_HOME/lazydev-ui.mjs"; fi
  say "✓ CLI UI helper $LAZYDEV_UI_VERSION ready"
}

install_official_script() {
  url="$1"; label="$2"; noninteractive="${3:-0}"
  script="$TMP_DIR/$(printf '%s' "$label" | tr '[:upper:] ' '[:lower:]-').sh"
  curl -fsSL "$url" -o "$script" || fatal "Could not download the $label installer."
  [ -s "$script" ] || fatal "The downloaded $label installer was empty."
  if [ "$noninteractive" -eq 1 ]; then CODEX_NON_INTERACTIVE=1 bash "$script" || fatal "$label installation failed."; else bash "$script" || fatal "$label installation failed."; fi
}

install_kimi() {
  step 'Installing/updating Kimi Code to the latest available release'
  install_official_script "$KIMI_INSTALL_URL" 'Kimi Code'
  refresh_path
  KIMI_COMMAND="$(find_kimi 2>/dev/null || true)"
  [ -n "$KIMI_COMMAND" ] || fatal 'Kimi Code did not install a usable launcher.'
  KIMI_CURRENT_VERSION="$(extract_semver "$(command_version "$KIMI_COMMAND")")"
  say "✓ Kimi Code ${KIMI_CURRENT_VERSION:-installed} ready"
}

install_codex() {
  step 'Installing/updating official Codex CLI'
  install_official_script "$CODEX_INSTALL_URL" 'Codex' 1
  refresh_path
  CODEX_COMMAND="$(find_codex 2>/dev/null || true)"
  [ -n "$CODEX_COMMAND" ] || fatal 'Codex did not install a usable launcher.'
  CODEX_CURRENT_VERSION="$(extract_semver "$(command_version "$CODEX_COMMAND")")"
  say "✓ Codex ${CODEX_CURRENT_VERSION:-installed} ready"
}

install_antigravity() {
  step 'Installing/updating official Antigravity CLI'
  install_official_script "$ANTIGRAVITY_INSTALL_URL" 'Antigravity'
  refresh_path
  AGY_COMMAND="$(find_antigravity 2>/dev/null || true)"
  [ -n "$AGY_COMMAND" ] || fatal 'Antigravity did not install a usable launcher.'
  AGY_CURRENT_VERSION="$(extract_semver "$(command_version "$AGY_COMMAND")")"
  say "✓ Antigravity CLI ${AGY_CURRENT_VERSION:-installed} ready"
}

install_claude() {
  step 'Installing/updating official Claude Code'
  install_official_script "$CLAUDE_INSTALL_URL" 'Claude Code'
  refresh_path
  CLAUDE_COMMAND="$(find_claude 2>/dev/null || true)"
  [ -n "$CLAUDE_COMMAND" ] || fatal 'Claude Code did not install a usable launcher.'
  CLAUDE_CURRENT_VERSION="$(extract_semver "$(command_version "$CLAUDE_COMMAND")")"
  say "✓ Claude Code ${CLAUDE_CURRENT_VERSION:-installed} ready"
}

install_deepseek_harness() {
  step "Installing/updating DeepSeek Harness $DEEPSEEK_HARNESS_TARGET_VERSION"
  NODE_BIN="$(find_cmd node nodejs 2>/dev/null || true)"
  NPM_BIN="$(find_cmd npm 2>/dev/null || true)"
  [ -n "$NODE_BIN" ] && [ -n "$NPM_BIN" ] || fatal 'DeepSeek Harness needs Node.js and npm.'
  mkdir -p "$DEEPSEEK_HARNESS_RUNTIME"
  cat > "$DEEPSEEK_HARNESS_RUNTIME/package.json" <<EOF
{"name":"@blizps/lazydev-deepseek-harness-runtime","private":true,"dependencies":{"$DEEPSEEK_HARNESS_PACKAGE":"$DEEPSEEK_HARNESS_TARGET_VERSION"}}
EOF
  (cd "$DEEPSEEK_HARNESS_RUNTIME" && "$NPM_BIN" install --no-package-lock --include=optional --omit=dev) || fatal 'DeepSeek Harness installation failed.'
  DEEPSEEK_HARNESS_COMMAND="$(find_deepseek_harness 2>/dev/null || true)"
  [ -n "$DEEPSEEK_HARNESS_COMMAND" ] || fatal 'DeepSeek Harness did not install a usable dsh launcher.'
  DEEPSEEK_HARNESS_CURRENT_VERSION="$(extract_semver "$(command_version "$DEEPSEEK_HARNESS_COMMAND")")"
  "$DEEPSEEK_HARNESS_COMMAND" web --help >/dev/null 2>&1 || fatal 'DeepSeek Harness Web UI runtime is incomplete.'
  say "✓ DeepSeek Harness ${DEEPSEEK_HARNESS_CURRENT_VERSION:-installed} ready"
}

check_component() {
  name="$1"; cmd="$2"; api="$3"; out="$4"
  current=''
  if [ -n "$cmd" ]; then current="$(extract_semver "$(command_version "$cmd")")"; fi
  latest=''
  [ -n "$api" ] && latest="$(latest_release_version "$api" "$out" || true)"
  printf '%s|%s\n' "$current" "$latest"
}

cleanup() { rm -rf "$TMP_DIR"; }
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/free-kimi-code.XXXXXX")" || fatal 'Unable to create a temporary directory.'
trap cleanup EXIT INT TERM

case "$(uname -s)" in Linux|Darwin) ;; *) fatal 'This installer supports Linux and macOS. Windows uses install.ps1.';; esac
require_command curl
require_command tar
require_command mktemp
refresh_path

REMOTE_REVISION="$(get_remote_revision || true)"
[ -n "$REMOTE_REVISION" ] || REMOTE_REVISION='unknown'

KIMI_COMMAND="$(find_kimi 2>/dev/null || true)"
CODEX_COMMAND="$(find_codex 2>/dev/null || true)"
AGY_COMMAND="$(find_antigravity 2>/dev/null || true)"
CLAUDE_COMMAND="$(find_claude 2>/dev/null || true)"
RTK_COMMAND="$(find_rtk 2>/dev/null || true)"
DEEPSEEK_HARNESS_COMMAND="$(find_deepseek_harness 2>/dev/null || true)"
KIMI_CURRENT_VERSION="$(extract_semver "$(command_version "$KIMI_COMMAND")")"
CODEX_CURRENT_VERSION="$(extract_semver "$(command_version "$CODEX_COMMAND")")"
AGY_CURRENT_VERSION="$(extract_semver "$(command_version "$AGY_COMMAND")")"
CLAUDE_CURRENT_VERSION="$(extract_semver "$(command_version "$CLAUDE_COMMAND")")"
RTK_CURRENT_VERSION="$(extract_semver "$(command_version "$RTK_COMMAND")")"
DEEPSEEK_HARNESS_CURRENT_VERSION="$(extract_semver "$(command_version "$DEEPSEEK_HARNESS_COMMAND")")"

KIMI_LATEST_VERSION="$(latest_kimi_version || true)"
CODEX_LATEST_VERSION="$(latest_codex_version || true)"
AGY_LATEST_VERSION="$(latest_antigravity_version || true)"

KIMI_UPDATE_AVAILABLE=0; CODEX_UPDATE_AVAILABLE=0; AGY_UPDATE_AVAILABLE=0; CLAUDE_UPDATE_AVAILABLE=0; DEEPSEEK_HARNESS_UPDATE_AVAILABLE=0
RTK_NEEDS_UPDATE=0; LAZYDEV_NEEDS_UPDATE=1

if [ -z "$KIMI_COMMAND" ]; then KIMI_UPDATE_AVAILABLE=1; say 'Kimi Code not found — installation available.'
elif [ -n "$KIMI_LATEST_VERSION" ] && [ -n "$KIMI_CURRENT_VERSION" ] && ! version_at_least "$KIMI_CURRENT_VERSION" "$KIMI_LATEST_VERSION"; then KIMI_UPDATE_AVAILABLE=1; say "Kimi Code $KIMI_CURRENT_VERSION → $KIMI_LATEST_VERSION — update available."; else say "Kimi Code ${KIMI_CURRENT_VERSION:-installed} is current — skipped."; fi
if [ -z "$CODEX_COMMAND" ]; then CODEX_UPDATE_AVAILABLE=1; say 'Codex not found — installation available.'
elif [ -n "$CODEX_LATEST_VERSION" ] && [ -n "$CODEX_CURRENT_VERSION" ] && ! version_at_least "$CODEX_CURRENT_VERSION" "$CODEX_LATEST_VERSION"; then CODEX_UPDATE_AVAILABLE=1; say "Codex $CODEX_CURRENT_VERSION → $CODEX_LATEST_VERSION — update available."; else say "Codex ${CODEX_CURRENT_VERSION:-installed} is current — skipped."; fi
if [ -z "$AGY_COMMAND" ]; then AGY_UPDATE_AVAILABLE=1; say 'Antigravity CLI not found — installation available.'
elif [ -n "$AGY_LATEST_VERSION" ] && [ -n "$AGY_CURRENT_VERSION" ] && ! version_at_least "$AGY_CURRENT_VERSION" "$AGY_LATEST_VERSION"; then AGY_UPDATE_AVAILABLE=1; say "Antigravity CLI $AGY_CURRENT_VERSION → $AGY_LATEST_VERSION — update available."; else say "Antigravity CLI ${AGY_CURRENT_VERSION:-installed} is current — skipped."; fi
if [ -z "$CLAUDE_COMMAND" ]; then CLAUDE_UPDATE_AVAILABLE=1; say 'Claude Code not found — installation available.'; else CLAUDE_UPDATE_AVAILABLE=1; fi
if [ -z "$DEEPSEEK_HARNESS_COMMAND" ]; then DEEPSEEK_HARNESS_UPDATE_AVAILABLE=1; say 'DeepSeek Harness not found — installation available.'; else DEEPSEEK_HARNESS_UPDATE_AVAILABLE=1; fi
if [ -z "$RTK_COMMAND" ]; then RTK_NEEDS_UPDATE=1; fi
if [ -f "$LAZYDEV_HOME/package.json" ] && [ -x "$LAZYDEV_BIN_DIR/lazydev" ] && [ -f "$LAZYDEV_HOME/.lazydev-revision" ]; then
  current_revision="$(tr -d '[:space:]' < "$LAZYDEV_HOME/.lazydev-revision")"
  installed_version="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$LAZYDEV_HOME/package.json" | head -n 1)"
  if [ "$installed_version" = "$LAZYDEV_VERSION" ] && [ "$current_revision" = "$REMOTE_REVISION" ]; then LAZYDEV_NEEDS_UPDATE=0; say "Lazy Developer $LAZYDEV_VERSION is already current — skipped."; fi
fi

INSTALL_KIMI=0; INSTALL_CODEX=0; INSTALL_ANTIGRAVITY=0; INSTALL_CLAUDE=0; INSTALL_DEEPSEEK_HARNESS=0
if [ "$KIMI_UPDATE_AVAILABLE" -eq 1 ] && ask_install_ui 'Install/update Kimi Code?'; then INSTALL_KIMI=1; else KIMI_UPDATE_AVAILABLE=0; fi
if [ "$CODEX_UPDATE_AVAILABLE" -eq 1 ] && ask_install_ui 'Install/update Codex?'; then INSTALL_CODEX=1; else CODEX_UPDATE_AVAILABLE=0; fi
if [ "$AGY_UPDATE_AVAILABLE" -eq 1 ] && ask_install_ui 'Install/update Antigravity?'; then INSTALL_ANTIGRAVITY=1; else AGY_UPDATE_AVAILABLE=0; fi
if [ "$CLAUDE_UPDATE_AVAILABLE" -eq 1 ] && ask_install_ui 'Install/update Claude Code?'; then INSTALL_CLAUDE=1; else CLAUDE_UPDATE_AVAILABLE=0; fi
if [ "$DEEPSEEK_HARNESS_UPDATE_AVAILABLE" -eq 1 ] && ask_install_ui 'Install/update DeepSeek Harness?'; then INSTALL_DEEPSEEK_HARNESS=1; else DEEPSEEK_HARNESS_UPDATE_AVAILABLE=0; fi

clear 2>/dev/null || true
install_rtk
ensure_python
if [ "$LAZYDEV_NEEDS_UPDATE" -ne 0 ]; then install_lazydev; else say 'Lazy Developer setup — skipped. Configure providers later with: lazydev setup'; fi
install_cliui_runtime

if [ "$INSTALL_KIMI" -eq 1 ]; then install_kimi; fi
if [ "$INSTALL_CODEX" -eq 1 ]; then install_codex; fi
if [ "$INSTALL_ANTIGRAVITY" -eq 1 ]; then install_antigravity; fi
if [ "$INSTALL_CLAUDE" -eq 1 ]; then install_claude; fi
if [ "$INSTALL_DEEPSEEK_HARNESS" -eq 1 ]; then install_deepseek_harness; fi

refresh_path
if [ -n "${KIMI_COMMAND:-}" ] && [ -n "${RTK_COMMAND:-}" ]; then
  step 'Connecting RTK to Kimi Code'
  mkdir -p "${LAZYDEV_CONFIG_DIR}/kimi-code"
  (cd "${LAZYDEV_CONFIG_DIR}/kimi-code" && RTK_TELEMETRY_DISABLED=1 "$RTK_COMMAND" init --agent kimi --auto-patch) || fatal 'RTK Kimi integration failed.'
  say '✓ RTK is connected to Kimi Code'
fi

if [ -z "${KIMI_COMMAND:-}" ]; then KIMI_DISPLAY_FINAL='unknown'; else KIMI_DISPLAY_FINAL="${KIMI_CURRENT_VERSION:-installed}"; fi
if [ -z "${RTK_COMMAND:-}" ]; then RTK_DISPLAY_FINAL='unknown'; else RTK_DISPLAY_FINAL="${RTK_CURRENT_VERSION:-installed}"; fi
write_state
say ''
say 'Lazy Developer installer finished.'
say "Kimi Code: $KIMI_DISPLAY_FINAL"
say "RTK: $RTK_DISPLAY_FINAL"
say "Lazy Developer: $LAZYDEV_VERSION"
say 'Existing Kimi sessions and configuration were left in place.'
say ''
say 'Provider setup is intentionally separate and was not run by the installer.'
say 'Claude Code and DeepSeek Harness use the configured LazyDev local route when launched from lazydev chat.'
say 'Next:'
say '  lazydev setup'
say '  lazydev chat'
say '  lazydev resume'
