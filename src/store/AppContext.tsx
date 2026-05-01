import { createContext, useContext } from "react";
import type { Dispatch, PropsWithChildren } from "react";
import type { AppAction, AppState } from "./appState";

export interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("AppContext is unavailable outside AppProviders.");
  }

  return context;
}

export function AppContextProvider({ children, value }: PropsWithChildren<{ value: AppContextValue }>) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}