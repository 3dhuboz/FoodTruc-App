/**
 * Label Printer — Dymo LabelWriter 4XL via CUPS
 *
 * Generates HTML labels and prints via the `lp` command through CUPS.
 * Supports order collection labels and QR code stickers.
 *
 * Setup: sudo bash setup-dymo.sh (installs CUPS + Dymo drivers)
 * Printer name: DYMO-4XL (set as default by setup script)
 */

import { execSync, exec } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const PRINTER_NAME = 'DYMO-4XL';
const LABEL_DIR = tmpdir();

// ─── Printer Detection ──────────────────────────────────────────

let printerReady = false;

export function initPrinter() {
  try {
    const output = execSync('lpstat -p 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
    if (output.includes(PRINTER_NAME)) {
      printerReady = true;
      console.log(`[Printer] Dymo LabelWriter 4XL ready (${PRINTER_NAME})`);
      return true;
    }
    // Fallback: check for any Dymo
    if (output.toLowerCase().includes('dymo')) {
      printerReady = true;
      console.log(`[Printer] Dymo printer found via CUPS`);
      return true;
    }
  } catch {}

  // Also check legacy ESC/POS USB device
  const usbPaths = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/usb/lp2'];
  for (const p of usbPaths) {
    if (existsSync(p)) {
      printerReady = true;
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

// ─── HTML Label Generation ──────────────────────────────────────

function orderLabelHTML(order) {
  const pin = order.collectionPin || order.collection_pin || order.id?.slice(-4)?.toUpperCase() || '????';
  const time = new Date(order.createdAt || Date.now()).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  const name = order.customerName || order.customer_name || 'Walk-up';
  const type = order.type || 'TAKEAWAY';

  let items = [];
  try {
    items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
  } catch { items = []; }

  const itemRows = items.map(entry => {
    const item = entry.item || entry;
    const qty = entry.quantity || 1;
    const itemName = item.name || item.toString();
    let row = `<tr><td class="qty">${qty}x</td><td>${itemName}</td></tr>`;
    if (entry.selectedOption) {
      row += `<tr><td></td><td class="sub">&rsaquo; ${entry.selectedOption}</td></tr>`;
    }
    if (entry.packSelections) {
      for (const [group, sels] of Object.entries(entry.packSelections)) {
        row += `<tr><td></td><td class="sub">${group}: ${sels.join(', ')}</td></tr>`;
      }
    }
    return row;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: 4in 6in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; padding: 12px; width: 4in; height: 6in; }
  .pin { font-size: 72px; font-weight: 900; text-align: center; letter-spacing: 4px; margin: 8px 0; }
  .name { font-size: 24px; font-weight: 700; text-align: center; margin-bottom: 4px; }
  .meta { font-size: 14px; text-align: center; color: #666; margin-bottom: 12px; }
  hr { border: none; border-top: 2px dashed #000; margin: 10px 0; }
  table { width: 100%; font-size: 18px; }
  .qty { width: 40px; font-weight: 700; vertical-align: top; }
  td { padding: 3px 0; }
  .sub { font-size: 14px; color: #555; padding-left: 8px; }
  .total { font-size: 22px; font-weight: 900; text-align: right; margin-top: 8px; }
  .brand { font-size: 11px; text-align: center; color: #999; margin-top: auto; position: absolute; bottom: 12px; left: 0; right: 0; }
</style></head><body>
  <div class="pin">${pin}</div>
  <div class="name">${escHTML(name)}</div>
  <div class="meta">${time} &bull; ${type}</div>
  <hr>
  <table>${itemRows}</table>
  <hr>
  <div class="total">$${(order.total || 0).toFixed(2)}</div>
  <div class="brand">Powered by ChowNow</div>
</body></html>`;
}

function qrStickerHTML(url, businessName) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: 4in 4in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; width: 4in; height: 4in; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 16px; }
  img { width: 240px; height: 240px; margin-bottom: 12px; }
  .title { font-size: 20px; font-weight: 900; margin-bottom: 4px; }
  .sub { font-size: 13px; color: #555; }
  .url { font-size: 11px; color: #888; margin-top: 8px; word-break: break-all; }
</style></head><body>
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}" alt="QR">
  <div class="title">Scan to Order</div>
  <div class="sub">${escHTML(businessName || 'Order ahead, skip the queue')}</div>
  <div class="url">${escHTML(url)}</div>
</body></html>`;
}

function escHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Print via CUPS ─────────────────────────────────────────────

function printHTML(html, jobName = 'chownow-label') {
  const filePath = join(LABEL_DIR, `${jobName}-${Date.now()}.html`);
  try {
    writeFileSync(filePath, html);
    execSync(`lp -d ${PRINTER_NAME} -t "${jobName}" "${filePath}"`, { timeout: 10000 });
    // Clean up after a delay
    setTimeout(() => { try { unlinkSync(filePath); } catch {} }, 5000);
    return true;
  } catch (err) {
    console.error(`[Printer] Print failed: ${err.message}`);
    try { unlinkSync(filePath); } catch {}
    return false;
  }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Print an order collection label (4x6").
 * Called when cook taps "Cooking" on the KDS.
 */
export function printOrderLabel(order) {
  if (!printerReady) {
    console.log('[Printer] No printer — skipping label for order', order.id);
    return false;
  }

  try {
    const pin = order.collectionPin || order.collection_pin || order.id?.slice(-4)?.toUpperCase() || '????';
    const html = orderLabelHTML(order);
    const success = printHTML(html, `order-${pin}`);
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
 * Print a QR code sticker (4x4").
 * Used for truck signage — customers scan to order.
 */
export function printQRSticker(url, businessName) {
  if (!printerReady) return false;

  try {
    const html = qrStickerHTML(url, businessName);
    const success = printHTML(html, 'qr-sticker');
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

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: 4in 3in; margin: 0; }
  body { font-family: Arial, sans-serif; width: 4in; height: 3in; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .logo { font-size: 36px; font-weight: 900; }
  .sub { font-size: 16px; margin-top: 4px; }
  .time { font-size: 12px; color: #888; margin-top: 12px; }
  .ok { font-size: 14px; color: #16a34a; font-weight: 700; margin-top: 8px; }
</style></head><body>
  <div class="logo">ChowNow</div>
  <div class="sub">Printer Test</div>
  <div class="ok">If you can read this, your printer is working!</div>
  <div class="time">${new Date().toLocaleString('en-AU')}</div>
</body></html>`;

  try {
    const success = printHTML(html, 'test-label');
    if (success) console.log('[Printer] Test label printed');
    return success;
  } catch (err) {
    console.error('[Printer] Test print failed:', err.message);
    return false;
  }
}
