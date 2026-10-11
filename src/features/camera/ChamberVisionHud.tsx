/**
 * ChamberVisionHud.tsx — Real-Time Chamber Vision HUD with YOLO Bounding Boxes
 * 
 * Embedded into DonorPage deposit flow & Kiosk.
 * Features:
 *   - 60 FPS Video viewfinder with cyber/glassmorphism HUD
 *   - Real-time YOLOv8 animated bounding box tracking
 *   - Dual-Redundant status: YOLO Vision (Primary) + Ultrasonic Sensor (Backup)
 *   - 3-Way presenter source toggle (Remote Phone | Laptop Webcam | Simulator)
 *   - Quick QR Code pairing modal for mounting phone inside locker
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { 
  Camera, 
  Smartphone, 
  Video, 
  Sparkles, 
  QrCode, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X,
  Layers,
  SlidersHorizontal,
  ShieldCheck
} from "lucide-react";
import { useChamberCamera, type CameraSourceMode } from "./useChamberCamera";

interface ChamberVisionHudProps {
  lockerId: string;
  ultrasonicDistCm?: number;
  className?: string;
  compact?: boolean;
  isDonorMode?: boolean; // When true, provides a clean kiosk HUD for donors without developer controls
}

export function ChamberVisionHud({
  lockerId,
  ultrasonicDistCm,
  className = "",
  compact = false,
  isDonorMode = false
}: ChamberVisionHudProps) {
  const {
    videoRef,
    attachVideoRef,
    isStreaming,
    streamFps,
    isPhoneConnected,
    sourceMode,
    setSourceMode,
    lastFrameDataUrl,
    activePresetIndex,
    setActivePresetIndex,
    presets,
    cameraTelemetry,
    isFoodPresent,
    confidence
  } = useChamberCamera(lockerId);

  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [resolvedPhoneUrl, setResolvedPhoneUrl] = useState<string>("");

  // Generate QR code for phone mounting with accessible LAN IP (HTTPS on port 5174)
  useEffect(() => {
    const host = "192.168.0.109";
    const phoneUrl = `https://${host}:5174/chamber-lens?locker=${lockerId}`;
    setResolvedPhoneUrl(phoneUrl);
    QRCode.toDataURL(phoneUrl, { margin: 1, width: 240 })
      .then(setQrCodeDataUrl)
      .catch(console.error);
  }, [lockerId]);

  const detected = cameraTelemetry?.detectedObjects?.[0];
  const isUltrasonicConfirmed = typeof ultrasonicDistCm === "number" && ultrasonicDistCm > 1.0 && ultrasonicDistCm < 34.0;

  return (
    <div className={`relative flex flex-col rounded-2xl overflow-hidden bg-slate-950/80 border border-slate-800/80 backdrop-blur-xl shadow-2xl ${className}`}>
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/60 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isFoodPresent ? 'bg-emerald-400 animate-ping' : isPhoneConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          <span className="font-mono font-bold uppercase tracking-wider text-slate-200">
            {isDonorMode ? "Locker #1 In-Chamber Vision" : "Smart Chamber Vision"}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            YOLOv8
          </span>
        </div>

        {/* Action Buttons: Clean badge in donor mode, full toggles in presenter/admin mode */}
        {isDonorMode ? (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{isPhoneConnected ? "Optical Node Active" : "Sensor Standby"}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Source Selector Menu */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[10px] font-mono">
              <button
                onClick={() => setSourceMode("remote_phone")}
                className={`px-2.5 py-1 rounded transition-colors ${sourceMode === "remote_phone" ? "bg-emerald-500/20 text-emerald-300 font-bold" : "text-slate-400 hover:text-white"}`}
                title="Remote Phone Camera mounted inside locker"
              >
                Phone Mount
              </button>
              <button
                onClick={() => setSourceMode("local_webcam")}
                className={`px-2.5 py-1 rounded transition-colors ${sourceMode === "local_webcam" ? "bg-emerald-500/20 text-emerald-300 font-bold" : "text-slate-400 hover:text-white"}`}
                title="Laptop/Desktop Webcam"
              >
                Webcam
              </button>
            </div>

            {/* QR Pairing Button */}
            <button
              onClick={() => setShowQrModal(true)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
              title="Scan QR to pair phone inside locker"
            >
              <QrCode className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Live Viewfinder Container ── */}
      <div className="relative aspect-[16/10] bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Real Video Element (WebRTC or Webcam) */}
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
          className={`w-full h-full object-cover ${sourceMode === "simulator" ? "hidden" : "block"}`}
        />

        {/* Fallback frame (RTDB remote phone frames or Simulator canvas) */}
        {lastFrameDataUrl && (sourceMode === "simulator" || !isStreaming) && (
          <img
            src={lastFrameDataUrl}
            alt="Chamber Optical Stream"
            className="w-full h-full object-cover absolute inset-0"
          />
        )}

        {/* Standby screen when phone is not yet streaming */}
        {!isStreaming && !lastFrameDataUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-2 bg-slate-950 z-10">
            <Camera className="w-8 h-8 text-emerald-400/40 animate-pulse" />
            <div className="text-xs font-mono font-bold text-slate-300">
              In-Chamber Optical Sensor Standby
            </div>
            <p className="text-[10px] font-mono text-slate-500 max-w-xs">
              Positioned in Locker #1 • Backup Ultrasonic Active ({ultrasonicDistCm ? `${ultrasonicDistCm.toFixed(1)} cm` : 'Armed'})
            </p>
          </div>
        )}

        {/* Simulator Preset Switcher Bar */}
        {sourceMode === "simulator" && (
          <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
            {presets.map((p, idx) => (
              <button
                key={p.label}
                onClick={() => setActivePresetIndex(idx)}
                className={`flex-1 py-1 px-1.5 rounded text-[10px] font-mono transition-all border ${
                  activePresetIndex === idx
                    ? "bg-emerald-500/30 border-emerald-400 text-emerald-200 font-bold"
                    : "bg-slate-900/80 border-slate-700/60 text-slate-400"
                }`}
              >
                {p.label.split(" ")[0]}
              </button>
            ))}
          </div>
        )}

        {/* ── YOLO Animated Bounding Box Overlay ── */}
        <AnimatePresence>
          {isFoodPresent && detected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute",
                left: `${detected.bbox[0] * 100}%`,
                top: `${detected.bbox[1] * 100}%`,
                width: `${detected.bbox[2] * 100}%`,
                height: `${detected.bbox[3] * 100}%`
              }}
              className="border-2 border-emerald-400 rounded-xl pointer-events-none shadow-[0_0_15px_rgba(16,185,129,0.35)] flex flex-col justify-between p-1.5"
            >
              <div className="self-start px-2 py-0.5 rounded bg-emerald-500/90 text-slate-950 text-[10px] font-black tracking-wider uppercase font-mono shadow">
                {detected.label} • {Math.round(confidence * 100)}%
              </div>
              <div className="self-end text-[9px] font-mono font-bold text-emerald-300 bg-slate-950/70 px-1.5 py-0.5 rounded">
                Shelf Verified
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Ambient HUD Reticles ── */}
        <div className="absolute inset-2 border border-slate-800/40 rounded-xl pointer-events-none flex flex-col justify-between p-2">
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>FPS: {streamFps || 30}</span>
            <span>CHAMBER #1 LENS</span>
          </div>
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>MODE: {sourceMode.toUpperCase()}</span>
            <span>AI: ONNX WEB</span>
          </div>
        </div>
      </div>

      {/* ── Dual-Redundant Sensor Status Footer ── */}
      <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-900/70 border-t border-slate-800 text-xs">
        {/* Primary: YOLO Vision */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className={`w-2.5 h-2.5 rounded-full ${isFoodPresent ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-slate-400 font-mono">PRIMARY: YOLO VISION</div>
            <div className="font-bold text-emerald-400 text-[11px] truncate">
              {isFoodPresent ? `Food Detected (${Math.round(confidence * 100)}%)` : "Awaiting Placement"}
            </div>
          </div>
        </div>

        {/* Backup: Ultrasonic Sensor */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className={`w-2.5 h-2.5 rounded-full ${isUltrasonicConfirmed ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-slate-400 font-mono">BACKUP: ULTRASONIC</div>
            <div className="font-bold text-slate-300 text-[11px] truncate font-mono">
              {typeof ultrasonicDistCm === "number" && ultrasonicDistCm > 0 
                ? `${ultrasonicDistCm.toFixed(1)} cm ${isUltrasonicConfirmed ? '(Echo Confirmed)' : '(Empty)'}` 
                : "Armed / Standby"}
            </div>
          </div>
        </div>
      </div>

      {/* ── QR Code Pairing Modal ── */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl relative"
            >
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Mount Chamber Phone</h3>
                  <p className="text-xs text-slate-400">Embedded Optical Component</p>
                </div>
              </div>

              {/* QR Image */}
              <div className="p-4 bg-white rounded-xl flex items-center justify-center shadow-inner">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="Chamber Lens Pairing QR" className="w-44 h-44" />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs">Generating QR...</div>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-slate-300">
                <p className="font-semibold text-emerald-400">3-Step Mount Procedure:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                  <li>Scan with the phone kept inside Locker #1.</li>
                  <li>When prompted with <em>"Your connection is not private"</em>, tap <strong>Advanced</strong> &rarr; <strong>Proceed (unsafe)</strong> (standard development SSL).</li>
                  <li>Turn on <strong>Torch</strong>, then tap <strong>OLED Stealth Mode</strong> and close the door.</li>
                </ol>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-[11px] font-mono">
                <span className="truncate text-slate-400 flex-1 bg-slate-950 px-2 py-1 rounded border border-slate-800" title={resolvedPhoneUrl}>
                  {resolvedPhoneUrl || "/chamber-lens"}
                </span>
                <button
                  onClick={() => {
                    if (resolvedPhoneUrl) {
                      navigator.clipboard.writeText(resolvedPhoneUrl);
                      alert("Pairing URL copied to clipboard!");
                    }
                  }}
                  className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold hover:bg-emerald-500/25 transition-colors flex-shrink-0"
                >
                  Copy
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
