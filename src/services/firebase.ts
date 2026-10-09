import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase, ref } from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";
import { signInAnonymously, connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";
import { connectDatabaseEmulator } from "firebase/database";
import { connectFunctionsEmulator } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDM-U0nzfK9P3PYu8OHx_49XtHIROtd_Cg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "asep-10fe3.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://asep-10fe3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "asep-10fe3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "asep-10fe3.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = getApps()[0] ?? initializeApp(firebaseConfig);

export const firebaseApp = app;
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// ── Connect to Emulators vs Cloud ──────────────────────────────────
const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";

if (import.meta.env.DEV && useEmulators) {
  try {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8081);
    connectDatabaseEmulator(rtdb, "127.0.0.1", 9001);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    console.log("[Firebase] Connected to local emulators");
  } catch (e) {
    console.error("[Firebase] Emulator connection failed:", e);
  }
} else {
  console.log("[Firebase] Using Live Cloud Realtime Database & Firestore");
  // Sign in anonymously to authenticate with Cloud Firebase
  signInAnonymously(auth).catch((err) => {
    console.warn("[Firebase] Anonymous auth notice:", err.message);
  });
}

// ── Cloud Functions ──────────────────────────────────────────────
export const initiateDepositFn = httpsCallable(functions, 'initiateDeposit');
export const initiateRetrievalFn = httpsCallable(functions, 'initiateRetrieval');
export const processVoiceCommandFn = httpsCallable(functions, 'processVoiceCommand');

// ── RTDB Path Helpers (split-database: RTDB = real-time IoT layer) ──
// telemetry/{lockerId}  → ESP32 pushes sensor readings here
// commands/{lockerId}   → PWA/Cloud Functions write commands (LOCK, UNLOCK, SANITIZE)
// status/{lockerId}     → ESP32 writes door_state, lock_state, occupancy
export function rtdbRef(path: string) {
  return ref(rtdb, path);
}

function resolveLockerId(lockerId: string): string {
  // Keep canonical lockerId (e.g. chamber-1) so RTDB paths match the firmware exactly
  return lockerId;
}

export function telemetryRef(lockerId: string) {
  return rtdbRef(`telemetry/${resolveLockerId(lockerId)}`);
}

export function commandRef(lockerId: string) {
  return rtdbRef(`commands/${resolveLockerId(lockerId)}`);
}

export function statusRef(lockerId: string) {
  return rtdbRef(`status/${resolveLockerId(lockerId)}`);
}

export function deviceRegistrationRef(lockerId: string) {
  return rtdbRef(`devices/${resolveLockerId(lockerId)}`);
}

export function chamberCameraRef(lockerId: string) {
  return rtdbRef(`data_collection/camera/${resolveLockerId(lockerId)}`);
}

export function chamberCameraSignalingRef(lockerId: string) {
  return rtdbRef(`data_collection/camera_signaling/${resolveLockerId(lockerId)}`);
}

// ── Anonymous Auth (auto sign-in for kiosk mode) ──────────────────
if (auth) {
  signInAnonymously(auth).catch(console.error);
}