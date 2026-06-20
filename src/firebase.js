import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

const fallbackFirebaseConfig = {
  apiKey: "AIzaSyAIHA_tbHQbK7-7mQrPA-Y2RMN7c-FZrIk",
  authDomain: "oncology-tracker.firebaseapp.com",
  projectId: "oncology-tracker",
  storageBucket: "oncology-tracker.firebasestorage.app",
  messagingSenderId: "695779952773",
  appId: "1:695779952773:web:41e75642396265295981ec",
  measurementId: "",
};

const envFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const firebaseConfig = Object.fromEntries(
  Object.entries(fallbackFirebaseConfig).map(([key, fallbackValue]) => [
    key,
    envFirebaseConfig[key] || fallbackValue,
  ])
);

export const firebaseConfigStatus = {
  configured: Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId),
  usingFallback: Object.keys(fallbackFirebaseConfig).some((key) => !envFirebaseConfig[key] && fallbackFirebaseConfig[key]),
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
};

const app = initializeApp(firebaseConfig);

let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [
      indexedDBLocalPersistence,
      browserLocalPersistence,
      inMemoryPersistence,
    ],
  });
} catch (error) {
  authInstance = error?.code === 'auth/already-initialized' ? getAuth(app) : null;
  if (!authInstance) throw error;
}

export const auth = authInstance;
export const db = getFirestore(app);
export default app;

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
};
