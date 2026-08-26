import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onValueUpdated, onValueWritten } from "firebase-functions/v2/database";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
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
export const setAdminClaim = onCall(async (request) => {
  const { email, secret } = request.data;

  if (secret !== "SAFE_ADMIN_PROVISION_KEY_2026") {
    throw new HttpsError(
      "permission-denied",
      "Invalid provisioning secret."
    );
  }

  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "Email is required."
    );
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    logger.info(`[Admin] Admin claim set for ${email} (${user.uid})`);
    return { success: true, message: `Admin claim granted to ${email}` };
  } catch (err: any) {
    throw new HttpsError(
      "not-found",
      `User with email ${email} not found: ${err.message}`
    );
  }
});

// ── HTTPS Callable: initiateDeposit ────────────────────────────────
export const initiateDeposit = onCall(async (request) => {
  const data = request.data;
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
    throw new HttpsError(
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

      logger.info(`[Deposit] Donor snapshot uploaded for ${donationId}`);
    } catch (err: any) {
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
export const initiateRetrieval = onCall(async (request) => {
  const { mac_address, receiver_descriptor, receiver_snapshot_base64 } = request.data;

  if (!mac_address) {
    throw new HttpsError(
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
      logger.warn(
        `[Retrieval] Anti-hoarding block: face matched ${matchCount} times in 24h for ${mac_address}`
      );
      throw new HttpsError(
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
      throw new HttpsError(
        "not-found",
        "No active meal available in this locker."
      );
    }

    const donationDoc = donationsQuery.docs[0];
    const donationData = donationDoc.data();

    const freshSnap = await transaction.get(donationDoc.ref);
    if (!freshSnap.exists || freshSnap.data()?.status !== "deposited") {
      throw new HttpsError(
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

  logger.info(
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
export const confirmRetrieval = onValueUpdated(
  "status/{lockerId}/door_state",
  async (event) => {
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

      logger.info(
        `[ConfirmRetrieval] ${donationData.foodName} retrieval confirmed at ${lockerId}`
      );
    }
  });

// ── RTDB Trigger: onTelemetryWrite ─────────────────────────────────
export const onTelemetryWrite = onValueWritten(
  "telemetry/{lockerId}",
  async (event) => {
    const lockerId = event.params.lockerId;
    const data = event.data.after.val();

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

          logger.warn(
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
export const onCommandAck = onValueUpdated(
  "commands/{lockerId}/acknowledged",
  async (event) => {
    const lockerId = event.params.lockerId;
    const wasAcknowledged = event.data.before.val();
    const isAcknowledged = event.data.after.val();

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

      logger.info(`[Command] ${lockerId} acknowledged: ${commandData?.command}`);
    }
  });

// ── Scheduled: cleanupExpiredSnapshots ──────────────────────────────
export const cleanupExpiredSnapshots = onSchedule(
  { schedule: "every day 00:00", timeZone: "Asia/Kolkata" },
  async (event) => {
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

    logger.info(
      `[Cleanup] TTL sweep complete: ${deletedCount} snapshots, ${txDeleted} transactions purged.`
    );

    return;
  }
);

// ── RTDB Trigger: compileSessionToCSV ──────────────────────────────
export const compileSessionToCSV = onValueWritten(
  {
    region: "asia-southeast1",
    instance: "asep-10fe3-default-rtdb",
    ref: "data_collection/{mac}/sessions/{sessionId}/status"
  },
  async (event) => {
    const mac = event.params.mac;
    const sessionId = event.params.sessionId;
    const status = event.data.after.val();

    if (status !== "completed") return;

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
    const entries = Object.values(readings) as any[];
    entries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // Automatically calculate session duration in hours
    const firstTimestamp = entries.length > 0 ? (entries[0].timestamp || startTime) : startTime;
    const lastTimestamp = entries.length > 0 ? (entries[entries.length - 1].timestamp || Date.now()) : Date.now();
    const sessionDurationHours = (lastTimestamp - firstTimestamp) / (1000.0 * 3600.0);

    // Use max_safe_days if manually specified in DB, otherwise auto-calculate based on experiment duration
    let maxSafeHours = sessionDurationHours;
    if (typeof sessionData.max_safe_days === "number") {
      maxSafeHours = sessionData.max_safe_days * 24.0;
    } else if (sessionData.max_safe_days && !isNaN(Number(sessionData.max_safe_days))) {
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
      } else if (lifeFraction < 0.85) {
        safetyLabel = 1;
      } else {
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

      await file.makePublic().catch(() => {});
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
      
      // Update session with export info
      await sessionRef.update({
        csvUrl: publicUrl,
        exportedAt: admin.database.ServerValue.TIMESTAMP
      });

      logger.info(`[CSV Compiler] Session ${sessionId} exported successfully to ${filePath}`);
    } catch (err: any) {
      logger.error(`[CSV Compiler] Export failed: ${err.message}`);
    }
  }
);

// ── HTTPS Callable: processVoiceCommand (AI Agent) ─────────────────
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI } from "@google/genai";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export const processVoiceCommand = onCall({ secrets: [geminiApiKey] }, async (request) => {
  const { text, history } = request.data;

  if (!text) {
    throw new HttpsError("invalid-argument", "Text input is required.");
  }
  let fallbackText = "";

  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    
    // --- RAG (Retrieval-Augmented Generation) ---
    let retrievedContext = "";

    try {
      const snapshot = await admin.firestore().collection("knowledge_base").limit(20).get();
      const docs = snapshot.docs.map((doc: any) => doc.data().text);
      if (docs.length > 0) {
        retrievedContext = "Relevant Knowledge Base Information:\n" + docs.map((d: any) => `- ${d}`).join("\n");
        logger.info(`[Voice Agent] Retrieved ${snapshot.docs.length} relevant documents.`);
      }

      // Fetch active locker status directly from the lockers collection (which is 1:1 with hardware/UI)
      const lockersSnap = await admin.firestore()
        .collection("lockers")
        .get();
      
      const lockerMap = new Map();
      lockersSnap.docs.forEach(doc => {
        const data = doc.data();
        let num = parseInt(doc.id.replace("chamber-", "").replace("locker_", ""), 10);
        
        if (num >= 1 && num <= 8) {
          if (data.occupancyState === "occupied" && data.item) {
            const foodName = data.item.foodName || "Unknown Food";
            const quality = data.foodQualityScore || "unknown";
            const tags = (data.item.dietTag ? [data.item.dietTag] : []).join(', ');
            lockerMap.set(num, `OCCUPIED - Contains "${foodName}" (Quality: ${quality}, Tags: ${tags})`);
          } else {
            lockerMap.set(num, `EMPTY (No food is stored here currently)`);
          }
        }
      });

      retrievedContext += "\n\n--- Current Real-Time Locker Contents ---";
      for (let i = 1; i <= 8; i++) {
        if (lockerMap.has(i)) {
          retrievedContext += `\nLocker ${i}: ${lockerMap.get(i)}`;
          fallbackText += `Locker ${i} contains ${lockerMap.get(i).split('"')[1] || "food"}. `;
        } else {
          retrievedContext += `\nLocker ${i}: EMPTY (No food is stored here currently)`;
          fallbackText += `Locker ${i} is empty. `;
        }
      }

    } catch (e: any) {
      logger.warn(`[Voice Agent] Failed to fetch RAG data: ${e.message}`);
    }
    // --------------------------------------------

    // Define the tools the AI can use to control the app
    const navigateTool = {
      name: "navigate",
      description: "Navigates the user to a specific page in the SAFE EcoLocker application. Available paths: '/donate' (donor dashboard to deposit food), '/receive' (receiver kiosk to collect food), '/admin' (admin analytics dashboard), '/' (home/mode selection), '/welcome' (landing page), '/visualizer' (data visualizer).",
      parameters: {
        type: "OBJECT",
        properties: {
          path: {
            type: "STRING",
            description: "The URL path to navigate to. Must be one of: '/', '/donate', '/receive', '/admin', '/welcome', '/visualizer'."
          }
        },
        required: ["path"]
      }
    };

    const triggerEventTool = {
      name: "triggerEvent",
      description: "Triggers a specific UI event in the application.",
      parameters: {
        type: "OBJECT",
        properties: {
          eventName: {
            type: "STRING",
            description: "The name of the event to trigger. Currently supported: 'open-help-widget', 'toggle-theme', 'set-theme-light', 'set-theme-dark'."
          }
        },
        required: ["eventName"]
      }
    };

    const systemInstruction = `You are EcoLocker AI — the intelligent voice assistant for the SAFE (Smart Automated Food Exchange) locker system.

Your capabilities:
1. NAVIGATION: Use the 'navigate' tool to take users to different sections.
   - '/donate' = Donor dashboard (for depositing food)
   - '/receive' = Receiver/Kiosk (for collecting food)
   - '/admin' = Admin dashboard (monitoring, analytics)
   - '/' = Home / Mode selection
   - '/welcome' = Landing page
   - '/visualizer' = Data visualizer
2. UI EVENTS: Use the 'triggerEvent' tool.
   - 'open-help-widget' = Opens the help/guide overlay
   - 'toggle-theme' = Toggle light/dark mode
   - 'set-theme-light' = Switch to light mode
   - 'set-theme-dark' = Switch to dark mode
3. KNOWLEDGE: Answer questions about the locker system, food policies, chamber contents, donation process, and food safety using the provided context.

Rules:
- Be concise — your text is spoken aloud via TTS. Keep answers under 2-3 sentences.
- If the user speaks Hindi or Marathi, respond in the SAME language.
- When asked about locker/chamber contents, ONLY use the real-time data provided below. Never guess or hallucinate.
- Refer to lockers as "Chamber 1", "Chamber 2", etc. when speaking.
- If a chamber is EMPTY, say it is empty. Do NOT mention any historical items.
- For navigation requests, ALWAYS use the navigate tool — never just describe the path.

${retrievedContext ? `\nUse the following context to answer the user's question if relevant:\n${retrievedContext}` : ''}`;

    // Build multi-turn contents from conversation history
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text }] });

    const modelConfig = {
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: [navigateTool as any, triggerEventTool as any] }],
      }
    };

    // Cascading model strategy: try primary first, fallback to lite on quota error
    const models = ["gemini-3.5-flash", "gemini-3.5-flash-lite"];
    let response: any = null;

    for (const model of models) {
      try {
        logger.info(`[Voice Agent] Trying model: ${model}`);
        response = await ai.models.generateContent({ model, ...modelConfig });
        logger.info(`[Voice Agent] Success with model: ${model}`);
        break; // Success — stop trying
      } catch (modelErr: any) {
        const is429 = (modelErr.message && modelErr.message.includes("429")) || modelErr.status === 429 || modelErr.code === 429;
        if (is429 && model !== models[models.length - 1]) {
          logger.warn(`[Voice Agent] Model ${model} quota exceeded, falling back to next model...`);
          continue; // Try next model
        }
        throw modelErr; // Not a 429, or last model also failed — rethrow to outer catch
      }
    }

    if (!response) {
      throw new Error("All models exhausted.");
    }

    // Check if the model decided to call a function
    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const args = call.args || {};
      logger.info(`[Voice Agent] Tool Call executed: ${call.name}`, args);
      
      return {
        success: true,
        type: "TOOL_CALL",
        toolName: call.name,
        args: args,
        message: call.name === 'navigate' ? `Navigating to ${(args as any).path}...` : `Triggering ${(args as any).eventName}...`
      };
    }

    // Otherwise, return the conversational response
    logger.info(`[Voice Agent] Conversational response generated.`);
    return {
      success: true,
      type: "CHAT_RESPONSE",
      message: response.text
    };

  } catch (err: any) {
    logger.error(`[Voice Agent] Error processing command: ${err.message}`);
    
    // Check for rate limit / quota exceeded
    if ((err.message && err.message.includes("429")) || err.status === 429 || err.code === 429) {
      logger.info(`[Voice Agent] Quota exceeded, executing offline intent parsing.`);
      const lower = text.toLowerCase();
      
      if (lower.includes("donate") || lower.includes("deposit") || lower.includes("give") || lower.includes("दान") || lower.includes("खाना") || lower.includes("देना") || lower.includes("जमा")) {
        return { success: true, type: "TOOL_CALL", toolName: "navigate", args: { path: "/donate" }, message: "Navigating to donor section." };
      }
      if (lower.includes("receive") || lower.includes("collect") || lower.includes("take") || lower.includes("get food") || lower.includes("लेना") || lower.includes("प्राप्त") || lower.includes("घेणे")) {
        return { success: true, type: "TOOL_CALL", toolName: "navigate", args: { path: "/receive" }, message: "Navigating to receive section." };
      }
      if (lower.includes("admin") || lower.includes("dashboard") || lower.includes("प्रबंधक") || lower.includes("डैशबोर्ड")) {
        return { success: true, type: "TOOL_CALL", toolName: "navigate", args: { path: "/admin" }, message: "Navigating to admin dashboard." };
      }
      if (lower.includes("home") || lower.includes("start") || lower.includes("back") || lower.includes("होम") || lower.includes("घर") || lower.includes("वापस")) {
        return { success: true, type: "TOOL_CALL", toolName: "navigate", args: { path: "/" }, message: "Navigating home." };
      }
      if (lower.includes("dark") || lower.includes("अंधेरा") || lower.includes("डार्क")) {
        return { success: true, type: "TOOL_CALL", toolName: "triggerEvent", args: { eventName: "set-theme-dark" }, message: "Switching to dark mode." };
      }
      if (lower.includes("light") || lower.includes("रोशनी") || lower.includes("लाइट")) {
        return { success: true, type: "TOOL_CALL", toolName: "triggerEvent", args: { eventName: "set-theme-light" }, message: "Switching to light mode." };
      }
      if (lower.includes("help") || lower.includes("how to") || lower.includes("guide") || lower.includes("मदद") || lower.includes("सहायता") || lower.includes("कैसे")) {
        return { success: true, type: "TOOL_CALL", toolName: "triggerEvent", args: { eventName: "open-help-widget" }, message: "Opening help guide." };
      }

      // Locker status queries
      if (lower.includes("locker") || lower.includes("chamber") || lower.includes("status") || lower.includes("what") || lower.includes("whats") || lower.includes("क्या") || lower.includes("लॉकर") || lower.includes("चेंबर")) {
        return {
          success: true,
          type: "CHAT_RESPONSE",
          message: fallbackText || "All lockers are currently empty."
        };
      }

      return {
        success: true,
        type: "CHAT_RESPONSE",
        message: "I'm currently in offline mode due to high demand. I can still help you navigate — try saying 'donate food', 'receive food', or 'show admin dashboard'."
      };
    }
    
    // Use 'unknown' instead of 'internal' so the frontend can see the actual error message
    throw new HttpsError("unknown", err.message || "Failed to process voice command.", err.message);
  }
});

// ── HTTPS Callable: seedKnowledgeBase ────────────────────────────────
export const seedKnowledgeBase = onCall({ secrets: [geminiApiKey] }, async (request) => {
  const { data } = request.data;
  
  if (!Array.isArray(data) || data.length === 0) {
    throw new HttpsError("invalid-argument", "Requires an array of text strings to seed.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    let count = 0;

    for (const text of data) {
      if (typeof text !== 'string') continue;
      
      // Generate embedding
      const embeddingResponse = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: text,
      });
      
      const vectorData = embeddingResponse.embeddings?.[0]?.values;
      if (vectorData) {
        await firestore.collection("knowledge_base").add({
          text,
          embedding: admin.firestore.FieldValue.vector(vectorData),
          createdAt: admin.firestore.Timestamp.now()
        });
        count++;
      }
    }

    return { success: true, message: `Successfully embedded and seeded ${count} documents into the knowledge base.` };
  } catch (err: any) {
    logger.error(`[Seed RAG] Error seeding data: ${err.message}`);
    throw new HttpsError("internal", "Failed to seed knowledge base.", err.message);
  }
});

