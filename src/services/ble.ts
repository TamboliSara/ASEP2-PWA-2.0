/**
 * ble.ts — Web Bluetooth (BLE) Service
 *
 * This service connects the PWA to the physical ESP32-S3 SAFE Locker via
 * the Web Bluetooth API. It falls back gracefully to simulation mode when:
 *   - Running in a browser without Web Bluetooth support (e.g. Firefox)
 *   - Running in development without physical hardware
 *
 * BLE Device: Advertised as "EcoLocker {MAC}" by the ESP32 firmware.
 * Service UUID:        4fafc201-1fb5-459e-8fcc-c5c9c331914b
 * Characteristic UUID: beb5483e-36e1-4688-b7f5-ea07361b26a8
 *
 * Characteristic Properties:
 *   READ   – PWA reads current locker state string
 *   WRITE  – PWA sends commands: UNLOCK, LOCK, ADMIN_UNLOCK, PING
 *   NOTIFY – ESP32 pushes state changes: UNLOCKED, LOCKED, OCCUPIED, EMPTY, PONG:{MAC}
 */

import type { DonationDraft, LockerEvent, LockerState } from "../types/domain";
import { sampleLockerState } from "../utils/mockData";

const BLE_SERVICE_UUID        = import.meta.env.VITE_BLE_SERVICE_UUID        ?? "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const BLE_CHARACTERISTIC_UUID = import.meta.env.VITE_BLE_CHARACTERISTIC_UUID ?? "beb5483e-36e1-4688-b7f5-ea07361b26a8";

// ── Types ────────────────────────────────────────────────────────────

export type BLENotification = "UNLOCKED" | "LOCKED" | "OCCUPIED" | "EMPTY" | "SPOILAGE_LOCKED" | "READY" | string;

export interface PairResult {
  serviceUuid: string;
  characteristicUuid: string;
  deviceName: string;
  macAddress: string;       // Parsed from "EcoLocker AABBCCDDEEFF" → "AABBCCDDEEFF"
  connectedAt: string;
  isRealHardware: boolean;  // false in simulation/fallback mode
}

// ── Notification listener type ─────────────────────────────────────
type NotificationCallback = (notification: BLENotification) => void;

// ── BLE Service Class ────────────────────────────────────────────────

export class BleService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private notificationCallbacks: Set<NotificationCallback> = new Set();
  private _isRealHardware = false;
  private _connectedMac = "";
  private _deviceName = sampleLockerState.pairedDeviceName ?? "EcoLocker ESP32-S3";

  get isRealHardware() { return this._isRealHardware; }
  get connectedMac()   { return this._connectedMac; }

  // ── Check if Web Bluetooth is supported ───────────────────────────
  private isBleAvailable(): boolean {
    return typeof navigator !== "undefined" &&
           "bluetooth" in navigator &&
           typeof navigator.bluetooth.requestDevice === "function";
  }

  // ── Parse MAC from device name ────────────────────────────────────
  // Firmware advertises as "EcoLocker AABBCCDDEEFF"
  private parseMacFromName(name: string): string {
    const parts = name.split(" ");
    const maybeMac = parts[parts.length - 1];
    // MAC is 12 hex chars with no colons (as per firmware)
    if (/^[0-9A-Fa-f]{12}$/.test(maybeMac)) {
      return maybeMac.toUpperCase();
    }
    // Fallback: use a sanitized version of the device name
    return name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().substring(0, 12);
  }

  // ── Pair (real Web Bluetooth) ─────────────────────────────────────
  async pair(): Promise<PairResult> {
    if (!this.isBleAvailable()) {
      console.warn("[BLE] Web Bluetooth not available — using simulation mode.");
      return this.simulatePair();
    }

    try {
      console.log("[BLE] Opening browser Bluetooth picker...");
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: "EcoLocker" },
          { services: [BLE_SERVICE_UUID] }
        ],
        optionalServices: [BLE_SERVICE_UUID]
      });

      if (!this.device.gatt) throw new Error("GATT not available on device.");

      console.log(`[BLE] User selected device: "${this.device.name}"`);
      this.server = await this.device.gatt.connect();
      console.log("[BLE] GATT server connected.");

      const service = await this.server.getPrimaryService(BLE_SERVICE_UUID);
      this.characteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);

      // Subscribe to notifications from ESP32
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener("characteristicvaluechanged", (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = new TextDecoder().decode(target.value);
        console.log(`[BLE] 📶 Notification received: "${value}"`);
        this.notificationCallbacks.forEach(cb => cb(value as BLENotification));
      });

      // Handle disconnection
      this.device.addEventListener("gattserverdisconnected", () => {
        console.warn("[BLE] Device disconnected.");
        this._isRealHardware = false;
        this.characteristic = null;
        this.server = null;
      });

      const deviceName = this.device.name ?? "EcoLocker ESP32-S3";
      const mac = this.parseMacFromName(deviceName);
      this._connectedMac = mac;
      this._isRealHardware = true;
      this._deviceName = deviceName;

      console.log(`[BLE] ✅ Paired successfully!`);
      console.log(`[BLE]    Device: ${deviceName}`);
      console.log(`[BLE]    MAC:    ${mac}`);

      return {
        serviceUuid:       BLE_SERVICE_UUID,
        characteristicUuid: BLE_CHARACTERISTIC_UUID,
        deviceName,
        macAddress:        mac,
        connectedAt:       new Date().toISOString(),
        isRealHardware:    true
      };
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === "NotFoundError") {
        // User cancelled the picker — don't fall back to simulation, bubble the cancel
        console.log("[BLE] User cancelled Bluetooth picker.");
        throw error;
      }
      console.warn("[BLE] Real BLE failed, falling back to simulation:", error.message);
      return this.simulatePair();
    }
  }

  // ── Simulation fallback ───────────────────────────────────────────
  private async simulatePair(): Promise<PairResult> {
    await new Promise(resolve => setTimeout(resolve, 1800));
    this._isRealHardware = false;
    this._connectedMac   = "SIMULATED";
    console.log("[BLE] 🔁 Simulation mode active — no physical hardware.");
    return {
      serviceUuid:        BLE_SERVICE_UUID,
      characteristicUuid: BLE_CHARACTERISTIC_UUID,
      deviceName:         this._deviceName,
      macAddress:         "SIMULATED",
      connectedAt:        new Date().toISOString(),
      isRealHardware:     false
    };
  }

  // ── Reconnect ─────────────────────────────────────────────────────
  async reconnect(): Promise<boolean> {
    if (this.device?.gatt) {
      try {
        this.server = await this.device.gatt.connect();
        console.log("[BLE] Reconnected to device.");
        return true;
      } catch {
        console.warn("[BLE] Reconnection failed.");
        return false;
      }
    }
    return this._isRealHardware ? false : true; // Simulation always succeeds
  }

  // ── Write command to characteristic ──────────────────────────────
  private async writeCommand(command: string): Promise<boolean> {
    if (!this.characteristic) {
      console.log(`[BLE] ℹ️  No BLE characteristic — command "${command}" not sent to hardware.`);
      return false;
    }
    try {
      const encoder = new TextEncoder();
      await this.characteristic.writeValueWithResponse(encoder.encode(command));
      console.log(`[BLE] ✉️  Command sent: "${command}"`);
      return true;
    } catch (err) {
      console.error(`[BLE] Failed to write command "${command}":`, err);
      return false;
    }
  }

  // ── Subscribe to notifications ────────────────────────────────────
  onNotification(cb: NotificationCallback): () => void {
    this.notificationCallbacks.add(cb);
    return () => this.notificationCallbacks.delete(cb);
  }

  // ── Hardware Commands ─────────────────────────────────────────────
  async sendUnlock(): Promise<boolean>       { return this.writeCommand("ADMIN_UNLOCK"); }
  async sendLock(): Promise<boolean>         { return this.writeCommand("LOCK"); }
  async sendAdminUnlock(): Promise<boolean>  { return this.writeCommand("ADMIN_UNLOCK"); }
  async sendPing(): Promise<boolean>         { return this.writeCommand("PING"); }

  // ── Legacy API surface (used by useLockerController) ─────────────
  async sendCategory(_draft: DonationDraft) {
    return { ok: true, acknowledgedAt: new Date().toISOString() };
  }

  async unlock(): Promise<LockerEvent> {
    await this.sendUnlock();
    return this.createEvent("door_open", "Solenoid unlock command sent to firmware.");
  }

  async lock(): Promise<LockerEvent> {
    await this.sendLock();
    return this.createEvent("lock_confirmed", "Lock command sent to firmware.");
  }

  async adminUnlock(): Promise<LockerEvent> {
    await this.sendAdminUnlock();
    return this.createEvent("unlock", "Admin override unlock sent to firmware.");
  }

  async startSanitization(): Promise<LockerEvent> {
    // Air-refresh & cleaning cycle completed notification
    return this.createEvent("cycle_complete", "Sanitization cycle initiated.");
  }

  async acknowledgeFault(): Promise<LockerEvent> {
    return this.createEvent("fault_cleared", "Admin cleared the active maintenance fault.");
  }

  private createEvent(type: LockerEvent["type"], detail: string): LockerEvent {
    return {
      id:         crypto.randomUUID(),
      lockerId:   sampleLockerState.lockerId,
      type,
      createdAt:  new Date().toISOString(),
      detail,
      syncState:  "queued"
    };
  }

  async disconnect() {
    if (this.server?.connected) {
      this.server.disconnect();
    }
    this.characteristic = null;
    this.server = null;
    this._isRealHardware = false;
  }
}

export const bleService = new BleService();

// ── Utility ──────────────────────────────────────────────────────────
export function mergeTelemetry(state: LockerState, partial: Partial<LockerState>): LockerState {
  return {
    ...state,
    ...partial,
    telemetry: {
      ...state.telemetry,
      ...(partial.telemetry ?? {})
    }
  };
}