/**
 * Bluetooth ESC/POS Thermal Printer — 58mm/80mm receipt printers
 *
 * Alternative to the Dymo 4XL label printer. Connects via Bluetooth SPP
 * (rfcomm) to cheap BT thermal printers (Xprinter, PeriPage, etc.)
 *
 * ESC/POS is the industry-standard receipt printer command language.
 * We build raw byte buffers and send them to the printer's serial port.
 *
 * Requires: bluetoothctl (pair first), rfcomm bind
 * The Pi pairs with the printer once, then rfcomm creates /dev/rfcomm0.
 *
 * Setup:
 *   1. bluetoothctl → scan on → pair XX:XX:XX:XX:XX:XX → trust → quit
 *   2. sudo rfcomm bind 0 XX:XX:XX:XX:XX:XX
 *   3. Set CHOWNOW_BT_PRINTER_ADDR in environment or config
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, openSync, writeSync, closeSync } from 'fs';

// ─── ESC/POS Commands ───────────────────────────────────────

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const CMD = {
  INIT:           Buffer.from([ESC, 0x40]),                    // Reset printer
  ALIGN_LEFT:     Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER:   Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_RIGHT:    Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON:        Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:       Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_ON:      Buffer.from([GS, 0x21, 0x11]),              // Double width + height
  DOUBLE_OFF:     Buffer.from([GS, 0x21, 0x00]),
  WIDE_ON:        Buffer.from([GS, 0x21, 0x10]),              // Double width only
  WIDE_OFF:       Buffer.from([GS, 0x21, 0x00]),
  TALL_ON:        Buffer.from([GS, 0x21, 0x01]),              // Double height only
  UNDERLINE_ON:   Buffer.from([ESC, 0x2D, 0x01]),
  UNDERLINE_OFF:  Buffer.from([ESC, 0x2D, 0x00]),
  CUT:            Buffer.from([GS, 0x56, 0x00]),              // Full cut
  PARTIAL_CUT:    Buffer.from([GS, 0x56, 0x01]),              // Partial cut
  FEED:           Buffer.from([ESC, 0x64, 0x04]),              // Feed 4 lines
  LINE:           Buffer.from([LF]),
};

function text(str) { return Buffer.from(str, 'utf8'); }
function line(str) { return Buffer.concat([text(str), CMD.LINE]); }
function separator(width = 32) { return line('-'.repeat(width)); }

// ─── Printer Detection ──────────────────────────────────────

let btReady = false;
let btDevice = '';  // /dev/rfcomm0 or similar

export function initBtPrinter(devicePath) {
  const path = devicePath || process.env.CHOWNOW_BT_PRINTER || '/dev/rfcomm0';
  if (existsSync(path)) {
    btDevice = path;
    btReady = true;
    console.log(`[BT Printer] Found device at ${path}`);
    return true;
  }

  // Try to find rfcomm devices
  try {
    const output = execSync('ls /dev/rfcomm* 2>/dev/null', { encoding: 'utf8', timeout: 3000 });
    const first = output.trim().split('\n')[0];
    if (first) {
      btDevice = first;
      btReady = true;
      console.log(`[BT Printer] Found device at ${btDevice}`);
      return true;
    }
  } catch {}

  console.log('[BT Printer] No Bluetooth printer found. Pair a printer first.');
  return false;
}

export function isBtPrinterAvailable() {
  return btReady;
}

// ─── Raw Print ──────────────────────────────────────────────

function sendRaw(buffer) {
  try {
    const fd = openSync(btDevice, 'w');
    writeSync(fd, buffer);
    closeSync(fd);
    return true;
  } catch (err) {
    console.error(`[BT Printer] Write failed: ${err.message}`);
    return false;
  }
}

// ─── Receipt Builders ───────────────────────────────────────

/**
 * Print an order receipt on a 58mm/80mm BT thermal printer.
 * Layout: PIN, customer, items, total, thank you, site URL.
 */
export function btPrintOrderReceipt(order, businessName, siteUrl, labelSettings) {
  const pin = order.collectionPin || order.collection_pin || order.id?.slice(-4)?.toUpperCase() || '????';
  const time = new Date(order.createdAt || Date.now()).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  const name = order.customerName || order.customer_name || 'Walk-up';
  const biz = businessName || 'ChowNow';

  let items = [];
  try {
    items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
  } catch { items = []; }

  const thankMsg = (labelSettings?.thankYou || 'Thanks {name}!').replace('{name}', name.split(' ')[0]);
  const tagline = labelSettings?.tagline || 'We appreciate your support.';

  const parts = [];

  // Init
  parts.push(CMD.INIT);

  // Business name
  parts.push(CMD.ALIGN_CENTER, CMD.BOLD_ON);
  parts.push(line(biz.toUpperCase()));
  parts.push(CMD.BOLD_OFF);
  parts.push(separator());

  // Collection PIN — big and bold
  parts.push(CMD.ALIGN_CENTER, CMD.DOUBLE_ON, CMD.BOLD_ON);
  parts.push(line(`#${pin}`));
  parts.push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);

  // Customer + time
  parts.push(CMD.ALIGN_CENTER);
  parts.push(line(name));
  parts.push(line(`${time}  |  ${order.type || 'TAKEAWAY'}`));
  parts.push(separator());

  // Items
  parts.push(CMD.ALIGN_LEFT);
  for (const entry of items) {
    const item = entry.item || entry;
    const qty = entry.quantity || 1;
    const itemName = item.name || String(item);
    const price = item.price ? `$${(item.price * qty).toFixed(2)}` : '';

    parts.push(CMD.BOLD_ON);
    parts.push(text(`${qty}x ${itemName}`));
    if (price) {
      // Right-pad to align price (assuming ~32 char width for 58mm)
      const gap = Math.max(1, 32 - `${qty}x ${itemName}`.length - price.length);
      parts.push(text(' '.repeat(gap) + price));
    }
    parts.push(CMD.LINE, CMD.BOLD_OFF);

    if (entry.selectedOption) {
      parts.push(line(`   > ${entry.selectedOption}`));
    }
  }

  // Total
  parts.push(separator());
  parts.push(CMD.ALIGN_RIGHT, CMD.BOLD_ON, CMD.WIDE_ON);
  parts.push(line(`TOTAL $${(order.total || 0).toFixed(2)}`));
  parts.push(CMD.WIDE_OFF, CMD.BOLD_OFF);
  parts.push(separator());

  // Thank you
  parts.push(CMD.ALIGN_CENTER);
  parts.push(line(thankMsg));
  parts.push(line(tagline));

  // Site URL
  const displayUrl = siteUrl?.replace('https://', '').replace('http://', '').replace(/\/$/, '');
  if (displayUrl) {
    parts.push(CMD.LINE);
    parts.push(line(displayUrl));
  }
  parts.push(line('Powered by ChowNow'));

  // Feed + cut
  parts.push(CMD.FEED);
  parts.push(CMD.PARTIAL_CUT);

  const buffer = Buffer.concat(parts);
  const success = sendRaw(buffer);
  if (success) console.log(`[BT Printer] Printed receipt for order #${pin} (${name})`);
  return success;
}

/**
 * Print a test receipt.
 */
export function btPrintTestReceipt() {
  const parts = [
    CMD.INIT,
    CMD.ALIGN_CENTER,
    CMD.DOUBLE_ON, CMD.BOLD_ON,
    line('ChowNow'),
    CMD.DOUBLE_OFF, CMD.BOLD_OFF,
    CMD.LINE,
    line('Printer Test'),
    CMD.LINE,
    CMD.BOLD_ON,
    line('Printer is working!'),
    CMD.BOLD_OFF,
    CMD.LINE,
    line(new Date().toLocaleString('en-AU')),
    CMD.FEED,
    CMD.PARTIAL_CUT,
  ];
  return sendRaw(Buffer.concat(parts));
}
