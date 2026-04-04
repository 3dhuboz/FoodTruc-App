/**
 * Street Eats Pi Server
 *
 * A self-contained local server that runs on a Raspberry Pi.
 * - Serves the built frontend (static files from ../dist)
 * - Provides the same /api/v1/* endpoints as Cloudflare Pages Functions
 * - Stores data in local SQLite (same schema as D1)
 * - Syncs to cloud D1 when internet is available
 * - Cluster mode: forks workers per CPU core for concurrent QR orders
 *
 * Usage:
 *   node setup-db.js    # First time only
 *   node server.js      # Start the server
 *
 * Environment:
 *   PORT=80             # Default 80 for captive portal
 *   CLOUD_URL=https://chownow.au  # Cloud sync target
 *   SYNC_INTERVAL=30000 # Cloud sync interval in ms (default 30s)
 */

import cluster from 'cluster';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { gzipSync } from 'zlib';
import Database from 'better-sqlite3';
import { availableParallelism, networkInterfaces } from 'os';
import { initPrinter, isPrinterAvailable, printOrderLabel, printTestLabel, printQRSticker } from './printer.js';

// ─── Cluster Primary ────────────────────────────────────────
if (cluster.isPrimary) {
  const numWorkers = Math.min(availableParallelism(), 4);
  console.log(`[ChowBox] Starting ${numWorkers} workers on ${availableParallelism()} cores`);
  for (let i = 0; i < numWorkers; i++) cluster.fork();
  cluster.on('exit', (worker, code) => {
    console.log(`[ChowBox] Worker ${worker.process.pid} exited (code ${code}), restarting...`);
    cluster.fork();
  });
}

// ─── Worker Process ─────────────────────────────────────────
if (!cluster.isPrimary) {

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '80');
const DIST_DIR = join(__dirname, '..', 'dist');
const DB_PATH = join(__dirname, 'street-eats.db');
const CLOUD_URL = process.env.CLOUD_URL || 'https://chownow.au';
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL || '30000');
const TENANT_ID = process.env.TENANT_ID || 'default';
const TUNNEL_URL = process.env.TUNNEL_URL || '';

// Device ID — persistent across reboots
const DEVICE_ID_PATH = join(__dirname, '.chowbox-id');
function getDeviceId() {
  if (existsSync(DEVICE_ID_PATH)) return readFileSync(DEVICE_ID_PATH, 'utf-8').trim();
  const id = 'cb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  writeFileSync(DEVICE_ID_PATH, id);
  return id;
}
const DEVICE_ID = getDeviceId();

// ─── Database ────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

function generateId() {
  return crypto.randomUUID();
}

function parseJson(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function execCommand(cmd, timeout = 10000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve(stdout);
    });
  });
}

function rowToMenuItem(r) {
  return {
    id: r.id, name: r.name, description: r.description || '', price: r.price,
    unit: r.unit, minQuantity: r.min_quantity,
    preparationOptions: parseJson(r.preparation_options, undefined),
    image: r.image || '', category: r.category, available: !!r.available,
    availabilityType: r.availability_type || 'everyday',
    specificDate: r.specific_date, specificDates: parseJson(r.specific_dates, undefined),
    isPack: !!r.is_pack, packGroups: parseJson(r.pack_groups, undefined),
    availableForCatering: !!r.available_for_catering, cateringCategory: r.catering_category, moq: r.moq,
  };
}

function rowToOrder(r) {
  return {
    id: r.id, userId: r.user_id, customerName: r.customer_name,
    customerEmail: r.customer_email, customerPhone: r.customer_phone,
    items: parseJson(r.items, []), total: r.total, depositAmount: r.deposit_amount,
    status: r.status, cookDay: r.cook_day, type: r.type, pickupTime: r.pickup_time,
    createdAt: r.created_at, temperature: r.temperature,
    fulfillmentMethod: r.fulfillment_method, deliveryAddress: r.delivery_address,
    deliveryFee: r.delivery_fee, trackingNumber: r.tracking_number, courier: r.courier,
    collectionPin: r.collection_pin, pickupLocation: r.pickup_location,
    discountApplied: !!r.discount_applied, paymentIntentId: r.payment_intent_id,
    squareCheckoutId: r.square_checkout_id, source: r.source || 'walk_up',
  };
}

function rowToEvent(r) {
  return {
    id: r.id, date: r.date, type: r.type, title: r.title,
    description: r.description, location: r.location, time: r.time,
    startTime: r.start_time, endTime: r.end_time, orderId: r.order_id,
    image: r.image, tags: parseJson(r.tags, undefined),
  };
}

// ─── API Routes ──────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function handleApi(req, url) {
  const path = url.pathname.replace('/api/v1', '');
  const method = req.method;

  // OPTIONS (CORS preflight)
  if (method === 'OPTIONS') return json(null, 204);

  // ── Orders ──
  if (path === '/orders' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    return json(rows.map(rowToOrder));
  }
  if (path === '/orders' && method === 'POST') {
    const body = await readBody(req);
    const id = body.id || generateId();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT OR REPLACE INTO orders (id, user_id, customer_name, customer_email, customer_phone, items, total, deposit_amount, status, cook_day, type, pickup_time, created_at, temperature, fulfillment_method, delivery_address, delivery_fee, collection_pin, pickup_location, discount_applied, payment_intent_id, square_checkout_id, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, body.userId || '', body.customerName, body.customerEmail || null,
      body.customerPhone || null, JSON.stringify(body.items), body.total,
      body.depositAmount || null, body.status || 'Pending', body.cookDay,
      body.type, body.pickupTime || null, body.createdAt || now,
      body.temperature || 'HOT', body.fulfillmentMethod || 'PICKUP',
      body.deliveryAddress || null, body.deliveryFee || null,
      body.collectionPin || null, body.pickupLocation || null,
      body.discountApplied ? 1 : 0, body.paymentIntentId || null,
      body.squareCheckoutId || null, body.source || 'walk_up', now
    );
    // Queue for cloud sync
    queueSync('CREATE', 'orders', id, body);
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    return json(rowToOrder(row));
  }

  // Single order GET/PUT/DELETE
  const orderMatch = path.match(/^\/orders\/(.+)$/);
  if (orderMatch) {
    const id = orderMatch[1];
    if (method === 'GET') {
      const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
      if (!row) return json({ error: 'Not found' }, 404);
      return json(rowToOrder(row));
    }
    if (method === 'PUT') {
      const body = await readBody(req);
      const fields = []; const binds = [];
      const map = {
        status: 'status', customerName: 'customer_name', customerPhone: 'customer_phone',
        pickupTime: 'pickup_time', pickupLocation: 'pickup_location',
      };
      for (const [key, col] of Object.entries(map)) {
        if (body[key] !== undefined) { fields.push(`${col} = ?`); binds.push(body[key]); }
      }
      if (fields.length === 0) return json({ error: 'No fields' }, 400);
      fields.push('updated_at = ?'); binds.push(new Date().toISOString());
      binds.push(id);
      db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...binds);
      queueSync('UPDATE', 'orders', id, body);
      const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
      return json(rowToOrder(row));
    }
    if (method === 'DELETE') {
      db.prepare('DELETE FROM orders WHERE id = ?').run(id);
      return json(null, 204);
    }
  }

  // ── Menu ──
  if (path === '/menu' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM menu_items ORDER BY category, name').all();
    return json(rows.map(rowToMenuItem));
  }
  if (path === '/menu' && method === 'POST') {
    const body = await readBody(req);
    const id = body.id || generateId();
    db.prepare(
      `INSERT OR REPLACE INTO menu_items (id, name, description, price, unit, min_quantity, preparation_options, image, category, available, availability_type, specific_date, specific_dates, is_pack, pack_groups, available_for_catering, catering_category, moq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, body.name, body.description || null, body.price,
      body.unit || null, body.minQuantity || null,
      body.preparationOptions ? JSON.stringify(body.preparationOptions) : null,
      body.image || null, body.category, body.available !== false ? 1 : 0,
      body.availabilityType || 'everyday', body.specificDate || null,
      body.specificDates ? JSON.stringify(body.specificDates) : null,
      body.isPack ? 1 : 0, body.packGroups ? JSON.stringify(body.packGroups) : null,
      body.availableForCatering ? 1 : 0, body.cateringCategory || null, body.moq || null
    );
    const row = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
    return json(rowToMenuItem(row));
  }

  // ── Settings ──
  if (path === '/settings' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    for (const row of rows) Object.assign(settings, parseJson(row.data, {}));
    return json(settings);
  }
  if (path === '/settings' && method === 'PUT') {
    const body = await readBody(req);
    const existing = db.prepare("SELECT data FROM settings WHERE key = 'general'").get();
    const merged = { ...parseJson(existing?.data, {}), ...body };
    db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)").run(JSON.stringify(merged));
    return json(merged);
  }

  // ── Events ──
  if (path === '/events' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM calendar_events ORDER BY date DESC').all();
    return json(rows.map(rowToEvent));
  }

  // ── Seed ──
  if (path === '/seed' && method === 'POST') {
    const body = await readBody(req);
    const results = [];
    if (body.menu && Array.isArray(body.menu)) {
      for (const item of body.menu) {
        const id = item.id || generateId();
        db.prepare(
          `INSERT OR REPLACE INTO menu_items (id, name, description, price, unit, min_quantity, preparation_options, image, category, available, availability_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, item.name, item.description || null, item.price, item.unit || null,
          item.minQuantity || null, item.preparationOptions ? JSON.stringify(item.preparationOptions) : null,
          item.image || null, item.category, item.available !== false ? 1 : 0, item.availabilityType || 'everyday');
      }
      results.push(`Seeded ${body.menu.length} menu items`);
    }
    if (body.settings) {
      db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)").run(JSON.stringify(body.settings));
      results.push('Seeded settings');
    }
    return json({ success: true, results });
  }

  // ── Print ──
  if (path === '/print/order' && method === 'POST') {
    const body = await readBody(req);
    if (!isPrinterAvailable()) return json({ error: 'No printer connected', printed: false }, 503);
    const labelSettings = body.labelSettings || settings?.labelSettings || {};
    const logoUrl = labelSettings.logoUrl || body.logoUrl || settings?.logoUrl;
    const businessName = body.businessName || settings?.businessName;
    const siteUrl = labelSettings.socialUrl || body.siteUrl || settings?.siteUrl || (CLOUD_URL ? `${CLOUD_URL}/#/menu` : null);
    const success = await printOrderLabel(body, logoUrl, businessName, siteUrl, labelSettings);
    return json({ printed: success });
  }
  if (path === '/print/test' && method === 'POST') {
    if (!isPrinterAvailable()) return json({ error: 'No printer connected', printed: false }, 503);
    const success = printTestLabel();
    return json({ printed: success });
  }
  if (path === '/print/qr' && method === 'POST') {
    const body = await readBody(req);
    if (!isPrinterAvailable()) return json({ error: 'No printer connected', printed: false }, 503);
    const success = printQRSticker(body.url, body.businessName);
    return json({ printed: success });
  }
  if (path === '/print/status' && method === 'GET') {
    return json({ available: isPrinterAvailable() });
  }

  // ── Health ──
  if (path === '/health') {
    return json({ ok: true, mode: 'local', service: 'street-eats-pi', printer: isPrinterAvailable() });
  }

  // ── Admin Diagnostics ──
  if (path === '/admin/status' && method === 'GET') {
    const today = new Date().toISOString().split('T')[0];
    const orderCount = db.prepare('SELECT COUNT(*) as count FROM orders').get();
    const todayOrders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE created_at >= ?').bind(today).get();
    const lastOrder = db.prepare('SELECT created_at FROM orders ORDER BY created_at DESC LIMIT 1').get();
    const queuePending = db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0').get();
    const queueTotal = db.prepare('SELECT COUNT(*) as count FROM sync_queue').get();
    const queueFailed = db.prepare("SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0 AND created_at < datetime('now', '-5 minutes')").get();

    return json({
      system: {
        online: isOnline,
        cloudUrl: CLOUD_URL,
        port: PORT,
        uptime: Math.floor(process.uptime()),
        nodeVersion: process.version,
        memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        pid: process.pid,
      },
      printer: {
        available: isPrinterAvailable(),
      },
      orders: {
        total: orderCount?.count || 0,
        today: todayOrders?.count || 0,
        lastOrderAt: lastOrder?.created_at || null,
      },
      sync: {
        pending: queuePending?.count || 0,
        total: queueTotal?.count || 0,
        stale: queueFailed?.count || 0,
      },
    });
  }
  if (path === '/admin/sync-flush' && method === 'POST') {
    flushSyncQueue();
    return json({ triggered: true });
  }
  if (path === '/admin/sync-clear' && method === 'POST') {
    db.prepare("DELETE FROM sync_queue WHERE synced = 0 AND created_at < datetime('now', '-10 minutes')").run();
    return json({ cleared: true });
  }

  // ── Phone Hotspot (auto-connect) ──
  if (path === '/network/phone-hotspot' && method === 'GET') {
    try {
      const configPath = join(__dirname, '.phone-hotspot.json');
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        return json({ configured: true, ssid: config.ssid });
      }
      return json({ configured: false });
    } catch { return json({ configured: false }); }
  }

  if (path === '/network/phone-hotspot' && method === 'POST') {
    const body = await readBody(req);
    const { ssid, password } = body;
    if (!ssid) return json({ error: 'Phone hotspot name is required' }, 400);
    if (/[;|`$\\]/.test(ssid) || (password && /[;|`$\\]/.test(password))) {
      return json({ error: 'Invalid characters' }, 400);
    }
    try {
      const escapedSsid = ssid.replace(/'/g, "'\\''");
      const escapedPass = password ? password.replace(/'/g, "'\\''") : '';

      // Save config
      const configPath = join(__dirname, '.phone-hotspot.json');
      writeFileSync(configPath, JSON.stringify({ ssid, password: password || '' }));

      // Remove old NM connection
      await execCommand("nmcli connection delete 'ChowBox-Phone' 2>/dev/null || true");

      // Create NM connection with auto-connect
      const addCmd = password
        ? `nmcli connection add type wifi con-name 'ChowBox-Phone' ifname wlan0 ssid '${escapedSsid}' wifi-sec.key-mgmt wpa-psk wifi-sec.psk '${escapedPass}' connection.autoconnect yes connection.autoconnect-priority 100`
        : `nmcli connection add type wifi con-name 'ChowBox-Phone' ifname wlan0 ssid '${escapedSsid}' connection.autoconnect yes connection.autoconnect-priority 100`;
      await execCommand(addCmd, 15000);

      // Now try to connect immediately via passwd-file
      try {
        if (password) {
          writeFileSync('/tmp/.chowbox-phone-pass', `802-11-wireless-security.psk:${password}`);
          await execCommand("nmcli -w 30 connection up 'ChowBox-Phone' passwd-file /tmp/.chowbox-phone-pass", 35000);
          try { await execCommand('rm /tmp/.chowbox-phone-pass'); } catch {}
        } else {
          await execCommand("nmcli -w 30 connection up 'ChowBox-Phone'", 35000);
        }
      } catch {
        // Connection failed — hotspot might not be broadcasting yet, that's OK
        // It's saved and will auto-connect when in range
        return json({ success: true, ssid, connected: false, message: 'Saved. Turn on your phone hotspot — ChowBox will connect automatically.' });
      }

      // Verify internet
      let hasInternet = false;
      try {
        await execCommand(`curl -s --max-time 5 -o /dev/null -w "%{http_code}" https://chownow.au/api/v1/health`, 8000);
        hasInternet = true;
        isOnline = true;
      } catch {}

      return json({ success: true, ssid, connected: true, internet: hasInternet,
        message: hasInternet ? 'Connected to ' + ssid + ' with internet!' : 'Connected to ' + ssid + ' but no internet detected yet.' });
    } catch (err) {
      return json({ error: err.message, success: false }, 400);
    }
  }

  if (path === '/network/phone-hotspot' && method === 'DELETE') {
    try {
      const configPath = join(__dirname, '.phone-hotspot.json');
      if (existsSync(configPath)) writeFileSync(configPath, '{}');
      await execCommand("nmcli connection delete 'ChowBox-Phone' 2>/dev/null || true");
      return json({ success: true });
    } catch (err) {
      return json({ error: err.message, success: false }, 400);
    }
  }

  // ── Network / WiFi Management ──
  if (path === '/network/status' && method === 'GET') {
    try {
      const deviceStatus = await execCommand('nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status');
      const lines = deviceStatus.trim().split('\n').filter(l => l.includes('wifi'));
      let connected = null;
      for (const line of lines) {
        const [device, type, state, connection] = line.split(':');
        if (state === 'connected' && connection) {
          const ipOut = await execCommand(`nmcli -t -f IP4.ADDRESS device show ${device}`).catch(() => '');
          const ip = ipOut.match(/IP4\.ADDRESS\[1\]:(.+?)\//)?.[ 1] || '';
          const signalOut = await execCommand(`nmcli -t -f IN-USE,SIGNAL device wifi list ifname ${device}`).catch(() => '');
          const signalLine = signalOut.split('\n').find(l => l.startsWith('*'));
          const signal = signalLine ? parseInt(signalLine.split(':')[1]) : 0;
          connected = { device, ssid: connection, ip, signal, state: 'connected' };
          break;
        }
      }
      return json({ connected, online: isOnline, interfaces: lines.map(l => l.split(':')[0]) });
    } catch (err) {
      return json({ error: err.message, connected: null, online: isOnline }, 500);
    }
  }

  if (path === '/network/scan' && method === 'GET') {
    try {
      const out = await execCommand('nmcli -t -f SSID,SIGNAL,SECURITY device wifi list --rescan yes');
      const seen = new Set();
      const networks = out.trim().split('\n')
        .map(line => {
          const parts = line.split(':');
          const ssid = parts[0]?.trim();
          const signal = parseInt(parts[1]) || 0;
          const security = parts.slice(2).join(':').trim();
          return { ssid, signal, security };
        })
        .filter(n => {
          if (!n.ssid || seen.has(n.ssid)) return false;
          seen.add(n.ssid);
          return true;
        })
        .sort((a, b) => b.signal - a.signal);
      return json({ networks });
    } catch (err) {
      return json({ error: err.message, networks: [] }, 500);
    }
  }

  if (path === '/network/connect' && method === 'POST') {
    const body = await readBody(req);
    const { ssid, password } = body;
    if (!ssid) return json({ error: 'SSID is required' }, 400);
    if (/[;|`$\\]/.test(ssid) || (password && /[;|`$\\]/.test(password))) {
      return json({ error: 'Invalid characters in SSID or password' }, 400);
    }
    try {
      const escapedSsid = ssid.replace(/'/g, "'\\''");
      const conName = 'ChowBox-WiFi';
      // Delete old connection, create new with stored password, activate via passwd-file
      await execCommand(`nmcli connection delete '${conName}' 2>/dev/null || true`);
      if (password) {
        await execCommand(`nmcli connection add type wifi con-name '${conName}' ifname wlan0 ssid '${escapedSsid}' wifi-sec.key-mgmt wpa-psk wifi-sec.psk-flags 0`, 15000);
        await execCommand(`nmcli connection modify '${conName}' wifi-sec.psk '${password.replace(/'/g, "'\\''")}'`, 5000);
        writeFileSync('/tmp/.chowbox-wifi-pass', `802-11-wireless-security.psk:${password}`);
        await execCommand(`nmcli -w 30 connection up '${conName}' passwd-file /tmp/.chowbox-wifi-pass`, 35000);
        try { await execCommand('rm /tmp/.chowbox-wifi-pass'); } catch {}
      } else {
        await execCommand(`nmcli connection add type wifi con-name '${conName}' ifname wlan0 ssid '${escapedSsid}'`, 15000);
        await execCommand(`nmcli -w 30 connection up '${conName}'`, 35000);
      }
      setTimeout(() => checkConnectivity(), 3000);
      return json({ success: true, ssid });
    } catch (err) {
      return json({ error: err.message || 'Connection failed', success: false }, 400);
    }
  }

  if (path === '/network/saved' && method === 'GET') {
    try {
      const out = await execCommand('nmcli -t -f NAME,TYPE connection show');
      const networks = out.trim().split('\n')
        .filter(l => l.includes('wireless') || l.includes('wifi') || l.includes('802-11'))
        .map(l => l.split(':')[0])
        .filter(Boolean);
      return json({ networks });
    } catch (err) {
      return json({ error: err.message, networks: [] }, 500);
    }
  }

  if (path === '/network/forget' && method === 'POST') {
    const body = await readBody(req);
    const { ssid } = body;
    if (!ssid) return json({ error: 'SSID is required' }, 400);
    if (/[;|`$\\]/.test(ssid)) return json({ error: 'Invalid characters' }, 400);
    try {
      await execCommand(`nmcli connection delete '${ssid.replace(/'/g, "'\\''")}'`);
      return json({ success: true });
    } catch (err) {
      return json({ error: err.message, success: false }, 400);
    }
  }

  // ── Admin: Test SMS ──
  if (path === '/admin/test-sms' && method === 'POST') {
    const body = await readBody(req);
    const { phone, message } = body;
    if (!phone || !message) return json({ error: 'phone and message required' }, 400);
    const result = await sendOperatorAlert(phone, message);
    return json(result);
  }

  // ── SMS stubs (no-op locally, synced to cloud later) ──
  if (path.startsWith('/sms/') || path.startsWith('/email/')) {
    if (method === 'POST') {
      // Queue for cloud sync — SMS/email will be sent when online
      const body = await readBody(req);
      queueSync('NOTIFY', path, generateId(), body);
      return json({ queued: true });
    }
  }

  return json({ error: 'Not found' }, 404);
}

// ─── Sync Queue ──────────────────────────────────────────────

function queueSync(action, tableName, recordId, payload) {
  try {
    db.prepare(
      'INSERT INTO sync_queue (id, action, table_name, record_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(generateId(), action, tableName, recordId, JSON.stringify(payload), new Date().toISOString());
  } catch (err) {
    console.error('[Sync Queue] Failed to queue:', err.message);
  }
}

// ─── Cloud Sync ──────────────────────────────────────────────

let isOnline = false;
let lastSyncLog = 0;

async function checkConnectivity() {
  try {
    const res = await fetch(`${CLOUD_URL}/api/v1/health`, { signal: AbortSignal.timeout(3000) });
    const wasOffline = !isOnline;
    isOnline = res.ok;
    if (wasOffline && isOnline) {
      console.log('[Sync] ✅ Internet detected — flushing queue');
      flushSyncQueue();
    }
  } catch {
    if (isOnline) console.log('[Sync] ❌ Lost internet connection');
    isOnline = false;
  }
}

async function flushSyncQueue() {
  const items = db.prepare('SELECT * FROM sync_queue WHERE synced = 0 ORDER BY created_at').all();
  if (items.length === 0) return;

  // Only log periodically to avoid spam
  const now = Date.now();
  if (now - lastSyncLog > 30000) {
    console.log(`[Sync] ${items.length} items in queue — flushing one at a time`);
    lastSyncLog = now;
  }

  // Process ONE item per cycle — small request, survives flaky connections
  const item = items[0];
  try {
    const payload = JSON.parse(item.payload);

    if (item.table_name === 'orders') {
      const endpoint = item.action === 'CREATE'
        ? `${CLOUD_URL}/api/v1/orders`
        : `${CLOUD_URL}/api/v1/orders/${item.record_id}`;
      const method = item.action === 'CREATE' ? 'POST' : 'PUT';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000), // 5s timeout — fail fast on bad signal
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }

    // Notification queue items (SMS/email)
    if (item.action === 'NOTIFY') {
      const payload = JSON.parse(item.payload);
      await fetch(`${CLOUD_URL}/api/v1${item.table_name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {}); // Notifications are best-effort
    }

    // Mark as synced
    db.prepare('UPDATE sync_queue SET synced = 1 WHERE id = ?').run(item.id);
    console.log(`[Sync] ✅ Synced: ${item.action} ${item.table_name} ${item.record_id.slice(-6)}`);
  } catch (err) {
    // Increment retry count — give up after 100 retries
    const retries = (item.retries || 0) + 1;
    if (retries > 100) {
      db.prepare('UPDATE sync_queue SET synced = 1 WHERE id = ?').run(item.id); // Mark as done, won't retry
      console.error(`[Sync] ❌ Gave up on ${item.id} after 100 retries`);
    }
    // Will retry next cycle (5s)
  }

  // Clean up old synced items periodically
  if (Math.random() < 0.01) { // 1% chance per cycle to avoid constant cleanup
    db.prepare("DELETE FROM sync_queue WHERE synced = 1 AND created_at < datetime('now', '-1 hour')").run();
  }
}

async function pullFromCloud() {
  if (!isOnline) return;
  try {
    // Pull menu from cloud (source of truth for menu)
    const menuRes = await fetch(`${CLOUD_URL}/api/v1/menu`);
    if (menuRes.ok) {
      const items = await menuRes.json();
      const upsert = db.prepare(
        `INSERT OR REPLACE INTO menu_items (id, name, description, price, unit, min_quantity, preparation_options, image, category, available, availability_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const tx = db.transaction(() => {
        for (const item of items) {
          upsert.run(item.id, item.name, item.description || null, item.price, item.unit || null,
            item.minQuantity || null, item.preparationOptions ? JSON.stringify(item.preparationOptions) : null,
            item.image || null, item.category, item.available ? 1 : 0, item.availabilityType || 'everyday');
        }
      });
      tx();
      console.log(`[Sync] Pulled ${items.length} menu items from cloud`);
    }

    // Pull settings from cloud
    const settingsRes = await fetch(`${CLOUD_URL}/api/v1/settings`);
    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)").run(JSON.stringify(settings));
    }
  } catch (err) {
    console.error('[Sync] Pull failed:', err.message);
  }
}

// ─── Static File Server ──────────────────────────────────────

const MIME_TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.webp': 'image/webp', '.webm': 'video/webm',
};

function serveStatic(pathname) {
  // Default to index.html for SPA routing
  let filePath = join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

  // If file doesn't exist, serve index.html (SPA fallback)
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(DIST_DIR, 'index.html');
  }

  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Hashed assets (e.g. index-3-qJAEoE.js) get aggressive caching
    const isHashed = /[-\.][a-zA-Z0-9]{6,}\.(js|css|woff2?)$/.test(filePath);
    const cacheControl = ext === '.html' ? 'no-cache'
      : isHashed ? 'public, max-age=31536000, immutable'
      : 'public, max-age=86400';

    return {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        ...CORS,
      },
      body: content,
    };
  } catch {
    return { status: 404, headers: { 'Content-Type': 'text/plain' }, body: 'Not Found' };
  }
}

// ─── HTTP Server ─────────────────────────────────────────────

function json(data, status = 200) {
  return {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: data !== null && data !== undefined ? JSON.stringify(data) : '',
  };
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// Gzip-compressible content types
const COMPRESSIBLE = new Set(['text/html', 'text/css', 'application/javascript', 'application/json', 'text/plain', 'image/svg+xml']);

function sendResponse(req, res, status, headers, body) {
  const contentType = headers['Content-Type'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const isCompressible = COMPRESSIBLE.has(contentType.split(';')[0]) && body && body.length > 512;

  if (isCompressible && acceptEncoding.includes('gzip')) {
    const compressed = gzipSync(body);
    res.writeHead(status, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': compressed.length });
    res.end(compressed);
  } else {
    res.writeHead(status, headers);
    res.end(body);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    // API routes
    if (url.pathname.startsWith('/api/v1')) {
      const result = await handleApi(req, url);
      await sendResponse(req, res, result.status, result.headers, result.body);
      return;
    }

    // Captive portal detection — redirect to QR ordering page
    // These URLs are checked by phones/OS to detect captive portals
    const captiveUrls = [
      '/generate_204',           // Android
      '/hotspot-detect.html',    // Apple
      '/ncsi.txt',               // Windows
      '/connecttest.txt',        // Windows
      '/redirect',               // Firefox
      '/canonical.html',         // Chrome
      '/success.txt',            // Various
    ];
    if (captiveUrls.some(u => url.pathname === u)) {
      // If accessed via AP interface (10.0.0.1) → show operator setup
      // If accessed via other interface → show QR ordering
      const captiveHost = req.headers.host?.split(':')[0] || '10.0.0.1';
      const orderUrl = captiveHost === '10.0.0.1' ? `http://10.0.0.1/setup` : `http://${captiveHost}/#/qr-order`;
      // Some phones need a non-redirect response to trigger the captive portal popup
      // Return a small HTML page that also redirects via meta + JS
      const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${orderUrl}"><title>ChowBox</title></head><body style="background:#030712;color:#f97316;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h1 style="font-size:28px;margin-bottom:16px;">ChowBox</h1><p style="color:#9ca3af;">Loading menu...</p><a href="${orderUrl}" style="display:inline-block;margin-top:20px;background:#f97316;color:white;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;">Tap to Order</a></div><script>location.href="${orderUrl}"</script></body></html>`;
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache', 'Content-Length': Buffer.byteLength(html) });
      res.end(html);
      return;
    }

    // Operator Setup Page — served at /setup or when accessing via AP (10.0.0.1)
    const host = req.headers.host?.split(':')[0] || '';
    if (url.pathname === '/setup' || url.pathname === '/setup/' || (host === '10.0.0.1' && url.pathname === '/')) {
      const setupPath = join(__dirname, 'operator.html');
      if (existsSync(setupPath)) {
        const html = readFileSync(setupPath, 'utf-8');
        await sendResponse(req, res, 200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' }, html);
        return;
      }
    }

    // Direct API routes (no /api/v1 prefix) — print, health, admin endpoints
    if (url.pathname.startsWith('/print/') || url.pathname === '/health' || url.pathname === '/seed') {
      const result = await handleApi(req, url);
      await sendResponse(req, res, result.status, result.headers, result.body);
      return;
    }

    // ChowBox Admin Page — served from pi-server directory
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      const adminPath = join(__dirname, 'admin.html');
      if (existsSync(adminPath)) {
        const html = readFileSync(adminPath, 'utf-8');
        await sendResponse(req, res, 200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' }, html);
        return;
      }
    }

    // Static files
    const result = serveStatic(url.pathname);
    await sendResponse(req, res, result.status, result.headers, result.body);
  } catch (err) {
    console.error('[Server] Error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

// ─── Printer Init ────────────────────────────────────────────
initPrinter();

// ─── Start ───────────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  const localIPs = getLocalIPs();
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║         STREET EATS — LOCAL MODE         ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  Local:  http://localhost:${PORT}             ║`);
  localIPs.forEach(ip => {
    const padded = `http://${ip}:${PORT}`.padEnd(35);
    console.log(`  ║  WiFi:   ${padded}║`);
  });
  console.log('  ║                                          ║');
  console.log(`  ║  QR URL: http://${localIPs[0] || 'localhost'}:${PORT}/#/qr-order  ║`);
  console.log('  ║                                          ║');
  console.log(`  ║  Cloud sync: ${CLOUD_URL.substring(0, 28).padEnd(28)}║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});

// ─── Heartbeat — phone home to cloud ─────────────────────────

async function sendHeartbeat() {
  if (!isOnline) return;
  try {
    const today = new Date().toISOString().split('T')[0];
    const ordersToday = db.prepare('SELECT COUNT(*) as count FROM orders WHERE created_at >= ?').get(today);
    const syncPending = db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0').get();
    const hostname = (await import('os')).hostname();
    const localIPs = getLocalIPs();

    const hbRes = await fetch(`${CLOUD_URL}/api/v1/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: DEVICE_ID,
        tenantId: TENANT_ID,
        hostname,
        tunnelUrl: TUNNEL_URL,
        ipAddress: localIPs[0] || '',
        printerConnected: isPrinterAvailable(),
        ordersToday: ordersToday?.count || 0,
        syncPending: syncPending?.count || 0,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        nodeVersion: process.version,
      }),
      signal: AbortSignal.timeout(5000),
    });

    // Process remote commands from cloud super-admin
    const hbData = await hbRes.json();
    if (hbData.commands && Array.isArray(hbData.commands)) {
      for (const cmd of hbData.commands) {
        console.log(`[Command] Received: ${cmd}`);
        if (cmd === 'pause_qr_orders') {
          const existing = db.prepare("SELECT data FROM settings WHERE key = 'general'").get();
          const settings = parseJson(existing?.data, {});
          settings.qrOrdersPaused = true;
          db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)").run(JSON.stringify(settings));
          console.log('[Command] QR orders PAUSED');
        } else if (cmd === 'resume_qr_orders') {
          const existing = db.prepare("SELECT data FROM settings WHERE key = 'general'").get();
          const settings = parseJson(existing?.data, {});
          settings.qrOrdersPaused = false;
          db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)").run(JSON.stringify(settings));
          console.log('[Command] QR orders RESUMED');
        } else if (cmd === 'reload_menu') {
          console.log('[Command] Reloading menu from cloud...');
          await pullFromCloud();
        } else if (cmd === 'restart') {
          console.log('[Command] Restarting server...');
          process.exit(0); // systemd will restart
        } else if (cmd === 'update') {
          console.log('[Command] Updating from git...');
          await execCommand('cd /opt/chowbox && git pull', 30000);
          process.exit(0); // systemd will restart with new code
        }
      }
    }
  } catch (e) {
    // Silent fail — heartbeat is best-effort
  }
}

// ─── Operator SMS Alerts ─────────────────────────────────────

async function sendOperatorAlert(phone, message) {
  try {
    const row = db.prepare("SELECT data FROM settings WHERE key = 'general'").get();
    const settings = parseJson(row?.data, {});

    // Method 1: Push notification via ntfy.sh (free, instant, no auth)
    const ntfyTopic = settings.ntfyTopic || `chowbox-${DEVICE_ID}`;
    try {
      await fetch(`https://ntfy.sh/${ntfyTopic}`, {
        method: 'POST',
        headers: { 'Title': 'ChowBox Alert', 'Priority': 'high', 'Tags': 'food,truck' },
        body: message,
        signal: AbortSignal.timeout(5000),
      });
      console.log(`[Alert] Sent push notification to ntfy.sh/${ntfyTopic}`);
      return { sent: true, via: 'ntfy' };
    } catch {}

    // Method 2: ClickSend SMS (if configured)
    const sms = settings.smsSettings || {};
    if (sms.username && sms.apiKey && phone) {
      const auth = Buffer.from(`${sms.username}:${sms.apiKey}`).toString('base64');
      const res = await fetch('https://rest.clicksend.com/v3/sms/send', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ to: phone, body: message, source: 'chownow', ...(sms.fromNumber ? { from: sms.fromNumber } : {}) }] }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return { sent: true, via: 'clicksend' };
    }

    // Method 3: Cloud relay
    if (isOnline && phone) {
      await fetch(`${CLOUD_URL}/api/v1/sms/operator-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message, tenantId: TENANT_ID }),
        signal: AbortSignal.timeout(10000),
      });
      return { sent: true, via: 'cloud' };
    }

    return { sent: false, error: 'No notification method available' };
  } catch (err) {
    console.error('[Alert] Failed:', err.message);
    return { sent: false, error: err.message };
  }
}

let lastOnlineState = null;

async function checkAndNotifyConnectivity() {
  const wasOnline = lastOnlineState;
  await checkConnectivity();

  // Only notify on state change, and only on worker 0
  if (wasOnline !== null && wasOnline !== isOnline) {
    try {
      const row = db.prepare("SELECT data FROM settings WHERE key = 'general'").get();
      const settings = parseJson(row?.data, {});
      const phone = settings.operatorPhone;
      const name = settings.businessName || 'ChowBox';
      if (phone) {
        const today = new Date().toISOString().split('T')[0];
        const orderCount = db.prepare('SELECT COUNT(*) as count FROM orders WHERE created_at >= ?').get(today);
        if (isOnline) {
          await sendOperatorAlert(phone, `${name} is ONLINE and ready to serve. ${orderCount?.count || 0} orders today. Cloud sync active.`);
          console.log('[SMS] Sent online notification to', phone);
        } else {
          await sendOperatorAlert(phone, `${name} lost internet. Orders are being saved locally and will sync when connection returns.`);
          console.log('[SMS] Sent offline notification to', phone);
        }
      }
    } catch (err) {
      console.error('[SMS] Notification failed:', err.message);
    }
  }
  lastOnlineState = isOnline;
}

// ─── Sync Loops (worker 0 only — avoids duplicate heartbeats) ──

const isFirstWorker = cluster.worker?.id === 1;

if (isFirstWorker) {
  // Fast loop: check connectivity (with SMS alerts) + flush queue + heartbeat (every 30s)
  setInterval(async () => {
    await checkAndNotifyConnectivity();
    if (isOnline) {
      await flushSyncQueue();
      await sendHeartbeat();
    }
  }, SYNC_INTERVAL);

  // Slow loop: pull menu/settings from cloud (every 5 min)
  setInterval(async () => {
    if (isOnline) await pullFromCloud();
  }, 300000);

  // Initial sync — notify operator on first boot if online
  checkAndNotifyConnectivity();
  setTimeout(() => { if (isOnline) pullFromCloud(); }, 3000);

  // Log queue status every 60s
  setInterval(() => {
    const pending = db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0').get();
    const total = db.prepare('SELECT COUNT(*) as count FROM orders').get();
    if (pending.count > 0 || !isOnline) {
      console.log(`[Status] Orders: ${total.count} | Queue: ${pending.count} pending | Internet: ${isOnline ? '✅' : '❌'}`);
    }
  }, 60000);
} else {
  // Non-primary workers still need connectivity state for API responses
  setInterval(checkConnectivity, SYNC_INTERVAL);
}

// ─── Helpers ─────────────────────────────────────────────────

function getLocalIPs() {
  const ips = [];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

} // end cluster worker block
