/**
 * Firebase stub — legacy compatibility.
 * Firebase has been replaced by Cloudflare D1.
 * This file exists so any remaining imports don't break the build.
 */

export const firebaseConfig = { projectId: 'migrated-to-d1', apiKey: '' };
export const isFirebaseConfigured = false;
export const app = null as any;
export const auth = { currentUser: null } as any;
export const db = null as any;
export const storage = null as any;
