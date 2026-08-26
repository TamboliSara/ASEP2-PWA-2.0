import { useEffect, useMemo, useReducer, useRef } from "react";
import type { PropsWithChildren } from "react";
import { AppContextProvider } from "./AppContext";
import { appReducer, initialAppState, HARDWARE_LOCKER_ID } from "./appState";
import { syncInitialState } from "../services/initialSync";
import { subscribeStatus, subscribeTelemetry, subscribeAllTelemetry, rtdbToDomainTelemetry } from "../services/rtdb";
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

    if (!saved) {
      return {
        ...defaultState,
        hasCompletedPairing: hasPaired,
        hardwareMac: savedMac,
        lockers: defaultState.lockers.map(l => l.lockerId === HARDWARE_LOCKER_ID ? { ...l, bleConnected: hasPaired, pairedDeviceName: hasPaired ? (savedMac ? `EcoLocker ${savedMac}` : "EcoLocker ESP32-S3") : l.pairedDeviceName } : l)
      };
    }

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
        lockers: defaultState.lockers.map(l => l.lockerId === HARDWARE_LOCKER_ID ? { ...l, bleConnected: hasPaired, pairedDeviceName: hasPaired ? (savedMac ? `EcoLocker ${savedMac}` : "EcoLocker ESP32-S3") : l.pairedDeviceName } : l),
        isAdminAuthenticated: false
      };
    } catch {
      return {
        ...defaultState,
        hasCompletedPairing: hasPaired,
        hardwareMac: savedMac,
        lockers: defaultState.lockers.map(l => l.lockerId === HARDWARE_LOCKER_ID ? { ...l, bleConnected: hasPaired, pairedDeviceName: hasPaired ? (savedMac ? `EcoLocker ${savedMac}` : "EcoLocker ESP32-S3") : l.pairedDeviceName } : l)
      };
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

  // Live telemetry pulse & jitter for mock chambers only (2-8) — Chamber 1 uses 100% real ESP32 hardware telemetry
  useEffect(() => {
    const interval = setInterval(() => {
      stateRef.current.lockers.forEach(locker => {
        if (locker.lockerId === HARDWARE_LOCKER_ID) return; // Chamber 1 is backed by physical ESP32
        const curTel = locker.telemetry;
        const baseTemp = (curTel.internalTempC && curTel.internalTempC > 0) ? curTel.internalTempC : 4.8;
        const baseHum  = (curTel.humidityPct && curTel.humidityPct > 0) ? curTel.humidityPct : 61.0;
        const baseGas  = (curTel.gasResistanceOhms && curTel.gasResistanceOhms > 0) ? curTel.gasResistanceOhms : 18230;
        const basePres = (curTel.pressureHpa && curTel.pressureHpa > 500) ? curTel.pressureHpa : 1013.2;

        if (!locker.activeDonation) {
          const jitterTemp = (Math.random() * 0.4) - 0.2;
          const jitterHum  = (Math.random() * 2) - 1;
          const jitterGas  = (Math.random() * 500) - 250;
          const jitterPres = (Math.random() * 0.6) - 0.3;

          dispatch({
            type: "patch-locker",
            id: locker.lockerId,
            locker: {
              telemetry: {
                ...curTel,
                internalTempC:     Number(Math.max(1, baseTemp + jitterTemp).toFixed(1)),
                humidityPct:       Number(Math.max(10, Math.min(99, baseHum + jitterHum)).toFixed(1)),
                gasResistanceOhms: Number(Math.max(1000, baseGas + jitterGas).toFixed(0)),
                pressureHpa:       Number((basePres + jitterPres).toFixed(1)),
                distanceCm:        curTel.distanceCm != null && curTel.distanceCm > 0 ? curTel.distanceCm : 32.4,
                timestamp:         new Date().toISOString()
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

        // ── RTDB is ground truth — read its current occupancy first ──────────
        // Firestore can have stale "occupied" data from a previous session.
        // We MUST cross-check RTDB before restoring a donation, so the physical
        // hardware state always wins.
        const rtdbLocker = stateRef.current.lockers.find(l => l.lockerId === HARDWARE_LOCKER_ID);
        const rtdbSaysOccupied = rtdbLocker?.occupancyState === "occupied" || rtdbLocker?.occupancyState === "spoiled";

        // ── Occupied: restore donation only if RTDB also confirms occupied ──
        if ((fsOccupancy === "occupied" || fsOccupancy === "spoiled") && hasDonation && rtdbSaysOccupied) {
          const qualityScore = rtdbLocker?.foodQualityScore ?? (data?.item?.latestQualityScore ?? "fresh");
          const deadline     = rtdbLocker?.deadlineEstimate ?? (data?.prediction?.deadlineEstimate ?? {
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

        // ── Firestore says occupied but RTDB says empty → hardware wins, clear it ──
        else if ((fsOccupancy === "occupied" || fsOccupancy === "spoiled") && !rtdbSaysOccupied) {
          console.log("[AppProviders] ⚠️ Firestore says occupied but RTDB says empty — trusting hardware, clearing donation.");
          dispatch({
            type: "patch-locker",
            id: HARDWARE_LOCKER_ID,
            locker: { activeDonation: undefined, occupancyState: "empty" }
          });
        }

        // ── Empty: both agree locker is vacant ───────────────────────────────
        else if (fsOccupancy === "empty") {
          const cur = stateRef.current.lockers.find(l => l.lockerId === HARDWARE_LOCKER_ID);
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

  // ── RTDB: Live hardware status + telemetry for Safe 1 (Continuous) ─────────
  useEffect(() => {
    // 1. Subscribe to all telemetry nodes on RTDB so any live ESP32 stream is captured
    const unsubAll = subscribeAllTelemetry((mac, rtdbTelemetry) => {
      if (!rtdbTelemetry) return;
      const domainTel = rtdbToDomainTelemetry(rtdbTelemetry);
      console.log(`[AppProviders] 📡 Live RTDB Telemetry from ${mac}: ${domainTel.internalTempC}°C, ${domainTel.humidityPct}%, ${domainTel.gasResistanceOhms}Ω`);

      const patchData: any = { 
        telemetry: domainTel,
        bleConnected: true,
        lastSyncedAt: new Date().toISOString()
      };

      if (mac && mac !== "chamber-1" && mac !== "SIMULATED" && !stateRef.current.hardwareMac) {
        dispatch({ type: "set-hardware-mac", mac });
      }

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

    // 2. Status subscription for physical door and lock states
    const targetMac = state.hardwareMac && state.hardwareMac !== "SIMULATED" ? state.hardwareMac : HARDWARE_LOCKER_ID;
    const unsubStatus = subscribeStatus(targetMac, (rtdbStatus) => {
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
          ...(occState === "empty" ? { activeDonation: undefined } : {})
        }
      });
    });

    return () => {
      unsubAll();
      unsubStatus();
    };
  }, [state.hardwareMac]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppContextProvider value={value}>{children}</AppContextProvider>;
}
