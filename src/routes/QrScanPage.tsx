import React, { useEffect, useState, Component, type ErrorInfo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  recordQrScan,
  subscribeQrSession,
  type QrSession
} from "../services/qrSessionService";
import {
  ShieldCheck,
  Check,
  Copy,
  Wifi,
  AlertTriangle,
  LockOpen,
  CheckCircle2,
  Smartphone
} from "lucide-react";

type Phase = "loading" | "verified" | "invalid" | "error";

interface ErrorBoundaryProps {
  children: ReactNode;
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
        <div
          style={{
            minHeight: "100dvh",
            width: "100%",
            background: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem"
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 20,
              padding: "2rem",
              width: "100%",
              maxWidth: 360,
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
            }}
          >
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.5rem" }}>
              QR Verification
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
              Please scan the QR code displayed on the kiosk screen with your phone camera.
            </p>
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
  const phone = params.get("phone") || "";

  return (
    <QrScanErrorBoundary>
      <QrScanContent sessionId={sessionId} phone={phone} />
    </QrScanErrorBoundary>
  );
}

function QrScanContent({
  sessionId,
  phone
}: {
  sessionId: string;
  phone: string;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [capturedIp, setCapturedIp] = useState<string>("");

  // Override html zoom on mobile so layout fits properly without pinch cutoffs
  useEffect(() => {
    const prevZoom = document.documentElement.style.zoom;
    document.documentElement.style.zoom = "1";
    return () => {
      document.documentElement.style.zoom = prevZoom;
    };
  }, []);

  // 1. Initial Scan Recording & IP Detection
  useEffect(() => {
    if (!sessionId) {
      setPhase("invalid");
      return;
    }

    let cancelled = false;

    async function doRecordAndVerify() {
      try {
        const ip = await recordQrScan(sessionId, phone);
        if (!cancelled) {
          if (ip && ip !== "unknown") {
            setCapturedIp(ip);
          }
          setPhase("verified");
        }
      } catch (err) {
        console.warn("[QrScanPage] recordQrScan error:", err);
        if (!cancelled) {
          setPhase("error");
        }
      }
    }

    doRecordAndVerify();
    return () => {
      cancelled = true;
    };
  }, [sessionId, phone]);

  // 2. Realtime Listener: Keep session updated
  useEffect(() => {
    if (!sessionId) return;

    try {
      const unsub = subscribeQrSession(sessionId, (session: QrSession | null) => {
        if (!session) return;
        if (session.phoneIp) {
          setCapturedIp(session.phoneIp);
        }
        if (session.verified || session.status === "verified") {
          setPhase("verified");
        }
      });

      return () => unsub();
    } catch (err) {
      console.warn("[QrScanPage] Firestore subscription error:", err);
    }
  }, [sessionId]);

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
      <div style={{ width: "100%", maxWidth: 390, display: "flex", flexDirection: "column", alignItems: "center" }}>
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

        {phase === "verified" && (
          <VerifiedState phone={phone} capturedIp={capturedIp} />
        )}

        {phase === "invalid" && (
          <ErrorState
            title="Scan Kiosk QR Code"
            message="Please point your phone camera at the active QR code displayed on the SAFE kiosk screen to verify your device."
          />
        )}

        {phase === "error" && (
          <ErrorState
            title="Connection Notice"
            message="Could not establish connection to the kiosk. Please check your network and scan the kiosk QR code again."
          />
        )}

        {/* Minimalist Footer */}
        <p style={{ marginTop: "1.5rem", fontSize: "0.72rem", color: "#94a3b8", textAlign: "center" }}>
          Secure Access Food Exchange · Contactless QR Verification
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
        borderRadius: 24,
        padding: "2.5rem 1.5rem",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
        textAlign: "center"
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          border: "3.5px solid #e2e8f0",
          borderTopColor: "#059669",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
        Detecting Device IP…
      </h3>
      <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0, maxWidth: 280, lineHeight: 1.5 }}>
        Authenticating your mobile device and verifying your network address with the kiosk.
      </p>
    </div>
  );
}

function VerifiedState({ phone, capturedIp }: { phone: string; capturedIp?: string }) {
  const formattedPhone = phone ? phone.replace(/(\d{5})(\d{5})/, "$1 $2") : "";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "#ffffff",
        border: "1.5px solid #86efac",
        borderRadius: 24,
        padding: "1.85rem 1.5rem",
        width: "100%",
        boxShadow: "0 8px 24px -4px rgba(16, 185, 129, 0.15)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        boxSizing: "border-box",
        gap: "1.1rem"
      }}
    >
      {/* High-Contrast Success Icon with Glow */}
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: "50%",
          background: "#ecfdf5",
          border: "2px solid #a7f3d0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#059669",
          boxShadow: "0 0 20px rgba(16, 185, 129, 0.2)"
        }}
      >
        <LockOpen style={{ width: 28, height: 28 }} />
      </div>

      <div>
        <span
          style={{
            fontSize: "0.68rem",
            fontWeight: 800,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#059669",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            padding: "0.2rem 0.6rem",
            borderRadius: 999,
            display: "inline-block",
            marginBottom: "0.5rem"
          }}
        >
          ✓ Verification Confirmed
        </span>

        <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.35rem 0" }}>
          You're Verified!
        </h2>

        {/* Confirmation Text Requirement */}
        <p style={{ fontSize: "0.84rem", color: "#475569", margin: 0, lineHeight: 1.5 }}>
          Your phone scan and IP address have been detected and confirmed. The locker is now unlocked on the kiosk screen.
        </p>
      </div>

      {/* Telemetry and Device Network Details Card */}
      <div
        style={{
          width: "100%",
          background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: "0.85rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem",
          textAlign: "left"
        }}
      >
        {formattedPhone && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.78rem" }}>
            <span style={{ color: "#64748b", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <Smartphone style={{ width: 13, height: 13 }} />
              Donor Mobile
            </span>
            <span style={{ fontWeight: 700, color: "#1e293b", fontFamily: "monospace" }}>
              +91 {formattedPhone}
            </span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.78rem" }}>
          <span style={{ color: "#64748b", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Wifi style={{ width: 13, height: 13, color: "#059669" }} />
            Detected IP Address
          </span>
          <span style={{ fontWeight: 700, color: "#0f172a", fontFamily: "monospace", background: "#ffffff", padding: "0.15rem 0.5rem", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            {capturedIp && capturedIp !== "unknown" ? capturedIp : "Logged & Verified"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.78rem", borderTop: "1px dashed #e2e8f0", paddingTop: "0.5rem" }}>
          <span style={{ color: "#64748b", fontWeight: 500 }}>Locker Status</span>
          <span style={{ color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <CheckCircle2 style={{ width: 13, height: 13 }} />
            Unlocked & Ready
          </span>
        </div>
      </div>

      {/* Locker Instruction Banner */}
      <div
        style={{
          width: "100%",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 14,
          padding: "0.75rem 0.9rem",
          textAlign: "center"
        }}
      >
        <p style={{ fontSize: "0.8rem", color: "#166534", fontWeight: 600, margin: 0, lineHeight: 1.45 }}>
          Please place your food donation into the open locker chamber and push the door closed.
        </p>
      </div>

      <div
        style={{
          padding: "0.4rem 0.75rem",
          borderRadius: 8,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          fontSize: "0.72rem",
          color: "#64748b",
          fontWeight: 500
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
