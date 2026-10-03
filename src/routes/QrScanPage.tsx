import React, { useEffect, useState, useRef, Component, type ErrorInfo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  recordQrScan,
  subscribeQrSession,
  rotateQrPasskey,
  type QrSession
} from "../services/qrSessionService";
import {
  ShieldCheck,
  Check,
  Copy,
  Wifi,
  AlertTriangle,
  Sparkles,
  LockOpen,
  QrCode
} from "lucide-react";

type Phase = "loading" | "success" | "already_used" | "invalid" | "error";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackCode?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class QrScanErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("[QrScanPage] Caught render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100dvh", width: "100%", background: "#f8fafc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 20, padding: "2rem", width: "100%", maxWidth: 360, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.5rem" }}>Your Donor Passkey</h2>
            {this.props.fallbackCode ? (
              <div style={{ fontSize: "2.5rem", fontWeight: 900, fontFamily: "monospace", color: "#059669", letterSpacing: "0.2em", margin: "1rem 0" }}>
                {this.props.fallbackCode}
              </div>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Please scan the QR code again from the kiosk.</p>
            )}
            <p style={{ fontSize: "0.8rem", color: "#64748b" }}>Enter this 6-digit code on the kiosk screen to unlock your locker.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function QrScanPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("sid") || "";
  const initialCode = params.get("code") || "";
  const phone = params.get("phone") || "";

  return (
    <QrScanErrorBoundary fallbackCode={initialCode}>
      <QrScanContent
        sessionId={sessionId}
        initialCode={initialCode}
        phone={phone}
      />
    </QrScanErrorBoundary>
  );
}

function QrScanContent({
  sessionId,
  initialCode,
  phone
}: {
  sessionId: string;
  initialCode: string;
  phone: string;
}) {
  // If we already have the passkey from the URL, show it immediately without waiting for network!
  const [phase, setPhase] = useState<Phase>(initialCode ? "success" : "loading");
  const [passkey, setPasskey] = useState<string>(initialCode);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [isRotated, setIsRotated] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [capturedIp, setCapturedIp] = useState<string>("");

  // Override html zoom on mobile so there's never an awkward 20% cut-off at bottom
  useEffect(() => {
    const prevZoom = document.documentElement.style.zoom;
    document.documentElement.style.zoom = "1";
    return () => {
      document.documentElement.style.zoom = prevZoom;
    };
  }, []);

  // 1. Initial Scan Recording (runs in background so donor sees passkey instantly!)
  useEffect(() => {
    if (!sessionId) {
      if (!initialCode) setPhase("invalid");
      return;
    }

    let cancelled = false;

    async function doRecord() {
      try {
        const ip = await recordQrScan(sessionId, phone, initialCode);
        if (!cancelled) {
          if (ip && ip !== "unknown") setCapturedIp(ip);
          setPhase("success");
        }
      } catch (err) {
        console.warn("[QrScanPage] recordQrScan non-fatal error:", err);
        // Even if IP recording has a network glitch, never show a blank screen if we have the code!
        if (!cancelled && !initialCode) {
          setPhase("error");
        }
      }
    }

    doRecord();
    return () => {
      cancelled = true;
    };
  }, [sessionId, initialCode, phone]);

  // 2. Realtime Listener: Automatically update passkey and status when Firestore changes
  useEffect(() => {
    if (!sessionId) return;

    try {
      const unsub = subscribeQrSession(sessionId, (session: QrSession | null) => {
        if (!session) return;

        // When the passkey changes in Firestore, automatically update on phone!
        if (session.passkey && session.passkey !== passkey) {
          setPasskey(session.passkey);
          setIsRotated(true);
          setTimeout(() => setIsRotated(false), 2800);
        }

        if (session.expiresAt) {
          setExpiresAt(session.expiresAt);
        }

        if (session.verified) {
          setIsVerified(true);
        }

        if (session.phoneIp) {
          setCapturedIp(session.phoneIp);
        }
      });

      return () => unsub();
    } catch (err) {
      console.warn("[QrScanPage] Firestore subscription error:", err);
    }
  }, [sessionId, passkey]);

  // 3. Countdown & Automatic Rotation when the timestamp is reached
  useEffect(() => {
    if (!expiresAt || phase !== "success" || isVerified || !sessionId) return;

    const checkTimestamp = () => {
      const targetTime = new Date(expiresAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.round((targetTime - now) / 1000));
      setSecondsLeft(diff);

      // Whenever the timestamp is reached, auto-rotate!
      if (diff <= 0) {
        rotateQrPasskey(sessionId, undefined, 60).catch(console.warn);
      }
    };

    checkTimestamp();
    const interval = setInterval(checkTimestamp, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, phase, isVerified, sessionId]);

  // Timer color indicator
  const timerDotColor =
    secondsLeft > 25 ? "#10b981" : secondsLeft > 10 ? "#f59e0b" : "#ef4444";

  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        backgroundColor: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem 1rem",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box"
      }}
    >
      <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Minimalist Top Brand Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: "#ecfdf5",
              border: "1px solid #a7f3d0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#059669"
            }}
          >
            <ShieldCheck style={{ width: 18, height: 18 }} />
          </div>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#059669" }}>
            SAFE Food Locker
          </span>
        </div>

        {phase === "loading" && <LoadingState />}

        {phase === "success" && (
          isVerified ? (
            <VerifiedState phone={phone} capturedIp={capturedIp} />
          ) : (
            <SuccessState
              passkey={passkey}
              phone={phone}
              capturedIp={capturedIp}
              secondsLeft={secondsLeft}
              timerDotColor={timerDotColor}
              isRotated={isRotated}
            />
          )
        )}

        {phase === "invalid" && (
          <ErrorState
            title="Scan Kiosk QR Code"
            message="Please point your phone camera at the QR code displayed on the SAFE kiosk screen to view your passkey."
          />
        )}

        {phase === "error" && (
          <ErrorState
            title="Connection Notice"
            message="Could not connect to the kiosk session. Please check your internet connection and scan the kiosk QR again."
          />
        )}

        {/* Minimalist Footer */}
        <p style={{ marginTop: "1.5rem", fontSize: "0.72rem", color: "#94a3b8", textAlign: "center" }}>
          Secure Access Food Exchange · Passkey Verification
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 20,
        padding: "2.5rem 1.5rem",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        textAlign: "center"
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid #e2e8f0",
          borderTopColor: "#059669",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Connecting to Kiosk…</h3>
      <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0, maxWidth: 260 }}>
        Synchronizing your device with the locker terminal.
      </p>
    </div>
  );
}

function SuccessState({
  passkey,
  phone,
  capturedIp,
  secondsLeft,
  timerDotColor,
  isRotated
}: {
  passkey: string;
  phone: string;
  capturedIp?: string;
  secondsLeft: number;
  timerDotColor: string;
  isRotated: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(passkey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedPhone = phone ? phone.replace(/(\d{5})(\d{5})/, "$1 $2") : "";

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 24,
        padding: "1.75rem 1.5rem",
        width: "100%",
        boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        boxSizing: "border-box"
      }}
    >
      {/* Live Handshake Status Chip & Sync Countdown */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.3rem 0.75rem",
            borderRadius: 999,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#059669"
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
          <span>Connected to Kiosk</span>
        </div>

        {/* Live Countdown Pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.3rem 0.65rem",
            borderRadius: 999,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            fontSize: "0.72rem",
            fontWeight: 600,
            color: "#475569"
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: timerDotColor }} />
          <span>{secondsLeft > 0 ? `Valid for ${secondsLeft}s` : "Rotating…"}</span>
        </div>
      </div>

      <h1
        style={{
          fontSize: "1.35rem",
          fontWeight: 800,
          color: "#0f172a",
          margin: "0 0 0.25rem 0",
          letterSpacing: "-0.01em"
        }}
      >
        Your One-Time Passkey
      </h1>

      <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0 0 1rem 0" }}>
        {formattedPhone ? `+91 ${formattedPhone} · ` : ""}Enter code on the kiosk screen
      </p>

      {/* Auto-Rotation Notification Pill */}
      <AnimatePresence>
        {isRotated && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.25rem 0.75rem",
              borderRadius: 8,
              background: "#dcfce7",
              border: "1px solid #86efac",
              color: "#15803d",
              fontSize: "0.75rem",
              fontWeight: 700,
              marginBottom: "0.75rem"
            }}
          >
            <Sparkles style={{ width: 13, height: 13 }} />
            <span>Passkey Auto-Refreshed!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Passkey Box with Animated Number Transition */}
      <div
        style={{
          background: "linear-gradient(180deg, #f0fdf4 0%, #ecfdf5 100%)",
          border: "1.5px solid #a7f3d0",
          borderRadius: 20,
          padding: "1.25rem 1rem",
          width: "100%",
          boxSizing: "border-box",
          marginBottom: "1rem",
          position: "relative"
        }}
      >
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 800,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#059669",
            display: "block",
            marginBottom: "0.5rem"
          }}
        >
          6-DIGIT PASSKEY
        </span>

        {/* Dynamic Keyframe Pop whenever passkey rotates */}
        <motion.div
          key={passkey}
          initial={{ scale: 0.92, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={{
            fontSize: "2.75rem",
            fontWeight: 900,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            color: "#064e3b",
            letterSpacing: "0.25em",
            textIndent: "0.25em",
            lineHeight: 1.1,
            userSelect: "all"
          }}
        >
          {passkey}
        </motion.div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          style={{
            marginTop: "0.75rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            background: "#ffffff",
            border: "1px solid #a7f3d0",
            borderRadius: 8,
            padding: "0.35rem 0.75rem",
            fontSize: "0.72rem",
            fontWeight: 600,
            color: copied ? "#059669" : "#475569",
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
            transition: "all 0.15s ease"
          }}
        >
          {copied ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
          <span>{copied ? "Copied to clipboard!" : "Copy Code"}</span>
        </button>
      </div>

      {/* Simple 2-Step Quick Guide */}
      <div
        style={{
          width: "100%",
          background: "#f8fafc",
          border: "1px solid #f1f5f9",
          borderRadius: 14,
          padding: "0.85rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          textAlign: "left",
          marginBottom: "1rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#e2e8f0",
              color: "#475569",
              fontSize: "0.7rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            1
          </span>
          <span style={{ fontSize: "0.8rem", color: "#334155", fontWeight: 500 }}>
            Enter the 6-digit code on the kiosk touchscreen
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#e2e8f0",
              color: "#475569",
              fontSize: "0.7rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            2
          </span>
          <span style={{ fontSize: "0.8rem", color: "#334155", fontWeight: 500 }}>
            The locker will unlock automatically
          </span>
        </div>
      </div>

      {/* Refined Minimalist Device IP & Security Telemetry */}
      {capturedIp && capturedIp !== "unknown" ? (
        <DeviceIpBadge ip={capturedIp} />
      ) : (
        <div
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "#f8fafc",
            border: "1px dashed #cbd5e1",
            borderRadius: 12,
            padding: "0.5rem 0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.4rem",
            fontSize: "0.7rem",
            color: "#64748b"
          }}
        >
          <Wifi style={{ width: 12, height: 12, color: "#10b981" }} />
          <span>Device Connected · Resolving Telemetry…</span>
        </div>
      )}
    </div>
  );
}

function DeviceIpBadge({ ip }: { ip: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopyIp = () => {
    navigator.clipboard?.writeText(ip);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: "0.65rem 0.85rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)"
      }}
    >
      {/* Top Header: Network Identity & Security Status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#10b981",
              boxShadow: "0 0 6px rgba(16, 185, 129, 0.5)"
            }}
          />
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#64748b"
            }}
          >
            Device Network IP
          </span>
        </div>

        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            color: "#059669",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: 999,
            padding: "0.15rem 0.5rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem"
          }}
        >
          <ShieldCheck style={{ width: 11, height: 11 }} />
          <span>TLS Secured</span>
        </span>
      </div>

      {/* Monospace IP Address Box with Tap-to-Copy */}
      <div
        onClick={handleCopyIp}
        title="Tap to copy IP address"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "0.4rem 0.65rem",
          cursor: "pointer",
          transition: "border-color 0.15s ease"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0, flex: 1 }}>
          <Wifi style={{ width: 13, height: 13, color: "#059669", flexShrink: 0 }} />
          <span
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "0.74rem",
              fontWeight: 700,
              color: "#1e293b",
              wordBreak: "break-all",
              lineHeight: 1.35,
              letterSpacing: "0.01em"
            }}
          >
            {ip}
          </span>
        </div>

        <span
          style={{
            fontSize: "0.65rem",
            color: copied ? "#059669" : "#64748b",
            fontWeight: 600,
            flexShrink: 0,
            background: copied ? "#ecfdf5" : "#f8fafc",
            border: `1px solid ${copied ? "#a7f3d0" : "#e2e8f0"}`,
            padding: "0.15rem 0.45rem",
            borderRadius: 6
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </span>
      </div>
    </div>
  );
}

function VerifiedState({ phone, capturedIp }: { phone: string; capturedIp?: string }) {
  const formattedPhone = phone ? phone.replace(/(\d{5})(\d{5})/, "$1 $2") : "";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "#ffffff",
        border: "1.5px solid #86efac",
        borderRadius: 24,
        padding: "1.75rem 1.5rem",
        width: "100%",
        boxShadow: "0 4px 20px -2px rgba(16, 185, 129, 0.12)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        boxSizing: "border-box",
        gap: "0.85rem"
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#ecfdf5",
          border: "2px solid #a7f3d0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#059669"
        }}
      >
        <LockOpen style={{ width: 26, height: 26 }} />
      </div>

      <div>
        <span
          style={{
            fontSize: "0.68rem",
            fontWeight: 800,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#059669",
            display: "block",
            marginBottom: "0.25rem"
          }}
        >
          Locker Unlocked
        </span>

        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.35rem 0" }}>
          Verification Confirmed!
        </h2>

        <p style={{ fontSize: "0.82rem", color: "#475569", margin: 0, lineHeight: 1.5 }}>
          {formattedPhone ? `Donor +91 ${formattedPhone} authenticated. ` : ""}
          Please place your food donation into the open locker chamber and push the door closed.
        </p>
      </div>

      {capturedIp && capturedIp !== "unknown" && (
        <DeviceIpBadge ip={capturedIp} />
      )}

      <div
        style={{
          padding: "0.45rem 0.85rem",
          borderRadius: 10,
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          fontSize: "0.72rem",
          color: "#166534",
          fontWeight: 600
        }}
      >
        ✓ You may now close this browser tab
      </div>
    </motion.div>
  );
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #fecaca",
        borderRadius: 20,
        padding: "2rem 1.5rem",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        textAlign: "center"
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#fee2e2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#dc2626"
        }}
      >
        <AlertTriangle style={{ width: 22, height: 22 }} />
      </div>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>{title}</h3>
      <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0, lineHeight: 1.5 }}>{message}</p>
    </div>
  );
}
