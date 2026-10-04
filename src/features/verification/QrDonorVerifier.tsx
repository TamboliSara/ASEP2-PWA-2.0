import React, { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Eye,
  EyeOff,
  ExternalLink,
  Lock
} from "lucide-react";
import {
  createQrSession,
  subscribeQrSession,
  confirmQrPasskey,
  type QrSession
} from "../../services/qrSessionService";

interface QrDonorVerifierProps {
  phoneNumber: string;
  donorName: string;
  isVerified: boolean;
  onVerified: (verified: boolean, timestamp?: string, ip?: string) => void;
  disabled?: boolean;
}

/** Generate a random 6-digit passkey */
function makePasskey() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Generate a UUID-ish session ID */
function makeSessionId() {
  return `qrs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Permanent cloud deployment URL for mobile cameras scanning from outside local network */
const PERMANENT_CLOUD_URL = "https://asep-10fe3.web.app";

/**
 * Returns the universal base URL for QR codes.
 * - In production or when hosted: uses the actual origin (e.g. https://asep-10fe3.web.app or custom domain)
 * - In local development: encodes the permanent cloud URL so mobile devices on 4G/5G or separate Wi-Fi
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
  // Protect against expired/dead trycloudflare URLs:
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
  const [passkey, setPasskey] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [timerSeconds, setTimerSeconds] = useState<number>(60);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDirectCode, setShowDirectCode] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [scanDetected, setScanDetected] = useState<boolean>(false);
  const [scannedIp, setScannedIp] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<QrSession | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const prevPhoneRef = useRef<string>(phoneNumber);
  const donorNameRef = useRef<string>(donorName);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    donorNameRef.current = donorName;
  }, [donorName]);

  const isPhoneValid = /^\d{10}$/.test(phoneNumber.replace(/\D/g, ""));

  // ── Start a new QR session ──────────────────────────────────────────
  const startNewSession = useCallback(async () => {
    const newPasskey = makePasskey();
    const newSessionId = makeSessionId();

    setPasskey(newPasskey);
    setSessionId(newSessionId);
    setTimerSeconds(60);
    setDigits(["", "", "", "", "", ""]);
    setErrorMessage(null);
    setScanDetected(false);
    setScannedIp(null);
    setSessionData(null);

    // Clean up old Firestore subscription
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    if (isPhoneValid) {
      // Write session to Firestore
      await createQrSession(newSessionId, newPasskey, phoneNumber, donorNameRef.current);

      // Subscribe for real-time scan events from the phone
      const unsub = subscribeQrSession(newSessionId, (session) => {
        if (!session) return;
        setSessionData(session);
        if (session.scannedAt) {
          setScanDetected(true);
          if (session.phoneIp) {
            setScannedIp(session.phoneIp);
          }
          // Auto-focus the first PIN input when phone scans
          setTimeout(() => {
            inputRefs.current[0]?.focus();
          }, 100);
        }
      });
      unsubRef.current = unsub;
    }
  }, [isPhoneValid, phoneNumber]);

  // Reset when phone number changes
  useEffect(() => {
    if (prevPhoneRef.current !== phoneNumber) {
      prevPhoneRef.current = phoneNumber;
      if (isVerified) onVerified(false);
      if (isPhoneValid) startNewSession();
    } else if (!passkey && isPhoneValid && !isVerified) {
      startNewSession();
    }
  }, [phoneNumber, isPhoneValid, isVerified, onVerified, passkey, startNewSession]);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  // 60-second countdown → auto-rotate unless phone already scanned
  useEffect(() => {
    if (!passkey || isVerified) return;
    // Don't interrupt donor while their phone is actively connected
    if (scanDetected) return;

    if (timerSeconds <= 0) {
      startNewSession();
      return;
    }
    const interval = setInterval(() => setTimerSeconds((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [timerSeconds, passkey, isVerified, scanDetected, startNewSession]);

  // Render QR code onto canvas (optimized for phone camera recognition)
  useEffect(() => {
    if (!canvasRef.current || !passkey || !sessionId || isVerified) return;

    const qrUrl = `${getQrBaseUrl(false)}?sid=${sessionId}&code=${passkey}&phone=${encodeURIComponent(phoneNumber)}`;

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
  }, [passkey, sessionId, isVerified, phoneNumber]);

  // Digit entry and auto-focus
  const handleDigitChange = (index: number, val: string) => {
    setErrorMessage(null);
    const raw = val.replace(/\D/g, "");

    if (raw.length >= 6) {
      const next = raw.slice(0, 6).split("");
      setDigits(next);
      inputRefs.current[5]?.focus();
      triggerManualVerify(next.join(""));
      return;
    }

    const single = raw.slice(-1);
    const updated = [...digits];
    updated[index] = single;
    setDigits(updated);

    if (single && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (updated.every((d) => d !== "") && updated.join("").length === 6) {
      triggerManualVerify(updated.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const triggerManualVerify = (code?: string) => {
    const toVerify = code || digits.join("");
    if (toVerify.length !== 6) {
      setErrorMessage("Please enter all 6 digits.");
      return;
    }
    setIsVerifying(true);
    setErrorMessage(null);

    setTimeout(() => {
      setIsVerifying(false);
      if (toVerify === passkey) {
        // Sync verification to Firestore so the donor's phone screen also shows Verified!
        if (sessionId) {
          confirmQrPasskey(sessionId, toVerify).catch((err) => {
            console.warn("[QrDonorVerifier] confirmQrPasskey sync notice:", err);
          });
        }
        // ONLY verified when the donor actually enters the correct 6-digit OTP!
        onVerified(true, new Date().toISOString(), scannedIp || sessionData?.phoneIp);
      } else {
        setErrorMessage("Incorrect passkey. Please check the 6-digit code on your phone.");
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    }, 300);
  };

  // Timer colour
  const timerColor =
    timerSeconds > 30 ? "#059669" : timerSeconds > 10 ? "#d97706" : "#dc2626";

  // Formatted phone helper
  const formattedPhone = phoneNumber.replace(/(\d{5})(\d{5})/, "$1 $2");

  // ── SUB-CARD 1: DONOR VERIFIED (Clean, Minimalist & High-Contrast Light Theme) ──
  if (isVerified) {
    const activeIp =
      scannedIp ||
      sessionData?.phoneIp;

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
        className="w-full relative overflow-hidden rounded-2xl p-3 sm:p-3.5 border text-slate-900"
      >
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* High-Contrast Shield Badge */}
            <div 
              style={{ background: "#d1fae5", borderColor: "#a7f3d0" }}
              className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 shadow-xs"
            >
              <ShieldCheck className="w-6 h-6" style={{ color: "#047857" }} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span 
                  style={{ color: "#047857" }}
                  className="text-[11px] font-extrabold uppercase tracking-wider block"
                >
                  Donor Verified
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
                className="text-base sm:text-lg font-extrabold font-mono tracking-tight mt-0.5"
              >
                +91 {formattedPhone}
              </h3>
            </div>
          </div>

          {/* High-Contrast Change Button */}
          <button
            type="button"
            onClick={() => {
              onVerified(false);
              startNewSession();
            }}
            style={{
              background: "#ffffff",
              borderColor: "#cbd5e1",
              color: "#1e293b"
            }}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150 shadow-xs hover:bg-slate-50 hover:border-slate-400 active:scale-95 cursor-pointer"
            title="Change mobile number or scan again"
          >
            <RefreshCw className="w-3.5 h-3.5" style={{ color: "#475569" }} />
            <span>Change Number</span>
          </button>
        </div>

        {/* Security & IP Protection Note */}
        <div
          style={{
            borderTop: "1px solid #f1f5f9",
            color: "#475569"
          }}
          className="mt-2.5 pt-2 flex items-center justify-between gap-2 text-[11px] font-medium"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">Your IP address is stored in our system and is protected.</span>
          </div>
          {activeIp && (
            <span
              style={{
                color: "#64748b",
                background: "#f8fafc",
                borderColor: "#e2e8f0"
              }}
              className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 hidden sm:inline-block"
              title="Recorded Client IP"
            >
              {activeIp}
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  // ── PENDING / QR DISPLAY (Light Theme & Minimalistic) ───────────────────
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
                Instant QR Verification
              </h4>
              <p className="text-[11px] text-slate-500 truncate">
                {isPhoneValid
                  ? "Scan with your phone to receive your passkey"
                  : "Enter mobile number above to generate QR"}
              </p>
            </div>
          </div>

          {isPhoneValid && (
            <button
              type="button"
              onClick={startNewSession}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 font-semibold text-xs whitespace-nowrap transition-colors shadow-2xs cursor-pointer shrink-0 active:scale-95"
              title="Refresh QR Code"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>New QR</span>
            </button>
          )}
        </div>

        {isPhoneValid && (
          <div className="space-y-4 pt-1">
            {/* Top Row: QR Code (Left) + 3 Quick Steps (Right) */}
            <div className="grid grid-cols-[auto_1fr] items-center gap-4 sm:gap-6">
              {/* QR Container */}
              <div className="flex flex-col items-center shrink-0">
                <div className="p-2.5 rounded-xl bg-white shadow-xs border border-slate-200">
                  <canvas ref={canvasRef} className="block rounded-lg" style={{ width: '155px', height: '155px' }} />
                </div>
                {/* Connection Status / Countdown Timer */}
                <div className="flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-mono font-medium shadow-2xs">
                  {scanDetected ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-700 font-semibold">
                        Phone Connected
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: timerColor }}
                      />
                      <span className="text-slate-600">
                        Valid for{" "}
                        <strong className="tabular-nums" style={{ color: timerColor }}>
                          {timerSeconds}s
                        </strong>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* 3 Step Instructions with dynamic real-time status */}
              <div className="space-y-2.5 min-w-0">
                {[
                  {
                    n: "1",
                    done: scanDetected,
                    text: scanDetected ? "Phone connected to kiosk" : "Scan QR with your phone camera"
                  },
                  {
                    n: "2",
                    done: scanDetected && digits.some((d) => d !== ""),
                    text: "View 6-digit code on your phone"
                  },
                  {
                    n: "3",
                    done: isVerified,
                    text: "Enter the code below to verify"
                  }
                ].map((step) => (
                  <div
                    key={step.n}
                    className={`flex items-center gap-2.5 text-xs font-medium transition-colors ${
                      step.done ? "text-emerald-700 font-semibold" : "text-slate-600"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 transition-colors ${
                        step.done
                          ? "bg-emerald-500 text-white shadow-2xs"
                          : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                      }`}
                    >
                      {step.done ? "✓" : step.n}
                    </div>
                    <span className="truncate">{step.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Row: Full-Width Centered 6-Digit PIN Boxes (Never Clipped!) */}
            <div className="pt-2 border-t border-slate-100 flex flex-col items-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Enter 6-Digit Passkey
              </p>

              <div className="flex items-center justify-center gap-2 sm:gap-2.5 w-full">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    disabled={disabled || isVerifying}
                    className={`w-9 h-11 sm:w-10 sm:h-12 text-center text-lg sm:text-xl font-bold font-mono rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 ${
                      digit
                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-800 font-black shadow-2xs focus:ring-emerald-500/20"
                        : "border-slate-300 bg-white text-slate-900 placeholder-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                    }`}
                    placeholder="•"
                  />
                ))}
                {isVerifying && (
                  <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin ml-1 shrink-0" />
                )}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-600 shadow-2xs"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}

              {/* Desktop Helper Toggle */}
              <div className="flex items-center gap-3 mt-3 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={() => setShowDirectCode(!showDirectCode)}
                  className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showDirectCode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showDirectCode ? "Hide Passkey" : "Desktop Test (Show Code)"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const qrUrl = `${getQrBaseUrl(true)}?sid=${sessionId}&code=${passkey}&phone=${encodeURIComponent(phoneNumber)}`;
                    window.open(qrUrl, "_blank");
                  }}
                  className="flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold transition-colors cursor-pointer"
                  title="Simulate scanning this QR code in a new browser tab"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Test Link in Tab</span>
                </button>

                {showDirectCode && (
                  <button
                    type="button"
                    onClick={() => {
                      setDigits(passkey.split(""));
                      triggerManualVerify(passkey);
                    }}
                    className="px-2.5 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] border border-emerald-200 cursor-pointer transition-colors"
                  >
                    Quick Fill ({passkey})
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
