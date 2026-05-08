import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const firestore = admin.firestore();
const rtdb = admin.database();
const storage = admin.storage();

const SIMILARITY_THRESHOLD = 0.6;
const MAX_RETRIEVALS_PER_DAY = 2;
const SNAPSHOT_TTL_DAYS = 28;

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// ── HTTPS Callable: setAdminClaim ─────────────────────────────────
export const setAdminClaim = functions.https.onCall(async (data, context) => {
  const { email, secret } = data;

  if (secret !== "SAFE_ADMIN_PROVISION_KEY_2026") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Invalid provisioning secret."
    );
  }

  if (!email) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Email is required."
    );
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    functions.logger.info(`[Admin] Admin claim set for ${email} (${user.uid})`);
    return { success: true, message: `Admin claim granted to ${email}` };
  } catch (err: any) {
    throw new functions.https.HttpsError(
      "not-found",
      `User with email ${email} not found: ${err.message}`
    );
  }
});

// ── HTTPS Callable: initiateDeposit ────────────────────────────────
export const initiateDeposit = functions.https.onCall(async (data, context) => {
  const {
    mac_address,
    item_name,
    dietary_tags,
    quantity,
    donor_name,
    donor_contact,
    allergens_notes,
    category_label,
    locker_number,
    donor_snapshot_base64
  } = data;

  if (!mac_address || !item_name) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "mac_address and item_name are required."
    );
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

      await file.makePublic().catch(() => {});
      donorSnapshotUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      await firestore.collection("biometric_snapshots").add({
        transactionId: donationId,
        lockerId: mac_address,
        role: "donor",
        imageUrl: donorSnapshotUrl,
        createdAt: now,
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(now.toDate().getTime() + SNAPSHOT_TTL_DAYS * 24 * 60 * 60 * 1000)
        )
      });

      functions.logger.info(`[Deposit] Donor snapshot uploaded for ${donationId}`);
    } catch (err: any) {
      functions.logger.error(`[Deposit] Snapshot upload failed: ${err.message}`);
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
  functions.logger.info(`[Deposit] Donation ${donationId} created for ${mac_address}`);

  await rtdb.ref(`commands/${mac_address}`).set({
    command: "UNLOCK",
    issuedAt: Date.now(),
    issuedBy: "cloud_function",
    acknowledged: false,
    donationId: donationId
  });
  functions.logger.info(`[Deposit] UNLOCK command sent to ${mac_address}`);

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
export const initiateRetrieval = functions.https.onCall(async (data, context) => {
  const { mac_address, receiver_descriptor, receiver_snapshot_base64 } = data;

  if (!mac_address) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "mac_address is required."
    );
  }

  if (receiver_descriptor && Array.isArray(receiver_descriptor)) {
    const twentyFourHoursAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const recentTransactions = await firestore
      .collection("transaction_history")
      .where("retrievedAt", ">=", twentyFourHoursAgo)
      .get();

    let matchCount = 0;

    for (const doc of recentTransactions.docs) {
      const storedDescriptor = doc.data().receiverDescriptor;
      if (!storedDescriptor || !Array.isArray(storedDescriptor)) continue;

      const distance = euclideanDistance(receiver_descriptor, storedDescriptor);
      if (distance < SIMILARITY_THRESHOLD) {
        matchCount++;
      }
    }

    if (matchCount >= MAX_RETRIEVALS_PER_DAY) {
      functions.logger.warn(
        `[Retrieval] Anti-hoarding block: face matched ${matchCount} times in 24h for ${mac_address}`
      );
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Community fair-use limit reached. Each person may collect up to 2 meals per day to ensure everyone has access."
      );
    }
  }

  const result = await firestore.runTransaction(async (transaction) => {
    const donationsQuery = await firestore
      .collection("donations")
      .where("lockerId", "==", mac_address)
      .where("status", "==", "deposited")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (donationsQuery.empty) {
      throw new functions.https.HttpsError(
        "not-found",
        "No active meal available in this locker."
      );
    }

    const donationDoc = donationsQuery.docs[0];
    const donationData = donationDoc.data();

    const freshSnap = await transaction.get(donationDoc.ref);
    if (!freshSnap.exists || freshSnap.data()?.status !== "deposited") {
      throw new functions.https.HttpsError(
        "aborted",
        "Meal already claimed by another user. Please try a different locker."
      );
    }

    const transactionId = firestore.collection("transaction_history").doc().id;
    const now = admin.firestore.Timestamp.now();

    transaction.update(donationDoc.ref, {
      status: "PENDING_HARDWARE",
      retrievalTransactionId: transactionId,
      updatedAt: now
    });

    let receiverSnapshotUrl = "";

    const transactionRecord: Record<string, any> = {
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

    transaction.set(
      firestore.collection("transaction_history").doc(transactionId),
      transactionRecord
    );

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
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + SNAPSHOT_TTL_DAYS * 24 * 60 * 60 * 1000)
        )
      });

      await firestore
        .collection("transaction_history")
        .doc(result.transactionId)
        .update({ receiverSnapshotUrl });
    } catch (err: any) {
      functions.logger.error(`[Retrieval] Receiver snapshot upload failed: ${err.message}`);
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

  functions.logger.info(
    `[Retrieval] PENDING_HARDWARE for ${result.donationId} at ${mac_address} (tx: ${result.transactionId})`
  );

  return {
    success: true,
    transactionId: result.transactionId,
    donationId: result.donationId,
    message: `Retrieval initiated at locker ${mac_address}`
  };
});

// ── RTDB Trigger: confirmRetrieval ─────────────────────────────────
export const confirmRetrieval = functions.database
  .ref("status/{lockerId}/door_state")
  .onUpdate(async (change, context) => {
    const lockerId = context.params.lockerId;
    const previousState = change.before.val();
    const currentState = change.after.val();

    if (previousState === "closed" && currentState === "open") {
      const donationsQuery = await firestore
        .collection("donations")
        .where("lockerId", "==", lockerId)
        .where("status", "==", "PENDING_HARDWARE")
        .limit(1)
        .get();

      if (donationsQuery.empty) return;

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

      functions.logger.info(
        `[ConfirmRetrieval] ${donationData.foodName} retrieval confirmed at ${lockerId}`
      );
    }
  });

// ── RTDB Trigger: onTelemetryWrite ─────────────────────────────────
export const onTelemetryWrite = functions.database
  .ref("telemetry/{lockerId}")
  .onWrite(async (change, context) => {
    const lockerId = context.params.lockerId;
    const data = change.after.val();

    if (!data) return;

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

      functions.logger.warn(`[Telemetry] Alert created for ${lockerId}: ${severity}`);

      if (severity === "critical") {
        await rtdb.ref(`commands/${lockerId}`).set({
          command: "LOCK",
          issuedAt: Date.now(),
          issuedBy: "cloud_function",
          acknowledged: false,
          reason: "spoilage_lockdown"
        });
        functions.logger.warn(`[Telemetry] Quarantine LOCK sent to ${lockerId}`);
      }
    }

    if (
      typeof edge_impulse_confidence === "number" &&
      edge_impulse_confidence < 0.1
    ) {
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

          functions.logger.warn(
            `[Telemetry] EMPTY_WARNING flagged for ${lockerId} — Edge Impulse confidence: ${edge_impulse_confidence}`
          );
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
export const onCommandAck = functions.database
  .ref("commands/{lockerId}/acknowledged")
  .onUpdate(async (change, context) => {
    const lockerId = context.params.lockerId;
    const wasAcknowledged = change.before.val();
    const isAcknowledged = change.after.val();

    if (!wasAcknowledged && isAcknowledged) {
      const commandSnapshot = await rtdb.ref(`commands/${lockerId}`).get();
      const commandData = commandSnapshot.val();

      await firestore.collection("events").add({
        lockerId,
        type: `command_ack_${(commandData?.command || "unknown").toLowerCase()}`,
        detail: `ESP32 acknowledged ${commandData?.command} command`,
        createdAt: admin.firestore.Timestamp.now(),
        syncState: "synced",
        source: "rtdb_trigger"
      });

      functions.logger.info(`[Command] ${lockerId} acknowledged: ${commandData?.command}`);
    }
  });

// ── Scheduled: cleanupExpiredSnapshots ──────────────────────────────
export const cleanupExpiredSnapshots = functions.pubsub
  .schedule("every day 00:00")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
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
            await bucket.file(urlPath).delete().catch(() => {});
          }
        } catch {
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
      .where(
        "createdAt",
        "<=",
        admin.firestore.Timestamp.fromDate(
          new Date(Date.now() - SNAPSHOT_TTL_DAYS * 24 * 60 * 60 * 1000)
        )
      )
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

    functions.logger.info(
      `[Cleanup] TTL sweep complete: ${deletedCount} snapshots, ${txDeleted} transactions purged.`
    );

    return null;
  });
