import type { DonationDraft, LockerEvent, LockerState } from "../types/domain";
import { sampleLockerState } from "../utils/mockData";

const BLE_SERVICE_UUID = import.meta.env.VITE_BLE_SERVICE_UUID ?? "ec0-0001";

export class BleService {
  private deviceName = sampleLockerState.pairedDeviceName ?? "EcoLocker ESP32-S3";

  async pair() {
    // Simulate Bluetooth discovery & handshake
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      serviceUuid: BLE_SERVICE_UUID,
      deviceName: this.deviceName,
      connectedAt: new Date().toISOString()
    };
  }

  async reconnect() {
    return true;
  }

  async sendCategory(_draft: DonationDraft) {
    return {
      ok: true,
      acknowledgedAt: new Date().toISOString()
    };
  }

  async unlock() {
    return this.createEvent("door_open", "Solenoid unlock acknowledged by firmware.");
  }

  async lock() {
    return this.createEvent("lock_confirmed", "Lock confirmed by firmware after door close.");
  }

  async startSanitization() {
    return this.createEvent("cycle_complete", "UV-C and ventilation cycle completed.");
  }

  async acknowledgeFault() {
    return this.createEvent("cycle_complete", "Admin cleared the active maintenance fault.");
  }

  private createEvent(type: LockerEvent["type"], detail: string): LockerEvent {
    return {
      id: crypto.randomUUID(),
      lockerId: sampleLockerState.lockerId,
      type,
      createdAt: new Date().toISOString(),
      detail,
      syncState: "queued"
    };
  }
}

export const bleService = new BleService();

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