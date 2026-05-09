import type { LocaleCode, ThemeMode, ThemePalette, DonationDraft, LockerEvent, LockerState, AlertRecord, DonationRecord } from "../types/domain";
import { defaultDonationDraft, sampleDonation, sampleEvents, sampleLockerState } from "../utils/mockData";
import { generateMockReadings, persistMockReadings, loadMockReadings } from "../utils/mockTelemetry";

export interface AppState {
  locale: LocaleCode;
  themeMode: ThemeMode;
  themePalette: ThemePalette;
  hasCompletedPairing: boolean;
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
  | { type: "patch-locker"; id: string; locker: Partial<LockerState> }
  | { type: "select-locker"; id: string }
  | { type: "set-donation-draft"; draft: Partial<DonationDraft> }
  | { type: "record-donation"; donation: DonationRecord }
  | { type: "reset-donations" }
  | { type: "reset-donation-draft" }
  | { type: "append-log"; event: LockerEvent }
  | { type: "push-alert"; alert: AlertRecord }
  | { type: "clear-alert" }
  | { type: "remove-alert"; id: string }
  | { type: "clear-all-alerts" }
  | { type: "set-admin-auth"; value: boolean }
  | { type: "set-sync-message"; message: string };

export const initialAppState: AppState = {
  locale: "en",
  themeMode: "light",
  themePalette: "luxury",
  hasCompletedPairing: false,
  lockers: [
    { ...sampleLockerState, lockerId: "chamber-1", occupancyState: "empty" },
    { ...sampleLockerState, lockerId: "chamber-2", occupancyState: "empty" },
    { ...sampleLockerState, lockerId: "chamber-3", occupancyState: "empty" },
    { ...sampleLockerState, lockerId: "chamber-4", occupancyState: "empty" },
    { ...sampleLockerState, lockerId: "chamber-5", occupancyState: "empty" },
    { ...sampleLockerState, lockerId: "chamber-6", occupancyState: "empty" },
    { ...sampleLockerState, lockerId: "chamber-7", occupancyState: "empty" },
    { ...sampleLockerState, lockerId: "chamber-8", occupancyState: "empty" },
  ],
  selectedLockerId: "chamber-1",
  donationDraft: defaultDonationDraft,
  donationHistory: [],
  logs: [],
  alerts: [],
  isAdminAuthenticated: false,
  syncMessage: ""
};

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
        donationHistory: [],
        lockers: state.lockers.map((l) => ({
          ...l,
          activeDonation: undefined,
          occupancyState: "empty",
          sanitizationState: "idle",
          faultState: "none"
        })),
        syncMessage: "All donation records cleared from the kiosk."
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
