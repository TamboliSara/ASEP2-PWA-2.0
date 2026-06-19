import { useEffect, useMemo, useReducer, useRef } from "react";
import type { PropsWithChildren } from "react";
import { AppContextProvider } from "./AppContext";
import { appReducer, initialAppState, HARDWARE_LOCKER_ID } from "./appState";
import { syncInitialState } from "../services/initialSync";

const STORAGE_KEY    = "ecolocker-preferences";
const PAIRING_KEY    = "ecolocker-pairing-done";
const HARDWARE_MAC_KEY = "ecolocker-hardware-mac";

export function AppProviders({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(appReducer, initialAppState, (defaultState) => {
    const saved     = localStorage.getItem(STORAGE_KEY);
    const hasPaired = localStorage.getItem(PAIRING_KEY) === "true";
    const savedMac  = localStorage.getItem(HARDWARE_MAC_KEY) ?? "";

    if (!saved) return { ...defaultState, hasCompletedPairing: hasPaired, hardwareMac: savedMac };

    try {
      const parsed = JSON.parse(saved) as Partial<typeof defaultState>;
      return {
        ...defaultState,
        locale:             parsed.locale         ?? defaultState.locale,
        themeMode:          parsed.themeMode       ?? defaultState.themeMode,
        themePalette:       parsed.themePalette    ?? defaultState.themePalette,
        selectedLockerId:   parsed.selectedLockerId ?? defaultState.selectedLockerId,
        // NOTE: Lockers are NOT restored from localStorage — always use fresh defaultState.
        // This prevents cached "empty" state (from previous RTDB overwrites) from corrupting
        // the mock dashboard on reload. Only user preferences and history are persisted.
        donationHistory:    parsed.donationHistory ?? defaultState.donationHistory,
        // Pairing persists across refreshes — only reset on full system wipe
        hasCompletedPairing: hasPaired,
        hardwareMac:        savedMac,
        // Always force admin re-auth on refresh for security
        isAdminAuthenticated: false
      };
    } catch {
      return { ...defaultState, hasCompletedPairing: hasPaired, hardwareMac: savedMac };
    }
  });

  // Keep a ref to the latest state so callbacks always see fresh values
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    // Intentionally omitting storage event page reloads to ensure smooth SPA experience
    // without forcing jarring refreshes on the user when tabs synchronize.
  }, []);

  // Push all initial chamber/fleet/donation data to Firestore on first load
  const hasSynced = useRef(false);
  useEffect(() => {
    if (!hasSynced.current) {
      hasSynced.current = true;
      syncInitialState(state).catch(console.error);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.themeMode = state.themeMode;
    document.documentElement.dataset.themePalette = state.themePalette;
    document.documentElement.lang = state.locale;
    
    // Persist pairing state and hardware MAC in their own keys
    localStorage.setItem(PAIRING_KEY, String(state.hasCompletedPairing));
    if (state.hardwareMac) {
      localStorage.setItem(HARDWARE_MAC_KEY, state.hardwareMac);
    }

    // Persist state but exclude sensitive auth status to force re-login on refresh.
    // Also exclude lockers — mock lockers always start fresh from initialAppState to prevent
    // stale RTDB-cleared locker state from persisting and breaking the dashboard on reload.
    const { isAdminAuthenticated, hardwareMac, lockers, ...persistedState } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  }, [state]);

  // Automatic sanitization timer for all lockers
  useEffect(() => {
    state.lockers.forEach(locker => {
      if (locker.sanitizationState === "running") {
        const timer = setTimeout(() => {
          dispatch({ type: "patch-locker", id: locker.lockerId, locker: { sanitizationState: "complete" } });
        }, 5000);
        return () => clearTimeout(timer);
      }
    });
  }, [state.lockers]);

  // Continuous mock telemetry jitter for mock lockers only
  // NOTE: Hardware locker (chamber-1) is excluded — it gets real telemetry from RTDB when paired
  useEffect(() => {
    const interval = setInterval(() => {
      stateRef.current.lockers.forEach(locker => {
        if (!locker.activeDonation && locker.lockerId !== HARDWARE_LOCKER_ID) {
          const jitterTemp = (Math.random() * 0.4) - 0.2;
          const jitterHum  = (Math.random() * 2) - 1;
          const jitterGas  = (Math.random() * 500) - 250;
          dispatch({
            type: "patch-locker",
            id: locker.lockerId,
            locker: {
              telemetry: {
                ...locker.telemetry,
                internalTempC:     Number((locker.telemetry.internalTempC + jitterTemp).toFixed(1)),
                humidityPct:       Number((locker.telemetry.humidityPct + jitterHum).toFixed(1)),
                gasResistanceOhms: Number((locker.telemetry.gasResistanceOhms + jitterGas).toFixed(0)),
                timestamp: new Date().toISOString()
              }
            }
          });
        }
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []); // empty — uses stateRef so it never needs to re-register

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppContextProvider value={value}>{children}</AppContextProvider>;
}
