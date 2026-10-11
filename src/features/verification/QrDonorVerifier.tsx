import React, { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  QrCode,
  ExternalLink,
  Wifi,
  Smartphone,
  Sparkles
} from "lucide-react";
import {
  createQrSession,
  subscribeQrSession,
  recordQrScan,
  type QrSession
} from "../../services/qrSessionService";
import { useTranslation } from "../../store/useTranslation";

interface QrDonorVerifierProps {
  phoneNumber: string;
  donorName: string;
  isVerified: boolean;
  onVerified: (verified: boolean, timestamp?: string, ip?: string) => void;
  disabled?: boolean;
}

/** Generate a UUID-ish session ID */
function makeSessionId() {
  return `qrs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Permanent cloud deployment URL for mobile cameras scanning from outside local network */
const PERMANENT_CLOUD_URL = "https://asep-10fe3.web.app";

/**
 * Returns the universal base URL for QR codes.
 * - In production or when hosted: uses the actual origin
 * - In local development: encodes the permanent cloud URL so mobile devices on 4G/5G
 *   can reach the scan page and handshake via the shared cloud Firestore database.
 * - For same-device simulation ("Test Link in Tab"): uses window.location.origin directly.
 */
export function getQrBaseUrl(forSameDevice: boolean = false): string {
  if (typeof window !== "undefined") {
    // If testing on the same machine/browser tab, always use the current window's origin:
    if (forSameDevice && window.location.origin) {
      return `${window.location.origin.replace(/\/$/, "")}/qr-scan`;
    }

    const hostname = window.location.hostname;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";

    // If running on a live domain or accessible LAN IP (not localhost), use current origin:
    if (!isLocalhost && window.location.origin) {
      return `${window.location.origin.replace(/\/$/, "")}/qr-scan`;
    }
  }

  // Check explicit environment variable (if user configured a custom tunnel or public URL)
  const envUrl = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.trim();
  const isDeadTunnel = envUrl && envUrl.includes("trycloudflare.com");
  if (envUrl && !isDeadTunnel) {
    return `${envUrl.replace(/\/$/, "")}/qr-scan`;
  }

  // Permanent cloud production fallback for external mobile camera scans
  return `${PERMANENT_CLOUD_URL}/qr-scan`;
}

export function QrDonorVerifier({
  phoneNumber,
  donorName,
  isVerified,
  onVerified,
  disabled = false
}: QrDonorVerifierProps) {
  const { t } = useTranslation();
  const [sessionId, setSessionId] = useState<string>("");
  const [timerSeconds, setTimerSeconds] = useState<number>(60);
  const [scanDetected, setScanDetected] = useState<boolean>(false);
  const [scannedIp, setScannedIp] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<QrSession | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevPhoneRef = useRef<string>(phoneNumber);
  const donorNameRef = useRef<string>(donorName);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    donorNameRef.current = donorName;
  }, [donorName]);

  const isPhoneValid = /^\d{10}$/.test(phoneNumber.replace(/\D/g, ""));

  // ── Start a new QR session ──────────────────────────────────────────
  const startNewSession = useCallback(async () => {
    const newSessionId = makeSessionId();

    setSessionId(newSessionId);
    setTimerSeconds(60);
    setScanDetected(false);
    setScannedIp(null);
    setSessionData(null);
    setIsSimulating(false);

    // Clean up old Firestore subscription
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    if (isPhoneValid) {
      // Write session to Firestore (no code/passkey needed!)
      await createQrSession(newSessionId, phoneNumber, donorNameRef.current);

      // Subscribe for real-time scan and IP detection events from the phone
      const unsub = subscribeQrSession(newSessionId, (session) => {
        if (!session) return;
        setSessionData(session);

        // When the donor scans the QR and their IP address is detected:
        if (session.phoneIp || session.verified || session.scannedAt) {
          const detectedIp = session.phoneIp || "unknown";
          setScanDetected(true);
          setScannedIp(detectedIp);

          // Auto-verify immediately upon scan & IP detection!
          onVerified(
            true,
            session.verifiedAt || session.scannedAt || new Date().toISOString(),
            detectedIp
          );
        }
      });
      unsubRef.current = unsub;
    }
  }, [isPhoneValid, phoneNumber, onVerified]);

  // Reset when phone number changes
  useEffect(() => {
    if (prevPhoneRef.current !== phoneNumber) {
      prevPhoneRef.current = phoneNumber;
      if (isVerified) onVerified(false);
      if (isPhoneValid) startNewSession();
    } else if (!sessionId && isPhoneValid && !isVerified) {
      startNewSession();
    }
  }, [phoneNumber, isPhoneValid, isVerified, onVerified, sessionId, startNewSession]);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  // 60-second countdown → auto-rotate unless phone already scanned or verified
  useEffect(() => {
    if (!sessionId || isVerified || scanDetected) return;

    if (timerSeconds <= 0) {
      startNewSession();
      return;
    }
    const interval = setInterval(() => setTimerSeconds((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [timerSeconds, sessionId, isVerified, scanDetected, startNewSession]);

  // Render QR code onto canvas (optimized for phone camera recognition)
  useEffect(() => {
    if (!canvasRef.current || !sessionId || isVerified) return;

    // Contactless URL: contains session ID and phone number, NO passkey code!
    const qrUrl = `${getQrBaseUrl(false)}?sid=${sessionId}&phone=${encodeURIComponent(phoneNumber)}`;

    QRCode.toCanvas(
      canvasRef.current,
      qrUrl,
      {
        width: 155,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
        errorCorrectionLevel: "L"
      },
      (err) => {
        if (err) console.error("[QR Render Error]", err);
      }
    );
  }, [sessionId, isVerified, phoneNumber]);

  // Handle instant simulation for testing without physical phone
  const handleSimulateScan = async () => {
    if (!sessionId || isSimulating) return;
    setIsSimulating(true);
    try {
      const ip = await recordQrScan(sessionId, phoneNumber);
      setScanDetected(true);
      setScannedIp(ip);
      onVerified(true, new Date().toISOString(), ip);
    } catch (e) {
      console.warn("[QrDonorVerifier] Simulation failed:", e);
    } finally {
      setIsSimulating(false);
    }
  };

  // Timer colour
  const timerColor =
    timerSeconds > 30 ? "#059669" : timerSeconds > 10 ? "#d97706" : "#dc2626";

  // Formatted phone helper
  const formattedPhone = phoneNumber.replace(/(\d{5})(\d{5})/, "$1 $2");

  // ── SUB-CARD 1: DONOR VERIFIED (Confirmation Text Displayed on PWA) ──
  if (isVerified) {
    const activeIp =
      scannedIp ||
      sessionData?.phoneIp ||
      "Logged & Secured";

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        style={{
          background: "#ffffff",
          borderColor: "#6ee7b7",
          boxShadow: "0 4px 16px -2px rgba(16, 185, 129, 0.12), 0 1px 3px rgba(0, 0, 0, 0.04)"
        }}
        className="w-full relative overflow-hidden rounded-2xl p-3.5 sm:p-4 border text-slate-900"
      >
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* High-Contrast Shield Badge */}
            <div 
              style={{ background: "#d1fae5", borderColor: "#a7f3d0" }}
              className="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 shadow-xs"
            >
              <ShieldCheck className="w-6 h-6" style={{ color: "#047857" }} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span 
                  style={{ color: "#047857", background: "#ecfdf5", borderColor: "#a7f3d0" }}
                  className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border"
                >
                  ✓ QR Verification Confirmed
                </span>
                {donorName && donorName !== phoneNumber && donorName.trim().length > 0 && (
                  <>
                    <span style={{ color: "#94a3b8" }} className="text-xs font-bold">•</span>
                    <span 
                      style={{ color: "#334155" }}
                      className="text-xs font-semibold truncate max-w-[150px] sm:max-w-[220px]"
                    >
                      {donorName}
                    </span>
                  </>
                )}
              </div>
              <h3 
                style={{ color: "#0f172a" }}
                className="text-base sm:text-lg font-extrabold font-mono tracking-tight mt-1"
              >
                +91 {formattedPhone}
              </h3>
            </div>
          </div>

          {/* Change Number / Rescan Button */}
          <button
            type="button"
            onClick={() => {
              onVerified(false);
              startNewSession();
            }}
            disabled={disabled}
            style={{
              background: "#ffffff",
              borderColor: "#cbd5e1",
              color: "#1e293b"
            }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150 shadow-xs hover:bg-slate-50 hover:border-slate-400 active:scale-95 cursor-pointer"
            title="Change mobile number or scan again"
          >
            <RefreshCw className="w-3.5 h-3.5" style={{ color: "#475569" }} />
            <span>{t("changeNumber", "Scan Again")}</span>
          </button>
        </div>

        {/* Confirmation Text & Detected IP Telemetry */}
        <div
          style={{
            borderTop: "1px solid #f1f5f9",
            color: "#334155"
          }}
          className="mt-3 pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-medium"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold text-emerald-800">
              Phone scanned & IP address detected successfully.
            </span>
          </div>
          
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600">
              <Wifi className="w-3 h-3 text-emerald-600" />
              <span>IP: {activeIp}</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
              Verified
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── PENDING / QR DISPLAY (Contactless Scan, No Code Entry) ─────────────
  return (
    <div className="w-full mt-1 mb-1.5">
      <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0 shadow-2xs">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 truncate">
                {t("instantQrVerification", "Instant QR Verification")}
              </h4>
              <p className="text-[11px] text-slate-500 truncate">
                {isPhoneValid
                  ? t("scanWithPhoneForPasskey", "Scan with your phone camera to verify instantly")
                  : t("enterMobileToGenerateQr", "Enter mobile number above to generate QR")}
              </p>
            </div>
          </div>

          {isPhoneValid && (
            <button
              type="button"
              onClick={startNewSession}
              disabled={disabled}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 font-semibold text-xs whitespace-nowrap transition-colors shadow-2xs cursor-pointer shrink-0 active:scale-95"
              title="Refresh QR Code"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>{t("newQr", "New QR")}</span>
            </button>
          )}
        </div>

        {isPhoneValid && (
          <div className="space-y-3.5 pt-1">
            {/* Top Row: QR Code (Left) + Contactless Steps (Right) */}
            <div className="grid grid-cols-[auto_1fr] items-center gap-4 sm:gap-6">
              {/* QR Container */}
              <div className="flex flex-col items-center shrink-0">
                <div className="p-2.5 rounded-xl bg-white shadow-xs border border-slate-200">
                  <canvas
                    ref={canvasRef}
                    className="block rounded-lg"
                    style={{ width: "155px", height: "155px" }}
                  />
                </div>
                {/* Connection Status / Countdown Timer */}
                <div className="flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-mono font-medium shadow-2xs">
                  {scanDetected ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-700 font-semibold">
                        {t("phoneConnected", "Verifying IP Address…")}
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: timerColor }}
                      />
                      <span className="text-slate-600">
                        {t("validFor", "Valid for")}{" "}
                        <strong className="tabular-nums" style={{ color: timerColor }}>
                          {timerSeconds}s
                        </strong>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* 3 Step Contactless Instructions */}
              <div className="space-y-3 min-w-0">
                {[
                  {
                    n: "1",
                    done: scanDetected,
                    title: t("scanQrStep1", "Scan QR with Camera"),
                    desc: "Point your phone camera at the QR code"
                  },
                  {
                    n: "2",
                    done: scanDetected,
                    title: t("scanQrStep2", "Detect Device & IP"),
                    desc: "System detects donor IP automatically"
                  },
                  {
                    n: "3",
                    done: isVerified,
                    title: t("scanQrStep3", "Instant Confirmation"),
                    desc: "No code or typing required"
                  }
                ].map((step) => (
                  <div
                    key={step.n}
                    className="flex items-start gap-2.5 text-xs transition-colors"
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 transition-colors ${
                        step.done
                          ? "bg-emerald-500 text-white shadow-2xs"
                          : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                      }`}
                    >
                      {step.done ? "✓" : step.n}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-bold leading-tight ${step.done ? "text-emerald-800" : "text-slate-800"}`}>
                        {step.title}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Row: Contactless Status Bar & Testing Shortcuts (NO 6-DIGIT CODE!) */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Scan from phone to confirm automatically.</span>
              </div>

              {/* Simulation / Dev Helper Links */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const qrUrl = `${getQrBaseUrl(true)}?sid=${sessionId}&phone=${encodeURIComponent(phoneNumber)}`;
                    window.open(qrUrl, "_blank");
                  }}
                  className="flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold px-2 py-1 rounded-md bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-200/80 transition-colors cursor-pointer"
                  title="Simulate scanning this QR code in a new browser tab"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Test Link in Tab</span>
                </button>

                <button
                  type="button"
                  onClick={handleSimulateScan}
                  disabled={isSimulating}
                  className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                  title="Directly trigger IP detection simulation"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>{isSimulating ? "Verifying…" : "Simulate Scan"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
