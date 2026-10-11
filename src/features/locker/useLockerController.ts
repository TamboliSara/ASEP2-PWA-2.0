import { useMemo, useState, useRef, useEffect } from "react";
import { bleService } from "../../services/ble";
import { cacheAlert, cacheDonation, cacheEvent, cacheLockerSnapshot, cachePredictionSnapshot, cacheSensorSnapshot, clearAllData, enqueueSync } from "../../services/db";
import { initiateDepositFn, initiateRetrievalFn, db, chamberCameraRef } from "../../services/firebase";
import { get } from "firebase/database";
import { yoloVisionEngine } from "../camera/yoloVisionEngine";
import { registerDevice, unlockLocker, adminUnlockLocker, lockLocker, spoilageLockLocker, sanitizeLocker, getOccupancy, getDeviceTelemetry, updateDeviceStatus, setDeviceFoodType } from "../../services/rtdb";
import { processSyncQueue, syncAlert, syncDonation, syncEvent, syncPrediction, syncRetrieval, syncSensorSnapshot, syncSnapshot, triggerAlertEmail } from "../../services/sync";
import { syncInitialState } from "../../services/initialSync";
import { initialAppState, buildFreshInitialState, HARDWARE_LOCKER_ID } from "../../store/appState";

import { collection, getDocs, deleteDoc, doc as firestoreDoc } from "firebase/firestore";
import { useAppContext } from "../../store/AppContext";
import { useTranslation } from "../../store/useTranslation";
import { sampleAlert, sampleDonation, sampleLockerState } from "../../utils/mockData";
import { generateMockReadings, persistMockReadings, clearMockReadings } from "../../utils/mockTelemetry";
import type { AlertRecord, DonationRecord, LockerEvent, PredictionSnapshot, SensorSnapshot } from "../../types/domain";

const generateId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));

const withTimeout = <T>(promise: Promise<T>, ms: number = 3000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
  ]);
};

function createSyncRecord(entityType: "donation" | "event" | "alert" | "snapshot" | "sensorSnapshot" | "prediction", entityId: string) {
  return {
    id: generateId(),
    entityType,
    entityId,
    status: "queued" as const,
    updatedAt: new Date().toISOString()
  };
}

function playAlarmSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const playBeep = (time: number, duration: number, frequency: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
      gain.gain.setValueAtTime(0.3, time + duration - 0.05);
      gain.gain.linearRampToValueAtTime(0, time + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(time);
      osc.stop(time + duration);
    };
    const now = audioCtx.currentTime;
    playBeep(now, 0.2, 880);
    playBeep(now + 0.3, 0.2, 880);
    playBeep(now + 0.6, 0.2, 880);
  } catch (e) {
    console.error("Failed to play audio alarm:", e);
  }
}

export function useLockerController() {
  const { state, dispatch } = useAppContext();
  const latestStateRef = useRef(state);
  latestStateRef.current = state;
  const { t } = useTranslation();
  const [isBusy, setIsBusy] = useState(false);
  const manualConfirmRef = useRef(false);
  const wakeUpRef = useRef<(() => void) | null>(null);

  function confirmDepositManually() {
    console.log("[Deposit] 👆 User triggered manual food confirmation");
    manualConfirmRef.current = true;
    dispatch({ type: "set-sync-message", message: "✓ Food confirmed! Securing chamber..." });
    if (wakeUpRef.current) {
      wakeUpRef.current();
    }
  }

  const currentLocker = useMemo(() => {
    return state.lockers.find((l) => l.lockerId === state.selectedLockerId) || state.lockers[0];
  }, [state.lockers, state.selectedLockerId]);

  /** Is the currently selected locker backed by real hardware? */
  const isHardwareLocker = currentLocker.lockerId === HARDWARE_LOCKER_ID;

  /** MAC address for sending RTDB commands to the real ESP32 */
  const hardwareMac = state.hardwareMac || undefined;

  function buildRecommendedActions() {
    const quality = currentLocker.foodQualityScore;
    if (quality === "spoilt") {
      return [
        "Notify admin and cleaning staff immediately.",
        "Reuse safely where possible: turn spoiled milk into paneer only if handled within safe spoilage limits.",
        "Compost rotten produce and separate packaging for recycling."
      ];
    }

    if (quality === "aging") {
      return [
        "Prioritize pickup within the next cycle.",
        "Move to quick community use such as shared meals or redistribution.",
        "Monitor humidity and gas buildup before the next unlock."
      ];
    }

    return [
      "Locker is safe for normal community pickup.",
      "Keep the chamber sealed until collection.",
      "Continue periodic sensor logging for fleet records."
    ];
  }

  async function selectLocker(id: string) {
    dispatch({ type: "select-locker", id });
  }

  async function pairLocker(): Promise<boolean> {
    setIsBusy(true);
    dispatch({ type: "set-sync-message", message: "Initiating device pairing..." });

    try {
      // Step 1: Real BLE pairing (opens browser Bluetooth picker if BLE supported)
      dispatch({ type: "set-sync-message", message: "Searching for EcoLocker hardware..." });
      const paired = await bleService.pair();

      // Step 2: Store the MAC address so all future RTDB commands reach the hardware
      if (paired.macAddress && paired.macAddress !== "SIMULATED") {
        dispatch({ type: "set-hardware-mac", mac: paired.macAddress });
        console.log(`[Pair] 🔒 Hardware MAC registered: ${paired.macAddress}`);
      }

      // Step 3: Register device in Firebase RTDB (creates telemetry/commands/status slots)
      dispatch({ type: "set-sync-message", message: "Registering device in cloud..." });
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Register under chamber-1 (PWA internal ID) AND under the real MAC address
      const registered = await registerDevice(
        HARDWARE_LOCKER_ID,
        paired.deviceName,
        paired.macAddress !== "SIMULATED" ? paired.macAddress : undefined
      );

      if (registered) {
        console.log(`[Pair] ✅ Device ${HARDWARE_LOCKER_ID} registered in RTDB (MAC: ${paired.macAddress})`);
      } else {
        console.warn(`[Pair] ⚠️ RTDB registration skipped — operating in offline mode`);
      }

      // Step 4: Sync locker snapshot to Firestore
      dispatch({ type: "set-sync-message", message: "Syncing locker state..." });
      await syncSnapshot({
        ...currentLocker,
        bleConnected: true,
        pairedDeviceName: paired.deviceName,
        lastSyncedAt: new Date().toISOString()
      });

      // Step 5: Update local state
      dispatch({
        type: "patch-locker",
        id: HARDWARE_LOCKER_ID,
        locker: {
          bleConnected:     true,
          pairedDeviceName: paired.deviceName,
          lastSyncedAt:     new Date().toISOString()
        }
      });
      
      const pairEvent: LockerEvent = {
        id: generateId(),
        lockerId: HARDWARE_LOCKER_ID,
        type: "pairing",
        createdAt: new Date().toISOString(),
        detail: paired.isRealHardware
          ? `Real hardware paired: ${paired.deviceName} (MAC: ${paired.macAddress}). Firebase RTDB armed.`
          : `Simulation mode active. 7 mock chambers ready. Connect hardware to enable physical control.`,
        syncState: "synced"
      };
      dispatch({ type: "append-log", event: pairEvent });
      try { await syncEvent(pairEvent); } catch {}

      dispatch({ type: "set-pairing-complete", value: true });

      const statusMsg = paired.isRealHardware
        ? `📡 Hardware connected (${paired.macAddress}). 7 mock chambers ready.`
        : `🔁 Simulation mode — no physical hardware detected. All 8 chambers are mock.`;
      dispatch({ type: "set-sync-message", message: statusMsg });
      return true;
    } catch (error) {
      const err = error as Error;
      if (err.name === "NotFoundError") {
        // User cancelled the BLE picker — don't pair in sim mode, show message
        dispatch({ type: "set-sync-message", message: "Bluetooth pairing cancelled. Try again to connect hardware." });
        return false;
      }
      console.error("[Pair] Pairing failed:", error);
      dispatch({ type: "set-sync-message", message: "Pairing failed. Check connection and try again." });
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function pairWithMac(customMac?: string): Promise<boolean> {
    setIsBusy(true);
    dispatch({ type: "set-sync-message", message: "Registering hardware connection..." });
    const cleanMac = customMac && customMac.trim() ? customMac.trim().replace(/[^A-Fa-f0-9]/g, "").toUpperCase() : "";
    const mac = cleanMac || (state.hardwareMac && state.hardwareMac !== "SIMULATED" ? state.hardwareMac : "SIMULATED");
    const deviceName = mac !== "SIMULATED" ? `EcoLocker ${mac}` : "EcoLocker ESP32-S3";

    try {
      if (mac !== "SIMULATED") {
        dispatch({ type: "set-hardware-mac", mac });
      }

      await registerDevice(HARDWARE_LOCKER_ID, deviceName, mac !== "SIMULATED" ? mac : undefined);

      await syncSnapshot({
        ...currentLocker,
        bleConnected: true,
        pairedDeviceName: deviceName,
        lastSyncedAt: new Date().toISOString()
      });

      dispatch({
        type: "patch-locker",
        id: HARDWARE_LOCKER_ID,
        locker: {
          bleConnected: true,
          pairedDeviceName: deviceName,
          lastSyncedAt: new Date().toISOString()
        }
      });

      const pairEvent: LockerEvent = {
        id: generateId(),
        lockerId: HARDWARE_LOCKER_ID,
        type: "pairing",
        createdAt: new Date().toISOString(),
        detail: mac !== "SIMULATED"
          ? `Hardware armed via Cloud RTDB: ${deviceName} (MAC: ${mac}).`
          : `Simulation mode activated for all 8 chambers.`,
        syncState: "synced"
      };
      dispatch({ type: "append-log", event: pairEvent });
      try { await syncEvent(pairEvent); } catch {}

      dispatch({ type: "set-pairing-complete", value: true });
      dispatch({
        type: "set-sync-message",
        message: mac !== "SIMULATED" ? `📡 Hardware connected (${mac}). System armed.` : `🔁 Simulation mode active.`
      });
      return true;
    } catch (e) {
      console.error("[Pair] Manual pair error:", e);
      dispatch({ type: "set-pairing-complete", value: true });
      return true;
    } finally {
      setIsBusy(false);
    }
  }

  async function reconnectLocker() {
    setIsBusy(true);
    const connected = await bleService.reconnect();
    dispatch({ type: "patch-locker", id: currentLocker.lockerId, locker: { bleConnected: connected } });
    dispatch({ type: "set-sync-message", message: connected ? t("bleReconnectSuccess") : t("bleReconnectFailure") });
    
    // Log BLE Reset to activity
    const bleEvent: LockerEvent = {
      id: generateId(),
      lockerId: currentLocker.lockerId,
      type: "ble_reset",
      createdAt: new Date().toISOString(),
      detail: connected ? "BLE bridge reset successfully. Device reconnected." : "BLE bridge reset attempted. Reconnection failed.",
      syncState: "synced"
    };
    dispatch({ type: "append-log", event: bleEvent });
    try { await syncEvent(bleEvent); } catch {}
    setIsBusy(false);
  }

  async function submitDeposit(imageData?: string) {
    if (currentLocker.activeDonation) {
      dispatch({ type: "set-sync-message", message: "Unit already occupied. Only 1 item allowed." });
      return null;
    }
    setIsBusy(true);

    // Derive locker number from its position in the kiosk (1-indexed)
    const lockerIndex = state.lockers.findIndex(l => l.lockerId === currentLocker.lockerId);
    const lockerNumber = lockerIndex >= 0 ? lockerIndex + 1 : 1;

    const donation: DonationRecord = {
      ...sampleDonation,
      id: generateId(),
      lockerId: currentLocker.lockerId,
      lockerNumber,
      foodName: state.donationDraft.foodName || sampleDonation.foodName,
      categoryId: state.donationDraft.categoryId ?? sampleDonation.categoryId,
      categoryLabel: state.donationDraft.categoryLabel || sampleDonation.categoryLabel,
      donorName: state.donationDraft.donorName || sampleDonation.donorName,
      donorContact: state.donationDraft.donorContact || sampleDonation.donorContact,
      allergensNotes: state.donationDraft.allergensNotes,
      dietTag: state.donationDraft.dietTag,
      isPhoneVerified: state.donationDraft.isPhoneVerified ?? false,
      otpVerifiedAt: state.donationDraft.otpVerifiedAt,
      phoneIp: state.donationDraft.phoneIp,
      createdAt: new Date().toISOString(),
      donorImageBase64: imageData,
      donorImageUrl: undefined, // never use the mock placeholder — real image comes from Storage upload
      syncState: "queued"
    };

    // Generate unique mock telemetry for this deposit and persist it
    const mockReadings = generateMockReadings(donation.id, "fresh");
    persistMockReadings(donation.id, mockReadings);
    donation.deadlineEstimate = mockReadings.deadlineEstimate;
    donation.latestQualityScore = mockReadings.qualityScore;

    const sensorSnapshot: SensorSnapshot = {
      id: generateId(),
      lockerId: currentLocker.lockerId,
      donationId: donation.id,
      capturedAt: new Date().toISOString(),
      telemetry: mockReadings.telemetry,
      source: "deposit"
    };
    const predictionSnapshot: PredictionSnapshot = {
      id: generateId(),
      lockerId: currentLocker.lockerId,
      donationId: donation.id,
      capturedAt: new Date().toISOString(),
      qualityScore: mockReadings.qualityScore,
      deadlineEstimate: mockReadings.deadlineEstimate,
      heuristicGasProfile: mockReadings.telemetry.heuristicGasProfile,
      recommendedActions: buildRecommendedActions(),
      source: "deposit"
    };

    try {
      try {
        await bleService.sendCategory({
          foodName: donation.foodName,
          categoryId: donation.categoryId,
          categoryLabel: donation.categoryLabel,
          donorName: donation.donorName,
          donorContact: donation.donorContact,
          allergensNotes: donation.allergensNotes,
          dietTag: donation.dietTag
        });
      } catch (e) {
        console.warn("[Deposit] Category send failed:", e);
      }

      if (isHardwareLocker) {
        // ── REAL HARDWARE LOCKER FLOW ─────────────────────────────
        console.log(`[Deposit] 🔒 Sending UNLOCK to hardware (MAC: ${hardwareMac})...`);
        dispatch({ type: "set-sync-message", message: "Opening physical locker... please place food inside." });

        // Write active food type to RTDB status node so ESP32 edge ML reads it
        const label = donation.categoryLabel.toLowerCase();
        const foodTypeKey = label.includes("meat") ? "cooked_meat"
                          : label.includes("dairy") || label.includes("milk") ? "dairy"
                          : label.includes("fruit") ? "fruit"
                          : label.includes("roti") || label.includes("yeast") ? "roti"
                          : label.includes("vegetable") || label.includes("veg") ? "vegetable"
                          : "dairy";
        
        await setDeviceFoodType(HARDWARE_LOCKER_ID, foodTypeKey, hardwareMac);
        // Persist food type so AppProviders can reconstruct the donation on reload
        try { localStorage.setItem("ecolocker-last-food-type", foodTypeKey); } catch {}

        // Listen for live BLE notifications (e.g. OCCUPIED)
        let bleOccupied = false;
        const unsubBle = bleService.onNotification((msg) => {
          if (msg === "OCCUPIED") {
            console.log("[Deposit] 📶 BLE notification: OCCUPIED detected");
            bleOccupied = true;
          }
        });

        // Send single unlock to RTDB & BLE (ESP32 will pick it up and open the solenoid)
        const targetMac = (hardwareMac && hardwareMac !== "SIMULATED" && hardwareMac !== "OFFLINE")
          ? hardwareMac
          : "E8F60A893D4C";

        // Priority 1: Instant local Bluetooth command (fires in <15ms)
        bleService.sendUnlock().catch(() => {});
        // Priority 2: Direct parallel REST push to Cloud RTDB
        await unlockLocker(HARDWARE_LOCKER_ID, targetMac);
        const unlockEvent = await bleService.unlock().catch(() => ({
          id: generateId(),
          lockerId: HARDWARE_LOCKER_ID,
          type: "unlock",
          createdAt: new Date().toISOString(),
          detail: "Unlocked physical door.",
          syncState: "synced"
        } as LockerEvent));

        // ── INTELLIGENT DEPOSIT & ULTRASONIC VERIFICATION LOOP ──────────────
        // 1. Solenoid unlocks cleanly on the first pulse without conflicting second unlocks.
        // 2. Polls RTDB occupancy, ultrasonic distanceCm, and BLE notifications over a 25s window.
        // 3. Sensor threshold calibrated: empty chamber is ~36.5cm. Any item >= 2.0cm tall
        //    reduces measured distance to <= 34.5cm (solving the 22.0cm false rejection bug).
        // 4. Immediately confirms deposit as soon as food presence is registered.
        manualConfirmRef.current = false;
        let isFoodConfirmed = false;
        const TOTAL_WAIT_MS = 30000; // 30s generous window for human donor
        const loopStart = Date.now();
        const baselineDist = (currentLocker.telemetry?.distanceCm && currentLocker.telemetry.distanceCm > 1.0)
          ? currentLocker.telemetry.distanceCm
          : 36.5;

        while (Date.now() - loopStart < TOTAL_WAIT_MS) {
          if (manualConfirmRef.current) {
            console.log("[Deposit] ✅ Immediate manual confirmation detected!");
            isFoodConfirmed = true;
            break;
          }

          const elapsed = Date.now() - loopStart;
          const remainingSec = Math.max(1, Math.ceil((TOTAL_WAIT_MS - elapsed) / 1000));

          // Read latest sensor data from hardware & direct cloud camera state
          const [occupancy, telemetry, camSnap] = await Promise.all([
            getOccupancy(targetMac).catch(() => null),
            getDeviceTelemetry(targetMac).catch(() => null),
            get(chamberCameraRef(HARDWARE_LOCKER_ID)).catch(() => null)
          ]);

          if (manualConfirmRef.current) {
            console.log("[Deposit] ✅ Immediate manual confirmation detected after sensor check!");
            isFoodConfirmed = true;
            break;
          }

          const dist = telemetry?.distanceCm;
          const distStr = typeof dist === "number" && dist > 0 && dist < 400 ? `${dist.toFixed(1)} cm` : "Scanning...";

          // ── Multi-Tier Food Detection Verification: React State + Phone RTDB + Frame Vision ──
          const activeLocker = latestStateRef.current.lockers.find(l => l.lockerId === HARDWARE_LOCKER_ID);
          const cam = activeLocker?.cameraTelemetry;
          const camRtdb = camSnap?.val();

          // 1. Direct camera confirmation from live React state
          let cameraConfirmed = Boolean(cam?.isFoodPresent && (cam?.confidence ?? 0) >= 0.45);
          let detectedLabel = cam?.detectedObjects?.[0]?.label;

          // 2. Direct camera confirmation from phone's RTDB packet
          if (!cameraConfirmed && camRtdb?.isFoodPresent) {
            cameraConfirmed = true;
            detectedLabel = camRtdb.detectedLabel || "Donated Food Item";
          }

          // 3. Fallback direct image frame inference
          if (!cameraConfirmed && camRtdb?.latestFrame && typeof camRtdb.latestFrame === "string") {
            try {
              const img = new Image();
              img.src = camRtdb.latestFrame;
              await new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 60); });
              if (img.complete && img.naturalWidth > 0) {
                const res = await yoloVisionEngine.analyzeFrame(img);
                if (res.isFoodPresent) {
                  cameraConfirmed = true;
                  detectedLabel = res.detectedObjects?.[0]?.label || "Donated Food Item";
                }
              }
            } catch {}
          }

          const ultrasonicBackupConfirmed = typeof dist === "number" && dist > 1.0 && dist < 34.0;
          const occupancyConfirmed = occupancy === "occupied";
          const manualConfirmed = manualConfirmRef.current;

          const detectionLabel = cameraConfirmed
            ? `AI Vision: ${detectedLabel || "Food Item"} (${Math.round((cam?.confidence || 0.95) * 100)}%)`
            : `Sensor Backup: ${distStr}`;

          if (elapsed < 3000) {
            dispatch({
              type: "set-sync-message",
              message: `Door unlocked! Place food inside (${remainingSec}s)... [${detectionLabel}]`
            });
          } else {
            dispatch({
              type: "set-sync-message",
              message: `Food detected! Verifying seal (${remainingSec}s)... [${detectionLabel}]`
            });
          }

          // Fast & seamless auto-confirmation (after at least 1.2s so user can place item)
          const canAutoConfirm = elapsed >= 1200;

          console.log(`[Deposit Poll] Elapsed: ${(elapsed / 1000).toFixed(1)}s, Cam: ${cameraConfirmed} (${detectedLabel}), DistBackup: ${ultrasonicBackupConfirmed}, Occupancy: "${occupancy}", canAutoConfirm: ${canAutoConfirm}`);

          if (manualConfirmed || (canAutoConfirm && (cameraConfirmed || ultrasonicBackupConfirmed || occupancyConfirmed || bleOccupied))) {
            const confirmedBy = cameraConfirmed 
              ? `Chamber AI Optical Vision (${detectedLabel || 'Food Verified'})` 
              : (ultrasonicBackupConfirmed ? `Ultrasonic Sensor Backup (${dist}cm)` : "Hardware Sensor");
            console.log(`[Deposit] ✅ Food presence confirmed via ${confirmedBy}!`);
            isFoodConfirmed = true;

            // Enrich donation record with real AI vision results
            if (detectedLabel) {
              donation.foodName = state.donationDraft.foodName || detectedLabel;
              donation.categoryLabel = detectedLabel;
            }
            if (cam?.lastSnapshotUrl || camRtdb?.latestFrame) {
              donation.chamberFoodImageUrl = cam?.lastSnapshotUrl || camRtdb?.latestFrame;
            }
            donation.visualFreshnessScore = cam?.visualFreshnessScore || 95;
            break;
          }

          // Abortable sleep: if user taps manual confirm, wakes up immediately!
          await new Promise<void>(resolve => {
            const timer = setTimeout(resolve, 500);
            wakeUpRef.current = () => {
              clearTimeout(timer);
              resolve();
            };
          });
        }

        unsubBle();

        if (!isFoodConfirmed) {
          // Play buzzer alarm
          playAlarmSound();

          // Show in-app alert (replaces native browser popup)
          const ghostAlertId = generateId();
          dispatch({
            type: "push-alert",
            alert: {
              id: ghostAlertId,
              lockerId: HARDWARE_LOCKER_ID,
              title: "No Food Detected — Deposit Cancelled",
              detail: "The chamber camera vision system and backup sensor did not detect food in the chamber after 30 seconds. The locker has been automatically re-locked. Please ensure food is placed inside and try again.",
              severity: "warning" as const,
              createdAt: new Date().toISOString()
            }
          });

          // Cancel the deposit and inform the user
          console.warn("[Deposit] ⚠️ No food detected after extended cycle. Cancelling deposit.");
          dispatch({
            type: "set-sync-message",
            message: "⚠️ No food was detected inside the locker. The door has been re-locked. Please try again."
          });
          dispatch({
            type: "patch-locker",
            id: HARDWARE_LOCKER_ID,
            locker: {
              activeDonation: undefined, // Explicitly clear any stale donation so receiver dashboard stays clean
              occupancyState: "empty",
              lockState: "locked",
              doorState: "closed"
            }
          });
          // Log the failed deposit attempt
          const failEvent: LockerEvent = {
            id: generateId(),
            lockerId: HARDWARE_LOCKER_ID,
            type: "timeout",
            createdAt: new Date().toISOString(),
            detail: "Donor opened locker but no food was detected. Deposit cancelled. Door auto-locked.",
            syncState: "synced"
          };
          dispatch({ type: "append-log", event: failEvent });
          try { await syncEvent(failEvent); } catch {}
          setIsBusy(false);
          return null;
        }

        dispatch({ type: "set-sync-message", message: "Food verified! Securing chamber..." });

        // Food confirmed! Fire lock & status updates in parallel without blocking UI
        lockLocker(HARDWARE_LOCKER_ID, targetMac).catch(() => {});
        updateDeviceStatus(HARDWARE_LOCKER_ID, {
          lock_state: "locked",
          door_state: "closed",
          occupancy: "occupied"
        }).catch(() => {});
        if (targetMac !== HARDWARE_LOCKER_ID) {
          updateDeviceStatus(targetMac, {
            lock_state: "locked",
            door_state: "closed",
            occupancy: "occupied"
          }).catch(() => {});
        }
        bleService.lock().catch(() => {});
        sanitizeLocker(HARDWARE_LOCKER_ID, targetMac).catch(() => {});
        bleService.startSanitization().catch(() => {});

        const lockEvent: LockerEvent = {
          id: generateId(),
          lockerId: HARDWARE_LOCKER_ID,
          type: "lock",
          createdAt: new Date().toISOString(),
          detail: "Locked physical door.",
          syncState: "synced"
        };
        const cycleEvent: LockerEvent = {
          id: generateId(),
          lockerId: HARDWARE_LOCKER_ID,
          type: "cycle_complete",
          createdAt: new Date().toISOString(),
          detail: "Sanitization started.",
          syncState: "synced"
        };

        const events: LockerEvent[] = [unlockEvent, lockEvent, cycleEvent];

        // Now commit local updates immediately since food is physically confirmed
        const liveTel = currentLocker.telemetry;
        dispatch({
          type: "patch-locker",
          id: currentLocker.lockerId,
          locker: {
            activeDonation: donation,
            occupancyState: "occupied",
            lockState: "locked",
            doorState: "closed",
            sanitizationState: "complete",
            foodQualityScore: mockReadings.qualityScore,
            deadlineEstimate: mockReadings.deadlineEstimate,
            telemetry: (isHardwareLocker && liveTel && liveTel.internalTempC > 0)
              ? { ...liveTel }
              : {
                ...mockReadings.telemetry,
                ...(liveTel && liveTel.internalTempC > 10 ? {
                  internalTempC: liveTel.internalTempC,
                  externalTempC: liveTel.externalTempC,
                  humidityPct: liveTel.humidityPct,
                  pressureHpa: liveTel.pressureHpa,
                  gasResistanceOhms: liveTel.gasResistanceOhms,
                  distanceCm: liveTel.distanceCm
                } : {})
              },
            lastSyncedAt: new Date().toISOString()
          }
        });
        dispatch({ type: "record-donation", donation });
        dispatch({ type: "reset-donation-draft" });
        dispatch({ type: "set-sync-message", message: `✅ Food detected and locker secured! Deposit recorded.` });

        // Update sensorSnapshot with live hardware telemetry before sync
        if (isHardwareLocker && liveTel && liveTel.internalTempC > 0) {
          sensorSnapshot.telemetry = { ...liveTel };
        }

        // Fire background persistence & sync without blocking UI navigation
        syncDonation(donation, sensorSnapshot, predictionSnapshot).catch(e => {
          console.warn("[Deposit] Immediate sync failed, falling back to queue:", e);
        });

        if (initiateDepositFn) {
          initiateDepositFn({
            mac_address: hardwareMac ?? HARDWARE_LOCKER_ID,
            item_name: donation.foodName,
            dietary_tags: donation.dietTag ? [donation.dietTag] : [],
            quantity: 1,
            donor_name: donation.donorName,
            donor_contact: donation.donorContact,
            allergens_notes: donation.allergensNotes,
            category_label: donation.categoryLabel,
            locker_number: lockerNumber
          }).catch(e => {
            console.error("Cloud function initiateDeposit failed (non-blocking):", e);
          });
        }

        cacheDonation(donation).catch(() => {});
        enqueueSync(createSyncRecord("donation", donation.id)).catch(() => {});
        cacheSensorSnapshot(sensorSnapshot).catch(() => {});
        enqueueSync(createSyncRecord("sensorSnapshot", sensorSnapshot.id)).catch(() => {});
        cachePredictionSnapshot(predictionSnapshot).catch(() => {});
        enqueueSync(createSyncRecord("prediction", predictionSnapshot.id)).catch(() => {});
        for (const event of events) {
          cacheEvent(event).catch(() => {});
          enqueueSync(createSyncRecord("event", event.id)).catch(() => {});
          dispatch({ type: "append-log", event });
        }

        // If quality is already spoilt, enforce physical lockdown
        if (donation.latestQualityScore === "spoilt") {
          console.warn("[Deposit] 🚨 Food quality is already spoilt — triggering spoilage lockdown.");
          await spoilageLockLocker(HARDWARE_LOCKER_ID, hardwareMac);
          await bleService.sendLock();
        }
      } else {
        // ── MOCK LOCKER FLOW (Chambers 2-8) ───────────────────────
        const unlockEvent = await bleService.unlock();
        const lockEvent   = await bleService.lock();
        const cycleEvent  = await bleService.startSanitization();
        const events: LockerEvent[] = [unlockEvent, lockEvent, cycleEvent];

        dispatch({
          type: "patch-locker",
          id: currentLocker.lockerId,
          locker: {
            activeDonation: donation,
            occupancyState: "occupied",
            lockState: "locked",
            doorState: "closed",
            sanitizationState: "complete",
            foodQualityScore: mockReadings.qualityScore,
            deadlineEstimate: mockReadings.deadlineEstimate,
            telemetry: mockReadings.telemetry,
            lastSyncedAt: new Date().toISOString()
          }
        });
        dispatch({ type: "record-donation", donation });
        dispatch({ type: "reset-donation-draft" });
        dispatch({ type: "set-sync-message", message: `${donation.foodName}: ${t("donationConfirmed")}` });

        // ── Immediate Sync to Firestore ──────────────────────────────────
        try {
          await syncDonation(donation, sensorSnapshot, predictionSnapshot);
        } catch (e) {
          console.warn("[Deposit] Immediate sync failed, falling back to queue:", e);
        }

        if (initiateDepositFn) {
          try {
            await withTimeout(initiateDepositFn({
              mac_address: currentLocker.lockerId,
              item_name: donation.foodName,
              dietary_tags: donation.dietTag ? [donation.dietTag] : [],
              quantity: 1,
              donor_name: donation.donorName,
              donor_contact: donation.donorContact,
              allergens_notes: donation.allergensNotes,
              category_label: donation.categoryLabel,
              locker_number: lockerNumber
            }));
          } catch (e) {
            console.error("Cloud function initiateDeposit failed (non-blocking):", e);
          }
        }

        await cacheDonation(donation);
        await enqueueSync(createSyncRecord("donation", donation.id));
        await cacheSensorSnapshot(sensorSnapshot);
        await enqueueSync(createSyncRecord("sensorSnapshot", sensorSnapshot.id));
        await cachePredictionSnapshot(predictionSnapshot);
        await enqueueSync(createSyncRecord("prediction", predictionSnapshot.id));
        for (const event of events) {
          await cacheEvent(event);
          await enqueueSync(createSyncRecord("event", event.id));
          dispatch({ type: "append-log", event });
        }
      }

      const depositEvent: LockerEvent = {
        id: generateId(),
        lockerId: currentLocker.lockerId,
        type: "lock",
        createdAt: new Date().toISOString(),
        detail: isHardwareLocker
          ? `[HARDWARE] Deposit confirmed: ${donation.foodName}. Chamber camera vision verified food presence (with ultrasonic backup). Chamber secured.`
          : `[MOCK] Deposit registered: ${donation.foodName}. Chamber sealed and secured.`,
        syncState: "synced"
      };
      dispatch({ type: "append-log", event: depositEvent });
      try { await syncEvent(depositEvent); } catch {}

      await cacheLockerSnapshot({
        ...currentLocker,
        activeDonation: donation,
        occupancyState: "occupied",
        lockState: "locked",
        doorState: "closed",
        sanitizationState: "complete",
        lastSyncedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("[Deposit] Error in deposit flow:", err);
      dispatch({ type: "set-sync-message", message: `${donation.foodName}: ${t("donationConfirmed")}` });
    } finally {
      setIsBusy(false);
    }

    return donation;
  }

  async function retrieveFood(skipSanitization = false, isAdminOverride = false, imageData?: string, faceDescriptor?: number[], adminCredentials?: string) {
    setIsBusy(true);

    const activeDonation = currentLocker.activeDonation;

    try {
      if (isHardwareLocker) {
        // ── REAL HARDWARE RETRIEVAL ────────────────────────────────
        console.log(`[Retrieve] 🔓 Sending UNLOCK to hardware for retrieval (MAC: ${hardwareMac})...`);
        dispatch({ type: "set-sync-message", message: "Opening physical locker for retrieval..." });

        if (isAdminOverride) {
          await adminUnlockLocker(HARDWARE_LOCKER_ID, hardwareMac);
          await bleService.sendAdminUnlock();
        } else {
          await unlockLocker(HARDWARE_LOCKER_ID, hardwareMac);
          await bleService.sendUnlock();
        }

        // Wait for ESP32 cycle
        await new Promise(resolve => setTimeout(resolve, 9000));

        // After retrieval, occupancy should be empty
        dispatch({ type: "set-sync-message", message: "Food retrieved. Re-locking chamber..." });
      } else {
        // ── MOCK RETRIEVAL ─────────────────────────────────────────
        await unlockLocker(currentLocker.lockerId);
      }

      const unlockEvent = await bleService.unlock().catch(() => ({ id: generateId(), type: "unlock", createdAt: new Date().toISOString(), detail: "Unlock", syncState: "synced" } as LockerEvent));
      await lockLocker(currentLocker.lockerId, isHardwareLocker ? hardwareMac : undefined);
      const lockEvent   = await bleService.lock().catch(() => ({ id: generateId(), type: "lock", createdAt: new Date().toISOString(), detail: "Lock", syncState: "synced" } as LockerEvent));

      let sensorSnapshotId = generateId();
      let predictionSnapshotId = generateId();

      const sensorSnapshot: SensorSnapshot = {
        id: sensorSnapshotId,
        lockerId: currentLocker.lockerId,
        donationId: activeDonation?.id,
        capturedAt: new Date().toISOString(),
        telemetry: currentLocker.telemetry,
        source: "retrieve"
      };
      const predictionSnapshot: PredictionSnapshot = {
        id: predictionSnapshotId,
        lockerId: currentLocker.lockerId,
        donationId: activeDonation?.id,
        capturedAt: new Date().toISOString(),
        qualityScore: currentLocker.foodQualityScore,
        deadlineEstimate: currentLocker.deadlineEstimate,
        heuristicGasProfile: currentLocker.telemetry?.heuristicGasProfile || ["Unknown"],
        recommendedActions: buildRecommendedActions(),
        source: "retrieve"
      };

      // Call Cloud Function if deployed
      if (initiateRetrievalFn) {
        try {
          await withTimeout(initiateRetrievalFn({ mac_address: currentLocker.lockerId }));
        } catch (e) {
          console.error("Cloud function initiateRetrieval failed (non-blocking):", e);
        }
      }

      // ── Sync retrieval to Firestore (donation update + retrievals collection) ──
      if (activeDonation) {
        const lockerIndex = state.lockers.findIndex(l => l.lockerId === currentLocker.lockerId);
        try {
          await syncRetrieval({
            id: generateId(),
            donationId: activeDonation.id,
            lockerId: currentLocker.lockerId,
            lockerNumber: lockerIndex >= 0 ? lockerIndex + 1 : 0,
            foodName: activeDonation.foodName,
            qualityScoreAtRetrieval: currentLocker.foodQualityScore,
            retrievedAt: new Date().toISOString(),
            retrievedBy: isAdminOverride ? "admin_override" : "receiver",
            skipSanitization,
            receiverImageBase64: imageData,
            faceDescriptor,
            adminOverride: isAdminOverride ? {
              adminCredentials: adminCredentials || "admin_superuser",
              overrideAt: new Date().toISOString()
            } : undefined
          });
        } catch (e) {
          console.warn("[Retrieve] Retrieval sync failed (non-blocking):", e);
        }

        // Clear persisted mock readings for this donation
        clearMockReadings(activeDonation.id);
      }

      // Start sanitization if needed
      if (!skipSanitization) {
        await sanitizeLocker(currentLocker.lockerId);
      }

      try {
        await cacheEvent(unlockEvent);
        await cacheEvent(lockEvent);
        await cacheSensorSnapshot(sensorSnapshot);
        await enqueueSync(createSyncRecord("sensorSnapshot", sensorSnapshot.id));
        await cachePredictionSnapshot(predictionSnapshot);
        await enqueueSync(createSyncRecord("prediction", predictionSnapshot.id));
      } catch(e) {
        console.warn("Local cache failed, skipping:", e);
      }
      
      dispatch({ type: "append-log", event: unlockEvent });
      dispatch({ type: "append-log", event: lockEvent });
      
      const retrievalEvent: LockerEvent = {
        id: generateId(),
        lockerId: currentLocker.lockerId,
        type: "unlock",
        createdAt: new Date().toISOString(),
        detail: `Item retrieved ${isAdminOverride ? "by Admin Override" : "by Receiver"}. Chamber vacated.`,
        syncState: "synced"
      };
      dispatch({ type: "append-log", event: retrievalEvent });
      try { await syncEvent(retrievalEvent); } catch {}

    } catch (err) {
      console.error("[Retrieve] CRITICAL ERROR during retrieval flow:", err);
      dispatch({ type: "set-sync-message", message: `⚠️ Force override encountered an error, but locker was safely cleared.` });
    } finally {
      // ALWAYS PATCH LOCKER TO EMPTY NO MATTER WHAT
      dispatch({
        type: "patch-locker",
        id: currentLocker.lockerId,
        locker: {
          activeDonation: undefined, // Explicitly clear donation
          occupancyState: "empty",
          sanitizationState: "complete",
          doorState: "closed",
          lockState: "locked",
          foodQualityScore: "fresh",
          faultState: "none"
        }
      });
      
      // Also forcibly update the root state to ensure donation is wiped if patch-locker spread fails (fallback)
      dispatch({ type: "set-sync-message", message: `SAFE ${currentLocker.lockerId.split('-')[1]?.toUpperCase() || '1'} CLEARED: Access cycle complete.` });

      // Sync the now-empty locker state to Firestore
      try {
        await syncSnapshot({
          ...currentLocker,
          activeDonation: undefined,
          occupancyState: "empty",
          sanitizationState: skipSanitization ? "complete" : "running",
          doorState: "closed",
          lockState: "locked",
          foodQualityScore: "fresh",
          faultState: "none",
          lastSyncedAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn("[Retrieve] Post-retrieval locker snapshot sync failed:", e);
      }

      setIsBusy(false);
    }
  }

  async function triggerMaintenanceLockdown() {
    const alert: AlertRecord = {
      ...sampleAlert,
      id: generateId(),
      lockerId: currentLocker.lockerId,
      createdAt: new Date().toISOString()
    };

    await cacheAlert(alert);
    await enqueueSync(createSyncRecord("alert", alert.id));
    dispatch({ type: "push-alert", alert });
    dispatch({
      type: "patch-locker",
      id: currentLocker.lockerId,
      locker: {
        faultState: "spoilage_lockdown",
        occupancyState: "maintenance"
      }
    });

    // If this is the hardware locker, enforce the lock physically via RTDB
    if (currentLocker.lockerId === HARDWARE_LOCKER_ID) {
      console.warn("[Lockdown] 🚨 Sending spoilage LOCK command to hardware.");
      await spoilageLockLocker(HARDWARE_LOCKER_ID, hardwareMac);
      await bleService.sendLock();
    }
    
    const lockdownEvent: LockerEvent = {
      id: generateId(),
      lockerId: currentLocker.lockerId,
      type: "lock",
      createdAt: new Date().toISOString(),
      detail: "Maintenance lockdown triggered. Chamber sealed and alert raised.",
      syncState: "synced"
    };
    dispatch({ type: "append-log", event: lockdownEvent });
    try { await syncEvent(lockdownEvent); } catch {}
    
    await triggerAlertEmail(alert.id);
  }

  async function clearFault() {
    const event = await bleService.acknowledgeFault();
    await cacheEvent(event);
    dispatch({ type: "append-log", event });
    dispatch({ type: "clear-alert" });
    dispatch({
      type: "patch-locker",
      id: currentLocker.lockerId,
      locker: {
        occupancyState: currentLocker.activeDonation ? "occupied" : "empty"
      }
    });
    // Also log a separate clear-fault event with a human-readable description
    const clearEvent: LockerEvent = {
      id: generateId(),
      lockerId: currentLocker.lockerId,
      type: "fault_cleared",
      createdAt: new Date().toISOString(),
      detail: `Fault cleared on ${currentLocker.lockerId.replace('chamber-', 'SAFE ')}. System restored to normal.`,
      syncState: "synced"
    };
    dispatch({ type: "append-log", event: clearEvent });
    try { await syncEvent(clearEvent); } catch {}
  }

  async function resetDonations() {
    setIsBusy(true);
    // Clear local IndexedDB
    await clearAllData();
    
    // Clear Firestore collections
    if (db) {
      const collectionsToWipe = ["donations", "items", "retrievals", "events", "activeLogs", "alerts", "lockers", "sensorSnapshots", "predictions", "fleet"];
      for (const col of collectionsToWipe) {
        try {
          const snapshot = await getDocs(collection(db, col));
          for (const docSnap of snapshot.docs) {
            await deleteDoc(firestoreDoc(db, col, docSnap.id));
          }
          console.log(`[Wipe] ✅ Cleared Firestore collection: ${col}`);
        } catch (e) {
          console.warn(`[Wipe] ⚠️ Failed to clear ${col}:`, e);
        }
      }
    }
    
    // Clear ALL localStorage (mock telemetry, preferences, pairing state)
    // This is the full system wipe — pairing key is intentionally cleared so the
    // Connect screen shows again on the NEXT fresh terminal launch, not on this refresh.
    localStorage.removeItem("safelocker_mock_readings");
    // Note: we do NOT remove the pairing key here — wipe keeps you connected
    // so you can keep testing without re-pairing. Kill the terminal to reset pairing.
    
    // Rebuild fresh mock state with live deadlines (not stale module-load timestamps)
    const freshState = buildFreshInitialState();
    
    // Immediately restore the DB with the fresh mock state
    await syncInitialState(freshState);

    dispatch({ type: "reset-to-fresh-state", freshLockers: freshState.lockers });
    dispatch({ type: "set-sync-message", message: "SYSTEM RESET: Mock data restored system-wide." });

    // Log the wipe action
    const wipeEvent: LockerEvent = {
      id: generateId(),
      lockerId: "system",
      type: "system_wipe",
      createdAt: new Date().toISOString(),
      detail: "EMERGENCY SYSTEM WIPE executed. Original mock data immediately restored to DB.",
      syncState: "synced"
    };
    dispatch({ type: "append-log", event: wipeEvent });
    
    setIsBusy(false);
  }

  async function syncNow() {
    setIsBusy(true);
    if (currentLocker.activeDonation) {
      await syncDonation(currentLocker.activeDonation);
    }
    await syncSensorSnapshot({
      id: generateId(),
      lockerId: currentLocker.lockerId,
      donationId: currentLocker.activeDonation?.id,
      capturedAt: new Date().toISOString(),
      telemetry: currentLocker.telemetry,
      source: "periodic"
    });
    await syncPrediction({
      id: generateId(),
      lockerId: currentLocker.lockerId,
      donationId: currentLocker.activeDonation?.id,
      capturedAt: new Date().toISOString(),
      qualityScore: currentLocker.foodQualityScore,
      deadlineEstimate: currentLocker.deadlineEstimate,
      heuristicGasProfile: currentLocker.telemetry.heuristicGasProfile,
      recommendedActions: buildRecommendedActions(),
      source: "periodic"
    });
    for (const event of state.logs) {
      await syncEvent(event);
    }
    for (const alert of state.alerts) {
      await syncAlert(alert);
    }
    await syncSnapshot(currentLocker);
    const result = await processSyncQueue();
    const syncedCount = result.filter((entry) => entry.status === "synced").length;
    dispatch({ type: "set-sync-message", message: `${t("syncWorkerProcessed")} ${syncedCount}.` });
    dispatch({ type: "patch-locker", id: currentLocker.lockerId, locker: { lastSyncedAt: new Date().toISOString() } });

    // Log the force sync action to activity log
    const syncEvent_: LockerEvent = {
      id: generateId(),
      lockerId: currentLocker.lockerId,
      type: "force_sync",
      createdAt: new Date().toISOString(),
      detail: `Force sync completed. ${syncedCount} queued records processed. Telemetry and predictions updated.`,
      syncState: "synced"
    };
    dispatch({ type: "append-log", event: syncEvent_ });
    try { await syncEvent(syncEvent_); } catch {}
    setIsBusy(false);
  }

  const clearSyncMessage = () => dispatch({ type: "set-sync-message", message: "" });
  const signOut = () => dispatch({ type: "set-admin-auth", value: false });

  return useMemo(
    () => ({
      state,
      dispatch,
      currentLocker,
      isBusy,
      selectLocker,
      pairLocker,
      pairWithMac,
      reconnectLocker,
      submitDeposit,
      confirmDepositManually,
      retrieveFood,
      triggerMaintenanceLockdown,
      clearFault,
      resetDonations,

      syncNow,
      clearSyncMessage,
      signOut
    }),
    [isBusy, state, currentLocker, dispatch]
  );


}
