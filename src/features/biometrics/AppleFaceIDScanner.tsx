import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, User, Camera, Sun, Focus, AlertCircle, Scan, RefreshCw } from 'lucide-react';
import * as faceapi from 'face-api.js';
import { useTranslation } from '../../store/useTranslation';

interface AppleFaceIDScannerProps {
  onVerify: (imageData?: string, descriptor?: Float32Array) => void;
}

type ScanWarning =
  | "no_face"
  | "mask_detected"
  | "face_too_small"
  | "face_too_close"
  | "not_centered"
  | "not_straight"
  | "face_partial"
  | null;

const WARNING_ICONS: Record<NonNullable<ScanWarning>, string> = {
  no_face: "👤",
  mask_detected: "😷",
  face_too_small: "↔️",
  face_too_close: "⬅️",
  not_centered: "🎯",
  not_straight: "↩️",
  face_partial: "📐",
};

export function AppleFaceIDScanner({ onVerify }: AppleFaceIDScannerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success" | "camera_error">("idle");
  const [progress, setProgress] = useState(0);
  const [hasConsented, setHasConsented] = useState(false);

  const getWarningMessage = (w: NonNullable<ScanWarning>): string => {
    switch (w) {
      case "no_face": return t("noFaceWarning") || "No face detected. Please look directly at the camera.";
      case "mask_detected": return t("maskWarning") || "Face obstructed. Please remove mask, sunglasses, or heavy accessories.";
      case "face_too_small": return t("faceTooSmallWarning") || "Move closer to the camera.";
      case "face_too_close": return t("faceTooCloseWarning") || "Move slightly back — face too close.";
      case "not_centered": return t("notCenteredWarning") || "Center your face within the circle.";
      case "not_straight": return t("notStraightWarning") || "Look straight at the camera — don't turn your head.";
      case "face_partial": return t("facePartialWarning") || "Your full face isn't visible. Keep your whole face in frame.";
      default: return "";
    }
  };
  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);
  const [warning, setWarning] = useState<ScanWarning>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadFailed, setModelLoadFailed] = useState(false);

  // Load models once
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch {
        setModelLoadFailed(true);
      }
    };
    loadModels();
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
      setTimeout(() => setScanStatus("scanning"), 100); // minimal delay — feel instant
    } catch {
      setScanStatus("camera_error");
    }
  }, []);

  useEffect(() => {
    if (hasConsented && modelsLoaded) startCamera();
    return stopCamera;
  }, [hasConsented, modelsLoaded, startCamera, stopCamera]);

  const captureImage = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Draw without mirroring so the stored image matches the real face orientation
    const v = videoRef.current;
    const side = Math.min(v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - side) / 2;
    const sy = (v.videoHeight - side) / 2;
    ctx.drawImage(v, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.80);
  }, []);

  // Smart detection loop — auto-retries, no button needed unless camera error
  useEffect(() => {
    if (scanStatus !== "scanning" || !modelsLoaded || !videoRef.current) return;

    let frameId: number;
    let consecutiveSuccess = 0;
    const REQUIRED = 4; // slightly relaxed for speed
    let lastFrameTime = 0;
    const FRAME_INTERVAL = 150; // ms between frames — avoids CPU thrash

    const classify = (detections: faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>>): ScanWarning => {
      const { box, score } = detections.detection;
      const v = videoRef.current!;
      const vw = v.videoWidth, vh = v.videoHeight;
      const margin = vw * 0.06;

      // Partial face / out of frame
      if (box.x < margin || box.y < margin || (box.x + box.width) > (vw - margin) || (box.y + box.height) > (vh - margin)) {
        return "face_partial";
      }

      // Size checks
      const ratio = box.width / vw;
      if (ratio < 0.15) return "face_too_small";
      if (ratio > 0.88) return "face_too_close";

      // Centering
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const dx = Math.abs(cx - vw / 2) / vw;
      const dy = Math.abs(cy - vh / 2) / vh;
      if (dx > 0.3 || dy > 0.3) return "not_centered";

      // Head yaw
      const lm = detections.landmarks;
      const nose = lm.getNose();
      const leftEye = lm.getLeftEye();
      const rightEye = lm.getRightEye();
      const noseX = nose[3].x;
      const leftEyeX = leftEye[0].x;
      const rightEyeX = rightEye[3].x;
      const yawRatio = Math.min(Math.abs(noseX - leftEyeX), Math.abs(rightEyeX - noseX)) /
                       Math.max(Math.abs(noseX - leftEyeX), Math.abs(rightEyeX - noseX), 0.001);
      if (yawRatio < 0.20) return "not_straight";

      // Occlusion / mask heuristic: low confidence OR very small mouth width
      const mouth = lm.getMouth();
      const mouthW = Math.abs(mouth[6].x - mouth[0].x);
      const eyeW = Math.abs(rightEye[3].x - leftEye[0].x);
      if (score < 0.4 || mouthW < eyeW * 0.12) return "mask_detected";

      return null; // all good
    };

    const detect = async (ts: number) => {
      if (ts - lastFrameTime < FRAME_INTERVAL) {
        frameId = requestAnimationFrame(detect);
        return;
      }
      lastFrameTime = ts;

      if (!videoRef.current || videoRef.current.readyState < 2) {
        frameId = requestAnimationFrame(detect);
        return;
      }

      const det = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!det) {
        setWarning("no_face");
        consecutiveSuccess = Math.max(0, consecutiveSuccess - 1);
        frameId = requestAnimationFrame(detect);
        return;
      }

      const issue = classify(det);
      if (issue) {
        setWarning(issue);
        consecutiveSuccess = Math.max(0, consecutiveSuccess - 2);
        setProgress(prev => Math.max(0, prev - 5));
      } else {
        setWarning(null);
        consecutiveSuccess++;
        const pct = Math.min(100, (consecutiveSuccess / REQUIRED) * 100);
        setProgress(pct);

        if (pct >= 100) {
          setScanStatus("success");
          const img = captureImage();
          setTimeout(() => onVerify(img || undefined, det.descriptor), 500);
          return;
        }
      }

      frameId = requestAnimationFrame(detect);
    };

    frameId = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(frameId);
  }, [scanStatus, modelsLoaded, captureImage, onVerify]);

  // ── Consent Screen ──────────────────────────────────────────────────────────
  if (!hasConsented) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full max-w-sm mx-auto backdrop-blur-[40px] border rounded-[2rem] p-8 relative overflow-hidden flex flex-col shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)]"
        style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
      >
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-accent/20 rounded-full blur-[80px]" />
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-accent via-emerald-400 to-accent" />

        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-accent/20 rounded-full blur-xl animate-pulse" />
            <div className="relative p-4 rounded-2xl bg-background border border-line text-accent shadow-xl">
              <Scan size={32} strokeWidth={1.5} />
            </div>
          </div>
          <h3 className="font-bold text-text text-xl tracking-tight mb-1">{t("identityVerification")}</h3>
          <p className="text-[10px] font-bold text-accent uppercase tracking-[0.2em] opacity-80">{t("securityProtocolRequirements")}</p>
        </div>

        <div className="space-y-3 mb-6">
          {[
            { icon: <Sun size={16} />, text: t("faceRule3") || "Ensure your face is well-lit — avoid backlighting." },
            { icon: <User size={16} />, text: t("faceRule2") || "Remove masks, sunglasses, and heavy headwear." },
            { icon: <Focus size={16} />, text: t("faceRule4") || "Look straight into the camera and stay still." },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-[13px] text-text-muted">
              <div className="p-2 rounded-xl bg-background border border-line text-accent/70 shrink-0">{item.icon}</div>
              <p className="leading-relaxed font-medium">{item.text}</p>
            </div>
          ))}
        </div>

        {modelLoadFailed && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold text-center">
            ⚠️ AI models failed to load.
          </div>
        )}

        <div className="p-4 rounded-2xl bg-background border border-line mb-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="relative flex items-center justify-center shrink-0 mt-0.5">
              <input type="checkbox" className="peer sr-only" checked={isCheckboxChecked} onChange={e => setIsCheckboxChecked(e.target.checked)} />
              <div className="w-5 h-5 rounded border-2 border-accent bg-accent/5 peer-checked:bg-accent transition-all duration-300" />
              <ShieldCheck className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
            <span className="text-[11px] text-text-muted leading-relaxed">
              {t("faceRule1")}
            </span>
          </label>
        </div>

        <button
          type="button"
          disabled={!isCheckboxChecked}
          onClick={() => setHasConsented(true)}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-accent to-emerald-500 text-white font-black text-[12px] uppercase tracking-[0.15em] hover:brightness-110 disabled:grayscale disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_12px_40px_-12px_rgba(16,185,129,0.5)] disabled:shadow-none"
        >
          {t("initializeCameraScan")}
        </button>
      </motion.div>
    );
  }

  // ── Scanner UI ────────────────────────────────────────────────────────────
  const isSuccess = scanStatus === "success";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="w-full max-w-sm mx-auto backdrop-blur-[40px] border rounded-[2rem] p-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] relative overflow-hidden flex flex-col items-center"
      style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
    >
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-accent via-emerald-400 to-accent" />

      {/* Ring + Camera */}
      <div className="relative w-64 h-64 mb-5 mt-2 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full z-10" viewBox="0 0 100 100">
          <defs>
            {/* Ombre gradient — matches the top accent bar perfectly */}
            <linearGradient id="faceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="50%" stopColor="#34d399" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
            <linearGradient id="successGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="warningGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>
          {/* Background track */}
          <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth="2" />
          {/* Progress arc with ombre gradient */}
          <motion.circle
            cx="50" cy="50" r="47"
            fill="none"
            stroke={isSuccess ? "url(#successGrad)" : warning ? "url(#warningGrad)" : "url(#faceGrad)"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="295.31"
            animate={{ strokeDashoffset: 295.31 - (progress / 100) * 295.31 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", filter: isSuccess ? "drop-shadow(0 0 6px #10B981)" : warning ? "drop-shadow(0 0 4px #ef4444)" : "drop-shadow(0 0 5px #10B98188)" }}
          />
        </svg>

        {/* Circular camera mask */}
        <div className="absolute inset-[12px] rounded-full overflow-hidden flex items-center justify-center bg-black/5" style={{ boxShadow: 'inset 0 0 0 1px var(--line), inset 0 8px 32px rgba(0,0,0,0.3)' }}>
          <motion.video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            initial={{ opacity: 0 }}
            animate={{ opacity: isSuccess ? 0.3 : (streamRef.current ? 1 : 0) }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 w-full h-full object-cover -scale-x-100 contrast-110 brightness-105"
          />

          {/* Scanning overlays */}
          {!warning && !isSuccess && streamRef.current && (
            <>
              <div className="absolute inset-[18%] pointer-events-none z-10 opacity-50">
                <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-accent rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-accent rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-accent rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-accent rounded-br-lg" />
              </div>
              <motion.div
                className="absolute left-0 right-0 h-[2px] bg-accent/80 shadow-[0_0_12px_rgba(16,185,129,1)] z-10"
                animate={{ top: ['8%', '92%', '8%'] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
              />
            </>
          )}

          {/* No stream yet */}
          {!streamRef.current && scanStatus !== "camera_error" && (
            <div className="flex flex-col items-center gap-3 opacity-40 z-10">
              <Camera size={40} style={{ color: 'var(--text)' }} className="animate-pulse" />
              <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'var(--text)' }}>{modelsLoaded ? "Starting Camera..." : "Loading AI..."}</p>
            </div>
          )}

          {/* Warning banner */}
          <AnimatePresence>
            {warning && !isSuccess && (
              <motion.div
                key={warning}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute inset-x-2 bottom-6 z-20 flex justify-center"
              >
                <div className="bg-red-500/95 backdrop-blur-xl text-white text-[10px] font-black uppercase tracking-wider py-2 px-3 rounded-2xl flex items-center gap-2 shadow-[0_6px_24px_rgba(239,68,68,0.5)] border border-red-400 max-w-[92%] text-center leading-tight">
                  <span className="shrink-0">{WARNING_ICONS[warning]}</span>
                  <span>{getWarningMessage(warning)}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success overlay */}
          <AnimatePresence>
            {isSuccess && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-20 flex items-center justify-center bg-accent/20 backdrop-blur-sm">
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", bounce: 0.6, duration: 0.8 }}
                  className="bg-white rounded-full p-5 shadow-[0_0_50px_rgba(16,185,129,1)] relative"
                >
                  <div className="absolute inset-0 bg-accent/30 rounded-full blur-md animate-ping" />
                  <ShieldCheck size={56} className="text-accent relative z-10" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Status text */}
      <div className="h-16 flex items-center justify-center w-full">
        <AnimatePresence mode="wait">
          {scanStatus === "idle" && (
            <motion.p key="idle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="font-bold uppercase tracking-[0.2em] text-[10px]" style={{ color: 'var(--accent)' }}>
              Initializing...
            </motion.p>
          )}
          {scanStatus === "scanning" && (
            <motion.div key="scanning" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="text-center">
              <p className={`font-black text-lg tracking-tight mb-1 transition-colors ${warning ? 'text-red-400' : ''}`} style={!warning ? { color: 'var(--text)' } : {}}>
                {warning ? 'Adjust Position' : 'Scanning...'}
              </p>
              <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {warning ? 'System will retry automatically' : 'Hold still — verifying identity'}
              </p>
            </motion.div>
          )}
          {isSuccess && (
            <motion.div key="success" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
              <p className="font-black text-2xl tracking-tighter mb-1" style={{ color: 'var(--accent)' }}>Identity Verified</p>
              <p className="text-[10px] uppercase font-black tracking-[0.3em]" style={{ color: 'var(--accent)', opacity: 0.6 }}>Access Granted</p>
            </motion.div>
          )}
          {scanStatus === "camera_error" && (
            <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3 text-red-400">
              <div className="flex items-center gap-2 text-sm font-bold">
                <AlertCircle size={16} />
                <span>Camera Access Denied</span>
              </div>
              <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>Please allow camera access in your browser settings and try again.</p>
              <button
                onClick={startCamera}
                type="button"
                className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest px-5 py-2 bg-red-500/10 border border-red-500/30 rounded-full hover:bg-red-500/20 transition-all text-red-400"
              >
                <RefreshCw size={12} /> Retry Camera
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      {scanStatus === "scanning" && (
        <div className="w-full mt-2">
          <div className="w-full h-1 bg-line rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400"
              animate={{ width: `${progress}%`, backgroundColor: warning ? '#EF4444' : undefined }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <p className="text-center text-[9px] text-text-muted mt-1.5 font-bold uppercase tracking-widest">{Math.round(progress)}% Confidence</p>
        </div>
      )}
    </motion.div>
  );
}
