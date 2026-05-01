export type ThemeMode = "light" | "dark";
export type ThemePalette = "forest" | "clay" | "ocean" | "luxury";
export type LocaleCode = "en" | "hi" | "mr";

export type LockState = "locked" | "unlocking" | "unlocked" | "locking";
export type DoorState = "closed" | "open" | "unknown";
export type OccupancyState = "empty" | "occupied" | "processing" | "maintenance" | "spoiled";
export type SanitizationState = "idle" | "running" | "complete";
export type FaultState = "none" | "sensor_fault" | "spoilage_lockdown" | "bluetooth_fault";
export type FoodQualityScore = "fresh" | "aging" | "spoilt";
export type SyncState = "idle" | "queued" | "syncing" | "synced" | "error";
export type DietTag = "veg" | "non_veg" | "vegan";
export type SensorHealth = "healthy" | "degraded" | "critical";
export type FlowMode = "donor" | "receiver";

export interface LockerCoordinates {
  x: number;
  y: number;
}

export interface DeadlineEstimate {
  hoursRemaining: number;
  absoluteIso: string;
}

export interface SensorTelemetry {
  timestamp: string;
  internalTempC: number;
  externalTempC: number;
  humidityPct: number;
  pressureHpa: number;
  gasResistanceOhms: number;
  heaterStep: number;
  sensorHealth: SensorHealth;
  heuristicGasProfile: string[];
}

export interface DonationRecord {
  id: string;
  lockerId: string;
  foodName: string;
  categoryId: number;
  categoryLabel: string;
  donorName: string;
  donorContact: string;
  allergensNotes: string;
  dietTag: DietTag;
  createdAt: string;
  latestQualityScore: FoodQualityScore;
  deadlineEstimate: DeadlineEstimate;
  syncState: SyncState;
}

export interface LockerEvent {
  id: string;
  lockerId: string;
  type:
    | "door_open"
    | "door_closed"
    | "lock_confirmed"
    | "timeout"
    | "fault"
    | "cycle_complete"
    | "reconnect_needed"
    | "deposit_started"
    | "deposit_completed"
    | "retrieve_started"
    | "retrieve_completed";
  createdAt: string;
  detail: string;
  syncState: SyncState;
}

export interface AlertRecord {
  id: string;
  lockerId: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
  acknowledgedAt?: string;
}

export interface SyncRecord {
  id: string;
  entityType: "donation" | "event" | "alert" | "snapshot" | "sensorSnapshot" | "prediction";
  entityId: string;
  status: SyncState;
  updatedAt: string;
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: "admin" | "maintainer";
}

export interface LockerState {
  lockerId: string;
  lockState: LockState;
  doorState: DoorState;
  occupancyState: OccupancyState;
  sanitizationState: SanitizationState;
  faultState: FaultState;
  foodQualityScore: FoodQualityScore;
  deadlineEstimate: DeadlineEstimate;
  telemetry: SensorTelemetry;
  activeDonation?: DonationRecord;
  activeAlert?: AlertRecord;
  bleConnected: boolean;
  lastSyncedAt?: string;
  pairedDeviceName?: string;
}

export interface SensorSnapshot {
  id: string;
  lockerId: string;
  donationId?: string;
  capturedAt: string;
  telemetry: SensorTelemetry;
  source: "deposit" | "retrieve" | "periodic";
}

export interface PredictionSnapshot {
  id: string;
  lockerId: string;
  donationId?: string;
  capturedAt: string;
  qualityScore: FoodQualityScore;
  deadlineEstimate: DeadlineEstimate;
  heuristicGasProfile: string[];
  recommendedActions: string[];
  source: "deposit" | "retrieve" | "periodic";
}

export interface FleetLockerSummary {
  lockerId: string;
  lockerLabel: string;
  zoneLabel: string;
  coordinates: LockerCoordinates;
  occupancyState: OccupancyState;
  foodQualityScore: FoodQualityScore;
  faultState: FaultState;
  activeDonationName?: string;
  activeDonationCategory?: string;
  deadlineEstimate?: DeadlineEstimate;
  lastSyncedAt?: string;
  sensorHealth: SensorHealth;
  heuristicGasProfile: string[];
  totalUnits: number;
  occupiedUnits: number;
  freeUnits: number;
}

export interface DonationDraft {
  foodName: string;
  categoryId: number | null;
  categoryLabel: string;
  donorName: string;
  donorContact: string;
  allergensNotes: string;
  dietTag: DietTag;
}
