"use strict";
/**
 * SAFE Locker — Cloud Functions Backend
 *
 * Split-database architecture:
 *   Firestore  → persistent app data (donations, events, alerts)
 *   RTDB       → real-time IoT layer (telemetry, commands, status)
 *
 * Functions:
 *   initiateDeposit   → Creates donation in Firestore + UNLOCK command in RTDB
 *   initiateRetrieval → Archives donation in Firestore + UNLOCK command in RTDB
 *   onTelemetryWrite  → RTDB trigger: evaluates sensor data for spoilage alerts
 *   onCommandAck      → RTDB trigger: logs command acknowledgment to Firestore
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onCommandAck = exports.onTelemetryWrite = exports.initiateRetrieval = exports.initiateDeposit = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const firestore = admin.firestore();
const rtdb = admin.database();
// ── HTTPS Callable: initiateDeposit ────────────────────────────────
// Called by the PWA when a donor confirms a food deposit.
// Creates the donation record in Firestore and sends UNLOCK to RTDB.
exports.initiateDeposit = functions.https.onCall(async (data, context) => {
    const { mac_address, item_name, dietary_tags, quantity, donor_name, donor_contact, allergens_notes, category_label } = data;
    if (!mac_address || !item_name) {
        throw new functions.https.HttpsError("invalid-argument", "mac_address and item_name are required.");
    }
    const now = admin.firestore.Timestamp.now();
    const donationId = firestore.collection("donations").doc().id;
    // 1. Write donation to Firestore (persistent record)
    const donationRecord = {
        id: donationId,
        lockerId: mac_address,
        foodName: item_name,
        dietaryTags: dietary_tags || [],
        quantity: quantity || 1,
        donorName: donor_name || "Anonymous",
        donorContact: donor_contact || "",
        allergensNotes: allergens_notes || "None",
        categoryLabel: category_label || "Unknown",
        status: "deposited",
        createdAt: now,
        updatedAt: now,
        syncSource: "cloud_function"
    };
    await firestore.collection("donations").doc(donationId).set(donationRecord);
    functions.logger.info(`[Deposit] ✅ Donation ${donationId} created for ${mac_address}`);
    // 2. Send UNLOCK command to RTDB (ESP32 picks this up)
    await rtdb.ref(`commands/${mac_address}`).set({
        command: "UNLOCK",
        issuedAt: Date.now(),
        issuedBy: "cloud_function",
        acknowledged: false,
        donationId: donationId
    });
    functions.logger.info(`[Deposit] 📡 UNLOCK command sent to ${mac_address}`);
    // 3. Update device status
    await rtdb.ref(`status/${mac_address}`).update({
        occupancy: "processing",
        last_heartbeat: Date.now()
    });
    return {
        success: true,
        donationId,
        message: `Deposit initiated for ${item_name} at locker ${mac_address}`
    };
});
// ── HTTPS Callable: initiateRetrieval ──────────────────────────────
// Called by the PWA when a receiver retrieves food from a locker.
// Archives the donation and sends UNLOCK command to RTDB.
exports.initiateRetrieval = functions.https.onCall(async (data, context) => {
    const { mac_address } = data;
    if (!mac_address) {
        throw new functions.https.HttpsError("invalid-argument", "mac_address is required.");
    }
    // 1. Find the active donation for this locker
    const donationsQuery = await firestore
        .collection("donations")
        .where("lockerId", "==", mac_address)
        .where("status", "==", "deposited")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
    let donationId = null;
    if (!donationsQuery.empty) {
        const donationDoc = donationsQuery.docs[0];
        donationId = donationDoc.id;
        // Archive the donation as "retrieved"
        await donationDoc.ref.update({
            status: "retrieved",
            retrievedAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        });
        functions.logger.info(`[Retrieval] ✅ Donation ${donationId} archived as RETRIEVED`);
    }
    else {
        functions.logger.warn(`[Retrieval] ⚠️ No active donation found for ${mac_address}`);
    }
    // 2. Send UNLOCK command to RTDB
    await rtdb.ref(`commands/${mac_address}`).set({
        command: "UNLOCK",
        issuedAt: Date.now(),
        issuedBy: "cloud_function",
        acknowledged: false,
        donationId: donationId
    });
    functions.logger.info(`[Retrieval] 📡 UNLOCK command sent to ${mac_address}`);
    // 3. Update device status
    await rtdb.ref(`status/${mac_address}`).update({
        occupancy: "processing",
        last_heartbeat: Date.now()
    });
    return {
        success: true,
        donationId,
        message: `Retrieval initiated at locker ${mac_address}`
    };
});
// ── RTDB Trigger: onTelemetryWrite ─────────────────────────────────
// Fires when the ESP32 pushes new sensor data to telemetry/{lockerId}.
// Evaluates the data for spoilage risk and creates alerts if needed.
exports.onTelemetryWrite = functions.database
    .ref("telemetry/{lockerId}")
    .onWrite(async (change, context) => {
    const lockerId = context.params.lockerId;
    const data = change.after.val();
    if (!data)
        return;
    const { internalTempC, humidityPct, gasResistanceOhms } = data;
    // Spoilage detection heuristics
    const isTempDanger = internalTempC > 8; // Above safe cold storage
    const isHumidityDanger = humidityPct > 85;
    const isGasDanger = gasResistanceOhms < 5000; // Low resistance = high VOC
    if (isTempDanger || isGasDanger) {
        const alertId = firestore.collection("alerts").doc().id;
        const severity = isGasDanger ? "critical" : "warning";
        await firestore.collection("alerts").doc(alertId).set({
            id: alertId,
            lockerId,
            title: isGasDanger ? "Spoilage Detected — Gas Alert" : "Temperature Warning",
            detail: `Temp: ${internalTempC}°C | Humidity: ${humidityPct}% | Gas: ${gasResistanceOhms}Ω`,
            severity,
            createdAt: admin.firestore.Timestamp.now(),
            source: "telemetry_trigger"
        });
        functions.logger.warn(`[Telemetry] ⚠️ Alert created for ${lockerId}: ${severity}`);
        // If critical, send LOCK command to quarantine the locker
        if (severity === "critical") {
            await rtdb.ref(`commands/${lockerId}`).set({
                command: "LOCK",
                issuedAt: Date.now(),
                issuedBy: "cloud_function",
                acknowledged: false,
                reason: "spoilage_lockdown"
            });
            functions.logger.warn(`[Telemetry] 🔒 Quarantine LOCK sent to ${lockerId}`);
        }
    }
    // Log the telemetry snapshot to Firestore for historical records
    await firestore.collection("sensorSnapshots").add({
        lockerId,
        timestamp: admin.firestore.Timestamp.now(),
        ...data,
        source: "esp32_push"
    });
});
// ── RTDB Trigger: onCommandAcknowledge ─────────────────────────────
// Fires when the ESP32 acknowledges a command by setting acknowledged=true.
exports.onCommandAck = functions.database
    .ref("commands/{lockerId}/acknowledged")
    .onUpdate(async (change, context) => {
    const lockerId = context.params.lockerId;
    const wasAcknowledged = change.before.val();
    const isAcknowledged = change.after.val();
    if (!wasAcknowledged && isAcknowledged) {
        // Get the full command data
        const commandSnapshot = await rtdb.ref(`commands/${lockerId}`).get();
        const commandData = commandSnapshot.val();
        // Log to Firestore events
        await firestore.collection("events").add({
            lockerId,
            type: `command_ack_${((commandData === null || commandData === void 0 ? void 0 : commandData.command) || "unknown").toLowerCase()}`,
            detail: `ESP32 acknowledged ${commandData === null || commandData === void 0 ? void 0 : commandData.command} command`,
            createdAt: admin.firestore.Timestamp.now(),
            syncState: "synced",
            source: "rtdb_trigger"
        });
        functions.logger.info(`[Command] ✅ ${lockerId} acknowledged: ${commandData === null || commandData === void 0 ? void 0 : commandData.command}`);
    }
});
//# sourceMappingURL=index.js.map