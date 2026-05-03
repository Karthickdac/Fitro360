#!/usr/bin/env bash
# Fitro360 relay agent — Linux installer.
# Tested on Ubuntu 22.04 / Debian 12. Run as root.
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root (sudo $0)" >&2
  exit 1
fi

INSTALL_DIR=/opt/fitro360-relay
CONFIG_DIR=/etc/fitro360
LOG_DIR=/var/log/fitro360
SERVICE=/etc/systemd/system/fitro360-relay.service
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required. Install with:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt-get install -y nodejs"
  exit 1
fi

# Enforce Node >= 18 — the agent uses the global `fetch` introduced in 18.
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "${NODE_MAJOR}" -lt 18 ]; then
  echo "Detected Node.js v$(node -v). The relay agent requires Node.js 18 or newer." >&2
  echo "Install a newer release with NodeSource and re-run:" >&2
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt-get install -y nodejs" >&2
  exit 1
fi

id -u fitro360 >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin fitro360

mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$LOG_DIR"
cp -r "$SRC_DIR/src" "$INSTALL_DIR/"
cp "$SRC_DIR/package.json" "$INSTALL_DIR/"
cp "$SRC_DIR/config.example.json" "$INSTALL_DIR/"

if [[ ! -f "$CONFIG_DIR/config.json" ]]; then
  cp "$SRC_DIR/config.example.json" "$CONFIG_DIR/config.json"
  chmod 600 "$CONFIG_DIR/config.json"
  chown fitro360:fitro360 "$CONFIG_DIR/config.json"
  echo ">>> Edit $CONFIG_DIR/config.json with your cloudUrl, device serial, and secret."
fi

chown -R fitro360:fitro360 "$INSTALL_DIR" "$LOG_DIR"

cp "$SRC_DIR/scripts/fitro360-relay.service" "$SERVICE"
systemctl daemon-reload
systemctl enable fitro360-relay.service

echo ""
echo "Installed. Next steps:"
echo "  1. Edit $CONFIG_DIR/config.json"
echo "  2. sudo systemctl start fitro360-relay"
echo "  3. sudo journalctl -u fitro360-relay -f"
