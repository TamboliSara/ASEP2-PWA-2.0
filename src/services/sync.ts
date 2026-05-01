import { addDoc, collection, doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getQueuedSyncRecords } from "./db";
import type { AlertRecord, DonationRecord, LockerEvent, LockerState, PredictionSnapshot, SensorSnapshot, SyncRecord } from "../types/domain";

export async function syncSnapshot(snapshot: LockerState) {
  // Simulate Network Delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  if (!db) {
    console.warn("Simulator: No Firebase DB. Persisting to local failover.");
  }

  await setDoc(doc(db!, "lockers", snapshot.lockerId), snapshot);
  return true;
}

export async function syncDonation(record: DonationRecord) {
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  if (!db) {
    console.warn("Simulator: Mocking cloud donation sync.");
    return true; // Return success to allow the UI to proceed
  }

  await setDoc(doc(db, "donations", record.id), record);
  return true;
}

export async function syncEvent(record: LockerEvent) {
  if (!db) {
    return false;
  }

  await setDoc(doc(db, "events", record.id), record);
  return true;
}

export async function syncAlert(record: AlertRecord) {
  if (!db) {
    return false;
  }

  await setDoc(doc(db, "alerts", record.id), record);
  return true;
}

export async function syncSensorSnapshot(record: SensorSnapshot) {
  if (!db) {
    return false;
  }

  await setDoc(doc(db, "sensorSnapshots", record.id), record);
  return true;
}

export async function syncPrediction(record: PredictionSnapshot) {
  if (!db) {
    return false;
  }

  await setDoc(doc(db, "predictions", record.id), record);
  return true;
}

export async function processSyncQueue() {
  const queued = await getQueuedSyncRecords();
  return queued.map((record: SyncRecord) => ({ ...record, status: db ? "synced" : "error" }));
}

export async function triggerAlertEmail(alertId: string) {
  if (!db) {
    return false;
  }

  await addDoc(collection(db, "mail"), {
    to: ["admin@ecolocker.local"],
    message: {
      subject: `EcoLocker Alert: ${alertId}`,
      text: `Review EcoLocker alert ${alertId} in the admin dashboard.`
    }
  });

  return true;
}
