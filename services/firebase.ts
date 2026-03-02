import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Access environment variables safely for Vite (import.meta.env) or legacy (process.env)
const getEnv = (key: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    // @ts-ignore
    return process.env[key];
  }
  return "";
};

// Helper to check for override in LocalStorage (Allows admin to change config at runtime without rebuild)
const getStoredConfig = () => {
  try {
    const stored = localStorage.getItem('sm_firebase_override');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.warn("Failed to parse stored firebase config", e);
  }
  return null;
};

const storedConfig = getStoredConfig();

const defaultConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN") || "your-project.firebaseapp.com",
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID") || "your-project-id",
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET") || "your-project.firebasestorage.app",
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID")
};

// Active Configuration (Override takes precedence)
export const firebaseConfig = storedConfig || defaultConfig;

// Initialize Firebase services lazily
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let configured = false;

try {
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_API_KEY")) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    configured = true;

    // Enable Offline Persistence (multi-tab support)
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
      if (err.code == 'failed-precondition') {
          console.warn('Persistence failed: another instance may be running.');
      } else if (err.code == 'unimplemented') {
          console.warn('The current browser does not support persistence.');
      }
    });
  }
} catch (e) {
  console.error("Firebase Initialization Failed:", e);
}

export const isFirebaseConfigured = configured;

// Export the potentially uninitialized services
export { app, auth, db, storage };
