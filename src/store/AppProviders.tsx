import { useEffect, useMemo, useReducer, useRef } from "react";
import type { PropsWithChildren } from "react";
import { AppContextProvider } from "./AppContext";
import { appReducer, initialAppState } from "./appState";
import { syncInitialState } from "../services/initialSync";

const STORAGE_KEY = "ecolocker-preferences";

export function AppProviders({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(appReducer, initialAppState, (defaultState) => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState;

    try {
      const parsed = JSON.parse(saved) as Partial<typeof defaultState>;
      return {
        ...defaultState,
        // Only restore user preferences — NOT locker data (which has time-sensitive dates)
        locale: parsed.locale ?? defaultState.locale,
        themeMode: parsed.themeMode ?? defaultState.themeMode,
        themePalette: parsed.themePalette ?? defaultState.themePalette,
        selectedLockerId: parsed.selectedLockerId ?? defaultState.selectedLockerId,
        // Always use fresh locker data from initialAppState (current timestamps)
        lockers: defaultState.lockers,
        donationHistory: defaultState.donationHistory,
        // Force login on refresh by resetting auth state
        hasCompletedPairing: false,
        isAdminAuthenticated: false
      };
    } catch {
      return defaultState;
    }
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        window.location.reload(); // Simple sync: reload on external state change
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
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
    
    // Persist state but exclude sensitive authentication status to force re-login on refresh
    const { isAdminAuthenticated, ...persistedState } = state;
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

  // Continuous mock telemetry jitter for empty lockers
  useEffect(() => {
    const interval = setInterval(() => {
      state.lockers.forEach(locker => {
        if (!locker.activeDonation) {
          const jitterTemp = (Math.random() * 0.4) - 0.2;
          const jitterHum = (Math.random() * 2) - 1;
          const jitterGas = (Math.random() * 500) - 250;
          
          dispatch({
            type: "patch-locker",
            id: locker.lockerId,
            locker: {
              telemetry: {
                ...locker.telemetry,
                internalTempC: Number((locker.telemetry.internalTempC + jitterTemp).toFixed(1)),
                humidityPct: Number((locker.telemetry.humidityPct + jitterHum).toFixed(1)),
                gasResistanceOhms: Number((locker.telemetry.gasResistanceOhms + jitterGas).toFixed(0)),
                timestamp: new Date().toISOString()
              }
            }
          });
        }
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [state.lockers]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppContextProvider value={value}>{children}</AppContextProvider>;
}
