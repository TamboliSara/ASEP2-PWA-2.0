import { useEffect, useMemo, useReducer, useRef } from "react";
import type { PropsWithChildren } from "react";
import { AppContextProvider } from "./AppContext";
import { appReducer, initialAppState, HARDWARE_LOCKER_ID } from "./appState";
import { syncInitialState } from "../services/initialSync";
import { subscribeStatus, subscribeTelemetry, rtdbToDomainTelemetry } from "../services/rtdb";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import type { DonationRecord } from "../types/domain";

const STORAGE_KEY      = "ecolocker-preferences";
const PAIRING_KEY      = "ecolocker-pairing-done";
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
        locale:           parsed.locale         ?? defaultState.locale,
        themeMode:        parsed.themeMode       ?? defaultState.themeMode,
        themePalette:     parsed.themePalette    ?? defaultState.themePalette,
        selectedLockerId: parsed.selectedLockerId ?? defaultState.selectedLockerId,
        // NOTE: Lockers are NOT restored from localStorage — always use fresh defaultState.
        // chamber-1 state comes from live RTDB/Firestore; mock lockers 2-8 come from initialAppState.
        donationHistory:  parsed.donationHistory ?? defaultState.donationHistory,
        hasCompletedPairing: hasPaired,
        hardwareMac:      savedMac,
        isAdminAuthenticated: false
      };
    } catch {
      return { ...defaultState, hasCompletedPairing: hasPaired, hardwareMac: savedMac };
    }
  });

  // Always-fresh ref so RTDB/Firestore callbacks never close over stale state
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    // Intentionally omitting storage event page reloads to ensure smooth SPA experience.
  }, []);

  // Push initial fleet/donation data to Firestore on first load
  const hasSynced = useRef(false);
  useEffect(() => {
    if (!hasSynced.current) {
      hasSynced.current = true;
      syncInitialState(state).catch(console.error);
    }
  }, []);

  // Persist preferences (but NOT lockers — they are always rebuilt from initialAppState + RTDB)
  useEffect(() => {
    document.documentElement.dataset.themeMode   = state.themeMode;
    document.documentElement.dataset.themePalette = state.themePalette;
    document.documentElement.lang = state.locale;

    localStorage.setItem(PAIRING_KEY, String(state.hasCompletedPairing));
    if (state.hardwareMac) localStorage.setItem(HARDWARE_MAC_KEY, state.hardwareMac);

    // Exclude lockers & auth from persisted state — lockers are always rebuilt fresh
    const { isAdminAuthenticated, hardwareMac, lockers, ...persistedState } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  }, [state]);

  // Automatic sanitization timer
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

  // Mock telemetry jitter — only for mock lockers (2-8), never for hardware Safe 1
  useEffect(() => {
    const interval = setInterval(() => {
      stateRef.current.lockers.forEach(locker => {
        if (locker.lockerId === HARDWARE_LOCKER_ID) return; // Safe 1 gets real telemetry from RTDB
        if (!locker.activeDonation) {
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
  }, []); // stateRef — never needs to re-register

  // ── Firestore: Safe 1 donation persistence ──────────────────────────────────
  // Runs on mount regardless of pairing state so that a real donation is always
  // restored if it exists in Firestore (e.g. after a page refresh mid-session).
  // DOES NOT affect mock lockers 2-8.
  const firestoreUnsubRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!db) return;
    if (firestoreUnsubRef.current) firestoreUnsubRef.current();

    firestoreUnsubRef.current = onSnapshot(
      doc(db, "lockers", HARDWARE_LOCKER_ID),
      (snap) => {
        if (!snap.exists()) return;

        const data = snap.data();
        const fsOccupancy: string = data?.occupancyState ?? "empty";
        const hasDonation = !!data?.donation?.id;

        // ── Occupied: restore real donation metadata from Firestore ──
        if ((fsOccupancy === "occupied" || fsOccupancy === "spoiled") && hasDonation) {
          // Use live quality/deadline from RTDB telemetry if already in state,
          // otherwise fall back to what Firestore stored.
          const cur = stateRef.current.lockers.find(l => l.lockerId === HARDWARE_LOCKER_ID);
          const qualityScore = cur?.foodQualityScore ?? (data?.item?.latestQualityScore ?? "fresh");
          const deadline     = cur?.deadlineEstimate ?? (data?.prediction?.deadlineEstimate ?? {
            hoursRemaining: 36,
            absoluteIso: new Date(Date.now() + 36 * 3600000).toISOString()
          });

          const restored: DonationRecord = {
            id:              data.donation.id,
            lockerId:        HARDWARE_LOCKER_ID,
            lockerNumber:    1,
            foodName:        data.item?.foodName || "Donated Food",
            categoryId:      2,
            categoryLabel:   data.item?.categoryLabel   || "Cooked Meal",
            donorName:       data.donation?.donorName    || "Anonymous Donor",
            donorContact:    data.donation?.donorContact || "",
            allergensNotes:  data.item?.allergensNotes   || "None declared",
            dietTag:         (data.item?.dietTag as any) || "veg",
            createdAt:       data.donation?.createdAt    || new Date().toISOString(),
            latestQualityScore: qualityScore as any,
            deadlineEstimate:   deadline,
            syncState: "synced"
          };

          dispatch({
            type: "patch-locker",
            id: HARDWARE_LOCKER_ID,
            locker: {
              activeDonation:   restored,
              occupancyState:   fsOccupancy === "spoiled" ? "spoiled" : "occupied",
              foodQualityScore: restored.latestQualityScore,
              deadlineEstimate: restored.deadlineEstimate
            }
          });
          console.log(`[AppProviders] ✅ Safe 1 donation restored from Firestore: "${restored.foodName}"`);
        }

        // ── Empty: Firestore confirms locker is vacant — hide from dashboard ──
        // Ghost-donation guard: if the deposit was cancelled (no food detected),
        // the controller already patched to empty. This listener ensures the same
        // on any subsequent page load where Firestore still reflects empty.
        else if (fsOccupancy === "empty") {
          const cur = stateRef.current.lockers.find(l => l.lockerId === HARDWARE_LOCKER_ID);
          // Only dispatch if we currently think it's occupied (avoid unnecessary renders)
          if (cur?.occupancyState !== "empty" || cur?.activeDonation) {
            dispatch({
              type: "patch-locker",
              id: HARDWARE_LOCKER_ID,
              locker: { activeDonation: undefined, occupancyState: "empty" }
            });
          }
        }
      },
      (err) => {
        console.warn("[AppProviders] Firestore Safe 1 listener error:", err);
      }
    );

    return () => {
      firestoreUnsubRef.current?.();
      firestoreUnsubRef.current = null;
    };
  }, []); // mount-only — uses stateRef for fresh reads

  // ── RTDB: Live hardware status + telemetry for Safe 1 only ──────────────────
  // Gated strictly on pairing being complete AND having a real MAC address.
  // RTDB is the hardware ground truth — its "empty" signal overrides Firestore
  // and prevents ghost donations from showing on the dashboard.
  useEffect(() => {
    const mac = state.hardwareMac;
    if (!mac || mac === "SIMULATED" || mac === "" || !state.hasCompletedPairing) return;

    console.log(`[AppProviders] 📡 Safe 1 RTDB subscriptions active (MAC: ${mac})`);

    // Status subscription — drives occupancy / lock / door state
    const unsubStatus = subscribeStatus(mac, (rtdbStatus) => {
      if (!rtdbStatus) return;

      const occState: "occupied" | "empty" | "processing" | "spoiled" =
        rtdbStatus.occupancy === "occupied"   ? "occupied"   :
        rtdbStatus.occupancy === "spoiled"    ? "spoiled"    :
        rtdbStatus.occupancy === "processing" ? "processing" :
        "empty";

      dispatch({
        type: "patch-locker",
        id: HARDWARE_LOCKER_ID,
        locker: {
          lockState:      rtdbStatus.lock_state === "unlocked" ? "unlocked" : "locked",
          doorState:      rtdbStatus.door_state === "open"     ? "open"     : "closed",
          occupancyState: occState,
          bleConnected:   true,
          // Ghost-donation guard: RTDB "empty" is the hardware truth — wipe donation from dashboard
          ...(occState === "empty" ? { activeDonation: undefined } : {})
        }
      });
    });

    // Telemetry subscription — drives metrics panel with live sensor readings
    const unsubTelemetry = subscribeTelemetry(mac, (rtdbTelemetry) => {
      if (!rtdbTelemetry) return;
      const domainTel = rtdbToDomainTelemetry(rtdbTelemetry);

      const patchData: any = { telemetry: domainTel };

      // If the edge-ML pipeline pushed predictions, update quality + deadline
      if (rtdbTelemetry.daysRemaining !== undefined && rtdbTelemetry.safetyClass !== undefined) {
        const hoursLeft    = rtdbTelemetry.daysRemaining * 24.0;
        const qualityScore = rtdbTelemetry.safetyClass === 0 ? "fresh"
                           : rtdbTelemetry.safetyClass === 1 ? "aging"
                           : "spoilt";
        const deadline = {
          hoursRemaining: hoursLeft,
          absoluteIso:    new Date(Date.now() + hoursLeft * 3600000).toISOString()
        };

        patchData.foodQualityScore = qualityScore;
        patchData.deadlineEstimate = deadline;
        if (rtdbTelemetry.safetyScore !== undefined) {
          patchData.telemetry = { ...domainTel, safetyScore: rtdbTelemetry.safetyScore };
        }

        // Propagate quality/deadline into the active donation record too
        const cur = stateRef.current.lockers.find(l => l.lockerId === HARDWARE_LOCKER_ID);
        if (cur?.activeDonation) {
          patchData.activeDonation = {
            ...cur.activeDonation,
            latestQualityScore: qualityScore,
            deadlineEstimate:   deadline
          };
        }
      }

      dispatch({ type: "patch-locker", id: HARDWARE_LOCKER_ID, locker: patchData });
    });

    return () => {
      unsubStatus();
      unsubTelemetry();
    };
  }, [state.hardwareMac, state.hasCompletedPairing]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppContextProvider value={value}>{children}</AppContextProvider>;
}
