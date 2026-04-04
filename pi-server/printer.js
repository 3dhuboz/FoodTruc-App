/**
 * Label Printer — Dymo LabelWriter 4XL via CUPS + ImageMagick
 *
 * Generates PNG labels with branding (logo, QR, socials) and prints via `lp`.
 * Order labels: logo + PIN + items + total + thank you + QR to socials
 * QR stickers: QR code + business name for truck signage
 *
 * Requires: printer-driver-dymo, imagemagick, cups
 * Setup: sudo bash setup-dymo.sh
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const LABEL_DIR = join(tmpdir(), 'chownow-labels');
const LOGO_CACHE = join(LABEL_DIR, 'logo-cache.png');
const SOCIAL_QR_CACHE = join(LABEL_DIR, 'social-qr.png');

try { mkdirSync(LABEL_DIR, { recursive: true }); } catch {}

// ─── Printer Detection ──────────────────────────────────────────

let printerReady = false;
let printerName = '';

export function initPrinter() {
  try {
    const output = execSync('lpstat -p 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
    const match = output.match(/printer (\S+) is/);
    if (match) {
      printerName = match[1];
      printerReady = true;
      console.log(`[Printer] Found CUPS printer: ${printerName}`);
      return true;
    }
  } catch {}
  console.log('[Printer] No printer detected. Run: sudo bash setup-dymo.sh');
  return false;
}

export function isPrinterAvailable() {
  return printerReady;
}

// ─── Asset Cache ────────────────────────────────────────────────

function isCacheFresh(path, maxAgeMs = 3600000) {
  try {
    return existsSync(path) && (Date.now() - statSync(path).mtimeMs < maxAgeMs);
  } catch { return false; }
}

async function downloadImage(url, dest, resize) {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://chownow.au${url}`;
    const res = await fetch(fullUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    if (resize) {
      execSync(`convert "${dest}" -resize ${resize} -background white -gravity center -extent ${resize} "${dest}"`, { timeout: 5000 });
    }
    return dest;
  } catch (err) {
    console.error('[Printer] Image download failed:', err.message);
    return null;
  }
}

async function ensureLogo(logoUrl) {
  if (!logoUrl) return null;
  if (isCacheFresh(LOGO_CACHE)) return LOGO_CACHE;
  return downloadImage(logoUrl, LOGO_CACHE, '160x60');
}

async function ensureSocialQR(siteUrl) {
  if (!siteUrl) return null;
  if (isCacheFresh(SOCIAL_QR_CACHE)) return SOCIAL_QR_CACHE;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(siteUrl)}&format=png`;
  return downloadImage(qrUrl, SOCIAL_QR_CACHE, '100x100');
}

// ─── Helpers ────────────────────────────────────────────────────

function esc(str) {
  return String(str).replace(/'/g, "'\\''").replace(/[&<>\\]/g, '');
}

function printPNG(filePath, jobName = 'chownow-label') {
  try {
    const dest = printerName ? `-d ${printerName}` : '';
    execSync(`lp ${dest} -t "${jobName}" -o PageSize=w288h432 "${filePath}"`, { timeout: 15000 });
    setTimeout(() => { try { unlinkSync(filePath); } catch {} }, 10000);
    return true;
  } catch (err) {
    console.error(`[Printer] Print failed: ${err.message}`);
    try { unlinkSync(filePath); } catch {}
    return false;
  }
}

// ─── Order Label Builder ────────────────────────────────────────

function buildOrderLabel(order, logoPath, socialQRPath, businessName, siteUrl, labelSettings) {
  const pin = order.collectionPin || order.collection_pin || order.id?.slice(-4)?.toUpperCase() || '????';
  const time = new Date(order.createdAt || Date.now()).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  const name = order.customerName || order.customer_name || 'Walk-up';
  const type = order.type || 'TAKEAWAY';
  const biz = businessName || 'ChowNow';

  let items = [];
  try {
    items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
  } catch { items = []; }

  const filePath = join(LABEL_DIR, `order-${pin}-${Date.now()}.png`);

  // Start with white canvas (4x6" at 72dpi = 288x432)
  const parts = [`convert -size 288x432 xc:white`];

  // ── TOP: Collection PIN (big and bold) ──
  parts.push(`-gravity North -font Helvetica-Bold -pointsize 58 -annotate +0+12 '#${esc(pin)}'`);

  // ── Customer name + time ──
  parts.push(`-pointsize 22 -annotate +0+78 '${esc(name)}'`);
  parts.push(`-font Helvetica -pointsize 13 -fill gray30 -annotate +0+105 '${time}  |  ${type}'`);
  parts.push(`-fill black`);

  // ── Separator line ──
  parts.push(`-draw 'line 15,125 273,125'`);

  // ── Items list ──
  let y = 135;
  parts.push(`-gravity NorthWest`);
  for (const entry of items) {
    if (y > 320) { // Don't overflow into footer
      parts.push(`-font Helvetica -pointsize 12 -fill gray50 -annotate +20+${y} '+ more items...'`);
      parts.push(`-fill black`);
      break;
    }
    const item = entry.item || entry;
    const qty = entry.quantity || 1;
    const itemName = item.name || item.toString();
    parts.push(`-font Helvetica-Bold -pointsize 16 -annotate +20+${y} '${qty}x ${esc(itemName)}'`);
    y += 22;

    if (entry.selectedOption) {
      parts.push(`-font Helvetica -pointsize 12 -fill gray40 -annotate +35+${y} '> ${esc(entry.selectedOption)}'`);
      y += 18;
      parts.push(`-fill black`);
    }
  }

  // ── Separator ──
  y = Math.max(y + 5, 280);
  parts.push(`-draw 'line 15,${y} 273,${y}'`);
  y += 12;

  // ── Total (right-aligned) ──
  parts.push(`-gravity NorthEast -font Helvetica-Bold -pointsize 22 -annotate +20+${y} 'TOTAL $${(order.total || 0).toFixed(2)}'`);

  // ── FOOTER: Thank you + QR + promo ──
  const thankMsg = (labelSettings?.thankYou || 'Thanks {name}!').replace('{name}', esc(name.split(' ')[0]));
  const tagline = labelSettings?.tagline || 'We appreciate your support.';
  parts.push(`-gravity South -font Helvetica-Bold -pointsize 14 -annotate +0+75 '${esc(thankMsg)}'`);
  parts.push(`-font Helvetica -pointsize 10 -fill gray30 -annotate +0+60 '${esc(tagline)}'`);

  // "Find us" / site URL
  const displayUrl = siteUrl?.replace('https://', '').replace('http://', '').replace(/\/$/, '');
  if (displayUrl) {
    parts.push(`-pointsize 9 -annotate +0+15 '${esc(displayUrl)}'`);
  }
  parts.push(`-pointsize 9 -fill gray50 -annotate +0+4 'Powered by ChowNow'`);
  parts.push(`-fill black`);

  // Build base image
  let cmd = parts.join(' ') + ` "${filePath}"`;

  // Composite logo (top-right corner)
  if (logoPath && existsSync(logoPath)) {
    cmd += ` && composite -gravity NorthEast -geometry +8+8 "${logoPath}" "${filePath}" "${filePath}"`;
  }

  // Composite social QR (bottom-left corner)
  if (socialQRPath && existsSync(socialQRPath)) {
    cmd += ` && composite -gravity SouthWest -geometry +10+30 "${socialQRPath}" "${filePath}" "${filePath}"`;
  }

  try {
    execSync(cmd, { timeout: 15000, shell: '/bin/bash', stdio: ['pipe', 'pipe', 'pipe'] });
    return filePath;
  } catch (err) {
    const stderr = err.stderr?.toString() || '';
    console.error('[Printer] ImageMagick failed:', err.message);
    if (stderr) console.error('[Printer] stderr:', stderr.substring(0, 500));
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Print an order collection label (4x6" on Dymo 4XL).
 * Includes: logo, PIN, items, total, thank you, social QR.
 */
export async function printOrderLabel(order, logoUrl, businessName, siteUrl, labelSettings) {
  if (!printerReady) {
    console.log('[Printer] No printer — skipping label for order', order.id);
    return false;
  }

  try {
    const pin = order.collectionPin || order.collection_pin || order.id?.slice(-4)?.toUpperCase() || '????';
    const socialUrl = labelSettings?.socialUrl || siteUrl;
    const [logoPath, socialQRPath] = await Promise.all([
      ensureLogo(logoUrl),
      ensureSocialQR(socialUrl),
    ]);

    const imagePath = buildOrderLabel(order, logoPath, socialQRPath, businessName, siteUrl, labelSettings);
    if (!imagePath) return false;

    const success = printPNG(imagePath, `order-${pin}`);
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
 * Print a QR code sticker for truck signage.
 */
export async function printQRSticker(url, businessName) {
  if (!printerReady) return false;

  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&format=png`;
    const qrPath = join(LABEL_DIR, `qr-dl-${Date.now()}.png`);
    const res = await fetch(qrUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`QR API ${res.status}`);
    writeFileSync(qrPath, Buffer.from(await res.arrayBuffer()));

    const filePath = join(LABEL_DIR, `qr-sticker-${Date.now()}.png`);
    const biz = esc(businessName || 'Scan to Order');
    execSync(`convert -size 288x288 xc:white \
      -gravity North -font Helvetica-Bold -pointsize 20 -annotate +0+8 'Scan to Order' \
      -gravity South -font Helvetica -pointsize 12 -annotate +0+12 '${biz}' \
      "${filePath}" && \
      composite -gravity Center -geometry +0+5 "${qrPath}" "${filePath}" "${filePath}"`,
      { timeout: 10000, shell: '/bin/bash' });

    try { unlinkSync(qrPath); } catch {}
    const success = printPNG(filePath, 'qr-sticker');
    if (success) console.log(`[Printer] Printed QR sticker for ${url}`);
    return success;
  } catch (err) {
    console.error('[Printer] QR sticker print failed:', err.message);
    return false;
  }
}

/**
 * Print a test label.
 */
export function printTestLabel() {
  if (!printerReady) return false;

  const filePath = join(LABEL_DIR, `test-${Date.now()}.png`);
  try {
    execSync(`convert -size 288x432 xc:white \
      -gravity Center \
      -font Helvetica-Bold -pointsize 42 -annotate +0-60 'ChowNow' \
      -font Helvetica -pointsize 22 -annotate +0-10 'Printer Test' \
      -pointsize 16 -fill green4 -annotate +0+30 'Printer is working!' \
      -fill gray50 -pointsize 12 -annotate +0+65 '${new Date().toLocaleString("en-AU")}' \
      "${filePath}"`, { timeout: 10000, shell: '/bin/bash' });

    const success = printPNG(filePath, 'test-label');
    if (success) console.log('[Printer] Test label printed');
    return success;
  } catch (err) {
    console.error('[Printer] Test print failed:', err.message);
    return false;
  }
}
