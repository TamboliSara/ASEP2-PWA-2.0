import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase, ref } from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";
import { signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const hasFirebaseConfig = Object.values(firebaseConfig).some(Boolean);
const app = hasFirebaseConfig
  ? getApps()[0] ?? initializeApp(firebaseConfig)
  : undefined;

export const firebaseApp = app;
export const auth = app ? getAuth(app) : undefined;
export const db = app ? getFirestore(app) : undefined;
export const rtdb = app ? getDatabase(app) : undefined;
export const functions = app ? getFunctions(app) : undefined;

// ── Cloud Functions ──────────────────────────────────────────────
export const initiateDepositFn = functions ? httpsCallable(functions, 'initiateDeposit') : undefined;
export const initiateRetrievalFn = functions ? httpsCallable(functions, 'initiateRetrieval') : undefined;

// ── RTDB Path Helpers (split-database: RTDB = real-time IoT layer) ──
// telemetry/{lockerId}  → ESP32 pushes sensor readings here
// commands/{lockerId}   → PWA/Cloud Functions write commands (LOCK, UNLOCK, SANITIZE)
// status/{lockerId}     → ESP32 writes door_state, lock_state, occupancy
export function rtdbRef(path: string) {
  if (!rtdb) return undefined;
  return ref(rtdb, path);
}

export function telemetryRef(lockerId: string) {
  return rtdbRef(`telemetry/${lockerId}`);
}

export function commandRef(lockerId: string) {
  return rtdbRef(`commands/${lockerId}`);
}

export function statusRef(lockerId: string) {
  return rtdbRef(`status/${lockerId}`);
}

export function deviceRegistrationRef(lockerId: string) {
  return rtdbRef(`devices/${lockerId}`);
}

// ── Anonymous Auth (auto sign-in for kiosk mode) ──────────────────
if (auth) {
  signInAnonymously(auth).catch(console.error);
}