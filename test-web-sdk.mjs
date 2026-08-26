import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { getDatabase, ref, set, get } from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from "fs";

// Load .env.local manually
const envFile = fs.readFileSync(".env.local", "utf-8");
const envVars = {};
envFile.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const match = trimmed.match(/^([^=]+)="?(.*?)"?$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const firebaseConfig = {
  apiKey: envVars["VITE_FIREBASE_API_KEY"],
  authDomain: envVars["VITE_FIREBASE_AUTH_DOMAIN"],
  databaseURL: envVars["VITE_FIREBASE_DATABASE_URL"],
  projectId: envVars["VITE_FIREBASE_PROJECT_ID"],
  storageBucket: envVars["VITE_FIREBASE_STORAGE_BUCKET"],
  messagingSenderId: envVars["VITE_FIREBASE_MESSAGING_SENDER_ID"],
  appId: envVars["VITE_FIREBASE_APP_ID"],
  measurementId: envVars["VITE_FIREBASE_MEASUREMENT_ID"]
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

async function testConnection() {
  console.log("Testing Firebase Web SDK Connection...");

  try {
    console.log("Authenticating anonymously...");
    await signInAnonymously(auth);
    console.log("✅ Authenticated successfully.");
    // 1. Test RTDB Write/Read
    console.log("\n--- Testing RTDB ---");
    const testRef = ref(rtdb, "test_connection");
    await set(testRef, { timestamp: Date.now(), status: "success" });
    console.log("✅ Successfully wrote to RTDB.");
    
    const snapshot = await get(testRef);
    if (snapshot.exists()) {
      console.log("✅ Successfully read from RTDB:", snapshot.val());
    } else {
      console.log("❌ Failed to read from RTDB (no data).");
    }

    // 2. Test Firestore Write/Read
    console.log("\n--- Testing Firestore ---");
    const testDocRef = await addDoc(collection(db, "activeLogs"), {
      lockerId: "test-locker",
      type: "pairing",
      createdAt: new Date().toISOString(),
      detail: "Hello from connection test script",
      syncState: "synced"
    });
    console.log("✅ Successfully wrote to Firestore. Document ID:", testDocRef.id);

    const querySnapshot = await getDocs(collection(db, "activeLogs"));
    console.log(`✅ Successfully read from Firestore. Found ${querySnapshot.size} documents.`);
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`${doc.id} =>`, data.detail || data);
    });

  } catch (error) {
    console.error("❌ Connection Test Failed:", error);
  }
  
  process.exit(0);
}

testConnection();
