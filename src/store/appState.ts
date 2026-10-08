import type { LocaleCode, ThemeMode, ThemePalette, DonationDraft, LockerEvent, LockerState, AlertRecord, DonationRecord } from "../types/domain";
import { defaultDonationDraft, defaultTelemetry, sampleDonation, sampleEvents, sampleLockerState } from "../utils/mockData";
import { generateMockReadings, persistMockReadings, loadMockReadings } from "../utils/mockTelemetry";

/**
 * The chamber ID that is backed by real ESP32-S3 hardware.
 * All other chambers (chamber-2 through chamber-8) are mock.
 * This is the locker that:
 *   - Issues real RTDB commands to the physical relay/solenoid
 *   - Uses BLE for pairing and fallback control
 *   - Monitors real ultrasonic sensor for occupancy
 *   - Receives real BME688 and DS18B20 telemetry
 */
export const HARDWARE_LOCKER_ID = "chamber-1";

export interface AppState {
  locale: LocaleCode;
  themeMode: ThemeMode;
  themePalette: ThemePalette;
  hasCompletedPairing: boolean;
  /** MAC address of the real ESP32 hardware (no colons, e.g. "AABBCCDDEEFF"). "SIMULATED" or "" if not paired to real hardware. */
  hardwareMac: string;
  lockers: LockerState[];
  selectedLockerId: string;
  donationDraft: DonationDraft;
  donationHistory: DonationRecord[];
  logs: LockerEvent[];
  alerts: AlertRecord[];
  isAdminAuthenticated: boolean;
  syncMessage: string;
}

export type AppAction =
  | { type: "set-locale"; locale: LocaleCode }
  | { type: "set-theme-mode"; themeMode: ThemeMode }
  | { type: "set-theme-palette"; themePalette: ThemePalette }
  | { type: "set-pairing-complete"; value: boolean }
  | { type: "set-hardware-mac"; mac: string }
  | { type: "patch-locker"; id: string; locker: Partial<LockerState> }
  | { type: "batch-jitter-mock-telemetry"; patches: Record<string, Partial<LockerState>> }
  | { type: "select-locker"; id: string }
  | { type: "set-donation-draft"; draft: Partial<DonationDraft> }
  | { type: "record-donation"; donation: DonationRecord }
  | { type: "reset-donations" }
  | { type: "reset-to-fresh-state"; freshLockers: LockerState[] }
  | { type: "reset-donation-draft" }
  | { type: "append-log"; event: LockerEvent }
  | { type: "push-alert"; alert: AlertRecord }
  | { type: "clear-alert" }
  | { type: "remove-alert"; id: string }
  | { type: "clear-all-alerts" }
  | { type: "set-admin-auth"; value: boolean }
  | { type: "set-sync-message"; message: string };

export const initialAppState: AppState = {
  locale: "hi",
  themeMode: "light",
  themePalette: "luxury",
  hasCompletedPairing: true,
  hardwareMac: "",  // Set during pairing from BLE device name
    lockers: [
      // chamber-1 is real hardware — always starts empty; RTDB+Firestore subscriptions populate it
      { ...sampleLockerState, lockerId: "chamber-1", occupancyState: "empty", activeDonation: undefined },
      { ...sampleLockerState, lockerId: "chamber-2", occupancyState: "empty" },
      { ...sampleLockerState, lockerId: "chamber-3", occupancyState: "occupied", foodQualityScore: "aging", telemetry: { ...defaultTelemetry, internalTempC: 4.8, externalTempC: 26.5, humidityPct: 62.0, pressureHpa: 1012.0, gasResistanceOhms: 16500, distanceCm: 14.2, heuristicGasProfile: ["Natural fruit respiration", "Low ethylene emission"] }, deadlineEstimate: { hoursRemaining: 20, absoluteIso: new Date(Date.now() + 20 * 3600000).toISOString() }, activeDonation: { ...sampleDonation, id: "donation-c3", lockerId: "chamber-3", donorName: "Amit Sharma", donorContact: "amit@ecolocker.local", foodName: "Mixed Fruit Bowl", categoryLabel: "Raw Produce", dietTag: "veg", latestQualityScore: "aging", allergensNotes: "No common allergens • Fresh seasonal fruits (Apples, Oranges, Melons)", deadlineEstimate: { hoursRemaining: 20, absoluteIso: new Date(Date.now() + 20 * 3600000).toISOString() } } },
      { ...sampleLockerState, lockerId: "chamber-4", occupancyState: "occupied", foodQualityScore: "spoilt", telemetry: { ...defaultTelemetry, internalTempC: 14.5, externalTempC: 31.0, humidityPct: 88.0, pressureHpa: 1002.0, gasResistanceOhms: 4200, distanceCm: 11.5, heuristicGasProfile: ["High biogenic amine concentration", "Microbial metabolic peak"] }, deadlineEstimate: { hoursRemaining: 2, absoluteIso: new Date(Date.now() + 2 * 3600000).toISOString() }, activeDonation: { ...sampleDonation, id: "donation-c4", lockerId: "chamber-4", donorName: "Rahul Desai", donorContact: "rahul@ecolocker.local", foodName: "Chicken Biryani", categoryLabel: "Cooked Meal", dietTag: "non_veg", latestQualityScore: "spoilt", allergensNotes: "Contains tree nuts (Cashews) & dairy (Ghee) • Spiced meal", deadlineEstimate: { hoursRemaining: 2, absoluteIso: new Date(Date.now() + 2 * 3600000).toISOString() } } },
      { ...sampleLockerState, lockerId: "chamber-5", occupancyState: "occupied", foodQualityScore: "fresh", telemetry: { ...defaultTelemetry, internalTempC: 3.8, externalTempC: 25.0, humidityPct: 44.0, pressureHpa: 1014.0, gasResistanceOhms: 28500, distanceCm: 18.0, heuristicGasProfile: ["Optimal storage conditions", "Nominal volatile profile"] }, deadlineEstimate: { hoursRemaining: 48, absoluteIso: new Date(Date.now() + 48 * 3600000).toISOString() }, activeDonation: { ...sampleDonation, id: "donation-c5", lockerId: "chamber-5", donorName: "Vikram Singh", donorContact: "v.singh@ecolocker.local", foodName: "Bread", categoryLabel: "Baked Goods", dietTag: "veg", latestQualityScore: "fresh", allergensNotes: "Contains gluten & wheat • Freshly baked artisan loaf", deadlineEstimate: { hoursRemaining: 48, absoluteIso: new Date(Date.now() + 48 * 3600000).toISOString() } } },
      { ...sampleLockerState, lockerId: "chamber-6", occupancyState: "empty" },
      { ...sampleLockerState, lockerId: "chamber-7", occupancyState: "empty" },
      { ...sampleLockerState, lockerId: "chamber-8", occupancyState: "empty" },
    ],
    selectedLockerId: "chamber-1",
    donationDraft: defaultDonationDraft,
    donationHistory: [],
    logs: [],
    alerts: [],
    isAdminAuthenticated: true,
    syncMessage: ""
  };
  
  /** Builds a fresh copy of the initial state with live timestamps (call at runtime, not module load). */
  export function buildFreshInitialState(): AppState {
    const now = Date.now();
    return {
      ...initialAppState,
      lockers: [
        // chamber-1 is real hardware — always starts empty; RTDB+Firestore subscriptions populate it
        { ...sampleLockerState, lockerId: "chamber-1", occupancyState: "empty", activeDonation: undefined },
        { ...sampleLockerState, lockerId: "chamber-2", occupancyState: "empty" },
        { ...sampleLockerState, lockerId: "chamber-3", occupancyState: "occupied", foodQualityScore: "aging",
          telemetry: { ...defaultTelemetry, internalTempC: 4.8, externalTempC: 26.5, humidityPct: 62.0, pressureHpa: 1012.0, gasResistanceOhms: 16500, distanceCm: 14.2, heuristicGasProfile: ["Natural fruit respiration", "Low ethylene emission"] },
          deadlineEstimate: { hoursRemaining: 20, absoluteIso: new Date(now + 20 * 3600000).toISOString() },
          activeDonation: { ...sampleDonation, id: "donation-c3", lockerId: "chamber-3", donorName: "Amit Sharma", donorContact: "amit@ecolocker.local", foodName: "Mixed Fruit Bowl", categoryLabel: "Raw Produce", dietTag: "veg", latestQualityScore: "aging", allergensNotes: "No common allergens • Fresh seasonal fruits (Apples, Oranges, Melons)", deadlineEstimate: { hoursRemaining: 20, absoluteIso: new Date(now + 20 * 3600000).toISOString() } } },
        { ...sampleLockerState, lockerId: "chamber-4", occupancyState: "occupied", foodQualityScore: "spoilt",
          telemetry: { ...defaultTelemetry, internalTempC: 14.5, externalTempC: 31.0, humidityPct: 88.0, pressureHpa: 1002.0, gasResistanceOhms: 4200, distanceCm: 11.5, heuristicGasProfile: ["High biogenic amine concentration", "Microbial metabolic peak"] },
          deadlineEstimate: { hoursRemaining: 2, absoluteIso: new Date(now + 2 * 3600000).toISOString() },
          activeDonation: { ...sampleDonation, id: "donation-c4", lockerId: "chamber-4", donorName: "Rahul Desai", donorContact: "rahul@ecolocker.local", foodName: "Chicken Biryani", categoryLabel: "Cooked Meal", dietTag: "non_veg", latestQualityScore: "spoilt", allergensNotes: "Contains tree nuts (Cashews) & dairy (Ghee) • Spiced meal", deadlineEstimate: { hoursRemaining: 2, absoluteIso: new Date(now + 2 * 3600000).toISOString() } } },
        { ...sampleLockerState, lockerId: "chamber-5", occupancyState: "occupied", foodQualityScore: "fresh",
          telemetry: { ...defaultTelemetry, internalTempC: 3.8, externalTempC: 25.0, humidityPct: 44.0, pressureHpa: 1014.0, gasResistanceOhms: 28500, distanceCm: 18.0, heuristicGasProfile: ["Optimal storage conditions", "Nominal volatile profile"] },
          deadlineEstimate: { hoursRemaining: 48, absoluteIso: new Date(now + 48 * 3600000).toISOString() },
          activeDonation: { ...sampleDonation, id: "donation-c5", lockerId: "chamber-5", donorName: "Vikram Singh", donorContact: "v.singh@ecolocker.local", foodName: "Bread", categoryLabel: "Baked Goods", dietTag: "veg", latestQualityScore: "fresh", allergensNotes: "Contains gluten & wheat • Freshly baked artisan loaf", deadlineEstimate: { hoursRemaining: 48, absoluteIso: new Date(now + 48 * 3600000).toISOString() } } },
        { ...sampleLockerState, lockerId: "chamber-6", occupancyState: "empty" },
        { ...sampleLockerState, lockerId: "chamber-7", occupancyState: "empty" },
        { ...sampleLockerState, lockerId: "chamber-8", occupancyState: "empty" },
      ]
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "set-locale":
      return { ...state, locale: action.locale };
    case "set-theme-mode":
      return { ...state, themeMode: action.themeMode };
    case "set-theme-palette":
      return { ...state, themePalette: action.themePalette };
    case "set-pairing-complete":
      return { ...state, hasCompletedPairing: action.value };
    case "set-hardware-mac":
      return { ...state, hardwareMac: action.mac };
    case "patch-locker":
      return {
        ...state,
        lockers: state.lockers.map((l) =>
          l.lockerId === action.id
            ? {
                ...l,
                ...action.locker,
                telemetry: {
                  ...l.telemetry,
                  ...(action.locker.telemetry ?? {})
                }
              }
            : l
        )
      };
    case "batch-jitter-mock-telemetry":
      return {
        ...state,
        lockers: state.lockers.map((l) => {
          const patch = action.patches[l.lockerId];
          if (!patch) return l;
          return {
            ...l,
            ...patch,
            telemetry: {
              ...l.telemetry,
              ...(patch.telemetry ?? {})
            }
          };
        })
      };
    case "select-locker":
      return { ...state, selectedLockerId: action.id };
    case "set-donation-draft":
      return {
        ...state,
        donationDraft: {
          ...state.donationDraft,
          ...action.draft
        }
      };
    case "record-donation":
      return {
        ...state,
        donationHistory: [action.donation, ...state.donationHistory.filter((item) => item.id !== action.donation.id)].slice(0, 8)
      };
    case "reset-donations":
      return {
        ...state,
        donationHistory: initialAppState.donationHistory,
        lockers: initialAppState.lockers,
        syncMessage: "All donation records cleared from the kiosk. Original mock data restored."
      };
    case "reset-to-fresh-state":
      return {
        ...state,
        donationHistory: [],
        lockers: action.freshLockers,
        logs: [],
        alerts: [],
        syncMessage: "SYSTEM RESET: Mock data restored with fresh timestamps."
      };
    case "reset-donation-draft":
      return { ...state, donationDraft: defaultDonationDraft };
    case "append-log":
      return { ...state, logs: [action.event, ...state.logs].slice(0, 12) };
    case "push-alert":
      return {
        ...state,
        alerts: [action.alert, ...state.alerts],
        lockers: state.lockers.map((l) => (l.lockerId === state.selectedLockerId ? { ...l, activeAlert: action.alert } : l))
      };
    case "clear-alert":
      return {
        ...state,
        lockers: state.lockers.map((l) => (l.lockerId === state.selectedLockerId ? { ...l, activeAlert: undefined, faultState: "none" } : l))
      };
    case "remove-alert":
      return {
        ...state,
        alerts: state.alerts.filter(a => a.id !== action.id)
      };
    case "clear-all-alerts":
      return {
        ...state,
        alerts: []
      };
    case "set-admin-auth":
      return { ...state, isAdminAuthenticated: action.value };
    case "set-sync-message": {
      if (action.message && action.message !== state.syncMessage) {
        let title = "System Notification";
        const msgLow = action.message.toLowerCase();
        if (msgLow.includes("sync")) title = "Cloud Sync";
        else if (msgLow.includes("pair")) title = "Device Pairing";
        else if (msgLow.includes("cloud") || msgLow.includes("network")) title = "Network Status";
        else if (msgLow.includes("cleared") || msgLow.includes("wipe") || msgLow.includes("reset")) title = "System Maintenance";
        else if (msgLow.includes("donation") || msgLow.includes("food")) title = "Donation Status";

        const newAlert: AlertRecord = {
          id: Math.random().toString(36).substring(2, 11),
          lockerId: state.selectedLockerId,
          title,
          detail: action.message,
          severity: "info",
          createdAt: new Date().toISOString()
        };
        return { 
          ...state, 
          syncMessage: action.message,
          alerts: [newAlert, ...state.alerts].slice(0, 50)
        };
      }
      return { ...state, syncMessage: action.message };
    }
    default:
      return state;
  }
}
