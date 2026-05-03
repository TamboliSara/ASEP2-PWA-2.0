import { useEffect, useMemo, useReducer } from "react";
import type { PropsWithChildren } from "react";
import { AppContextProvider } from "./AppContext";
import { appReducer, initialAppState } from "./appState";

const STORAGE_KEY = "ecolocker-preferences";

export function AppProviders({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(appReducer, initialAppState, (defaultState) => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState;

    try {
      const parsed = JSON.parse(saved) as Partial<typeof defaultState>;
      return {
        ...defaultState,
        ...parsed,
        lockers: parsed.lockers ?? defaultState.lockers,
        selectedLockerId: parsed.selectedLockerId ?? defaultState.selectedLockerId,
        // Force connection and login on refresh by resetting states
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

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppContextProvider value={value}>{children}</AppContextProvider>;
}
