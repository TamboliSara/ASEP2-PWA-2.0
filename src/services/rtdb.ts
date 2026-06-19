/**
 * rtdb.ts — Real-time Database Service (IoT Layer)
 * 
 * This service handles all Firebase Realtime Database operations.
 * Split-database architecture:
 *   - RTDB  = high-frequency IoT data (telemetry, commands, device status)
 *   - Firestore = persistent app data (donations, events, alerts, predictions)
 * 
 * Data paths:
 *   telemetry/{lockerId}  → ESP32 pushes sensor readings
 *   commands/{lockerId}   → PWA/Cloud Functions write hardware commands
 *   status/{lockerId}     → ESP32 writes current door/lock/occupancy state
 *   devices/{lockerId}    → Device registration & metadata
 */

import { onValue, set, update, get, off, type DatabaseReference } from "firebase/database";
import { telemetryRef, commandRef, statusRef, deviceRegistrationRef, rtdbRef } from "./firebase";
import type { SensorTelemetry } from "../types/domain";

// ── Types for RTDB Documents ─────────────────────────────────────

export interface RTDBTelemetry {
  timestamp: number;
  internalTempC: number;
  externalTempC: number;
  humidityPct: number;
  pressureHpa: number;
  gasResistanceOhms: number;
  distanceCm?: number;        // HC-SR04 reading sent by firmware
  heaterStep: number;
  sensorHealth: string;
  heuristicGasProfile: string[];
  daysRemaining?: number;
  safetyClass?: number;
  safetyScore?: number;
}

export type CommandType = "LOCK" | "UNLOCK" | "ADMIN_UNLOCK" | "SANITIZE" | "RESET" | "PING";

export interface RTDBCommand {
  command: CommandType;
  issuedAt: number;
  issuedBy: "pwa" | "cloud_function" | "admin";
  acknowledged: boolean;
  acknowledgedAt?: number;
  issued_by?: string; // Also written as issued_by for firmware compatibility
}

export interface RTDBDeviceStatus {
  door_state: "open" | "closed" | "unknown";
  lock_state: "locked" | "unlocked" | "locking" | "unlocking";
  occupancy: "empty" | "occupied" | "processing" | "spoiled";
  last_heartbeat: number;
  firmware_version?: string;
  wifi_rssi?: number;
  food_type?: string;
}

export interface RTDBDeviceRegistration {
  lockerId: string;
  mac_address: string;
  deviceName: string;
  registeredAt: number;
  lastSeenAt: number;
  firmwareVersion: string;
  bleServiceUuid: string;
  isOnline: boolean;
}

// ── Callback types for subscriptions ──────────────────────────────

type TelemetryCallback = (data: RTDBTelemetry | null) => void;
type StatusCallback = (data: RTDBDeviceStatus | null) => void;
type CommandCallback = (data: RTDBCommand | null) => void;

// ── Active listener tracking ──────────────────────────────────────

const activeListeners = new Map<string, DatabaseReference>();

// ── Timeout Helper ──────────────────────────────────────────────────
const withTimeout = <T>(promise: Promise<T>, ms: number = 3000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
  ]);
};

// ── Device Registration ───────────────────────────────────────────

/**
 * Register a device (locker) in RTDB. Called when the Connect button
 * pairs the hardware. Creates the initial telemetry, status, and
 * command slots for this device.
 */
export async function registerDevice(lockerId: string, deviceName: string, macAddress?: string): Promise<boolean> {
  const deviceRef = deviceRegistrationRef(lockerId);
  const telRef = telemetryRef(lockerId);
  const statRef = statusRef(lockerId);
  const cmdRef = commandRef(lockerId);

  if (!deviceRef || !telRef || !statRef || !cmdRef) {
    console.warn("[RTDB] No RTDB connection — skipping device registration.");
    return false;
  }

  const now = Date.now();

  try {
    // 1. Register the device
    await withTimeout(set(deviceRef, {
      lockerId,
      mac_address: macAddress || `MAC_${lockerId}`,
      deviceName,
      registeredAt: now,
      lastSeenAt: now,
      firmwareVersion: "1.0.0",
      bleServiceUuid: import.meta.env.VITE_BLE_SERVICE_UUID || "4fafc201-1fb5-459e-8fcc-c5c9c331914b",
      isOnline: true
    } satisfies RTDBDeviceRegistration));

    // 2. Initialize telemetry slot
    await withTimeout(set(telRef, {
      timestamp: now,
      internalTempC: 0,
      externalTempC: 0,
      humidityPct: 0,
      pressureHpa: 0,
      gasResistanceOhms: 0,
      heaterStep: 0,
      sensorHealth: "healthy",
      heuristicGasProfile: ["Awaiting first reading"]
    } satisfies RTDBTelemetry));

    // 3. Initialize status slot
    await withTimeout(set(statRef, {
      door_state: "closed",
      lock_state: "locked",
      occupancy: "empty",
      last_heartbeat: now
    } satisfies RTDBDeviceStatus));

    // 4. Initialize command slot (no pending command)
    await withTimeout(set(cmdRef, {
      command: "PING",
      issuedAt: now,
      issuedBy: "pwa",
      acknowledged: true,
      acknowledgedAt: now
    } satisfies RTDBCommand));

    console.log(`[RTDB] ✅ Device "${lockerId}" registered successfully.`);
    return true;
  } catch (error) {
    console.error(`[RTDB] ❌ Device registration failed for "${lockerId}":`, error);
    return false;
  }
}

// ── Send Commands ──────────────────────────────────────────────────

/**
 * Write a command to RTDB for the ESP32 to pick up.
 * The ESP32 listens on `commands/{lockerId}` and acts on the command.
 */
/**
 * Send a command to a locker via Firebase RTDB.
 * If macAddress is provided, also writes to /commands/{mac} so the ESP32
 * firmware (which listens on its MAC address path) receives the command.
 */
export async function sendCommand(
  lockerId: string,
  command: CommandType,
  issuedBy: RTDBCommand["issuedBy"] = "pwa",
  macAddress?: string
): Promise<boolean> {
  const cmdRef = commandRef(lockerId);
  if (!cmdRef) {
    console.warn("[RTDB] No RTDB connection — command not sent.");
    return false;
  }

  const payload: RTDBCommand = {
    command,
    issuedAt: Date.now(),
    issuedBy,
    acknowledged: false,
    issued_by: issuedBy  // firmware reads this field to detect admin overrides
  };

  try {
    // Write to the chamber-based path (PWA uses this)
    await withTimeout(set(cmdRef, payload));
    console.log(`[RTDB] 📡 Command "${command}" sent to ${lockerId}`);

    // Also write to the MAC-based path so ESP32 firmware receives it
    if (macAddress && macAddress !== "SIMULATED" && macAddress !== "OFFLINE") {
      const macCmdRef = rtdbRef(`/commands/${macAddress}`);
      if (macCmdRef) {
        await withTimeout(set(macCmdRef, payload));
        console.log(`[RTDB] 📡 Command "${command}" mirrored to MAC path /commands/${macAddress}`);
      }
    }

    return true;
  } catch (error) {
    console.error(`[RTDB] ❌ Failed to send command "${command}" to ${lockerId}:`, error);
    return false;
  }
}

/**
 * Convenience wrappers for common commands.
 * Pass macAddress as second arg when sending to hardware-backed locker.
 */
export const unlockLocker      = (lockerId: string, mac?: string) => sendCommand(lockerId, "UNLOCK",       "pwa",   mac);
export const adminUnlockLocker = (lockerId: string, mac?: string) => sendCommand(lockerId, "ADMIN_UNLOCK",  "admin",  mac);
export const lockLocker        = (lockerId: string, mac?: string) => sendCommand(lockerId, "LOCK",         "pwa",   mac);
export const spoilageLockLocker= (lockerId: string, mac?: string) => sendCommand(lockerId, "LOCK",         "admin",  mac);
export const sanitizeLocker    = (lockerId: string, mac?: string) => sendCommand(lockerId, "SANITIZE",     "pwa",   mac);
export const pingDevice        = (lockerId: string, mac?: string) => sendCommand(lockerId, "PING",         "pwa",   mac);

// ── Update Status ──────────────────────────────────────────────────

export async function updateDeviceStatus(lockerId: string, partial: Partial<RTDBDeviceStatus>): Promise<boolean> {
  const statRef = statusRef(lockerId);
  if (!statRef) return false;

  try {
    await withTimeout(update(statRef, { ...partial, last_heartbeat: Date.now() }));
    return true;
  } catch (error) {
    console.error(`[RTDB] ❌ Failed to update status for ${lockerId}:`, error);
    return false;
  }
}

// ── Real-Time Subscriptions ────────────────────────────────────────

/**
 * Subscribe to live telemetry updates from a specific locker.
 * The ESP32 pushes sensor data to `telemetry/{lockerId}` continuously.
 */
export function subscribeTelemetry(lockerId: string, callback: TelemetryCallback): () => void {
  const telRef = telemetryRef(lockerId);
  if (!telRef) {
    console.warn("[RTDB] No RTDB connection — telemetry subscription skipped.");
    return () => {};
  }

  const listenerKey = `telemetry_${lockerId}`;
  
  // Clean up existing listener if any
  if (activeListeners.has(listenerKey)) {
    off(activeListeners.get(listenerKey)!);
  }

  onValue(telRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() as RTDBTelemetry : null);
  }, (error) => {
    console.error(`[RTDB] Telemetry listener error for ${lockerId}:`, error);
    callback(null);
  });

  activeListeners.set(listenerKey, telRef);

  // Return unsubscribe function
  return () => {
    off(telRef);
    activeListeners.delete(listenerKey);
  };
}

/**
 * Subscribe to device status changes (door state, lock state, etc.)
 */
export function subscribeStatus(lockerId: string, callback: StatusCallback): () => void {
  const statRef = statusRef(lockerId);
  if (!statRef) {
    return () => {};
  }

  const listenerKey = `status_${lockerId}`;
  
  if (activeListeners.has(listenerKey)) {
    off(activeListeners.get(listenerKey)!);
  }

  onValue(statRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() as RTDBDeviceStatus : null);
  });

  activeListeners.set(listenerKey, statRef);

  return () => {
    off(statRef);
    activeListeners.delete(listenerKey);
  };
}

/**
 * Subscribe to command acknowledgments (ESP32 confirms it executed a command)
 */
export function subscribeCommand(lockerId: string, callback: CommandCallback): () => void {
  const cmdRef = commandRef(lockerId);
  if (!cmdRef) {
    return () => {};
  }

  const listenerKey = `command_${lockerId}`;
  
  if (activeListeners.has(listenerKey)) {
    off(activeListeners.get(listenerKey)!);
  }

  onValue(cmdRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() as RTDBCommand : null);
  });

  activeListeners.set(listenerKey, cmdRef);

  return () => {
    off(cmdRef);
    activeListeners.delete(listenerKey);
  };
}

// ── One-Shot Reads ─────────────────────────────────────────────────

export async function getDeviceTelemetry(lockerId: string): Promise<RTDBTelemetry | null> {
  const telRef = telemetryRef(lockerId);
  if (!telRef) return null;

  const snapshot = await get(telRef);
  return snapshot.exists() ? snapshot.val() as RTDBTelemetry : null;
}

export async function getDeviceStatus(lockerId: string): Promise<RTDBDeviceStatus | null> {
  const statRef = statusRef(lockerId);
  if (!statRef) return null;

  const snapshot = await get(statRef);
  return snapshot.exists() ? snapshot.val() as RTDBDeviceStatus : null;
}

export async function isDeviceRegistered(lockerId: string): Promise<boolean> {
  const deviceRef = deviceRegistrationRef(lockerId);
  if (!deviceRef) return false;

  const snapshot = await get(deviceRef);
  return snapshot.exists();
}

// ── Occupancy Subscription (hardware locker specific) ───────────────

type OccupancyCallback = (occupancy: RTDBDeviceStatus["occupancy"] | null) => void;

/**
 * Subscribe to occupancy changes for a hardware locker.
 * The ESP32 writes "occupied"|"empty"|"processing" after each unlock cycle.
 * The key can be either a lockerId OR a raw MAC address.
 */
export function subscribeOccupancy(key: string, callback: OccupancyCallback): () => void {
  const resolvedKey = key === "chamber-1" ? (localStorage.getItem("ecolocker-hardware-mac") || "chamber-1") : key;
  const statRef = rtdbRef(`/status/${resolvedKey}/occupancy`);
  if (!statRef) return () => {};

  const listenerKey = `occupancy_${key}`;
  if (activeListeners.has(listenerKey)) {
    off(activeListeners.get(listenerKey)!);
  }

  onValue(statRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() as RTDBDeviceStatus["occupancy"] : null);
  });

  activeListeners.set(listenerKey, statRef);
  return () => {
    off(statRef);
    activeListeners.delete(listenerKey);
  };
}

/**
 * One-shot read of the occupancy field for a locker.
 * Used after an unlock cycle to determine if food was deposited.
 */
export async function getOccupancy(key: string): Promise<"empty" | "occupied" | "processing" | null> {
  const resolvedKey = key === "chamber-1" ? (localStorage.getItem("ecolocker-hardware-mac") || "chamber-1") : key;
  const statRef = rtdbRef(`/status/${resolvedKey}/occupancy`);
  if (!statRef) return null;
  const snapshot = await get(statRef);
  return snapshot.exists() ? snapshot.val() : null;
}

/**
 * Read the stored MAC address for a locker from RTDB device registration.
 */
export async function getStoredMac(lockerId: string): Promise<string | null> {
  const devRef = deviceRegistrationRef(lockerId);
  if (!devRef) return null;
  const snapshot = await get(devRef);
  if (!snapshot.exists()) return null;
  return snapshot.val()?.mac_address ?? null;
}

/**
 * Write the active food type for a locker to RTDB status.
 */
export async function setDeviceFoodType(lockerId: string, foodType: string, macAddress?: string): Promise<boolean> {
  const statRef = statusRef(lockerId);
  if (!statRef) return false;
  try {
    await withTimeout(update(statRef, { food_type: foodType }));
    if (macAddress && macAddress !== "SIMULATED" && macAddress !== "OFFLINE") {
      const macStatRef = rtdbRef(`/status/${macAddress}`);
      if (macStatRef) {
        await withTimeout(update(macStatRef, { food_type: foodType }));
      }
    }
    return true;
  } catch (error) {
    console.error(`[RTDB] ❌ Failed to set food type for ${lockerId}:`, error);
    return false;
  }
}

// ── Cleanup ────────────────────────────────────────────────────────

/**
 * Unsubscribe all active listeners. Call this on app unmount.
 */
export function unsubscribeAll(): void {
  activeListeners.forEach((ref, _key) => {
    off(ref);
  });
  activeListeners.clear();
  console.log("[RTDB] All listeners unsubscribed.");
}

// ── Convert RTDB telemetry to domain SensorTelemetry ──────────────

export function rtdbToDomainTelemetry(rtdbData: RTDBTelemetry): SensorTelemetry {
  return {
    timestamp: new Date(rtdbData.timestamp).toISOString(),
    internalTempC: rtdbData.internalTempC,
    externalTempC: rtdbData.externalTempC,
    humidityPct: rtdbData.humidityPct,
    pressureHpa: rtdbData.pressureHpa,
    gasResistanceOhms: rtdbData.gasResistanceOhms,
    distanceCm: rtdbData.distanceCm,
    heaterStep: rtdbData.heaterStep,
    sensorHealth: rtdbData.sensorHealth as SensorTelemetry["sensorHealth"],
    heuristicGasProfile: rtdbData.heuristicGasProfile,
    daysRemaining: rtdbData.daysRemaining,
    safetyClass: rtdbData.safetyClass,
    safetyScore: rtdbData.safetyScore
  };
}
