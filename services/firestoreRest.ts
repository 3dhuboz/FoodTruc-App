/**
 * Firestore REST API helper — bypasses the SDK's WebChannel transport
 * which can be unreliable on some networks. Uses standard fetch() instead.
 */
import { firebaseConfig, auth } from './firebase';

/** Get the current user's Firebase Auth ID token for authenticated requests */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const user = auth?.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {
    console.warn('[REST] Failed to get auth token, proceeding without auth:', e);
  }
  return headers;
}

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

// Convert a JS value to Firestore REST API field format
function toFirestoreValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    // Handle Firestore SDK Timestamp objects
    if (typeof value.toDate === 'function') {
      return { timestampValue: value.toDate().toISOString() };
    }
    // Handle plain timestamp-like objects {seconds, nanoseconds}
    if ('seconds' in value && 'nanoseconds' in value && Object.keys(value).length === 2) {
      const ms = value.seconds * 1000 + Math.floor(value.nanoseconds / 1000000);
      return { timestampValue: new Date(ms).toISOString() };
    }
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

// Convert a flat JS object to Firestore document fields
function toFirestoreFields(data: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

/**
 * Write (merge) fields to a Firestore document via REST API.
 * Equivalent to setDoc(doc(db, collection, docId), data, { merge: true })
 */
export async function restSetDoc(
  collectionPath: string,
  docId: string,
  data: Record<string, any>
): Promise<void> {
  // Strip 'id' from payload — it's document metadata, not a field
  const { id: _id, ...cleanData } = data;
  const fieldPaths = Object.keys(cleanData);
  if (fieldPaths.length === 0) {
    console.warn(`[REST WRITE] No fields to write for ${collectionPath}/${docId}`);
    return;
  }
  const updateMask = fieldPaths.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${BASE_URL}/${collectionPath}/${docId}?${updateMask}`;

  const body = JSON.stringify({ fields: toFirestoreFields(cleanData) });
  const headers = await getAuthHeaders();

  console.log(`[REST WRITE] PATCH ${collectionPath}/${docId}`, fieldPaths, headers.Authorization ? '(authenticated)' : '(NO AUTH)');
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[REST WRITE] FAILED ${collectionPath}/${docId} (${res.status}):`, errText);
    throw new Error(`Firestore REST write failed (${res.status}): ${errText}`);
  }
  console.log(`[REST WRITE] OK ${collectionPath}/${docId}`);
}

/**
 * Read a Firestore document via REST API.
 */
export async function restGetDoc(
  collectionPath: string,
  docId: string
): Promise<Record<string, any> | null> {
  const url = `${BASE_URL}/${collectionPath}/${docId}`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST read failed (${res.status}): ${errText}`);
  }
  const doc = await res.json();
  if (!doc.fields) return {};
  return fromFirestoreFields(doc.fields);
}

// Convert Firestore REST field format back to JS values
function fromFirestoreValue(field: any): any {
  if ('nullValue' in field) return null;
  if ('booleanValue' in field) return field.booleanValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return field.doubleValue;
  if ('stringValue' in field) return field.stringValue;
  if ('timestampValue' in field) return field.timestampValue;
  if ('geoPointValue' in field) return field.geoPointValue;
  if ('referenceValue' in field) return field.referenceValue;
  if ('bytesValue' in field) return field.bytesValue;
  if ('arrayValue' in field) {
    return (field.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in field) {
    return fromFirestoreFields(field.mapValue.fields || {});
  }
  return null;
}

function fromFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = fromFirestoreValue(value);
  }
  return result;
}

/**
 * List all documents in a Firestore collection via REST API.
 * Returns array of objects with document data + id field.
 */
export async function restListDocs(
  collectionPath: string,
  orderByField?: string,
  direction?: 'ASCENDING' | 'DESCENDING'
): Promise<Record<string, any>[]> {
  let allDocs: Record<string, any>[] = [];
  let pageToken = '';
  const headers = await getAuthHeaders();
  
  do {
    let url = `${BASE_URL}/${collectionPath}?pageSize=300`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    if (orderByField) url += `&orderBy=${encodeURIComponent(orderByField)}${direction === 'DESCENDING' ? ' desc' : ''}`;
    
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST list failed (${res.status}): ${errText}`);
    }
    const data = await res.json();
    if (data.documents) {
      for (const doc of data.documents) {
        const docPath = doc.name as string;
        const id = docPath.split('/').pop() || '';
        const fields = doc.fields ? fromFirestoreFields(doc.fields) : {};
        allDocs.push({ ...fields, id });
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  
  return allDocs;
}

/**
 * Delete a Firestore document via REST API.
 */
export async function restDeleteDoc(
  collectionPath: string,
  docId: string
): Promise<void> {
  console.log(`[REST DELETE] ${collectionPath}/${docId}`);
  const url = `${BASE_URL}/${collectionPath}/${docId}`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, { method: 'DELETE', headers });
  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    console.error(`[REST DELETE] FAILED ${collectionPath}/${docId} (${res.status}):`, errText);
    throw new Error(`Firestore REST delete failed (${res.status}): ${errText}`);
  }
  console.log(`[REST DELETE] OK ${collectionPath}/${docId}`);
}
