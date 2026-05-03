#!/usr/bin/env bash
# Build the Fitro360 relay agent .deb package.
# Output: relay-agent/dist/fitro360-relay_<version>_all.deb
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(node -p "require('$ROOT/package.json').version")
STAGE="$ROOT/packaging/deb"
OUT_DIR="$ROOT/dist"
DEB="$OUT_DIR/fitro360-relay_${VERSION}_all.deb"

mkdir -p "$OUT_DIR" \
  "$STAGE/opt/fitro360-relay/src" \
  "$STAGE/etc/fitro360" \
  "$STAGE/lib/systemd/system"

# Stage the agent source. We always build from a clean slate so the
# packaging tree never holds a stale copy of src/ that could drift from
# the canonical relay-agent/src/.
rm -rf "$STAGE/opt"
mkdir -p "$STAGE/opt/fitro360-relay"
cp -r "$ROOT/src" "$STAGE/opt/fitro360-relay/src"
cp "$ROOT/package.json" "$STAGE/opt/fitro360-relay/"
cp "$ROOT/config.example.json" "$STAGE/etc/fitro360/config.example.json"
cp "$ROOT/scripts/fitro360-relay.service" "$STAGE/lib/systemd/system/fitro360-relay.service"

# Clean up at the end too so committing the tree never re-introduces drift.
trap 'rm -rf "$STAGE/opt"' EXIT

# Set permissions on maintainer scripts.
chmod 755 "$STAGE/DEBIAN/postinst" "$STAGE/DEBIAN/prerm"

# Sync the version inside DEBIAN/control with package.json so the .deb
# version always matches the agent's reported --version.
sed -i "s/^Version: .*/Version: ${VERSION}/" "$STAGE/DEBIAN/control"

if ! command -v dpkg-deb >/dev/null 2>&1; then
  echo "dpkg-deb not found. Install with: sudo apt-get install -y dpkg" >&2
  exit 1
fi

dpkg-deb --build --root-owner-group "$STAGE" "$DEB"
echo "Built: $DEB"
