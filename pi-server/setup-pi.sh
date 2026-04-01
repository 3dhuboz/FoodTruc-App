#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Street Eats — Raspberry Pi Setup Script
# Run this once on a fresh Pi to set everything up.
#
# Usage:
#   chmod +x setup-pi.sh
#   sudo ./setup-pi.sh
#
# What it does:
# 1. Installs Node.js 20 LTS
# 2. Installs dependencies
# 3. Creates the local SQLite database
# 4. Configures WiFi hotspot (creates "StreetEats" network)
# 5. Sets up captive portal (auto-redirect to ordering page)
# 6. Configures auto-start on boot
# ═══════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSID="StreetEats"
PI_IP="192.168.4.1"
# Open network — no password needed for customers to connect

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║    STREET EATS — Pi Setup                ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# ── 1. Install Node.js ──
if ! command -v node &> /dev/null; then
    echo "[1/6] Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "[1/6] Node.js already installed: $(node -v)"
fi

# ── 2. Install dependencies ──
echo "[2/6] Installing npm dependencies..."
cd "$SCRIPT_DIR"
npm install --production

# ── 3. Setup database ──
echo "[3/6] Setting up SQLite database..."
node setup-db.js

# ── 4. Configure WiFi Hotspot ──
echo "[4/6] Configuring WiFi hotspot: $SSID..."

# Install hostapd + dnsmasq
apt-get install -y hostapd dnsmasq

# Stop services while configuring
systemctl stop hostapd 2>/dev/null || true
systemctl stop dnsmasq 2>/dev/null || true

# Configure static IP for wlan0
cat > /etc/dhcpcd.conf.d/street-eats.conf << EOF
interface wlan0
    static ip_address=${PI_IP}/24
    nohook wpa_supplicant
EOF

# Hostapd config — OPEN network (no password = zero friction for customers)
cat > /etc/hostapd/hostapd.conf << EOF
interface=wlan0
driver=nl80211
ssid=${SSID}
hw_mode=g
channel=7
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
# No WPA = open network. Customers connect with one tap.
# This is safe because no sensitive data flows — just food orders.
EOF

# Point hostapd to our config
sed -i 's|#DAEMON_CONF=""|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd 2>/dev/null || true

# ── 5. Captive Portal (dnsmasq) ──
echo "[5/6] Configuring captive portal..."

# Dnsmasq: DHCP + DNS that redirects all domains to the Pi
cat > /etc/dnsmasq.d/street-eats.conf << EOF
# DHCP for the hotspot
interface=wlan0
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h

# Redirect ALL DNS queries to the Pi (captive portal)
address=/#/${PI_IP}
EOF

# Enable IP forwarding (needed for captive portal)
echo 1 > /proc/sys/net/ipv4/ip_forward
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf 2>/dev/null || true

# ── 6. Auto-start on boot ──
echo "[6/6] Configuring auto-start..."

cat > /etc/systemd/system/street-eats.service << EOF
[Unit]
Description=Street Eats Local Server
After=network.target hostapd.service dnsmasq.service

[Service]
Type=simple
User=root
WorkingDirectory=${SCRIPT_DIR}
ExecStart=/usr/bin/node ${SCRIPT_DIR}/server.js
Restart=always
RestartSec=5
Environment=PORT=80
Environment=CLOUD_URL=https://foodtruck-app.pages.dev

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable hostapd
systemctl enable dnsmasq
systemctl enable street-eats

# Start everything
systemctl start hostapd
systemctl start dnsmasq
systemctl start street-eats

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║           SETUP COMPLETE!                ║"
echo "  ╠══════════════════════════════════════════╣"
echo "  ║                                          ║"
echo "  ║  WiFi Network: ${SSID}               ║"
echo "  ║  WiFi Password: (open — no password)     ║"
echo "  ║                                          ║"
echo "  ║  Server: http://${PI_IP}              ║"
echo "  ║  QR URL: http://${PI_IP}/#/qr-order  ║"
echo "  ║                                          ║"
echo "  ║  Customers:                              ║"
echo "  ║  1. Connect to '${SSID}' WiFi        ║"
echo "  ║  2. Phone auto-opens ordering page       ║"
echo "  ║  3. Or scan QR code on the truck         ║"
echo "  ║                                          ║"
echo "  ║  The server auto-starts on boot.         ║"
echo "  ║  Cloud sync happens when internet is     ║"
echo "  ║  available (plug in ethernet or bridge    ║"
echo "  ║  to a phone hotspot).                    ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""
