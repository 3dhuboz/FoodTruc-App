/**
 * Label Printer — Dymo LabelWriter 4XL via CUPS
 *
 * Sends plain text labels via `lp` through CUPS.
 * For QR stickers, generates a PNG via QR Server API and prints the image.
 *
 * Setup: sudo bash setup-dymo.sh (installs CUPS + Dymo drivers)
 * Printer name: DYMO-4XL (or auto-detected LabelWriter)
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const LABEL_DIR = tmpdir();

// ─── Printer Detection ──────────────────────────────────────────

let printerReady = false;
let printerName = '';

export function initPrinter() {
  try {
    const output = execSync('lpstat -p 2>/dev/null', { encoding: 'utf8', timeout: 5000 });

    // Look for any Dymo or LabelWriter printer
    const match = output.match(/printer (\S+) is/);
    if (match) {
      printerName = match[1];
      printerReady = true;
      console.log(`[Printer] Found CUPS printer: ${printerName}`);
      return true;
    }
  } catch {}

  // Fallback: check for raw USB device
  const usbPaths = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/usb/lp2'];
  for (const p of usbPaths) {
    if (existsSync(p)) {
      printerReady = true;
      printerName = '';
      console.log(`[Printer] USB printer found at ${p} (raw mode)`);
      return true;
    }
  }

  console.log('[Printer] No printer detected. Run: sudo bash setup-dymo.sh');
  return false;
}

export function isPrinterAvailable() {
  return printerReady;
}

// ─── Print via CUPS (plain text) ────────────────────────────────

function printText(text, jobName = 'chownow-label') {
  try {
    const dest = printerName ? `-d ${printerName}` : '';
    execSync(`echo ${JSON.stringify(text)} | lp ${dest} -t "${jobName}"`, {
      timeout: 10000,
      shell: '/bin/bash',
    });
    return true;
  } catch (err) {
    console.error(`[Printer] Print failed: ${err.message}`);
    return false;
  }
}

function printFile(filePath, jobName = 'chownow-label') {
  try {
    const dest = printerName ? `-d ${printerName}` : '';
    execSync(`lp ${dest} -t "${jobName}" "${filePath}"`, { timeout: 15000 });
    setTimeout(() => { try { unlinkSync(filePath); } catch {} }, 5000);
    return true;
  } catch (err) {
    console.error(`[Printer] Print file failed: ${err.message}`);
    try { unlinkSync(filePath); } catch {}
    return false;
  }
}

// ─── Label Formatters ───────────────────────────────────────────

function formatOrderLabel(order) {
  const pin = order.collectionPin || order.collection_pin || order.id?.slice(-4)?.toUpperCase() || '????';
  const time = new Date(order.createdAt || Date.now()).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  const name = order.customerName || order.customer_name || 'Walk-up';
  const type = order.type || 'TAKEAWAY';

  let items = [];
  try {
    items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
  } catch { items = []; }

  const lines = [];
  lines.push('');
  lines.push(`       #${pin}`);
  lines.push('');
  lines.push(`  ${name}`);
  lines.push(`  ${time}  ${type}`);
  lines.push('  --------------------------------');

  for (const entry of items) {
    const item = entry.item || entry;
    const qty = entry.quantity || 1;
    const itemName = item.name || item.toString();
    lines.push(`  ${qty}x ${itemName}`);
    if (entry.selectedOption) {
      lines.push(`     > ${entry.selectedOption}`);
    }
    if (entry.packSelections) {
      for (const [group, sels] of Object.entries(entry.packSelections)) {
        lines.push(`     ${group}: ${sels.join(', ')}`);
      }
    }
  }

  lines.push('  --------------------------------');
  lines.push(`  TOTAL: $${(order.total || 0).toFixed(2)}`);
  lines.push('');
  lines.push('  Powered by ChowNow');
  lines.push('');

  return lines.join('\n');
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Print an order collection label.
 * Called when cook taps "Cooking" on the KDS.
 */
export function printOrderLabel(order) {
  if (!printerReady) {
    console.log('[Printer] No printer — skipping label for order', order.id);
    return false;
  }

  try {
    const pin = order.collectionPin || order.collection_pin || order.id?.slice(-4)?.toUpperCase() || '????';
    const label = formatOrderLabel(order);
    const success = printText(label, `order-${pin}`);
    if (success) {
      const name = order.customerName || order.customer_name || 'Walk-up';
      console.log(`[Printer] Printed label for order #${pin} (${name})`);
    }
    return success;
  } catch (err) {
    console.error('[Printer] Print failed:', err.message);
    return false;
  }
}

/**
 * Print a QR code sticker.
 * Downloads QR PNG from API, then prints the image file via CUPS.
 */
export async function printQRSticker(url, businessName) {
  if (!printerReady) return false;

  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&format=png`;
    const res = await fetch(qrUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`QR API ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const filePath = join(LABEL_DIR, `qr-sticker-${Date.now()}.png`);
    writeFileSync(filePath, buffer);

    const success = printFile(filePath, 'qr-sticker');
    if (success) console.log(`[Printer] Printed QR sticker for ${url}`);
    return success;
  } catch (err) {
    console.error('[Printer] QR sticker print failed:', err.message);
    return false;
  }
}

/**
 * Print a test label to verify the printer works.
 */
export function printTestLabel() {
  if (!printerReady) return false;

  const text = [
    '',
    '     ChowNow',
    '     Printer Test',
    '',
    '  If you can read this,',
    '  your printer is working!',
    '',
    `  ${new Date().toLocaleString('en-AU')}`,
    '',
  ].join('\n');

  try {
    const success = printText(text, 'test-label');
    if (success) console.log('[Printer] Test label printed');
    return success;
  } catch (err) {
    console.error('[Printer] Test print failed:', err.message);
    return false;
  }
}
