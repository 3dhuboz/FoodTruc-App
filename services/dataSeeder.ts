
import { db, auth } from './firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { INITIAL_MENU, INITIAL_SETTINGS, INITIAL_ADMIN_USER, INITIAL_EVENTS } from '../constants';

export const seedDatabase = async () => {
  if (!db) throw new Error("Database not initialized. Check API Key.");
  const batch = writeBatch(db);

  // 1. Seed Settings
  const settingsRef = doc(db, 'settings', 'general');
  batch.set(settingsRef, INITIAL_SETTINGS);

  // 2. Seed Menu
  INITIAL_MENU.forEach(item => {
      const ref = doc(db, 'menu', item.id);
      batch.set(ref, item);
  });

  // 3. Seed Events
  INITIAL_EVENTS.forEach(evt => {
      const ref = doc(db, 'events', evt.id);
      batch.set(ref, evt);
  });
  
  // 4. Cook Days - deprecated in favor of calendar events (no-op)

  // 5. Create Admin User Document (Firestore Only)
  const adminRef = doc(db, 'users', INITIAL_ADMIN_USER.id);
  batch.set(adminRef, INITIAL_ADMIN_USER);

  // Commit Batch
  await batch.commit();
  return "Database populated successfully.";
};

export const createAdminAuth = async (password: string) => {
  if (!auth) throw new Error("Auth not initialized. Check API Key.");
  try {
      await createUserWithEmailAndPassword(
          auth, 
          INITIAL_ADMIN_USER.email, 
          password
      );
      return `Admin Auth Created! Login with: ${INITIAL_ADMIN_USER.email}`;
  } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
          return 'Admin account already exists.';
      } else {
          throw e;
      }
  }
};
