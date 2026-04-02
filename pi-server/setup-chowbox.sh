#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║              ChowBox Setup Script v1.0                      ║
# ║  Run this on a fresh Raspberry Pi OS Lite installation      ║
# ║  Usage: curl -sL https://raw.githubusercontent.com/3dhuboz/FoodTruc-App/main/pi-server/setup-chowbox.sh | sudo bash  ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║     ChowBox Setup — Starting...      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# ─── 1. System Update ────────────────────────────────────────
echo "[1/8] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ─── 2. Install Node.js 20 LTS ──────────────────────────────
echo "[2/8] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "  Node.js $(node -v), npm $(npm -v)"

# ─── 3. Install Git ─────────────────────────────────────────
echo "[3/8] Installing git..."
apt-get install -y -qq git

# ─── 4. Clone ChowNow App ───────────────────────────────────
INSTALL_DIR="/opt/chowbox"
echo "[4/8] Cloning ChowNow to $INSTALL_DIR..."
if [ -d "$INSTALL_DIR" ]; then
    cd "$INSTALL_DIR" && git pull
else
    git clone https://github.com/3dhuboz/FoodTruc-App.git "$INSTALL_DIR"
fi

# ─── 5. Build Frontend ──────────────────────────────────────
echo "[5/8] Building frontend..."
cd "$INSTALL_DIR"
npm install --production=false
npm run build

# ─── 6. Install Pi Server Dependencies ──────────────────────
echo "[6/8] Installing Pi server dependencies..."
cd "$INSTALL_DIR/pi-server"
npm install --production

# ─── 7. Setup Database ──────────────────────────────────────
echo "[7/8] Setting up local database..."
node setup-db.js

# ─── 8. Create systemd Service ──────────────────────────────
echo "[8/8] Creating ChowBox service..."
cat > /etc/systemd/system/chowbox.service << 'UNIT'
[Unit]
Description=ChowBox - ChowNow Local Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/chowbox/pi-server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=PORT=80
Environment=CLOUD_URL=https://chownow.au
Environment=NODE_ENV=production
Environment=TENANT_ID=default

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable chowbox
systemctl start chowbox

# ─── USB Printer Permissions ─────────────────────────────────
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="*", MODE="0666"' > /etc/udev/rules.d/99-usb-printer.rules
udevadm control --reload-rules

# ─── Cloudflare Tunnel (optional) ────────────────────────────
# Provides remote access to this ChowBox from anywhere.
# Pass TUNNEL_TOKEN as an argument: sudo ./setup-chowbox.sh <tunnel-token>
if [ -n "$1" ]; then
  echo "[9/9] Setting up Cloudflare Tunnel..."

  # Install cloudflared
  if ! command -v cloudflared &> /dev/null; then
    curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
    dpkg -i /tmp/cloudflared.deb
    rm /tmp/cloudflared.deb
  fi

  # Create tunnel service
  cat > /etc/systemd/system/chowbox-tunnel.service << TUNNEL
[Unit]
Description=ChowBox Cloudflare Tunnel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run --token $1
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
TUNNEL

  # Add TUNNEL_URL to the ChowBox service so heartbeats include it
  mkdir -p /etc/systemd/system/chowbox.service.d
  cat > /etc/systemd/system/chowbox.service.d/tunnel.conf << OVERRIDE
[Service]
Environment=TUNNEL_URL=https://box-$(hostname).chownow.au
OVERRIDE

  systemctl daemon-reload
  systemctl enable chowbox-tunnel
  systemctl start chowbox-tunnel
  systemctl restart chowbox

  echo "  Tunnel active: https://box-$(hostname).chownow.au"
else
  echo "[Tunnel] Skipped — pass tunnel token as argument to enable."
  echo "  Usage: sudo ./setup-chowbox.sh <cloudflare-tunnel-token>"
fi

# ─── Done ────────────────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║     ChowBox Setup — Complete!        ║"
echo "  ╠══════════════════════════════════════╣"
echo "  ║                                      ║"
echo "  ║  Server running on port 80           ║"
echo "  ║  Admin:  http://$(hostname -I | awk '{print $1}')     ║"
echo "  ║  Status: systemctl status chowbox    ║"
echo "  ║  Logs:   journalctl -u chowbox -f    ║"
echo "  ║                                      ║"
echo "  ║  Plug in USB thermal printer for     ║"
echo "  ║  auto-print order labels.            ║"
echo "  ║                                      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
