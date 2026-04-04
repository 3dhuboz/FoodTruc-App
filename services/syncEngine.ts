/**
 * Sync engine: bridges offline IndexedDB store ↔ Cloudflare D1 API.
 *
 * - Replays outbox items when back online
 * - Polls for fresh data at configurable intervals
 * - Emits events so React can react to changes
 *
 * Polling intervals:
 * - Orders: 3s (BOH/FOH need near-real-time)
 * - Menu/Settings: 30s (rarely changes during service)
 * - Connectivity check: 10s when offline
 */

import {
  cacheMenu, cacheOrders, cacheOrder, cacheSettings, cacheEvents,
  getCachedOrders, getCachedMenu, getCachedSettings, getCachedEvents,
  getOutboxItems, removeOutboxItem,
  getLastSync, setLastSync,
} from './offlineStore';
import {
  fetchMenu, fetchOrders, fetchSettings, fetchEvents, fetchOrder,
  createOrderApi, updateOrderApi,
} from './api';
import type { Order } from '../types';

type SyncListener = (event: SyncEvent) => void;

export interface SyncEvent {
  type: 'orders_updated' | 'menu_updated' | 'settings_updated' | 'events_updated' |
        'outbox_synced' | 'outbox_failed' | 'online' | 'offline' | 'sync_error';
  data?: any;
}

let listeners: SyncListener[] = [];
let orderPollTimer: ReturnType<typeof setInterval> | null = null;
let slowPollTimer: ReturnType<typeof setInterval> | null = null;
let outboxTimer: ReturnType<typeof setInterval> | null = null;
let isOnline = navigator.onLine;
let isSyncing = false;

// ─── Event system ────────────────────────────────────────────

export function onSync(listener: SyncListener): () => void {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

function emit(event: SyncEvent) {
  listeners.forEach(l => { try { l(event); } catch {} });
}

// ─── Connectivity ────────────────────────────────────────────

function handleOnline() {
  if (isOnline) return;
  isOnline = true;
  emit({ type: 'online' });
  // Immediately try to flush outbox
  flushOutbox();
  // Immediately poll everything
  pullOrders();
  pullSlowData();
}

function handleOffline() {
  if (!isOnline) return;
  isOnline = false;
  emit({ type: 'offline' });
}

export function getOnlineStatus() { return isOnline; }

// ─── Outbox replay ───────────────────────────────────────────

async function flushOutbox(): Promise<void> {
  if (!isOnline || isSyncing) return;
  isSyncing = true;

  try {
    const items = await getOutboxItems();
    if (items.length === 0) { isSyncing = false; return; }
    console.log(`[Sync] Flushing ${items.length} outbox items...`);

    let synced = 0;
    for (const item of items) {
      try {
        switch (item.action) {
          case 'CREATE_ORDER': {
            const created = await createOrderApi(item.payload);
            await cacheOrder(created);
            break;
          }
          case 'UPDATE_ORDER':
          case 'UPDATE_STATUS': {
            const updated = await updateOrderApi(item.payload.id, item.payload);
            await cacheOrder(updated);
            break;
          }
        }
        await removeOutboxItem(item.id);
        synced++;
        emit({ type: 'outbox_synced', data: item });
      } catch (err) {
        // Track retries — give up after 50
        const retries = (item.retries || 0) + 1;
        if (retries > 50) {
          console.error(`[Sync] Outbox item ${item.id} failed after 50 retries — removing`);
          await removeOutboxItem(item.id);
        } else {
          // Update retry count in IndexedDB (best effort)
          try {
            const { updateOutboxRetries } = await import('./offlineStore');
            await updateOutboxRetries(item.id, retries);
          } catch {}
          console.warn(`[Sync] Outbox item ${item.id} failed (attempt ${retries}):`, err);
        }
        emit({ type: 'outbox_failed', data: { item, error: err } });
      }
    }
    if (synced > 0) console.log(`[Sync] Flushed ${synced}/${items.length} outbox items`);
  } finally {
    isSyncing = false;
  }
}

// ─── Pull fresh data from API ────────────────────────────────

let lastOrderSync = '';

async function pullOrders(): Promise<void> {
  if (!isOnline) return;
  try {
    // Incremental sync: only fetch orders updated since last pull
    const params: any = {};
    if (lastOrderSync) params.since = lastOrderSync;
    const orders = await fetchOrders(params);
    if (orders.length > 0) {
      await cacheOrders(orders); // Merges into existing cache
      emit({ type: 'orders_updated', data: orders });
    }
    lastOrderSync = new Date().toISOString();
    await setLastSync('orders', lastOrderSync);
  } catch (err) {
    emit({ type: 'sync_error', data: { collection: 'orders', error: err } });
  }
}

async function pullSlowData(): Promise<void> {
  if (!isOnline) return;
  try {
    const [menu, settings, events] = await Promise.allSettled([
      fetchMenu(), fetchSettings(), fetchEvents(),
    ]);
    if (menu.status === 'fulfilled') {
      await cacheMenu(menu.value);
      emit({ type: 'menu_updated', data: menu.value });
    }
    if (settings.status === 'fulfilled') {
      await cacheSettings(settings.value);
      emit({ type: 'settings_updated', data: settings.value });
    }
    if (events.status === 'fulfilled') {
      await cacheEvents(events.value);
      emit({ type: 'events_updated', data: events.value });
    }
  } catch (err) {
    emit({ type: 'sync_error', data: { collection: 'slow', error: err } });
  }
}

// ─── Poll a single order (for customer status page) ──────────

export async function pollSingleOrder(orderId: string): Promise<Order | null> {
  if (!isOnline) {
    // Return cached version
    const { getCachedOrder } = await import('./offlineStore');
    return getCachedOrder(orderId);
  }
  try {
    const order = await fetchOrder(orderId);
    await cacheOrder(order);
    return order;
  } catch {
    const { getCachedOrder } = await import('./offlineStore');
    return getCachedOrder(orderId);
  }
}

// ─── Start / stop sync engine ────────────────────────────────

export function startSync(orderIntervalMs = 3000, slowIntervalMs = 30000): void {
  stopSync(); // Clean up any existing timers

  // Listen for connectivity changes
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  isOnline = navigator.onLine;

  // Initial pull
  if (isOnline) {
    pullOrders();
    pullSlowData();
    flushOutbox();
  }

  // Order polling (fast — 3s for BOH/FOH)
  orderPollTimer = setInterval(() => {
    if (isOnline) pullOrders();
  }, orderIntervalMs);

  // Menu/settings/events polling (slow — 30s)
  slowPollTimer = setInterval(() => {
    if (isOnline) pullSlowData();
  }, slowIntervalMs);

  // Outbox flush (5s when online)
  outboxTimer = setInterval(() => {
    if (isOnline) flushOutbox();
  }, 5000);
}

export function stopSync(): void {
  if (orderPollTimer) { clearInterval(orderPollTimer); orderPollTimer = null; }
  if (slowPollTimer) { clearInterval(slowPollTimer); slowPollTimer = null; }
  if (outboxTimer) { clearInterval(outboxTimer); outboxTimer = null; }
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
}

// ─── Bootstrap: load from cache first, then sync ─────────────

export async function bootstrap(): Promise<{
  menu: any[]; orders: any[]; settings: any; events: any[];
}> {
  // Instant load from IndexedDB
  const [menu, orders, settings, events] = await Promise.all([
    getCachedMenu(), getCachedOrders(), getCachedSettings(), getCachedEvents(),
  ]);

  return {
    menu: menu || [],
    orders: orders || [],
    settings: settings || {},
    events: events || [],
  };
}
