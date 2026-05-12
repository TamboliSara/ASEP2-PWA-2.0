/**
 * initialSync.ts — Pushes all initial state to Firestore on app startup.
 *
 * This ensures the Firebase DB always has a clean, organized view of:
 *   - All 8 chambers (locker states)
 *   - All pre-loaded donations
 *   - Fleet kiosk summaries (Alpha, Beta, Gamma, Delta)
 *   - Initial sensor snapshots for occupied chambers
 *   - Initial predictions for occupied chambers
 *
 * Collections structure in Firestore:
 *   lockers/          → Chamber states (chamber-1 through chamber-8)
 *   donations/        → Donation records (deposit info + status)
 *   retrievals/       → Retrieval audit trail
 *   events/           → System events (unlock, lock, sanitize, etc.)
 *   alerts/           → Active and historical alerts
 *   sensorSnapshots/  → Sensor readings at deposit/retrieve/periodic
 *   predictions/      → AI quality predictions
 *   fleet/            → Fleet-wide kiosk summaries
 *   mail/             → Alert email triggers
 */

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { AppState } from "../store/appState";
import { sampleFleetLockers } from "../utils/mockData";

export async function syncInitialState(state: AppState) {
  if (!db) {
    console.warn("[InitialSync] No Firestore — skipping initial sync.");
    return;
  }

  console.log("[InitialSync] 🔄 Syncing all chamber and fleet data to Firestore...");

  try {
    // ── 1. Sync all 8 chambers as self-contained documents ────────────
    //    Each chamber doc includes: state, donation, item, sensor, prediction, retrieval
    for (const locker of state.lockers) {
      const d = locker.activeDonation;
      const hasDonation = !!d;

      await setDoc(doc(db, "lockers", locker.lockerId), {
        // ── Chamber State ──
        lockerId: locker.lockerId,
        occupancyState: locker.occupancyState,
        lockState: locker.lockState,
        doorState: locker.doorState,
        sanitizationState: locker.sanitizationState,
        foodQualityScore: locker.foodQualityScore,
        faultState: locker.faultState,
        lastSyncedAt: locker.lastSyncedAt,

        // ── Donation Details (who donated, when, status) ──
        donation: hasDonation ? {
          id: d!.id,
          status: locker.foodQualityScore === "spoilt" ? "spoiled" : "deposited",
          donorName: d!.donorName,
          donorContact: d!.donorContact,
          createdAt: d!.createdAt,
          lockerNumber: d!.lockerNumber ?? null
        } : null,

        // ── Item Details (what food, category, diet, allergens) ──
        item: hasDonation ? {
          foodName: d!.foodName,
          categoryId: d!.categoryId,
          dietTag: d!.dietTag,
          allergensNotes: d!.allergensNotes || null,
          latestQualityScore: d!.latestQualityScore ?? null
        } : null,

        // ── Sensor Snapshot (latest telemetry readings) ──
        sensorSnapshot: hasDonation ? {
          capturedAt: new Date().toISOString(),
          internalTempC: locker.telemetry.internalTempC,
          externalTempC: locker.telemetry.externalTempC,
          humidityPct: locker.telemetry.humidityPct,
          pressureHpa: locker.telemetry.pressureHpa,
          gasResistanceOhms: locker.telemetry.gasResistanceOhms,
          sensorHealth: locker.telemetry.sensorHealth,
          heuristicGasProfile: locker.telemetry.heuristicGasProfile
        } : null,

        // ── Prediction (quality + deadline + recommended actions) ──
        prediction: hasDonation ? {
          qualityScore: locker.foodQualityScore,
          deadlineEstimate: locker.deadlineEstimate,
          heuristicGasProfile: locker.telemetry.heuristicGasProfile,
          recommendedActions: getActionsForQuality(locker.foodQualityScore)
        } : null,

        // ── Retrieval Details (null until item is retrieved) ──
        retrieval: null,

        _syncedAt: serverTimestamp(),
        _source: "initial_sync"
      });
    }
    console.log("[InitialSync] ✅ 8 chambers synced to lockers/ (self-contained docs)");

    // ── 2. Also write flat audit copies to donations/, sensorSnapshots/, items/ ──
    for (const locker of state.lockers) {
      if (locker.activeDonation) {
        const d = locker.activeDonation;
        const itemStatus = locker.foodQualityScore === "spoilt" ? "spoiled" : "deposited";

        // ── donations/ (unchanged existing collection) ──
        await setDoc(doc(db, "donations", d.id), {
          ...d,
          status: itemStatus,
          _syncedAt: serverTimestamp(),
          _source: "initial_sync"
        });

        // ── items/ (NEW permanent lifecycle record — doc ID = donationId) ──
        await setDoc(doc(db, "items", d.id), {
          donationId: d.id,
          lockerId: locker.lockerId,
          lockerNumber: d.lockerNumber ?? null,
          status: itemStatus,

          // Item details
          foodName: d.foodName,
          categoryLabel: d.categoryLabel,
          dietTag: d.dietTag,
          allergensNotes: d.allergensNotes || null,
          latestQualityScore: d.latestQualityScore ?? null,
          deadlineEstimate: d.deadlineEstimate ?? null,

          // Donor details
          donor: {
            name: d.donorName,
            contact: d.donorContact,
            imageUrl: d.donorImageUrl || null,
            depositedAt: d.createdAt
          },

          // Lifecycle fields — filled in later on retrieval/override
          receiver: null,
          adminOverride: null,

          _createdAt: serverTimestamp(),
          _updatedAt: serverTimestamp(),
          _source: "initial_sync"
        });

        // ── sensorSnapshots/ ──
        await setDoc(doc(db, "sensorSnapshots", `initial-sensor-${locker.lockerId}`), {
          id: `initial-sensor-${locker.lockerId}`,
          lockerId: locker.lockerId,
          donationId: d.id,
          capturedAt: new Date().toISOString(),
          telemetry: locker.telemetry,
          source: "deposit",
          _syncedAt: serverTimestamp(),
          _source: "initial_sync"
        });

        // ── predictions/ ──
        await setDoc(doc(db, "predictions", `initial-pred-${locker.lockerId}`), {
          id: `initial-pred-${locker.lockerId}`,
          lockerId: locker.lockerId,
          donationId: d.id,
          capturedAt: new Date().toISOString(),
          qualityScore: locker.foodQualityScore,
          deadlineEstimate: locker.deadlineEstimate,
          heuristicGasProfile: locker.telemetry.heuristicGasProfile,
          recommendedActions: getActionsForQuality(locker.foodQualityScore),
          source: "deposit",
          _syncedAt: serverTimestamp(),
          _source: "initial_sync"
        });
      }
    }
    console.log("[InitialSync] ✅ Flat audit copies synced (donations/, items/, sensorSnapshots/, predictions/)");


    // ── 3. Sync Mock Past Retrievals for Calendar Data ──────────────
    // The calendar needs retrieved data to show history. We add 2 past donations (one fresh, one aging)
    // that were already retrieved. The system NEVER unlocks for spoiled food.
    const pastTime1 = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const retrieveTime1 = new Date(pastTime1.getTime() + 5 * 60 * 60 * 1000); // 5 hours later
    
    const pastDonation1 = {
      id: "mock-past-don-1",
      lockerId: "chamber-1",
      lockerNumber: 1,
      foodName: "Vegetable Pasta",
      categoryId: 2,
      categoryLabel: "Cooked Meal",
      donorName: "Anjali Gupta",
      donorContact: "anjali@ecolocker.local",
      dietTag: "veg",
      createdAt: pastTime1.toISOString(),
      latestQualityScore: "fresh",
      status: "retrieved",
      _syncedAt: serverTimestamp(),
      _source: "initial_sync"
    };

    const pastRetrieval1 = {
      id: "mock-past-ret-1",
      donationId: pastDonation1.id,
      lockerId: pastDonation1.lockerId,
      lockerNumber: pastDonation1.lockerNumber,
      foodName: pastDonation1.foodName,
      qualityScoreAtRetrieval: "fresh", // Must not be spoiled
      retrievedAt: retrieveTime1.toISOString(),
      retrievedBy: "receiver",
      skipSanitization: false,
      _syncedAt: serverTimestamp(),
      _source: "initial_sync"
    };

    const pastTime2 = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
    const retrieveTime2 = new Date(pastTime2.getTime() + 10 * 60 * 60 * 1000); // 10 hours later
    
    const pastDonation2 = {
      id: "mock-past-don-2",
      lockerId: "chamber-2",
      lockerNumber: 2,
      foodName: "Apple Pie",
      categoryId: 3,
      categoryLabel: "Baked Goods",
      donorName: "Rohan Kumar",
      donorContact: "rohan@ecolocker.local",
      dietTag: "veg",
      createdAt: pastTime2.toISOString(),
      latestQualityScore: "aging",
      status: "retrieved",
      _syncedAt: serverTimestamp(),
      _source: "initial_sync"
    };

    const pastRetrieval2 = {
      id: "mock-past-ret-2",
      donationId: pastDonation2.id,
      lockerId: pastDonation2.lockerId,
      lockerNumber: pastDonation2.lockerNumber,
      foodName: pastDonation2.foodName,
      qualityScoreAtRetrieval: "aging", // Must not be spoiled
      retrievedAt: retrieveTime2.toISOString(),
      retrievedBy: "receiver",
      skipSanitization: false,
      _syncedAt: serverTimestamp(),
      _source: "initial_sync"
    };

    await setDoc(doc(db, "donations", pastDonation1.id), pastDonation1);
    await setDoc(doc(db, "retrievals", pastRetrieval1.id), pastRetrieval1);
    
    await setDoc(doc(db, "donations", pastDonation2.id), pastDonation2);
    await setDoc(doc(db, "retrievals", pastRetrieval2.id), pastRetrieval2);
    
    console.log("[InitialSync] ✅ Mock calendar retrieval data synced");

    // ── 5. Sync fleet kiosk summaries ────────────────────────────────
    for (const kiosk of sampleFleetLockers) {
      await setDoc(doc(db, "fleet", kiosk.lockerId), {
        ...kiosk,
        _syncedAt: serverTimestamp(),
        _source: "initial_sync"
      });
    }
    console.log("[InitialSync] ✅ Fleet kiosks synced (Alpha, Beta, Gamma, Delta)");

    // ── 6. Sync mock alerts for maintenance and spoiled chambers ──────
    const alertsToSync = [
      {
        id: "alert-c7-sensor",
        lockerId: "chamber-7",
        type: "sensor_fault",
        severity: "critical",
        message: "BME688 gas sensor not responding on chamber-7. Maintenance required.",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        acknowledged: false,
        resolvedAt: null
      },
      {
        id: "alert-c4-spoilage",
        lockerId: "chamber-4",
        type: "spoilage_lockdown",
        severity: "warning",
        message: "Chicken Biryani in chamber-4 has exceeded spoilage threshold. Retrieval restricted.",
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        acknowledged: false,
        resolvedAt: null
      }
    ];

    for (const alert of alertsToSync) {
      await setDoc(doc(db, "alerts", alert.id), {
        ...alert,
        _syncedAt: serverTimestamp(),
        _source: "initial_sync"
      });
    }
    console.log("[InitialSync] ✅ Alerts synced");

    // ── 7. Sync a system event for the initialization ────────────────
    const initEventId = `init-${Date.now()}`;
    await setDoc(doc(db, "events", initEventId), {
      id: initEventId,
      lockerId: "system",
      type: "system_init",
      createdAt: new Date().toISOString(),
      detail: `Kiosk Delta initialized with ${state.lockers.length} chambers. ${state.lockers.filter(l => l.activeDonation).length} occupied.`,
      syncState: "synced",
      _syncedAt: serverTimestamp(),
      _source: "initial_sync"
    });

    console.log("[InitialSync] ✅ All data synced to Firestore successfully!");
  } catch (error) {
    console.error("[InitialSync] ❌ Initial sync failed:", error);
  }
}

// ── Navigation Event Tracker ─────────────────────────────────────
// Call this whenever the user navigates between tabs/routes
export async function syncNavigationEvent(fromRoute: string, toRoute: string) {
  if (!db) return;
  try {
    const eventId = `nav-${Date.now()}`;
    await setDoc(doc(db, "events", eventId), {
      id: eventId,
      lockerId: "system",
      type: "navigation",
      createdAt: new Date().toISOString(),
      detail: `User navigated from "${fromRoute}" to "${toRoute}"`,
      fromRoute,
      toRoute,
      syncState: "synced",
      _syncedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("[NavTracker] Failed to sync navigation event:", e);
  }
}

function getActionsForQuality(quality: string): string[] {
  if (quality === "spoilt") {
    return [
      "Notify admin and cleaning authorities immediately.",
      "Divert rotten produce to composting or organic waste processing.",
      "Evaluate safe reuse options under supervision."
    ];
  }
  if (quality === "aging") {
    return [
      "Prioritize pickup within the next collection window.",
      "Promote rapid reuse through meal sharing.",
      "Monitor humidity and gas buildup."
    ];
  }
  return [
    "Locker is within the normal safe-use window.",
    "Keep sealed until retrieval to preserve freshness.",
    "Continue sensor logging for fleet records."
  ];
}
