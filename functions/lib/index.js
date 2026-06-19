"use strict";
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
exports.compileSessionToCSV = exports.cleanupExpiredSnapshots = exports.onCommandAck = exports.onTelemetryWrite = exports.confirmRetrieval = exports.initiateRetrieval = exports.initiateDeposit = exports.setAdminClaim = void 0;
const https_1 = require("firebase-functions/v2/https");
const database_1 = require("firebase-functions/v2/database");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const firestore = admin.firestore();
const rtdb = admin.database();
const storage = admin.storage();
const SIMILARITY_THRESHOLD = 0.6;
const MAX_RETRIEVALS_PER_DAY = 2;
const SNAPSHOT_TTL_DAYS = 28;
function euclideanDistance(a, b) {
    if (a.length !== b.length)
        return Infinity;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}
// ── HTTPS Callable: setAdminClaim ─────────────────────────────────
exports.setAdminClaim = (0, https_1.onCall)(async (request) => {
    const { email, secret } = request.data;
    if (secret !== "SAFE_ADMIN_PROVISION_KEY_2026") {
        throw new https_1.HttpsError("permission-denied", "Invalid provisioning secret.");
    }
    if (!email) {
        throw new https_1.HttpsError("invalid-argument", "Email is required.");
    }
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });
        logger.info(`[Admin] Admin claim set for ${email} (${user.uid})`);
        return { success: true, message: `Admin claim granted to ${email}` };
    }
    catch (err) {
        throw new https_1.HttpsError("not-found", `User with email ${email} not found: ${err.message}`);
    }
});
// ── HTTPS Callable: initiateDeposit ────────────────────────────────
exports.initiateDeposit = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const { mac_address, item_name, dietary_tags, quantity, donor_name, donor_contact, allergens_notes, category_label, locker_number, donor_snapshot_base64 } = data;
    if (!mac_address || !item_name) {
        throw new https_1.HttpsError("invalid-argument", "mac_address and item_name are required.");
    }
    const now = admin.firestore.Timestamp.now();
    const donationId = firestore.collection("donations").doc().id;
    let donorSnapshotUrl = "";
    if (donor_snapshot_base64) {
        try {
            const buffer = Buffer.from(donor_snapshot_base64, "base64");
            const bucket = storage.bucket();
            const filePath = `biometric_snapshots/donors/${donationId}.jpg`;
            const file = bucket.file(filePath);
            await file.save(buffer, {
                metadata: {
                    contentType: "image/jpeg",
                    metadata: {
                        donationId,
                        lockerId: mac_address,
                        capturedAt: now.toDate().toISOString()
                    }
                }
            });
            await file.makePublic().catch(() => { });
            donorSnapshotUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
            await firestore.collection("biometric_snapshots").add({
                transactionId: donationId,
                lockerId: mac_address,
                role: "donor",
                imageUrl: donorSnapshotUrl,
                createdAt: now,
                expiresAt: admin.firestore.Timestamp.fromDate(new Date(now.toDate().getTime() + SNAPSHOT_TTL_DAYS * 24 * 60 * 60 * 1000))
            });
            logger.info(`[Deposit] Donor snapshot uploaded for ${donationId}`);
        }
        catch (err) {
            logger.error(`[Deposit] Snapshot upload failed: ${err.message}`);
        }
    }
    const donationRecord = {
        id: donationId,
        lockerId: mac_address,
        lockerNumber: locker_number || 0,
        foodName: item_name,
        dietaryTags: dietary_tags || [],
        quantity: quantity || 1,
        donorName: donor_name || "Anonymous",
        donorContact: donor_contact || "",
        allergensNotes: allergens_notes || "None",
        categoryLabel: category_label || "Unknown",
        status: "deposited",
        donorSnapshotUrl,
        createdAt: now,
        updatedAt: now,
        syncSource: "cloud_function"
    };
    await firestore.collection("donations").doc(donationId).set(donationRecord);
    logger.info(`[Deposit] Donation ${donationId} created for ${mac_address}`);
    await rtdb.ref(`commands/${mac_address}`).set({
        command: "UNLOCK",
        issuedAt: Date.now(),
        issuedBy: "cloud_function",
        acknowledged: false,
        donationId: donationId
    });
    logger.info(`[Deposit] UNLOCK command sent to ${mac_address}`);
    await rtdb.ref(`status/${mac_address}`).update({
        occupancy: "processing",
        last_heartbeat: Date.now()
    });
    return {
        success: true,
        donationId,
        donorSnapshotUrl,
        message: `Deposit initiated for ${item_name} at locker ${mac_address}`
    };
});
// ── HTTPS Callable: initiateRetrieval ──────────────────────────────
exports.initiateRetrieval = (0, https_1.onCall)(async (request) => {
    const { mac_address, receiver_descriptor, receiver_snapshot_base64 } = request.data;
    if (!mac_address) {
        throw new https_1.HttpsError("invalid-argument", "mac_address is required.");
    }
    if (receiver_descriptor && Array.isArray(receiver_descriptor)) {
        const twentyFourHoursAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
        const recentTransactions = await firestore
            .collection("transaction_history")
            .where("retrievedAt", ">=", twentyFourHoursAgo)
            .get();
        let matchCount = 0;
        for (const doc of recentTransactions.docs) {
            const storedDescriptor = doc.data().receiverDescriptor;
            if (!storedDescriptor || !Array.isArray(storedDescriptor))
                continue;
            const distance = euclideanDistance(receiver_descriptor, storedDescriptor);
            if (distance < SIMILARITY_THRESHOLD) {
                matchCount++;
            }
        }
        if (matchCount >= MAX_RETRIEVALS_PER_DAY) {
            logger.warn(`[Retrieval] Anti-hoarding block: face matched ${matchCount} times in 24h for ${mac_address}`);
            throw new https_1.HttpsError("resource-exhausted", "Community fair-use limit reached. Each person may collect up to 2 meals per day to ensure everyone has access.");
        }
    }
    const result = await firestore.runTransaction(async (transaction) => {
        var _a;
        const donationsQuery = await firestore
            .collection("donations")
            .where("lockerId", "==", mac_address)
            .where("status", "==", "deposited")
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();
        if (donationsQuery.empty) {
            throw new https_1.HttpsError("not-found", "No active meal available in this locker.");
        }
        const donationDoc = donationsQuery.docs[0];
        const donationData = donationDoc.data();
        const freshSnap = await transaction.get(donationDoc.ref);
        if (!freshSnap.exists || ((_a = freshSnap.data()) === null || _a === void 0 ? void 0 : _a.status) !== "deposited") {
            throw new https_1.HttpsError("aborted", "Meal already claimed by another user. Please try a different locker.");
        }
        const transactionId = firestore.collection("transaction_history").doc().id;
        const now = admin.firestore.Timestamp.now();
        transaction.update(donationDoc.ref, {
            status: "PENDING_HARDWARE",
            retrievalTransactionId: transactionId,
            updatedAt: now
        });
        let receiverSnapshotUrl = "";
        const transactionRecord = {
            id: transactionId,
            lockerId: mac_address,
            donationId: donationDoc.id,
            foodName: donationData.foodName,
            donorSnapshotUrl: donationData.donorSnapshotUrl || "",
            receiverSnapshotUrl: "",
            receiverDescriptor: receiver_descriptor || [],
            status: "PENDING_HARDWARE",
            retrievedAt: now,
            createdAt: now
        };
        transaction.set(firestore.collection("transaction_history").doc(transactionId), transactionRecord);
        return { transactionId, donationId: donationDoc.id, donationData };
    });
    if (receiver_snapshot_base64) {
        try {
            const buffer = Buffer.from(receiver_snapshot_base64, "base64");
            const bucket = storage.bucket();
            const filePath = `biometric_snapshots/receivers/${result.transactionId}.jpg`;
            const file = bucket.file(filePath);
            await file.save(buffer, {
                metadata: {
                    contentType: "image/jpeg",
                    metadata: {
                        transactionId: result.transactionId,
                        lockerId: mac_address,
                        capturedAt: new Date().toISOString()
                    }
                }
            });
            const receiverSnapshotUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
            await firestore.collection("biometric_snapshots").add({
                transactionId: result.transactionId,
                lockerId: mac_address,
                role: "receiver",
                imageUrl: receiverSnapshotUrl,
                faceDescriptor: receiver_descriptor || [],
                createdAt: admin.firestore.Timestamp.now(),
                expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + SNAPSHOT_TTL_DAYS * 24 * 60 * 60 * 1000))
            });
            await firestore
                .collection("transaction_history")
                .doc(result.transactionId)
                .update({ receiverSnapshotUrl });
        }
        catch (err) {
            logger.error(`[Retrieval] Receiver snapshot upload failed: ${err.message}`);
        }
    }
    await rtdb.ref(`commands/${mac_address}`).set({
        command: "UNLOCK",
        issuedAt: Date.now(),
        issuedBy: "cloud_function",
        acknowledged: false,
        donationId: result.donationId,
        transactionId: result.transactionId
    });
    await rtdb.ref(`status/${mac_address}`).update({
        occupancy: "processing",
        last_heartbeat: Date.now()
    });
    logger.info(`[Retrieval] PENDING_HARDWARE for ${result.donationId} at ${mac_address} (tx: ${result.transactionId})`);
    return {
        success: true,
        transactionId: result.transactionId,
        donationId: result.donationId,
        message: `Retrieval initiated at locker ${mac_address}`
    };
});
// ── RTDB Trigger: confirmRetrieval ─────────────────────────────────
exports.confirmRetrieval = (0, database_1.onValueUpdated)("status/{lockerId}/door_state", async (event) => {
    const lockerId = event.params.lockerId;
    const previousState = event.data.before.val();
    const currentState = event.data.after.val();
    if (previousState === "closed" && currentState === "open") {
        const donationsQuery = await firestore
            .collection("donations")
            .where("lockerId", "==", lockerId)
            .where("status", "==", "PENDING_HARDWARE")
            .limit(1)
            .get();
        if (donationsQuery.empty)
            return;
        const donationDoc = donationsQuery.docs[0];
        const donationData = donationDoc.data();
        const transactionId = donationData.retrievalTransactionId;
        const now = admin.firestore.Timestamp.now();
        await donationDoc.ref.update({
            status: "retrieved",
            retrievedAt: now,
            updatedAt: now
        });
        if (transactionId) {
            await firestore
                .collection("transaction_history")
                .doc(transactionId)
                .update({
                status: "completed",
                confirmedAt: now
            });
        }
        await firestore.collection("events").add({
            lockerId,
            type: "retrieve_completed",
            detail: `Hardware confirmed door open. ${donationData.foodName} retrieved. Transaction ${transactionId} finalized.`,
            createdAt: now,
            syncState: "synced",
            source: "rtdb_trigger"
        });
        logger.info(`[ConfirmRetrieval] ${donationData.foodName} retrieval confirmed at ${lockerId}`);
    }
});
// ── RTDB Trigger: onTelemetryWrite ─────────────────────────────────
exports.onTelemetryWrite = (0, database_1.onValueWritten)("telemetry/{lockerId}", async (event) => {
    const lockerId = event.params.lockerId;
    const data = event.data.after.val();
    if (!data)
        return;
    const { internalTempC, humidityPct, gasResistanceOhms, edge_impulse_confidence } = data;
    const isTempDanger = internalTempC > 8;
    const isHumidityDanger = humidityPct > 85;
    const isGasDanger = gasResistanceOhms < 5000;
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
        logger.warn(`[Telemetry] Alert created for ${lockerId}: ${severity}`);
        if (severity === "critical") {
            await rtdb.ref(`commands/${lockerId}`).set({
                command: "LOCK",
                issuedAt: Date.now(),
                issuedBy: "cloud_function",
                acknowledged: false,
                reason: "spoilage_lockdown"
            });
            logger.warn(`[Telemetry] Quarantine LOCK sent to ${lockerId}`);
        }
    }
    if (typeof edge_impulse_confidence === "number" &&
        edge_impulse_confidence < 0.1) {
        const statusSnap = await rtdb.ref(`status/${lockerId}/occupancy`).get();
        const occupancy = statusSnap.val();
        if (occupancy === "occupied" || occupancy === "processing") {
            const donationsQuery = await firestore
                .collection("donations")
                .where("lockerId", "==", lockerId)
                .where("status", "==", "deposited")
                .limit(1)
                .get();
            if (!donationsQuery.empty) {
                await donationsQuery.docs[0].ref.update({
                    status: "EMPTY_WARNING",
                    updatedAt: admin.firestore.Timestamp.now()
                });
                logger.warn(`[Telemetry] EMPTY_WARNING flagged for ${lockerId} — Edge Impulse confidence: ${edge_impulse_confidence}`);
            }
        }
    }
    await firestore.collection("sensorSnapshots").add({
        lockerId,
        timestamp: admin.firestore.Timestamp.now(),
        ...data,
        source: "esp32_push"
    });
});
// ── RTDB Trigger: onCommandAcknowledge ─────────────────────────────
exports.onCommandAck = (0, database_1.onValueUpdated)("commands/{lockerId}/acknowledged", async (event) => {
    const lockerId = event.params.lockerId;
    const wasAcknowledged = event.data.before.val();
    const isAcknowledged = event.data.after.val();
    if (!wasAcknowledged && isAcknowledged) {
        const commandSnapshot = await rtdb.ref(`commands/${lockerId}`).get();
        const commandData = commandSnapshot.val();
        await firestore.collection("events").add({
            lockerId,
            type: `command_ack_${((commandData === null || commandData === void 0 ? void 0 : commandData.command) || "unknown").toLowerCase()}`,
            detail: `ESP32 acknowledged ${commandData === null || commandData === void 0 ? void 0 : commandData.command} command`,
            createdAt: admin.firestore.Timestamp.now(),
            syncState: "synced",
            source: "rtdb_trigger"
        });
        logger.info(`[Command] ${lockerId} acknowledged: ${commandData === null || commandData === void 0 ? void 0 : commandData.command}`);
    }
});
// ── Scheduled: cleanupExpiredSnapshots ──────────────────────────────
exports.cleanupExpiredSnapshots = (0, scheduler_1.onSchedule)({ schedule: "every day 00:00", timeZone: "Asia/Kolkata" }, async (event) => {
    const now = admin.firestore.Timestamp.now();
    const bucket = storage.bucket();
    let deletedCount = 0;
    let errorCount = 0;
    const expiredSnapshots = await firestore
        .collection("biometric_snapshots")
        .where("expiresAt", "<=", now)
        .get();
    const batch = firestore.batch();
    for (const doc of expiredSnapshots.docs) {
        const data = doc.data();
        if (data.imageUrl) {
            try {
                const urlPath = data.imageUrl.split(`${bucket.name}/`)[1];
                if (urlPath) {
                    await bucket.file(urlPath).delete().catch(() => { });
                }
            }
            catch (_a) {
                errorCount++;
            }
        }
        batch.delete(doc.ref);
        deletedCount++;
    }
    if (deletedCount > 0) {
        await batch.commit();
    }
    const expiredTransactions = await firestore
        .collection("transaction_history")
        .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(new Date(Date.now() - SNAPSHOT_TTL_DAYS * 24 * 60 * 60 * 1000)))
        .get();
    const txBatch = firestore.batch();
    let txDeleted = 0;
    for (const doc of expiredTransactions.docs) {
        txBatch.delete(doc.ref);
        txDeleted++;
    }
    if (txDeleted > 0) {
        await txBatch.commit();
    }
    await firestore.collection("system_logs").add({
        action: "ttl_cleanup",
        detail: `Deleted ${deletedCount} expired biometric snapshots (${errorCount} storage errors). Purged ${txDeleted} transaction history records older than ${SNAPSHOT_TTL_DAYS} days.`,
        timestamp: now,
        source: "scheduled_function"
    });
    logger.info(`[Cleanup] TTL sweep complete: ${deletedCount} snapshots, ${txDeleted} transactions purged.`);
    return;
});
// ── RTDB Trigger: compileSessionToCSV ──────────────────────────────
exports.compileSessionToCSV = (0, database_1.onValueWritten)({
    region: "asia-southeast1",
    instance: "asep-10fe3-default-rtdb",
    ref: "data_collection/{mac}/sessions/{sessionId}/status"
}, async (event) => {
    const mac = event.params.mac;
    const sessionId = event.params.sessionId;
    const status = event.data.after.val();
    if (status !== "completed")
        return;
    logger.info(`[CSV Compiler] Session ${sessionId} for MAC ${mac} completed. Starting export...`);
    // 1. Fetch the session info (startTime, readings)
    const sessionRef = admin.database().ref(`data_collection/${mac}/sessions/${sessionId}`);
    const snapshot = await sessionRef.once("value");
    const sessionData = snapshot.val();
    if (!sessionData || !sessionData.readings) {
        logger.error(`[CSV Compiler] No readings found for session ${sessionId}`);
        return;
    }
    const startTime = sessionData.startTime || 0;
    const readings = sessionData.readings;
    // 2. Generate CSV content
    let csvContent = "internal_temp_c,external_temp_c,humidity_pct,gas_resistance_kohm,hours_elapsed,food_type,safety_label,days_remaining\n";
    const foodType = sessionData.food_type || "dairy";
    // Sort readings by timestamp
    const entries = Object.values(readings);
    entries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    // Automatically calculate session duration in hours
    const firstTimestamp = entries.length > 0 ? (entries[0].timestamp || startTime) : startTime;
    const lastTimestamp = entries.length > 0 ? (entries[entries.length - 1].timestamp || Date.now()) : Date.now();
    const sessionDurationHours = (lastTimestamp - firstTimestamp) / (1000.0 * 3600.0);
    // Use max_safe_days if manually specified in DB, otherwise auto-calculate based on experiment duration
    let maxSafeHours = sessionDurationHours;
    if (typeof sessionData.max_safe_days === "number") {
        maxSafeHours = sessionData.max_safe_days * 24.0;
    }
    else if (sessionData.max_safe_days && !isNaN(Number(sessionData.max_safe_days))) {
        maxSafeHours = Number(sessionData.max_safe_days) * 24.0;
    }
    // Fallback if the session was extremely short or empty
    if (maxSafeHours <= 0.05) {
        maxSafeHours = 1.0;
    }
    for (const entry of entries) {
        const timestamp = entry.timestamp || 0;
        const hoursElapsed = startTime ? (timestamp - startTime) / (1000.0 * 3600.0) : 0.0;
        const lifeFraction = maxSafeHours ? hoursElapsed / maxSafeHours : 0.0;
        const internalTemp = entry.internalTempC || 0.0;
        const externalTemp = entry.externalTempC || 0.0;
        const humidity = entry.humidityPct || 0.0;
        const gasKohm = entry.gasResistanceKohm || (entry.gasResistanceOhms || 0.0) / 1000.0;
        let safetyLabel = 0;
        if (lifeFraction < 0.50) {
            safetyLabel = 0;
        }
        else if (lifeFraction < 0.85) {
            safetyLabel = 1;
        }
        else {
            safetyLabel = 2;
        }
        const daysRemaining = maxSafeHours ? Math.max((maxSafeHours - hoursElapsed) / 24.0, 0.0) : 0.0;
        csvContent += `${internalTemp.toFixed(2)},${externalTemp.toFixed(2)},${humidity.toFixed(2)},${gasKohm.toFixed(2)},${hoursElapsed.toFixed(2)},${foodType},${safetyLabel},${daysRemaining.toFixed(2)}\n`;
    }
    // 3. Save to Firebase Storage
    try {
        const bucket = admin.storage().bucket();
        const filePath = `data_collection_exports/${mac}/${sessionId}.csv`;
        const file = bucket.file(filePath);
        await file.save(csvContent, {
            metadata: {
                contentType: "text/csv",
                metadata: {
                    macAddress: mac,
                    sessionId: sessionId,
                    foodType: foodType,
                    maxSafeDays: String(maxSafeHours / 24.0),
                    recordCount: String(entries.length)
                }
            }
        });
        await file.makePublic().catch(() => { });
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        // Update session with export info
        await sessionRef.update({
            csvUrl: publicUrl,
            exportedAt: admin.database.ServerValue.TIMESTAMP
        });
        logger.info(`[CSV Compiler] Session ${sessionId} exported successfully to ${filePath}`);
    }
    catch (err) {
        logger.error(`[CSV Compiler] Export failed: ${err.message}`);
    }
});
//# sourceMappingURL=index.js.map