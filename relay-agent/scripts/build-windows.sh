#!/usr/bin/env bash
# Build a self-contained Windows release zip for the Fitro360 relay agent.
#
# Output:  dist/fitro360-relay-windows.zip
# Contents:
#   fitro360-relay.exe        single-file binary (no Node install required)
#   install.bat               one-click installer (wizard + service registration)
#   uninstall.bat             one-click service remover
#   README.txt                quick-start instructions
#
# Run on any Linux/macOS/Windows machine with Node.js 18+. Requires the
# `@yao-pkg/pkg` packager (the maintained fork of vercel/pkg, supports
# modern Node runtimes).
#
#   npm install -g @yao-pkg/pkg
#   bash scripts/build-windows.sh

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
VERSION="$(node -p "require('./package.json').version")"

DIST="$ROOT/dist"
STAGE="$DIST/windows"
ZIP="$DIST/fitro360-relay-windows-v${VERSION}.zip"

echo "→ Building Fitro360 relay agent v${VERSION} for Windows…"
rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE"

PKG_BIN=""
if command -v pkg >/dev/null 2>&1; then PKG_BIN="pkg"; fi
if command -v npx >/dev/null 2>&1 && [[ -z "$PKG_BIN" ]]; then PKG_BIN="npx --yes @yao-pkg/pkg"; fi
if [[ -z "$PKG_BIN" ]]; then
  echo "ERROR: pkg not found. Install with:  npm install -g @yao-pkg/pkg" >&2
  exit 1
fi

# `node20-win-x64` produces a 64-bit Windows binary (~50 MB) with the
# Node 20 runtime bundled. We compress to shrink ~30%.
$PKG_BIN . --targets node20-win-x64 --compress GZip \
  --output "$STAGE/fitro360-relay.exe"

cp "$ROOT/installer/install.bat"   "$STAGE/install.bat"
cp "$ROOT/installer/uninstall.bat" "$STAGE/uninstall.bat"
cp "$ROOT/installer/README.txt"    "$STAGE/README.txt"

# Use Node to zip so we don't depend on `zip` being installed on the
# build host (CI runners often lack it).
node -e "
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const stage='${STAGE}', out='${ZIP}';
try {
  execSync('zip -j -r ' + JSON.stringify(out) + ' ' + JSON.stringify(stage), {stdio:'inherit'});
} catch {
  // Fallback: PowerShell Compress-Archive when running on Windows.
  execSync('powershell -NoProfile -Command \"Compress-Archive -Force -Path ' + stage + '\\\\* -DestinationPath ' + out + '\"', {stdio:'inherit'});
}
"

echo ""
echo "✓ Built: $ZIP"
ls -lh "$ZIP"
