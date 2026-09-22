#!/bin/sh
set -eu
REPO="BlizPS/free-kimi-code"
BRANCH="${LAZYDEV_BRANCH:-main}"
LAZYDEV_LOCAL_SOURCE_DIR="${LAZYDEV_SOURCE_DIR:-}"
if [ -z "$LAZYDEV_LOCAL_SOURCE_DIR" ] && [ -n "${0:-}" ] && [ -f "${0:-}" ]; then LAZYDEV_SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" 2>/dev/null && pwd -P 2>/dev/null || true)"; if [ -f "$LAZYDEV_SCRIPT_DIR/package.json" ] && [ -f "$LAZYDEV_SCRIPT_DIR/cli/lazydev.py" ]; then LAZYDEV_LOCAL_SOURCE_DIR="$LAZYDEV_SCRIPT_DIR"; fi; fi
LAZYDEV_VERSION="1.0.3"
KIMI_INSTALL_URL="https://code.kimi.com/kimi-code/install.sh"
ANTIGRAVITY_INSTALL_URL="https://antigravity.google/cli/install.sh"
CLAUDE_INSTALL_URL="https://claude.ai/install.sh"
DEEPSEEK_HARNESS_PACKAGE="@deepseek-ai/dsh"
DEEPSEEK_HARNESS_DESKTOP_VERSION="${LAZYDEV_DSH_VERSION:-0.1.5-rc.2}"
DEEPSEEK_HARNESS_TERMUX_VERSION="0.1.2-rc.1"
DEEPSEEK_HARNESS_RUNTIME="${LAZYDEV_DSH_RUNTIME:-${XDG_DATA_HOME:-$HOME/.local/share}/lazydev/deepseek-harness-runtime}"
KIMI_RELEASE_API_URL="https://api.github.com/repos/MoonshotAI/kimi-code/releases/latest"
CODEX_RELEASE_API_URL="https://api.github.com/repos/openai/codex/releases/latest"
CODEX_INSTALL_URL="https://chatgpt.com/codex/install.sh"
ANTIGRAVITY_RELEASE_API_URL="https://api.github.com/repos/google-antigravity/antigravity-cli/releases/latest"
RTK_INSTALL_URL="https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh"
REPO_ARCHIVE_URL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"
GITHUB_API_URL="https://api.github.com/repos/${REPO}/commits/${BRANCH}"
LAZYDEV_HOME="${LAZYDEV_HOME:-$HOME/.local/share/lazydev}"
LAZYDEV_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}/lazydev"
LAZYDEV_STATE_FILE="$LAZYDEV_STATE_HOME/install-state"
LAZYDEV_STATE_BACKUP_FILE="$LAZYDEV_STATE_FILE.bak"
LAZYDEV_CLI_REGISTRY_FILE="$LAZYDEV_STATE_HOME/cli-paths"
LAZYDEV_CLI_REGISTRY_BACKUP_FILE="$LAZYDEV_CLI_REGISTRY_FILE.bak"
LAZYDEV_BIN_DIR="${LAZYDEV_BIN_DIR:-}"
KIMI_BIN_DIR="${KIMI_BIN_DIR:-${KIMI_CODE_HOME:-$HOME/.kimi-code}/bin}"
LAZYDEV_STATE_LOADED=0
LAZYDEV_NEEDS_UPDATE=1
LAZYDEV_FEATURE_REFRESH=0
LAZYDEV_INSTALL_COMPLETE=0
CURRENT_LAZY_VERSION=""
CURRENT_LAZY_REVISION=""
REMOTE_REVISION=""
LAZYDEV_STATUS_MESSAGE=""
TERMUX_LINUX=0
case "${PREFIX:-}" in
  */com.termux/files/usr) TERMUX_LINUX=1 ;;
  */com.termux/files/usr/) TERMUX_LINUX=1 ;;
esac
if [ "${TERMUX_VERSION:-}" != "" ]; then TERMUX_LINUX=1; fi
ANDROID_HOST=0
if uname -o 2>/dev/null | grep -qi '^android$' || uname -a 2>/dev/null | grep -qi 'android'; then ANDROID_HOST=1; fi
if [ -e /system/bin/getprop ] && [ -e /data/data/com.termux/files/usr ]; then ANDROID_HOST=1; fi
ANDROID_TERMUX=0
if [ "$ANDROID_HOST" -eq 1 ] && { [ "$TERMUX_LINUX" -eq 1 ] || [ -e /data/data/com.termux/files/usr ]; }; then ANDROID_TERMUX=1; fi
if [ -n "${LAZYDEV_BIN_DIR:-}" ]; then : # Explicit caller override wins.
elif [ -f "$LAZYDEV_STATE_FILE" ]; then saved_bin_dir="$(sed -n 's/^bin_dir=//p' "$LAZYDEV_STATE_FILE" | head -n 1)"; saved_kimi_bin="$(sed -n 's/^kimi_bin_dir=//p' "$LAZYDEV_STATE_FILE" | head -n 1)"; if [ -n "$saved_bin_dir" ]; then LAZYDEV_BIN_DIR="$saved_bin_dir"; LAZYDEV_STATE_LOADED=1; fi; case "$saved_kimi_bin" in /*) [ -n "$saved_kimi_bin" ] && KIMI_BIN_DIR="$saved_kimi_bin";; esac; fi
if [ -z "${LAZYDEV_BIN_DIR:-}" ]; then for candidate in "$HOME/.local/share/lazydev/bin" "$HOME/.local/share/lazydev" "$HOME/.local/bin"; do if [ -x "$candidate/lazydev" ] || [ -x "$candidate/rtk" ] || [ -x "$candidate/codex" ] || [ -x "$candidate/codex.bin" ]; then LAZYDEV_BIN_DIR="$candidate"; break; fi; done; fi
if [ -z "${LAZYDEV_BIN_DIR:-}" ] && [ -n "${PREFIX:-}" ]; then candidate="$PREFIX/bin"; if [ -x "$candidate/lazydev" ] || [ -x "$candidate/rtk" ] || [ -x "$candidate/codex" ] || [ -x "$candidate/codex.bin" ]; then LAZYDEV_BIN_DIR="$candidate"; fi; fi
if [ -z "${LAZYDEV_BIN_DIR:-}" ]; then if [ "$TERMUX_LINUX" -eq 1 ]; then LAZYDEV_BIN_DIR="${PREFIX:-$HOME/.local}/bin"; else LAZYDEV_BIN_DIR="$HOME/.local/bin"; fi; fi
if [ "$(uname -s)" = "Darwin" ]; then LAZYDEV_CONFIG_DIR="${LAZYDEV_CONFIG_DIR:-$HOME/Library/Application Support/lazydev}"
else LAZYDEV_CONFIG_DIR="${LAZYDEV_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/lazydev}"; fi
KIMI_RUNTIME_HOME="${LAZYDEV_CONFIG_DIR}/kimi-code"
LAZYDEV_UI_HOME="${LAZYDEV_UI_RUNTIME:-$LAZYDEV_CONFIG_DIR/ui-runtime}"
LAZYDEV_UI_PACKAGE="@poppinss/cliui"
LAZYDEV_UI_VERSION="6.8.1"
say() { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
fatal() { printf 'error: %s\n' "$*" >&2; exit 1; }
case "$(uname -s)" in
  Darwin|Linux) ;;
  *) fatal "This installer supports macOS and Linux. Windows uses install.ps1." ;;
esac
command -v curl >/dev/null 2>&1 || fatal "curl is required."
command -v tar >/dev/null 2>&1 || fatal "tar is required."
command -v mktemp >/dev/null 2>&1 || fatal "mktemp is required."
UV_INSTALL_URL="https://astral.sh/uv/install.sh"
ensure_python_runner() { if command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1; then return 0; fi; if ! command -v uv >/dev/null 2>&1; then say "Python not detected — installing standalone uv as the Python bootstrapper."; curl -fsSL "$UV_INSTALL_URL" | sh; export PATH="$HOME/.local/bin:$HOME/.cargo/bin:${PATH:-}"; fi; command -v uv >/dev/null 2>&1 || fatal "Could not install uv for the native Python LazyDev CLI."; }
version_at_least() {
  current="$1"; required="$2"
  awk -v c="$current" -v r="$required" '
    function v(s,a){ n=split(s,a,"."); return (a[1]+0)*1000000 + (a[2]+0)*1000 + (a[3]+0) }
    BEGIN { gsub(/^v/,"",c); gsub(/^v/,"",r); exit !(v(c) >= v(r)) }
  '
}
extract_semver() { printf '%s\n' "$1" | sed -n 's/.*\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' | head -n 1; }
get_kimi_latest_version() { response="$TMP_DIR/kimi-release.json"; if curl -fsSL -H 'Accept: application/vnd.github+json' -H 'User-Agent: lazy-developer-installer/1.0.3' "$KIMI_RELEASE_API_URL" -o "$response" 2>/dev/null; then tag_line="$(grep -m1 -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' "$response" 2>/dev/null || true)"; version="$(printf '%s\n' "$tag_line" | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | tail -n 1 || true)"; if [ -n "$version" ]; then printf '%s\n' "$version"; return 0; fi; fi; url="$(curl -fsSL -o /dev/null -w '%{url_effective}' 'https://github.com/MoonshotAI/kimi-code/releases/latest' 2>/dev/null || true)"; printf '%s\n' "$url" | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | tail -n 1; }
get_github_release_version() { api_url="$1"; response_file="$2"; if curl -fsSL --http1.1 --connect-timeout 10 --max-time 30 --retry 4 --retry-delay 1 -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' -H 'User-Agent: lazy-developer-installer/1.0.3' "$api_url" -o "$response_file" 2>/dev/null; then tag_line="$(grep -m1 -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' "$response_file" 2>/dev/null || true)"; printf '%s\n' "$tag_line" | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | tail -n 1; fi; }
get_codex_latest_version() { get_github_release_version "$CODEX_RELEASE_API_URL" "$TMP_DIR/codex-release.json"; }
codex_release_target() { os="$(uname -s)"; arch="$(uname -m)"
  case "$os:$arch" in
    Linux:aarch64|Linux:arm64) printf '%s\n' 'aarch64-unknown-linux-musl' ;;
    Linux:x86_64|Linux:amd64) printf '%s\n' 'x86_64-unknown-linux-musl' ;;
    Darwin:arm64|Darwin:aarch64) printf '%s\n' 'aarch64-apple-darwin' ;;
    Darwin:x86_64|Darwin:amd64) printf '%s\n' 'x86_64-apple-darwin' ;;
    *) return 1 ;;
  esac
}
sha256_file() { file="$1"; if command -v sha256sum >/dev/null 2>&1; then sha256sum "$file" | awk '{print $1}'; return 0; fi; if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$file" | awk '{print $1}'; return 0; fi; if command -v openssl >/dev/null 2>&1; then openssl dgst -sha256 "$file" | sed -n 's/.*= \([0-9A-Fa-f]*\)$/\1/p'; return 0; fi; return 1; }
lazydev_source_is_current() { source_dir="$1"; [ -f "$source_dir/cli/lazydev.py" ] || return 1; [ -f "$source_dir/scripts/lazydev.mjs" ] || return 1; grep -Fq 'lazydev resume' "$source_dir/cli/lazydev.py" 2>/dev/null || return 1; grep -Eq "if[[:space:]]+cmd[[:space:]]*==[[:space:]]*[\"']resume[\"']:" "$source_dir/cli/lazydev.py" 2>/dev/null || return 1; grep -Fq 'return chat(resume=True)' "$source_dir/cli/lazydev.py" 2>/dev/null || return 1; grep -Fq 'def _discover_command(' "$source_dir/cli/lazydev.py" 2>/dev/null || return 1; grep -Fq 'def _resolve_from_dirs(' "$source_dir/cli/lazydev.py" 2>/dev/null || return 1; grep -Fq 'def _managed_which(' "$source_dir/cli/lazydev.py" 2>/dev/null || return 1; grep -Fq 'def find_kimi(' "$source_dir/cli/lazydev.py" 2>/dev/null || return 1; grep -Fq 'def find_codex(' "$source_dir/cli/lazydev.py" 2>/dev/null || return 1; grep -Fq 'def find_antigravity(' "$source_dir/cli/lazydev.py" 2>/dev/null || return 1; grep -Fq 'def find_claude(' "$source_dir/cli/lazydev.py" 2>/dev/null || return 1; grep -Fq 'response.output_item.done' "$source_dir/cli/lazydev.py" 2>/dev/null || return 1; grep -Fq '_lazydev_dev_mcp_entry' "$source_dir/cli/lazydev.py" 2>/dev/null || return 1; [ -f "$source_dir/runtime/lazydev-dev-mcp.py" ] || return 1; ! grep -Eq "cmd[[:space:]]*===[[:space:]]*[\"']sessions[\"']" "$source_dir/scripts/lazydev.mjs" 2>/dev/null || return 1; ! grep -Eq "[\"']--config[\"']" "$source_dir/cli/lazydev.py" 2>/dev/null || return 1; return 0; }
resilient_download() { url="$1"; output="$2"; mkdir -p "$(dirname "$output")"; common_args='-fL --connect-timeout 20 --max-time 1800 --retry 8 --retry-delay 2 --retry-max-time 1800 --speed-time 90 --speed-limit 1024 --http1.1'; if curl --help all 2>/dev/null | grep -q -- '--retry-all-errors'; then common_args="$common_args --retry-all-errors"; fi; if [ -f "$output" ] && [ -s "$output" ]; then if curl $common_args -C - "$url" -o "$output"; then return 0; fi; else if curl $common_args "$url" -o "$output"; then return 0; fi; fi; if [ -f "$output" ] && [ -s "$output" ]; then if curl $common_args -4 -C - "$url" -o "$output"; then return 0; fi; else if curl $common_args -4 "$url" -o "$output"; then return 0; fi; fi; if command -v wget >/dev/null 2>&1; then if [ -f "$output" ] && [ -s "$output" ]; then if wget -q --tries=8 --timeout=90 --continue -O "$output" "$url"; then return 0; fi; else if wget -q --tries=8 --timeout=90 -O "$output" "$url"; then return 0; fi; fi; fi; return 1; }
install_codex_official() { version="$1"; [ -n "$version" ] || fatal "Could not resolve the official Codex release version."; script="$TMP_DIR/codex-install.sh"; log="$TMP_DIR/codex-install.log"; say "Codex $version · official installer"; curl -fsSL "$CODEX_INSTALL_URL" -o "$script" || fatal "Could not download the official Codex installer."; if ! sh "$script" >"$log" 2>&1; then cat "$log" >&2 || true; fatal "Codex official installer failed."; fi; cat "$log"; }
get_antigravity_latest_version() { get_github_release_version "$ANTIGRAVITY_RELEASE_API_URL" "$TMP_DIR/antigravity-release.json"; }
get_rtk_latest_version() { url="$(curl -fsSL -o /dev/null -w '%{url_effective}' 'https://github.com/rtk-ai/rtk/releases/latest' 2>/dev/null || true)"; version="$(printf '%s\n' "$url" | sed -n 's#.*/tag/v\{0,1\}\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*#\1#p' | head -n 1)"; if [ -n "$version" ]; then printf '%s\n' "$version"; return 0; fi; response="$TMP_DIR/rtk-release.json"; get_github_release_version "https://api.github.com/repos/rtk-ai/rtk/releases/latest" "$response"; }
get_remote_revision() { response_file="$TMP_DIR/lazydev-commit.json"; if curl -fsSL -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' -H 'User-Agent: lazy-developer-installer/1.0.3' "$GITHUB_API_URL" -o "$response_file" 2>/dev/null; then grep -m1 -o '"sha"[[:space:]]*:[[:space:]]*"[0-9a-fA-F]\{40\}"' "$response_file" 2>/dev/null | sed -n 's/.*"sha"[[:space:]]*:[[:space:]]*"\([0-9a-fA-F]\{40\}\)".*/\1/p' | head -n 1; fi; }
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t lazydev)"
DEFAULT_EXTERNAL_BIN_DIR="${LAZYDEV_EXTERNAL_BIN_DIR:-$HOME/.local/bin}"
RTK_BIN_DIR="${RTK_BIN_DIR:-$DEFAULT_EXTERNAL_BIN_DIR}"
CODEX_BIN_DIR="${CODEX_BIN_DIR:-$DEFAULT_EXTERNAL_BIN_DIR}"
SAVED_RTK_COMMAND=""
SAVED_CODEX_COMMAND=""
SAVED_KIMI_COMMAND=""
SAVED_AGY_COMMAND=""
SAVED_CLAUDE_COMMAND=""
SAVED_DEEPSEEK_HARNESS_COMMAND=""
SAVED_UI_RUNTIME_DIR=""
SAVED_LAZYDEV_COMMAND=""
load_install_state() { SAVED_RTK_COMMAND=""; SAVED_CODEX_COMMAND=""; SAVED_KIMI_COMMAND=""; SAVED_AGY_COMMAND=""; SAVED_CLAUDE_COMMAND=""; SAVED_DEEPSEEK_HARNESS_COMMAND=""; SAVED_UI_RUNTIME_DIR=""; SAVED_LAZYDEV_COMMAND=""; read_state_value() { file="$1"; key="$2"; [ -f "$file" ] || return 0; sed -n "s/^${key}=//p" "$file" 2>/dev/null | head -n 1; }; primary_rtk="$(read_state_value "$LAZYDEV_STATE_FILE" rtk_command)"; backup_rtk="$(read_state_value "$LAZYDEV_STATE_BACKUP_FILE" rtk_command)"; registry_rtk="$(read_state_value "$LAZYDEV_CLI_REGISTRY_FILE" rtk_command)"; registry_backup_rtk="$(read_state_value "$LAZYDEV_CLI_REGISTRY_BACKUP_FILE" rtk_command)"; primary_codex="$(read_state_value "$LAZYDEV_STATE_FILE" codex_command)"; backup_codex="$(read_state_value "$LAZYDEV_STATE_BACKUP_FILE" codex_command)"; registry_codex="$(read_state_value "$LAZYDEV_CLI_REGISTRY_FILE" codex_command)"; registry_backup_codex="$(read_state_value "$LAZYDEV_CLI_REGISTRY_BACKUP_FILE" codex_command)"; primary_kimi="$(read_state_value "$LAZYDEV_STATE_FILE" kimi_command)"; backup_kimi="$(read_state_value "$LAZYDEV_STATE_BACKUP_FILE" kimi_command)"; registry_kimi="$(read_state_value "$LAZYDEV_CLI_REGISTRY_FILE" kimi_command)"; registry_backup_kimi="$(read_state_value "$LAZYDEV_CLI_REGISTRY_BACKUP_FILE" kimi_command)"; primary_agy="$(read_state_value "$LAZYDEV_STATE_FILE" antigravity_command)"; backup_agy="$(read_state_value "$LAZYDEV_STATE_BACKUP_FILE" antigravity_command)"; registry_agy="$(read_state_value "$LAZYDEV_CLI_REGISTRY_FILE" antigravity_command)"; registry_backup_agy="$(read_state_value "$LAZYDEV_CLI_REGISTRY_BACKUP_FILE" antigravity_command)"; primary_claude="$(read_state_value "$LAZYDEV_STATE_FILE" claude_command)"; backup_claude="$(read_state_value "$LAZYDEV_STATE_BACKUP_FILE" claude_command)"; registry_claude="$(read_state_value "$LAZYDEV_CLI_REGISTRY_FILE" claude_command)"; registry_backup_claude="$(read_state_value "$LAZYDEV_CLI_REGISTRY_BACKUP_FILE" claude_command)"; primary_dsh="$(read_state_value "$LAZYDEV_STATE_FILE" deepseek_harness_command)"; backup_dsh="$(read_state_value "$LAZYDEV_STATE_BACKUP_FILE" deepseek_harness_command)"; registry_dsh="$(read_state_value "$LAZYDEV_CLI_REGISTRY_FILE" deepseek_harness_command)"; registry_backup_dsh="$(read_state_value "$LAZYDEV_CLI_REGISTRY_BACKUP_FILE" deepseek_harness_command)"; SAVED_RTK_COMMAND="${primary_rtk:-${backup_rtk:-${registry_rtk:-$registry_backup_rtk}}}"; SAVED_CODEX_COMMAND="${primary_codex:-${backup_codex:-${registry_codex:-$registry_backup_codex}}}"; SAVED_KIMI_COMMAND="${primary_kimi:-${backup_kimi:-${registry_kimi:-$registry_backup_kimi}}}"; SAVED_AGY_COMMAND="${primary_agy:-${backup_agy:-${registry_agy:-$registry_backup_agy}}}"; SAVED_CLAUDE_COMMAND="${primary_claude:-${backup_claude:-${registry_claude:-$registry_backup_claude}}}"; SAVED_DEEPSEEK_HARNESS_COMMAND="${primary_dsh:-${backup_dsh:-${registry_dsh:-$registry_backup_dsh}}}"; SAVED_UI_RUNTIME_DIR="$(read_state_value "$LAZYDEV_STATE_FILE" ui_runtime_dir)"; [ -n "$SAVED_UI_RUNTIME_DIR" ] || SAVED_UI_RUNTIME_DIR="$(read_state_value "$LAZYDEV_STATE_BACKUP_FILE" ui_runtime_dir)"; SAVED_LAZYDEV_COMMAND="$(read_state_value "$LAZYDEV_STATE_FILE" lazydev_command)"; [ -n "$SAVED_LAZYDEV_COMMAND" ] || SAVED_LAZYDEV_COMMAND="$(read_state_value "$LAZYDEV_STATE_BACKUP_FILE" lazydev_command)"; saved_rtk_bin="$(read_state_value "$LAZYDEV_STATE_FILE" rtk_bin_dir)"; [ -n "$saved_rtk_bin" ] || saved_rtk_bin="$(read_state_value "$LAZYDEV_STATE_BACKUP_FILE" rtk_bin_dir)"; saved_codex_bin="$(read_state_value "$LAZYDEV_STATE_FILE" codex_bin_dir)"; [ -n "$saved_codex_bin" ] || saved_codex_bin="$(read_state_value "$LAZYDEV_STATE_BACKUP_FILE" codex_bin_dir)"; saved_kimi_bin="$(read_state_value "$LAZYDEV_STATE_FILE" kimi_bin_dir)"; [ -n "$saved_kimi_bin" ] || saved_kimi_bin="$(read_state_value "$LAZYDEV_STATE_BACKUP_FILE" kimi_bin_dir)"; if [ -n "$SAVED_RTK_COMMAND" ] && [ -d "$SAVED_RTK_COMMAND" ] && [ -x "$SAVED_RTK_COMMAND/rtk" ]; then SAVED_RTK_COMMAND="$SAVED_RTK_COMMAND/rtk"; fi; if [ -n "$saved_rtk_bin" ] && [ -d "$saved_rtk_bin" ] && [ -x "$saved_rtk_bin/rtk" ] && [ -z "$SAVED_RTK_COMMAND" ]; then SAVED_RTK_COMMAND="$saved_rtk_bin/rtk"; fi; case "$saved_rtk_bin" in /*) [ -n "$saved_rtk_bin" ] && RTK_BIN_DIR="$saved_rtk_bin";; esac; case "$saved_codex_bin" in /*) [ -n "$saved_codex_bin" ] && CODEX_BIN_DIR="$saved_codex_bin";; esac; case "$saved_kimi_bin" in /*) [ -n "$saved_kimi_bin" ] && KIMI_BIN_DIR="$saved_kimi_bin";; esac; if [ -z "${LAZYDEV_UI_RUNTIME:-}" ] && [ -n "$SAVED_UI_RUNTIME_DIR" ]; then LAZYDEV_UI_HOME="$SAVED_UI_RUNTIME_DIR"; fi; }
write_cli_registry() { rtk="$1"; codex="$2"; kimi="$3"; agy="$4"; claude="$5"; dsh="${6:-}"; mkdir -p "$LAZYDEV_STATE_HOME" 2>/dev/null || return 0; tmp="$LAZYDEV_CLI_REGISTRY_FILE.$$"; { printf 'version=1\n'; printf 'rtk_command=%s\n' "$rtk"; printf 'codex_command=%s\n' "$codex"; printf 'kimi_command=%s\n' "$kimi"; printf 'antigravity_command=%s\n' "$agy"; printf 'claude_command=%s\n' "$claude"; printf 'deepseek_harness_command=%s\n' "$dsh"; } > "$tmp" || { rm -f "$tmp" 2>/dev/null || true; return 0; }; if [ -s "$LAZYDEV_CLI_REGISTRY_FILE" ]; then cp -f "$LAZYDEV_CLI_REGISTRY_FILE" "$LAZYDEV_CLI_REGISTRY_BACKUP_FILE" 2>/dev/null || true; fi; mv -f "$tmp" "$LAZYDEV_CLI_REGISTRY_FILE" 2>/dev/null || rm -f "$tmp" 2>/dev/null || true; }
write_install_state() { mkdir -p "$LAZYDEV_STATE_HOME" 2>/dev/null || return 0; state_kimi_command="${KIMI_COMMAND:-$SAVED_KIMI_COMMAND}"; state_codex_command="${CODEX_COMMAND:-$SAVED_CODEX_COMMAND}"; state_agy_command="${AGY_COMMAND:-$SAVED_AGY_COMMAND}"; state_claude_command="${CLAUDE_COMMAND:-$SAVED_CLAUDE_COMMAND}"; state_dsh_command="${DEEPSEEK_HARNESS_COMMAND:-$SAVED_DEEPSEEK_HARNESS_COMMAND}"; state_rtk_command="${RTK_COMMAND:-$SAVED_RTK_COMMAND}"; if [ -n "$state_rtk_command" ] && [ -d "$state_rtk_command" ] && [ -x "$state_rtk_command/rtk" ]; then state_rtk_command="$state_rtk_command/rtk"; fi; case "$state_rtk_command" in "$LAZYDEV_HOME"/*) state_rtk_command="" ;; esac; case "$state_codex_command" in "$LAZYDEV_HOME"/*) state_codex_command="" ;; esac; state_rtk_bin="${RTK_BIN_DIR:-$DEFAULT_EXTERNAL_BIN_DIR}"; state_codex_bin="${CODEX_BIN_DIR:-$DEFAULT_EXTERNAL_BIN_DIR}"; case "$state_rtk_bin" in "$LAZYDEV_HOME"|"$LAZYDEV_HOME"/*) state_rtk_bin="$DEFAULT_EXTERNAL_BIN_DIR" ;; esac; case "$state_codex_bin" in "$LAZYDEV_HOME"|"$LAZYDEV_HOME"/*) state_codex_bin="$DEFAULT_EXTERNAL_BIN_DIR" ;; esac; tmp="$LAZYDEV_STATE_FILE.$$"; { printf 'version=6\n'; printf 'bin_dir=%s\n' "$LAZYDEV_BIN_DIR"; printf 'lazydev_command=%s\n' "${LAZYDEV_BIN_DIR:-$DEFAULT_EXTERNAL_BIN_DIR}/lazydev"; printf 'kimi_bin_dir=%s\n' "${KIMI_BIN_DIR:-${KIMI_CODE_HOME:-$HOME/.kimi-code}/bin}"; printf 'rtk_bin_dir=%s\n' "$state_rtk_bin"; printf 'codex_bin_dir=%s\n' "$state_codex_bin"; printf 'kimi_command=%s\n' "$state_kimi_command"; printf 'codex_command=%s\n' "$state_codex_command"; printf 'antigravity_command=%s\n' "$state_agy_command"; printf 'claude_command=%s\n' "$state_claude_command"; printf 'deepseek_harness_command=%s\n' "$state_dsh_command"; printf 'rtk_command=%s\n' "$state_rtk_command"; printf 'ui_runtime_dir=%s\n' "${LAZYDEV_UI_HOME:-}"; } > "$tmp" || { rm -f "$tmp" 2>/dev/null || true; return 0; }; if [ -s "$LAZYDEV_STATE_FILE" ]; then cp -f "$LAZYDEV_STATE_FILE" "$LAZYDEV_STATE_BACKUP_FILE" 2>/dev/null || true; fi; mv -f "$tmp" "$LAZYDEV_STATE_FILE" 2>/dev/null || rm -f "$tmp" 2>/dev/null || true; write_cli_registry "$state_rtk_command" "$state_codex_command" "$state_kimi_command" "$state_agy_command" "$state_claude_command" "$state_dsh_command"; }
load_install_state
if [ -x "$CODEX_BIN_DIR/codex" ] && [ "${SAVED_CODEX_COMMAND:-}" = "$CODEX_BIN_DIR/codex.bin" ]; then SAVED_CODEX_COMMAND="$CODEX_BIN_DIR/codex"; fi
case "${LAZYDEV_BIN_DIR:-}" in
  "$LAZYDEV_HOME"|"$LAZYDEV_HOME"/*) LAZYDEV_BIN_DIR="$DEFAULT_EXTERNAL_BIN_DIR" ;;
esac
case "${RTK_BIN_DIR:-}" in
  "$LAZYDEV_HOME"|"$LAZYDEV_HOME"/*|"") RTK_BIN_DIR="$DEFAULT_EXTERNAL_BIN_DIR" ;;
esac
case "${CODEX_BIN_DIR:-}" in
  "$LAZYDEV_HOME"|"$LAZYDEV_HOME"/*|"") CODEX_BIN_DIR="$DEFAULT_EXTERNAL_BIN_DIR" ;;
esac
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT INT TERM HUP
add_path_entry() { dir="$1"; [ -n "$dir" ] || return 0
  case ":${PATH:-}:" in
    *":$dir:"*) ;;
    *) PATH="$dir:${PATH:-}"; export PATH; ;;
  esac
}
add_external_cli_bin_directories() { add_path_entry "${XDG_BIN_HOME:-}"; add_path_entry "$HOME/.local/bin"; add_path_entry "$HOME/.cargo/bin"; add_path_entry "$HOME/.bun/bin"; add_path_entry "$HOME/.deno/bin"; add_path_entry "$HOME/.npm-global/bin"; add_path_entry "$HOME/.local/share/pnpm"; add_path_entry "$HOME/.config/yarn/global/node_modules/.bin"; add_path_entry "$HOME/.volta/bin"; add_path_entry "$HOME/.asdf/shims"; add_path_entry "$HOME/.local/share/mise/shims"; add_path_entry "$HOME/.config/mise/shims"; add_path_entry "$HOME/.local/share/uv"; add_path_entry "$HOME/.npm/bin"; add_path_entry "$HOME/.local/lib/node_modules/.bin"; add_path_entry "$HOME/.npm-global/lib/node_modules/.bin"; add_path_entry "/usr/local/bin"; add_path_entry "/usr/bin"; add_path_entry "/opt/homebrew/bin"; add_path_entry "/home/linuxbrew/.linuxbrew/bin"; if command -v uv >/dev/null 2>&1; then uv_tool_bin="$(uv tool dir --bin 2>/dev/null || true)"; [ -n "$uv_tool_bin" ] && add_path_entry "$uv_tool_bin"; fi; add_path_entry "$HOME/.kimi-code/bin"; add_path_entry "$HOME/.kimi/bin"; add_path_entry "$HOME/.codex/packages/standalone/current/bin"; add_path_entry "$HOME/.opencode/bin"; if [ -n "${PREFIX:-}" ]; then add_path_entry "$PREFIX/bin"; fi; if command -v npm >/dev/null 2>&1; then npm_prefix="$(npm prefix -g 2>/dev/null || npm config get prefix 2>/dev/null || true)"; [ -n "$npm_prefix" ] && add_path_entry "$npm_prefix/bin"; fi; if command -v pnpm >/dev/null 2>&1; then pnpm_bin="$(pnpm bin -g 2>/dev/null || true)"; [ -n "$pnpm_bin" ] && add_path_entry "$pnpm_bin"; fi; if command -v bun >/dev/null 2>&1; then bun_bin="$(bun pm bin -g 2>/dev/null || true)"; [ -n "$bun_bin" ] && add_path_entry "$bun_bin"; fi; if command -v yarn >/dev/null 2>&1; then yarn_bin="$(yarn global bin 2>/dev/null || true)"; [ -n "$yarn_bin" ] && add_path_entry "$yarn_bin"; fi; hash -r 2>/dev/null || true; }
migrate_legacy_external_binaries() { migrate_one() { source="$1"; destination="$2"; [ -n "$source" ] || return 0; [ -e "$source" ] || [ -L "$source" ] || return 0; [ "$source" != "$destination" ] || return 0; mkdir -p "$(dirname "$destination")" 2>/dev/null || return 0; if [ -x "$destination" ] && [ -f "$destination" ]; then return 0; fi; cp -L "$source" "$destination" 2>/dev/null || return 0; chmod 755 "$destination" 2>/dev/null || true; [ -f "$destination" ] || return 0; say "✓ Recovered managed binary: $source → $destination"; }; if [ -z "${RTK_COMMAND:-}" ] || [ ! -f "${RTK_COMMAND:-}" ]; then for candidate in "${SAVED_RTK_COMMAND:-}" "${saved_rtk_bin:-}/rtk" "$LAZYDEV_HOME/rtk" "$LAZYDEV_HOME/bin/rtk" "$LAZYDEV_HOME.previous/rtk" "$LAZYDEV_HOME.previous/bin/rtk"; do [ -n "$candidate" ] || continue
      case "$candidate" in
        "$LAZYDEV_HOME"|"$LAZYDEV_HOME"/*) ;;
        *) continue ;;
      esac
if [ -f "$candidate" ] || [ -L "$candidate" ]; then migrate_one "$candidate" "$DEFAULT_EXTERNAL_BIN_DIR/rtk"; if [ -x "$DEFAULT_EXTERNAL_BIN_DIR/rtk" ]; then RTK_COMMAND="$DEFAULT_EXTERNAL_BIN_DIR/rtk"; RTK_BIN_DIR="$DEFAULT_EXTERNAL_BIN_DIR"; break; fi; fi; done; fi; if [ -z "${CODEX_COMMAND:-}" ] || [ ! -f "${CODEX_COMMAND:-}" ]; then for candidate in "${SAVED_CODEX_COMMAND:-}" "${saved_codex_bin:-}/codex" "${saved_codex_bin:-}/codex.bin" "$LAZYDEV_HOME/codex" "$LAZYDEV_HOME/codex.bin" "$LAZYDEV_HOME/bin/codex" "$LAZYDEV_HOME/bin/codex.bin" "$LAZYDEV_HOME.previous/codex" "$LAZYDEV_HOME.previous/codex.bin" "$LAZYDEV_HOME.previous/bin/codex" "$LAZYDEV_HOME.previous/bin/codex.bin"; do [ -n "$candidate" ] || continue
      case "$candidate" in
        "$LAZYDEV_HOME"|"$LAZYDEV_HOME"/*) ;;
        *) continue ;;
      esac
if [ -f "$candidate" ] || [ -L "$candidate" ]; then migrate_one "$candidate" "$DEFAULT_EXTERNAL_BIN_DIR/codex"; if [ -x "$DEFAULT_EXTERNAL_BIN_DIR/codex" ]; then CODEX_COMMAND="$DEFAULT_EXTERNAL_BIN_DIR/codex"; CODEX_BIN_DIR="$DEFAULT_EXTERNAL_BIN_DIR"; break; fi; fi; done; fi; }
migrate_legacy_external_binaries
protect_legacy_external_binaries() { for candidate in "$LAZYDEV_HOME/rtk" "$LAZYDEV_HOME/bin/rtk" "$LAZYDEV_HOME/codex" "$LAZYDEV_HOME/codex.bin" "$LAZYDEV_HOME/bin/codex" "$LAZYDEV_HOME/bin/codex.bin"; do [ -f "$candidate" ] || [ -L "$candidate" ] || continue
    case "$candidate" in
      "$LAZYDEV_HOME/rtk"|"$LAZYDEV_HOME/bin/rtk") destination="$DEFAULT_EXTERNAL_BIN_DIR/rtk" ;;
      *) destination="$DEFAULT_EXTERNAL_BIN_DIR/codex" ;;
    esac
if [ ! -x "$destination" ]; then migrate_one "$candidate" "$destination"; fi; [ -x "$destination" ] || fatal "Refusing to replace LazyDev runtime: could not preserve external binary $candidate."; done; }
protect_legacy_external_binaries
add_external_cli_bin_directories
find_cli_in_home() { target="$1"; [ -n "$target" ] || return 1; [ -d "$HOME" ] || return 1; find "$HOME" -maxdepth 8 \( -type d \( -name .git -o -name node_modules -o -name .cache -o -name Cache -o -name sessions -o -name logs -o -name target -o -name .pnpm-store -o -name __pycache__ \) -prune \) -o \( -type f -o -type l \) -print 2>/dev/null | while IFS= read -r candidate; do base="${candidate##*/}"
    case "$target:$base" in
      kimi:kimi|kimi:kimi.cmd|codex:codex|codex:codex.bin|codex:codex.cmd|codex:codex.exe|agy:agy|agy:agy.cmd|agy:agy.exe|rtk:rtk|rtk:rtk.cmd|rtk:rtk.exe)
        if [ -x "$candidate" ] && [ ! -d "$candidate" ]; then
          printf '%s\n' "$candidate"
          break
        fi
        ;;
    esac
done | head -n 1; }
find_kimi() { add_external_cli_bin_directories; for candidate in "${KIMI_COMMAND:-}" "$SAVED_KIMI_COMMAND" "${KIMI_BIN_DIR:-}/kimi" "${KIMI_CODE_HOME:-$HOME/.kimi-code}/bin/kimi" "$HOME/.kimi-code/bin/kimi" "$HOME/.kimi/bin/kimi" "$LAZYDEV_BIN_DIR/kimi" "$HOME/.local/share/lazydev/kimi" "$HOME/.local/bin/kimi"; do if [ -n "$candidate" ] && { [ -x "$candidate" ] || [ -f "$candidate" ]; }; then printf '%s\n' "$candidate"; return 0; fi; done; if [ -n "${PREFIX:-}" ] && { [ -x "$PREFIX/bin/kimi" ] || [ -f "$PREFIX/bin/kimi" ]; }; then printf '%s\n' "$PREFIX/bin/kimi"; return 0; fi; if command -v kimi >/dev/null 2>&1; then command -v kimi; return 0; fi; for root in "$HOME/.local/share/node_modules/.bin" "$HOME/.npm/bin" "/usr/local/bin" "/usr/bin" "/opt/homebrew/bin" "/home/linuxbrew/.linuxbrew/bin" "$HOME/.local/lib/node_modules/.bin" "$HOME/.npm-global/lib/node_modules/.bin" "$HOME/.volta/bin" "$HOME/.asdf/shims" "$HOME/.local/share/uv" "$HOME/.nvm"; do [ -d "$root" ] || continue; found="$(find "$root" -maxdepth 4 -type f \( -name kimi -o -name kimi.cmd \) -perm -111 -print 2>/dev/null | head -n 1 || true)"; if [ -n "$found" ]; then printf '%s\n' "$found"; return 0; fi; done; found="$(find_cli_in_home kimi 2>/dev/null || true)"; if [ -n "$found" ]; then printf '%s\n' "$found"; return 0; fi; return 1; }
repair_legacy_codex_wrappers() { canonical_dir="${DEFAULT_EXTERNAL_BIN_DIR:-$HOME/.local/bin}"; canonical="$canonical_dir/codex"; official="$HOME/.codex/packages/standalone/current/bin/codex"; is_codex_wrapper() { file="$1"; [ -f "$file" ] || [ -L "$file" ] || return 1; grep -Eq 'Codex TUI compatibility|codex-lazydev|tmux' "$file" 2>/dev/null; }; real=""; for candidate in "$official" "$canonical_dir/codex.bin" "$CODEX_BIN_DIR/codex.bin" "$HOME/.local/bin/codex.bin" "$HOME/.npm/bin/codex.bin" "${PREFIX:-}/bin/codex.bin" "$LAZYDEV_HOME/codex.bin" "$LAZYDEV_HOME/bin/codex.bin"; do [ -n "$candidate" ] || continue; if [ -x "$candidate" ] && [ ! -d "$candidate" ]; then real="$candidate"; break; fi; done; if is_codex_wrapper "$canonical" && [ -n "$real" ]; then mkdir -p "$canonical_dir" 2>/dev/null || true; rm -f "$canonical" 2>/dev/null || true; if [ "$real" = "$official" ]; then ln -s "$official" "$canonical" 2>/dev/null || cp -f "$official" "$canonical" 2>/dev/null || true; elif [ "$real" != "$canonical" ]; then if ! mv -f "$real" "$canonical" 2>/dev/null; then cp -f "$real" "$canonical" 2>/dev/null && rm -f "$real" 2>/dev/null || true; fi; fi; chmod 755 "$canonical" 2>/dev/null || true; real="$canonical"; say "✓ Restored direct Codex binary at $canonical"; fi; if [ ! -x "$canonical" ] && [ -x "$official" ]; then mkdir -p "$canonical_dir" 2>/dev/null || true; ln -sf "$official" "$canonical" 2>/dev/null || cp -f "$official" "$canonical" 2>/dev/null || true; chmod 755 "$canonical" 2>/dev/null || true; fi; if [ -x "$canonical" ]; then for public in "$HOME/.local/bin/codex" "$HOME/.npm/bin/codex" "${PREFIX:-}/bin/codex" "$LAZYDEV_BIN_DIR/codex"; do [ -n "$public" ] || continue; [ "$public" = "$canonical" ] && continue; if is_codex_wrapper "$public"; then rm -f "$public" 2>/dev/null || true; mkdir -p "$(dirname "$public")" 2>/dev/null || true; ln -s "$canonical" "$public" 2>/dev/null || true; say "✓ Removed legacy Codex compatibility wrapper: $public"; fi; done; fi; }
find_codex() { add_external_cli_bin_directories; repair_legacy_codex_wrappers || true; for candidate in "$CODEX_BIN_DIR/codex" "$HOME/.local/bin/codex" "$HOME/.codex/packages/standalone/current/bin/codex" "$SAVED_CODEX_COMMAND" "$CODEX_BIN_DIR/codex.bin" "$HOME/.local/bin/codex.bin" "$HOME/.local/share/lazydev/codex" "$HOME/.local/share/lazydev/codex.bin"; do if [ -n "$candidate" ] && { [ -x "$candidate" ] || [ -f "$candidate" ]; } && [ ! -d "$candidate" ]; then printf '%s\n' "$candidate"; return 0; fi; done; if [ -n "${PREFIX:-}" ]; then for candidate in "$PREFIX/bin/codex" "$PREFIX/bin/codex.bin"; do if [ -x "$candidate" ] || [ -f "$candidate" ]; then printf '%s\n' "$candidate"; return 0; fi; done; fi; command -v codex 2>/dev/null || true; }
find_antigravity() { add_external_cli_bin_directories; for candidate in "${AGY_COMMAND:-}" "$SAVED_AGY_COMMAND" "$HOME/.local/bin/agy" "$HOME/.local/share/lazydev/agy" "$HOME/.config/antigravity/bin/agy" "$HOME/.antigravity/bin/agy"; do if [ -n "$candidate" ] && { [ -x "$candidate" ] || [ -f "$candidate" ]; }; then printf '%s\n' "$candidate"; return 0; fi; done; if [ -n "${PREFIX:-}" ] && { [ -x "$PREFIX/bin/agy" ] || [ -f "$PREFIX/bin/agy" ]; }; then printf '%s\n' "$PREFIX/bin/agy"; return 0; fi; if command -v agy >/dev/null 2>&1; then command -v agy; return 0; fi; for root in "$HOME/.local/share/node_modules/.bin" "$HOME/.npm/bin" "/usr/local/bin" "/usr/bin" "/opt/homebrew/bin" "/home/linuxbrew/.linuxbrew/bin" "$HOME/.local/lib/node_modules/.bin" "$HOME/.npm-global/lib/node_modules/.bin"; do [ -d "$root" ] || continue; found="$(find "$root" -maxdepth 4 -type f -name agy -perm -111 -print 2>/dev/null | head -n 1 || true)"; if [ -n "$found" ]; then printf '%s\n' "$found"; return 0; fi; done; found="$(find_cli_in_home agy 2>/dev/null || true)"; if [ -n "$found" ]; then printf '%s\n' "$found"; return 0; fi; return 1; }
ask_install_ui() {
  label="$1"
  default="${2:-y}"
  printf '%s [Y/n]: ' "$label"
  # When invoked as `curl ... | sh`, stdin is the installer source itself.
  # Always read interactive answers from the terminal so `read` never consumes
  # the remaining script and corrupts the shell parser.
  if [ -r /dev/tty ]; then
    read -r answer </dev/tty || answer="$default"
  else
    answer="$default"
  fi
  answer="${answer:-$default}"
  case "$answer" in y|Y|yes|YES|Yes) return 0;; *) return 1;; esac
}

find_claude() { add_external_cli_bin_directories; for candidate in "${CLAUDE_COMMAND:-}" "$SAVED_CLAUDE_COMMAND" "$HOME/.local/bin/claude" "$HOME/.local/share/claude/bin/claude" "$HOME/.claude/bin/claude"; do if [ -n "$candidate" ] && { [ -x "$candidate" ] || [ -f "$candidate" ]; } && [ ! -d "$candidate" ]; then printf '%s\n' "$candidate"; return 0; fi; done; if command -v claude >/dev/null 2>&1; then command -v claude; return 0; fi; for root in "$HOME/.local/bin" "$HOME/.local/share/claude" "$HOME/.claude" "$HOME/.nvm" "$HOME/.volta" "$HOME/.asdf"; do [ -d "$root" ] || continue; found="$(find "$root" -maxdepth 6 -type f \( -name claude -o -name claude.cmd \) -perm -111 -print 2>/dev/null | head -n 1 || true)"; if [ -n "$found" ]; then printf '%s\n' "$found"; return 0; fi; done; found="$(find_cli_in_home claude 2>/dev/null || true)"; [ -n "$found" ] && { printf '%s\n' "$found"; return 0; }; return 1; }
find_deepseek_harness() { add_external_cli_bin_directories; for candidate in "${DEEPSEEK_HARNESS_COMMAND:-}" "$SAVED_DEEPSEEK_HARNESS_COMMAND" "${DEEPSEEK_HARNESS_RUNTIME}/node_modules/.bin/dsh" "$HOME/.local/bin/dsh"; do [ -n "$candidate" ] || continue; if [ -x "$candidate" ] && [ ! -d "$candidate" ]; then printf '%s\n' "$candidate"; return 0; fi; done; if command -v dsh >/dev/null 2>&1; then command -v dsh; return 0; fi; return 1; }
find_rtk() { add_external_cli_bin_directories; for candidate in "${RTK_COMMAND:-}" "$SAVED_RTK_COMMAND" "${RTK_BIN_DIR:-}/rtk" "${LAZYDEV_BIN_DIR:-}/rtk" "$HOME/.local/share/lazydev/rtk/rtk" "$HOME/.local/share/lazydev/rtk" "$HOME/.local/share/lazydev/bin/rtk" "$HOME/.local/bin/rtk" "$HOME/.cargo/bin/rtk" "/usr/local/bin/rtk"; do if [ -n "$candidate" ] && [ -x "$candidate" ] && [ ! -d "$candidate" ]; then printf '%s\n' "$candidate"; return 0; fi; if [ -n "$candidate" ] && [ -d "$candidate" ] && [ -x "$candidate/rtk" ]; then printf '%s\n' "$candidate/rtk"; return 0; fi; done; for root in "$HOME/.local/share/lazydev" "$HOME/.local/share/lazydev.previous" "$HOME/.local/bin" "$HOME/.cargo/bin" "$HOME/.nvm" "$HOME/.volta" "$HOME/.asdf" "$HOME/.local/share/uv" "${PREFIX:-}/bin"; do [ -d "$root" ] || continue; found="$(find "$root" -maxdepth 4 -type f -name rtk -perm -111 -print 2>/dev/null | head -n 1 || true)"; if [ -n "$found" ]; then printf '%s\n' "$found"; return 0; fi; done; found="$(find_cli_in_home rtk 2>/dev/null || true)"; if [ -n "$found" ]; then printf '%s\n' "$found"; return 0; fi; if command -v rtk >/dev/null 2>&1; then command -v rtk; return 0; fi; return 1; }
rtk_is_token_killer() { candidate="$1"; [ -n "$candidate" ] || return 1; [ -x "$candidate" ] || return 1; "$candidate" gain >/dev/null 2>&1; }
is_lazydev_launcher() { file="$1"; [ -f "$file" ] || [ -L "$file" ] || return 1; target="$file"; if [ -L "$target" ]; then link_target="$(readlink "$target" 2>/dev/null || true)"; if [ ! -e "$target" ]; then return 0; fi; if printf '%s\n' "$link_target" | grep -Eq 'lazydev|scripts/lazydev\.mjs|free-kimi-code'; then return 0; fi; if command -v readlink >/dev/null 2>&1; then resolved="$(readlink -f "$target" 2>/dev/null || true)"; [ -n "$resolved" ] && target="$resolved"; fi; fi; [ -f "$target" ] || return 1; grep -Eq 'Lazy Developer|cli/lazydev\.py|scripts/lazydev\.mjs|@blizps/lazy-developer|free-kimi-code' "$target" 2>/dev/null; }
if [ "$LAZYDEV_STATE_LOADED" -eq 0 ] && { [ -z "${LAZYDEV_BIN_DIR:-}" ] || [ "$LAZYDEV_BIN_DIR" = "$HOME/.local/bin" ]; }; then old_ifs="$IFS"; IFS=':'; for dir in ${PATH:-}; do IFS="$old_ifs"; [ -n "$dir" ] || { IFS=':'; continue; }; candidate="$dir/lazydev"; if [ -L "$candidate" ] && [ ! -e "$candidate" ]; then if [ -w "$dir" ]; then LAZYDEV_BIN_DIR="$dir"; break; fi; elif [ -f "$candidate" ] && is_lazydev_launcher "$candidate"; then LAZYDEV_BIN_DIR="$dir"; break; fi; IFS=':'; done; IFS="$old_ifs"; fi
if [ "$LAZYDEV_STATE_LOADED" -eq 0 ] && [ "${LAZYDEV_BIN_DIR:-}" = "$HOME/.local/bin" ]; then old_ifs="$IFS"; IFS=':'; for dir in ${PATH:-}; do IFS="$old_ifs"; [ -n "$dir" ] || { IFS=':'; continue; }
    case "$dir" in
      "$HOME/.local/bin") ;;
      *)
        if [ -d "$dir" ] && [ -w "$dir" ]; then
          LAZYDEV_BIN_DIR="$dir"
          break
        fi
        if [ ! -e "$dir" ] && [ -w "$(dirname "$dir")" ]; then
          mkdir -p "$dir" 2>/dev/null || true
          if [ -d "$dir" ] && [ -w "$dir" ]; then
            LAZYDEV_BIN_DIR="$dir"
            break
          fi
        fi
        ;;
    esac
IFS=':'; done; IFS="$old_ifs"; fi
refresh_active_lazydev_launcher() { canonical="$LAZYDEV_BIN_DIR/lazydev"; [ -f "$canonical" ] || return 0; active="$(command -v lazydev 2>/dev/null || true)"; [ -n "$active" ] || return 0; [ "$active" = "$canonical" ] && return 0
  case "$active" in
    /*) ;;
    *) return 0 ;;
  esac
dir="$(dirname "$active")"; if is_lazydev_launcher "$active" && [ -w "$dir" ]; then rm -f "$active" 2>/dev/null || true; cp "$canonical" "$active" 2>/dev/null || true; chmod 755 "$active" 2>/dev/null || true; if [ -f "$active" ]; then say "✓ Refreshed active LazyDev launcher: $active"; fi; fi; }
replace_legacy_lazydev_launchers() { canonical="$LAZYDEV_BIN_DIR/lazydev"; [ -f "$canonical" ] || return 0; old_path="${PATH:-}"; old_ifs="$IFS"; seen_candidates=":"; IFS=':'; for dir in $old_path; do IFS="$old_ifs"; [ -n "$dir" ] || { IFS=':'; continue; }; candidate="$dir/lazydev"; case "$seen_candidates" in *":$candidate:"*) IFS=':'; continue ;; esac; seen_candidates="${seen_candidates}${candidate}:"; if [ "$candidate" != "$canonical" ] && is_lazydev_launcher "$candidate"; then if [ -L "$candidate" ] && [ ! -e "$candidate" ]; then rm -f "$candidate" 2>/dev/null || true; if [ -w "$dir" ]; then cp "$canonical" "$candidate"; chmod 755 "$candidate" 2>/dev/null || true; say "✓ Repaired stale LazyDev launcher: $candidate"; fi; elif [ -w "$candidate" ]; then cp "$canonical" "$candidate"; chmod 755 "$candidate" 2>/dev/null || true; say "✓ Refreshed existing LazyDev launcher: $candidate"; fi; fi; IFS=':'; done; IFS="$old_ifs"; }
ensure_legacy_launcher_targets() { canonical="$LAZYDEV_BIN_DIR/lazydev"; [ -f "$canonical" ] || return 0; for dir in "$HOME/.local/bin"; do [ "$dir" = "$LAZYDEV_BIN_DIR" ] && continue; mkdir -p "$dir" 2>/dev/null || true; [ -d "$dir" ] && [ -w "$dir" ] || continue; candidate="$dir/lazydev"; cp "$canonical" "$candidate" 2>/dev/null || true; chmod 755 "$candidate" 2>/dev/null || true; done; if [ -n "${PREFIX:-}" ]; then dir="$PREFIX/bin"; [ "$dir" = "$LAZYDEV_BIN_DIR" ] && return 0; mkdir -p "$dir" 2>/dev/null || true; [ -d "$dir" ] && [ -w "$dir" ] || return 0; candidate="$dir/lazydev"; cp "$canonical" "$candidate" 2>/dev/null || true; chmod 755 "$candidate" 2>/dev/null || true; fi; }
refresh_shell_path() { rc="$1"; [ -n "$rc" ] || return 0; mkdir -p "$(dirname "$rc")"; tmp="$rc.lazydev.$$"; if [ -f "$rc" ]; then awk '!/^# Lazy Developer PATH$/ && !/^export PATH=.*\.kimi-code\/bin.*$/ && !/^fish_add_path .*\.kimi-code/ {print}' "$rc" > "$tmp"; else : > "$tmp"; fi; printf '# Lazy Developer PATH\nexport PATH="%s:%s:%s:%s:$PATH"\n' "$LAZYDEV_BIN_DIR" "$CODEX_BIN_DIR" "$RTK_BIN_DIR" "$HOME/.kimi-code/bin" >> "$tmp"; mv "$tmp" "$rc"; }
KIMI_COMMAND="$(find_kimi 2>/dev/null || true)"
if [ -n "$KIMI_COMMAND" ]; then case "$KIMI_COMMAND" in /*) KIMI_BIN_DIR="$(dirname "$KIMI_COMMAND")";; esac; fi
KIMI_CURRENT_VERSION=""
KIMI_LATEST_VERSION=""
KIMI_NEEDS_UPDATE=1
KIMI_UPDATE_AVAILABLE=0
if [ -n "$KIMI_COMMAND" ]; then KIMI_CURRENT_VERSION="$(extract_semver "$($KIMI_COMMAND --version 2>/dev/null || true)")"; if [ -n "$KIMI_CURRENT_VERSION" ]; then KIMI_LATEST_FILE="$TMP_DIR/kimi-latest.version"; (get_kimi_latest_version >"$KIMI_LATEST_FILE" 2>/dev/null || true) & KIMI_LATEST_PID=$!; else KIMI_NEEDS_UPDATE=0; KIMI_UPDATE_AVAILABLE=0; say "Kimi Code is installed but its version could not be detected — skipped."; fi
else KIMI_UPDATE_AVAILABLE=1; say "Kimi Code not found — installation available."; fi
repair_legacy_codex_wrappers || true
CODEX_COMMAND="$(find_codex 2>/dev/null || true)"
CODEX_CURRENT_VERSION=""
CODEX_LATEST_VERSION=""
CODEX_NEEDS_UPDATE=1
CODEX_UPDATE_AVAILABLE=0
if [ -n "$CODEX_COMMAND" ]; then case "$CODEX_COMMAND" in /*) CODEX_BIN_DIR="$(dirname "$CODEX_COMMAND")";; esac; CODEX_CURRENT_VERSION="$(extract_semver "$($CODEX_COMMAND --version 2>/dev/null || true)")"; if [ -n "$CODEX_CURRENT_VERSION" ]; then CODEX_LATEST_FILE="$TMP_DIR/codex-latest.version"; (get_codex_latest_version >"$CODEX_LATEST_FILE" 2>/dev/null || true) & CODEX_LATEST_PID=$!; else CODEX_NEEDS_UPDATE=0; CODEX_UPDATE_AVAILABLE=0; say "Codex is installed but its version could not be detected — skipped."; fi
else CODEX_UPDATE_AVAILABLE=1; say "Codex not found — installation available."; fi
AGY_COMMAND="$(find_antigravity 2>/dev/null || true)"
AGY_CURRENT_VERSION=""
AGY_LATEST_VERSION=""
AGY_NEEDS_UPDATE=1
AGY_UPDATE_AVAILABLE=0
if [ -n "$AGY_COMMAND" ]; then AGY_CURRENT_VERSION="$(extract_semver "$($AGY_COMMAND --version 2>/dev/null || true)")"; if [ -n "$AGY_CURRENT_VERSION" ]; then AGY_LATEST_FILE="$TMP_DIR/antigravity-latest.version"; (get_antigravity_latest_version >"$AGY_LATEST_FILE" 2>/dev/null || true) & AGY_LATEST_PID=$!; else AGY_NEEDS_UPDATE=0; AGY_UPDATE_AVAILABLE=0; say "Antigravity CLI is installed but its version could not be detected — skipped."; fi
else AGY_UPDATE_AVAILABLE=1; say "Antigravity CLI not found — installation available."; fi
CLAUDE_COMMAND="$(find_claude 2>/dev/null || true)"
CLAUDE_CURRENT_VERSION=""
CLAUDE_NEEDS_UPDATE=0
CLAUDE_UPDATE_AVAILABLE=0
if [ -n "$CLAUDE_COMMAND" ]; then CLAUDE_CURRENT_VERSION="$(extract_semver "$($CLAUDE_COMMAND --version 2>/dev/null || true)")"; CLAUDE_NEEDS_UPDATE=1; CLAUDE_UPDATE_AVAILABLE=1; if [ -n "$CLAUDE_CURRENT_VERSION" ]; then say "Claude Code $CLAUDE_CURRENT_VERSION is installed — install/update available."; else say "Claude Code is installed — install/update available."; fi
else CLAUDE_NEEDS_UPDATE=1; CLAUDE_UPDATE_AVAILABLE=1; say "Claude Code not found — installation available."; fi
DEEPSEEK_HARNESS_COMMAND="$(find_deepseek_harness 2>/dev/null || true)"
DEEPSEEK_HARNESS_CURRENT_VERSION=""
DEEPSEEK_HARNESS_TARGET_VERSION="$DEEPSEEK_HARNESS_DESKTOP_VERSION"
if [ "$ANDROID_TERMUX" -eq 1 ]; then DEEPSEEK_HARNESS_TARGET_VERSION="$DEEPSEEK_HARNESS_TERMUX_VERSION"; fi
DEEPSEEK_HARNESS_NEEDS_UPDATE=0
DEEPSEEK_HARNESS_UPDATE_AVAILABLE=0
if [ -n "$DEEPSEEK_HARNESS_COMMAND" ]; then DEEPSEEK_HARNESS_CURRENT_VERSION="$(extract_semver "$($DEEPSEEK_HARNESS_COMMAND --version 2>/dev/null || true)")"; if [ "$DEEPSEEK_HARNESS_CURRENT_VERSION" = "$DEEPSEEK_HARNESS_TARGET_VERSION" ]; then say "DeepSeek Harness $DEEPSEEK_HARNESS_CURRENT_VERSION is already current — skipped."; else DEEPSEEK_HARNESS_NEEDS_UPDATE=1; DEEPSEEK_HARNESS_UPDATE_AVAILABLE=1; say "DeepSeek Harness $([ -n "$DEEPSEEK_HARNESS_CURRENT_VERSION" ] && printf '%s' "$DEEPSEEK_HARNESS_CURRENT_VERSION" || printf 'unknown') → $DEEPSEEK_HARNESS_TARGET_VERSION — install/update available."; fi
else DEEPSEEK_HARNESS_NEEDS_UPDATE=1; DEEPSEEK_HARNESS_UPDATE_AVAILABLE=1; say "DeepSeek Harness not found — installation available."; fi
RTK_COMMAND="$(find_rtk 2>/dev/null || true)"
RTK_CURRENT_VERSION=""
RTK_LATEST_VERSION=""
RTK_NEEDS_UPDATE=1
RTK_UPDATE_AVAILABLE=0
if [ -n "$RTK_COMMAND" ]; then case "$RTK_COMMAND" in /*) RTK_BIN_DIR="$(dirname "$RTK_COMMAND")";; esac; RTK_CURRENT_VERSION="$(extract_semver "$($RTK_COMMAND --version 2>/dev/null || true)")"; if [ -n "$RTK_CURRENT_VERSION" ] && rtk_is_token_killer "$RTK_COMMAND"; then RTK_LATEST_FILE="$TMP_DIR/rtk-latest.version"; (get_rtk_latest_version >"$RTK_LATEST_FILE" 2>/dev/null || true) & RTK_LATEST_PID=$!; elif [ -n "$RTK_CURRENT_VERSION" ]; then RTK_CURRENT_VERSION=""; RTK_UPDATE_AVAILABLE=1; say "A different RTK package is installed — the Rust Token Killer will be installed by LazyDev."; else RTK_NEEDS_UPDATE=0; RTK_UPDATE_AVAILABLE=0; say "RTK is installed but its version could not be detected — skipped."; fi
else RTK_UPDATE_AVAILABLE=1; say "RTK not found — installation available."; fi
REMOTE_REVISION_FILE="$TMP_DIR/lazydev-revision"
(get_remote_revision >"$REMOTE_REVISION_FILE" 2>/dev/null || true) &
REMOTE_REVISION_PID=$!
for pid in ${KIMI_LATEST_PID:-} ${CODEX_LATEST_PID:-} ${AGY_LATEST_PID:-} ${RTK_LATEST_PID:-} ${REMOTE_REVISION_PID:-}; do wait "$pid" 2>/dev/null || true; done
if [ -n "$KIMI_COMMAND" ] && [ -n "$KIMI_CURRENT_VERSION" ]; then KIMI_LATEST_VERSION="$(cat "${KIMI_LATEST_FILE:-/dev/null}" 2>/dev/null || true)"; if [ -n "$KIMI_LATEST_VERSION" ]; then if version_at_least "$KIMI_CURRENT_VERSION" "$KIMI_LATEST_VERSION"; then KIMI_NEEDS_UPDATE=0; if [ "$KIMI_CURRENT_VERSION" = "$KIMI_LATEST_VERSION" ]; then say "Kimi Code $KIMI_CURRENT_VERSION is already current — skipped."; else say "Kimi Code $KIMI_CURRENT_VERSION is newer than the latest published $KIMI_LATEST_VERSION — skipped."; fi; else KIMI_UPDATE_AVAILABLE=1; say "Kimi Code $KIMI_CURRENT_VERSION → $KIMI_LATEST_VERSION — update available."; fi; else KIMI_NEEDS_UPDATE=0; say "Kimi Code $KIMI_CURRENT_VERSION is installed; latest release could not be checked — skipped."; fi; fi
if [ -n "$CODEX_COMMAND" ] && [ -n "$CODEX_CURRENT_VERSION" ]; then CODEX_LATEST_VERSION="$(cat "${CODEX_LATEST_FILE:-/dev/null}" 2>/dev/null || true)"; if [ -n "$CODEX_LATEST_VERSION" ]; then if version_at_least "$CODEX_CURRENT_VERSION" "$CODEX_LATEST_VERSION"; then CODEX_NEEDS_UPDATE=0; if [ "$CODEX_CURRENT_VERSION" = "$CODEX_LATEST_VERSION" ]; then say "Codex $CODEX_CURRENT_VERSION is already current — skipped."; else say "Codex $CODEX_CURRENT_VERSION is newer than the latest published $CODEX_LATEST_VERSION — skipped."; fi; else CODEX_UPDATE_AVAILABLE=1; say "Codex $CODEX_CURRENT_VERSION → $CODEX_LATEST_VERSION — update available."; fi; else CODEX_NEEDS_UPDATE=0; say "Codex $CODEX_CURRENT_VERSION is installed; latest release could not be checked — skipped."; fi; fi
if [ -n "$AGY_COMMAND" ] && [ -n "$AGY_CURRENT_VERSION" ]; then AGY_LATEST_VERSION="$(cat "${AGY_LATEST_FILE:-/dev/null}" 2>/dev/null || true)"; if [ -n "$AGY_LATEST_VERSION" ]; then if version_at_least "$AGY_CURRENT_VERSION" "$AGY_LATEST_VERSION"; then AGY_NEEDS_UPDATE=0; if [ "$AGY_CURRENT_VERSION" = "$AGY_LATEST_VERSION" ]; then say "Antigravity CLI $AGY_CURRENT_VERSION is already current — skipped."; else say "Antigravity CLI $AGY_CURRENT_VERSION is newer than the latest published $AGY_LATEST_VERSION — skipped."; fi; else AGY_UPDATE_AVAILABLE=1; say "Antigravity CLI $AGY_CURRENT_VERSION → $AGY_LATEST_VERSION — update available."; fi; else AGY_NEEDS_UPDATE=0; say "Antigravity CLI $AGY_CURRENT_VERSION is installed; latest release could not be checked — skipped."; fi; fi
if [ -n "$RTK_COMMAND" ] && [ -n "$RTK_CURRENT_VERSION" ]; then RTK_LATEST_VERSION="$(cat "${RTK_LATEST_FILE:-/dev/null}" 2>/dev/null || true)"; if [ -n "$RTK_LATEST_VERSION" ]; then if version_at_least "$RTK_CURRENT_VERSION" "$RTK_LATEST_VERSION"; then RTK_NEEDS_UPDATE=0; if [ "$RTK_CURRENT_VERSION" = "$RTK_LATEST_VERSION" ]; then say "RTK $RTK_CURRENT_VERSION is already current — skipped."; else say "RTK $RTK_CURRENT_VERSION is newer than the latest published $RTK_LATEST_VERSION — skipped."; fi; else RTK_UPDATE_AVAILABLE=1; say "RTK $RTK_CURRENT_VERSION → $RTK_LATEST_VERSION — update available."; fi; else RTK_NEEDS_UPDATE=0; say "RTK $RTK_CURRENT_VERSION is installed; latest release could not be checked — skipped."; fi; fi
REMOTE_REVISION="$(cat "$REMOTE_REVISION_FILE" 2>/dev/null || true)"
lazydev_source_fingerprint() { source_dir="$1"; manifest="$TMP_DIR/lazydev-source-files.txt"; : > "$manifest"; find "$source_dir" -type f     ! -path '*/.git/*' ! -path '*/node_modules/*' ! -path '*/__pycache__/*' ! -name '*.pyc'     -print | LC_ALL=C sort > "$manifest"; digest_input="$TMP_DIR/lazydev-source-digest.txt"; : > "$digest_input"; while IFS= read -r file; do hash="$(sha256_file "$file" 2>/dev/null || true)"; [ -n "$hash" ] && printf '%s  %s\n' "$hash" "${file#$source_dir/}" >> "$digest_input"; done < "$manifest"; sha256_file "$digest_input" 2>/dev/null || true; }
lazydev_local_source_revision() { source_dir="$1"; marker="$source_dir/.lazydev-source-id"; if [ -f "$marker" ]; then marker_id="$(tr -d '[:space:]' < "$marker" 2>/dev/null || true)"; if [ -n "$marker_id" ]; then printf '%s\n' "local-${marker_id}"; return 0; fi; fi; LOCAL_SOURCE_FINGERPRINT="$(lazydev_source_fingerprint "$source_dir")"; printf '%s\n' "local-${LOCAL_SOURCE_FINGERPRINT:-unknown}"; }
if [ -n "$LAZYDEV_LOCAL_SOURCE_DIR" ]; then REMOTE_REVISION="$(lazydev_local_source_revision "$LAZYDEV_LOCAL_SOURCE_DIR")"
elif [ -z "$REMOTE_REVISION" ]; then fatal "Could not read the current Lazy Developer revision from GitHub."; fi
CURRENT_LAZY_VERSION=""
CURRENT_LAZY_REVISION=""
LAZYDEV_NEEDS_UPDATE=1
LAZYDEV_FEATURE_REFRESH=0
if [ -f "$LAZYDEV_HOME/cli/lazydev.py" ]; then if ! grep -Eq 'lazydev resume' "$LAZYDEV_HOME/cli/lazydev.py" || ! grep -Eq 'if[[:space:]]+cmd[[:space:]]*==[[:space:]]*[\"'"'"']resume[\"'"'"']:' "$LAZYDEV_HOME/cli/lazydev.py" || ! grep -Eq 'return chat\(resume=True\)' "$LAZYDEV_HOME/cli/lazydev.py" || ! grep -Fq 'def _discover_command(' "$LAZYDEV_HOME/cli/lazydev.py" || ! grep -Fq 'def _resolve_from_dirs(' "$LAZYDEV_HOME/cli/lazydev.py" || ! grep -Fq 'def _managed_which(' "$LAZYDEV_HOME/cli/lazydev.py" || ! grep -Fq 'def find_kimi(' "$LAZYDEV_HOME/cli/lazydev.py" || ! grep -Fq 'def find_codex(' "$LAZYDEV_HOME/cli/lazydev.py" || ! grep -Fq 'def find_antigravity(' "$LAZYDEV_HOME/cli/lazydev.py" || ! grep -Fq 'def find_claude(' "$LAZYDEV_HOME/cli/lazydev.py" || grep -Eq "[\"'"'"']--config[\"'"'"']" "$LAZYDEV_HOME/cli/lazydev.py"; then LAZYDEV_FEATURE_REFRESH=1; fi
else LAZYDEV_FEATURE_REFRESH=1; fi
if [ ! -f "$LAZYDEV_HOME/runtime/lazydev-ui.mjs" ]; then LAZYDEV_FEATURE_REFRESH=1; fi
if [ -f "$LAZYDEV_HOME/scripts/lazydev.mjs" ]; then if ! grep -Eq "if \(cmd === 'resume'\) return resume\(\);" "$LAZYDEV_HOME/scripts/lazydev.mjs" || grep -Eq "if \(cmd === 'sessions'\)" "$LAZYDEV_HOME/scripts/lazydev.mjs"; then LAZYDEV_FEATURE_REFRESH=1; fi
else LAZYDEV_FEATURE_REFRESH=1; fi
if [ -f "$LAZYDEV_HOME/package.json" ]; then CURRENT_LAZY_VERSION="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$LAZYDEV_HOME/package.json" | head -n 1)"; fi
if [ -f "$LAZYDEV_HOME/.lazydev-revision" ]; then CURRENT_LAZY_REVISION="$(tr -d '[:space:]' < "$LAZYDEV_HOME/.lazydev-revision")"; fi
LAZYDEV_INSTALL_COMPLETE=0
LAZYDEV_STATUS_MESSAGE=""
if [ -f "$LAZYDEV_HOME/package.json" ] && [ -f "$LAZYDEV_HOME/cli/lazydev.py" ] && [ -f "$LAZYDEV_HOME/skills/lazy-developer/SKILL.md" ] && [ -f "$LAZYDEV_HOME/skills/lazy-debug/SKILL.md" ] && [ -f "$LAZYDEV_HOME/skills/lazy-review/SKILL.md" ] && [ -f "$LAZYDEV_HOME/skills/lazy-test/SKILL.md" ] && [ -x "$LAZYDEV_BIN_DIR/lazydev" ]; then LAZYDEV_INSTALL_COMPLETE=1; fi
if [ -n "$LAZYDEV_LOCAL_SOURCE_DIR" ]; then if [ "${LAZYDEV_FORCE_REINSTALL:-0}" = "1" ] || [ "$LAZYDEV_FEATURE_REFRESH" -eq 1 ] || [ "$LAZYDEV_INSTALL_COMPLETE" -eq 0 ] || [ -z "$CURRENT_LAZY_REVISION" ] || [ "$CURRENT_LAZY_REVISION" != "$REMOTE_REVISION" ]; then LAZYDEV_NEEDS_UPDATE=1; LAZYDEV_STATUS_MESSAGE="Local Lazy Developer source differs or needs repair — refreshing Lazy Developer only."; else LAZYDEV_NEEDS_UPDATE=0; LAZYDEV_STATUS_MESSAGE="Lazy Developer $LAZYDEV_VERSION is already current — skipped."; fi
elif [ "$LAZYDEV_FEATURE_REFRESH" -eq 1 ]; then LAZYDEV_NEEDS_UPDATE=1; LAZYDEV_STATUS_MESSAGE="Installed Lazy Developer is missing the current command surface — refreshing Lazy Developer only."
elif [ -n "$CURRENT_LAZY_VERSION" ] && [ "$CURRENT_LAZY_VERSION" != "$LAZYDEV_VERSION" ]; then LAZYDEV_STATUS_MESSAGE="Lazy Developer version $CURRENT_LAZY_VERSION differs from $LAZYDEV_VERSION — update required."
elif [ "$LAZYDEV_INSTALL_COMPLETE" -eq 1 ] && [ -n "$CURRENT_LAZY_REVISION" ] && [ "$CURRENT_LAZY_REVISION" = "$REMOTE_REVISION" ]; then LAZYDEV_NEEDS_UPDATE=0; LAZYDEV_STATUS_MESSAGE="Lazy Developer $LAZYDEV_VERSION is already current — skipped."
elif [ -n "$CURRENT_LAZY_REVISION" ]; then LAZYDEV_STATUS_MESSAGE="Lazy Developer changed on GitHub — updating Lazy Developer only."
else LAZYDEV_STATUS_MESSAGE="Lazy Developer is not installed cleanly — installing/repairing."; fi
INSTALL_KIMI=0
INSTALL_CODEX=0
INSTALL_ANTIGRAVITY=0
INSTALL_CLAUDE=0
INSTALL_DEEPSEEK_HARNESS=0
if [ "$KIMI_UPDATE_AVAILABLE" -eq 1 ]; then if ask_install_ui "Install/update Kimi Code?"; then INSTALL_KIMI=1; else KIMI_NEEDS_UPDATE=0; say "Kimi Code update/install declined — skipped."; fi; fi
if [ "$CODEX_UPDATE_AVAILABLE" -eq 1 ]; then if ask_install_ui "Install/update Codex?"; then INSTALL_CODEX=1; else CODEX_NEEDS_UPDATE=0; say "Codex update/install declined — skipped."; fi; fi
if [ "$AGY_UPDATE_AVAILABLE" -eq 1 ]; then if ask_install_ui "Install/update Antigravity?"; then INSTALL_ANTIGRAVITY=1; else AGY_NEEDS_UPDATE=0; say "Antigravity update/install declined — skipped."; fi; fi
if [ "$CLAUDE_UPDATE_AVAILABLE" -eq 1 ]; then if ask_install_ui "Install/update Claude Code?"; then INSTALL_CLAUDE=1; else CLAUDE_NEEDS_UPDATE=0; say "Claude Code update/install declined — skipped."; fi; fi
if [ "$DEEPSEEK_HARNESS_UPDATE_AVAILABLE" -eq 1 ]; then if ask_install_ui "Install/update DeepSeek Harness?"; then INSTALL_DEEPSEEK_HARNESS=1; else DEEPSEEK_HARNESS_NEEDS_UPDATE=0; say "DeepSeek Harness update/install declined — skipped."; fi; fi
clear 2>/dev/null || true
step "RTK"
if [ "$RTK_NEEDS_UPDATE" -eq 1 ]; then say "RTK is missing, outdated, or not the Rust Token Killer — installing the official RTK first."; mkdir -p "$RTK_BIN_DIR"; curl -fsSL "$RTK_INSTALL_URL" | RTK_INSTALL_DIR="$RTK_BIN_DIR" RTK_TELEMETRY_DISABLED=1 sh; PATH="$LAZYDEV_BIN_DIR:$CODEX_BIN_DIR:$RTK_BIN_DIR:$KIMI_BIN_DIR:$HOME/.kimi-code/bin:$PATH"; export PATH; RTK_COMMAND="$(find_rtk 2>/dev/null || true)"; [ -n "$RTK_COMMAND" ] || fatal "RTK did not install a usable launcher."; rtk_is_token_killer "$RTK_COMMAND" || fatal "Installed RTK is not the Rust Token Killer."; RTK_CURRENT_VERSION="$(extract_semver "$($RTK_COMMAND --version 2>/dev/null || true)")"; [ -n "$RTK_CURRENT_VERSION" ] || fatal "Could not read the installed RTK version."; say "✓ RTK $RTK_CURRENT_VERSION ready"; write_install_state
else say "✓ RTK ${RTK_CURRENT_VERSION:-installed} already current — skipped."; fi
ensure_python_runner
if [ "$LAZYDEV_NEEDS_UPDATE" -ne 0 ]; then [ -n "$LAZYDEV_STATUS_MESSAGE" ] && say "$LAZYDEV_STATUS_MESSAGE"; SOURCE_ARCHIVE="$TMP_DIR/lazydev.tar.gz"; SOURCE_EXTRACT="$TMP_DIR/source"; INSTALL_STAGE="$TMP_DIR/lazydev-stage"; mkdir -p "$SOURCE_EXTRACT" "$INSTALL_STAGE"; step "Installing/updating Lazy Developer $LAZYDEV_VERSION"; if [ -n "$LAZYDEV_LOCAL_SOURCE_DIR" ]; then SOURCE_DIR="$LAZYDEV_LOCAL_SOURCE_DIR"; else curl -fsSL "$REPO_ARCHIVE_URL" -o "$SOURCE_ARCHIVE"; tar -xzf "$SOURCE_ARCHIVE" -C "$SOURCE_EXTRACT"; SOURCE_DIR="$(find "$SOURCE_EXTRACT" -type f -name package.json -print | head -n 1 | sed 's#/package.json$##')"; REMOTE_REVISION="$(get_remote_revision || true)"; [ -n "$REMOTE_REVISION" ] || REMOTE_REVISION="unknown-remote"; fi; [ -n "$SOURCE_DIR" ] && [ -f "$SOURCE_DIR/package.json" ] || fatal "Lazy Developer source could not be located."; lazydev_source_is_current "$SOURCE_DIR" || fatal "Lazy Developer source failed capability validation."; SOURCE_VERSION="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"\]*\)".*/\1/p' "$SOURCE_DIR/package.json" | head -n 1)"; [ "$SOURCE_VERSION" = "$LAZYDEV_VERSION" ] || fatal "Repository version is $SOURCE_VERSION; expected $LAZYDEV_VERSION."; cp -R "$SOURCE_DIR/." "$INSTALL_STAGE/"; rm -rf "$INSTALL_STAGE/.git" "$INSTALL_STAGE/node_modules" 2>/dev/null || true; find "$INSTALL_STAGE" -type d -name '__pycache__' -prune -exec rm -rf {} + 2>/dev/null || true; find "$INSTALL_STAGE" -type f -name '*.pyc' -delete 2>/dev/null || true; printf '%s\n' "$REMOTE_REVISION" > "$INSTALL_STAGE/.lazydev-revision"; mkdir -p "$LAZYDEV_BIN_DIR"; if [ -e "$LAZYDEV_HOME" ]; then rm -rf "$LAZYDEV_HOME.previous" 2>/dev/null || true; mv "$LAZYDEV_HOME" "$LAZYDEV_HOME.previous"; fi; mkdir -p "$(dirname "$LAZYDEV_HOME")"; mv "$INSTALL_STAGE" "$LAZYDEV_HOME"; LAZYDEV_LAUNCHER="$LAZYDEV_BIN_DIR/lazydev"; if [ -L "$LAZYDEV_LAUNCHER" ]; then rm -f "$LAZYDEV_LAUNCHER"; fi
  cat > "$LAZYDEV_LAUNCHER" <<EOF
set -eu
LAZYDEV_ROOT="$(printf '%s' "$LAZYDEV_HOME" | sed 's/[\&]/\&/g')"
PYTHON_BIN="\$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)"
if [ -n "\$PYTHON_BIN" ]; then
  exec "\$PYTHON_BIN" "\$LAZYDEV_ROOT/cli/lazydev.py" "\$@"
fi
UV_BIN="\$(command -v uv 2>/dev/null || true)"
if [ -n "\$UV_BIN" ]; then
  exec "\$UV_BIN" run --no-project --python 3.13 "\$LAZYDEV_ROOT/cli/lazydev.py" "\$@"
fi
echo "LazyDev requires Python 3.10+ or uv. No Node.js runtime is used by the native CLI." >&2
exit 1
EOF
chmod 755 "$LAZYDEV_LAUNCHER"; COMPAT_LAZYDEV_LAUNCHER="$LAZYDEV_HOME/lazydev"
  cat > "$COMPAT_LAZYDEV_LAUNCHER" <<EOF
set -eu
PYTHON_BIN="\$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)"
if [ -n "\$PYTHON_BIN" ]; then
  exec "\$PYTHON_BIN" "$(printf '%s' "$LAZYDEV_HOME" | sed 's/[\&]/\&/g')/cli/lazydev.py" "\$@"
fi
exec "$(printf '%s' "$LAZYDEV_LAUNCHER" | sed 's/[\&]/\&/g')" "\$@"
EOF
chmod 755 "$COMPAT_LAZYDEV_LAUNCHER"; PATH="$LAZYDEV_BIN_DIR:$CODEX_BIN_DIR:$RTK_BIN_DIR:$HOME/.kimi-code/bin:$PATH"; export PATH; say "✓ Lazy Developer $LAZYDEV_VERSION ready"
else [ -n "$LAZYDEV_STATUS_MESSAGE" ] && say "$LAZYDEV_STATUS_MESSAGE"; fi
ensure_legacy_launcher_targets
replace_legacy_lazydev_launchers
refresh_active_lazydev_launcher
hash -r 2>/dev/null || true
PATH="$LAZYDEV_BIN_DIR:$CODEX_BIN_DIR:$RTK_BIN_DIR:$KIMI_BIN_DIR:$HOME/.local/bin:$HOME/.kimi-code/bin:$PATH"; export PATH
write_install_state
LAZYDEV_HELP_OUTPUT="$TMP_DIR/lazydev-help.txt"
if ! "$LAZYDEV_BIN_DIR/lazydev" help >"$LAZYDEV_HELP_OUTPUT" 2>&1; then cat "$LAZYDEV_HELP_OUTPUT" >&2 || true; fatal "Lazy Developer launcher did not execute after refresh."; fi
if ! grep -q 'lazydev resume' "$LAZYDEV_HELP_OUTPUT" || grep -q 'lazydev sessions' "$LAZYDEV_HELP_OUTPUT"; then cat "$LAZYDEV_HELP_OUTPUT" >&2 || true; fatal "Lazy Developer command surface is stale: expected lazydev resume and no lazydev sessions."; fi
rm -rf "$LAZYDEV_HOME.previous" 2>/dev/null || true
say "Lazy Developer setup — skipped. Configure providers later with: lazydev setup"
if [ "$ANDROID_TERMUX" -eq 1 ]; then say "Android/Termux: Codex is launched directly; no tmux compatibility wrapper is installed."; fi
find_node() { for name in node nodejs; do if command -v "$name" >/dev/null 2>&1; then command -v "$name"; return 0; fi; done; return 1; }
find_npm() { if command -v npm >/dev/null 2>&1; then command -v npm; return 0; fi; return 1; }
cliui_package_is_current() { pkg="$LAZYDEV_UI_HOME/node_modules/@poppinss/cliui/package.json"; [ -f "$pkg" ] || return 1; version="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$pkg" | head -n 1)"; [ "$version" = "$LAZYDEV_UI_VERSION" ]; }
cliui_runtime_is_healthy() { cliui_package_is_current || return 1; node_bin="$(find_node 2>/dev/null || true)"; [ -n "$node_bin" ] || return 1; (cd "$LAZYDEV_UI_HOME" && "$node_bin" --input-type=module -e "import('@poppinss/cliui').then(m=>{if(typeof m.cliui!=='function')process.exit(2)}).catch(()=>process.exit(3))" >/dev/null 2>&1); }
cliui_is_current() { cliui_runtime_is_healthy || return 1; [ -f "$LAZYDEV_UI_HOME/lazydev-ui.mjs" ] || return 1; }
install_cliui_runtime() { node_bin="$(find_node 2>/dev/null || true)"; npm_bin="$(find_npm 2>/dev/null || true)"; if [ -z "$node_bin" ] || [ -z "$npm_bin" ]; then say "CLI UI helper $LAZYDEV_UI_VERSION — skipped (Node.js/npm not available; native AI UIs do not require it)."; return 0; fi; if cliui_package_is_current; then if [ -f "$LAZYDEV_HOME/runtime/lazydev-ui.mjs" ]; then cp "$LAZYDEV_HOME/runtime/lazydev-ui.mjs" "$LAZYDEV_UI_HOME/lazydev-ui.mjs" 2>/dev/null || true; chmod 755 "$LAZYDEV_UI_HOME/lazydev-ui.mjs" 2>/dev/null || true; fi; if cliui_is_current; then say "CLI UI helper $LAZYDEV_UI_VERSION is already current — skipped."; else say "CLI UI helper $LAZYDEV_UI_VERSION is already installed — skipped npm reinstall; runtime will self-check on use."; fi; return 0; fi; step "Installing CLI UI helper $LAZYDEV_UI_VERSION"; mkdir -p "$LAZYDEV_UI_HOME"
  cat > "$LAZYDEV_UI_HOME/package.json" <<EOF
{
  "name": "@blizps/lazydev-ui-runtime",
  "private": true,
  "dependencies": {"$LAZYDEV_UI_PACKAGE": "$LAZYDEV_UI_VERSION"}
}
EOF
if ! (cd "$LAZYDEV_UI_HOME" && "$npm_bin" install --no-package-lock --ignore-scripts --omit=dev); then say "CLI UI helper installation failed — native AI UIs remain available without it."; return 0; fi; if [ -f "$LAZYDEV_HOME/runtime/lazydev-ui.mjs" ]; then cp "$LAZYDEV_HOME/runtime/lazydev-ui.mjs" "$LAZYDEV_UI_HOME/lazydev-ui.mjs"; chmod 755 "$LAZYDEV_UI_HOME/lazydev-ui.mjs" 2>/dev/null || true; fi; cliui_is_current || say "CLI UI helper installed but runtime verification failed — native AI UIs remain available."; cliui_is_current && say "✓ CLI UI helper $LAZYDEV_UI_VERSION ready"; }
install_cliui_runtime
if [ -f "$LAZYDEV_HOME/runtime/lazydev-ui.mjs" ] && [ -f "$LAZYDEV_UI_HOME/node_modules/@poppinss/cliui/package.json" ]; then cp "$LAZYDEV_HOME/runtime/lazydev-ui.mjs" "$LAZYDEV_UI_HOME/lazydev-ui.mjs" 2>/dev/null || true; chmod 755 "$LAZYDEV_UI_HOME/lazydev-ui.mjs" 2>/dev/null || true; fi
if [ "$INSTALL_KIMI" -eq 1 ] && [ "$KIMI_NEEDS_UPDATE" -eq 1 ]; then step "Installing/updating Kimi Code to the latest available release"; KIMI_INSTALL_SCRIPT="$TMP_DIR/kimi-install.sh"; KIMI_INSTALL_LOG="$TMP_DIR/kimi-install.log"; curl -fsSL "$KIMI_INSTALL_URL" -o "$KIMI_INSTALL_SCRIPT" || fatal "Could not download the Kimi Code installer."; if ! bash "$KIMI_INSTALL_SCRIPT" >"$KIMI_INSTALL_LOG" 2>&1; then cat "$KIMI_INSTALL_LOG" >&2 || true; if grep -Eqi 'npm[[:space:]]+(ERR!|error)|ERR_NPM|ERESOLVE|EAI_AGAIN|ELIFECYCLE|ENOENT.*npm|command failed.*npm' "$KIMI_INSTALL_LOG"; then fatal "Kimi Code installer failed with an npm error. The npm failure is shown above; fix npm/node setup and rerun LazyDev installer."; fi; fatal "Kimi Code installer failed. See the installer output above."; fi; cat "$KIMI_INSTALL_LOG"; KIMI_COMMAND="$(find_kimi 2>/dev/null || true)"; [ -n "$KIMI_COMMAND" ] || fatal "Kimi Code did not install a usable launcher."; case "$KIMI_COMMAND" in /*) KIMI_BIN_DIR="$(dirname "$KIMI_COMMAND")";; esac; KIMI_CURRENT_VERSION="$(extract_semver "$($KIMI_COMMAND --version 2>/dev/null || true)")"; [ -n "$KIMI_CURRENT_VERSION" ] || fatal "Could not read the installed Kimi Code version."; if [ -n "$KIMI_LATEST_VERSION" ] && ! version_at_least "$KIMI_CURRENT_VERSION" "$KIMI_LATEST_VERSION"; then fatal "Installed Kimi Code is $KIMI_CURRENT_VERSION; latest detected release is $KIMI_LATEST_VERSION."; fi; say "✓ Kimi Code $KIMI_CURRENT_VERSION ready"; write_install_state; fi
if [ "$INSTALL_CODEX" -eq 1 ] && [ "$CODEX_NEEDS_UPDATE" -eq 1 ]; then step "Installing/updating official Codex CLI"; CODEX_TARGET_VERSION="${CODEX_LATEST_VERSION:-}"; if [ -z "$CODEX_TARGET_VERSION" ]; then CODEX_TARGET_VERSION="$(get_codex_latest_version 2>/dev/null || true)"; fi; [ -n "$CODEX_TARGET_VERSION" ] || fatal "Could not resolve the latest official Codex release version."; install_codex_official "$CODEX_TARGET_VERSION"; PATH="$LAZYDEV_BIN_DIR:$CODEX_BIN_DIR:$RTK_BIN_DIR:$KIMI_BIN_DIR:$HOME/.local/bin:$PATH"; export PATH; hash -r 2>/dev/null || true; repair_legacy_codex_wrappers || true; CODEX_INSTALLED_BIN="$CODEX_BIN_DIR/codex"; if [ -x "$CODEX_INSTALLED_BIN" ] || [ -L "$CODEX_INSTALLED_BIN" ]; then CODEX_COMMAND="$CODEX_INSTALLED_BIN"; else CODEX_COMMAND="$(find_codex 2>/dev/null || true)"; fi; [ -n "$CODEX_COMMAND" ] || fatal "Codex did not install a usable launcher."; CODEX_VERSION_OUTPUT="$($CODEX_COMMAND --version 2>/dev/null || true)"; CODEX_CURRENT_VERSION="$(extract_semver "$CODEX_VERSION_OUTPUT")"; if [ -z "$CODEX_CURRENT_VERSION" ]; then CODEX_CURRENT_VERSION="$CODEX_TARGET_VERSION"; say "✓ Codex $CODEX_CURRENT_VERSION ready (official installer)"; elif ! version_at_least "$CODEX_CURRENT_VERSION" "$CODEX_TARGET_VERSION"; then fatal "Installed Codex reports $CODEX_CURRENT_VERSION but the verified package was $CODEX_TARGET_VERSION."; else say "✓ Codex $CODEX_CURRENT_VERSION ready: $CODEX_COMMAND"; fi; write_install_state; fi
if [ "$INSTALL_ANTIGRAVITY" -eq 1 ] && [ "$AGY_NEEDS_UPDATE" -eq 1 ]; then step "Installing/updating official Antigravity CLI"; AGY_INSTALL_SCRIPT="$TMP_DIR/antigravity-install.sh"; AGY_LOG="$TMP_DIR/antigravity-install.log"; if ! curl -fsSL "$ANTIGRAVITY_INSTALL_URL" -o "$AGY_INSTALL_SCRIPT"; then fatal "Could not download the official Antigravity installer."; fi; if ! bash "$AGY_INSTALL_SCRIPT" >"$AGY_LOG" 2>&1; then cat "$AGY_LOG" >&2 || true; fatal "Antigravity installer failed."; fi; cat "$AGY_LOG"; PATH="$LAZYDEV_BIN_DIR:$CODEX_BIN_DIR:$RTK_BIN_DIR:$HOME/.local/bin:$PATH"; export PATH; AGY_COMMAND="$(find_antigravity 2>/dev/null || true)"; [ -n "$AGY_COMMAND" ] || fatal "Antigravity did not install a usable launcher."; say "✓ Antigravity ready: $AGY_COMMAND"; write_install_state; fi
if [ "$INSTALL_CLAUDE" -eq 1 ] && [ "$CLAUDE_NEEDS_UPDATE" -eq 1 ]; then step "Installing/updating official Claude Code"; CLAUDE_INSTALL_SCRIPT="$TMP_DIR/claude-install.sh"; CLAUDE_LOG="$TMP_DIR/claude-install.log"; if ! curl -fsSL "$CLAUDE_INSTALL_URL" -o "$CLAUDE_INSTALL_SCRIPT"; then fatal "Could not download the official Claude Code installer."; fi; if ! bash "$CLAUDE_INSTALL_SCRIPT" >"$CLAUDE_LOG" 2>&1; then cat "$CLAUDE_LOG" >&2 || true; fatal "Claude Code installer failed."; fi; cat "$CLAUDE_LOG"; PATH="$LAZYDEV_BIN_DIR:$CODEX_BIN_DIR:$RTK_BIN_DIR:$HOME/.local/bin:$HOME/.kimi-code/bin:$PATH"; export PATH; hash -r 2>/dev/null || true; CLAUDE_COMMAND="$(find_claude 2>/dev/null || true)"; [ -n "$CLAUDE_COMMAND" ] || fatal "Claude Code did not install a usable launcher."; CLAUDE_CURRENT_VERSION="$(extract_semver "$($CLAUDE_COMMAND --version 2>/dev/null || true)")"; say "✓ Claude Code ${CLAUDE_CURRENT_VERSION:-installed} ready"; write_install_state; fi
if [ "$INSTALL_DEEPSEEK_HARNESS" -eq 1 ] && [ "$DEEPSEEK_HARNESS_NEEDS_UPDATE" -eq 1 ]; then step "Installing/updating DeepSeek Harness $DEEPSEEK_HARNESS_TARGET_VERSION"; NODE_BIN="$(find_node 2>/dev/null || true)"; NPM_BIN="$(find_npm 2>/dev/null || true)"; [ -n "$NODE_BIN" ] && [ -n "$NPM_BIN" ] || fatal "DeepSeek Harness needs Node.js and a package manager in the installation environment. On Android/Termux, run LazyDev from the Debian or Ubuntu guest described in the README."; mkdir -p "$DEEPSEEK_HARNESS_RUNTIME"
  cat > "$DEEPSEEK_HARNESS_RUNTIME/package.json" <<EOF
{
  "name": "@blizps/lazydev-deepseek-harness-runtime",
  "private": true,
  "dependencies": {"$DEEPSEEK_HARNESS_PACKAGE": "$DEEPSEEK_HARNESS_TARGET_VERSION"}
}
EOF
if ! (cd "$DEEPSEEK_HARNESS_RUNTIME" && "$NPM_BIN" install --no-package-lock --include=optional --omit=dev); then fatal "DeepSeek Harness installation failed."; fi; DEEPSEEK_HARNESS_COMMAND="$(find_deepseek_harness 2>/dev/null || true)"; [ -n "$DEEPSEEK_HARNESS_COMMAND" ] || fatal "DeepSeek Harness did not install a usable dsh launcher."; DEEPSEEK_HARNESS_CURRENT_VERSION="$(extract_semver "$($DEEPSEEK_HARNESS_COMMAND --version 2>/dev/null || true)")"; [ "$DEEPSEEK_HARNESS_CURRENT_VERSION" = "$DEEPSEEK_HARNESS_TARGET_VERSION" ] || fatal "DeepSeek Harness reports ${DEEPSEEK_HARNESS_CURRENT_VERSION:-unknown}; expected $DEEPSEEK_HARNESS_TARGET_VERSION."; if ! "$DEEPSEEK_HARNESS_COMMAND" web --help >/dev/null 2>&1; then fatal "DeepSeek Harness installed but its Web UI runtime is incomplete."; fi; if [ "$ANDROID_TERMUX" -eq 1 ]; then say "✓ DeepSeek Harness $DEEPSEEK_HARNESS_CURRENT_VERSION ready (Android compatibility pin)"; else say "✓ DeepSeek Harness $DEEPSEEK_HARNESS_CURRENT_VERSION ready"; fi; write_install_state; fi
RTK_CONNECT_NEEDED=0
if [ -n "$RTK_COMMAND" ] && [ -n "$(find_kimi 2>/dev/null || true)" ]; then if [ "$KIMI_NEEDS_UPDATE" -ne 0 ] || [ "$RTK_NEEDS_UPDATE" -ne 0 ] || [ "$LAZYDEV_NEEDS_UPDATE" -ne 0 ]; then RTK_CONNECT_NEEDED=1; elif [ ! -f "$KIMI_RUNTIME_HOME/AGENTS.md" ] || ! grep -qi 'rtk' "$KIMI_RUNTIME_HOME/AGENTS.md" 2>/dev/null; then RTK_CONNECT_NEEDED=1; fi; fi
if [ "$RTK_CONNECT_NEEDED" -ne 0 ]; then mkdir -p "$KIMI_RUNTIME_HOME"; step "Connecting RTK to Kimi Code"; (cd "$KIMI_RUNTIME_HOME" && RTK_TELEMETRY_DISABLED=1 "$RTK_COMMAND" init --agent kimi --auto-patch) || fatal "RTK Kimi integration failed."; say "✓ RTK is connected to Kimi Code"
elif [ -n "$RTK_COMMAND" ]; then say "RTK Kimi integration already current — skipped."; fi
write_install_state
# Keep the terminal summary last so setup/install ordering is unambiguous.
say ""
say "Lazy Developer installer finished."
if [ -n "${KIMI_CURRENT_VERSION:-}" ]; then
  KIMI_DISPLAY_FINAL="$KIMI_CURRENT_VERSION"
else
  KIMI_DISPLAY_FINAL="unknown"
fi
say "Kimi Code: $KIMI_DISPLAY_FINAL"
if [ -n "${RTK_CURRENT_VERSION:-}" ]; then
  RTK_DISPLAY_FINAL="$RTK_CURRENT_VERSION"
else
  RTK_DISPLAY_FINAL="unknown"
fi
say "RTK: $RTK_DISPLAY_FINAL"
say "Lazy Developer: $LAZYDEV_VERSION"
say "Existing Kimi sessions and configuration were left in place."
say ""
say "Provider setup is intentionally separate and was not run by the installer."
say "Claude Code and DeepSeek Harness use the configured LazyDev local route when launched from lazydev chat."
say "Next:"
say "  lazydev setup"
say "  lazydev chat"
say "  lazydev resume"
