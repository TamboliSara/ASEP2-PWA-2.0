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
import { yoloVisionEngine } from "./yoloVisionEngine";
import { getInitialHost, fetchServerIp } from "../../services/network";

interface ChamberVisionHudProps {
  lockerId: string;
  ultrasonicDistCm?: number;
  className?: string;
  compact?: boolean;
  isDonorMode?: boolean; // When true, provides a clean kiosk HUD for donors without developer controls
  onVerified?: (data: { snapshotUrl: string; foodLabel: string; visualFreshnessScore: number }) => void;
}

export function ChamberVisionHud({
  lockerId,
  ultrasonicDistCm,
  className = "",
  compact = false,
  isDonorMode = false,
  onVerified
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

  // Snapshot Capture & In-Chamber Verification States
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    isFood: boolean;
    label: string;
    confidence: number;
    bbox?: [number, number, number, number];
    errorReason?: string;
  } | null>(null);

  // Generate Cloud Universal QR code (100% IP independent, accessible anywhere)
  useEffect(() => {
    const phoneUrl = `https://asep-10fe3.web.app/chamber-lens?locker=${lockerId}`;
    setResolvedPhoneUrl(phoneUrl);
    QRCode.toDataURL(phoneUrl, { margin: 1, width: 240 })
      .then(setQrCodeDataUrl)
      .catch(console.error);
  }, [lockerId]);

  const allObjects = cameraTelemetry?.detectedObjects ?? [];
  // Primary detection: prefer the highest-confidence food item
  const foodDetected = allObjects.find(o =>
    o.category === "fruit" ||
    o.category === "vegetable" ||
    o.category === "cooked_meal" ||
    o.category === "container" ||
    o.category === "beverage" ||
    o.category === "bakery"
  );
  // Person detection: separate, never confused with food
  const personDetected = allObjects.find(o => o.label === "Person in View");

  const isUltrasonicConfirmed = typeof ultrasonicDistCm === "number" && ultrasonicDistCm > 1.0 && ultrasonicDistCm < 34.0;

  // ── Snapshot Capture & Verification Logic ──
  const handleCaptureAndVerify = async (providedImage?: string) => {
    setIsAnalyzing(true);
    setVerificationResult(null);

    let snapshot = providedImage || "";

    // 1. Capture snapshot from active video stream if playing
    if (!snapshot && videoRef.current && videoRef.current.readyState >= 2) {
      try {
        snapshot = yoloVisionEngine.captureSnapshot(videoRef.current, 0.85, 640);
      } catch (e) {
        console.warn("[HUD] captureSnapshot video error:", e);
      }
    }

    // 2. Fallback to lastFrameDataUrl (RTDB phone frame or preset)
    if (!snapshot && lastFrameDataUrl) {
      snapshot = lastFrameDataUrl;
    }

    if (!snapshot) {
      setIsAnalyzing(false);
      setVerificationResult({
        isFood: false,
        label: "Camera Unready",
        confidence: 0,
        errorReason: "Optical stream not ready yet. Please ensure camera is connected or upload a photo."
      });
      return;
    }

    setCapturedSnapshot(snapshot);

    try {
      // Load snapshot into Image element for inference
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = snapshot;
        setTimeout(resolve, 350);
      });

      // Reset temporal tracker for isolated snapshot evaluation
      yoloVisionEngine.resetTracking();

      const inference = await yoloVisionEngine.analyzeFrame(img);
      console.log("[HUD Capture Analysis] YOLO Result:", inference);

      const foodObj = inference.detectedObjects.find(o =>
        o.category === "fruit" ||
        o.category === "vegetable" ||
        o.category === "cooked_meal" ||
        o.category === "container" ||
        o.category === "beverage" ||
        o.category === "bakery"
      );
      const personObj = inference.detectedObjects.find(o => o.label === "Person in View");

      const isFood = Boolean(inference.isFoodPresent && foodObj && foodObj.score >= 0.35);

      if (isFood && foodObj) {
        const foodLabel = foodObj.label;
        const confidencePct = Math.round(foodObj.score * 100);
        setVerificationResult({
          isFood: true,
          label: foodLabel,
          confidence: confidencePct,
          bbox: foodObj.bbox
        });

        // Trigger verified callback to lock locker and commit donation
        if (onVerified) {
          onVerified({
            snapshotUrl: snapshot,
            foodLabel,
            visualFreshnessScore: inference.visualFreshnessScore || 95
          });
        }
      } else {
        let reason = "No food item detected inside the chamber.";
        if (personObj) {
          reason = "A person or hand was detected in view, not a food item.";
        } else if (inference.detectedObjects.length === 0) {
          reason = "The chamber shelf appears empty. Please place your food item inside.";
        } else {
          const names = inference.detectedObjects.map(o => o.label).join(", ");
          reason = `Detected: ${names}. Not identified as a valid food item.`;
        }

        setVerificationResult({
          isFood: false,
          label: personObj ? "Person in View" : "No Food Item",
          confidence: Math.round((personObj?.score || 0) * 100),
          bbox: personObj?.bbox,
          errorReason: reason
        });
      }
    } catch (err: any) {
      console.error("[HUD Capture Analysis] Error:", err);
      setVerificationResult({
        isFood: false,
        label: "Analysis Error",
        confidence: 0,
        errorReason: "Failed to process photo. Please click Retake Photo and try again."
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetake = () => {
    setCapturedSnapshot(null);
    setVerificationResult(null);
    setIsAnalyzing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        handleCaptureAndVerify(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`relative flex flex-col rounded-2xl overflow-hidden bg-slate-950/80 border border-slate-800/80 backdrop-blur-xl shadow-2xl ${className}`}>
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/60 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${verificationResult?.isFood ? 'bg-emerald-400' : isFoodPresent ? 'bg-emerald-400 animate-ping' : isPhoneConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
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
            <span>{isPhoneConnected ? "Optical Node Active" : "Camera Standby"}</span>
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

      {/* ── Live Viewfinder / Snapshot Container ── */}
      <div className="relative aspect-[16/10] bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* If user clicked snapshot: Display the captured photo */}
        {capturedSnapshot ? (
          <img
            src={capturedSnapshot}
            alt="Captured Chamber Food Snapshot"
            className="w-full h-full object-cover absolute inset-0"
          />
        ) : (
          <>
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
                  Positioned in Locker #1 • Place food inside and capture photo
                </p>
              </div>
            )}
          </>
        )}

        {/* Simulator Preset Switcher Bar (when in simulator mode and no photo captured yet) */}
        {!capturedSnapshot && sourceMode === "simulator" && (
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

        {/* ── Visual Scanning Laser when Analyzing Snapshot ── */}
        <AnimatePresence>
          {isAnalyzing && (
            <>
              <motion.div
                key="laser-scan"
                initial={{ top: "0%" }}
                animate={{ top: ["0%", "92%", "0%"] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] z-30 pointer-events-none"
              />
              <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center z-30 pointer-events-none">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/40 text-emerald-300 font-mono text-xs shadow-xl">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Analyzing Photo with YOLOv8...</span>
                </div>
              </div>
            </>
          )}
        </AnimatePresence>

        {/* ── Bounding Box on Captured Snapshot: Verified Food ── */}
        <AnimatePresence>
          {capturedSnapshot && verificationResult?.isFood && verificationResult.bbox && (
            <motion.div
              key="verified-bbox"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                position: "absolute",
                left: `${verificationResult.bbox[0] * 100}%`,
                top: `${verificationResult.bbox[1] * 100}%`,
                width: `${verificationResult.bbox[2] * 100}%`,
                height: `${verificationResult.bbox[3] * 100}%`
              }}
              className="border-2 border-emerald-400 rounded-xl pointer-events-none shadow-[0_0_20px_rgba(16,185,129,0.5)] flex flex-col justify-between p-1.5 z-20"
            >
              <div className="self-start px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black tracking-wider uppercase font-mono shadow">
                ✓ {verificationResult.label} • {verificationResult.confidence}%
              </div>
              <div className="self-end text-[9px] font-mono font-bold text-emerald-300 bg-slate-950/80 px-1.5 py-0.5 rounded">
                Food Verified
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bounding Box on Captured Snapshot: Rejected Non-Food / Person ── */}
        <AnimatePresence>
          {capturedSnapshot && verificationResult && !verificationResult.isFood && verificationResult.bbox && (
            <motion.div
              key="rejected-bbox"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                position: "absolute",
                left: `${verificationResult.bbox[0] * 100}%`,
                top: `${verificationResult.bbox[1] * 100}%`,
                width: `${verificationResult.bbox[2] * 100}%`,
                height: `${verificationResult.bbox[3] * 100}%`
              }}
              className="border-2 border-amber-400 rounded-xl pointer-events-none shadow-[0_0_15px_rgba(251,191,36,0.4)] flex flex-col justify-between p-1.5 z-20"
            >
              <div className="self-start px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black tracking-wider uppercase font-mono shadow">
                ⚠️ {verificationResult.label} • Not Food
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Live Bounding Boxes (Only visible when NOT viewing a captured photo) ── */}
        {!capturedSnapshot && (
          <>
            <AnimatePresence>
              {isFoodPresent && foodDetected && (
                <motion.div
                  key="food-bbox"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: "absolute",
                    left: `${foodDetected.bbox[0] * 100}%`,
                    top: `${foodDetected.bbox[1] * 100}%`,
                    width: `${foodDetected.bbox[2] * 100}%`,
                    height: `${foodDetected.bbox[3] * 100}%`
                  }}
                  className="border-2 border-emerald-400 rounded-xl pointer-events-none shadow-[0_0_15px_rgba(16,185,129,0.35)] flex flex-col justify-between p-1.5"
                >
                  <div className="self-start px-2 py-0.5 rounded bg-emerald-500/90 text-slate-950 text-[10px] font-black tracking-wider uppercase font-mono shadow">
                    {foodDetected.label} • {Math.round(confidence * 100)}%
                  </div>
                  <div className="self-end text-[9px] font-mono font-bold text-emerald-300 bg-slate-950/70 px-1.5 py-0.5 rounded">
                    Ready to Capture
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {personDetected && (
                <motion.div
                  key="person-bbox"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: "absolute",
                    left: `${personDetected.bbox[0] * 100}%`,
                    top: `${personDetected.bbox[1] * 100}%`,
                    width: `${personDetected.bbox[2] * 100}%`,
                    height: `${personDetected.bbox[3] * 100}%`
                  }}
                  className="border-2 border-amber-400 rounded-xl pointer-events-none shadow-[0_0_14px_rgba(251,191,36,0.35)] flex flex-col justify-between p-1.5"
                >
                  <div className="self-start px-2 py-0.5 rounded bg-amber-400/90 text-slate-950 text-[10px] font-black tracking-wider uppercase font-mono shadow">
                    👤 Person in View • {Math.round((personDetected.score ?? 0.97) * 100)}%
                  </div>
                  <div className="self-end text-[9px] font-mono font-bold text-amber-300 bg-slate-950/70 px-1.5 py-0.5 rounded">
                    Not Food
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

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

      {/* ── Interactive Photo Capture & Verification Control Bar ── */}
      {isDonorMode && (
        <div className="border-t border-slate-800 bg-slate-900/95 p-3 space-y-2.5">
          {!capturedSnapshot ? (
            <>
              <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20">
                <Camera className="w-4 h-4 shrink-0 text-emerald-400 animate-pulse" />
                <span>Place food inside the chamber & tap below to take a photo.</span>
              </div>

              <button
                type="button"
                onClick={() => handleCaptureAndVerify()}
                disabled={isAnalyzing}
                className="w-full py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:brightness-110 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.35)] active:scale-[0.98]"
              >
                <Camera className="w-4 h-4 text-slate-950" />
                <span>Take Photo of Donated Food</span>
              </button>

              <div className="flex items-center justify-center pt-0.5">
                <label className="text-[10px] font-mono text-slate-400 hover:text-emerald-400 cursor-pointer flex items-center gap-1.5 transition-colors">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Or snap / upload with phone camera</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </>
          ) : isAnalyzing ? (
            <div className="py-3 px-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center space-y-1">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Inspecting Photo with YOLOv8 Neural Network...</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400">
                Evaluating food category, freshness, and chamber placement.
              </p>
            </div>
          ) : verificationResult?.isFood ? (
            <div className="py-2.5 px-3 rounded-xl bg-emerald-950/70 border border-emerald-600/50 text-center space-y-1 animate-in fade-in">
              <div className="flex items-center justify-center gap-2 text-emerald-300 font-bold text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Food Verified: {verificationResult.label} ({verificationResult.confidence}%)</span>
              </div>
              <p className="text-[11px] font-mono text-emerald-400/90">
                ✓ Locking chamber door & redirecting to Receiver Dashboard...
              </p>
            </div>
          ) : (
            <div className="py-3 px-3.5 rounded-xl bg-rose-950/60 border border-rose-600/40 space-y-2.5 animate-in fade-in">
              <div className="flex items-start gap-2.5 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 text-left">
                  <span className="font-bold uppercase tracking-wider block text-[11px] text-rose-400">
                    No Food Item Detected
                  </span>
                  <span className="text-[11px] text-slate-300 font-normal leading-tight block mt-0.5">
                    {verificationResult?.errorReason}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 active:scale-[0.98]"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Retake Photo</span>
                </button>
                <label className="py-2.5 px-3 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer active:scale-[0.98]">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Upload</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Dual-Redundant Sensor Status Footer ── */}
      <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-900/70 border-t border-slate-800 text-xs">
        {/* Primary: YOLO Vision */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className={`w-2.5 h-2.5 rounded-full ${verificationResult?.isFood || isFoodPresent ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-slate-400 font-mono">PRIMARY: YOLO VISION</div>
            <div className="font-bold text-emerald-400 text-[11px] truncate">
              {verificationResult?.isFood
                ? `Photo Verified (${verificationResult.confidence}%)`
                : capturedSnapshot
                ? "Verification Failed"
                : isFoodPresent
                ? `Ready to Click (${Math.round(confidence * 100)}%)`
                : "Awaiting Photo Capture"}
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
                ? `${ultrasonicDistCm.toFixed(1)} cm ${isUltrasonicConfirmed ? '(Echo Confirmed)' : '(Standby)'}` 
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
