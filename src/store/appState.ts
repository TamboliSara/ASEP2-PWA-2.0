import type { LocaleCode, ThemeMode, ThemePalette, DonationDraft, LockerEvent, LockerState, AlertRecord, DonationRecord } from "../types/domain";
import { defaultDonationDraft, sampleDonation, sampleEvents, sampleLockerState } from "../utils/mockData";

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
  | { type: "set-admin-auth"; value: boolean }
  | { type: "set-sync-message"; message: string };

export const initialAppState: AppState = {
  locale: "en",
  themeMode: "light",
  themePalette: "luxury",
  hasCompletedPairing: false,
  lockers: [
    { ...sampleLockerState, lockerId: "chamber-1", occupancyState: "empty" },
    { ...sampleLockerState, lockerId: "chamber-2", occupancyState: "occupied", activeDonation: { ...sampleDonation, id: "donation-c2", lockerId: "chamber-2", foodName: "Milk", categoryLabel: "Dairy", dietTag: "veg", latestQualityScore: "aging", allergensNotes: "Contains lactose" } },
    { ...sampleLockerState, lockerId: "chamber-3", occupancyState: "empty" },
    { ...sampleLockerState, lockerId: "chamber-4", occupancyState: "spoiled", activeDonation: { ...sampleDonation, id: "donation-c4", lockerId: "chamber-4", foodName: "Rice", categoryLabel: "Cooked Meal", dietTag: "veg", latestQualityScore: "spoilt", allergensNotes: "Contains peanuts. Packed at 8:00 PM." } },
    { ...sampleLockerState, lockerId: "chamber-5", occupancyState: "occupied", activeDonation: { ...sampleDonation, id: "donation-c5", lockerId: "chamber-5", foodName: "Bread", categoryLabel: "Baked Goods", dietTag: "veg", latestQualityScore: "fresh", allergensNotes: "Contains gluten" } },
    { ...sampleLockerState, lockerId: "chamber-6", occupancyState: "empty" },
    { ...sampleLockerState, lockerId: "chamber-7", occupancyState: "maintenance", faultState: "sensor_fault" },
    { ...sampleLockerState, lockerId: "chamber-8", occupancyState: "occupied", activeDonation: { ...sampleDonation, id: "donation-c8", lockerId: "chamber-8", foodName: "Vegetables", categoryLabel: "Raw Produce", dietTag: "vegan", latestQualityScore: "fresh", allergensNotes: "None" } },
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
    case "set-admin-auth":
      return { ...state, isAdminAuthenticated: action.value };
    case "set-sync-message":
      return { ...state, syncMessage: action.message };
    default:
      return state;
  }
}
