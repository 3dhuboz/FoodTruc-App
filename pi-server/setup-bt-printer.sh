#!/bin/bash
# Setup a Bluetooth thermal printer on the ChowBox Pi.
#
# Usage:
#   sudo bash setup-bt-printer.sh           # Interactive scan + pair
#   sudo bash setup-bt-printer.sh XX:XX:XX  # Pair with known address
#
# Supports 58mm and 80mm ESC/POS thermal printers over Bluetooth SPP.
# Common models: Xprinter XP-58, PeriPage A6, MTP-II, Goojprt PT-210

set -e

echo "╔══════════════════════════════════════╗"
echo "║  ChowNow — BT Printer Setup         ║"
echo "╚══════════════════════════════════════╝"

# Install Bluetooth tools if missing
if ! command -v bluetoothctl &>/dev/null; then
  echo "[*] Installing Bluetooth tools..."
  apt-get update -qq && apt-get install -y -qq bluez bluetooth
fi

# Enable Bluetooth service
systemctl enable bluetooth
systemctl start bluetooth

BT_ADDR="$1"

if [ -z "$BT_ADDR" ]; then
  echo ""
  echo "[*] Scanning for Bluetooth devices (10 seconds)..."
  echo "    Make sure your printer is powered on and in pairing mode."
  echo ""

  # Scan and display devices
  timeout 10 bluetoothctl scan on &>/dev/null &
  sleep 10

  echo ""
  echo "[*] Found devices:"
  bluetoothctl devices | grep -v "^$" | nl -ba
  echo ""
  read -p "Enter the MAC address of your printer (XX:XX:XX:XX:XX:XX): " BT_ADDR
fi

if [ -z "$BT_ADDR" ]; then
  echo "[!] No address provided. Exiting."
  exit 1
fi

echo "[*] Pairing with $BT_ADDR..."
bluetoothctl pair "$BT_ADDR" || true
bluetoothctl trust "$BT_ADDR"

echo "[*] Binding rfcomm0..."
# Remove existing binding if any
rfcomm release 0 2>/dev/null || true
rfcomm bind 0 "$BT_ADDR"

# Make rfcomm binding persistent on boot
cat > /etc/systemd/system/rfcomm-printer.service <<EOF
[Unit]
Description=ChowNow BT Printer rfcomm bind
After=bluetooth.target
Requires=bluetooth.target

[Service]
Type=oneshot
ExecStart=/usr/bin/rfcomm bind 0 $BT_ADDR
ExecStop=/usr/bin/rfcomm release 0
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable rfcomm-printer.service

echo ""
echo "[*] Testing printer..."
if [ -c /dev/rfcomm0 ]; then
  # Send ESC/POS init + test line + cut
  printf '\x1b\x40' > /dev/rfcomm0          # Init
  printf '\x1b\x61\x01' > /dev/rfcomm0      # Center
  printf 'ChowNow\n' > /dev/rfcomm0         # Text
  printf 'Printer OK!\n' > /dev/rfcomm0
  printf '\x1b\x64\x03' > /dev/rfcomm0      # Feed 3
  printf '\x1d\x56\x01' > /dev/rfcomm0      # Partial cut
  echo "[OK] Test receipt sent to printer."
else
  echo "[!] /dev/rfcomm0 not found. Check that the printer is on and paired."
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  BT Printer ready!                  ║"
echo "║  Device: /dev/rfcomm0               ║"
echo "║  Address: $BT_ADDR"
echo "║  Auto-binds on boot via systemd     ║"
echo "╚══════════════════════════════════════╝"
