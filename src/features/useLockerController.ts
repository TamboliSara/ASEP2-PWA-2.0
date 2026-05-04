import { useMemo, useState } from "react";
import { bleService } from "../services/ble";
import { cacheAlert, cacheDonation, cacheEvent, cacheLockerSnapshot, cachePredictionSnapshot, cacheSensorSnapshot, clearAllData, enqueueSync } from "../services/db";
import { initiateDepositFn, initiateRetrievalFn } from "../services/firebase";
import { registerDevice, unlockLocker, lockLocker, sanitizeLocker } from "../services/rtdb";
import { processSyncQueue, syncAlert, syncDonation, syncEvent, syncPrediction, syncSensorSnapshot, syncSnapshot, triggerAlertEmail } from "../services/sync";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";
import { sampleAlert, sampleDonation } from "../utils/mockData";
import type { AlertRecord, DonationRecord, LockerEvent, PredictionSnapshot, SensorSnapshot } from "../types/domain";

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

  async function pairLocker() {
    setIsBusy(true);
    dispatch({ type: "set-sync-message", message: "Initiating device pairing..." });

    try {
      // Step 1: BLE discovery (simulated until ESP32 is ready)
      const paired = await bleService.pair();

      // Step 2: Register device in Firebase RTDB (creates telemetry/commands/status slots)
      dispatch({ type: "set-sync-message", message: "Registering device in cloud..." });
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
    } catch (error) {
      console.error("[Pair] Pairing failed:", error);
      dispatch({ type: "set-sync-message", message: "Pairing failed. Check connection and try again." });
    } finally {
      setIsBusy(false);
    }
  }

  async function reconnectLocker() {
    setIsBusy(true);
    const connected = await bleService.reconnect();
    dispatch({ type: "patch-locker", id: currentLocker.lockerId, locker: { bleConnected: connected } });
    dispatch({ type: "set-sync-message", message: connected ? t("bleReconnectSuccess") : t("bleReconnectFailure") });
    setIsBusy(false);
  }

  async function submitDeposit() {
    if (currentLocker.activeDonation) {
      dispatch({ type: "set-sync-message", message: "Unit already occupied. Only 1 item allowed." });
      return null;
    }
    setIsBusy(true);

    const donation: DonationRecord = {
      ...sampleDonation,
      id: crypto.randomUUID(),
      lockerId: currentLocker.lockerId,
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

    const sensorSnapshot: SensorSnapshot = {
      id: crypto.randomUUID(),
      lockerId: currentLocker.lockerId,
      donationId: donation.id,
      capturedAt: new Date().toISOString(),
      telemetry: currentLocker.telemetry,
      source: "deposit"
    };
    const predictionSnapshot: PredictionSnapshot = {
      id: crypto.randomUUID(),
      lockerId: currentLocker.lockerId,
      donationId: donation.id,
      capturedAt: new Date().toISOString(),
      qualityScore: currentLocker.foodQualityScore,
      deadlineEstimate: currentLocker.deadlineEstimate,
      heuristicGasProfile: currentLocker.telemetry.heuristicGasProfile,
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
        lastSyncedAt: new Date().toISOString()
      }
    });
    dispatch({ type: "record-donation", donation });
    dispatch({ type: "reset-donation-draft" });
    dispatch({ type: "set-sync-message", message: `${donation.foodName}: ${t("donationConfirmed")}` });

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
          await initiateDepositFn({
            mac_address: currentLocker.lockerId,
            item_name: donation.foodName,
            dietary_tags: donation.dietTag ? [donation.dietTag] : [],
            quantity: 1
          });
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

  async function retrieveFood(skipSanitization = false) {
    setIsBusy(true);

    // Send UNLOCK command via RTDB
    await unlockLocker(currentLocker.lockerId);
    const unlockEvent = await bleService.unlock();

    // After retrieval, send LOCK command
    await lockLocker(currentLocker.lockerId);
    const lockEvent = await bleService.lock();

    const sensorSnapshot: SensorSnapshot = {
      id: crypto.randomUUID(),
      lockerId: currentLocker.lockerId,
      donationId: currentLocker.activeDonation?.id,
      capturedAt: new Date().toISOString(),
      telemetry: currentLocker.telemetry,
      source: "retrieve"
    };
    const predictionSnapshot: PredictionSnapshot = {
      id: crypto.randomUUID(),
      lockerId: currentLocker.lockerId,
      donationId: currentLocker.activeDonation?.id,
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
        await initiateRetrievalFn({ mac_address: currentLocker.lockerId });
      } catch (e) {
        console.error("Cloud function initiateRetrieval failed (non-blocking):", e);
      }
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
        lockState: "locked"
      }
    });
    dispatch({ type: "set-sync-message", message: `SAFE ${currentLocker.lockerId.split('-')[1].toUpperCase()} CLEARED: Access cycle complete.` });
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
  }

  async function resetDonations() {
    setIsBusy(true);
    await clearAllData();
    dispatch({ type: "reset-donations" });
    dispatch({ type: "set-sync-message", message: "SYSTEM RESET: All compartments cleared across fleet." });
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
    setIsBusy(false);
  }

  const clearSyncMessage = () => dispatch({ type: "set-sync-message", message: "" });
  const signOut = () => dispatch({ type: "set-admin-auth", value: false });

  return useMemo(
    () => ({
      state,
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
    [isBusy, state, currentLocker]
  );
}
