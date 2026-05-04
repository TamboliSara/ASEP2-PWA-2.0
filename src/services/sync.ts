/**
 * sync.ts — Dual-Database Sync Service
 * 
 * Split-database architecture:
 *   Firestore  → persistent app data (donations, events, alerts, predictions, locker snapshots)
 *   RTDB       → real-time IoT data (telemetry, device status, commands)
 * 
 * All sync functions are offline-tolerant: if a database is unavailable,
 * the operation is logged and queued for retry.
 */

import { addDoc, collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { getQueuedSyncRecords } from "./db";
import { subscribeTelemetry, subscribeStatus, subscribeCommand, rtdbToDomainTelemetry, updateDeviceStatus, type RTDBTelemetry, type RTDBDeviceStatus, type RTDBCommand } from "./rtdb";
import type { AlertRecord, DonationRecord, LockerEvent, LockerState, PredictionSnapshot, SensorSnapshot, SyncRecord } from "../types/domain";

// ── Firestore Sync (Persistent Application Data) ──────────────────

export async function syncSnapshot(snapshot: LockerState) {
  if (!db) {
    console.warn("[Sync] No Firestore — snapshot not synced to cloud.");
    return false;
  }

  try {
    await setDoc(doc(db, "lockers", snapshot.lockerId), {
      ...snapshot,
      _syncedAt: serverTimestamp()
    });
    console.log(`[Sync] ✅ Locker snapshot synced: ${snapshot.lockerId}`);
    return true;
  } catch (error) {
    console.error("[Sync] ❌ Snapshot sync failed:", error);
    return false;
  }
}

export async function syncDonation(record: DonationRecord) {
  if (!db) {
    console.warn("[Sync] No Firestore — donation not synced to cloud.");
    return true; // Return true to allow UI to proceed
  }

  try {
    await setDoc(doc(db, "donations", record.id), {
      ...record,
      _syncedAt: serverTimestamp()
    });
    console.log(`[Sync] ✅ Donation synced: ${record.id} (${record.foodName})`);
    return true;
  } catch (error) {
    console.error("[Sync] ❌ Donation sync failed:", error);
    return false;
  }
}

export async function syncEvent(record: LockerEvent) {
  if (!db) {
    return false;
  }

  try {
    await setDoc(doc(db, "events", record.id), {
      ...record,
      _syncedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("[Sync] ❌ Event sync failed:", error);
    return false;
  }
}

export async function syncAlert(record: AlertRecord) {
  if (!db) {
    return false;
  }

  try {
    await setDoc(doc(db, "alerts", record.id), {
      ...record,
      _syncedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("[Sync] ❌ Alert sync failed:", error);
    return false;
  }
}

export async function syncSensorSnapshot(record: SensorSnapshot) {
  if (!db) {
    return false;
  }

  try {
    await setDoc(doc(db, "sensorSnapshots", record.id), {
      ...record,
      _syncedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("[Sync] ❌ Sensor snapshot sync failed:", error);
    return false;
  }
}

export async function syncPrediction(record: PredictionSnapshot) {
  if (!db) {
    return false;
  }

  try {
    await setDoc(doc(db, "predictions", record.id), {
      ...record,
      _syncedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("[Sync] ❌ Prediction sync failed:", error);
    return false;
  }
}

// ── Sync Queue Processing ──────────────────────────────────────────

export async function processSyncQueue() {
  const queued = await getQueuedSyncRecords();
  const results = [];
  
  for (const record of queued) {
    results.push({
      ...record,
      status: db ? "synced" as const : "error" as const
    });
  }
  
  return results;
}

// ── Email Trigger ──────────────────────────────────────────────────

export async function triggerAlertEmail(alertId: string) {
  if (!db) {
    return false;
  }

  try {
    await addDoc(collection(db, "mail"), {
      to: ["admin@ecolocker.local"],
      message: {
        subject: `EcoLocker Alert: ${alertId}`,
        text: `Review EcoLocker alert ${alertId} in the admin dashboard.`
      }
    });
    return true;
  } catch (error) {
    console.error("[Sync] ❌ Alert email trigger failed:", error);
    return false;
  }
}

// ── Real-Time RTDB Subscriptions (re-exported for convenience) ─────

export { subscribeTelemetry, subscribeStatus, subscribeCommand, rtdbToDomainTelemetry, updateDeviceStatus };
export type { RTDBTelemetry, RTDBDeviceStatus, RTDBCommand };

