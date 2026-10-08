/**
 * qrSessionService.ts
 * Manages QR verification sessions and donor IP handshake in Firestore.
 *
 * Firestore collection: qr_sessions/
 *   {sessionId}: {
 *     sessionId, passkey, phone, donorName,
 *     status: "pending" | "scanned" | "verified" | "expired",
 *     createdAt,
 *     expiresAt,
 *     scannedAt?,        ← written when donor phone scans QR
 *     phoneIp?,          ← captured from the donor phone's HTTP request
 *     userAgent?,
 *     verified: boolean, ← false until 6-digit OTP entered on kiosk
 *     verifiedAt?        ← written when donor enters matching passkey on kiosk
 *   }
 */

import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe
} from "firebase/firestore";
import { db } from "./firebase";

export type QrSessionStatus = "pending" | "scanned" | "verified" | "expired";

export interface QrSession {
  sessionId: string;
  passkey: string;
  phone: string;
  donorName: string;
  status?: QrSessionStatus;
  createdAt: string;
  expiresAt?: string;
  scannedAt?: string;
  phoneIp?: string;
  userAgent?: string;
  verified: boolean;
  verifiedAt?: string;
  attempts?: number;
  _serverTs?: any;
  _scanTs?: any;
  _verifyTs?: any;
}

// In-memory cache for the current tab to prevent redundant external fetches
let _cachedIp: string | null = null;

function sanitizeIp(rawIp: unknown): string | null {
  if (typeof rawIp !== "string") return null;
  const cleaned = rawIp.trim().replace(/^::ffff:/, "");
  if (
    !cleaned ||
    cleaned === "unknown" ||
    cleaned === "127.0.0.1" ||
    cleaned === "::1" ||
    cleaned === "localhost"
  ) {
    return null;
  }
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleaned);
  const isIpv6 = cleaned.includes(":") && cleaned.length >= 3;
  return isIpv4 || isIpv6 ? cleaned : null;
}

/**
 * Fetch the client's public IP address with fast, multi-tier parallel fallbacks:
 * 1. Internal Vite / Cloudflare tunnel /api/client-ip endpoint
 * 2. Parallel race of top edge IP providers (Cloudflare trace, Ipify, IPWhois, JSONIP)
 */
export async function fetchClientIp(): Promise<string> {
  if (_cachedIp) return _cachedIp;

  // Tier 1: Local /api/client-ip (Cloudflare tunnel cf-connecting-ip / x-forwarded-for)
  try {
    const res = await fetch("/api/client-ip", { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      const valid = sanitizeIp(data?.ip);
      if (valid) {
        _cachedIp = valid;
        return valid;
      }
    }
  } catch {}

  // Tier 2: Parallel race of robust edge providers
  const providers = [
    async () => {
      const res = await fetch("https://cloudflare.com/cdn-cgi/trace", {
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) throw new Error("CF trace failed");
      const text = await res.text();
      const match = text.match(/ip=([^\r\n]+)/);
      const ip = sanitizeIp(match?.[1]);
      if (!ip) throw new Error("Invalid IP in CF trace");
      return ip;
    },
    async () => {
      const res = await fetch("https://api64.ipify.org?format=json", {
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) throw new Error("ipify64 failed");
      const data = await res.json();
      const ip = sanitizeIp(data?.ip);
      if (!ip) throw new Error("Invalid IP in ipify64");
      return ip;
    },
    async () => {
      const res = await fetch("https://api.ipify.org?format=json", {
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) throw new Error("ipify failed");
      const data = await res.json();
      const ip = sanitizeIp(data?.ip);
      if (!ip) throw new Error("Invalid IP in ipify");
      return ip;
    },
    async () => {
      const res = await fetch("https://ipwho.is/", {
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) throw new Error("ipwho.is failed");
      const data = await res.json();
      const ip = sanitizeIp(data?.ip);
      if (!ip) throw new Error("Invalid IP in ipwho.is");
      return ip;
    },
    async () => {
      const res = await fetch("https://jsonip.com/", {
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) throw new Error("jsonip failed");
      const data = await res.json();
      const ip = sanitizeIp(data?.ip);
      if (!ip) throw new Error("Invalid IP in jsonip");
      return ip;
    }
  ];

  try {
    const fastIp = await Promise.any(providers.map((p) => p()));
    if (fastIp) {
      _cachedIp = fastIp;
      return fastIp;
    }
  } catch (err) {
    console.warn("[QrSession] All parallel IP lookups failed:", err);
  }

  return "unknown";
}

/**
 * Called by the kiosk when a new QR verification session is initialized.
 * Generates initial session state with "pending" status and 60s TTL.
 */
export async function createQrSession(
  sessionId: string,
  phoneOrPasskey: string,
  donorNameOrPhone?: string,
  optionalDonorName?: string,
  expiresInSeconds: number = 60
): Promise<void> {
  if (!db) return;
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();

    // Support both signatures:
    // (sessionId, passkey, phone, donorName) OR (sessionId, phone, donorName)
    let phone = phoneOrPasskey;
    let donorName = donorNameOrPhone || "";
    let passkey = "";

    if (optionalDonorName !== undefined) {
      // Called with 4 params: (sessionId, passkey, phone, donorName)
      passkey = phoneOrPasskey;
      phone = donorNameOrPhone || "";
      donorName = optionalDonorName;
    }

    await setDoc(
      doc(db, "qr_sessions", sessionId),
      {
        sessionId,
        passkey,
        phone,
        donorName,
        status: "pending" as QrSessionStatus,
        createdAt: now.toISOString(),
        expiresAt,
        scannedAt: null,
        phoneIp: null,
        userAgent: null,
        verified: false,
        verifiedAt: null,
        _serverTs: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[QrSession] Failed to create session:", err);
  }
}

/**
 * Called by the phone's landing page (/qr-scan) after scanning the QR code.
 * Captures the phone's client IP and instantly completes verification.
 * No passkey or manual code entry required from donor!
 */
export async function recordQrScan(
  sessionId: string,
  phone?: string,
  passkey?: string
): Promise<string> {
  let phoneIp = "unknown";
  try {
    phoneIp = await fetchClientIp();
  } catch (err) {
    console.warn("[QrSession] fetchClientIp failed, using fallback:", err);
  }

  const nowIso = new Date().toISOString();

  // Instant cross-tab broadcast for same-device simulation or desktop testing
  try {
    if (typeof window !== "undefined") {
      const payload = {
        sessionId,
        phoneIp,
        phone: phone || "",
        verified: true,
        verifiedAt: nowIso,
        status: "verified"
      };
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel("safe_qr_channel");
        bc.postMessage(payload);
        bc.close();
      }
      try {
        localStorage.setItem("safe_qr_verified_event", JSON.stringify(payload));
      } catch {}
    }
  } catch {}

  if (!db) return phoneIp;

  try {
    const docData: any = {
      sessionId,
      status: "verified" as QrSessionStatus,
      scannedAt: nowIso,
      phoneIp,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
      verified: true,
      verifiedAt: nowIso,
      _scanTs: serverTimestamp(),
      _verifyTs: serverTimestamp(),
      _serverTs: serverTimestamp()
    };
    if (phone) docData.phone = phone;
    if (passkey) docData.passkey = passkey;

    await setDoc(doc(db, "qr_sessions", sessionId), docData, { merge: true });
    console.log(`[QrSession] Verified QR scan for session ${sessionId} with IP ${phoneIp}`);
  } catch (err) {
    console.warn("[QrSession] Failed to record scan in qr_sessions:", err);
  }

  // Record audit log
  try {
    const { addDoc, collection } = await import("firebase/firestore");
    await addDoc(collection(db, "activeLogs"), {
      lockerId: "kiosk-delta",
      type: "qr_verification",
      detail: `Donor scanned QR code. Contactless verification confirmed via IP: ${phoneIp}${phone ? ` (Phone: +91 ${phone})` : ""}`,
      phoneIp,
      phone: phone || null,
      sessionId,
      status: "verified",
      createdAt: nowIso,
      syncState: "synced"
    });
  } catch {}

  return phoneIp;
}

/**
 * Called by the Kiosk (QrDonorVerifier) when the donor enters the 6-digit passkey.
 * Finalizes the session: sets verified = true, status = "verified", and records verifiedAt.
 */
export async function confirmQrPasskey(
  sessionId: string,
  enteredPasskey: string
): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: "Database unavailable" };

  try {
    const sessionRef = doc(db, "qr_sessions", sessionId);
    const snap = await getDoc(sessionRef);

    if (!snap.exists()) {
      return { success: false, error: "Session not found" };
    }

    const data = snap.data() as QrSession;

    if (data.passkey !== enteredPasskey) {
      return { success: false, error: "Incorrect passkey" };
    }

    const nowIso = new Date().toISOString();
    await updateDoc(sessionRef, {
      status: "verified" as QrSessionStatus,
      verified: true,
      verifiedAt: nowIso,
      _verifyTs: serverTimestamp()
    });

    try {
      const { addDoc, collection } = await import("firebase/firestore");
      await addDoc(collection(db, "activeLogs"), {
        lockerId: "kiosk-delta",
        type: "qr_verification",
        detail: `Donor phone passkey verified on kiosk (+91 ${data.phone}). IP: ${data.phoneIp || "unknown"}`,
        phoneIp: data.phoneIp || null,
        phone: data.phone || null,
        sessionId,
        status: "verified",
        createdAt: nowIso,
        syncState: "synced"
      });
    } catch {}

    return { success: true };
  } catch (err) {
    console.warn("[QrSession] Failed to confirm passkey:", err);
    return { success: false, error: "Verification failed" };
  }
}

/**
 * Rotates the 6-digit passkey for an active session when the expiration timestamp is reached.
 * Updates Firestore with new passkey and new expiresAt timestamp.
 * Any donor phone listening via subscribeQrSession will immediately update its passkey in real time.
 */
export async function rotateQrPasskey(
  sessionId: string,
  newPasskey?: string,
  expiresInSeconds: number = 60
): Promise<string> {
  if (!db) return "";
  const code = newPasskey || Math.floor(100000 + Math.random() * 900000).toString();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();

  try {
    await updateDoc(doc(db, "qr_sessions", sessionId), {
      passkey: code,
      expiresAt,
      _serverTs: serverTimestamp()
    });
    console.log(`[QrSession] Passkey rotated for session ${sessionId} -> ${code}, expires: ${expiresAt}`);
  } catch (err) {
    console.warn("[QrSession] Failed to rotate passkey:", err);
  }

  return code;
}

/**
 * Kiosk or mobile page subscribes to this — calls onUpdate whenever the session doc changes in realtime.
 * Also listens to cross-tab BroadcastChannel and storage events for zero-latency local simulation.
 */
export function subscribeQrSession(
  sessionId: string,
  onUpdate: (session: QrSession | null) => void
): Unsubscribe {
  let unsubFirestore: Unsubscribe = () => {};

  if (db) {
    unsubFirestore = onSnapshot(
      doc(db, "qr_sessions", sessionId),
      (snap) => {
        if (!snap.exists()) {
          onUpdate(null);
          return;
        }
        onUpdate(snap.data() as QrSession);
      },
      (err) => {
        console.warn("[QrSession] Subscription error:", err);
        onUpdate(null);
      }
    );
  }

  // Cross-tab broadcast listener for instant local reactions
  let bc: BroadcastChannel | null = null;
  const handleBcMessage = (event: MessageEvent) => {
    if (event.data?.sessionId === sessionId) {
      onUpdate({
        sessionId,
        passkey: "",
        phone: event.data.phone || "",
        donorName: "",
        status: "verified",
        createdAt: new Date().toISOString(),
        phoneIp: event.data.phoneIp,
        verified: true,
        verifiedAt: event.data.verifiedAt || new Date().toISOString()
      });
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === "safe_qr_verified_event" && event.newValue) {
      try {
        const data = JSON.parse(event.newValue);
        if (data.sessionId === sessionId) {
          onUpdate({
            sessionId,
            passkey: "",
            phone: data.phone || "",
            donorName: "",
            status: "verified",
            createdAt: new Date().toISOString(),
            phoneIp: data.phoneIp,
            verified: true,
            verifiedAt: data.verifiedAt || new Date().toISOString()
          });
        }
      } catch {}
    }
  };

  if (typeof window !== "undefined") {
    if ("BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel("safe_qr_channel");
        bc.onmessage = handleBcMessage;
      } catch {}
    }
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    unsubFirestore();
    if (bc) {
      bc.close();
      bc = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

/**
 * Permanently deletes all recorded QR audit sessions from Cloud Firestore.
 */
export async function clearAllQrSessions(): Promise<{ success: boolean; count: number; error?: string }> {
  if (!db) return { success: false, count: 0, error: "Database not initialized" };
  try {
    const snap = await getDocs(collection(db, "qr_sessions"));
    if (snap.empty) {
      return { success: true, count: 0 };
    }

    const batchSize = 400;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + batchSize);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    return { success: true, count: snap.size };
  } catch (err: any) {
    console.error("[QrSession] Failed to clear all sessions:", err);
    return { success: false, count: 0, error: err?.message || "Failed to clear logs" };
  }
}

