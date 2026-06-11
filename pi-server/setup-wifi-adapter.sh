#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║       ChowBox WiFi Adapter Setup (TP-Link AX1800)          ║
# ║  Installs RTL8832AU driver for TP-Link Archer TX20U Plus   ║
# ║  Sets up dual-WiFi: wlan1=internet, ap0=customer hotspot   ║
# ║                                                             ║
# ║  Usage: sudo ./setup-wifi-adapter.sh <SSID> <PASSWORD>     ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

SSID="${1:-}"
PASSWORD="${2:-}"

if [ -z "$SSID" ] || [ -z "$PASSWORD" ]; then
    echo "Usage: sudo $0 <WiFi-SSID> <WiFi-Password>"
    echo "  Connect the TP-Link AX1800 USB adapter to your phone hotspot or venue WiFi"
    exit 1
fi

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   ChowBox WiFi Adapter Setup        ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# ─── 1. Install build dependencies ──────────────────────────
echo "[1/7] Installing build tools..."
apt-get update -qq
apt-get install -y -qq git dkms bc build-essential iptables
# Kernel headers should already be installed; if not:
apt-get install -y -qq linux-headers-rpi-2712 2>/dev/null || true

# ─── 2. Blacklist broken in-kernel driver ────────────────────
echo "[2/7] Blacklisting broken rtw88 driver..."
echo 'blacklist rtw88_8822bu' > /etc/modprobe.d/blacklist-rtw88.conf

# ─── 3. Clone and install RTL8832AU driver ───────────────────
echo "[3/7] Installing RTL8832AU driver (lwfinger/rtl8852au)..."
DRIVER_DIR="/usr/src/rtl8852au-1.0"
if [ ! -d "$DRIVER_DIR" ]; then
    cd /tmp
    rm -rf rtl8852au 2>/dev/null
    git clone --depth 1 https://github.com/lwfinger/rtl8852au.git
    cp -r rtl8852au "$DRIVER_DIR"
    rm -rf rtl8852au
fi

if ! dkms status rtl8852au/1.0 2>/dev/null | grep -q "installed"; then
    dkms add rtl8852au/1.0 2>/dev/null || true
    dkms build rtl8852au/1.0
    dkms install rtl8852au/1.0
fi

# Persist module load on boot
echo '8852au' > /etc/modules-load.d/8852au.conf
modprobe 8852au 2>/dev/null || true

# Wait for wlan1 to appear
echo "  Waiting for wlan1..."
for i in $(seq 1 10); do
    ip link show wlan1 &>/dev/null && break
    sleep 2
done

if ! ip link show wlan1 &>/dev/null; then
    echo "  ERROR: wlan1 did not appear. Is the TP-Link adapter plugged in?"
    echo "  Supported: TP-Link Archer TX20U Plus (USB ID 2357:013f, RTL8832AU)"
    exit 1
fi
echo "  wlan1 detected!"

# ─── 4. Set WiFi country code ───────────────────────────────
echo "[4/7] Setting WiFi country to AU..."
raspi-config nonint do_wifi_country AU 2>/dev/null || true

# ─── 5. Connect wlan1 to internet source ────────────────────
echo "[5/7] Connecting wlan1 to '$SSID'..."
# Remove any existing profile for this SSID on wlan1
nmcli con delete "ChowBox-Internet" 2>/dev/null || true

nmcli con add type wifi ifname wlan1 con-name "ChowBox-Internet" \
    ssid "$SSID" \
    wifi-sec.key-mgmt wpa-psk \
    wifi-sec.psk "$PASSWORD"
nmcli con modify "ChowBox-Internet" \
    connection.autoconnect yes \
    connection.autoconnect-priority 100
nmcli con up "ChowBox-Internet"

echo "  Connected! IP: $(ip -4 addr show wlan1 | grep -oP 'inet \K[\d.]+')"

# ─── 6. Configure NetworkManager ────────────────────────────
echo "[6/7] Configuring NetworkManager..."
cat > /etc/NetworkManager/conf.d/chowbox-wifi.conf << 'EOF'
[connection]
wifi.powersave = 2

[keyfile]
unmanaged-devices=interface-name:ap0
EOF
chmod 600 /etc/NetworkManager/conf.d/chowbox-wifi.conf

# ─── 7. NAT routing + watchdog ───────────────────────────────
echo "[7/7] Setting up NAT routing and watchdog..."

# NAT dispatcher — fires when wlan1 comes up
cat > /etc/NetworkManager/dispatcher.d/90-chowbox-nat << 'NATEOF'
#!/bin/bash
IFACE=$1
ACTION=$2
if [ "$IFACE" = "wlan1" ] && [ "$ACTION" = "up" ]; then
    iptables -t nat -F
    iptables -F FORWARD
    iptables -t nat -A POSTROUTING -o wlan1 -j MASQUERADE
    iptables -A FORWARD -i ap0 -o wlan1 -j ACCEPT
    iptables -A FORWARD -i wlan1 -o ap0 -m state --state RELATED,ESTABLISHED -j ACCEPT
    echo 1 > /proc/sys/net/ipv4/ip_forward
    logger "ChowBox: NAT routing via wlan1 restored"
fi
NATEOF
chmod +x /etc/NetworkManager/dispatcher.d/90-chowbox-nat

# Apply NAT rules now
iptables -t nat -A POSTROUTING -o wlan1 -j MASQUERADE 2>/dev/null || true
iptables -A FORWARD -i ap0 -o wlan1 -j ACCEPT 2>/dev/null || true
iptables -A FORWARD -i wlan1 -o ap0 -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
echo 1 > /proc/sys/net/ipv4/ip_forward

# WiFi watchdog — reconnects wlan1 if it drops
cat > /usr/local/bin/chowbox-watchdog.sh << 'WDEOF'
#!/bin/bash
GATEWAY=$(nmcli -g IP4.GATEWAY con show ChowBox-Internet 2>/dev/null)
[ -z "$GATEWAY" ] && exit 0
if ! ping -c 1 -W 3 -I wlan1 $GATEWAY > /dev/null 2>&1; then
    logger "ChowBox: wlan1 down, reconnecting"
    nmcli con down ChowBox-Internet 2>/dev/null
    sleep 2
    nmcli con up ChowBox-Internet 2>/dev/null
fi
if systemctl is-enabled cloudflared &>/dev/null; then
    if ! pgrep -x cloudflared > /dev/null; then
        logger "ChowBox: tunnel dead, restarting"
        systemctl restart cloudflared
    fi
fi
WDEOF
chmod +x /usr/local/bin/chowbox-watchdog.sh

# Add cron job (idempotent)
(crontab -l 2>/dev/null | grep -v chowbox-watchdog; echo "*/2 * * * * /usr/local/bin/chowbox-watchdog.sh") | crontab -

systemctl restart NetworkManager
sleep 3

# ─── Verify ──────────────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   WiFi Adapter Setup — Complete!     ║"
echo "  ╠══════════════════════════════════════╣"
echo "  ║                                      ║"
echo "  ║  wlan1 → Internet ($SSID)            ║"
echo "  ║  ap0   → Customer hotspot            ║"
echo "  ║  NAT routing active                  ║"
echo "  ║  Watchdog running (every 2 min)      ║"
echo "  ║                                      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Quick connectivity test
if ping -c 1 -W 3 -I wlan1 1.1.1.1 &>/dev/null; then
    echo "  Internet: OK (via wlan1)"
else
    echo "  Internet: FAILED — check SSID/password"
fi
