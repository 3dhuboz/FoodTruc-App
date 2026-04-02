#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Street Eats — Raspberry Pi 5 Setup Script
#
# Hardware:
#   - Raspberry Pi 5
#   - USB WiFi adapter with antenna (hotspot for customers)
#   - Pi's built-in WiFi (connects to phone hotspot for internet)
#
# What this script does:
#   1. Installs Node.js 20 LTS
#   2. Installs dependencies + creates SQLite database
#   3. Detects USB WiFi adapter
#   4. Configures USB adapter as "StreetEats" open hotspot
#   5. Keeps built-in WiFi free for phone hotspot connection
#   6. Sets up NAT routing (customers get internet via phone data)
#   7. Captive portal (auto-redirect to ordering page)
#   8. Aggressive cloud sync (every 5s, one order at a time)
#   9. Auto-start on boot
#
# Usage:
#   chmod +x setup-pi.sh
#   sudo ./setup-pi.sh
#
# After setup:
#   - Pi boots → StreetEats WiFi appears (USB antenna, good range)
#   - Connect Pi to your phone hotspot for internet (built-in WiFi)
#   - Customers scan QR → join StreetEats → order
#   - Orders stored locally + synced to cloud when signal exists
# ═══════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSID="StreetEats"
HOTSPOT_IP="192.168.4.1"
HOTSPOT_RANGE_START="192.168.4.2"
HOTSPOT_RANGE_END="192.168.4.100"

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║    STREET EATS — Pi 5 Setup              ║"
echo "  ║    USB Antenna + Phone Hotspot Mode       ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# ── 1. Install Node.js ──
if ! command -v node &> /dev/null; then
    echo "[1/9] Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "[1/9] Node.js already installed: $(node -v)"
fi

# ── 2. Install deps + setup DB ──
echo "[2/9] Installing dependencies..."
cd "$SCRIPT_DIR"
npm install --production

echo "[3/9] Setting up SQLite database..."
node setup-db.js

# ── 4. Detect USB WiFi adapter ──
echo "[4/9] Detecting WiFi interfaces..."

# Built-in WiFi is always wlan0 on Pi 5
BUILTIN_WIFI="wlan0"
USB_WIFI=""

# Find USB WiFi adapter (wlan1, wlan2, etc.)
for iface in $(ls /sys/class/net/ | grep wlan | sort); do
    if [ "$iface" != "$BUILTIN_WIFI" ]; then
        USB_WIFI="$iface"
        break
    fi
done

if [ -z "$USB_WIFI" ]; then
    echo ""
    echo "  ⚠️  No USB WiFi adapter detected!"
    echo "  Please plug in a USB WiFi adapter and run this script again."
    echo "  Recommended: TP-Link Archer T3U Plus (~\$35 AUD)"
    echo ""
    echo "  Falling back to built-in WiFi (limited range ~10-15m)..."
    USB_WIFI="wlan0"
    BUILTIN_WIFI=""
    echo "  Hotspot: $USB_WIFI (built-in)"
    echo "  Internet: ethernet or USB tethering only"
else
    echo "  Found USB WiFi adapter: $USB_WIFI"
    echo "  Built-in WiFi ($BUILTIN_WIFI) → phone hotspot connection"
    echo "  USB WiFi ($USB_WIFI) → StreetEats customer hotspot"
fi

# ── 5. Install required packages ──
echo "[5/9] Installing hostapd + dnsmasq + iptables..."
apt-get update -qq
apt-get install -y hostapd dnsmasq iptables-persistent

systemctl stop hostapd 2>/dev/null || true
systemctl stop dnsmasq 2>/dev/null || true

# ── 6. Configure USB WiFi as hotspot ──
echo "[6/9] Configuring hotspot on $USB_WIFI..."

# Static IP for the hotspot interface
cat > /etc/network/interfaces.d/street-eats-hotspot << EOF
# Street Eats — USB WiFi hotspot
auto $USB_WIFI
iface $USB_WIFI inet static
    address $HOTSPOT_IP
    netmask 255.255.255.0
EOF

# Bring up the interface with static IP
ip addr flush dev $USB_WIFI 2>/dev/null || true
ip addr add ${HOTSPOT_IP}/24 dev $USB_WIFI 2>/dev/null || true
ip link set $USB_WIFI up 2>/dev/null || true

# Hostapd config — use USB adapter for the hotspot
cat > /etc/hostapd/hostapd.conf << EOF
# Street Eats customer hotspot
interface=$USB_WIFI
driver=nl80211
ssid=$SSID
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
# Open network — zero friction for customers
# No WPA — customers connect with one tap
# Safe because only food orders flow through this network
EOF

echo "DAEMON_CONF=\"/etc/hostapd/hostapd.conf\"" > /etc/default/hostapd

# ── 7. Configure DHCP + Captive Portal ──
echo "[7/9] Configuring DHCP + captive portal..."

# Back up original dnsmasq config
cp /etc/dnsmasq.conf /etc/dnsmasq.conf.backup 2>/dev/null || true

cat > /etc/dnsmasq.conf << EOF
# Street Eats — DHCP + Captive Portal
# Only listen on the hotspot interface
interface=$USB_WIFI
bind-interfaces

# DHCP range — supports up to 98 simultaneous customers
dhcp-range=${HOTSPOT_RANGE_START},${HOTSPOT_RANGE_END},255.255.255.0,2h

# Redirect ALL DNS to the Pi (captive portal)
address=/#/${HOTSPOT_IP}

# Speed up DHCP
dhcp-authoritative
EOF

# ── 8. Configure NAT routing ──
echo "[8/9] Configuring NAT routing (customers get internet via phone)..."

# Enable IP forwarding
sysctl -w net.ipv4.ip_forward=1
sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf
grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf || echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf

# NAT rules: forward traffic from hotspot → internet interface
# This script runs on boot to set up NAT based on whichever interface has internet
cat > /usr/local/bin/street-eats-nat.sh << 'NATEOF'
#!/bin/bash
# Street Eats — NAT routing setup
# Runs on boot and periodically to detect internet interface

# Clear existing NAT rules
iptables -t nat -F POSTROUTING 2>/dev/null

# Find the interface that has a default route (= internet)
INET_IFACE=$(ip route | grep default | head -1 | awk '{print $5}')

if [ -n "$INET_IFACE" ] && [ "$INET_IFACE" != "HOTSPOT_IFACE_PLACEHOLDER" ]; then
    # Enable NAT from hotspot to internet
    iptables -t nat -A POSTROUTING -o "$INET_IFACE" -j MASQUERADE
    iptables -A FORWARD -i HOTSPOT_IFACE_PLACEHOLDER -o "$INET_IFACE" -j ACCEPT
    iptables -A FORWARD -i "$INET_IFACE" -o HOTSPOT_IFACE_PLACEHOLDER -m state --state RELATED,ESTABLISHED -j ACCEPT
    echo "[NAT] Routing hotspot traffic through $INET_IFACE"
else
    echo "[NAT] No internet interface found — local mode only"
fi
NATEOF

# Replace placeholder with actual hotspot interface
sed -i "s/HOTSPOT_IFACE_PLACEHOLDER/$USB_WIFI/g" /usr/local/bin/street-eats-nat.sh
chmod +x /usr/local/bin/street-eats-nat.sh

# Run NAT setup now
/usr/local/bin/street-eats-nat.sh

# ── 9. Auto-start on boot ──
echo "[9/9] Configuring auto-start..."

# Cron job to refresh NAT every 30s (detects phone hotspot connect/disconnect)
(crontab -l 2>/dev/null | grep -v street-eats-nat; echo "* * * * * /usr/local/bin/street-eats-nat.sh >> /var/log/street-eats-nat.log 2>&1") | crontab -

# Systemd service for the Node.js server
cat > /etc/systemd/system/street-eats.service << EOF
[Unit]
Description=Street Eats Local Server
After=network.target hostapd.service dnsmasq.service
Wants=hostapd.service dnsmasq.service

[Service]
Type=simple
User=root
WorkingDirectory=${SCRIPT_DIR}
ExecStartPre=/usr/local/bin/street-eats-nat.sh
ExecStart=/usr/bin/node ${SCRIPT_DIR}/server.js
Restart=always
RestartSec=5
Environment=PORT=80
Environment=CLOUD_URL=https://foodtruck-app.pages.dev
Environment=SYNC_INTERVAL=5000

[Install]
WantedBy=multi-user.target
EOF

# Helper script to connect to phone hotspot
cat > /usr/local/bin/street-eats-connect-phone.sh << 'PHONEEOF'
#!/bin/bash
# Connect Pi's built-in WiFi to your phone's hotspot
# Usage: sudo street-eats-connect-phone.sh "YourPhoneName" "password"

if [ $# -lt 2 ]; then
    echo "Usage: sudo $0 <phone-hotspot-name> <password>"
    echo "Example: sudo $0 \"Steve's iPhone\" mypassword123"
    exit 1
fi

PHONE_SSID="$1"
PHONE_PASS="$2"
BUILTIN="wlan0"

# Check if built-in WiFi is available (not used for hotspot)
if grep -q "$BUILTIN" /etc/hostapd/hostapd.conf; then
    echo "Built-in WiFi is being used for hotspot. Need USB adapter for dual-WiFi."
    exit 1
fi

# Connect to phone hotspot
nmcli dev wifi connect "$PHONE_SSID" password "$PHONE_PASS" ifname "$BUILTIN" 2>/dev/null || \
wpa_cli -i "$BUILTIN" reconfigure 2>/dev/null

# Add to saved networks for auto-reconnect
cat > /etc/wpa_supplicant/wpa_supplicant-${BUILTIN}.conf << WPAEOF
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=AU

network={
    ssid="$PHONE_SSID"
    psk="$PHONE_PASS"
    key_mgmt=WPA-PSK
    priority=1
}
WPAEOF

systemctl enable wpa_supplicant@${BUILTIN} 2>/dev/null || true
systemctl restart wpa_supplicant@${BUILTIN} 2>/dev/null || true

echo "Connected to '$PHONE_SSID' on $BUILTIN"
echo "Pi will auto-reconnect to this hotspot on future boots."

# Refresh NAT routing
/usr/local/bin/street-eats-nat.sh
PHONEEOF
chmod +x /usr/local/bin/street-eats-connect-phone.sh

systemctl daemon-reload
systemctl unmask hostapd 2>/dev/null || true
systemctl enable hostapd
systemctl enable dnsmasq
systemctl enable street-eats

# Start everything
systemctl restart hostapd
systemctl restart dnsmasq
systemctl restart street-eats

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║             SETUP COMPLETE!                  ║"
echo "  ╠══════════════════════════════════════════════╣"
echo "  ║                                              ║"
echo "  ║  Hotspot: $SSID (on $USB_WIFI)   ║"
echo "  ║  Password: (open network)                    ║"
echo "  ║  Server: http://${HOTSPOT_IP}                ║"
echo "  ║                                              ║"
echo "  ║  ── NEXT STEP ──                             ║"
echo "  ║  Connect Pi to your phone hotspot:           ║"
echo "  ║                                              ║"
echo "  ║  sudo street-eats-connect-phone.sh \\         ║"
echo "  ║    \"YourPhone\" \"password\"                    ║"
echo "  ║                                              ║"
echo "  ║  Pi auto-reconnects on future boots.         ║"
echo "  ║  NAT refreshes every 60s.                    ║"
echo "  ║  Cloud sync every 5s when internet exists.   ║"
echo "  ║                                              ║"
echo "  ║  ── CUSTOMER FLOW ──                         ║"
echo "  ║  1. Scan WiFi QR → auto-joins StreetEats     ║"
echo "  ║  2. Menu opens (captive portal)              ║"
echo "  ║  3. Order + pay at window                    ║"
echo "  ║  4. BOH cooks → bumps → SMS when ready       ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
