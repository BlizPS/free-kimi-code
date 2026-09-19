#!/bin/sh
set -eu

REPO="BlizPS/lazy-developer-free-kimi-code"
BRANCH="${LAZYDEV_BRANCH:-main}"
LAZYDEV_VERSION="1.0.0"
KIMI_INSTALL_URL="https://code.kimi.com/kimi-code/install.sh"
KIMI_RELEASE_API_URL="https://api.github.com/repos/MoonshotAI/kimi-code/releases/latest"
RTK_INSTALL_URL="https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh"
REPO_ARCHIVE_URL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"
GITHUB_API_URL="https://api.github.com/repos/${REPO}/commits/${BRANCH}"

LAZYDEV_HOME="${LAZYDEV_HOME:-$HOME/.local/share/lazydev}"
LAZYDEV_BIN_DIR="${LAZYDEV_BIN_DIR:-}"

# Termux is supported only when it is running a real glibc Linux userland
# (for example through proot-distro). Native Android/bionic Termux is not a
# compatible host for the official Linux Kimi/RTK binaries.
TERMUX_LINUX=0
case "${PREFIX:-}" in
  */com.termux/files/usr) TERMUX_LINUX=1 ;;
  */com.termux/files/usr/) TERMUX_LINUX=1 ;;
esac
if [ "${TERMUX_VERSION:-}" != "" ]; then TERMUX_LINUX=1; fi

if [ "$TERMUX_LINUX" -eq 1 ]; then
  if command -v getconf >/dev/null 2>&1 && getconf GNU_LIBC_VERSION >/dev/null 2>&1; then
    LAZYDEV_BIN_DIR="${LAZYDEV_BIN_DIR:-${PREFIX:-$HOME/.local}/bin}"
  elif command -v ldd >/dev/null 2>&1 && ldd --version 2>&1 | grep -qiE 'gnu libc|glibc'; then
    LAZYDEV_BIN_DIR="${LAZYDEV_BIN_DIR:-${PREFIX:-$HOME/.local}/bin}"
  else
    fatal "Termux/Android detected, but no glibc Linux userland was found. Install a Linux userland first (for example: pkg install proot-distro && proot-distro install debian && proot-distro login debian), then run this installer inside Linux."
  fi
else
  LAZYDEV_BIN_DIR="${LAZYDEV_BIN_DIR:-$HOME/.local/bin}"
fi

if [ "$(uname -s)" = "Darwin" ]; then
  LAZYDEV_CONFIG_DIR="${LAZYDEV_CONFIG_DIR:-$HOME/Library/Application Support/lazydev}"
else
  LAZYDEV_CONFIG_DIR="${LAZYDEV_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/lazydev}"
fi
KIMI_RUNTIME_HOME="${LAZYDEV_CONFIG_DIR}/kimi-code"

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

ensure_python_runner() {
  if command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1; then
    return 0
  fi
  if ! command -v uv >/dev/null 2>&1; then
    say "Python not detected — installing standalone uv as the Python bootstrapper."
    curl -fsSL "$UV_INSTALL_URL" | sh
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:${PATH:-}"
  fi
  command -v uv >/dev/null 2>&1 || fatal "Could not install uv for the native Python LazyDev CLI."
}
ensure_python_runner

version_at_least() {
  current="$1"; required="$2"
  awk -v c="$current" -v r="$required" '
    function v(s,a){ n=split(s,a,"."); return (a[1]+0)*1000000 + (a[2]+0)*1000 + (a[3]+0) }
    BEGIN { gsub(/^v/,"",c); gsub(/^v/,"",r); exit !(v(c) >= v(r)) }
  '
}

extract_semver() {
  printf '%s\n' "$1" | sed -n 's/.*\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' | head -n 1
}

get_kimi_latest_version() {
  response="$TMP_DIR/kimi-release.json"
  if curl -fsSL \
    -H 'Accept: application/vnd.github+json' \
    -H 'User-Agent: lazy-developer-installer/1.0.0' \
    "$KIMI_RELEASE_API_URL" -o "$response" 2>/dev/null; then
    tag_line="$(grep -m1 -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' "$response" 2>/dev/null || true)"
    version="$(printf '%s\n' "$tag_line" | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | tail -n 1 || true)"
    if [ -n "$version" ]; then
      printf '%s\n' "$version"
      return 0
    fi
  fi
  url="$(curl -fsSL -o /dev/null -w '%{url_effective}' 'https://github.com/MoonshotAI/kimi-code/releases/latest' 2>/dev/null || true)"
  printf '%s\n' "$url" | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | tail -n 1
}

TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t lazydev)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT INT TERM HUP

find_kimi() {
  for candidate in "$HOME/.kimi-code/bin/kimi" "$HOME/.local/bin/kimi"; do
    if [ -x "$candidate" ]; then printf '%s\n' "$candidate"; return 0; fi
  done
  if command -v kimi >/dev/null 2>&1; then
    command -v kimi
    return 0
  fi
  return 1
}

find_rtk() {
  if command -v rtk >/dev/null 2>&1; then
    command -v rtk
    return 0
  fi
  for candidate in "$HOME/.local/bin/rtk" "$HOME/.cargo/bin/rtk"; do
    if [ -x "$candidate" ]; then printf '%s\n' "$candidate"; return 0; fi
  done
  return 1
}


is_lazydev_launcher() {
  file="$1"
  [ -f "$file" ] || [ -L "$file" ] || return 1
  target="$file"
  if [ -L "$target" ]; then
    link_target="$(readlink "$target" 2>/dev/null || true)"
    if [ ! -e "$target" ]; then
      # A broken launcher named lazydev is stale. Repair it in place so shells
      # that cached the old path with `hash` immediately resolve the new file.
      return 0
    fi
    if printf '%s\n' "$link_target" | grep -Eq 'lazydev|scripts/lazydev\.mjs|lazy-developer-free-kimi-code'; then
      return 0
    fi
    if command -v readlink >/dev/null 2>&1; then
      resolved="$(readlink -f "$target" 2>/dev/null || true)"
      [ -n "$resolved" ] && target="$resolved"
    fi
  fi
  [ -f "$target" ] || return 1
  grep -Eq 'Lazy Developer managed launcher|cli/lazydev\.py|scripts/lazydev\.mjs|@blizps/lazy-developer|lazy-developer-free-kimi-code' "$target" 2>/dev/null
}

# If a previous install left a lazydev command in an earlier PATH entry,
# prefer that exact directory. This fixes Bash's command hash cache (including
# Termux/proot paths such as /data/data/com.termux/files/usr/bin/lazydev) without
# requiring the user to restart the shell.
if [ -z "${LAZYDEV_BIN_DIR:-}" ] || [ "$LAZYDEV_BIN_DIR" = "$HOME/.local/bin" ]; then
  old_ifs="$IFS"
  IFS=':'
  for dir in ${PATH:-}; do
    IFS="$old_ifs"
    [ -n "$dir" ] || { IFS=':'; continue; }
    candidate="$dir/lazydev"
    # First priority: repair/replace an existing LazyDev launcher in the
    # current PATH. This also fixes Bash's cached command path.
    if [ -L "$candidate" ] && [ ! -e "$candidate" ]; then
      if [ -w "$dir" ]; then
        LAZYDEV_BIN_DIR="$dir"
        break
      fi
    elif [ -f "$candidate" ] && is_lazydev_launcher "$candidate"; then
      LAZYDEV_BIN_DIR="$dir"
      break
    fi
    IFS=':'
  done
  IFS="$old_ifs"
fi

# A piped installer (curl ... | sh) cannot modify the parent shell's
# environment. Prefer a writable directory that is already on the current
# PATH so `lazydev` works immediately after installation, with no `source`
# or shell restart required. Only fall back to ~/.local/bin when none exists.
if [ "${LAZYDEV_BIN_DIR:-}" = "$HOME/.local/bin" ]; then
  old_ifs="$IFS"
  IFS=':'
  for dir in ${PATH:-}; do
    IFS="$old_ifs"
    [ -n "$dir" ] || { IFS=':'; continue; }
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
    IFS=':'
  done
  IFS="$old_ifs"
fi

replace_legacy_lazydev_launchers() {
  canonical="$LAZYDEV_BIN_DIR/lazydev"
  [ -f "$canonical" ] || return 0
  old_path="${PATH:-}"
  old_ifs="$IFS"
  IFS=':'
  for dir in $old_path; do
    IFS="$old_ifs"
    [ -n "$dir" ] || { IFS=':'; continue; }
    candidate="$dir/lazydev"
    if [ "$candidate" != "$canonical" ] && is_lazydev_launcher "$candidate"; then
      if [ -L "$candidate" ] && [ ! -e "$candidate" ]; then
        rm -f "$candidate" 2>/dev/null || true
        if [ -w "$dir" ]; then
          cp "$canonical" "$candidate"
          chmod 755 "$candidate" 2>/dev/null || true
          say "✓ Repaired stale LazyDev launcher: $candidate"
        fi
      elif [ -w "$candidate" ]; then
        cp "$canonical" "$candidate"
        chmod 755 "$candidate" 2>/dev/null || true
        say "✓ Refreshed existing LazyDev launcher: $candidate"
      fi
    fi
    IFS=':'
  done
  IFS="$old_ifs"
}

ensure_legacy_launcher_targets() {
  canonical="$LAZYDEV_BIN_DIR/lazydev"
  [ -f "$canonical" ] || return 0
  for dir in "$HOME/.local/bin"; do
    [ "$dir" = "$LAZYDEV_BIN_DIR" ] && continue
    mkdir -p "$dir" 2>/dev/null || true
    [ -d "$dir" ] && [ -w "$dir" ] || continue
    candidate="$dir/lazydev"
    cp "$canonical" "$candidate" 2>/dev/null || true
    chmod 755 "$candidate" 2>/dev/null || true
  done
  if [ -n "${PREFIX:-}" ]; then
    dir="$PREFIX/bin"
    [ "$dir" = "$LAZYDEV_BIN_DIR" ] && return 0
    mkdir -p "$dir" 2>/dev/null || true
    [ -d "$dir" ] && [ -w "$dir" ] || return 0
    candidate="$dir/lazydev"
    cp "$canonical" "$candidate" 2>/dev/null || true
    chmod 755 "$candidate" 2>/dev/null || true
  fi
}

refresh_shell_path() {
  rc="$1"
  [ -n "$rc" ] || return 0
  mkdir -p "$(dirname "$rc")"
  tmp="$rc.lazydev.$$"
  if [ -f "$rc" ]; then
    awk '!/^# Lazy Developer PATH$/ && !/^export PATH=.*\.kimi-code\/bin.*$/ && !/^fish_add_path .*\.kimi-code/ {print}' "$rc" > "$tmp"
  else
    : > "$tmp"
  fi
  printf '# Lazy Developer PATH\nexport PATH="%s:%s:$PATH"\n' "$LAZYDEV_BIN_DIR" "$HOME/.kimi-code/bin" >> "$tmp"
  mv "$tmp" "$rc"
}
KIMI_COMMAND="$(find_kimi 2>/dev/null || true)"
KIMI_CURRENT_VERSION=""
KIMI_LATEST_VERSION="$(get_kimi_latest_version || true)"
KIMI_NEEDS_UPDATE=1
if [ -n "$KIMI_COMMAND" ]; then
  KIMI_CURRENT_VERSION="$(extract_semver "$($KIMI_COMMAND --version 2>/dev/null || true)")"
  if [ -n "$KIMI_CURRENT_VERSION" ]; then
    if [ -n "$KIMI_LATEST_VERSION" ]; then
      if version_at_least "$KIMI_CURRENT_VERSION" "$KIMI_LATEST_VERSION"; then
        KIMI_NEEDS_UPDATE=0
        if [ "$KIMI_CURRENT_VERSION" = "$KIMI_LATEST_VERSION" ]; then
          say "Kimi Code $KIMI_CURRENT_VERSION is already current — skipped."
        else
          say "Kimi Code $KIMI_CURRENT_VERSION is newer than the latest published $KIMI_LATEST_VERSION — skipped."
        fi
      else
        say "Kimi Code $KIMI_CURRENT_VERSION → $KIMI_LATEST_VERSION — update required."
      fi
    else
      KIMI_NEEDS_UPDATE=0
      say "Kimi Code $KIMI_CURRENT_VERSION is installed; latest release could not be checked — skipped."
    fi
  else
    say "Kimi Code launcher found but its version could not be detected — update required."
  fi
else
  say "Kimi Code not found — installing the latest available release."
fi

get_remote_revision() {
  response="$TMP_DIR/github-commit.json"
  curl -fsSL \
    -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    -H 'User-Agent: lazy-developer-installer/1.0.0' \
    "$GITHUB_API_URL" -o "$response" || return 1
  grep -m1 -o '"sha"[[:space:]]*:[[:space:]]*"[0-9a-fA-F]\{40\}"' "$response" 2>/dev/null \
    | sed 's/.*"\([0-9a-fA-F]\{40\}\)"/\1/' | head -n 1
}

REMOTE_REVISION="$(get_remote_revision || true)"
[ -n "$REMOTE_REVISION" ] || fatal "Could not read the current Lazy Developer revision from GitHub."

CURRENT_LAZY_VERSION=""
CURRENT_LAZY_REVISION=""
LAZYDEV_NEEDS_UPDATE=1
if [ -f "$LAZYDEV_HOME/package.json" ]; then
  CURRENT_LAZY_VERSION="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$LAZYDEV_HOME/package.json" | head -n 1)"
fi
if [ -f "$LAZYDEV_HOME/.lazydev-revision" ]; then
  CURRENT_LAZY_REVISION="$(tr -d '[:space:]' < "$LAZYDEV_HOME/.lazydev-revision")"
fi
LAZYDEV_INSTALL_COMPLETE=0
if [ -f "$LAZYDEV_HOME/package.json" ] && \
   [ -f "$LAZYDEV_HOME/cli/lazydev.py" ] && \
   [ -f "$LAZYDEV_HOME/skills/lazy-developer/SKILL.md" ] && \
   [ -f "$LAZYDEV_HOME/skills/lazy-debug/SKILL.md" ] && \
   [ -f "$LAZYDEV_HOME/skills/lazy-review/SKILL.md" ] && \
   [ -f "$LAZYDEV_HOME/skills/lazy-test/SKILL.md" ] && \
   [ -x "$LAZYDEV_BIN_DIR/lazydev" ]; then
  LAZYDEV_INSTALL_COMPLETE=1
fi
if [ -n "$CURRENT_LAZY_VERSION" ] && [ "$CURRENT_LAZY_VERSION" != "$LAZYDEV_VERSION" ]; then
  say "Lazy Developer version $CURRENT_LAZY_VERSION differs from $LAZYDEV_VERSION — update required."
elif [ "$LAZYDEV_INSTALL_COMPLETE" -eq 1 ] && [ -n "$CURRENT_LAZY_REVISION" ] && [ "$CURRENT_LAZY_REVISION" = "$REMOTE_REVISION" ]; then
  LAZYDEV_NEEDS_UPDATE=0
  say "Lazy Developer $LAZYDEV_VERSION is already current — skipped."
elif [ -n "$CURRENT_LAZY_REVISION" ]; then
  say "Lazy Developer changed on GitHub — updating Lazy Developer only."
else
  say "Lazy Developer is not installed cleanly — installing/repairing."
fi

RTK_COMMAND="$(find_rtk 2>/dev/null || true)"
RTK_CURRENT_VERSION=""
RTK_LATEST_VERSION=""
RTK_NEEDS_UPDATE=1

if [ -n "$RTK_COMMAND" ]; then
  RTK_CURRENT_VERSION="$(extract_semver "$($RTK_COMMAND --version 2>/dev/null || true)")"
fi

get_rtk_latest_version() {
  url="$(curl -fsSL -o /dev/null -w '%{url_effective}' 'https://github.com/rtk-ai/rtk/releases/latest' 2>/dev/null || true)"
  version="$(printf '%s\n' "$url" | sed -n 's#.*/tag/v\{0,1\}\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*#\1#p' | head -n 1)"
  if [ -n "$version" ]; then printf '%s\n' "$version"; return 0; fi
  response="$TMP_DIR/rtk-release.json"
  curl -fsSL \
    -H 'Accept: application/vnd.github+json' \
    -H 'User-Agent: lazy-developer-installer/1.0.0' \
    'https://api.github.com/repos/rtk-ai/rtk/releases/latest' -o "$response" || return 1
  grep -m1 -o '"tag_name"[[:space:]]*:[[:space:]]*"v[0-9.]*"' "$response" \
    | sed 's/.*"v\([0-9.]*\)".*/\1/' | head -n 1
}

RTK_LATEST_VERSION="$(get_rtk_latest_version || true)"
if [ -n "$RTK_COMMAND" ] && [ -n "$RTK_CURRENT_VERSION" ] && [ -n "$RTK_LATEST_VERSION" ] && version_at_least "$RTK_CURRENT_VERSION" "$RTK_LATEST_VERSION"; then
  RTK_NEEDS_UPDATE=0
  say "RTK $RTK_CURRENT_VERSION is already current — skipped."
elif [ -n "$RTK_COMMAND" ] && [ -z "$RTK_LATEST_VERSION" ]; then
  RTK_NEEDS_UPDATE=0
  say "RTK $RTK_CURRENT_VERSION is installed; latest release could not be checked — skipped."
elif [ -n "$RTK_COMMAND" ]; then
  say "RTK ${RTK_CURRENT_VERSION:-unknown} → ${RTK_LATEST_VERSION:-latest} — update required."
else
  say "RTK not found — installing."
fi

if [ "$KIMI_NEEDS_UPDATE" -eq 1 ]; then
  step "Installing/updating Kimi Code to the latest available release"
  KIMI_INSTALL_SCRIPT="$TMP_DIR/kimi-install.sh"
  KIMI_INSTALL_LOG="$TMP_DIR/kimi-install.log"
  curl -fsSL "$KIMI_INSTALL_URL" -o "$KIMI_INSTALL_SCRIPT" || fatal "Could not download the Kimi Code installer."
  if ! bash "$KIMI_INSTALL_SCRIPT" >"$KIMI_INSTALL_LOG" 2>&1; then
    cat "$KIMI_INSTALL_LOG" >&2 || true
    if grep -Eqi 'npm[[:space:]]+(ERR!|error)|ERR_NPM|ERESOLVE|EAI_AGAIN|ELIFECYCLE|ENOENT.*npm|command failed.*npm' "$KIMI_INSTALL_LOG"; then
      fatal "Kimi Code installer failed with an npm error. The npm failure is shown above; fix npm/node setup and rerun LazyDev installer."
    fi
    fatal "Kimi Code installer failed. See the installer output above."
  fi
  cat "$KIMI_INSTALL_LOG"
  KIMI_COMMAND="$(find_kimi 2>/dev/null || true)"
  [ -n "$KIMI_COMMAND" ] || fatal "Kimi Code did not install a usable launcher."
  KIMI_CURRENT_VERSION="$(extract_semver "$($KIMI_COMMAND --version 2>/dev/null || true)")"
  [ -n "$KIMI_CURRENT_VERSION" ] || fatal "Could not read the installed Kimi Code version."
  if [ -n "$KIMI_LATEST_VERSION" ] && ! version_at_least "$KIMI_CURRENT_VERSION" "$KIMI_LATEST_VERSION"; then fatal "Installed Kimi Code is $KIMI_CURRENT_VERSION; latest detected release is $KIMI_LATEST_VERSION."; fi
  say "✓ Kimi Code $KIMI_CURRENT_VERSION ready"
fi

if [ "$RTK_NEEDS_UPDATE" -eq 1 ]; then
  step "Installing/updating RTK"
  mkdir -p "$LAZYDEV_BIN_DIR"
  curl -fsSL "$RTK_INSTALL_URL" | RTK_INSTALL_DIR="$LAZYDEV_BIN_DIR" RTK_TELEMETRY_DISABLED=1 sh
  PATH="$LAZYDEV_BIN_DIR:$HOME/.kimi-code/bin:$PATH"
  export PATH
  RTK_COMMAND="$(find_rtk 2>/dev/null || true)"
  [ -n "$RTK_COMMAND" ] || fatal "RTK did not install a usable launcher."
  RTK_CURRENT_VERSION="$(extract_semver "$($RTK_COMMAND --version 2>/dev/null || true)")"
  [ -n "$RTK_CURRENT_VERSION" ] || fatal "Could not read the installed RTK version."
  say "✓ RTK $RTK_CURRENT_VERSION ready"
fi

# Make RTK available to Kimi without touching the user's project files.
RTK_CONNECT_NEEDED=0
if [ -n "$RTK_COMMAND" ]; then
  if [ "$KIMI_NEEDS_UPDATE" -ne 0 ] || [ "$RTK_NEEDS_UPDATE" -ne 0 ] || [ "$LAZYDEV_NEEDS_UPDATE" -ne 0 ]; then
    RTK_CONNECT_NEEDED=1
  elif [ ! -f "$KIMI_RUNTIME_HOME/AGENTS.md" ] || ! grep -qi 'rtk' "$KIMI_RUNTIME_HOME/AGENTS.md" 2>/dev/null; then
    RTK_CONNECT_NEEDED=1
  fi
fi
if [ "$RTK_CONNECT_NEEDED" -ne 0 ]; then
  mkdir -p "$KIMI_RUNTIME_HOME"
  step "Connecting RTK to Kimi Code"
  (cd "$KIMI_RUNTIME_HOME" && RTK_TELEMETRY_DISABLED=1 "$RTK_COMMAND" init --agent kimi) || fatal "RTK Kimi integration failed."
  say "✓ RTK is connected to Kimi Code"
elif [ -n "$RTK_COMMAND" ]; then
  say "RTK Kimi integration already current — skipped."
fi

if [ -d "$LAZYDEV_HOME/runtime-node" ]; then
  LAZYDEV_NEEDS_UPDATE=1
  say "Legacy private Node.js runtime detected — it will be removed during the Lazy Developer update."
fi

if [ "$LAZYDEV_NEEDS_UPDATE" -ne 0 ]; then
  SOURCE_ARCHIVE="$TMP_DIR/lazydev.tar.gz"
  SOURCE_EXTRACT="$TMP_DIR/source"
  INSTALL_STAGE="$TMP_DIR/lazydev-stage"
  mkdir -p "$SOURCE_EXTRACT" "$INSTALL_STAGE"
  step "Installing/updating Lazy Developer $LAZYDEV_VERSION"
  curl -fsSL "$REPO_ARCHIVE_URL" -o "$SOURCE_ARCHIVE"
  tar -xzf "$SOURCE_ARCHIVE" -C "$SOURCE_EXTRACT"
  SOURCE_DIR="$(find "$SOURCE_EXTRACT" -type f -name package.json -print | head -n 1 | sed 's#/package.json$##')"
  [ -n "$SOURCE_DIR" ] && [ -f "$SOURCE_DIR/package.json" ] || fatal "Downloaded Lazy Developer source could not be located."
  SOURCE_VERSION="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"\]*\)".*/\1/p' "$SOURCE_DIR/package.json" | head -n 1)"
  [ "$SOURCE_VERSION" = "$LAZYDEV_VERSION" ] || fatal "Repository version is $SOURCE_VERSION; expected $LAZYDEV_VERSION."
  cp -R "$SOURCE_DIR/." "$INSTALL_STAGE/"
  printf '%s\n' "$REMOTE_REVISION" > "$INSTALL_STAGE/.lazydev-revision"

  mkdir -p "$LAZYDEV_BIN_DIR"
  if [ -e "$LAZYDEV_HOME" ]; then
    rm -rf "$LAZYDEV_HOME.previous" 2>/dev/null || true
    mv "$LAZYDEV_HOME" "$LAZYDEV_HOME.previous"
  fi
  mkdir -p "$(dirname "$LAZYDEV_HOME")"
  mv "$INSTALL_STAGE" "$LAZYDEV_HOME"
  rm -rf "$LAZYDEV_HOME.previous" 2>/dev/null || true

  LAZYDEV_LAUNCHER="$LAZYDEV_BIN_DIR/lazydev"
  if [ -L "$LAZYDEV_LAUNCHER" ]; then rm -f "$LAZYDEV_LAUNCHER"; fi
  cat > "$LAZYDEV_LAUNCHER" <<EOF
#!/bin/sh
# Lazy Developer managed launcher (native Python CLI)
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
  chmod 755 "$LAZYDEV_LAUNCHER"

  PATH="$LAZYDEV_BIN_DIR:$HOME/.kimi-code/bin:$PATH"
  export PATH

  say "✓ Lazy Developer $LAZYDEV_VERSION ready"
fi

# Reconcile launchers and populate compatibility locations so cached shells
# cannot keep resolving a removed LazyDev path.
ensure_legacy_launcher_targets

# Reconcile launchers and shell PATH even when every component was skipped.
# This matters when an older npm/user-local launcher is still first in the current PATH.
replace_legacy_lazydev_launchers
case "${SHELL:-}" in
  */zsh) RC_FILE="$HOME/.zshrc" ; refresh_shell_path "$RC_FILE" ;;
  */fish)
    RC_FILE="$HOME/.config/fish/config.fish"
    mkdir -p "$(dirname "$RC_FILE")"
    tmp="$RC_FILE.lazydev.$$"
    if [ -f "$RC_FILE" ]; then
      awk '!/^# Lazy Developer PATH$/ && !/^fish_add_path .*\.kimi-code/ {print}' "$RC_FILE" > "$tmp"
    else : > "$tmp"; fi
    printf "# Lazy Developer PATH\nfish_add_path '%s' '%s'\n" "$LAZYDEV_BIN_DIR" "$HOME/.kimi-code/bin" >> "$tmp"
    mv "$tmp" "$RC_FILE"
    ;;
  *) RC_FILE="$HOME/.bashrc" ; refresh_shell_path "$RC_FILE" ;;
esac

printf '\n'
say "Lazy Developer installer finished."
say "Kimi Code: ${KIMI_CURRENT_VERSION:-unknown}"
say "RTK: ${RTK_CURRENT_VERSION:-unknown}"
say "Lazy Developer: $LAZYDEV_VERSION"
say "LazyDev launcher: $LAZYDEV_BIN_DIR/lazydev"
say "Existing Kimi sessions and configuration were left in place."
say ""
if printf '%s' ":${PATH:-}:" | grep -q ":${LAZYDEV_BIN_DIR}:"; then
  say "LazyDev is on the current shell PATH. No restart is required."
else
  say "LazyDev is installed in $LAZYDEV_BIN_DIR but that directory is not on this shell's PATH."
  say "Open a new shell after installation, or run: export PATH="$LAZYDEV_BIN_DIR:\$PATH""
fi
say ""
say "Next:"
say "  lazydev setup"
say "  lazydev chat"
