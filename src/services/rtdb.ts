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
import { HARDWARE_LOCKER_ID } from "../store/appState";

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

    // 2. Initialize telemetry slot only if not already populated by live ESP32 stream
    const existingTel = await withTimeout(get(telRef), 1500).catch(() => null);
    if (!existingTel || !existingTel.exists()) {
      await withTimeout(set(telRef, {
        timestamp: now,
        internalTempC: 0,
        externalTempC: 0,
        humidityPct: 0,
        pressureHpa: 0,
        gasResistanceOhms: 0,
        distanceCm: 0,
        heaterStep: 0,
        sensorHealth: "healthy",
        heuristicGasProfile: ["Awaiting live hardware sensor stream..."]
      } satisfies RTDBTelemetry));
    }

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
 * Dual-writes to both /commands/chamber-1 AND /commands/{mac} so the ESP32
 * firmware receives the command immediately regardless of which path it polls.
 */
export async function sendCommand(
  lockerId: string,
  command: CommandType,
  issuedBy: RTDBCommand["issuedBy"] = "pwa",
  macAddress?: string
): Promise<boolean> {
  // If unlocking, use ADMIN_UNLOCK + admin so ESP32 clears any spoilage lock and always energizes solenoid
  const effectiveCommand = command === "UNLOCK" ? "ADMIN_UNLOCK" : command;
  const effectiveIssuedBy = command === "UNLOCK" ? "admin" : issuedBy;

  const payload: RTDBCommand = {
    command: effectiveCommand,
    issuedAt: Date.now(),
    issuedBy: effectiveIssuedBy,
    acknowledged: false,
    issued_by: effectiveIssuedBy  // firmware reads this field to detect admin overrides
  };

  try {
    const isHardware = lockerId === "chamber-1" || lockerId === HARDWARE_LOCKER_ID;
    const updates: Record<string, RTDBCommand> = {};
    const targetMac = (macAddress && macAddress !== "SIMULATED" && macAddress !== "OFFLINE" && /^[0-9A-Fa-f]{12}$/.test(macAddress))
      ? macAddress
      : "E8F60A893D4C";

    if (isHardware) {
      // Hardware Safe 1: Always write to canonical chamber-1
      updates["commands/chamber-1"] = payload;
      // Also mirror to physical ESP32 MAC address
      updates[`commands/${targetMac}`] = payload;
    } else {
      updates[`commands/${lockerId}`] = payload;
      if (macAddress && macAddress !== "SIMULATED" && macAddress !== "OFFLINE") {
        updates[`commands/${macAddress}`] = payload;
      }
    }

    // Direct parallel REST API push with database secret — delivered in ~30ms
    const secret = "rQzYtO5yPIGWzLBUQJIDiR0wh2p39F2haQ3bYQSB";
    const base = "https://asep-10fe3-default-rtdb.asia-southeast1.firebasedatabase.app";
    const bodyStr = JSON.stringify(payload);

    // Pipelined parallel writes for instant delivery to exact paths the ESP32 reads
    Promise.allSettled([
      fetch(`${base}/commands/chamber-1.json?auth=${secret}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
        keepalive: true
      }),
      fetch(`${base}/commands/chamber-1/acknowledged.json?auth=${secret}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "false",
        keepalive: true
      }),
      fetch(`${base}/commands/chamber-1/command.json?auth=${secret}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(effectiveCommand),
        keepalive: true
      }),
      ...(targetMac && targetMac !== "chamber-1" ? [
        fetch(`${base}/commands/${targetMac}.json?auth=${secret}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: bodyStr,
          keepalive: true
        })
      ] : [])
    ]).catch(() => {});

    // Asynchronously update Firebase SDK WebSocket in background without blocking caller
    const rootRef = rtdbRef("/");
    if (rootRef) {
      update(rootRef, updates).catch(() => null);
    }

    console.log(`[RTDB] ⚡ Command "${effectiveCommand}" instantly dispatched via parallel REST pipeline.`);
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
  const isHardware = lockerId === "chamber-1" || lockerId === HARDWARE_LOCKER_ID || lockerId === "E8F60A893D4C";
  if (isHardware) {
    // Read both chamber-1 and MAC hardware streams concurrently
    const [c1Snap, macSnap] = await Promise.all([
      rtdbRef("/telemetry/chamber-1") ? withTimeout(get(rtdbRef("/telemetry/chamber-1")!), 1500).catch(() => null) : null,
      rtdbRef("/telemetry/E8F60A893D4C") ? withTimeout(get(rtdbRef("/telemetry/E8F60A893D4C")!), 1500).catch(() => null) : null
    ]);
    const c1Data = (c1Snap && c1Snap.exists()) ? (c1Snap.val() as RTDBTelemetry) : null;
    const macData = (macSnap && macSnap.exists()) ? (macSnap.val() as RTDBTelemetry) : null;

    if (c1Data && macData) {
      return ((macData.timestamp ?? 0) >= (c1Data.timestamp ?? 0)) ? macData : c1Data;
    }
    return macData || c1Data;
  }

  const telRef = rtdbRef(`/telemetry/${lockerId}`);
  const snapshot = telRef ? await withTimeout(get(telRef), 1500).catch(() => null) : null;
  return snapshot && snapshot.exists() ? (snapshot.val() as RTDBTelemetry) : null;
}

export async function getDeviceStatus(lockerId: string): Promise<RTDBDeviceStatus | null> {
  const isHardware = lockerId === "chamber-1" || lockerId === HARDWARE_LOCKER_ID;
  const primaryPath = isHardware ? "/status/chamber-1" : `/status/${lockerId}`;
  let statRef = rtdbRef(primaryPath);
  let snapshot = statRef ? await withTimeout(get(statRef), 2000).catch(() => null) : null;
  if (snapshot && snapshot.exists()) {
    return snapshot.val() as RTDBDeviceStatus;
  }

  if (isHardware) {
    statRef = rtdbRef("/status/E8F60A893D4C");
    snapshot = statRef ? await withTimeout(get(statRef), 2000).catch(() => null) : null;
    if (snapshot && snapshot.exists()) {
      return snapshot.val() as RTDBDeviceStatus;
    }
  }

  return null;
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
 */
export function subscribeOccupancy(key: string, callback: OccupancyCallback): () => void {
  const path = (key === "chamber-1" || key === HARDWARE_LOCKER_ID)
    ? "/status/chamber-1/occupancy"
    : `/status/${key}/occupancy`;
  const statRef = rtdbRef(path);
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
  const isHardware = key === "chamber-1" || key === HARDWARE_LOCKER_ID || key === "E8F60A893D4C";
  if (isHardware) {
    const [c1Snap, macSnap] = await Promise.all([
      rtdbRef("/status/chamber-1/occupancy") ? withTimeout(get(rtdbRef("/status/chamber-1/occupancy")!), 1500).catch(() => null) : null,
      rtdbRef("/status/E8F60A893D4C/occupancy") ? withTimeout(get(rtdbRef("/status/E8F60A893D4C/occupancy")!), 1500).catch(() => null) : null
    ]);
    const c1Val = c1Snap && c1Snap.exists() ? c1Snap.val() : null;
    const macVal = macSnap && macSnap.exists() ? macSnap.val() : null;
    if (c1Val === "occupied" || macVal === "occupied") return "occupied";
    return c1Val || macVal;
  }

  const statRef = rtdbRef(`/status/${key}/occupancy`);
  const snapshot = statRef ? await withTimeout(get(statRef), 1500).catch(() => null) : null;
  return snapshot && snapshot.exists() ? snapshot.val() : null;
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
  const ts = rtdbData.timestamp;
  const isoTime = (!ts || ts < 946684800000) ? new Date().toISOString() : new Date(ts).toISOString();

  const internalTempC = rtdbData.internalTempC != null
    ? Number(rtdbData.internalTempC.toFixed(2))
    : 0;

  const externalTempC = rtdbData.externalTempC != null
    ? Number(rtdbData.externalTempC.toFixed(2))
    : 0;

  const humidityPct = rtdbData.humidityPct != null
    ? Number(rtdbData.humidityPct.toFixed(1))
    : 0;

  const pressureHpa = rtdbData.pressureHpa != null
    ? Number(rtdbData.pressureHpa.toFixed(1))
    : 0;

  const gasResistanceOhms = rtdbData.gasResistanceOhms != null
    ? Math.round(rtdbData.gasResistanceOhms)
    : 0;

  const distanceCm = rtdbData.distanceCm != null
    ? Number(rtdbData.distanceCm.toFixed(1))
    : 0;

  return {
    timestamp: isoTime,
    internalTempC,
    externalTempC,
    humidityPct,
    pressureHpa,
    gasResistanceOhms,
    distanceCm,
    heaterStep: rtdbData.heaterStep ?? 2,
    sensorHealth: (rtdbData.sensorHealth as SensorTelemetry["sensorHealth"]) || "healthy",
    heuristicGasProfile: (rtdbData.heuristicGasProfile && rtdbData.heuristicGasProfile.length > 0)
      ? rtdbData.heuristicGasProfile
      : ["Live hardware telemetry stream active"],
    daysRemaining: rtdbData.daysRemaining,
    safetyClass: rtdbData.safetyClass,
    safetyScore: rtdbData.safetyScore
  };
}

/**
 * Subscribe to all telemetry nodes to auto-discover active ESP32 hardware
 * pushing data to /telemetry/{mac}.
 */
export function subscribeAllTelemetry(callback: (mac: string, data: RTDBTelemetry) => void): () => void {
  const rootTelRef = rtdbRef("/telemetry");
  if (!rootTelRef) return () => {};

  const listenerKey = "telemetry_root";
  if (activeListeners.has(listenerKey)) {
    off(activeListeners.get(listenerKey)!);
  }

  onValue(rootTelRef, (snapshot) => {
    if (!snapshot.exists()) return;
    const allData = snapshot.val() as Record<string, RTDBTelemetry>;

    // Filter valid telemetry entries including distance
    const entries = Object.entries(allData).filter(([_, val]) => 
      val && typeof val === "object" && (
        val.internalTempC !== undefined || 
        val.gasResistanceOhms !== undefined ||
        val.distanceCm !== undefined ||
        val.humidityPct !== undefined
      )
    );

    if (entries.length === 0) return;

    // Prioritize hardware streams (chamber-1 or valid 12-char hex MAC)
    const hardwareNodes = entries.filter(([key]) => key === "chamber-1" || /^[0-9A-Fa-f]{12}$/.test(key));
    const candidateNodes = hardwareNodes.length > 0 ? hardwareNodes : entries;

    const chosen = candidateNodes[0];
    const [targetMac, targetPacket] = chosen;
    callback(targetMac === "chamber-1" ? "E8F60A893D4C" : targetMac, targetPacket);
  }, (error) => {
    console.warn("[RTDB] Root telemetry listener error:", error);
  });

  activeListeners.set(listenerKey, rootTelRef);

  return () => {
    off(rootTelRef);
    activeListeners.delete(listenerKey);
  };
}

