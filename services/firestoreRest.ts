/**
 * Legacy compatibility layer — maps restSetDoc/restGetDoc/restListDocs/restDeleteDoc
 * to the Cloudflare D1 API endpoints.
 *
 * This allows SettingsManager, SocialManager, and other admin pages to work
 * without rewriting their 2000+ lines. Same interface, D1 backend.
 */

// Map Firestore collection names → D1 API paths
const COLLECTION_MAP: Record<string, string> = {
  settings: '/api/v1/settings',
  menu: '/api/v1/menu',
  orders: '/api/v1/orders',
  events: '/api/v1/events',
  social_posts: '/api/v1/social-posts',
  gallery_posts: '/api/v1/gallery',
  users: '/api/v1/users',
};

function getApiPath(collection: string, docId?: string): string {
  const base = COLLECTION_MAP[collection];
  if (!base) throw new Error(`Unknown collection: ${collection}`);
  if (docId && collection !== 'settings') return `${base}/${docId}`;
  return base;
}

/**
 * Write (merge) data to a D1-backed resource.
 * Settings: PUT /api/v1/settings with merged data
 * Everything else: POST to create/upsert
 */
export async function restSetDoc(
  collectionPath: string,
  docId: string,
  data: Record<string, any>
): Promise<void> {
  const { id: _id, ...cleanData } = data;

  if (collectionPath === 'settings') {
    // Settings are stored as key-value blobs, merge into the single settings object
    await fetch('/api/v1/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanData),
    });
    return;
  }

  const path = getApiPath(collectionPath);
  const payload = { id: docId, ...cleanData };

  // POST = create/upsert for all collections
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // Try PUT for update if POST fails (order updates, etc.)
    const putPath = getApiPath(collectionPath, docId);
    const putRes = await fetch(putPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanData),
    });
    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`D1 write failed (${putRes.status}): ${errText}`);
    }
  }
}

/**
 * Read a single document from D1.
 */
export async function restGetDoc(
  collectionPath: string,
  docId: string
): Promise<Record<string, any> | null> {
  if (collectionPath === 'settings') {
    const res = await fetch('/api/v1/settings');
    if (!res.ok) return null;
    return res.json();
  }

  const path = getApiPath(collectionPath, docId);
  const res = await fetch(path);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
}

/**
 * List all documents in a collection from D1.
 */
export async function restListDocs(
  collectionPath: string
): Promise<Record<string, any>[]> {
  const path = getApiPath(collectionPath);
  const res = await fetch(path);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Delete a document from D1.
 */
export async function restDeleteDoc(
  collectionPath: string,
  docId: string
): Promise<void> {
  if (collectionPath === 'settings') return; // Can't delete settings
  const path = getApiPath(collectionPath, docId);
  await fetch(path, { method: 'DELETE' });
}
