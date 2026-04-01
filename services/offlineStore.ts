/**
 * Offline-first data layer using IndexedDB.
 *
 * How it works:
 * - All reads come from IndexedDB first (instant, works offline)
 * - Online writes go to API → then update IndexedDB
 * - Offline writes go to an outbox queue in IndexedDB
 * - When connectivity returns, outbox items are replayed against the API
 * - Polling pulls fresh data from API → merges into IndexedDB
 *
 * This gives Square-like offline reliability:
 * - Menu always loads (cached)
 * - Orders can be created offline (queued)
 * - Status changes can happen offline (queued)
 * - Everything syncs when back online
 */

const DB_NAME = 'street-eats-offline';
const DB_VERSION = 1;

interface OutboxItem {
  id: string;
  action: 'CREATE_ORDER' | 'UPDATE_ORDER' | 'UPDATE_STATUS';
  payload: any;
  createdAt: string;
  retries: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Data caches
      if (!db.objectStoreNames.contains('menu')) db.createObjectStore('menu', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('orders')) db.createObjectStore('orders', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', { keyPath: 'id' });
      // Offline outbox
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' });
      // Sync metadata
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// Generic IDB helpers
async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getFromStore<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putToStore(storeName: string, data: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function putBatchToStore(storeName: string, items: any[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteFromStore(storeName: string, key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Public API ──────────────────────────────────────────────

// Menu cache
export const cacheMenu = (items: any[]) => putBatchToStore('menu', items);
export const getCachedMenu = () => getAllFromStore<any>('menu');

// Orders cache
export const cacheOrders = (orders: any[]) => putBatchToStore('orders', orders);
export const getCachedOrders = () => getAllFromStore<any>('orders');
export const cacheOrder = (order: any) => putToStore('orders', order);
export const getCachedOrder = (id: string) => getFromStore<any>('orders', id);

// Settings cache
export const cacheSettings = (settings: any) => putToStore('settings', { key: 'general', ...settings });
export const getCachedSettings = async () => {
  const row = await getFromStore<any>('settings', 'general');
  if (!row) return null;
  const { key, ...settings } = row;
  return settings;
};

// Events cache
export const cacheEvents = (events: any[]) => putBatchToStore('events', events);
export const getCachedEvents = () => getAllFromStore<any>('events');

// Users cache
export const cacheUsers = (users: any[]) => putBatchToStore('users', users);
export const getCachedUsers = () => getAllFromStore<any>('users');

// ─── Outbox (offline queue) ──────────────────────────────────

export async function addToOutbox(action: OutboxItem['action'], payload: any): Promise<string> {
  const item: OutboxItem = {
    id: `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action,
    payload,
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  await putToStore('outbox', item);
  return item.id;
}

export const getOutboxItems = () => getAllFromStore<OutboxItem>('outbox');
export const removeOutboxItem = (id: string) => deleteFromStore('outbox', id);

export async function getOutboxCount(): Promise<number> {
  const items = await getOutboxItems();
  return items.length;
}

// ─── Sync metadata ───────────────────────────────────────────

export async function getLastSync(collection: string): Promise<string | null> {
  const meta = await getFromStore<any>('meta', `lastSync_${collection}`);
  return meta?.value || null;
}

export async function setLastSync(collection: string, timestamp: string): Promise<void> {
  await putToStore('meta', { key: `lastSync_${collection}`, value: timestamp });
}

// ─── Clear all offline data ──────────────────────────────────

export async function clearAllOfflineData(): Promise<void> {
  await Promise.all(['menu', 'orders', 'settings', 'events', 'users', 'outbox', 'meta'].map(clearStore));
}
