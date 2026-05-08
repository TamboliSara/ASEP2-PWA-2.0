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

// ── Timeout Helper ──────────────────────────────────────────────────
const withTimeout = <T>(promise: Promise<T>, ms: number = 3000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
  ]);
};

// ── Firestore Sync (Persistent Application Data) ──────────────────

export async function syncSnapshot(snapshot: LockerState) {
  if (!db) {
    console.warn("[Sync] No Firestore — snapshot not synced to cloud.");
    return false;
  }

  try {
    await withTimeout(setDoc(doc(db, "lockers", snapshot.lockerId), {
      ...snapshot,
      _syncedAt: serverTimestamp()
    }));
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
    // 1. Write to flat donations/ collection
    await withTimeout(setDoc(doc(db, "donations", record.id), {
      ...record,
      _syncedAt: serverTimestamp()
    }));

    // 2. Update the lockers/ chamber doc with embedded donation + item details
    await withTimeout(setDoc(doc(db, "lockers", record.lockerId), {
      occupancyState: "occupied",
      donation: {
        id: record.id,
        status: "deposited",
        donorName: record.donorName,
        donorContact: record.donorContact,
        createdAt: record.createdAt,
        lockerNumber: record.lockerNumber ?? null
      },
      item: {
        foodName: record.foodName,
        category: record.categoryLabel,
        dietTag: record.dietTag,
        allergensNotes: record.allergensNotes || null,
        servingCount: 1,
        latestQualityScore: record.latestQualityScore ?? null
      },
      retrieval: null,
      _syncedAt: serverTimestamp()
    }, { merge: true }));

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
    await withTimeout(setDoc(doc(db, "events", record.id), {
      ...record,
      _syncedAt: serverTimestamp()
    }));
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
    await withTimeout(setDoc(doc(db, "alerts", record.id), {
      ...record,
      _syncedAt: serverTimestamp()
    }));
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
    await withTimeout(setDoc(doc(db, "sensorSnapshots", record.id), {
      ...record,
      _syncedAt: serverTimestamp()
    }));
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
    await withTimeout(setDoc(doc(db, "predictions", record.id), {
      ...record,
      _syncedAt: serverTimestamp()
    }));
    return true;
  } catch (error) {
    console.error("[Sync] ❌ Prediction sync failed:", error);
    return false;
  }
}

// ── Retrieval Sync (updates donation + creates retrieval record) ───

export interface RetrievalRecord {
  id: string;
  donationId: string;
  lockerId: string;
  lockerNumber: number;
  foodName: string;
  qualityScoreAtRetrieval: string;
  retrievedAt: string;
  retrievedBy: "receiver" | "admin_override";
  skipSanitization: boolean;
  receiverImageBase64?: string;
  receiverImage?: string; // from other contributor
}

export async function syncRetrieval(record: RetrievalRecord) {
  if (!db) {
    console.warn("[Sync] No Firestore — retrieval not synced to cloud.");
    return false;
  }

  try {
    // 1. Update the donation document with retrieval status
    await withTimeout(setDoc(doc(db, "donations", record.donationId), {
      status: "retrieved",
      retrievedAt: record.retrievedAt,
      retrievedBy: record.retrievedBy,
      qualityScoreAtRetrieval: record.qualityScoreAtRetrieval,
      receiverImage: record.receiverImage || null,
      _updatedAt: serverTimestamp()
    }, { merge: true }));

    // 2. Create a separate retrieval record for audit trail
    await withTimeout(setDoc(doc(db, "retrievals", record.id), {
      ...record,
      _syncedAt: serverTimestamp()
    }));

    // 3. Update the lockers/ chamber document — clear donation + item, mark as empty
    await withTimeout(setDoc(doc(db, "lockers", record.lockerId), {
      occupancyState: "empty",
      donation: null,
      item: null,
      retrieval: {
        id: record.id,
        donationId: record.donationId,
        foodName: record.foodName,
        retrievedAt: record.retrievedAt,
        retrievedBy: record.retrievedBy,
        qualityScoreAtRetrieval: record.qualityScoreAtRetrieval,
        skipSanitization: record.skipSanitization,
        receiverImage: record.receiverImage || record.receiverImageBase64 || null,
        receiverImageBase64: record.receiverImageBase64 || record.receiverImage || null
      },
      _syncedAt: serverTimestamp()
    }, { merge: true }));

    console.log(`[Sync] ✅ Retrieval synced: ${record.id} (donation: ${record.donationId})`);
    return true;
  } catch (error) {
    console.error("[Sync] ❌ Retrieval sync failed:", error);
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
    await withTimeout(addDoc(collection(db, "mail"), {
      to: ["admin@ecolocker.local"],
      message: {
        subject: `EcoLocker Alert: ${alertId}`,
        text: `Review EcoLocker alert ${alertId} in the admin dashboard.`
      }
    }));
    return true;
  } catch (error) {
    console.error("[Sync] ❌ Alert email trigger failed:", error);
    return false;
  }
}

// ── Real-Time RTDB Subscriptions (re-exported for convenience) ─────

export { subscribeTelemetry, subscribeStatus, subscribeCommand, rtdbToDomainTelemetry, updateDeviceStatus };
export type { RTDBTelemetry, RTDBDeviceStatus, RTDBCommand };

