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
cp "$ROOT/installer/setup-gui.ps1" "$STAGE/setup-gui.ps1"
cp "$ROOT/installer/manager.ps1"   "$STAGE/manager.ps1"
cp "$ROOT/installer/install.ps1"   "$STAGE/install.ps1"
cp "$ROOT/installer/uninstall.ps1" "$STAGE/uninstall.ps1"
cp "$ROOT/installer/Install Fitro360 Relay.vbs"   "$STAGE/Install Fitro360 Relay.vbs"
cp "$ROOT/installer/Uninstall Fitro360 Relay.vbs" "$STAGE/Uninstall Fitro360 Relay.vbs"
cp "$ROOT/installer/Open Relay Manager.vbs"       "$STAGE/Open Relay Manager.vbs"
cp "$ROOT/installer/Open Relay Manager.bat"       "$STAGE/Open Relay Manager.bat"

# Pack the staged release. Three fallbacks so this works on any sane
# build host: Linux/macOS with `zip`, Windows hosts via PowerShell
# Compress-Archive, and bare-metal CI (Replit / minimal Nix) via the
# pure-Node writer in scripts/zip-dir.js.
if command -v zip >/dev/null 2>&1; then
  ( cd "$STAGE" && zip -r "$ZIP" . )
elif command -v powershell >/dev/null 2>&1; then
  powershell -NoProfile -Command "Compress-Archive -Force -Path '$STAGE\\*' -DestinationPath '$ZIP'"
else
  node "$ROOT/scripts/zip-dir.js" "$STAGE" "$ZIP"
fi

echo ""
echo "✓ Built: $ZIP"
ls -lh "$ZIP"
