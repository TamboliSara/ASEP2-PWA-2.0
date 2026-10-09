import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { set } from "firebase/database";
import { chamberCameraRef, chamberCameraSignalingRef } from "../services/firebase";
import { useLockerController } from "../features/locker/useLockerController";
import { useChamberCamera } from "../features/camera/useChamberCamera";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";
import { ScrollReveal } from "../components/effects/ScrollReveal";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bluetooth, 
  ShieldCheck, 
  Activity, 
  Database, 
  Check, 
  Loader2, 
  Wifi, 
  AlertCircle,
  Camera,
  Smartphone,
  Copy,
  ExternalLink,
  Flashlight,
  ArrowRight,
  EyeOff,
  Cpu,
  QrCode,
  Radio,
  AlertTriangle
} from "lucide-react";
import { HARDWARE_LOCKER_ID } from "../store/appState";

type PairingStep = "idle" | "ble_discovery" | "cloud_register" | "state_sync" | "complete" | "error";

export function ConnectPage() {
  const navigate = useNavigate();
  const { state } = useAppContext();
  const { currentLocker, pairLocker, pairWithMac, isBusy } = useLockerController();
  const { 
    isPhoneConnected, 
    isStreaming,
    lastFrameDataUrl, 
    streamFps, 
    videoRef,
    attachVideoRef,
    sourceMode,
    setSourceMode,
    isFoodPresent,
    confidence,
    cameraTelemetry,
    cameraError,
    isSyntheticStream,
    isStartingWebcam,
    retryWebcam,
    useTestFeed
  } = useChamberCamera(HARDWARE_LOCKER_ID);

  const { t } = useTranslation();
  const [pairingStep, setPairingStep] = useState<PairingStep>("idle");
  const [pairingCancelled, setPairingCancelled] = useState(false);
  const [customMacInput, setCustomMacInput] = useState("");
  const [showAdvancedMac, setShowAdvancedMac] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [resolvedPhoneUrl, setResolvedPhoneUrl] = useState<string>("");
  const [qrProtocolMode, setQrProtocolMode] = useState<"https" | "http">("https");
  const [copiedLink, setCopiedLink] = useState(false);
  const [forceShowQr, setForceShowQr] = useState(false);

  const isRealHardwarePaired = !!state.hardwareMac && state.hardwareMac !== "SIMULATED" && state.hardwareMac !== "";
  const isNode2Active = sourceMode === "remote_phone" 
    ? (isPhoneConnected && !forceShowQr) 
    : isStreaming;
  const detectedObjects = cameraTelemetry?.detectedObjects || [];
  const detectedObject = detectedObjects[0];
  const primaryFoodObject = detectedObjects.find(o => 
    o.category === "fruit" || 
    o.category === "vegetable" || 
    o.category === "cooked_meal" || 
    o.category === "container" || 
    o.category === "beverage" || 
    o.category === "bakery"
  );
  const primaryPersonObject = detectedObjects.find(o => o.label.toLowerCase().includes("person"));

  const handleUnpairPhone = useCallback(async () => {
    setForceShowQr(true);
    try {
      await set(chamberCameraRef(HARDWARE_LOCKER_ID), {
        connected: false,
        activeSessionId: "",
        latestFrame: "",
        lastHeartbeat: 0
      });
      await set(chamberCameraSignalingRef(HARDWARE_LOCKER_ID), {});
    } catch (e) {
      console.warn("[ConnectPage] Error unpairing chamber phone:", e);
    }
  }, []);

  // Generate accessible phone pairing URL for the Chamber Lens
  useEffect(() => {
    const host = "192.168.0.109";
    const port = qrProtocolMode === "https" ? "5174" : (window.location.port || "5173");
    const phoneUrl = `${qrProtocolMode}://${host}:${port}/chamber-lens?locker=${HARDWARE_LOCKER_ID}`;
    setResolvedPhoneUrl(phoneUrl);
    QRCode.toDataURL(phoneUrl, { margin: 1, width: 260 })
      .then(setQrCodeDataUrl)
      .catch(console.error);
  }, [qrProtocolMode]);

  const steps = useMemo(() => [
    { text: "ESP32 Bluetooth Bridge", subtitle: "Door Solenoid & BLE Beacon", icon: Bluetooth, key: "ble_discovery", active: isRealHardwarePaired },
    { text: "Chamber Optical Node", subtitle: sourceMode === "local_webcam" ? (isSyntheticStream ? "Optical Test Feed" : "USB Camera Feed") : "In-Chamber Smartphone", icon: Camera, key: "camera_node", active: isNode2Active },
    { text: "Sensors & State Sync", subtitle: "Telemetry & Cloud Database", icon: Database, key: "cloud_register", active: isRealHardwarePaired || isNode2Active },
    { text: "System Armed & Online", subtitle: "Ready for Kiosk Deposits", icon: Activity, key: "complete", active: isRealHardwarePaired && isNode2Active },
  ], [isRealHardwarePaired, isNode2Active, sourceMode, isSyntheticStream]);

  const verifiedCount = steps.filter(s => s.active).length;
  const isAllReady = isRealHardwarePaired && isNode2Active;

  const handlePair = useCallback(async () => {
    setPairingCancelled(false);
    setPairingStep("ble_discovery");
    const success = await pairLocker();

    if (success) {
      setPairingStep("complete");
    } else {
      if (state.syncMessage.includes("cancelled")) {
        setPairingCancelled(true);
        setPairingStep("idle");
      } else {
        setPairingStep("error");
      }
    }
  }, [pairLocker, state.syncMessage]);

  const handleQuickPair = useCallback(async (mac?: string) => {
    setPairingCancelled(false);
    setPairingStep("cloud_register");
    const success = await pairWithMac(mac);
    if (success) {
      setPairingStep("complete");
    }
  }, [pairWithMac]);

  const handleCopyLink = () => {
    if (resolvedPhoneUrl) {
      navigator.clipboard.writeText(resolvedPhoneUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <section className="connect-shell-luxe glass-panel-luxe min-h-[85vh]">
      <div className="ambient-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <div className="nature-leaf-accent leaf-top-right">🍃</div>
      <div className="nature-leaf-accent leaf-bottom-left">🌿</div>

      {/* ── Top Header Banner (Full Width) ── */}
      <ScrollReveal direction="down" className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="space-y-1.5 max-w-2xl">
            <div className="eyebrow-badge">
              <span className="pulsing-dot-green" />
              <span>Kiosk Hardware Initialization</span>
            </div>
            
            <h1 className="hero-title-luxe text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
              Connect Locker Hardware <span className="accent-text inline">& Chamber Camera.</span>
            </h1>
            
            <p className="hero-body-luxe text-xs sm:text-sm text-slate-600 dark:text-text-muted leading-relaxed">
              Pair the ESP32 controller over Bluetooth for lock control, and link the in-chamber smart camera phone that stays inside Locker #1 during deposits.
            </p>
          </div>

          {/* System Readiness Pill & Node Counter */}
          <div className="flex md:flex-col items-start md:items-end justify-between md:justify-center gap-2 shrink-0 pt-1 md:pt-0">
            <div className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-2 transition-all ${
              isAllReady
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30"
            }`}>
              <span className={`w-2 h-2 rounded-full ${isAllReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>
                {isAllReady ? "ALL SYSTEMS OPERATIONAL" : `${[isRealHardwarePaired, isNode2Active].filter(Boolean).length} OF 2 NODES LINKED`}
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-text-muted">
              Hardware Chamber: #{HARDWARE_LOCKER_ID}
            </span>
          </div>
        </div>
      </ScrollReveal>

      {/* ── Balanced Two-Column Interactive Grid ── */}
      <div className="connect-grid-luxe">
        {/* ── LEFT COLUMN: Hardware Controller & Verification Pipeline ── */}
        <ScrollReveal direction="left" className="space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* 1. ESP32-S3 Bluetooth Controller Card */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white/70 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 space-y-3 shadow-sm backdrop-blur-md transition-all">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                    <Cpu size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Node 1: ESP32-S3 Hardware Controller
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-text-muted">
                      Door Solenoid • Ultrasonic Backup • BME688 Gas Sensor
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 shrink-0 ${
                  isRealHardwarePaired 
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" 
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isRealHardwarePaired ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {isRealHardwarePaired ? "CONNECTED" : "READY TO PAIR"}
                </span>
              </div>

              {/* Actions for ESP32 */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <button 
                  className={`btn-premium ${isBusy ? 'is-loading' : ''} text-xs py-2 px-3.5`} 
                  type="button" 
                  onClick={handlePair} 
                  disabled={isBusy}
                >
                  {isBusy ? (
                    <Loader2 className="btn-icon animate-spin" size={15} />
                  ) : (
                    <Bluetooth className="btn-icon" size={15} />
                  )}
                  <span>{isBusy ? "Pairing BLE..." : "Pair ESP32 (BLE)"}</span>
                </button>

                <button
                  type="button"
                  className="btn-outline-luxe"
                  onClick={() => handleQuickPair(customMacInput || state.hardwareMac || undefined)}
                  disabled={isBusy}
                >
                  <ShieldCheck size={14} style={{ color: "var(--accent)" }} />
                  <span>{isRealHardwarePaired ? "Re-sync Bridge" : "Instant Connect"}</span>
                </button>

                {isRealHardwarePaired && (
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold ml-auto px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    MAC: {state.hardwareMac}
                  </span>
                )}
              </div>

              {/* Manual MAC expansion */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowAdvancedMac(!showAdvancedMac)}
                  className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-text-muted dark:hover:text-white underline transition-colors"
                >
                  {showAdvancedMac ? "Hide manual MAC configuration" : "Enter ESP32 MAC manually"}
                </button>

                {showAdvancedMac && (
                  <div className="mt-2.5 flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="e.g. E8F60A893D4C"
                      value={customMacInput}
                      onChange={(e) => setCustomMacInput(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/15 bg-black/5 dark:bg-black/30 text-xs font-mono text-slate-900 dark:text-white flex-1 max-w-[210px] focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuickPair(customMacInput)}
                      disabled={isBusy || !customMacInput.trim()}
                      className="px-3 py-1.5 rounded-lg bg-accent text-slate-950 text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      Bind MAC
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Hardware Verification Pipeline Card */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white/70 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 space-y-2.5 shadow-sm backdrop-blur-md transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                    <Activity size={13} />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-800 dark:text-white">
                    Hardware Verification Pipeline
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-text-muted bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-md">
                  {verifiedCount}/4 Verified
                </span>
              </div>

              <div className="space-y-1.5">
                {steps.map((step, index) => {
                  const isCompleted = step.active;
                  const Icon = step.icon;

                  return (
                    <div
                      key={step.key}
                      className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl border transition-all ${
                        isCompleted
                          ? "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12] border-emerald-500/25"
                          : "bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 opacity-70"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                          isCompleted
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "bg-black/10 dark:bg-white/10 text-slate-600 dark:text-slate-400"
                        }`}>
                          {isCompleted ? <Check size={12} strokeWidth={3} /> : index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Icon size={13} className={isCompleted ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400"} />
                            <p className="text-xs font-bold text-slate-900 dark:text-white leading-none">
                              {step.text}
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-text-muted mt-0.5">
                            {step.subtitle}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md transition-colors ${
                        isCompleted
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-black/5 dark:bg-white/5 text-slate-400"
                      }`}>
                        {isCompleted ? "Active & Linked" : "Standby"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Launch Kiosk CTA Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
              className="btn-premium w-full py-3 px-4 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-xl transition-all"
            >
              <span>Launch Kiosk Mode (System Ready)</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </ScrollReveal>

        {/* ── RIGHT COLUMN: Chamber Optical Sensor & Live AI Viewfinder ── */}
        <ScrollReveal direction="right" className="space-y-4">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/70 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 space-y-3 shadow-sm backdrop-blur-md transition-all flex flex-col justify-between">
            {/* Header Row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                  <Camera size={18} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Node 2: Chamber Optical Sensor
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-text-muted">
                    Locker #1 In-Chamber Vision • Real-Time AI
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
                isNode2Active 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25" 
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isNode2Active ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-pulse'}`} />
                {isNode2Active 
                  ? (sourceMode === "local_webcam" ? (isSyntheticStream ? "TEST STREAM" : "WEBCAM LIVE") : "STREAMING") 
                  : (sourceMode === "local_webcam" ? (isStartingWebcam ? "STARTING..." : "STANDBY") : "AWAITING MOUNT")}
              </span>
            </div>

            {/* Segmented Source Controls: Phone Mount vs Webcam */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="inline-flex p-0.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/10 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setForceShowQr(false);
                    setSourceMode("remote_phone");
                  }}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    sourceMode === "remote_phone"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-bold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Phone Mount
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode("local_webcam")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    sourceMode === "local_webcam"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-bold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Webcam
                </button>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-1.5">
                {sourceMode === "remote_phone" && isPhoneConnected && !forceShowQr && (
                  <button
                    type="button"
                    onClick={() => setForceShowQr(true)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1.5 transition-colors border border-black/5 dark:border-white/10"
                    title="Show QR code to pair another smartphone"
                  >
                    <QrCode size={12} />
                    <span>Pair Another</span>
                  </button>
                )}

                {sourceMode === "remote_phone" && (!isPhoneConnected || forceShowQr) && (
                  <div className="inline-flex items-center text-[10px] font-mono rounded-lg bg-black/[0.03] dark:bg-white/[0.05] p-0.5 border border-black/5 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setQrProtocolMode("https")}
                      className={`px-2 py-0.5 rounded ${qrProtocolMode === "https" ? "bg-accent text-slate-950 font-bold" : "text-slate-500 dark:text-slate-400"}`}
                    >
                      HTTPS
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrProtocolMode("http")}
                      className={`px-2 py-0.5 rounded ${qrProtocolMode === "http" ? "bg-accent text-slate-950 font-bold" : "text-slate-500 dark:text-slate-400"}`}
                    >
                      HTTP
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Viewport: Live Stream or QR Code */}
            {sourceMode === "local_webcam" || isNode2Active ? (
              <div className="relative aspect-[16/10] max-h-[290px] w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md flex items-center justify-center">
                <video
                  ref={attachVideoRef}
                  playsInline
                  muted
                  autoPlay
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    el.muted = true;
                    el.play().catch(() => {});
                  }}
                  onCanPlay={(e) => {
                    const el = e.currentTarget;
                    el.muted = true;
                    el.play().catch(() => {});
                  }}
                  className="w-full h-full object-cover"
                />
                {lastFrameDataUrl && !videoRef.current?.srcObject && (
                  <img src={lastFrameDataUrl} alt="Live feed" className="w-full h-full object-cover absolute inset-0" />
                )}

                {/* Local Webcam Initializing Overlay */}
                {sourceMode === "local_webcam" && isStartingWebcam && !isStreaming && (
                  <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-center p-4 z-40">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                    <p className="text-xs text-slate-200 font-medium">Starting Optical Camera Feed...</p>
                    <p className="text-[10px] text-slate-400">Connecting to chamber vision sensor...</p>
                  </div>
                )}

                {/* Camera error recovery overlay if webcam was completely blocked */}
                {sourceMode === "local_webcam" && !isStreaming && cameraError && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-center p-4 z-40">
                    <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <AlertTriangle size={20} />
                    </div>
                    <div className="space-y-1 max-w-xs">
                      <p className="text-xs font-bold text-slate-200">Camera Access Blocked</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{cameraError}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => retryWebcam()}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition-colors"
                      >
                        Retry Webcam
                      </button>
                      <button
                        type="button"
                        onClick={() => useTestFeed()}
                        className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-colors"
                      >
                        Use Sensor Feed
                      </button>
                    </div>
                  </div>
                )}

                {/* Top-Left Live FPS Indicator */}
                {isStreaming && (
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-mono z-30">
                    <span className={`w-1.5 h-1.5 rounded-full ${isSyntheticStream ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
                    <span className={isSyntheticStream ? 'text-amber-300' : 'text-emerald-400'}>
                      {isSyntheticStream ? "SENSOR TEST FEED" : "WEBCAM LIVE"} • {streamFps || 30} FPS
                    </span>
                  </div>
                )}

                {/* Top-Right Real-Time AI Detection Pill */}
                {isStreaming && (
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-[10px] font-mono z-30 transition-all">
                    {isFoodPresent && primaryFoodObject ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span className="text-emerald-400 font-bold tracking-tight">
                          {detectedObjects.length > 1 
                            ? `${primaryFoodObject.label} (+${detectedObjects.length - 1} item${detectedObjects.length > 2 ? 's' : ''})`
                            : `${primaryFoodObject.label} (${Math.round(primaryFoodObject.score * 100)}%)`}
                        </span>
                      </>
                    ) : primaryPersonObject ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                        <span className="text-sky-300 font-bold tracking-tight">
                          👤 {primaryPersonObject.label}
                          {detectedObjects.length > 1 ? ` (+${detectedObjects.length - 1})` : ''}
                        </span>
                      </>
                    ) : detectedObjects.length > 0 ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        <span className="text-indigo-300 font-bold tracking-tight">
                          {detectedObjects[0].label}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span className="text-slate-300">Empty Shelf</span>
                      </>
                    )}
                  </div>
                )}

                {/* Synthetic stream notice if active */}
                {sourceMode === "local_webcam" && isSyntheticStream && (
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between px-3 py-1.5 rounded-xl bg-black/85 backdrop-blur-md border border-amber-500/30 text-[10px] font-mono text-amber-200 z-30">
                    <span className="truncate pr-2">
                      Physical webcam unavailable • Active optical test stream
                    </span>
                    <button
                      type="button"
                      onClick={() => retryWebcam()}
                      className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-bold border border-amber-500/40 flex-shrink-0 transition-colors"
                    >
                      Retry Real Webcam
                    </button>
                  </div>
                )}

                {/* Multi-Object Real-Time Bounding Box Tracking Overlays */}
                <AnimatePresence>
                  {isStreaming && detectedObjects.map((obj, idx) => {
                    const isObjFood = obj.category !== "general_item" && !obj.label.toLowerCase().includes("person") && !obj.label.toLowerCase().includes("device") && !obj.label.toLowerCase().includes("phone");
                    const isPerson = obj.label.toLowerCase().includes("person");
                    const isDevice = obj.label.toLowerCase().includes("phone") || obj.label.toLowerCase().includes("device");

                    const borderClass = isObjFood
                      ? "border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.45)]"
                      : isPerson
                      ? "border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.45)]"
                      : isDevice
                      ? "border-indigo-400 shadow-[0_0_20px_rgba(129,140,248,0.45)]"
                      : "border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.45)]";

                    const badgeBg = isObjFood
                      ? "bg-emerald-500 text-slate-950"
                      : isPerson
                      ? "bg-sky-500 text-slate-950"
                      : isDevice
                      ? "bg-indigo-500 text-white"
                      : "bg-amber-500 text-slate-950";

                    const statusLabel = isObjFood
                      ? "Chamber Verified"
                      : isPerson
                      ? "Operator in View • Shelf Idle"
                      : isDevice
                      ? "Personal Device"
                      : "Item Detected";

                    return (
                      <motion.div
                        key={`bbox-${idx}-${obj.label}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        style={{
                          position: "absolute",
                          left: `${Math.max(2, Math.min(84, obj.bbox[0] * 100))}%`,
                          top: `${Math.max(2, Math.min(82, obj.bbox[1] * 100))}%`,
                          width: `${Math.max(10, Math.min(94, obj.bbox[2] * 100))}%`,
                          height: `${Math.max(10, Math.min(94, obj.bbox[3] * 100))}%`,
                        }}
                        className={`border-2 rounded-xl pointer-events-none flex flex-col justify-between p-1.5 z-20 ${borderClass}`}
                      >
                        <div className={`self-start px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase font-mono shadow-md flex items-center gap-1.5 ${badgeBg}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse" />
                          <span>{obj.label} • {Math.round((obj.score || confidence) * 100)}%</span>
                        </div>
                        <div className={`self-end text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                          isObjFood
                            ? "text-emerald-300 bg-black/70 border-emerald-500/30"
                            : isPerson
                            ? "text-sky-300 bg-black/70 border-sky-500/30"
                            : isDevice
                            ? "text-indigo-300 bg-black/70 border-indigo-500/30"
                            : "text-amber-300 bg-black/70 border-amber-500/30"
                        }`}>
                          {statusLabel}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Bottom Overlay if not synthetic stream */}
                {!(sourceMode === "local_webcam" && isSyntheticStream) && (
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono text-slate-300 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 z-30">
                    <span className="flex items-center gap-1">
                      <Radio size={11} className="text-emerald-400" />
                      Chamber Optical Lens
                    </span>
                    <span className="text-slate-400">
                      Mode: {sourceMode === "local_webcam" ? "Local USB" : "WebRTC"}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Awaiting Mount: Clean Focused QR Pairing */
              <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-black/30 border border-black/5 dark:border-white/10 space-y-3.5">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Crisp White QR Box */}
                  <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-slate-200/80 flex-shrink-0">
                    {qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} alt="Pair Chamber Phone" className="w-32 h-32 sm:w-36 sm:h-36" />
                    ) : (
                      <div className="w-32 h-32 flex items-center justify-center text-[10px] text-slate-400 font-mono">Generating QR...</div>
                    )}
                  </div>

                  {/* Minimal 3-Step Guide */}
                  <div className="space-y-2 text-xs flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-[11px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono">
                        Phone Mount Procedure
                      </p>
                      {isPhoneConnected && forceShowQr && (
                        <button
                          type="button"
                          onClick={() => setForceShowQr(false)}
                          className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                        >
                          &larr; View Live Feed
                        </button>
                      )}
                    </div>

                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      <li>Scan this QR with the phone kept inside <strong>Locker #1</strong>.</li>
                      <li>Tap <strong>Proceed</strong> if prompted for local SSL & grant camera access.</li>
                      <li>Turn on <strong>Torch</strong>, tap <strong>OLED Stealth</strong>, place on shelf & close door.</li>
                    </ol>

                    {/* Minimal Utility Actions */}
                    <div className="pt-1 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[10px] font-mono text-slate-700 dark:text-white flex items-center gap-1 transition-colors"
                      >
                        <Copy size={11} />
                        <span>{copiedLink ? "Copied!" : "Copy URL"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Vision Telemetry HUD Strip */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 text-center">
                <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-text-muted block">Detection</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white font-mono truncate block mt-0.5">
                  {detectedObjects.length > 1
                    ? `${detectedObjects[0].label} (+${detectedObjects.length - 1} more)`
                    : detectedObjects[0]?.label || (isFoodPresent ? "Item Present" : "Clear Shelf")}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 text-center">
                <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-text-muted block">Feed Rate</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono block mt-0.5">
                  {isNode2Active ? `${streamFps || 30} FPS` : "Standby"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 text-center">
                <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-text-muted block">AI Model</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white font-mono block mt-0.5">
                  YOLOv8 Nano
                </span>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>

      <style>{`
        .hero-title-luxe .accent-text {
          display: block;
          background: linear-gradient(to right, var(--accent), var(--accent-warm));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>
    </section>
  );
}
