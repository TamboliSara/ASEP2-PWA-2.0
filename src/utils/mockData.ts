import type {
  AlertRecord,
  DeadlineEstimate,
  DonationDraft,
  DonationRecord,
  FleetLockerSummary,
  LockerEvent,
  LockerState,
  PredictionSnapshot,
  SensorSnapshot,
  SensorTelemetry
} from "../types/domain";

const now = new Date();
const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

export const defaultDeadlineEstimate: DeadlineEstimate = {
  hoursRemaining: 48,
  absoluteIso: deadline
};

export const defaultTelemetry: SensorTelemetry = {
  timestamp: now.toISOString(),
  internalTempC: 4.8,
  externalTempC: 29.1,
  humidityPct: 61,
  pressureHpa: 1008.2,
  gasResistanceOhms: 18230,
  heaterStep: 2,
  sensorHealth: "healthy",
  heuristicGasProfile: ["Mild fermentation risk", "Low sulfur compounds", "Fresh starch profile"]
};

export const defaultDonationDraft: DonationDraft = {
  foodName: "",
  categoryId: null,
  categoryLabel: "",
  donorName: "",
  donorContact: "",
  allergensNotes: "",
  dietTag: "veg",
  isPhoneVerified: false
};

export const sampleDonation: DonationRecord = {
  id: "donation-001",
  lockerId: "locker-a1",
  lockerNumber: 1,
  foodName: "Vegetable Pulao",
  categoryId: 2,
  categoryLabel: "Cooked Meal",
  donorName: "Sara Patel",
  donorContact: "demo@ecolocker.local",
  allergensNotes: "Contains peanuts. Packed at 8:00 PM.",
  dietTag: "veg",
  createdAt: now.toISOString(),
  latestQualityScore: "fresh",
  deadlineEstimate: defaultDeadlineEstimate,
  syncState: "queued"
};

export const sampleAlert: AlertRecord = {
  id: "alert-001",
  lockerId: "locker-a1",
  title: "Air Quality Alert",
  detail: "Locker is hard-locked until an admin reviews the donation and sanitization logs.",
  severity: "critical",
  createdAt: now.toISOString()
};

export const sampleEvents: LockerEvent[] = [
  {
    id: "event-001",
    lockerId: "locker-a1",
    type: "deposit_started",
    createdAt: now.toISOString(),
    detail: "Donor selected Cooked Meal and requested unlock.",
    syncState: "synced"
  },
  {
    id: "event-002",
    lockerId: "locker-a1",
    type: "cycle_complete",
    createdAt: now.toISOString(),
    detail: "Sanitization completed after deposit cycle.",
    syncState: "queued"
  }
];

export const sampleLockerState: LockerState = {
  lockerId: "locker-a1",
  lockState: "locked",
  doorState: "closed",
  occupancyState: "empty",
  sanitizationState: "idle",
  faultState: "none",
  foodQualityScore: "fresh",
  deadlineEstimate: defaultDeadlineEstimate,
  telemetry: defaultTelemetry,
  bleConnected: false,
  lastSyncedAt: now.toISOString(),
  pairedDeviceName: "EcoLocker ESP32-S3"
};

export const sampleSensorSnapshot: SensorSnapshot = {
  id: "sensor-001",
  lockerId: "locker-a1",
  donationId: sampleDonation.id,
  capturedAt: now.toISOString(),
  telemetry: defaultTelemetry,
  source: "deposit"
};

export const samplePredictionSnapshot: PredictionSnapshot = {
  id: "prediction-001",
  lockerId: "locker-a1",
  donationId: sampleDonation.id,
  capturedAt: now.toISOString(),
  qualityScore: "fresh",
  deadlineEstimate: defaultDeadlineEstimate,
  heuristicGasProfile: defaultTelemetry.heuristicGasProfile,
  recommendedActions: [
    "Keep the safe sealed until collection.",
    "If quality drops, move to immediate community use.",
    "If spoilage begins, send for composting or animal-safe bio-waste handling."
  ],
  source: "deposit"
};

export const sampleFleetLockers: FleetLockerSummary[] = [
  {
    lockerId: "kiosk-alpha",
    lockerLabel: "Kiosk Alpha",
    zoneLabel: "Main Dining Hall",
    coordinates: { x: 28, y: 35 },
    occupancyState: "occupied",
    foodQualityScore: "fresh",
    faultState: "none",
    activeDonationName: "Mixed Fruit Bowl",
    activeDonationCategory: "Raw Produce",
    deadlineEstimate: { hoursRemaining: 30, absoluteIso: new Date(now.getTime() + 30 * 60 * 60 * 1000).toISOString() },
    lastSyncedAt: now.toISOString(),
    sensorHealth: "healthy",
    heuristicGasProfile: ["Optimal storage", "Low volatile compounds"],
    totalUnits: 8,
    occupiedUnits: 5,
    freeUnits: 3
  },
  {
    lockerId: "kiosk-beta",
    lockerLabel: "Kiosk Beta",
    zoneLabel: "Engineering Block",
    coordinates: { x: 55, y: 28 },
    occupancyState: "occupied",
    foodQualityScore: "aging",
    faultState: "none",
    activeDonationName: "Rice & Dal",
    activeDonationCategory: "Cooked Meal",
    deadlineEstimate: { hoursRemaining: 3, absoluteIso: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString() },
    lastSyncedAt: now.toISOString(),
    sensorHealth: "degraded",
    heuristicGasProfile: ["Slight fermentation", "Rising ethylene"],
    totalUnits: 8,
    occupiedUnits: 8,
    freeUnits: 0
  },
  {
    lockerId: "kiosk-gamma",
    lockerLabel: "Kiosk Gamma",
    zoneLabel: "Sports Complex",
    coordinates: { x: 45, y: 65 },
    occupancyState: "occupied",
    foodQualityScore: "fresh",
    faultState: "none",
    activeDonationName: "Poha Bowl",
    activeDonationCategory: "Cooked Meal",
    deadlineEstimate: { hoursRemaining: 18, absoluteIso: new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString() },
    lastSyncedAt: now.toISOString(),
    sensorHealth: "healthy",
    heuristicGasProfile: ["Minimal VOC emission", "Stable freshness indicators"],
    totalUnits: 8,
    occupiedUnits: 3,
    freeUnits: 5
  },
  {
    lockerId: "kiosk-delta",
    lockerLabel: "Kiosk Delta (THIS DEVICE)",
    zoneLabel: "Campus Gate — Active Kiosk",
    coordinates: { x: 75, y: 52 },
    occupancyState: "occupied",
    foodQualityScore: "fresh",
    faultState: "none",
    activeDonationName: "Bread, Milk, Vegetables",
    activeDonationCategory: "Mixed Items",
    deadlineEstimate: defaultDeadlineEstimate,
    lastSyncedAt: now.toISOString(),
    sensorHealth: "healthy",
    heuristicGasProfile: ["Active monitoring", "8 chambers online"],
    totalUnits: 8,
    occupiedUnits: 4,
    freeUnits: 4
  }
];
