#!/bin/sh
set -eu

REPO="BlizPS/lazy-developer-free-kimi-code"
BRANCH="${LAZYDEV_BRANCH:-main}"
LAZYDEV_VERSION="1.0.0"
KIMI_VERSION="0.43.1"
NODE_VERSION="22.19.0"
KIMI_INSTALL_URL="https://code.kimi.com/kimi-code/install.sh"
RTK_INSTALL_URL="https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh"
REPO_ARCHIVE_URL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"
GITHUB_API_URL="https://api.github.com/repos/${REPO}/commits/${BRANCH}"

LAZYDEV_HOME="${LAZYDEV_HOME:-$HOME/.local/share/lazydev}"
LAZYDEV_BIN_DIR="${LAZYDEV_BIN_DIR:-$HOME/.local/bin}"
if [ "$(uname -s)" = "Darwin" ]; then
  LAZYDEV_CONFIG_DIR="${LAZYDEV_CONFIG_DIR:-$HOME/Library/Application Support/lazydev}"
else
  LAZYDEV_CONFIG_DIR="${LAZYDEV_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/lazydev}"
fi
KIMI_RUNTIME_HOME="${LAZYDEV_CONFIG_DIR}/kimi-code"

say() { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
fatal() { printf 'error: %s\n' "$*" >&2; exit 1; }

case "${TERMUX_VERSION:-}" in
  '') ;;
  *) fatal "Termux/Android is intentionally not handled by the desktop installer. Use the supported Termux installation path." ;;
esac

case "$(uname -s)" in
  Darwin|Linux) ;;
  *) fatal "This installer supports macOS and Linux. Windows uses install.ps1." ;;
esac

command -v curl >/dev/null 2>&1 || fatal "curl is required."
command -v tar >/dev/null 2>&1 || fatal "tar is required."
command -v mktemp >/dev/null 2>&1 || fatal "mktemp is required."

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

TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t lazydev)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT INT TERM HUP

find_kimi() {
  if command -v kimi >/dev/null 2>&1; then
    command -v kimi
    return 0
  fi
  for candidate in "$HOME/.kimi-code/bin/kimi" "$HOME/.local/bin/kimi"; do
    if [ -x "$candidate" ]; then printf '%s\n' "$candidate"; return 0; fi
  done
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

KIMI_COMMAND="$(find_kimi 2>/dev/null || true)"
KIMI_CURRENT_VERSION=""
KIMI_NEEDS_UPDATE=1
if [ -n "$KIMI_COMMAND" ]; then
  KIMI_CURRENT_VERSION="$(extract_semver "$($KIMI_COMMAND --version 2>/dev/null || true)")"
  if [ -n "$KIMI_CURRENT_VERSION" ] && version_at_least "$KIMI_CURRENT_VERSION" "$KIMI_VERSION"; then
    KIMI_NEEDS_UPDATE=0
    say "Kimi Code $KIMI_CURRENT_VERSION is already current — skipped."
  else
    say "Kimi Code ${KIMI_CURRENT_VERSION:-not detected} needs installation/update."
  fi
else
  say "Kimi Code not found — installing $KIMI_VERSION."
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
if [ -n "$CURRENT_LAZY_VERSION" ] && [ "$CURRENT_LAZY_VERSION" != "$LAZYDEV_VERSION" ]; then
  say "Lazy Developer version $CURRENT_LAZY_VERSION differs from $LAZYDEV_VERSION — update required."
elif [ -n "$CURRENT_LAZY_REVISION" ] && [ "$CURRENT_LAZY_REVISION" = "$REMOTE_REVISION" ] && [ -x "$LAZYDEV_BIN_DIR/lazydev" ]; then
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
  step "Installing/updating Kimi Code $KIMI_VERSION"
  curl -fsSL "$KIMI_INSTALL_URL" | KIMI_VERSION="$KIMI_VERSION" bash
  KIMI_COMMAND="$(find_kimi 2>/dev/null || true)"
  [ -n "$KIMI_COMMAND" ] || fatal "Kimi Code did not install a usable launcher."
  KIMI_CURRENT_VERSION="$(extract_semver "$($KIMI_COMMAND --version 2>/dev/null || true)")"
  [ -n "$KIMI_CURRENT_VERSION" ] || fatal "Could not read the installed Kimi Code version."
  version_at_least "$KIMI_CURRENT_VERSION" "$KIMI_VERSION" || fatal "Installed Kimi Code is $KIMI_CURRENT_VERSION; expected at least $KIMI_VERSION."
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
if [ -n "$RTK_COMMAND" ]; then
  mkdir -p "$KIMI_RUNTIME_HOME"
  step "Connecting RTK to Kimi Code"
  (cd "$KIMI_RUNTIME_HOME" && RTK_TELEMETRY_DISABLED=1 "$RTK_COMMAND" init --agent kimi) || fatal "RTK Kimi integration failed."
  say "✓ RTK is connected to Kimi Code"
fi

if [ "$LAZYDEV_NEEDS_UPDATE" -ne 0 ]; then
  NODE_BIN="$(command -v node 2>/dev/null || true)"
  NODE_IS_PRIVATE=0
  if [ -n "$NODE_BIN" ]; then
    CURRENT_NODE="$($NODE_BIN --version 2>/dev/null || true)"
    if ! version_at_least "$CURRENT_NODE" "$NODE_VERSION"; then NODE_BIN=""; fi
  fi
  if [ -z "$NODE_BIN" ] && [ -x "$LAZYDEV_HOME/runtime-node/node" ]; then
    PRIVATE_NODE="$LAZYDEV_HOME/runtime-node/node"
    PRIVATE_NODE_VERSION="$($PRIVATE_NODE --version 2>/dev/null || true)"
    if version_at_least "$PRIVATE_NODE_VERSION" "$NODE_VERSION"; then
      NODE_BIN="$PRIVATE_NODE"; NODE_IS_PRIVATE=1
    fi
  fi

  install_private_node() {
    os="$(uname -s)"; arch="$(uname -m)"
    case "$os:$arch" in
      Darwin:arm64|Darwin:aarch64) node_asset="node-v${NODE_VERSION}-darwin-arm64.tar.gz" ;;
      Darwin:x86_64) node_asset="node-v${NODE_VERSION}-darwin-x64.tar.gz" ;;
      Linux:aarch64|Linux:arm64) node_asset="node-v${NODE_VERSION}-linux-arm64.tar.xz" ;;
      Linux:x86_64|Linux:amd64) node_asset="node-v${NODE_VERSION}-linux-x64.tar.xz" ;;
      *) fatal "Unsupported platform/architecture for Node.js $NODE_VERSION: $os/$arch" ;;
    esac
    step "Installing private Node.js $NODE_VERSION runtime"
    archive="$TMP_DIR/$node_asset"
    checksums="$TMP_DIR/SHASUMS256.txt"
    curl -fsSL "$NODE_BASE_URL/$node_asset" -o "$archive"
    curl -fsSL "$NODE_BASE_URL/SHASUMS256.txt" -o "$checksums"
    expected="$(awk -v n="$node_asset" '$2==n {print $1; exit}' "$checksums")"
    [ -n "$expected" ] || fatal "Could not find the Node.js checksum for $node_asset."
    actual="$(sha256sum "$archive" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$archive" | awk '{print $1}')"
    [ "$actual" = "$expected" ] || fatal "Node.js checksum verification failed."
    node_extract="$TMP_DIR/node"
    mkdir -p "$node_extract"
    tar -xf "$archive" -C "$node_extract"
    NODE_BIN="$(find "$node_extract" -type f -name node -perm -111 -print | head -n 1)"
    [ -n "$NODE_BIN" ] || fatal "Node.js binary was not found after extraction."
    NODE_IS_PRIVATE=1
  }

  if [ -z "$NODE_BIN" ]; then install_private_node; fi

  SOURCE_ARCHIVE="$TMP_DIR/lazydev.tar.gz"
  SOURCE_EXTRACT="$TMP_DIR/source"
  INSTALL_STAGE="$TMP_DIR/lazydev-stage"
  mkdir -p "$SOURCE_EXTRACT" "$INSTALL_STAGE"
  step "Installing/updating Lazy Developer $LAZYDEV_VERSION"
  curl -fsSL "$REPO_ARCHIVE_URL" -o "$SOURCE_ARCHIVE"
  tar -xzf "$SOURCE_ARCHIVE" -C "$SOURCE_EXTRACT"
  SOURCE_DIR="$(find "$SOURCE_EXTRACT" -type f -name package.json -print | head -n 1 | sed 's#/package.json$##')"
  [ -n "$SOURCE_DIR" ] && [ -f "$SOURCE_DIR/package.json" ] || fatal "Downloaded Lazy Developer source could not be located."
  SOURCE_VERSION="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SOURCE_DIR/package.json" | head -n 1)"
  [ "$SOURCE_VERSION" = "$LAZYDEV_VERSION" ] || fatal "Repository version is $SOURCE_VERSION; expected $LAZYDEV_VERSION."
  cp -R "$SOURCE_DIR/." "$INSTALL_STAGE/"
  printf '%s\n' "$REMOTE_REVISION" > "$INSTALL_STAGE/.lazydev-revision"

  if [ "$NODE_IS_PRIVATE" -eq 1 ]; then
    mkdir -p "$INSTALL_STAGE/runtime-node"
    cp "$NODE_BIN" "$INSTALL_STAGE/runtime-node/node"
    chmod 755 "$INSTALL_STAGE/runtime-node/node"
  fi

  mkdir -p "$LAZYDEV_BIN_DIR"
  if [ -e "$LAZYDEV_HOME" ]; then
    rm -rf "$LAZYDEV_HOME.previous" 2>/dev/null || true
    mv "$LAZYDEV_HOME" "$LAZYDEV_HOME.previous"
  fi
  mkdir -p "$(dirname "$LAZYDEV_HOME")"
  mv "$INSTALL_STAGE" "$LAZYDEV_HOME"
  rm -rf "$LAZYDEV_HOME.previous" 2>/dev/null || true

  if [ -x "$LAZYDEV_HOME/runtime-node/node" ]; then RUN_NODE="$LAZYDEV_HOME/runtime-node/node"; else RUN_NODE="$NODE_BIN"; fi
  LAZYDEV_LAUNCHER="$LAZYDEV_BIN_DIR/lazydev"
  cat > "$LAZYDEV_LAUNCHER" <<EOF
#!/bin/sh
set -eu
LAZYDEV_ROOT="$(printf '%s' "$LAZYDEV_HOME" | sed 's/[\\&]/\\&/g')"
if [ -x "\$LAZYDEV_ROOT/runtime-node/node" ]; then
  NODE_BIN="\$LAZYDEV_ROOT/runtime-node/node"
else
  NODE_BIN="$(printf '%s' "$RUN_NODE" | sed 's/[\\&]/\\&/g')"
fi
export PATH="$HOME/.kimi-code/bin:$LAZYDEV_BIN_DIR:\$PATH"
exec "\$NODE_BIN" "\$LAZYDEV_ROOT/scripts/lazydev.mjs" "\$@"
EOF
  chmod 755 "$LAZYDEV_LAUNCHER"

  PATH="$LAZYDEV_BIN_DIR:$HOME/.kimi-code/bin:$PATH"
  export PATH

  case "${SHELL:-}" in
    */zsh) RC_FILE="$HOME/.zshrc" ;;
    */fish) RC_FILE="$HOME/.config/fish/config.fish" ;;
    *) RC_FILE="$HOME/.bashrc" ;;
  esac
  if [ "$(basename "${SHELL:-sh}")" = "fish" ]; then
    mkdir -p "$(dirname "$RC_FILE")"
    grep -Fq "# Lazy Developer PATH" "$RC_FILE" 2>/dev/null || {
      printf "# Lazy Developer PATH\nfish_add_path '%s' '%s'\n" "$LAZYDEV_BIN_DIR" "$HOME/.kimi-code/bin" >> "$RC_FILE"
    }
  else
    grep -Fq "# Lazy Developer PATH" "$RC_FILE" 2>/dev/null || {
      printf '# Lazy Developer PATH\nexport PATH="%s:%s:$PATH"\n' "$LAZYDEV_BIN_DIR" "$HOME/.kimi-code/bin" >> "$RC_FILE"
    }
  fi
  say "✓ Lazy Developer $LAZYDEV_VERSION ready"
fi

printf '\n'
say "Lazy Developer installer finished."
say "Kimi Code: ${KIMI_CURRENT_VERSION:-unknown}"
say "RTK: ${RTK_CURRENT_VERSION:-unknown}"
say "Lazy Developer: $LAZYDEV_VERSION"
say "Existing Kimi sessions and configuration were left in place."
say ""
say "Next:"
say "  lazydev setup"
say "  lazydev chat"
