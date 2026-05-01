import { openDB } from "idb";
import type { AlertRecord, DonationRecord, LockerEvent, LockerState, PredictionSnapshot, SensorSnapshot, SyncRecord } from "../types/domain";

const DB_NAME = "ecolocker";
const DB_VERSION = 1;

const databasePromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("donations")) {
      db.createObjectStore("donations", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("events")) {
      db.createObjectStore("events", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("alerts")) {
      db.createObjectStore("alerts", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("snapshots")) {
      db.createObjectStore("snapshots", { keyPath: "lockerId" });
    }
    if (!db.objectStoreNames.contains("syncQueue")) {
      db.createObjectStore("syncQueue", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("sensorSnapshots")) {
      db.createObjectStore("sensorSnapshots", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("predictions")) {
      db.createObjectStore("predictions", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("deviceMeta")) {
      db.createObjectStore("deviceMeta", { keyPath: "id" });
    }
  }
});

export async function cacheDonation(record: DonationRecord) {
  const db = await databasePromise;
  await db.put("donations", record);
}

export async function cacheEvent(record: LockerEvent) {
  const db = await databasePromise;
  await db.put("events", record);
}

export async function cacheAlert(record: AlertRecord) {
  const db = await databasePromise;
  await db.put("alerts", record);
}

export async function cacheLockerSnapshot(snapshot: LockerState) {
  const db = await databasePromise;
  await db.put("snapshots", snapshot);
}

export async function enqueueSync(record: SyncRecord) {
  const db = await databasePromise;
  await db.put("syncQueue", record);
}

export async function cacheSensorSnapshot(record: SensorSnapshot) {
  const db = await databasePromise;
  await db.put("sensorSnapshots", record);
}

export async function cachePredictionSnapshot(record: PredictionSnapshot) {
  const db = await databasePromise;
  await db.put("predictions", record);
}

export async function getQueuedSyncRecords(): Promise<SyncRecord[]> {
  const db = await databasePromise;
  return db.getAll("syncQueue");
}

export async function clearAllData() {
  const db = await databasePromise;
  const stores = ["donations", "events", "alerts", "snapshots", "syncQueue", "sensorSnapshots", "predictions", "deviceMeta"];
  for (const store of stores) {
    if (db.objectStoreNames.contains(store)) {
      await db.clear(store as any);
    }
  }
}
