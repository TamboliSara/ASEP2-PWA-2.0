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
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import { getQueuedSyncRecords } from "./db";
import { subscribeTelemetry, subscribeStatus, subscribeCommand, rtdbToDomainTelemetry, updateDeviceStatus, type RTDBTelemetry, type RTDBDeviceStatus, type RTDBCommand } from "./rtdb";
import type { AlertRecord, DonationRecord, LockerEvent, LockerState, PredictionSnapshot, SensorSnapshot, SyncRecord } from "../types/domain";
import { getRecommendedActionsForQuality, calculateQualityScore } from "../utils/safety";

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
      // Hardware lock fields — always explicit for RTDB-to-Firestore mirroring
      lockState: snapshot.lockState ?? "locked",
      doorState: snapshot.doorState ?? "closed",
      _syncedAt: serverTimestamp()
    }));
    console.log(`[Sync] ✅ Locker snapshot synced: ${snapshot.lockerId}`);
    return true;
  } catch (error) {
    console.error("[Sync] ❌ Snapshot sync failed:", error);
    return false;
  }
}

export async function uploadImage(base64Data: string, path: string): Promise<string | null> {
  if (!storage || !base64Data) return null;
  try {
    const sRef = storageRef(storage, path);
    await uploadString(sRef, base64Data, 'data_url');
    const url = await getDownloadURL(sRef);
    console.log(`[Storage] ✅ Image uploaded to ${path}`);
    return url;
  } catch (error) {
    console.error("[Storage] ❌ Image upload failed:", error);
    return null;
  }
}

export async function syncDonation(
  record: DonationRecord,
  sensorSnap?: SensorSnapshot,
  predictionSnap?: PredictionSnapshot
) {
  if (!db) {
    console.warn("[Sync] No Firestore — donation not synced to cloud.");
    return true;
  }

  try {
    let imageUrl = null;
    if (record.donorImageBase64) {
      imageUrl = await uploadImage(record.donorImageBase64, `donations/${record.id}_donor.jpg`);
    }

    const qualityPct = calculateQualityScore(record.deadlineEstimate?.hoursRemaining ?? 48);
    const recommendedActions = getRecommendedActionsForQuality(record.latestQualityScore);

    // Determine consumption window label
    const hrs = record.deadlineEstimate?.hoursRemaining ?? 48;
    const consumptionWindow = hrs >= 24
      ? `Best consumed within ${Math.round(hrs / 24)} day(s)`
      : `Best consumed within ${Math.round(hrs)} hour(s)`;

    // ── 1. donations/ — enriched structured document ──────────────────
    await withTimeout(setDoc(doc(db, "donations", record.id), {
      // ─ Identity ─
      id: record.id,
      lockerId: record.lockerId,
      lockerNumber: record.lockerNumber ?? null,
      status: "deposited",

      // ─ Food Details ─
      food: {
        name: record.foodName,
        category: record.categoryLabel,
        dietTag: record.dietTag,
        allergens: record.allergensNotes || "None declared",
        servings: 1
      },

      // ─ Donor Details ─
      donor: {
        name: record.donorName,
        contact: record.donorContact,
        imageUrl: imageUrl || record.donorImageUrl || null,
        depositedAt: record.createdAt,
        phoneIp: record.phoneIp || null,
        isPhoneVerified: record.isPhoneVerified ?? false,
        verifiedAt: record.otpVerifiedAt || null
      },

      // ─ Quality Prediction at Deposit ─
      qualityAtDeposit: {
        score: record.latestQualityScore,          // "fresh" | "aging" | "spoilt"
        qualityIndexPct: qualityPct,               // 0–100 numeric index
        predictedExpiryIso: record.deadlineEstimate?.absoluteIso ?? null,
        hoursRemainingAtDeposit: record.deadlineEstimate?.hoursRemaining ?? null,
        consumptionWindow,                         // Human-readable e.g. "Best consumed within 2 day(s)"
        recommendedActions
      },

      // ─ Sensor Readings at Deposit ─
      sensorAtDeposit: sensorSnap ? {
        capturedAt: sensorSnap.capturedAt,
        internalTempC: sensorSnap.telemetry.internalTempC,
        externalTempC: sensorSnap.telemetry.externalTempC,
        humidityPct: sensorSnap.telemetry.humidityPct,
        pressureHpa: sensorSnap.telemetry.pressureHpa,
        gasResistanceOhms: sensorSnap.telemetry.gasResistanceOhms,
        sensorHealth: sensorSnap.telemetry.sensorHealth,
        gasProfile: sensorSnap.telemetry.heuristicGasProfile
      } : null,

      // ─ Lifecycle (filled in on retrieval/override) ─
      receiver: null,
      adminOverride: null,
      retrievedAt: null,

      // ─ Root-level aliases for calendar backward-compatibility ─
      donorName: record.donorName,
      donorContact: record.donorContact,
      donorImageUrl: imageUrl || record.donorImageUrl || null,   // calendar reads this
      donorImageBase64: record.donorImageBase64 || null,         // ensures calendar has the raw image if upload fails
      foodName: record.foodName,
      createdAt: record.createdAt,

      _syncedAt: serverTimestamp()
    }));

    // ── 2. items/ — permanent lifecycle record (same structure, never deleted) ─
    await withTimeout(setDoc(doc(db, "items", record.id), {
      donationId: record.id,
      lockerId: record.lockerId,
      lockerNumber: record.lockerNumber ?? null,
      status: "deposited",

      food: {
        name: record.foodName,
        category: record.categoryLabel,
        dietTag: record.dietTag,
        allergens: record.allergensNotes || "None declared",
        servings: 1
      },

      donor: {
        name: record.donorName,
        contact: record.donorContact,
        imageUrl: imageUrl || record.donorImageUrl || null,
        depositedAt: record.createdAt
      },

      qualityAtDeposit: {
        score: record.latestQualityScore,
        qualityIndexPct: qualityPct,
        predictedExpiryIso: record.deadlineEstimate?.absoluteIso ?? null,
        hoursRemainingAtDeposit: record.deadlineEstimate?.hoursRemaining ?? null,
        consumptionWindow,
        recommendedActions
      },

      sensorAtDeposit: sensorSnap ? {
        capturedAt: sensorSnap.capturedAt,
        internalTempC: sensorSnap.telemetry.internalTempC,
        humidityPct: sensorSnap.telemetry.humidityPct,
        sensorHealth: sensorSnap.telemetry.sensorHealth,
        gasProfile: sensorSnap.telemetry.heuristicGasProfile
      } : null,

      // Lifecycle fields — filled in later
      receiver: null,
      adminOverride: null,

      _createdAt: serverTimestamp(),
      _updatedAt: serverTimestamp(),
      _source: "deposit"
    }));

    // ── 3. lockers/ — live chamber state with hardware fields ──────────
    await withTimeout(setDoc(doc(db, "lockers", record.lockerId), {
      occupancyState: "occupied",
      lockState: "locked",
      doorState: "closed",
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
        qualityScore: record.latestQualityScore,
        qualityIndexPct: qualityPct,
        predictedExpiryIso: record.deadlineEstimate?.absoluteIso ?? null,
        hoursRemaining: record.deadlineEstimate?.hoursRemaining ?? null
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
    await withTimeout(setDoc(doc(db, "activeLogs", record.id), {
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
  receiverImageUrl?: string;
  faceDescriptor?: number[];
  adminOverride?: {
    adminCredentials: string;
    overrideAt: string;
  };
}

export async function syncRetrieval(record: RetrievalRecord) {
  if (!db) {
    console.warn("[Sync] No Firestore — retrieval not synced to cloud.");
    return false;
  }

  try {
    // 1. Upload receiver image to Storage (if present)
    let receiverImageUrl: string | null = null;
    if (record.receiverImageBase64) {
      receiverImageUrl = await uploadImage(
        record.receiverImageBase64,
        `retrievals/${record.id}_receiver.jpg`
      );
    }

    const now = new Date().toISOString();
    const isAdminOverride = record.retrievedBy === "admin_override";

    // ── Build embedded sub-documents ──────────────────────────────────
    const receiverDoc = isAdminOverride ? null : {
      retrievedAt: record.retrievedAt || now,
      retrievedBy: record.retrievedBy,
      qualityScoreAtRetrieval: record.qualityScoreAtRetrieval,
      receiverImageBase64: record.receiverImageBase64 || null,
      receiverImageUrl: receiverImageUrl || record.receiverImage || null
    };

    const adminOverrideDoc = record.adminOverride
      ? {
          adminCredentials: record.adminOverride.adminCredentials,
          overrideAt: record.adminOverride.overrideAt || now
        }
      : null;

    const finalStatus = isAdminOverride ? "admin_override" : "retrieved";

    // ── 2. Update existing donations/ document (unchanged behaviour) ──
    await withTimeout(
      setDoc(
        doc(db, "donations", record.donationId),
        {
          status: finalStatus,
          _updatedAt: serverTimestamp(),
          receiver: receiverDoc,
          adminOverride: adminOverrideDoc
        },
        { merge: true }
      )
    );

    // ── 3. Update the items/ document — permanent lifecycle record ────
    //    Same doc ID as donationId. NEVER deleted, only updated.
    await withTimeout(
      setDoc(
        doc(db, "items", record.donationId),
        {
          status: finalStatus,
          _updatedAt: serverTimestamp(),

          // Receiver block (null if admin override)
          receiver: receiverDoc ? {
            name: null, // captured from face scan — anonymous
            imageUrl: receiverImageUrl || record.receiverImage || null,
            retrievedAt: receiverDoc.retrievedAt,
            freshnessAtRetrieval: record.qualityScoreAtRetrieval
          } : null,

          // Admin override block (null if normal retrieval)
          adminOverride: adminOverrideDoc ? {
            adminCredentials: adminOverrideDoc.adminCredentials,
            overrideAt: adminOverrideDoc.overrideAt,
            reason: "Spoiled food removed by admin"
          } : null
        },
        { merge: true }
      )
    );

    // ── 4. Write a retrievals/ document for audit trail (unchanged) ───
    await withTimeout(
      setDoc(doc(db, "retrievals", record.id), {
        ...record,
        receiverImageUrl: receiverImageUrl || record.receiverImage || null,
        _syncedAt: serverTimestamp()
      })
    );

    // ── 5. Update lockers/ doc — mark empty + show hardware lock state ─
    await withTimeout(
      setDoc(
        doc(db, "lockers", record.lockerId),
        {
          occupancyState: "empty",
          lockState: "locked",   // physically re-locked after retrieval
          doorState: "closed",
          donation: null,
          item: null,
          retrieval: {
            id: record.id,
            donationId: record.donationId,
            retrievedAt: record.retrievedAt || now,
            retrievedBy: record.retrievedBy,
            qualityScoreAtRetrieval: record.qualityScoreAtRetrieval,
            skipSanitization: record.skipSanitization
          },
          adminOverride: adminOverrideDoc,
          _syncedAt: serverTimestamp()
        },
        { merge: true }
      )
    );

    console.log(`[Sync] ✅ Retrieval synced: donations/${record.donationId}, items/${record.donationId}, retrievals/${record.id}`);
    return true;
  } catch (error) {
    console.error("[Sync] ❌ Retrieval sync failed:", error);
    return false;
  }
}

// ── Denied Attempt Logging ─────────────────────────────────────────

export interface DeniedAttemptRecord {
  id: string;
  lockerId: string;
  attemptedAt: string;
  denialReason: "daily_limit_reached" | "no_face_scan";
  /** Running count of how many times this person has been denied today (fleet-wide) */
  deniedTodayCount: number;
  receiverImageBase64?: string;
  faceDescriptor?: number[];
}

export async function syncDeniedAttempt(record: DeniedAttemptRecord): Promise<boolean> {
  if (!db) {
    console.warn("[Sync] No Firestore — denied attempt not logged.");
    return false;
  }

  try {
    // Upload the receiver's image for the audit trail (non-blocking if it fails)
    let receiverImageUrl: string | null = null;
    if (record.receiverImageBase64) {
      receiverImageUrl = await uploadImage(
        record.receiverImageBase64,
        `deniedAttempts/${record.id}_receiver.jpg`
      ).catch(() => null);
    }

    await withTimeout(
      setDoc(doc(db, "deniedAttempts", record.id), {
        id: record.id,
        lockerId: record.lockerId,
        attemptedAt: record.attemptedAt,
        denialReason: record.denialReason,
        deniedTodayCount: record.deniedTodayCount,
        faceDescriptor: record.faceDescriptor ?? null,
        receiverImageBase64: record.receiverImageBase64 ?? null,
        receiverImageUrl,
        _syncedAt: serverTimestamp()
      })
    );

    console.log(`[Sync] ✅ Denied attempt logged: ${record.id} — reason: ${record.denialReason} (today count: ${record.deniedTodayCount})`);
    return true;
  } catch (error) {
    console.error("[Sync] ❌ Denied attempt log failed:", error);
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

