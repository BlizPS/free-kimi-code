#!/bin/sh
set -eu

REPO="BlizPS/lazy-developer-skill-cli"
BRANCH="${LAZYDEV_BRANCH:-main}"
LAZYDEV_VERSION="1.0.0"
KIMI_VERSION="0.43.1"
NODE_VERSION="22.19.0"
KIMI_INSTALL_URL="https://code.kimi.com/kimi-code/install.sh"
REPO_ARCHIVE_URL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"
NODE_BASE_URL="https://nodejs.org/dist/v${NODE_VERSION}"
LAZYDEV_HOME="${LAZYDEV_HOME:-$HOME/.local/share/lazydev}"
LAZYDEV_BIN_DIR="${LAZYDEV_BIN_DIR:-$HOME/.local/bin}"

say() { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
fatal() { printf 'error: %s\n' "$*" >&2; exit 1; }

case "${TERMUX_VERSION:-}" in
  '') ;;
  *)
    fatal "Termux is not covered by the native Kimi Code installer yet. The upstream project currently has an open request for Android/Termux support."
    ;;
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
  awk -v c="$current" -v r="$required" 'function v(s,a){n=split(s,a,".");return a[1]*1000000+a[2]*1000+a[3]} BEGIN{gsub(/^v/,"",c);gsub(/^v/,"",r); exit !(v(c)>=v(r))}'
}

sha256_file() {
  file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$file" | awk '{print $NF}'
  else
    fatal "A SHA-256 utility is required (sha256sum, shasum, or openssl)."
  fi
}

TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t lazydev)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT INT TERM HUP

NODE_BIN="$(command -v node 2>/dev/null || true)"
if [ -n "$NODE_BIN" ]; then
  CURRENT_NODE="$("$NODE_BIN" --version 2>/dev/null || true)"
  if version_at_least "$CURRENT_NODE" "$NODE_VERSION"; then
    say "Using Node.js $CURRENT_NODE"
  else
    NODE_BIN=""
  fi
fi

install_private_node() {
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os:$arch" in
    Darwin:arm64|Darwin:aarch64) node_asset="node-v${NODE_VERSION}-darwin-arm64.tar.gz" ;;
    Darwin:x86_64) node_asset="node-v${NODE_VERSION}-darwin-x64.tar.gz" ;;
    Linux:aarch64|Linux:arm64) node_asset="node-v${NODE_VERSION}-linux-arm64.tar.xz" ;;
    Linux:x86_64|Linux:amd64) node_asset="node-v${NODE_VERSION}-linux-x64.tar.xz" ;;
    *) fatal "Unsupported platform/architecture for the bundled Node.js runtime: $os/$arch" ;;
  esac
  step "Installing private Node.js ${NODE_VERSION} runtime"
  archive="$TMP_DIR/$node_asset"
  checksums="$TMP_DIR/SHASUMS256.txt"
  curl -fsSL "$NODE_BASE_URL/$node_asset" -o "$archive"
  curl -fsSL "$NODE_BASE_URL/SHASUMS256.txt" -o "$checksums"
  expected="$(awk -v n="$node_asset" '$2==n {print $1; exit}' "$checksums")"
  [ -n "$expected" ] || fatal "Could not find the Node.js checksum for $node_asset."
  actual="$(sha256_file "$archive")"
  [ "$actual" = "$expected" ] || fatal "Node.js checksum verification failed."
  node_extract="$TMP_DIR/node"
  mkdir -p "$node_extract"
  tar -xf "$archive" -C "$node_extract"
  NODE_BIN="$(find "$node_extract" -type f -name node -perm -111 | head -n 1)"
  [ -n "$NODE_BIN" ] || fatal "Node.js binary was not found after extraction."
}

if [ -z "$NODE_BIN" ]; then
  install_private_node
fi

step "Installing/updating Kimi Code ${KIMI_VERSION}"
# Kimi Code's official installer is a native binary installer and does not use npm.
curl -fsSL "$KIMI_INSTALL_URL" | KIMI_VERSION="$KIMI_VERSION" bash

# The official installer normally places the native launcher in ~/.kimi-code/bin or
# ~/.local/bin. Include both locations for this process and generated LazyDev launcher.
KIMI_BIN_DIRS="$HOME/.kimi-code/bin:$HOME/.local/bin"
PATH="$KIMI_BIN_DIRS:$PATH"
export PATH

if ! command -v kimi >/dev/null 2>&1; then
  if [ -x "$HOME/.kimi-code/bin/kimi" ]; then
    KIMI_COMMAND="$HOME/.kimi-code/bin/kimi"
  elif [ -x "$HOME/.local/bin/kimi" ]; then
    KIMI_COMMAND="$HOME/.local/bin/kimi"
  else
    fatal "Kimi Code ${KIMI_VERSION} did not install a usable 'kimi' launcher."
  fi
else
  KIMI_COMMAND="$(command -v kimi)"
fi

step "Installing/updating Lazy Developer ${LAZYDEV_VERSION}"
SOURCE_ARCHIVE="$TMP_DIR/lazydev.tar.gz"
SOURCE_EXTRACT="$TMP_DIR/source"
INSTALL_STAGE="$TMP_DIR/lazydev-stage"
mkdir -p "$SOURCE_EXTRACT" "$INSTALL_STAGE"
curl -fsSL "$REPO_ARCHIVE_URL" -o "$SOURCE_ARCHIVE"
tar -xzf "$SOURCE_ARCHIVE" -C "$SOURCE_EXTRACT"
SOURCE_DIR="$(find "$SOURCE_EXTRACT" -mindepth 1 -maxdepth 2 -type f -name package.json -print | head -n 1 | xargs -r dirname)"
[ -n "$SOURCE_DIR" ] && [ -f "$SOURCE_DIR/package.json" ] || fatal "Downloaded Lazy Developer source archive could not be located."

SOURCE_VERSION="$($NODE_BIN -p "require('./package.json').version" -- "$SOURCE_DIR" 2>/dev/null || true)"
# The command above is intentionally simple; use an absolute cwd for POSIX shells.
SOURCE_VERSION="$(cd "$SOURCE_DIR" && "$NODE_BIN" -p "require('./package.json').version")"
[ "$SOURCE_VERSION" = "$LAZYDEV_VERSION" ] || fatal "Repository version is $SOURCE_VERSION, expected $LAZYDEV_VERSION."

# Copy the source tree as a normal user-owned installation. No npm/global module path is used.
cp -R "$SOURCE_DIR/." "$INSTALL_STAGE/"

# If we had to bootstrap Node, keep only the runtime executable so the installer stays small.
if [ -n "${CURRENT_NODE:-}" ] && version_at_least "$CURRENT_NODE" "$NODE_VERSION"; then
  :
else
  mkdir -p "$INSTALL_STAGE/runtime-node"
  cp "$NODE_BIN" "$INSTALL_STAGE/runtime-node/node"
  chmod 755 "$INSTALL_STAGE/runtime-node/node"
fi

mkdir -p "$LAZYDEV_BIN_DIR"
LAZYDEV_STAGE_NODE=''
if [ -x "$INSTALL_STAGE/runtime-node/node" ]; then
  LAZYDEV_STAGE_NODE="$LAZYDEV_HOME/runtime-node/node"
fi

# Replace the installation atomically when possible.
if [ -e "$LAZYDEV_HOME" ]; then
  rm -rf "$LAZYDEV_HOME.previous" 2>/dev/null || true
  if ! mv "$LAZYDEV_HOME" "$LAZYDEV_HOME.previous" 2>/dev/null; then
    rm -rf "$LAZYDEV_HOME"
  fi
fi
mkdir -p "$(dirname "$LAZYDEV_HOME")"
mv "$INSTALL_STAGE" "$LAZYDEV_HOME"
rm -rf "$LAZYDEV_HOME.previous" 2>/dev/null || true

if [ -x "$LAZYDEV_HOME/runtime-node/node" ]; then
  RUN_NODE="$LAZYDEV_HOME/runtime-node/node"
else
  RUN_NODE="$NODE_BIN"
fi

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
export PATH="$KIMI_BIN_DIRS:\$PATH"
exec "\$NODE_BIN" "\$LAZYDEV_ROOT/scripts/lazydev.mjs" "\$@"
EOF
chmod 755 "$LAZYDEV_LAUNCHER"

# Make the command available in the current shell and in common future shells.
PATH="$LAZYDEV_BIN_DIR:$PATH"
export PATH
case "${SHELL:-}" in
  */zsh) RC_FILE="$HOME/.zshrc" ;;
  */fish) RC_FILE="$HOME/.config/fish/config.fish" ;;
  *) RC_FILE="$HOME/.bashrc" ;;
esac
if [ "$(basename "${SHELL:-sh}")" = "fish" ]; then
  mkdir -p "$(dirname "$RC_FILE")"
  grep -Fqx "fish_add_path '$LAZYDEV_BIN_DIR' '$HOME/.kimi-code/bin' '$HOME/.local/bin'" "$RC_FILE" 2>/dev/null || printf "fish_add_path '%s' '%s' '%s'\n" "$LAZYDEV_BIN_DIR" "$HOME/.kimi-code/bin" "$HOME/.local/bin" >> "$RC_FILE"
elif [ -f "$RC_FILE" ]; then
  grep -Fqx "export PATH=\"$LAZYDEV_BIN_DIR:$HOME/.kimi-code/bin:$HOME/.local/bin:\$PATH\"" "$RC_FILE" 2>/dev/null || printf "export PATH=\"%s:%s:%s:\$PATH\"\n" "$LAZYDEV_BIN_DIR" "$HOME/.kimi-code/bin" "$HOME/.local/bin" >> "$RC_FILE"
else
  printf "export PATH=\"%s:%s:%s:\$PATH\"\n" "$LAZYDEV_BIN_DIR" "$HOME/.kimi-code/bin" "$HOME/.local/bin" > "$RC_FILE"
fi

printf '\n'
say "✓ Kimi Code: $($KIMI_COMMAND --version 2>/dev/null || printf '%s' "$KIMI_VERSION")"
say "✓ Lazy Developer: $($LAZYDEV_LAUNCHER --version 2>/dev/null || printf '%s' "$LAZYDEV_VERSION")"
say "✓ Install location: $LAZYDEV_HOME"
say ""
say "Next:"
say "  lazydev setup"
say "  lazydev chat"
say ""
say "Run this same installer again whenever you want to update or repair Lazy Developer."
