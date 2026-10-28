import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const env = import.meta.env;

export const isConfigured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID);

// Placeholder values keep module load from throwing when .env.local is missing;
// the UI shows a setup message instead of ever using them.
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'unset',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'unset.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'unset',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID || 'unset',
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// IndexedDB persistence: reads and writes work offline and sync on reconnect.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
