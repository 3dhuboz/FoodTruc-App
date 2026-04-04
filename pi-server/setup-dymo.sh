#!/bin/bash
# ─── Dymo LabelWriter 4XL Setup for Raspberry Pi ────────────────
# Installs CUPS + Dymo drivers, auto-detects the printer, and sets
# it as the default. Run once after plugging in the 4XL via USB.
#
# Usage: sudo bash setup-dymo.sh
# ─────────────────────────────────────────────────────────────────

set -e

echo "╔══════════════════════════════════════════════╗"
echo "║   Dymo LabelWriter 4XL — Pi Setup           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Must run as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Run with sudo: sudo bash setup-dymo.sh"
  exit 1
fi

# 1. Install CUPS + Dymo drivers
echo "📦 Installing CUPS and Dymo printer drivers..."
apt-get update -qq
apt-get install -y -qq cups printer-driver-dymo

# 2. Allow the pi user to manage CUPS
echo "👤 Adding pi user to lpadmin group..."
usermod -aG lpadmin pi 2>/dev/null || true

# 3. Allow remote CUPS admin (optional but useful for debugging)
echo "🌐 Configuring CUPS for network access..."
cupsctl --remote-admin --remote-any --share-printers

# 4. Start/enable CUPS
echo "🔧 Enabling CUPS service..."
systemctl enable cups
systemctl restart cups
sleep 3

# 5. Check if Dymo is connected via USB
echo ""
echo "🔍 Detecting Dymo LabelWriter 4XL..."
DYMO_URI=$(lpinfo -v 2>/dev/null | grep -i "dymo" | head -1 | awk '{print $2}')

if [ -z "$DYMO_URI" ]; then
  echo "⚠️  No Dymo printer detected on USB."
  echo "   Make sure the 4XL is plugged in and powered on."
  echo "   Then run: sudo bash setup-dymo.sh"
  exit 1
fi

echo "✅ Found Dymo at: $DYMO_URI"

# 6. Find the PPD for LabelWriter 4XL
PPD=$(lpinfo -m 2>/dev/null | grep -i "4xl" | head -1 | awk '{print $1}')
if [ -z "$PPD" ]; then
  PPD=$(lpinfo -m 2>/dev/null | grep -i "labelwriter" | head -1 | awk '{print $1}')
fi

if [ -z "$PPD" ]; then
  echo "⚠️  Could not find Dymo PPD. Using generic driver."
  PPD="drv:///dymo.drv/dymo_lw4xl.ppd"
fi

echo "📄 Using PPD: $PPD"

# 7. Add the printer to CUPS
PRINTER_NAME="DYMO-4XL"
echo "🖨️  Adding printer as '$PRINTER_NAME'..."
lpadmin -p "$PRINTER_NAME" \
  -v "$DYMO_URI" \
  -m "$PPD" \
  -L "ChowBox" \
  -D "Dymo LabelWriter 4XL" \
  -E

# 8. Set as default printer
lpadmin -d "$PRINTER_NAME"
echo "✅ Set '$PRINTER_NAME' as default printer"

# 9. Set default media size (4x6 shipping label — largest supported)
lpoptions -d "$PRINTER_NAME" -o media=w288h432 2>/dev/null || true

# 10. Print a test page
echo ""
echo "🧪 Printing test label..."
echo "ChowNow — Printer Ready" | lp -d "$PRINTER_NAME" 2>/dev/null && echo "✅ Test label sent!" || echo "⚠️  Test print failed, check CUPS: http://$(hostname -I | awk '{print $1}'):631"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ✅ Dymo 4XL setup complete!               ║"
echo "║   Printer: $PRINTER_NAME                    ║"
echo "║   CUPS: http://localhost:631                 ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Restart ChowBox server to enable label printing:"
echo "  sudo systemctl restart chowbox"
