/**
 * Thermal Printer — ESC/POS over USB
 *
 * Writes raw ESC/POS commands to the USB device file.
 * Works with most 58mm/80mm thermal receipt printers.
 *
 * On Linux (Pi): writes to /dev/usb/lp0 (or lp1, lp2)
 * Auto-detects the printer device on startup.
 *
 * No npm dependencies — just raw file writes.
 */

import { writeFileSync, existsSync, readdirSync } from 'fs';

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const CMD = {
  INIT: Buffer.from([ESC, 0x40]),                    // Initialize printer
  BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),           // Bold on
  BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),          // Bold off
  DOUBLE_ON: Buffer.from([GS, 0x21, 0x11]),          // Double width + height
  DOUBLE_OFF: Buffer.from([GS, 0x21, 0x00]),         // Normal size
  WIDE_ON: Buffer.from([GS, 0x21, 0x10]),            // Double width only
  WIDE_OFF: Buffer.from([GS, 0x21, 0x00]),           // Normal
  CENTER: Buffer.from([ESC, 0x61, 0x01]),             // Center align
  LEFT: Buffer.from([ESC, 0x61, 0x00]),               // Left align
  CUT: Buffer.from([GS, 0x56, 0x42, 0x03]),          // Partial cut (with feed)
  FEED: Buffer.from([ESC, 0x64, 0x04]),               // Feed 4 lines
  LINE: Buffer.from([0x2D].concat(Array(32).fill(0x2D)), // Dashed line
};

// Auto-detect USB printer device
function findPrinter() {
  const paths = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/usb/lp2'];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  // Check for serial printers too
  try {
    const devs = readdirSync('/dev').filter(d => d.startsWith('ttyUSB') || d.startsWith('ttyACM'));
    if (devs.length > 0) return `/dev/${devs[0]}`;
  } catch {}
  return null;
}

let printerPath = null;

export function initPrinter() {
  printerPath = findPrinter();
  if (printerPath) {
    console.log(`[Printer] Found thermal printer at ${printerPath}`);
    return true;
  } else {
    console.log('[Printer] No USB thermal printer detected. Label printing disabled.');
    console.log('[Printer] Connect a USB thermal printer and restart to enable.');
    return false;
  }
}

export function isPrinterAvailable() {
  if (!printerPath) return false;
  return existsSync(printerPath);
}

/**
 * Print an order label for the pass.
 * Called when cook taps "Cooking" on the KDS.
 *
 * @param {Object} order - { id, customerName, items, total, createdAt, type }
 */
export function printOrderLabel(order) {
  if (!printerPath) {
    console.log('[Printer] No printer — skipping label for order', order.id);
    return false;
  }

  try {
    const orderNum = order.id?.slice(-4)?.toUpperCase() || '????';
    const time = new Date(order.createdAt || Date.now()).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
    const name = order.customerName || 'Walk-up';

    // Parse items — could be JSON string or array
    let items = [];
    try {
      items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
    } catch { items = []; }

    // Build the label
    const parts = [];

    // Init
    parts.push(CMD.INIT);

    // Big order number
    parts.push(CMD.CENTER);
    parts.push(CMD.DOUBLE_ON);
    parts.push(Buffer.from(`#${orderNum}\n`));
    parts.push(CMD.DOUBLE_OFF);

    // Customer name
    parts.push(CMD.BOLD_ON);
    parts.push(Buffer.from(`${name}\n`));
    parts.push(CMD.BOLD_OFF);
    parts.push(Buffer.from(`${time}  ${order.type || 'TAKEAWAY'}\n`));

    // Separator
    parts.push(CMD.LEFT);
    parts.push(Buffer.from('--------------------------------\n'));

    // Items
    for (const entry of items) {
      const item = entry.item || entry;
      const qty = entry.quantity || 1;
      const itemName = item.name || item.toString();
      parts.push(CMD.BOLD_ON);
      parts.push(Buffer.from(`${qty}x ${itemName}\n`));
      parts.push(CMD.BOLD_OFF);

      // Show selected option if any
      if (entry.selectedOption) {
        parts.push(Buffer.from(`   > ${entry.selectedOption}\n`));
      }

      // Show pack selections if any
      if (entry.packSelections) {
        for (const [group, selections] of Object.entries(entry.packSelections)) {
          parts.push(Buffer.from(`   ${group}: ${selections.join(', ')}\n`));
        }
      }
    }

    // Separator
    parts.push(Buffer.from('--------------------------------\n'));

    // Total
    parts.push(CMD.BOLD_ON);
    parts.push(Buffer.from(`TOTAL: $${(order.total || 0).toFixed(2)}\n`));
    parts.push(CMD.BOLD_OFF);

    // Feed and cut
    parts.push(CMD.FEED);
    parts.push(CMD.CUT);

    // Write to printer
    const label = Buffer.concat(parts);
    writeFileSync(printerPath, label);
    console.log(`[Printer] Printed label for order #${orderNum} (${name})`);
    return true;
  } catch (err) {
    console.error('[Printer] Print failed:', err.message);
    return false;
  }
}

/**
 * Print a test label to verify the printer works.
 */
export function printTestLabel() {
  if (!printerPath) return false;

  try {
    const parts = [
      CMD.INIT,
      CMD.CENTER,
      CMD.DOUBLE_ON,
      Buffer.from('ChowNow\n'),
      CMD.DOUBLE_OFF,
      CMD.BOLD_ON,
      Buffer.from('Printer Test\n'),
      CMD.BOLD_OFF,
      Buffer.from(`${new Date().toLocaleString('en-AU')}\n`),
      Buffer.from('--------------------------------\n'),
      Buffer.from('If you can read this,\n'),
      Buffer.from('your printer is working!\n'),
      Buffer.from('--------------------------------\n'),
      CMD.FEED,
      CMD.CUT,
    ];

    writeFileSync(printerPath, Buffer.concat(parts));
    console.log('[Printer] Test label printed');
    return true;
  } catch (err) {
    console.error('[Printer] Test print failed:', err.message);
    return false;
  }
}
