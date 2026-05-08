import { useMemo, useState } from "react";
import { bleService } from "../services/ble";
import { cacheAlert, cacheDonation, cacheEvent, cacheLockerSnapshot, cachePredictionSnapshot, cacheSensorSnapshot, clearAllData, enqueueSync } from "../services/db";
import { initiateDepositFn, initiateRetrievalFn } from "../services/firebase";
import { registerDevice, unlockLocker, lockLocker, sanitizeLocker } from "../services/rtdb";
import { processSyncQueue, syncAlert, syncDonation, syncEvent, syncPrediction, syncRetrieval, syncSensorSnapshot, syncSnapshot, triggerAlertEmail } from "../services/sync";
import { db } from "../services/firebase";
import { collection, getDocs, deleteDoc, doc as firestoreDoc } from "firebase/firestore";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";
import { sampleAlert, sampleDonation } from "../utils/mockData";
import { generateMockReadings, persistMockReadings, clearMockReadings } from "../utils/mockTelemetry";
import type { AlertRecord, DonationRecord, LockerEvent, PredictionSnapshot, SensorSnapshot } from "../types/domain";

const withTimeout = <T>(promise: Promise<T>, ms: number = 3000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
  ]);
};

function createSyncRecord(entityType: "donation" | "event" | "alert" | "snapshot" | "sensorSnapshot" | "prediction", entityId: string) {
  return {
    id: crypto.randomUUID(),
    entityType,
    entityId,
    status: "queued" as const,
    updatedAt: new Date().toISOString()
  };
}

export function useLockerController() {
  const { state, dispatch } = useAppContext();
  const { t } = useTranslation();
  const [isBusy, setIsBusy] = useState(false);

  const currentLocker = useMemo(() => {
    return state.lockers.find((l) => l.lockerId === state.selectedLockerId) || state.lockers[0];
  }, [state.lockers, state.selectedLockerId]);

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
      // Step 1: BLE discovery (simulated until ESP32 is ready)
      const paired = await bleService.pair();

      // Step 2: Register device in Firebase RTDB (creates telemetry/commands/status slots)
      dispatch({ type: "set-sync-message", message: "Registering device in cloud..." });
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate cloud latency
      
      const registered = await registerDevice(
        currentLocker.lockerId,
        paired.deviceName,
        `MAC_${currentLocker.lockerId}`
      );

      if (registered) {
        console.log(`[Pair] ✅ Device ${currentLocker.lockerId} registered in RTDB`);
      } else {
        console.warn(`[Pair] ⚠️ RTDB registration skipped — operating in offline mode`);
      }

      // Step 3: Sync locker snapshot to Firestore
      dispatch({ type: "set-sync-message", message: "Syncing locker state..." });
      await syncSnapshot({
        ...currentLocker,
        bleConnected: true,
        pairedDeviceName: paired.deviceName,
        lastSyncedAt: new Date().toISOString()
      });

      // Step 4: Update local state
      dispatch({
        type: "patch-locker",
        id: currentLocker.lockerId,
        locker: {
          bleConnected: true,
          pairedDeviceName: paired.deviceName,
          lastSyncedAt: new Date().toISOString()
        }
      });
      dispatch({ type: "set-pairing-complete", value: true });
      dispatch({ type: "set-sync-message", message: registered ? t("pairSuccess") + " — Cloud connected." : t("pairSuccess") + " — Offline mode." });
      return true;
    } catch (error) {
      console.error("[Pair] Pairing failed:", error);
      dispatch({ type: "set-sync-message", message: "Pairing failed. Check connection and try again." });
      return false;
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
      id: crypto.randomUUID(),
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

  async function submitDeposit() {
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
      id: crypto.randomUUID(),
      lockerId: currentLocker.lockerId,
      lockerNumber,
      foodName: state.donationDraft.foodName || sampleDonation.foodName,
      categoryId: state.donationDraft.categoryId ?? sampleDonation.categoryId,
      categoryLabel: state.donationDraft.categoryLabel || sampleDonation.categoryLabel,
      donorName: state.donationDraft.donorName || sampleDonation.donorName,
      donorContact: state.donationDraft.donorContact || sampleDonation.donorContact,
      allergensNotes: state.donationDraft.allergensNotes,
      dietTag: state.donationDraft.dietTag,
      createdAt: new Date().toISOString(),
      syncState: "queued"
    };

    // Generate unique mock telemetry for this deposit and persist it
    const mockReadings = generateMockReadings(donation.id, "fresh");
    persistMockReadings(donation.id, mockReadings);
    donation.deadlineEstimate = mockReadings.deadlineEstimate;
    donation.latestQualityScore = mockReadings.qualityScore;

    const sensorSnapshot: SensorSnapshot = {
      id: crypto.randomUUID(),
      lockerId: currentLocker.lockerId,
      donationId: donation.id,
      capturedAt: new Date().toISOString(),
      telemetry: mockReadings.telemetry,
      source: "deposit"
    };
    const predictionSnapshot: PredictionSnapshot = {
      id: crypto.randomUUID(),
      lockerId: currentLocker.lockerId,
      donationId: donation.id,
      capturedAt: new Date().toISOString(),
      qualityScore: mockReadings.qualityScore,
      deadlineEstimate: mockReadings.deadlineEstimate,
      heuristicGasProfile: mockReadings.telemetry.heuristicGasProfile,
      recommendedActions: buildRecommendedActions(),
      source: "deposit"
    };

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
    // This ensures data goes to the DB immediately without waiting for a background worker.
    try {
      await syncDonation(donation);
    } catch (e) {
      console.warn("[Deposit] Immediate sync failed, falling back to queue:", e);
    }

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
      // Send UNLOCK command via RTDB for ESP32 to pick up
      await unlockLocker(currentLocker.lockerId);
      const unlockEvent = await bleService.unlock();

      // After door closes, send LOCK command
      await lockLocker(currentLocker.lockerId);
      const lockEvent = await bleService.lock();

      // Start sanitization cycle
      await sanitizeLocker(currentLocker.lockerId);
      const cycleEvent = await bleService.startSanitization();
      const events: LockerEvent[] = [unlockEvent, lockEvent, cycleEvent];

      // Call Cloud Function if deployed
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

      await cacheLockerSnapshot({
        ...currentLocker,
        activeDonation: donation,
        occupancyState: "occupied",
        lockState: "locked",
        doorState: "closed",
        sanitizationState: "complete",
        lastSyncedAt: new Date().toISOString()
      });
    } catch {
      dispatch({ type: "set-sync-message", message: `${donation.foodName}: ${t("donationConfirmed")}` });
    } finally {
      setIsBusy(false);
    }

    return donation;
  }

  async function retrieveFood(skipSanitization = false, isAdminOverride = false, receiverImage?: string) {
    setIsBusy(true);

    const activeDonation = currentLocker.activeDonation;

    // Send UNLOCK command via RTDB
    await unlockLocker(currentLocker.lockerId);
    const unlockEvent = await bleService.unlock();

    // After retrieval, send LOCK command
    await lockLocker(currentLocker.lockerId);
    const lockEvent = await bleService.lock();

    const sensorSnapshot: SensorSnapshot = {
      id: crypto.randomUUID(),
      lockerId: currentLocker.lockerId,
      donationId: activeDonation?.id,
      capturedAt: new Date().toISOString(),
      telemetry: currentLocker.telemetry,
      source: "retrieve"
    };
    const predictionSnapshot: PredictionSnapshot = {
      id: crypto.randomUUID(),
      lockerId: currentLocker.lockerId,
      donationId: activeDonation?.id,
      capturedAt: new Date().toISOString(),
      qualityScore: currentLocker.foodQualityScore,
      deadlineEstimate: currentLocker.deadlineEstimate,
      heuristicGasProfile: currentLocker.telemetry.heuristicGasProfile,
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
          id: crypto.randomUUID(),
          donationId: activeDonation.id,
          lockerId: currentLocker.lockerId,
          lockerNumber: lockerIndex >= 0 ? lockerIndex + 1 : 0,
          foodName: activeDonation.foodName,
          qualityScoreAtRetrieval: currentLocker.foodQualityScore,
          retrievedAt: new Date().toISOString(),
          retrievedBy: isAdminOverride ? "admin_override" : "receiver",
          skipSanitization,
          receiverImage
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

    await cacheEvent(unlockEvent);
    await cacheEvent(lockEvent);
    await cacheSensorSnapshot(sensorSnapshot);
    await enqueueSync(createSyncRecord("sensorSnapshot", sensorSnapshot.id));
    await cachePredictionSnapshot(predictionSnapshot);
    await enqueueSync(createSyncRecord("prediction", predictionSnapshot.id));
    dispatch({ type: "append-log", event: unlockEvent });
    dispatch({ type: "append-log", event: lockEvent });
    dispatch({
      type: "patch-locker",
      id: currentLocker.lockerId,
      locker: {
        activeDonation: undefined,
        occupancyState: "empty",
        sanitizationState: skipSanitization ? "complete" : "running",
        doorState: "closed",
        lockState: "locked",
        foodQualityScore: "fresh",
        faultState: "none"
      }
    });
    dispatch({ type: "set-sync-message", message: `SAFE ${currentLocker.lockerId.split('-')[1].toUpperCase()} CLEARED: Access cycle complete.` });

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

  async function triggerMaintenanceLockdown() {
    const alert: AlertRecord = {
      ...sampleAlert,
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
    
    // Clear Firestore collections (donations, retrievals, events, alerts, lockers, sensorSnapshots, predictions)
    if (db) {
      const collectionsToWipe = ["donations", "retrievals", "events", "alerts", "lockers", "sensorSnapshots", "predictions", "fleet"];
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
    
    // Clear mock telemetry readings from localStorage
    localStorage.removeItem("safelocker_mock_readings");
    
    dispatch({ type: "reset-donations" });
    dispatch({ type: "set-sync-message", message: "SYSTEM RESET: All data wiped — lockers, DB, and telemetry. Refresh to reinitialize." });

    // Log the wipe action
    const wipeEvent: LockerEvent = {
      id: crypto.randomUUID(),
      lockerId: "system",
      type: "system_wipe",
      createdAt: new Date().toISOString(),
      detail: "EMERGENCY SYSTEM WIPE executed. All donations, events, alerts, and telemetry cleared from local and cloud databases.",
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
      id: crypto.randomUUID(),
      lockerId: currentLocker.lockerId,
      donationId: currentLocker.activeDonation?.id,
      capturedAt: new Date().toISOString(),
      telemetry: currentLocker.telemetry,
      source: "periodic"
    });
    await syncPrediction({
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
      reconnectLocker,
      submitDeposit,
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
