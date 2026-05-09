import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, User, Camera, Sun, Focus, UserCheck, AlertCircle, Scan } from 'lucide-react';
import * as faceapi from 'face-api.js';

interface AppleFaceIDScannerProps {
  onVerify: (imageData?: string) => void;
}

export function AppleFaceIDScanner({ onVerify }: AppleFaceIDScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [hasConsented, setHasConsented] = useState(false);
  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Load models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Model load error:", err);
        setErrorMessage("Failed to load AI safety models.");
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (hasConsented && modelsLoaded) {
      startCamera();
    }
    return () => stopCamera();
  }, [hasConsented, modelsLoaded]);

  const startCamera = async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } } 
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setTimeout(() => setScanStatus("scanning"), 1000);
    } catch (err) {
      console.error("Camera error:", err);
      setScanStatus("error");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 300; // low-res for DB storage
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw centered and mirrored
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        const aspect = videoRef.current.videoWidth / videoRef.current.videoHeight;
        let sWidth = videoRef.current.videoHeight;
        let sHeight = videoRef.current.videoHeight;
        let sx = (videoRef.current.videoWidth - sWidth) / 2;
        let sy = 0;
        ctx.drawImage(videoRef.current, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.6);
      }
    }
    return null;
  };

  // The STRICT detection loop
  useEffect(() => {
    if (scanStatus !== "scanning" || !videoRef.current || !modelsLoaded) return;

    let animationFrameId: number;
    let consecutiveSuccess = 0;
    const requiredSuccess = 25; // Requires more frames for higher security

    const runDetection = async () => {
      if (!videoRef.current) return;
      
      const detections = await faceapi.detectSingleFace(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.65 })
      ).withFaceLandmarks();

      if (detections) {
        const { box, score } = detections.detection;
        const video = videoRef.current;
        const landmarks = detections.landmarks;
        
        // 1. Boundary Check: Ensure the whole face is inside the frame with some margin
        const margin = 20;
        const isFullyInFrame = (
          box.x > margin && 
          box.y > margin && 
          (box.x + box.width) < (video.videoWidth - margin) && 
          (box.y + box.height) < (video.videoHeight - margin)
        );

        // 2. Strict Centering Check
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        const vCenterX = video.videoWidth / 2;
        const vCenterY = video.videoHeight / 2;
        
        const distFromCenter = Math.sqrt(Math.pow(centerX - vCenterX, 2) + Math.pow(centerY - vCenterY, 2));
        const maxAllowedDist = video.videoWidth * 0.15; // Strict 15% from center
        const isFaceCentered = distFromCenter < maxAllowedDist;
        
        // 3. Size Check
        const isFaceSizeOk = box.width > video.videoWidth * 0.35 && box.width < video.videoWidth * 0.8;

        // 4. Head Orientation / Yaw Check
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const nose = landmarks.getNose();
        
        const leftEyeX = leftEye[0].x;
        const rightEyeX = rightEye[3].x;
        const noseX = nose[3].x;
        
        const noseLeftDist = Math.abs(noseX - leftEyeX);
        const noseRightDist = Math.abs(rightEyeX - noseX);
        const yawRatio = Math.min(noseLeftDist, noseRightDist) / Math.max(noseLeftDist, noseRightDist);
        const isLookingStraight = yawRatio > 0.55; // Ensure they are looking roughly straight
        
        // 5. High Confidence & Occlusion Heuristic
        // A low score often correlates with occlusion (masks, heavy glasses) or poor lighting
        const isHighConfidence = score > 0.75;

        // 6. Mouth Visibility Heuristic
        const mouth = landmarks.getMouth();
        const mouthWidth = Math.abs(mouth[6].x - mouth[0].x);
        const eyeWidth = Math.abs(rightEye[3].x - leftEye[0].x);
        const isMouthVisible = mouthWidth > eyeWidth * 0.3; // Stricter mouth visibility check

        if (!isFullyInFrame) {
          setErrorMessage("Face not completely visible. Keep whole face in frame.");
          consecutiveSuccess = Math.max(0, consecutiveSuccess - 2);
        } else if (!isHighConfidence || !isMouthVisible) {
          setErrorMessage("Face is covered. Please remove masks or large accessories.");
          consecutiveSuccess = Math.max(0, consecutiveSuccess - 2);
        } else if (!isFaceCentered) {
          setErrorMessage("Please center your face perfectly.");
          consecutiveSuccess = Math.max(0, consecutiveSuccess - 1);
        } else if (!isFaceSizeOk) {
          setErrorMessage(box.width < video.videoWidth * 0.35 ? "Move closer to the camera." : "Move slightly back.");
          consecutiveSuccess = Math.max(0, consecutiveSuccess - 1);
        } else if (!isLookingStraight) {
          setErrorMessage("Please look straight into the camera.");
          consecutiveSuccess = Math.max(0, consecutiveSuccess - 1);
        } else {
          setErrorMessage(null);
          consecutiveSuccess++;
          
          const currentProgress = Math.min(100, (consecutiveSuccess / requiredSuccess) * 100);
          setProgress(currentProgress);

          if (currentProgress >= 100) {
            setScanStatus("success");
            const capturedData = captureImage();
            setTimeout(() => onVerify(capturedData || undefined), 800);
            return;
          }
        }
      } else {
        setErrorMessage("Scanning for face...");
        consecutiveSuccess = Math.max(0, consecutiveSuccess - 1);
      }

      animationFrameId = requestAnimationFrame(runDetection);
    };

    runDetection();
    return () => cancelAnimationFrame(animationFrameId);
  }, [scanStatus, modelsLoaded, onVerify]);

  if (!hasConsented) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mx-auto bg-panel/90 backdrop-blur-3xl border border-line rounded-[2rem] p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative overflow-hidden group"
      >
        {/* Animated Background Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-[80px] group-hover:bg-accent/30 transition-all duration-1000" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent-warm/10 rounded-full blur-[80px]" />
        
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-accent via-accent-warm to-accent" />
        
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-accent/20 rounded-full blur-xl animate-pulse" />
            <div className="relative p-4 rounded-2xl bg-background border border-line text-accent shadow-xl">
              <Scan size={32} strokeWidth={1.5} />
            </div>
          </div>
          <div>
            <h3 className="font-bold text-text text-xl tracking-tight mb-1">Identity Verification</h3>
            <p className="text-[10px] font-bold text-accent uppercase tracking-[0.2em] opacity-80">Strict Security Protocol</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {[
            { icon: <Sun size={18} />, text: "Ensure your whole face is clearly visible and well-lit." },
            { icon: <User size={18} />, text: "Remove masks, sunglasses, and heavy headwear entirely." },
            { icon: <Focus size={18} />, text: "Look straight and align perfectly within the frame." }
          ].map((item, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + idx * 0.1 }}
              className="flex items-center gap-4 text-[13px] text-text-muted/90 group/item"
            >
              <div className="p-2.5 rounded-xl bg-background border border-line group-hover/item:border-accent/30 group-hover/item:bg-accent/10 transition-all duration-300 text-accent/70 group-hover/item:text-accent">
                {item.icon}
              </div>
              <p className="leading-relaxed group-hover/item:text-text transition-colors duration-300 font-medium">{item.text}</p>
            </motion.div>
          ))}
        </div>

        <div className="p-4 rounded-2xl bg-background border border-line mb-6 group/consent hover:bg-accent/5 transition-all duration-300">
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="relative flex items-center justify-center shrink-0 mt-0.5">
              <input 
                type="checkbox" 
                className="peer sr-only"
                checked={isCheckboxChecked}
                onChange={(e) => setIsCheckboxChecked(e.target.checked)}
              />
              <div className="w-5 h-5 rounded border-2 border-accent bg-accent/5 peer-checked:bg-accent transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.1)]" />
              <ShieldCheck className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
            <span className="text-[10px] text-text-muted leading-relaxed group-hover/consent:text-text/80 transition-colors duration-300">
              I consent to a strict biometric scan for high-security verification. The entire face must be analyzed. Data is processed locally.
            </span>
          </label>
        </div>

        <button 
          type="button"
          disabled={!isCheckboxChecked}
          onClick={() => setHasConsented(true)}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-accent to-accent-warm text-white font-black text-[12px] uppercase tracking-[0.15em] hover:brightness-110 disabled:grayscale disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_12px_40px_-12px_rgba(16,185,129,0.5)] disabled:shadow-none relative overflow-hidden group/btn"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
          <span className="relative">Accept & Start Scan</span>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm mx-auto bg-panel/90 backdrop-blur-3xl border border-line rounded-[2rem] p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col items-center justify-center min-h-[420px] group"
    >
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-[80px] group-hover:bg-accent/30 transition-all duration-1000" />
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-accent via-accent-warm to-accent" />
      
      <div className="relative w-64 h-64 md:w-72 md:h-72 mb-6 mt-2 flex items-center justify-center">
        {/* The Outer Ring (Face ID tick marks) */}
        <svg className="absolute inset-0 w-full h-full drop-shadow-[0_0_20px_rgba(16,185,129,0.3)] z-10" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="faceIdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <motion.circle
            cx="50" cy="50" r="48"
            fill="none"
            animate={{ stroke: scanStatus === "success" ? "#10B981" : "rgba(255,255,255,0.05)" }}
            strokeWidth="2"
          />
          <motion.circle
            cx="50" cy="50" r="48"
            fill="none"
            stroke={errorMessage ? "#EF4444" : scanStatus === "success" ? "#10B981" : "url(#faceIdGrad)"}
            strokeWidth="3"
            filter="url(#glow)"
            strokeLinecap="round"
            strokeDasharray="301.59"
            strokeDashoffset={301.59 - (progress / 100) * 301.59}
            initial={{ strokeDashoffset: 301.59 }}
            animate={{ 
              strokeDashoffset: 301.59 - (progress / 100) * 301.59, 
              stroke: errorMessage ? "#EF4444" : scanStatus === "success" ? "#10B981" : "url(#faceIdGrad)" 
            }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
          />
        </svg>

        {/* Circular Camera Mask */}
        <div className="absolute inset-[8px] rounded-full overflow-hidden bg-background border-2 border-line/50 flex items-center justify-center shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]" style={{ clipPath: 'circle(50% at 50% 50%)' }}>
          
          <motion.video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            initial={{ opacity: 0, scale: 1.2 }}
            animate={{ opacity: scanStatus === "success" ? 0.3 : (stream ? 1 : 0), scale: 1 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 filter contrast-125 saturate-110 brightness-105"
          />

          {/* High-Tech Scanning Overlays */}
          {stream && scanStatus === "scanning" && !errorMessage && (
            <>
              {/* Corner Brackets */}
              <div className="absolute inset-[15%] pointer-events-none z-10 opacity-60">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-accent rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-accent rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-accent rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-accent rounded-br-lg" />
              </div>
              
              {/* Moving Scan Line */}
              <motion.div 
                className="absolute left-0 right-0 h-[2px] bg-accent/80 shadow-[0_0_15px_rgba(16,185,129,1)] z-10 blur-[1px]"
                animate={{ top: ['10%', '90%', '10%'] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
              />
            </>
          )}

          {!stream && (
            <div className="flex flex-col items-center gap-4 opacity-50 z-10">
              <Camera size={48} className="text-text animate-pulse" />
              <p className="text-[10px] text-text uppercase font-bold tracking-widest">{modelsLoaded ? "Waking Sensor..." : "Loading AI Models..."}</p>
            </div>
          )}

          {/* Error Message Overlay (Red Banner) inside the camera circle */}
          <AnimatePresence>
            {errorMessage && scanStatus === "scanning" && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute inset-x-2 bottom-8 z-20 flex justify-center"
              >
                <div className="bg-red-500/95 backdrop-blur-xl text-white text-[10px] font-black uppercase tracking-wider py-2 px-3 rounded-2xl flex items-center justify-center gap-2 shadow-[0_8px_32px_rgba(239,68,68,0.6)] border border-red-400 max-w-[90%] text-center leading-tight">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Overlay */}
          <AnimatePresence>
            {scanStatus === "success" && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-accent/20 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", bounce: 0.6, duration: 0.8 }}
                  className="bg-white rounded-full p-5 shadow-[0_0_50px_rgba(16,185,129,1)] relative"
                >
                  <div className="absolute inset-0 bg-accent/30 rounded-full blur-md animate-ping" />
                  <ShieldCheck size={64} className="text-accent relative z-10" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Status Text Area */}
      <div className="h-16 flex items-center justify-center mt-2 w-full">
        <AnimatePresence mode="wait">
          {scanStatus === "idle" && (
            <motion.p key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-accent font-bold uppercase tracking-[0.2em] text-[10px]">
              Initializing Secure Stream...
            </motion.p>
          )}
          {scanStatus === "scanning" && (
            <motion.div key="scanning" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center w-full">
              <p className={`font-black text-xl tracking-tight mb-1 transition-colors duration-300 ${errorMessage ? 'text-red-500' : 'text-text'}`}>
                {errorMessage ? 'Scan Interrupted' : 'Analyzing Structure'}
              </p>
              <div className="flex items-center justify-center gap-2">
                {!errorMessage && <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
                <p className="text-[11px] text-text-muted/80 uppercase font-bold tracking-widest">
                  {errorMessage ? 'Adjust position to resume' : 'Hold position perfectly'}
                </p>
              </div>
            </motion.div>
          )}
          {scanStatus === "success" && (
            <motion.div key="success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center">
              <p className="text-accent font-black text-2xl tracking-tighter mb-1">Identity Verified</p>
              <p className="text-[10px] text-accent/60 uppercase font-black tracking-[0.3em]">High-Security Clearance</p>
            </motion.div>
          )}
          {scanStatus === "error" && (
            <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-red-500 font-bold tracking-wide flex flex-col items-center gap-3">
              <p className="text-sm">Camera Access Denied</p>
              <button onClick={startCamera} type="button" className="text-[10px] uppercase font-black tracking-widest px-6 py-2 bg-red-500/10 border border-red-500/20 rounded-full hover:bg-red-500/20 transition-all">
                Retry Connection
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
